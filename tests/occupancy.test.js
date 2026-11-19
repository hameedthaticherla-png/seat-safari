const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seat-safari-occupancy-'));
process.env.SAFARI_DB_PATH = path.join(testDir, 'test.db');

const express = require('express');
const routes = [];
express.Router = () => ({
  get(routePath, handler) { routes.push({ method: 'get', path: routePath, handler }); },
  post(routePath, handler) { routes.push({ method: 'post', path: routePath, handler }); },
});

const { seed } = require('../server/seed');
const { get, run: dbRun } = require('../server/db');
require('../server/routes/occupancy');
const isPastClosing = require('../server/routes/occupancy').isPastClosing;

const getRoute = routes.find((route) => route.method === 'get' && route.path === '/central-library').handler;
const getLocationsRoute = routes.find((route) => route.method === 'get' && route.path === '/locations').handler;
const postRoute = routes.find((route) => route.method === 'post' && route.path === '/seats/:seatId').handler;
const feedbackRoute = routes.find((route) => route.method === 'post' && route.path === '/feedback').handler;
function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
  };
}

async function run() {
  try {
    await seed();

    const initial = response();
    getRoute({ get: () => 'test-device-token-123456' }, initial);
    assert.equal(initial.statusCode, 200);
    assert.equal(initial.data.floors.length, 5);
    assert.deepEqual(
      initial.data.floors.map((floor) => floor.spaces.reduce((sum, space) => sum + space.total_seats, 0)),
      [100, 100, 100, 100, 100],
      'Each Central Library floor should have 100 configured seats'
    );
    assert.equal(isPastClosing('Until 19:00', new Date('2026-11-19T13:29:00Z')), false);
    assert.equal(isPastClosing('Until 19:00', new Date('2026-11-19T13:30:00Z')), true);

    const locations = response();
    getLocationsRoute({ get: () => 'test-device-token-123456' }, locations);
    assert.equal(locations.data.buildings.length, 7, 'Return the library and six academic blocks');
    const blocks = locations.data.buildings.filter((building) => building.id.startsWith('bld_academic_'));
    assert.equal(blocks.length, 6);
    for (const block of blocks) {
      assert.equal(block.hours, 'Until 19:00');
      assert.equal(block.floors.length, 1);
      assert.equal(block.floors[0].floor_number, 3);
      assert.equal(block.floors[0].spaces.length, 6);
      assert.equal(block.floors[0].spaces.reduce((sum, space) => sum + space.total_seats, 0), 240);
      assert.ok(block.floors[0].spaces.every((space) => space.hours === 'Until 19:00'));
      assert.ok(block.floors[0].spaces.every((space) => space.facilities.includes('pc_terminal')));
    }

    const seat = initial.data.floors[0].spaces[0].seats[0];
    const markOccupied = response();
    const deviceToken = 'test-device-token-123456';
    postRoute({ params: { seatId: seat.id }, body: { occupied: true, device_token: deviceToken } }, markOccupied);
    assert.equal(markOccupied.statusCode, 200);
    assert.equal(markOccupied.data.occupied, true);
    const expiryMinutes = get(
      "SELECT ROUND((julianday(expires_at) - julianday(updated_at)) * 24 * 60) AS minutes FROM seat_occupancy WHERE seat_id = ?",
      [seat.id]
    ).minutes;
    assert.equal(expiryMinutes, 90, 'A check-in lease lasts 90 minutes');

    const afterOccupying = response();
    getRoute({ get: () => deviceToken }, afterOccupying);
    const firstSpace = afterOccupying.data.floors[0].spaces[0];
    assert.equal(firstSpace.occupied_seats, 1);
    assert.equal(firstSpace.seats[0].occupied_by_me, 1);
    assert.equal(firstSpace.total_seats - firstSpace.occupied_seats, firstSpace.total_seats - 1);

    const conflict = response();
    postRoute({ params: { seatId: seat.id }, body: { occupied: false, device_token: 'different-device-token-123' } }, conflict);
    assert.equal(conflict.statusCode, 409, 'Only the device that marked a seat can check it out');

    const secondSeat = firstSpace.seats[1];
    const secondSeatConflict = response();
    postRoute({ params: { seatId: secondSeat.id }, body: { occupied: true, device_token: deviceToken } }, secondSeatConflict);
    assert.equal(secondSeatConflict.statusCode, 409, 'A device can have only one occupied seat at a time');

    dbRun("UPDATE seat_occupancy SET expires_at = datetime('now', '-1 minute') WHERE seat_id = ?", [seat.id]);
    const afterExpiry = response();
    getRoute({ get: () => deviceToken }, afterExpiry);
    assert.equal(afterExpiry.data.floors[0].spaces[0].occupied_seats, 0, 'Expired check-ins are cleared on the next read');
    assert.equal(get('SELECT occupied FROM seat_occupancy WHERE seat_id = ?', [seat.id]).occupied, 0);

    const lab = blocks[0].floors[0].spaces[0];
    const labSeat = lab.seats[0];
    dbRun("UPDATE spaces SET hours = 'Until 00:00' WHERE id = ?", [lab.id]);
    dbRun("INSERT INTO seat_occupancy (seat_id, occupied, device_token, expires_at) VALUES (?, 1, ?, datetime('now', '+1 hour'))", [labSeat.id, deviceToken]);
    const afterClosing = response();
    getLocationsRoute({ get: () => deviceToken }, afterClosing);
    const cleanedLab = afterClosing.data.buildings.find((building) => building.id === blocks[0].id).floors[0].spaces[0];
    assert.equal(cleanedLab.occupied_seats, 0, 'Seats are cleared when their space is past closing time');

    const markEmpty = response();
    postRoute({ params: { seatId: seat.id }, body: { occupied: false, device_token: deviceToken } }, markEmpty);
    assert.equal(markEmpty.statusCode, 200);

    const invalid = response();
    postRoute({ params: { seatId: seat.id }, body: { occupied: 'yes', device_token: deviceToken } }, invalid);
    assert.equal(invalid.statusCode, 400);

    const feedback = response();
    feedbackRoute({ body: { category: 'suggestion', message: 'Please add more charging seats.', seat_id: seat.id } }, feedback);
    assert.equal(feedback.statusCode, 201);
    assert.equal(get('SELECT category, seat_id FROM occupancy_feedback WHERE id = ?', [feedback.data.id]).category, 'suggestion');

    const invalidFeedback = response();
    feedbackRoute({ body: { category: 'other', message: 'Too short' } }, invalidFeedback);
    assert.equal(invalidFeedback.statusCode, 400);

    console.log('Occupancy tests passed: library floors, academic blocks, occupancy leases, one-seat rule, feedback storage, and validation.');
  } finally {
    const { db } = require('../server/db');
    db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      const file = `${process.env.SAFARI_DB_PATH}${suffix}`;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
