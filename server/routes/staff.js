const express = require('express');
const { query, get, run, getSetting, setSetting, getAllSettings, logAudit } = require('../db');
const { requireRole, checkStaffScope } = require('../middleware/auth');

const router = express.Router();

// Enforce staff role on all routes in this router!
router.use(requireRole('staff'));

// 1. GET /api/staff/dashboard - Summary metrics & alerts
router.get('/dashboard', (req, res) => {
  const staffScope = req.user.staff_scope;
  const thresholdDays = Number(getSetting('staleness_threshold_days', 7));
  const cutoffStale = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();

  // Stale spaces
  const scopeClause = (staffScope && staffScope !== 'all') ? 'AND owner_scope = ?' : '';
  const scopeParams = (staffScope && staffScope !== 'all') ? [cutoffStale, staffScope] : [cutoffStale];

  const staleSpaces = query(
    `SELECT id, name, location, zone_type, last_checked_at, owner_scope 
     FROM spaces 
     WHERE last_checked_at < ? ${scopeClause} 
     ORDER BY last_checked_at ASC`,
    scopeParams
  );

  // Active reports (last 30m) - Strictly anonymized!
  const expiryMin = Number(getSetting('report_expiry_minutes', 30));
  const cutoffReport = new Date(Date.now() - expiryMin * 60 * 1000).toISOString();
  const recentReports = query(
    `SELECT r.id, r.space_id, r.status, r.created_at, r.flagged, r.flag_count, r.hidden, s.name as space_name 
     FROM reports r 
     JOIN spaces s ON r.space_id = s.id 
     WHERE r.created_at > ? AND r.hidden = 0 
     ORDER BY r.created_at DESC`,
    [cutoffReport]
  );

  // Active holds
  const activeHolds = query(
    `SELECT h.id, h.room_id, h.start_time, h.end_time, h.status, h.checked_in_at, s.name as room_name 
     FROM holds h 
     JOIN spaces s ON h.room_id = s.id 
     WHERE h.status IN ('active', 'checked_in') 
     ORDER BY h.start_time ASC`
  );

  // Problem reports
  const pendingProblems = query(
    `SELECT p.id, p.space_id, p.category, p.note, p.created_at, s.name as space_name 
     FROM problem_reports p 
     JOIN spaces s ON p.space_id = s.id 
     WHERE p.resolved = 0 
     ORDER BY p.created_at DESC`
  );

  // Total spaces managed
  const totalSpaces = query(
    `SELECT COUNT(*) as count FROM spaces ${staffScope && staffScope !== 'all' ? 'WHERE owner_scope = ?' : ''}`,
    (staffScope && staffScope !== 'all') ? [staffScope] : []
  )[0].count;

  return res.json({
    metrics: {
      total_spaces: totalSpaces,
      stale_spaces_count: staleSpaces.length,
      active_reports_count: recentReports.length,
      active_holds_count: activeHolds.length,
      pending_problems_count: pendingProblems.length
    },
    stale_spaces: staleSpaces,
    recent_reports: recentReports,
    active_holds: activeHolds,
    pending_problems: pendingProblems,
    user_scope: staffScope || 'all'
  });
});

// 2. GET /api/staff/spaces - List all spaces for staff management
router.get('/spaces', (req, res) => {
  const staffScope = req.user.staff_scope;
  let spaces;
  if (staffScope && staffScope !== 'all') {
    spaces = query('SELECT * FROM spaces WHERE owner_scope = ? ORDER BY name ASC', [staffScope]);
  } else {
    spaces = query('SELECT * FROM spaces ORDER BY name ASC');
  }

  const thresholdDays = Number(getSetting('staleness_threshold_days', 7));
  const formatted = spaces.map(s => {
    const diffDays = (Date.now() - new Date(s.last_checked_at).getTime()) / (1000 * 60 * 60 * 24);
    return {
      ...s,
      facilities: JSON.parse(s.facilities || '[]'),
      only_if_no_class: Boolean(s.only_if_no_class),
      hold_enabled: Boolean(s.hold_enabled),
      is_stale: diffDays > thresholdDays,
      days_since_check: Math.floor(diffDays),
      can_edit: !staffScope || staffScope === 'all' || staffScope === s.owner_scope
    };
  });

  return res.json({ spaces: formatted });
});

