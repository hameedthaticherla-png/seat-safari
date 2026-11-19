const express = require('express');
const { run, query, get } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/favourites - List user's saved spaces
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.id;
  const favs = query(
    `SELECT s.*, f.created_at as favourited_at 
     FROM favourites f 
     JOIN spaces s ON f.space_id = s.id 
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC`,
    [userId]
  );

  const formatted = favs.map(space => ({
    ...space,
    facilities: JSON.parse(space.facilities || '[]'),
    only_if_no_class: Boolean(space.only_if_no_class),
    hold_enabled: Boolean(space.hold_enabled),
    is_favourite: true
  }));

  return res.json({ favourites: formatted });
});

// POST /api/favourites/:spaceId - Add space to favourites
router.post('/:spaceId', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const userId = req.user.id;

  const space = get('SELECT id, name FROM spaces WHERE id = ?', [spaceId]);
  if (!space) {
    return res.status(404).json({ error: 'Space not found' });
  }

  run(
    'INSERT OR IGNORE INTO favourites (user_id, space_id, created_at) VALUES (?, ?, datetime("now"))',
    [userId, spaceId]
  );

  return res.json({ message: `Added ${space.name} to favourites`, spaceId, is_favourite: true });
});

// DELETE /api/favourites/:spaceId - Remove space from favourites
router.delete('/:spaceId', requireAuth, (req, res) => {
  const { spaceId } = req.params;
  const userId = req.user.id;

  run('DELETE FROM favourites WHERE user_id = ? AND space_id = ?', [userId, spaceId]);

  return res.json({ message: 'Removed from favourites', spaceId, is_favourite: false });
});

module.exports = router;
