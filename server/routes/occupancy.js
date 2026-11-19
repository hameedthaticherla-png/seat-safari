const express = require('express');
const { randomUUID } = require('node:crypto');
const { query, get, run, transaction } = require('../db');

const router = express.Router();

function isPastClosing(hours, now = new Date()) {
  const closing = /^Until (\d{2}):(\d{2})$/.exec(hours || '');
  if (!closing) return false;
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const currentHour = Number(timeParts.find((part) => part.type === 'hour')?.value || 0);
  const currentMinute = Number(timeParts.find((part) => part.type === 'minute')?.value || 0);
  return currentHour * 60 + currentMinute >= Number(closing[1]) * 60 + Number(closing[2]);
}

function clearStaleOccupancy() {
  run(`UPDATE seat_occupancy
       SET occupied = 0, device_token = NULL, expires_at = NULL, updated_at = datetime('now')
       WHERE occupied = 1 AND expires_at IS NOT NULL AND expires_at <= datetime('now')`);

  const scheduledSeats = query(
    `SELECT o.seat_id, p.hours
     FROM seat_occupancy o
     JOIN seats s ON s.id = o.seat_id
     JOIN spaces p ON p.id = s.space_id
     WHERE o.occupied = 1 AND p.hours LIKE 'Until %'`
  );
  for (const seat of scheduledSeats) {
    if (isPastClosing(seat.hours)) {
      run(`UPDATE seat_occupancy
           SET occupied = 0, device_token = NULL, expires_at = NULL, updated_at = datetime('now')
           WHERE seat_id = ? AND occupied = 1`, [seat.seat_id]);
    }
  }
}

function loadTrackedLocations(deviceToken = '') {
  clearStaleOccupancy();
  const buildings = query(
    `SELECT DISTINCT b.id, b.name, b.campus, b.hours, b.sort_order
     FROM buildings b JOIN spaces p ON p.building_id = b.id
     WHERE p.is_occupancy_tracked = 1
     ORDER BY CASE WHEN b.id = 'bld_library' THEN 0 ELSE 1 END, b.sort_order, b.name`
  );
  const floors = query(
    `SELECT f.id, f.building_id, f.floor_number, f.name, f.description
     FROM floors f JOIN buildings b ON b.id = f.building_id
     ORDER BY b.sort_order, f.floor_number`
  );
  const spaces = query(
    `SELECT id, name, building_id, floor_id, description, facilities, hours
     FROM spaces WHERE is_occupancy_tracked = 1 ORDER BY name`
  );
  const seats = query(
    `SELECT s.id, s.space_id, s.seat_number, s.row_label, s.col_index,
            s.seat_type, s.grid_x, s.grid_y, s.is_blocked,
            COALESCE(o.occupied, 0) AS occupied, o.updated_at,
            CASE WHEN o.device_token = ? THEN 1 ELSE 0 END AS occupied_by_me
     FROM seats s
     JOIN spaces p ON p.id = s.space_id
     LEFT JOIN seat_occupancy o ON o.seat_id = s.id
     WHERE p.is_occupancy_tracked = 1
     ORDER BY s.space_id, s.grid_y, s.grid_x, s.seat_number`,
    [deviceToken]
  );

  return buildings.map((building) => ({
    ...building,
    floors: floors.filter((floor) => floor.building_id === building.id).map((floor) => ({
      ...floor,
      spaces: spaces.filter((space) => space.building_id === building.id && space.floor_id === floor.id).map((space) => {
        let facilities = [];
        try { facilities = JSON.parse(space.facilities || '[]'); } catch { facilities = []; }
        const spaceSeats = seats.filter((seat) => seat.space_id === space.id);
        return {
          ...space,
          facilities,
          total_seats: spaceSeats.length,
          occupied_seats: spaceSeats.filter((seat) => Boolean(seat.occupied) && !seat.is_blocked).length,
          seats: spaceSeats,
        };
      }),
    })),
  }));
}

router.get('/locations', (req, res) => {
  try {
    res.json({ buildings: loadTrackedLocations(req.get('X-Occupancy-Device') || '') });
  } catch (err) {
    console.error('Failed to read study-space occupancy:', err);
    res.status(500).json({ error: 'Failed to load seat occupancy' });
  }
});

