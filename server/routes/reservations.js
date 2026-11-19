const express = require('express');
const { run, get, query, transaction, getSetting, logAudit } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Helper to clean up any expired holds across the system
function cleanupExpiredHolds() {
  run(
    "UPDATE seat_reservations SET status = 'expired' WHERE status = 'held' AND held_until <= datetime('now')"
  );
}

// Helper to evaluate check-in expiry (no-show) for reservations
function evaluateCheckInExpiry(resRecord) {
  if (resRecord.status === 'confirmed' && !resRecord.checked_in_at) {
    const checkinWindowMin = Number(getSetting('seat_checkin_window_minutes', 15));
    // Parse date and start_time
    const [startH, startM] = resRecord.start_time.split(':').map(Number);
    const startDate = new Date(resRecord.reservation_date);
    startDate.setHours(startH, startM, 0, 0);

    const cutoffMs = startDate.getTime() + checkinWindowMin * 60 * 1000;
    if (Date.now() > cutoffMs) {
      run("UPDATE seat_reservations SET status = 'no_show' WHERE id = ?", [resRecord.id]);
      return { ...resRecord, status: 'no_show' };
    }
  }
  return resRecord;
}

// 1. GET /api/reservations/hierarchy - Campus -> Building -> Floor -> Spaces/Rooms
router.get('/hierarchy', optionalAuth, (req, res) => {
  try {
    const buildings = query('SELECT * FROM buildings ORDER BY sort_order ASC, name ASC');
    const floors = query('SELECT * FROM floors ORDER BY sort_order ASC, floor_number ASC');
    const spaces = query(
      `SELECT s.id, s.name, s.location, s.zone_type, s.zone_rule, s.facilities, 
              s.hours, s.hold_enabled, s.only_if_no_class, s.building_id, s.floor_id, 
              s.layout_type, s.capacity_hint,
              (SELECT count(*) FROM seats WHERE space_id = s.id AND is_blocked = 0) as total_seats
       FROM spaces s
       ORDER BY s.name ASC`
    );

    // Group into a clean tree
    const hierarchy = buildings.map(b => {
      const bFloors = floors
        .filter(f => f.building_id === b.id)
        .map(f => {
          const fSpaces = spaces
            .filter(s => s.floor_id === f.id || (!s.floor_id && s.building_id === b.id))
            .map(s => ({
              ...s,
              facilities: typeof s.facilities === 'string' ? JSON.parse(s.facilities) : s.facilities
            }));
          return {
            ...f,
            spaces: fSpaces
          };
        });

      return {
        ...b,
        floors: bFloors
      };
    });

    res.json({ hierarchy, buildings: hierarchy });
  } catch (err) {
    console.error('Error fetching hierarchy:', err);
    res.status(500).json({ error: 'Failed to retrieve location hierarchy' });
  }
});

// 2. GET /api/reservations/spaces/:spaceId/layout - Room layout with tables & seats
router.get('/spaces/:spaceId/layout', optionalAuth, (req, res) => {
  try {
    const { spaceId } = req.params;
    const space = get(
      `SELECT s.*, b.name as building_name, b.code as building_code, f.name as floor_name, f.floor_number 
       FROM spaces s
       LEFT JOIN buildings b ON s.building_id = b.id
       LEFT JOIN floors f ON s.floor_id = f.id
       WHERE s.id = ?`,
      [spaceId]
    );

    if (!space) {
      return res.status(404).json({ error: 'Study space not found' });
    }

    space.facilities = typeof space.facilities === 'string' ? JSON.parse(space.facilities) : space.facilities;

    const tables = query('SELECT * FROM space_tables WHERE space_id = ? ORDER BY table_number ASC', [spaceId]);
    const seats = query(
      `SELECT s.*, t.label as table_label, t.table_number 
       FROM seats s
       LEFT JOIN space_tables t ON s.table_id = t.id
       WHERE s.space_id = ?
       ORDER BY s.row_label ASC, s.col_index ASC`,
      [spaceId]
    ).map(seat => ({
      ...seat,
      facilities: typeof seat.facilities === 'string' ? JSON.parse(seat.facilities) : seat.facilities
    }));

    // Front/display orientation indicator
    let frontLabel = 'FACING FRONT DISPLAY / WHITEBOARD';
    if (space.zone_type === 'Quiet') {
      frontLabel = 'FACING SILENT COURTYARD & QUIET WINDOW WALL';
    } else if (space.zone_type === 'Discussion') {
      frontLabel = 'FACING COLLABORATION BOARD & PRESENTATION SCREEN';
    }

    res.json({
      space: {
        ...space,
        front_label: frontLabel
      },
      front_label: frontLabel,
      layout_type: space.layout_type || 'table_grid',
      tables,
      seats
    });
  } catch (err) {
    console.error('Error fetching layout:', err);
    res.status(500).json({ error: 'Failed to load visual seat layout' });
  }
});

