const express = require('express');
const { randomUUID } = require('node:crypto');
const trackedBuildings = require('./occupancy-seed.json');
const { getPool, initializeSchema } = require('./vercel-db');

const router = express.Router();
const seatIndex = new Map();
for (const building of trackedBuildings) {
  for (const floor of building.floors) {
    for (const space of floor.spaces) {
      for (const seat of space.seats) seatIndex.set(seat.id, { seat, space });
    }
  }
}

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

async function clearStaleOccupancy() {
  const pool = getPool();
  await pool.query(`
    UPDATE seat_occupancy
    SET occupied = FALSE, device_token = NULL, expires_at = NULL, updated_at = NOW()
    WHERE occupied = TRUE AND expires_at IS NOT NULL AND expires_at <= NOW()
  `);

  const { rows } = await pool.query(`
    SELECT seat_id FROM seat_occupancy WHERE occupied = TRUE
  `);
  const afterClosing = rows
    .filter(({ seat_id }) => isPastClosing(seatIndex.get(seat_id)?.space?.hours))
    .map(({ seat_id }) => seat_id);
  if (afterClosing.length) {
    await pool.query(`
      UPDATE seat_occupancy
      SET occupied = FALSE, device_token = NULL, expires_at = NULL, updated_at = NOW()
      WHERE seat_id = ANY($1::text[]) AND occupied = TRUE
    `, [afterClosing]);
  }
}

