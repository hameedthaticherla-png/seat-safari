const express = require('express');
const { run, get, query, getSetting, logAudit } = require('../db');
const { requireAuth, authenticateOptional } = require('../middleware/auth');
const { checkReportRateLimit } = require('../middleware/rateLimiter');

const router = express.Router();

// 1. POST /api/reports/:spaceId - Submit availability report ("Spotted a seat?")
router.post('/:spaceId', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  // Validate status
  if (!['Free', 'Filling up', 'Full'].includes(status)) {
    return res.status(400).json({ error: 'Status must be one of: Free, Filling up, Full' });
  }

  // Validate space exists
  const space = get('SELECT id, name FROM spaces WHERE id = ?', [spaceId]);
  if (!space) {
    return res.status(404).json({ error: 'Space not found' });
  }

  // Rate limit check: 1 report per student per space per 15 minutes
  const rateLimitCheck = checkReportRateLimit(userId, spaceId);
  if (!rateLimitCheck.allowed) {
    return res.status(429).json({ error: rateLimitCheck.message });
  }

  const expiryMinutes = Number(getSetting('report_expiry_minutes', 30));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000).toISOString();
  const reportId = 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  run(
    `INSERT INTO reports (id, space_id, user_id, status, created_at, expires_at, hidden, flagged, flag_count)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)`,
    [reportId, spaceId, userId, status, now.toISOString(), expiresAt]
  );

  return res.status(201).json({
    message: 'Thanks for spotting! Your report will help fellow students for the next 30 minutes.',
    report: {
      id: reportId,
      space_id: spaceId,
      status,
      created_at: now.toISOString(),
      age_minutes: 0,
      age_text: 'just now'
    }
  });
});

// 2. POST /api/reports/:reportId/flag - "Wrong report? / Was this right?"
router.post('/:reportId/flag', authenticateOptional, (req, res) => {
  const { reportId } = req.params;
  const report = get('SELECT id, space_id, flag_count, hidden FROM reports WHERE id = ?', [reportId]);
  if (!report) {
    return res.status(404).json({ error: 'Report not found or has already expired' });
  }

  const newCount = (report.flag_count || 0) + 1;
  // If flagged 3 or more times, auto-hide it to protect students from false data
  const hide = newCount >= 3 ? 1 : 0;

  run(
    'UPDATE reports SET flagged = 1, flag_count = ?, hidden = ? WHERE id = ?',
    [newCount, hide, reportId]
  );

  return res.json({
    message: hide === 1 
      ? 'Thank you. This report received multiple flags and has been retired.'
      : 'Thank you for your feedback. We have marked this report for review.',
    retired: hide === 1
  });
});

// 3. POST /api/reports/:spaceId/problem - Report a problem (broken outlet, noise, etc.)
router.post('/:spaceId/problem', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const { category = 'general', note } = req.body;
  const userId = req.user.id;

  if (!note || note.trim().length === 0) {
    return res.status(400).json({ error: 'Please provide details about the problem' });
  }

  const space = get('SELECT id, name FROM spaces WHERE id = ?', [spaceId]);
  if (!space) {
    return res.status(404).json({ error: 'Space not found' });
  }

  const problemId = 'prob_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  run(
    `INSERT INTO problem_reports (id, space_id, user_id, category, note, created_at, resolved)
     VALUES (?, ?, ?, ?, ?, datetime('now'), 0)`,
    [problemId, spaceId, userId, category, note.trim()]
  );

  logAudit(req.user.display_name, req.user.role, 'report_problem', space.name, `Problem note: ${category}`);

  return res.status(201).json({
    message: 'Problem report submitted. Campus facilities & library staff have been notified.'
  });
});

module.exports = router;
