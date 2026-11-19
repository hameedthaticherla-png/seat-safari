const assert = require('node:assert');
const { run } = require('../server/db');

async function testConcurrency() {
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@demo.test', password: 'Student123!' })
  }).then(r => r.json());

  const token = loginRes.token;

  // Clean any previous test reservation for this slot
  run("DELETE FROM seat_reservations WHERE seat_id = 'seat_lib_A1' AND reservation_date = '2026-12-15'");

  // Attempt 5 simultaneous bookings for seat_lib_A1 on 2026-12-15 at 15:00-17:00
  const requests = Array.from({ length: 5 }, (_, i) => 
    fetch('http://localhost:3001/api/reservations/book', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        seat_id: 'seat_lib_A1',
        space_id: 'spc_lib_upper',
        date: '2026-12-15',
        start_time: '15:00',
        end_time: '17:00'
      })
    }).then(async r => ({ status: r.status, data: await r.json() }))
  );

  const results = await Promise.all(requests);
  const successes = results.filter(r => r.status === 201);
  const conflicts = results.filter(r => r.status === 409 || r.status === 400);

  console.log('Concurrent Results: Successes =', successes.length, ', Rejected =', conflicts.length);
  assert.strictEqual(successes.length, 1, 'Exactly one concurrent request should succeed');
  assert.strictEqual(conflicts.length, 4, 'Four concurrent requests should be safely rejected');
  console.log('✅ Concurrency test PASSED: Atomic transaction safely prevented double-booking under race conditions.');
}

testConcurrency().catch(err => {
  console.error('Concurrency test failed:', err);
  process.exit(1);
});