// 3. GET /api/reservations/spaces/:spaceId/availability - Real-time seat status for date & time slot
router.get('/spaces/:spaceId/availability', optionalAuth, (req, res) => {
  try {
    const { spaceId } = req.params;
    const { date, start_time = '09:00', end_time = '11:00' } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
    }

    // Clean up expired holds first
    cleanupExpiredHolds();

    const currentUserId = req.user ? req.user.id : null;

    // Get all seats in this space
    const seats = query(
      `SELECT s.id, s.seat_number, s.row_label, s.col_index, s.seat_type, s.facilities, 
              s.is_blocked, s.block_reason, s.grid_x, s.grid_y, s.table_id,
              t.label as table_label, t.table_number
       FROM seats s
       LEFT JOIN space_tables t ON s.table_id = t.id
       WHERE s.space_id = ?
       ORDER BY s.row_label ASC, s.col_index ASC`,
      [spaceId]
    );

    // Query active reservations/holds that overlap the requested time window on this date
    // Overlap: NOT (end_time <= requested_start OR start_time >= requested_end)
    const activeReservations = query(
      `SELECT r.id, r.seat_id, r.user_id, r.status, r.start_time, r.end_time, r.held_until,
              u.display_name as user_name
       FROM seat_reservations r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.space_id = ?
         AND r.reservation_date = ?
         AND r.status IN ('confirmed', 'checked_in', 'held')
         AND (r.held_until IS NULL OR r.held_until > datetime('now'))
         AND NOT (r.end_time <= ? OR r.start_time >= ?)`,
      [spaceId, date, start_time, end_time]
    );

    const reservationMap = new Map();
    for (const res of activeReservations) {
      reservationMap.set(res.seat_id, res);
    }

    const seatAvailability = seats.map(seat => {
      const activeRes = reservationMap.get(seat.id);
      let status = 'available';
      let heldByMe = false;
      let heldSecondsRemaining = 0;
      let reservationId = null;

      if (seat.is_blocked) {
        status = 'blocked';
      } else if (activeRes) {
        reservationId = activeRes.id;
        if (activeRes.status === 'confirmed' || activeRes.status === 'checked_in') {
          status = 'booked';
        } else if (activeRes.status === 'held') {
          status = 'held';
          if (currentUserId && activeRes.user_id === currentUserId) {
            heldByMe = true;
          }
          if (activeRes.held_until) {
            const remainingMs = new Date(activeRes.held_until).getTime() - Date.now();
            heldSecondsRemaining = Math.max(0, Math.floor(remainingMs / 1000));
          }
        }
      }

      return {
        ...seat,
        facilities: typeof seat.facilities === 'string' ? JSON.parse(seat.facilities) : seat.facilities,
        status,
        held_by_me: heldByMe,
        held_seconds_remaining: heldSecondsRemaining,
        reservation_id: reservationId
      };
    });

    res.json({
      date,
      start_time,
      end_time,
      total_seats: seats.length,
      available_seats_count: seatAvailability.filter(s => s.status === 'available').length,
      seats: seatAvailability
    });
  } catch (err) {
    console.error('Error fetching availability:', err);
    res.status(500).json({ error: 'Failed to query seat availability' });
  }
});

