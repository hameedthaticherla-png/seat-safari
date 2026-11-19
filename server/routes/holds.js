const express = require('express');
const { run, get, query, getSetting, logAudit } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { checkHoldLimits } = require('../middleware/rateLimiter');

const router = express.Router();

// Helper to check and expire active hold if past checkin window
function evaluateHoldStatus(hold) {
  if (hold.status === 'active' && !hold.checked_in_at) {
    const checkinWindowMin = Number(getSetting('hold_checkin_window_minutes', 15));
    const startMs = new Date(hold.start_time).getTime();
    const cutoffMs = startMs + checkinWindowMin * 60 * 1000;
    if (Date.now() > cutoffMs) {
      run("UPDATE holds SET status = 'expired', released_at = datetime('now') WHERE id = ?", [hold.id]);
      return { ...hold, status: 'expired' };
    }
  }
  return hold;
}

// 1. GET /api/holds/my-active - Get logged in student's current active hold
router.get('/my-active', requireAuth, (req, res) => {
  const userId = req.user.id;
  const rawHold = get(
    `SELECT h.*, s.name as room_name, s.location as room_location 
     FROM holds h 
     JOIN spaces s ON h.room_id = s.id 
     WHERE h.user_id = ? AND h.status IN ('active', 'checked_in') 
     ORDER BY h.start_time DESC LIMIT 1`,
    [userId]
  );

  if (!rawHold) {
    return res.json({ hold: null });
  }

  const hold = evaluateHoldStatus(rawHold);
  if (hold.status === 'expired') {
    return res.json({ hold: null, message: 'Your previous hold expired due to lack of check-in.' });
  }

  const checkinWindowMin = Number(getSetting('hold_checkin_window_minutes', 15));
  const startMs = new Date(hold.start_time).getTime();
  const endMs = new Date(hold.end_time).getTime();
  const checkinDeadlineMs = startMs + checkinWindowMin * 60 * 1000;
  const checkinSecondsRemaining = Math.max(0, Math.floor((checkinDeadlineMs - Date.now()) / 1000));
  const holdSecondsRemaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));

  return res.json({
    hold: {
      id: hold.id,
      room_id: hold.room_id,
      room_name: hold.room_name,
      room_location: hold.room_location,
      status: hold.status,
      start_time: hold.start_time,
      end_time: hold.end_time,
      checked_in_at: hold.checked_in_at,
      checkin_seconds_remaining: checkinSecondsRemaining,
      hold_seconds_remaining: holdSecondsRemaining,
      needs_checkin: hold.status === 'active' && !hold.checked_in_at
    }
  });
});

// 2. POST /api/holds/:roomId - Request a hold on an opted-in group room
router.post('/:roomId', requireAuth, (req, res) => {
  const { roomId } = req.params;
  const userId = req.user.id;
  const { durationMinutes = 120 } = req.body;

  // 1. Check room exists & is opted-in
  const room = get('SELECT id, name, hold_enabled FROM spaces WHERE id = ?', [roomId]);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  if (!room.hold_enabled) {
    return res.status(400).json({ error: 'This space is not opted in for reservations/holds.' });
  }

  // 2. Check student limits (1 active, daily limit)
  const limitCheck = checkHoldLimits(userId);
  if (!limitCheck.allowed) {
    return res.status(400).json({ error: limitCheck.message });
  }

  // 3. Check if room is currently held by someone else
  const currentHold = get(
    "SELECT id, start_time, end_time, status FROM holds WHERE room_id = ? AND status IN ('active', 'checked_in')",
    [roomId]
  );
  if (currentHold) {
    const updated = evaluateHoldStatus(currentHold);
    if (updated.status !== 'expired') {
      return res.status(409).json({ error: 'Room is currently held by another student group.' });
    }
  }

  // 4. Calculate timing
  const maxHours = Number(getSetting('hold_max_hours', 2));
  const actualDurationMinutes = Math.min(Number(durationMinutes) || 120, maxHours * 60);
  const now = new Date();
  const startTime = now.toISOString();
  const endTime = new Date(now.getTime() + actualDurationMinutes * 60 * 1000).toISOString();
  const holdId = 'hold_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  run(
    `INSERT INTO holds (id, room_id, user_id, start_time, end_time, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))`,
    [holdId, roomId, userId, startTime, endTime]
  );

  const checkinWindowMin = Number(getSetting('hold_checkin_window_minutes', 15));
  logAudit(req.user.display_name, req.user.role, 'request_hold', room.name, `Duration: ${actualDurationMinutes}m`);

  return res.status(201).json({
    message: `Hold confirmed for ${room.name}. Please check in within ${checkinWindowMin} minutes of arrival.`,
    hold: {
      id: holdId,
      room_id: roomId,
      room_name: room.name,
      status: 'active',
      start_time: startTime,
      end_time: endTime,
      checkin_window_minutes: checkinWindowMin
    }
  });
});

// 3. POST /api/holds/:id/check-in - Check in to confirm physical presence
router.post('/:id/check-in', requireAuth, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const rawHold = get('SELECT * FROM holds WHERE id = ?', [id]);
  if (!rawHold) {
    return res.status(404).json({ error: 'Hold not found' });
  }

  if (rawHold.user_id !== userId) {
    return res.status(403).json({ error: 'Unauthorized to check in for this hold' });
  }

  const hold = evaluateHoldStatus(rawHold);
  if (hold.status === 'expired') {
    return res.status(400).json({ error: 'Hold expired because the check-in window elapsed.' });
  }
  if (hold.status !== 'active') {
    return res.status(400).json({ error: `Cannot check in: hold status is already ${hold.status}` });
  }

  run(
    "UPDATE holds SET status = 'checked_in', checked_in_at = datetime('now') WHERE id = ?",
    [id]
  );

  return res.json({
    message: 'Check-in confirmed! Enjoy your collaboration session.',
    hold_id: id,
    status: 'checked_in'
  });
});

// 4. POST /api/holds/:id/release - Student releases hold when done
router.post('/:id/release', requireAuth, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const hold = get('SELECT * FROM holds WHERE id = ?', [id]);
  if (!hold) {
    return res.status(404).json({ error: 'Hold not found' });
  }

  if (hold.user_id !== userId) {
    return res.status(403).json({ error: 'Unauthorized to release this hold' });
  }

  run(
    "UPDATE holds SET status = 'released', released_at = datetime('now') WHERE id = ?",
    [id]
  );

  return res.json({
    message: 'Room hold released. Thank you for freeing up space for others!',
    hold_id: id,
    status: 'released'
  });
});

module.exports = router;