// Retained for compatibility with older clients while the campus view is adopted.
router.get('/central-library', (req, res) => {
  try {
    const building = loadTrackedLocations(req.get('X-Occupancy-Device') || '').find((item) => item.id === 'bld_library');
    if (!building) return res.status(404).json({ error: 'Central Library is not configured yet' });
    res.json({ building, floors: building.floors });
  } catch (err) {
    console.error('Failed to read library occupancy:', err);
    res.status(500).json({ error: 'Failed to load seat occupancy' });
  }
});

router.post('/seats/:seatId', (req, res) => {
  const { occupied, device_token: deviceToken } = req.body || {};
  if (typeof occupied !== 'boolean' || typeof deviceToken !== 'string' || deviceToken.length < 16 || deviceToken.length > 128) {
    return res.status(400).json({ error: 'occupied and a valid device token are required' });
  }

  try {
    clearStaleOccupancy();
    const seat = get(
      `SELECT s.id, s.seat_number, s.is_blocked, p.hours
       FROM seats s JOIN spaces p ON p.id = s.space_id
       WHERE s.id = ? AND p.is_occupancy_tracked = 1`,
      [req.params.seatId]
    );
    if (!seat) return res.status(404).json({ error: 'Seat not found' });
    if (seat.is_blocked) return res.status(409).json({ error: 'This seat is unavailable' });
    if (occupied && isPastClosing(seat.hours)) return res.status(409).json({ error: 'This study space is closed for today' });

    transaction(() => {
      const current = get('SELECT occupied, device_token FROM seat_occupancy WHERE seat_id = ?', [seat.id]);
      if (current?.occupied && current.device_token && current.device_token !== deviceToken) {
        const conflict = new Error(occupied
          ? 'This seat is already marked occupied'
          : 'Only the device that marked this seat can check it out');
        conflict.statusCode = 409;
        throw conflict;
      }
      if (occupied && !current?.occupied) {
        const activeSeat = get(
          `SELECT seat_id FROM seat_occupancy
           WHERE occupied = 1 AND device_token = ? AND seat_id <> ?
           LIMIT 1`,
          [deviceToken, seat.id]
        );
        if (activeSeat) {
          const conflict = new Error('This device already has an occupied seat. Check out first.');
          conflict.statusCode = 409;
          throw conflict;
        }
      }
      run(
        `INSERT INTO seat_occupancy (seat_id, occupied, device_token, expires_at, updated_at)
         VALUES (?, ?, ?, CASE WHEN ? = 1 THEN datetime('now', '+90 minutes') ELSE NULL END, datetime('now'))
         ON CONFLICT(seat_id) DO UPDATE SET occupied = excluded.occupied,
           device_token = excluded.device_token, expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`,
        [seat.id, occupied ? 1 : 0, occupied ? deviceToken : null, occupied ? 1 : 0]
      );
    });

    res.json({ seat_id: seat.id, seat_number: seat.seat_number, occupied, updated_at: new Date().toISOString() });
  } catch (err) {
    if (err.statusCode === 409) return res.status(409).json({ error: err.message });
    console.error('Failed to update seat occupancy:', err);
    res.status(500).json({ error: 'Failed to update seat occupancy' });
  }
});

router.post('/feedback', (req, res) => {
  const { category, message, seat_id: seatId = null } = req.body || {};
  const validCategories = new Set(['suggestion', 'complaint', 'issue', 'feedback']);
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (!validCategories.has(category) || cleanMessage.length < 10 || cleanMessage.length > 2000) {
    return res.status(400).json({ error: 'Choose a feedback type and enter 10 to 2000 characters.' });
  }
  if (seatId !== null && (typeof seatId !== 'string' || !get(
    `SELECT s.id FROM seats s JOIN spaces p ON p.id = s.space_id
     WHERE s.id = ? AND p.is_occupancy_tracked = 1`, [seatId]
  ))) {
    return res.status(400).json({ error: 'The selected seat could not be found.' });
  }

  try {
    const id = randomUUID();
    run(
      `INSERT INTO occupancy_feedback (id, category, message, seat_id)
       VALUES (?, ?, ?, ?)`,
      [id, category, cleanMessage, seatId]
    );
    res.status(201).json({ id, message: 'Thanks for your feedback.' });
  } catch (err) {
    console.error('Failed to save occupancy feedback:', err);
    res.status(500).json({ error: 'Could not save your feedback. Please try again.' });
  }
});

module.exports = router;
module.exports.isPastClosing = isPastClosing;