// 4. POST /api/reservations/hold - Create a temporary hold on a seat (e.g. 5 minutes)
router.post('/hold', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const { seat_id, date, start_time, end_time } = req.body;

    if (!seat_id || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required parameters: seat_id, date, start_time, end_time' });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    cleanupExpiredHolds();

    const holdMinutes = Number(getSetting('seat_hold_minutes', 5));
    const now = new Date();
    const heldUntil = new Date(now.getTime() + holdMinutes * 60 * 1000).toISOString();

    // Concurrency-safe atomic transaction
    const holdResult = transaction(() => {
      // 1. Verify seat exists and is not blocked
      const seat = get('SELECT id, space_id, seat_number, is_blocked FROM seats WHERE id = ?', [seat_id]);
      if (!seat) {
        throw new Error('Seat not found');
      }
      if (seat.is_blocked) {
        const err = new Error('Seat is temporarily blocked for maintenance');
        err.statusCode = 409;
        throw err;
      }

      // 2. Check for overlapping confirmed reservations or active holds by others
      const conflict = get(
        `SELECT id, user_id, status FROM seat_reservations 
         WHERE seat_id = ? 
           AND reservation_date = ? 
           AND status IN ('confirmed', 'checked_in', 'held')
           AND (held_until IS NULL OR held_until > datetime('now'))
           AND NOT (end_time <= ? OR start_time >= ?)`,
        [seat_id, date, start_time, end_time]
      );

      if (conflict) {
        if (conflict.user_id === userId && conflict.status === 'held') {
          // Extend user's existing hold
          run("UPDATE seat_reservations SET held_until = ? WHERE id = ?", [heldUntil, conflict.id]);
          return { hold_id: conflict.id, held_until: heldUntil, seat_number: seat.seat_number };
        }
        const err = new Error('Seat is currently booked or held by another student');
        err.statusCode = 409;
        throw err;
      }

      // 3. Release any previous active holds for this user on this space to avoid hoarding
      run(
        "UPDATE seat_reservations SET status = 'expired' WHERE user_id = ? AND status = 'held'",
        [userId]
      );

      // 4. Create new temporary hold
      const holdId = 'hold_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const bookingRef = 'HOLD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const qrToken = 'qr_' + holdId;

      run(
        `INSERT INTO seat_reservations (
          id, booking_reference, user_id, space_id, seat_id, reservation_date,
          start_time, end_time, status, held_until, qr_code_token, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'held', ?, ?, datetime('now'))`,
        [holdId, bookingRef, userId, seat.space_id, seat_id, date, start_time, end_time, heldUntil, qrToken]
      );

      return {
        hold_id: holdId,
        booking_reference: bookingRef,
        seat_number: seat.seat_number,
        held_until: heldUntil,
        held_seconds_remaining: holdMinutes * 60
      };
    });

    res.status(201).json({
      message: `Seat ${holdResult.seat_number} held for ${holdMinutes} minutes. Complete confirmation to secure it.`,
      reservation: {
        id: holdResult.hold_id,
        booking_reference: holdResult.booking_reference,
        seat_id,
        held_until: holdResult.held_until,
        expires_in_seconds: holdResult.held_seconds_remaining
      },
      ...holdResult
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, code: 'SEAT_CONFLICT' });
    }
    console.error('Error holding seat:', err);
    res.status(400).json({ error: err.message || 'Failed to hold seat' });
  }
});

// 5. POST /api/reservations/release-hold - Student releases temporary hold
router.post('/release-hold', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const { hold_id, seat_id } = req.body;

    if (hold_id) {
      run("UPDATE seat_reservations SET status = 'expired' WHERE id = ? AND user_id = ?", [hold_id, userId]);
    } else if (seat_id) {
      run("UPDATE seat_reservations SET status = 'expired' WHERE seat_id = ? AND user_id = ? AND status = 'held'", [seat_id, userId]);
    }

    res.json({ message: 'Temporary hold released successfully' });
  } catch (err) {
    console.error('Error releasing hold:', err);
    res.status(500).json({ error: 'Failed to release hold' });
  }
});