// 3. POST /api/staff/spaces - Create new study space
router.post('/spaces', (req, res) => {
  const {
    name, location, zone_type, zone_rule, facilities = [],
    hours, only_if_no_class = 0, hold_enabled = 0, owner_scope = 'library',
    description = '', capacity_hint = '', map_zone = ''
  } = req.body;

  if (!name || !location || !zone_type || !zone_rule || !hours) {
    return res.status(400).json({ error: 'Name, location, zone_type, zone_rule, and hours are required' });
  }

  // Check scope authorization
  if (req.user.staff_scope && req.user.staff_scope !== 'all' && owner_scope !== req.user.staff_scope) {
    return res.status(403).json({ error: `Cannot create space outside your assigned scope: ${req.user.staff_scope}` });
  }

  const id = 'spc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = new Date().toISOString();

  run(
    `INSERT INTO spaces (
      id, name, location, zone_type, zone_rule, facilities, hours,
      only_if_no_class, hold_enabled, last_checked_at, owner_scope,
      description, capacity_hint, map_zone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, name, location, zone_type, zone_rule, JSON.stringify(facilities), hours,
      only_if_no_class ? 1 : 0, hold_enabled ? 1 : 0, now, owner_scope,
      description, capacity_hint, map_zone
    ]
  );

  logAudit(req.user.display_name, req.user.role, 'create_space', name, `Zone: ${zone_type}, Scope: ${owner_scope}`);

  return res.status(201).json({ message: `Space ${name} created successfully`, id });
});

// 4. PUT /api/staff/spaces/:id - Edit existing space
router.put('/spaces/:id', (req, res) => {
  const { id } = req.params;
  const space = get('SELECT * FROM spaces WHERE id = ?', [id]);
  if (!space) {
    return res.status(404).json({ error: 'Space not found' });
  }

  // Scope check
  if (!checkStaffScope(id, req.user)) {
    return res.status(403).json({ 
      error: `Scope mismatch: You are assigned to '${req.user.staff_scope}', but this space belongs to '${space.owner_scope}'` 
    });
  }

  const {
    name = space.name,
    location = space.location,
    zone_type = space.zone_type,
    zone_rule = space.zone_rule,
    facilities = JSON.parse(space.facilities || '[]'),
    hours = space.hours,
    only_if_no_class = space.only_if_no_class,
    hold_enabled = space.hold_enabled,
    description = space.description,
    capacity_hint = space.capacity_hint,
    map_zone = space.map_zone,
    usual_busy_records = []
  } = req.body;

  run(
    `UPDATE spaces SET 
      name = ?, location = ?, zone_type = ?, zone_rule = ?, facilities = ?, hours = ?,
      only_if_no_class = ?, hold_enabled = ?, description = ?, capacity_hint = ?, map_zone = ?
     WHERE id = ?`,
    [
      name, location, zone_type, zone_rule, JSON.stringify(facilities), hours,
      only_if_no_class ? 1 : 0, hold_enabled ? 1 : 0, description, capacity_hint, map_zone, id
    ]
  );

  // Update usual busy records if provided
  if (Array.isArray(usual_busy_records) && usual_busy_records.length > 0) {
    run('DELETE FROM usual_busy WHERE space_id = ?', [id]);
    for (const b of usual_busy_records) {
      const busyId = 'busy_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      run(
        'INSERT INTO usual_busy (id, space_id, day_type, start_time, end_time, busy_level, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [busyId, id, b.day_type || 'teaching_days', b.start_time || '11:00', b.end_time || '16:00', b.busy_level || 'busy', b.notes || '']
      );
    }
  }

  logAudit(req.user.display_name, req.user.role, 'update_space', name, `Updated details & rules`);

  return res.json({ message: `Space ${name} updated successfully` });
});

// 5. POST /api/staff/spaces/:id/confirm - One-tap "Confirm still accurate"
router.post('/spaces/:id/confirm', (req, res) => {
  const { id } = req.params;
  const space = get('SELECT id, name, owner_scope FROM spaces WHERE id = ?', [id]);
  if (!space) {
    return res.status(404).json({ error: 'Space not found' });
  }

  if (!checkStaffScope(id, req.user)) {
    return res.status(403).json({ error: 'Scope mismatch: cannot verify spaces outside your scope' });
  }

  const now = new Date().toISOString();
  run('UPDATE spaces SET last_checked_at = ? WHERE id = ?', [now, id]);

  logAudit(req.user.display_name, req.user.role, 'confirm_accurate', space.name, 'One-tap verification');

  return res.json({ 
    message: `Confirmed ${space.name} is still accurate. Timestamp updated to today.`,
    last_checked_at: now
  });
});

// 6. POST /api/staff/spaces/bulk-confirm - Bulk "Confirm still accurate"
router.post('/spaces/bulk-confirm', (req, res) => {
  const { space_ids = [] } = req.body;
  if (!Array.isArray(space_ids) || space_ids.length === 0) {
    return res.status(400).json({ error: 'Please provide an array of space_ids to confirm' });
  }

  const now = new Date().toISOString();
  let confirmedCount = 0;

  for (const id of space_ids) {
    if (checkStaffScope(id, req.user)) {
      run('UPDATE spaces SET last_checked_at = ? WHERE id = ?', [now, id]);
      confirmedCount++;
    }
  }

  logAudit(req.user.display_name, req.user.role, 'bulk_confirm', `${confirmedCount} spaces`, 'Bulk verified accuracy');

  return res.json({
    message: `Successfully confirmed ${confirmedCount} spaces as still accurate.`,
    confirmedCount,
    last_checked_at: now
  });
});

// 7. GET /api/staff/reports - Review recent student reports (Strictly ANONYMIZED!)
router.get('/reports', (req, res) => {
  // CRITICAL PRIVACY: user_id is excluded from selection. No student names or IDs!
  const reports = query(
    `SELECT r.id, r.space_id, r.status, r.created_at, r.expires_at, r.hidden, r.flagged, r.flag_count, s.name as space_name 
     FROM reports r 
     JOIN spaces s ON r.space_id = s.id 
     ORDER BY r.created_at DESC LIMIT 50`
  );

  return res.json({ reports });
});

// 8. POST /api/staff/reports/:id/hide - Hide/retire inappropriate or erroneous report
router.post('/reports/:id/hide', (req, res) => {
  const { id } = req.params;
  const report = get('SELECT r.id, s.name as space_name FROM reports r JOIN spaces s ON r.space_id = s.id WHERE r.id = ?', [id]);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  run('UPDATE reports SET hidden = 1 WHERE id = ?', [id]);
  logAudit(req.user.display_name, req.user.role, 'hide_report', report.space_name, `Hidden report ID: ${id}`);

  return res.json({ message: 'Report hidden from public visibility' });
});

// 9. GET /api/staff/holds - View all active holds
router.get('/holds', (req, res) => {
  const holds = query(
    `SELECT h.id, h.room_id, h.start_time, h.end_time, h.checked_in_at, h.released_at, h.status, h.created_at, s.name as room_name, s.location as room_location 
     FROM holds h 
     JOIN spaces s ON h.room_id = s.id 
     ORDER BY h.start_time DESC LIMIT 50`
  );

  return res.json({ holds });
});

// 10. POST /api/staff/holds/:id/release - Staff releases any hold
router.post('/holds/:id/release', (req, res) => {
  const { id } = req.params;
  const hold = get('SELECT h.id, s.name as room_name FROM holds h JOIN spaces s ON h.room_id = s.id WHERE h.id = ?', [id]);
  if (!hold) {
    return res.status(404).json({ error: 'Hold not found' });
  }

  run("UPDATE holds SET status = 'cancelled_by_staff', released_at = datetime('now') WHERE id = ?", [id]);
  logAudit(req.user.display_name, req.user.role, 'release_hold', hold.room_name, `Force-released hold ID: ${id}`);

  return res.json({ message: `Hold for ${hold.room_name} released by staff` });
});

// 11. GET /api/staff/audit - View audit log
router.get('/audit', (req, res) => {
  const logs = query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
  return res.json({ logs });
});

// 12. GET /api/staff/settings - Retrieve all configurable settings
router.get('/settings', (req, res) => {
  const settingsList = getAllSettings();
  const settingsObj = {};
  for (const s of settingsList) {
    settingsObj[s.key] = { value: s.value, description: s.description };
  }
  return res.json({ settings: settingsObj });
});

// 13. PUT /api/staff/settings - Update configurable settings
router.put('/settings', (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings payload' });
  }

  for (const [key, value] of Object.entries(settings)) {
    setSetting(key, String(value));
  }

  logAudit(req.user.display_name, req.user.role, 'update_settings', 'System Settings', JSON.stringify(settings));

  return res.json({ message: 'Settings updated successfully' });
});

// 14. GET /api/staff/seating/reservations - View all seat reservations across campus
router.get('/seating/reservations', (req, res) => {
  const { space_id, date, status } = req.query;
  let sql = `
    SELECT r.*, s.seat_number, s.row_label, s.seat_type,
           sp.name as space_name, sp.location as space_location,
           b.name as building_name, f.name as floor_name,
           u.display_name as student_name, u.email as student_email
    FROM seat_reservations r
    JOIN seats s ON r.seat_id = s.id
    JOIN spaces sp ON r.space_id = sp.id
    LEFT JOIN buildings b ON sp.building_id = b.id
    LEFT JOIN floors f ON sp.floor_id = f.id
    JOIN users u ON r.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (space_id) {
    sql += ' AND r.space_id = ?';
    params.push(space_id);
  }
  if (date) {
    sql += ' AND r.reservation_date = ?';
    params.push(date);
  }
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY r.reservation_date DESC, r.start_time DESC LIMIT 100';

  const reservations = query(sql, params);
  res.json({ reservations });
});

// 15. POST /api/staff/seating/seats/:seatId/toggle-block - Staff block or unblock a seat for maintenance
router.post('/seating/seats/:seatId/toggle-block', (req, res) => {
  const { seatId } = req.params;
  const { block_reason = 'Blocked by staff for maintenance' } = req.body;

  const seat = get('SELECT * FROM seats WHERE id = ?', [seatId]);
  if (!seat) {
    return res.status(404).json({ error: 'Seat not found' });
  }

  const newBlocked = seat.is_blocked ? 0 : 1;
  run(
    'UPDATE seats SET is_blocked = ?, block_reason = ? WHERE id = ?',
    [newBlocked, newBlocked ? block_reason : null, seatId]
  );

  logAudit(
    req.user.display_name,
    req.user.role,
    newBlocked ? 'block_seat' : 'unblock_seat',
    `Seat ${seat.seat_number}`,
    newBlocked ? `Reason: ${block_reason}` : 'Restored to available service'
  );

  res.json({
    message: newBlocked ? `Seat ${seat.seat_number} blocked from bookings.` : `Seat ${seat.seat_number} unblocked and available.`,
    is_blocked: newBlocked,
    seat: { ...seat, is_blocked: newBlocked }
  });
});

// 16. POST /api/staff/seating/seats - Staff add a new seat
router.post('/seating/seats', (req, res) => {
  const { space_id, table_id = null, seat_number, row_label, col_index, seat_type = 'standard', facilities = ['power','wifi','desk_chair'], grid_x = 0, grid_y = 0 } = req.body;

  if (!space_id || !seat_number || !row_label) {
    return res.status(400).json({ error: 'Missing required seat parameters' });
  }

  const seatId = 'seat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const facStr = Array.isArray(facilities) ? JSON.stringify(facilities) : facilities;

  try {
    run(
      `INSERT INTO seats (id, space_id, table_id, seat_number, row_label, col_index, seat_type, facilities, is_blocked, grid_x, grid_y, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`,
      [seatId, space_id, table_id, seat_number, row_label, col_index || 1, seat_type, facStr, grid_x, grid_y]
    );

    logAudit(req.user.display_name, req.user.role, 'add_seat', `Seat ${seat_number}`, `Space ID: ${space_id}, Type: ${seat_type}`);

    res.status(201).json({
      message: `Seat ${seat_number} added successfully`,
      seat_id: seatId
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 17. PUT /api/staff/seating/seats/:seatId - Staff update seat
router.put('/seating/seats/:seatId', (req, res) => {
  const { seatId } = req.params;
  const { seat_number, row_label, seat_type, facilities, is_blocked, block_reason } = req.body;

  const seat = get('SELECT * FROM seats WHERE id = ?', [seatId]);
  if (!seat) {
    return res.status(404).json({ error: 'Seat not found' });
  }

  const facStr = facilities ? (Array.isArray(facilities) ? JSON.stringify(facilities) : facilities) : seat.facilities;

  run(
    `UPDATE seats SET 
       seat_number = COALESCE(?, seat_number),
       row_label = COALESCE(?, row_label),
       seat_type = COALESCE(?, seat_type),
       facilities = COALESCE(?, facilities),
       is_blocked = COALESCE(?, is_blocked),
       block_reason = ?
     WHERE id = ?`,
    [
      seat_number || null,
      row_label || null,
      seat_type || null,
      facStr,
      is_blocked !== undefined ? (is_blocked ? 1 : 0) : null,
      block_reason || null,
      seatId
    ]
  );

  logAudit(req.user.display_name, req.user.role, 'update_seat', `Seat ${seat.seat_number}`, `Updated configuration`);
  res.json({ message: 'Seat details updated successfully' });
});

// 18. POST /api/staff/seating/reservations/:id/cancel - Staff force-cancel reservation
router.post('/seating/reservations/:id/cancel', (req, res) => {
  const { id } = req.params;
  const { reason = 'Cancelled by library staff' } = req.body;

  const reservation = get('SELECT * FROM seat_reservations WHERE id = ?', [id]);
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  run(
    "UPDATE seat_reservations SET status = 'cancelled', cancelled_at = datetime('now'), cancellation_reason = ? WHERE id = ?",
    [reason, id]
  );

  logAudit(req.user.display_name, req.user.role, 'staff_cancel_reservation', `Ref ${reservation.booking_reference}`, `Reason: ${reason}`);

  res.json({ message: `Reservation ${reservation.booking_reference} cancelled by staff`, status: 'cancelled' });
});

// 19. POST /api/staff/seating/reservations/:id/check-in - Staff mark student as checked-in
router.post('/seating/reservations/:id/check-in', (req, res) => {
  const { id } = req.params;
  const reservation = get('SELECT * FROM seat_reservations WHERE id = ?', [id]);
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  run(
    "UPDATE seat_reservations SET status = 'checked_in', checked_in_at = datetime('now') WHERE id = ?",
    [id]
  );

  logAudit(req.user.display_name, req.user.role, 'staff_check_in', `Ref ${reservation.booking_reference}`, 'Staff marked student present');

  res.json({ message: `Student marked checked-in for ${reservation.booking_reference}`, status: 'checked_in' });
});

module.exports = router;