async function loadTrackedLocations(deviceToken = '') {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT seat_id, occupied, device_token, expires_at, updated_at
    FROM seat_occupancy
    WHERE occupied = TRUE AND (expires_at IS NULL OR expires_at > NOW())
  `);
  const occupancyBySeat = new Map(rows
    .filter(({ seat_id }) => !isPastClosing(seatIndex.get(seat_id)?.space?.hours))
    .map((row) => [row.seat_id, row]));

  return trackedBuildings.map((building) => ({
    id: building.id,
    name: building.name,
    campus: building.campus,
    hours: building.hours,
    sort_order: building.sort_order,
    floors: building.floors.map((floor) => ({
      id: floor.id,
      building_id: floor.building_id,
      floor_number: floor.floor_number,
      name: floor.name,
      description: floor.description,
      spaces: floor.spaces.map((space) => {
        const seats = space.seats.map((seat) => {
          const occupancy = occupancyBySeat.get(seat.id);
          return {
            ...seat,
            occupied: Boolean(occupancy),
            occupied_by_me: Boolean(occupancy && occupancy.device_token === deviceToken),
            updated_at: occupancy?.updated_at || null,
          };
        });
        return {
          id: space.id,
          name: space.name,
          building_id: space.building_id,
          floor_id: space.floor_id,
          description: space.description,
          facilities: space.facilities,
          hours: space.hours,
          total_seats: seats.length,
          occupied_seats: seats.filter((seat) => seat.occupied && !seat.is_blocked).length,
          seats,
        };
      }),
    })),
  }));
}

router.use(async (_req, res, next) => {
  try {
    await initializeSchema();
    next();
  } catch (error) {
    console.error('Vercel occupancy storage is unavailable:', error);
    res.status(503).json({ error: 'Seat occupancy is temporarily unavailable.' });
  }
});

router.get('/locations', async (req, res) => {
  try {
    res.json({ buildings: await loadTrackedLocations(req.get('X-Occupancy-Device') || '') });
  } catch (error) {
    console.error('Failed to read study-space occupancy:', error);
    res.status(500).json({ error: 'Failed to load seat occupancy' });
  }
});

router.get('/central-library', async (req, res) => {
  try {
    const building = (await loadTrackedLocations(req.get('X-Occupancy-Device') || ''))
      .find((item) => item.id === 'bld_library');
    if (!building) return res.status(404).json({ error: 'Central Library is not configured yet' });
    res.json({ building, floors: building.floors });
  } catch (error) {
    console.error('Failed to read library occupancy:', error);
    res.status(500).json({ error: 'Failed to load seat occupancy' });
  }
});

router.post('/seats/:seatId', async (req, res) => {
  const { occupied, device_token: deviceToken } = req.body || {};
  if (typeof occupied !== 'boolean' || typeof deviceToken !== 'string' || deviceToken.length < 16 || deviceToken.length > 128) {
    return res.status(400).json({ error: 'occupied and a valid device token are required' });
  }

  const selected = seatIndex.get(req.params.seatId);
  if (!selected) return res.status(404).json({ error: 'Seat not found' });
  const { seat, space } = selected;
  if (seat.is_blocked) return res.status(409).json({ error: 'This seat is unavailable' });
  if (occupied && isPastClosing(space.hours)) return res.status(409).json({ error: 'This study space is closed for today' });

  let client;
  try {
    const pool = getPool();
    await clearStaleOccupancy();
    client = await pool.connect();
    await client.query('BEGIN');

    // Create and lock the row before reading it so simultaneous check-ins cannot overwrite each other.
    await client.query(`
      INSERT INTO seat_occupancy (seat_id, occupied) VALUES ($1, FALSE)
      ON CONFLICT (seat_id) DO NOTHING
    `, [seat.id]);
    const { rows } = await client.query(`
      SELECT occupied, device_token, expires_at
      FROM seat_occupancy WHERE seat_id = $1 FOR UPDATE
    `, [seat.id]);
    const current = rows[0];
    const currentIsActive = current?.occupied
      && (!current.expires_at || new Date(current.expires_at).getTime() > Date.now());

    if (currentIsActive && current.device_token && current.device_token !== deviceToken) {
      const message = occupied
        ? 'This seat is already marked occupied'
        : 'Only the device that marked this seat can check it out';
      await client.query('ROLLBACK');
      return res.status(409).json({ error: message });
    }

    if (occupied && !currentIsActive) {
      const activeSeat = await client.query(`
        SELECT seat_id FROM seat_occupancy
        WHERE occupied = TRUE AND device_token = $1 AND seat_id <> $2
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `, [deviceToken, seat.id]);
      if (activeSeat.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This device already has an occupied seat. Check out first.' });
      }
    }

    const result = await client.query(`
      UPDATE seat_occupancy
      SET occupied = $2,
          device_token = CASE WHEN $2 THEN $3 ELSE NULL END,
          expires_at = CASE WHEN $2 THEN NOW() + INTERVAL '90 minutes' ELSE NULL END,
          updated_at = NOW()
      WHERE seat_id = $1
      RETURNING updated_at
    `, [seat.id, occupied, deviceToken]);
    await client.query('COMMIT');
    res.json({ seat_id: seat.id, seat_number: seat.seat_number, occupied, updated_at: result.rows[0].updated_at });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* connection may already be closed */ }
    }
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This device already has an occupied seat. Check out first.' });
    }
    console.error('Failed to update seat occupancy:', error);
    res.status(500).json({ error: 'Failed to update seat occupancy' });
  } finally {
    client?.release();
  }
});

router.post('/feedback', async (req, res) => {
  const { category, message, seat_id: seatId = null } = req.body || {};
  const validCategories = new Set(['suggestion', 'complaint', 'issue', 'feedback']);
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (!validCategories.has(category) || cleanMessage.length < 10 || cleanMessage.length > 2000) {
    return res.status(400).json({ error: 'Choose a feedback type and enter 10 to 2000 characters.' });
  }
  if (seatId !== null && (typeof seatId !== 'string' || !seatIndex.has(seatId))) {
    return res.status(400).json({ error: 'The selected seat could not be found.' });
  }

  try {
    await initializeSchema();
    const id = randomUUID();
    await getPool().query(`
      INSERT INTO occupancy_feedback (id, category, message, seat_id)
      VALUES ($1, $2, $3, $4)
    `, [id, category, cleanMessage, seatId]);
    res.status(201).json({ id, message: 'Thanks for your feedback.' });
  } catch (error) {
    console.error('Failed to save occupancy feedback:', error);
    res.status(500).json({ error: 'Could not save your feedback. Please try again.' });
  }
});

module.exports = router;