// 6. POST /api/reservations/book - Atomically confirm reservation (with or without hold)
router.post('/book', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    let { seat_id, date, start_time, end_time, hold_id, reservation_id, notes = '' } = req.body;
    const activeHoldId = hold_id || reservation_id;

    if (activeHoldId && (!seat_id || !date || !start_time || !end_time)) {
      const existingHold = get(
        "SELECT * FROM seat_reservations WHERE id = ? AND user_id = ? AND status = 'held'",
        [activeHoldId, userId]
      );
      if (existingHold) {
        seat_id = seat_id || existingHold.seat_id;
        date = date || existingHold.reservation_date;
        start_time = start_time || existingHold.start_time;
        end_time = end_time || existingHold.end_time;
      }
    }

    if (!seat_id || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required reservation fields' });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    cleanupExpiredHolds();

    // Concurrency-safe atomic transaction
    const reservation = transaction(() => {
      // 1. Verify seat exists and is not blocked
      const seat = get(
        `SELECT s.id, s.space_id, s.seat_number, s.row_label, s.seat_type, s.is_blocked,
                sp.name as space_name, sp.location as space_location, sp.zone_rule, sp.hours,
                b.name as building_name, f.name as floor_name
         FROM seats s
         JOIN spaces sp ON s.space_id = sp.id
         LEFT JOIN buildings b ON sp.building_id = b.id
         LEFT JOIN floors f ON sp.floor_id = f.id
         WHERE s.id = ?`,
        [seat_id]
      );

      if (!seat) {
        throw new Error('Seat not found');
      }
      if (seat.is_blocked) {
        throw new Error('Seat is currently blocked for maintenance');
      }

      // 2. Prevent overlapping reservations for the SAME user (cannot be in 2 places at once)
      const userConflict = get(
        `SELECT id FROM seat_reservations 
         WHERE user_id = ? 
           AND reservation_date = ? 
           AND status IN ('confirmed', 'checked_in')
           AND NOT (end_time <= ? OR start_time >= ?)`,
        [userId, date, start_time, end_time]
      );
      if (userConflict) {
        const err = new Error('You already have another confirmed reservation during this time slot');
        err.statusCode = 400;
        throw err;
      }

      // 3. Check for conflict on this specific seat
      const conflict = get(
        `SELECT id, user_id, status FROM seat_reservations 
         WHERE seat_id = ? 
           AND reservation_date = ? 
           AND status IN ('confirmed', 'checked_in', 'held')
           AND (held_until IS NULL OR held_until > datetime('now'))
           AND NOT (end_time <= ? OR start_time >= ?)
           ${activeHoldId ? 'AND id != ?' : ''}`,
        activeHoldId ? [seat_id, date, start_time, end_time, activeHoldId] : [seat_id, date, start_time, end_time]
      );

      if (conflict) {
        const err = new Error('This seat was just reserved by another student for the selected slot');
        err.statusCode = 409;
        throw err;
      }

      // 4. Generate unique BookMyShow-style Booking Reference & secure QR token
      const bookingRef = 'SAFARI-' + Math.floor(100000 + Math.random() * 900000);
      const reservationId = 'res_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const qrToken = 'qr_' + bookingRef + '_' + Buffer.from(`${reservationId}:${userId}`).toString('base64url');

      if (activeHoldId) {
        // Upgrade existing hold to confirmed
        run(
          `UPDATE seat_reservations 
           SET status = 'confirmed', booking_reference = ?, qr_code_token = ?, 
               held_until = NULL, notes = ?, created_at = datetime('now')
           WHERE id = ? AND user_id = ?`,
          [bookingRef, qrToken, notes, activeHoldId, userId]
        );
      } else {
        // Direct insert
        run(
          `INSERT INTO seat_reservations (
            id, booking_reference, user_id, space_id, seat_id, reservation_date,
            start_time, end_time, status, qr_code_token, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, datetime('now'))`,
          [reservationId, bookingRef, userId, seat.space_id, seat_id, date, start_time, end_time, qrToken, notes]
        );
      }

      logAudit(req.user.display_name, req.user.role, 'reserve_seat', `${seat.space_name} - Seat ${seat.seat_number}`, `Date: ${date} ${start_time}-${end_time} Ref: ${bookingRef}`);

      return {
        id: activeHoldId || reservationId,
        booking_reference: bookingRef,
        seat_id,
        seat_number: seat.seat_number,
        space_id: seat.space_id,
        space_name: seat.space_name,
        building_name: seat.building_name,
        floor_name: seat.floor_name,
        reservation_date: date,
        start_time,
        end_time,
        status: 'confirmed',
        qr_code_token: qrToken,
        zone_rule: seat.zone_rule,
        checkin_deadline_minutes: Number(getSetting('seat_checkin_window_minutes', 15))
      };
    });

    res.status(201).json({
      message: `Reservation confirmed for Seat ${reservation.seat_number}! Reference: ${reservation.booking_reference}`,
      reservation
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message, code: 'SEAT_CONFLICT' });
    }
    console.error('Error confirming reservation:', err);
    res.status(err.statusCode || 400).json({ error: err.message || 'Failed to complete reservation' });
  }
});

// 7. GET /api/reservations/my - Logged in student's reservations (upcoming, active, history)
router.get('/my', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    cleanupExpiredHolds();

    const rawReservations = query(
      `SELECT r.*, s.seat_number, s.row_label, s.seat_type, s.facilities as seat_facilities,
              sp.name as space_name, sp.location as space_location, sp.zone_type, sp.zone_rule,
              b.name as building_name, f.name as floor_name, t.label as table_label
       FROM seat_reservations r
       JOIN seats s ON r.seat_id = s.id
       JOIN spaces sp ON r.space_id = sp.id
       LEFT JOIN buildings b ON sp.building_id = b.id
       LEFT JOIN floors f ON sp.floor_id = f.id
       LEFT JOIN space_tables t ON s.table_id = t.id
       WHERE r.user_id = ? AND r.status != 'expired'
       ORDER BY r.reservation_date DESC, r.start_time DESC`,
      [userId]
    );

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTimeStr = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;

    const reservations = rawReservations.map(r => {
      // Evaluate check-in expiry on the fly
      const evaluated = evaluateCheckInExpiry(r);
      const isToday = evaluated.reservation_date === todayStr;
      const isPast = evaluated.reservation_date < todayStr || (isToday && evaluated.end_time <= currentTimeStr);

      let lifeCycle = 'upcoming';
      if (evaluated.status === 'cancelled') lifeCycle = 'cancelled';
      else if (evaluated.status === 'no_show') lifeCycle = 'no_show';
      else if (isPast) lifeCycle = 'completed';
      else if (isToday && evaluated.start_time <= currentTimeStr && evaluated.end_time > currentTimeStr) {
        lifeCycle = 'active';
      }

      return {
        ...evaluated,
        seat_facilities: typeof evaluated.seat_facilities === 'string' ? JSON.parse(evaluated.seat_facilities) : evaluated.seat_facilities,
        lifecycle: lifeCycle,
        can_cancel: (evaluated.status === 'confirmed' || evaluated.status === 'held') && !isPast,
        can_check_in: evaluated.status === 'confirmed' && isToday && evaluated.end_time > currentTimeStr
      };
    });

    res.json({ reservations });
  } catch (err) {
    console.error('Error fetching student reservations:', err);
    res.status(500).json({ error: 'Failed to retrieve your reservations' });
  }
});

// 8. GET /api/reservations/:id - Single reservation details with QR data
router.get('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const raw = get(
      `SELECT r.*, s.seat_number, s.row_label, s.seat_type, s.facilities as seat_facilities,
              sp.name as space_name, sp.location as space_location, sp.zone_type, sp.zone_rule, sp.hours,
              b.name as building_name, f.name as floor_name, t.label as table_label,
              u.display_name as student_name, u.email as student_email
       FROM seat_reservations r
       JOIN seats s ON r.seat_id = s.id
       JOIN spaces sp ON r.space_id = sp.id
       LEFT JOIN buildings b ON sp.building_id = b.id
       LEFT JOIN floors f ON sp.floor_id = f.id
       LEFT JOIN space_tables t ON s.table_id = t.id
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`,
      [id]
    );

    if (!raw) {
      return res.status(404).json({ error: 'Reservation record not found' });
    }

    if (req.user.role !== 'staff' && raw.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to view this reservation' });
    }

    const reservation = evaluateCheckInExpiry(raw);
    reservation.seat_facilities = typeof reservation.seat_facilities === 'string' ? JSON.parse(reservation.seat_facilities) : reservation.seat_facilities;

    res.json({ reservation });
  } catch (err) {
    console.error('Error fetching reservation details:', err);
    res.status(500).json({ error: 'Failed to retrieve reservation details' });
  }
});

// 9. POST /api/reservations/:id/check-in - Physical check-in (via QR scan or button)
router.post('/:id/check-in', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const raw = get('SELECT * FROM seat_reservations WHERE id = ?', [id]);
    if (!raw) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (req.user.role !== 'staff' && raw.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to check in for this reservation' });
    }

    const record = evaluateCheckInExpiry(raw);
    if (record.status === 'no_show') {
      return res.status(400).json({ error: 'Reservation has already expired due to lack of check-in (no-show).' });
    }
    if (record.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot check in: this reservation was cancelled.' });
    }
    if (record.status === 'checked_in') {
      return res.json({ message: 'Already checked in', status: 'checked_in' });
    }

    run(
      "UPDATE seat_reservations SET status = 'checked_in', checked_in_at = datetime('now') WHERE id = ?",
      [id]
    );

    logAudit(req.user.display_name, req.user.role, 'check_in_seat', `Reservation ${record.booking_reference}`, 'Physical arrival confirmed');

    const updated = get('SELECT * FROM seat_reservations WHERE id = ?', [id]);

    res.json({
      message: 'Check-in confirmed! Welcome to your study session.',
      status: 'checked_in',
      checked_in_at: updated.checked_in_at,
      reservation: updated
    });
  } catch (err) {
    console.error('Error during check-in:', err);
    res.status(500).json({ error: 'Failed to process check-in' });
  }
});

// 10. POST /api/reservations/:id/cancel - Student or staff cancels reservation
router.post('/:id/cancel', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason = 'Cancelled by student' } = req.body;

    const reservation = get('SELECT * FROM seat_reservations WHERE id = ?', [id]);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (req.user.role !== 'staff' && reservation.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to cancel this reservation' });
    }

    if (reservation.status === 'cancelled') {
      return res.status(400).json({ error: 'Reservation is already cancelled' });
    }

    run(
      "UPDATE seat_reservations SET status = 'cancelled', cancelled_at = datetime('now'), cancellation_reason = ? WHERE id = ?",
      [reason, id]
    );

    logAudit(req.user.display_name, req.user.role, 'cancel_reservation', `Reservation ${reservation.booking_reference}`, `Reason: ${reason}`);

    res.json({
      message: 'Reservation cancelled successfully. Seat is now available for others.',
      status: 'cancelled',
      cancelled: true
    });
  } catch (err) {
    console.error('Error cancelling reservation:', err);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

// 11. GET /api/reservations/verify/:qrToken - QR code ticket scanner verification
router.get('/verify/:qrToken', optionalAuth, (req, res) => {
  try {
    const { qrToken } = req.params;
    const reservation = get(
      `SELECT r.*, s.seat_number, sp.name as space_name, sp.location as space_location,
              u.display_name as student_name
       FROM seat_reservations r
       JOIN seats s ON r.seat_id = s.id
       JOIN spaces sp ON r.space_id = sp.id
       JOIN users u ON r.user_id = u.id
       WHERE r.qr_code_token = ?`,
      [qrToken]
    );

    if (!reservation) {
      return res.status(404).json({ valid: false, error: 'Invalid or unrecognized QR ticket code' });
    }

    const evaluated = evaluateCheckInExpiry(reservation);
    const isValid = evaluated.status === 'confirmed' || evaluated.status === 'checked_in';

    res.json({
      valid: isValid,
      reservation: evaluated
    });
  } catch (err) {
    console.error('Error verifying QR token:', err);
    res.status(500).json({ valid: false, error: 'Verification error' });
  }
});

module.exports = router;
