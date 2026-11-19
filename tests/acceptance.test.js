// Seat Safari Automated Acceptance Test Suite
const assert = require('node:assert');
const { run } = require('../server/db');

const BASE_URL = 'http://localhost:3001/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('======================================================');
  console.log('   STARTING SEAT SAFARI ACCEPTANCE CRITERIA TESTS    ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // --- Auth Setup ---
  let studentToken = '';
  let staffToken = '';

  await test('Demo logins succeed and issue valid JWT tokens', async () => {
    // 1. Student Login
    const stu = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'student@demo.test', password: 'Student123!' })
    });
    assert.strictEqual(stu.status, 200);
    assert.strictEqual(stu.data.user.role, 'student');
    assert.ok(stu.data.token);
    studentToken = stu.data.token;

    // 2. Staff Login
    const staff = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'library@demo.test', password: 'Library123!' })
    });
    assert.strictEqual(staff.status, 200);
    assert.strictEqual(staff.data.user.role, 'staff');
    assert.ok(staff.data.token);
    staffToken = staff.data.token;
  });

  // Acceptance Check 1:
  // "A student can complete 'quiet seat with a socket at 1 pm' in under about a minute on a phone."
  await test('Check 1: Find ranks spaces for "quiet seat with a socket at 1 PM" correctly', async () => {
    const res = await request('/spaces?activity=Quiet&needs=power&time=13:00');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.spaces.length > 0);

    // Filtered spaces must have zone_type Quiet or Flexible
    const topSpace = res.data.spaces[0];
    assert.ok(topSpace.zone_type === 'Quiet' || topSpace.zone_type === 'Flexible');
    assert.ok(topSpace.facilities.includes('power'), 'Top space must have power socket');
    // Rank score should be high
    assert.ok(topSpace.rank_score > 0);
  });

  // Acceptance Check 2:
  // "A student cannot open staff routes, even by typing the URL."
  await test('Check 2: Server enforces 403 Forbidden for students on staff routes', async () => {
    // Guest accessing staff dashboard -> 401
    const guestRes = await request('/staff/dashboard');
    assert.strictEqual(guestRes.status, 401, 'Guest must receive 401');

    // Student accessing staff dashboard -> 403
    const stuRes = await request('/staff/dashboard', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(stuRes.status, 403, 'Student must receive 403 Forbidden');
    assert.strictEqual(stuRes.data.code, 'FORBIDDEN');
  });

  // Acceptance Check 3:
  // "Staff cannot see who submitted a report."
  await test('Check 3: Staff reports review strictly anonymizes student identities', async () => {
    const res = await request('/staff/reports', {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.reports));

    for (const report of res.data.reports) {
      assert.strictEqual(report.user_id, undefined, 'Report must not contain user_id');
      assert.strictEqual(report.email, undefined, 'Report must not contain student email');
      assert.strictEqual(report.display_name, undefined, 'Report must not contain student display_name');
    }
  });

  // Acceptance Check 4:
  // "An expired or missing report never shows as current."
  await test('Check 4: Expired or missing report never shows as current (Never guess)', async () => {
    // Spaces without fresh report (<30 min) must have latest_report = null
    const res = await request('/spaces');
    assert.strictEqual(res.status, 200);

    // Let's check spc_dept_study (which has no recent report)
    const deptStudy = res.data.spaces.find(s => s.id === 'spc_dept_study');
    assert.ok(deptStudy);
    assert.strictEqual(deptStudy.latest_report, null, 'Unreported space must have null latest_report');
    assert.ok(deptStudy.busy_at_time, 'Must fallback to usual busy times without guessing');
  });

  // Acceptance Check 5:
  // "A hold auto-releases if not checked in."
  await test('Check 5: Room hold auto-release policy and check-in window evaluation', async () => {
    // Request a hold on Room 214 as Arjun
    const arjunLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'arjun@demo.test', password: 'Arjun123!' })
    });

    // Clean up test holds for Arjun to ensure test idempotency against daily limits
    run("DELETE FROM holds WHERE user_id = 'usr_arjun_demo'");

    // Check if Arjun already has an active hold to release first
    const activeCheck = await request('/holds/my-active', {
      headers: { Authorization: `Bearer ${arjunLogin.data.token}` }
    });
    if (activeCheck.data.hold) {
      await request(`/holds/${activeCheck.data.hold.id}/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${arjunLogin.data.token}` }
      });
    }

    // Now request a hold
    const holdRes = await request('/spaces/spc_dept_proj_214/hold', {
      method: 'POST',
      headers: { Authorization: `Bearer ${arjunLogin.data.token}` },
      body: JSON.stringify({ durationMinutes: 60 })
    });
    assert.strictEqual(holdRes.status, 201);
    assert.strictEqual(holdRes.data.hold.status, 'active');
    const holdId = holdRes.data.hold.id;

    // Verify hold appears in active holds
    const myActive = await request('/holds/my-active', {
      headers: { Authorization: `Bearer ${arjunLogin.data.token}` }
    });
    assert.strictEqual(myActive.status, 200);
    assert.ok(myActive.data.hold);
    assert.strictEqual(myActive.data.hold.needs_checkin, true);

    // Perform check-in
    const checkinRes = await request(`/holds/${holdId}/check-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${arjunLogin.data.token}` }
    });
    assert.strictEqual(checkinRes.status, 200);
    assert.strictEqual(checkinRes.data.status, 'checked_in');

    // Clean up: Release the hold
    const releaseRes = await request(`/holds/${holdId}/release`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${arjunLogin.data.token}` }
    });
    assert.strictEqual(releaseRes.status, 200);
    assert.strictEqual(releaseRes.data.status, 'released');

    // Test Auto-release on simulated expired checkin:
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const simulatedHoldId = 'hold_sim_' + Date.now();
    run(
      "INSERT INTO holds (id, room_id, user_id, start_time, end_time, status) VALUES (?, 'spc_dept_proj_214', 'usr_arjun_demo', ?, datetime('now', '+2 hours'), 'active')",
      [simulatedHoldId, twentyMinsAgo]
    );
    // Requesting active holds evaluates hold status and auto-expires un-checked-in hold
    const checkExpired = await request('/holds/my-active', {
      headers: { Authorization: `Bearer ${arjunLogin.data.token}` }
    });
    assert.strictEqual(checkExpired.status, 200);
    assert.strictEqual(checkExpired.data.hold, null, 'Simulated hold past 15 min checkin window must be auto-released');
  });

  // Acceptance Check 6:
  // "Every space shows a 'last checked' date."
  await test('Check 6: Every space shows a last checked date and amber warning for >7 days', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    run("UPDATE spaces SET last_checked_at = ? WHERE id = 'spc_north_nook'", [tenDaysAgo]);

    const res = await request('/spaces');
    assert.strictEqual(res.status, 200);

    for (const space of res.data.spaces) {
      assert.ok(space.last_checked_at, `Space ${space.name} must have last_checked_at`);
      assert.ok(space.staleness, `Space ${space.name} must have staleness metadata`);
    }

    // Check North Annex specifically has is_stale === true
    const northNook = res.data.spaces.find(s => s.id === 'spc_north_nook');
    assert.ok(northNook, 'North Annex space must exist');
    assert.strictEqual(northNook.staleness.is_stale, true, 'North Annex must trigger amber staleness');
    assert.ok(northNook.staleness.days_ago >= 7, 'Days ago must be >= 7');
  });

  // Feature Check: Plan B Recommendations include quiet fallback for groups
  await test('Feature: Plan B recommendations include quiet fallback for group rooms', async () => {
    const res = await request('/spaces/spc_dept_proj_214/plan-b');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.plan_b_recommendations.length >= 2);

    const hasQuietFallback = res.data.plan_b_recommendations.some(s => s.isQuietFallbackForGroup === true);
    assert.strictEqual(hasQuietFallback, true, 'Plan B for a group room must include a quiet fallback');
  });

  // Feature Check: Rate limiting on reports (1 report per student per space per 15 mins)
  await test('Feature: Student reporting enforces 15-minute rate limit per space', async () => {
    // Reset any previous reports on test space to test rate limit deterministically
    run("DELETE FROM reports WHERE space_id = 'spc_union_common'");

    // Alex reports Free on spc_union_common
    const rep1 = await request('/reports/spc_union_common', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ status: 'Free' })
    });
    assert.strictEqual(rep1.status, 201);

    // Immediate second report on same space by same student must return 429
    const rep2 = await request('/reports/spc_union_common', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ status: 'Full' })
    });
    assert.strictEqual(rep2.status, 429, 'Immediate second report must be rate-limited (HTTP 429)');
  });

  // Feature Check: Staff can confirm space accuracy and update timestamp
  await test('Feature: Staff can confirm space accuracy (One-tap)', async () => {
    const res = await request('/staff/spaces/spc_north_nook/confirm', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert.strictEqual(res.status, 200);

    // Check that North Annex is no longer stale
    const spaceRes = await request('/spaces/spc_north_nook');
    assert.strictEqual(spaceRes.data.space.staleness.is_stale, false, 'Confirmed space must no longer be stale');
  });

  // Feature Check: Configurable settings
  await test('Feature: Staff can update configurable system settings', async () => {
    const res = await request('/staff/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        settings: {
          report_expiry_minutes: 30,
          hold_max_hours: 2,
          hold_checkin_window_minutes: 15
        }
      })
    });
    assert.strictEqual(res.status, 200);
  });

  // =========================================================================
  // BOOKMYSHOW SEAT RESERVATION SYSTEM ACCEPTANCE TESTS
  // =========================================================================

  await test('Seating 1: Hierarchy API returns campus, buildings, floors, and spaces', async () => {
    const res = await request('/reservations/hierarchy');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.buildings && res.data.buildings.length >= 4, 'Must return at least 4 buildings');
    
    const lib = res.data.buildings.find(b => b.code === 'LIB' || b.id === 'bld_library');
    assert.ok(lib, 'Central Library must exist in hierarchy');
    assert.ok(lib.floors && lib.floors.length > 0, 'Library must have floors');
    assert.ok(lib.floors[0].spaces && lib.floors[0].spaces.length > 0, 'Floor must have spaces');
  });

  await test('Seating 2: Space layout API returns tables, seats, and front orientation', async () => {
    const res = await request('/reservations/spaces/spc_lib_upper/layout');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.seats && res.data.seats.length > 0, 'Silent study must have seats');
    assert.ok(res.data.tables && res.data.tables.length > 0, 'Silent study must have tables');
    assert.ok(res.data.front_label, 'Must include front orientation indicator');
    assert.ok(['grid', 'table_grid', 'row_grid'].includes(res.data.layout_type));
  });

  await test('Seating 3: Availability API returns live seat statuses for specified date & slot', async () => {
    const res = await request('/reservations/spaces/spc_lib_upper/availability?date=2026-11-20&start_time=13:00&end_time=15:00');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.seats.length > 0);
    for (const seat of res.data.seats) {
      assert.ok(['available', 'held', 'booked', 'blocked'].includes(seat.status), `Seat status must be valid: ${seat.status}`);
    }
  });

  let heldReservationId = '';
  let testSeatId = '';

  await test('Seating 4: Temporary seat hold locks seat for student with 5-minute timeout', async () => {
    // Pick an available seat in Central Library Upper Floor
    const avail = await request('/reservations/spaces/spc_lib_upper/availability?date=2026-11-20&start_time=09:00&end_time=11:00', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const freeSeat = avail.data.seats.find(s => s.status === 'available');
    assert.ok(freeSeat, 'Must find at least one free seat for test');
    testSeatId = freeSeat.id;

    // Place temporary hold
    const holdRes = await request('/reservations/hold', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        seat_id: testSeatId,
        space_id: 'spc_lib_upper',
        date: '2026-11-20',
        start_time: '09:00',
        end_time: '11:00'
      })
    });

    assert.strictEqual(holdRes.status, 201);
    assert.strictEqual(holdRes.data.reservation.seat_id, testSeatId);
    assert.ok(holdRes.data.reservation.held_until);
    assert.ok(holdRes.data.reservation.expires_in_seconds > 0);
    heldReservationId = holdRes.data.reservation.id;

    // Check availability shows it as held
    const recheck = await request('/reservations/spaces/spc_lib_upper/availability?date=2026-11-20&start_time=09:00&end_time=11:00', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const updated = recheck.data.seats.find(s => s.id === testSeatId);
    assert.strictEqual(updated.status, 'held');
    assert.strictEqual(updated.held_by_me, true);
  });

  await test('Seating 5: Double booking / hold conflict prevention returns HTTP 409', async () => {
    // Second student or unauthenticated attempt to hold the same seat at the same time
    const conflictRes = await request('/reservations/hold', {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }, // different user
      body: JSON.stringify({
        seat_id: testSeatId,
        space_id: 'spc_lib_upper',
        date: '2026-11-20',
        start_time: '09:00',
        end_time: '11:00'
      })
    });

    assert.strictEqual(conflictRes.status, 409, 'Must prevent concurrent holds with 409 Conflict');
    assert.strictEqual(conflictRes.data.code, 'SEAT_CONFLICT');
  });

  let bookedReservation = null;

  await test('Seating 6: Confirm reservation generates SAFARI-XXXXXX reference & QR token', async () => {
    const bookRes = await request('/reservations/book', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        reservation_id: heldReservationId
      })
    });

    assert.strictEqual(bookRes.status, 201);
    bookedReservation = bookRes.data.reservation;
    assert.ok(bookedReservation.booking_reference.startsWith('SAFARI-'), 'Booking ref must start with SAFARI-');
    assert.ok(bookedReservation.qr_code_token, 'Must generate scannable QR token');
    assert.strictEqual(bookedReservation.status, 'confirmed');

    // Seat must now show booked in availability
    const avail = await request('/reservations/spaces/spc_lib_upper/availability?date=2026-11-20&start_time=09:00&end_time=11:00');
    const seatStatus = avail.data.seats.find(s => s.id === testSeatId);
    assert.strictEqual(seatStatus.status, 'booked');
  });

  await test('Seating 7: Student My Reservations returns active bookings with lifecycle', async () => {
    const res = await request('/reservations/my', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.reservations.length > 0);
    const mine = res.data.reservations.find(r => r.id === bookedReservation.id);
    assert.ok(mine, 'Newly booked reservation must appear in My Reservations');
    assert.strictEqual(mine.status, 'confirmed');
  });

  await test('Seating 8: QR ticket verification endpoint validates digital boarding pass', async () => {
    const res = await request(`/reservations/verify/${bookedReservation.qr_code_token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.valid, true);
    assert.strictEqual(res.data.reservation.id, bookedReservation.id);
  });

  await test('Seating 9: Physical check-in transitions reservation to checked_in', async () => {
    const res = await request(`/reservations/${bookedReservation.id}/check-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.reservation.status, 'checked_in');
    assert.ok(res.data.reservation.checked_in_at);
  });

  await test('Seating 10: Cancellation immediately releases seat back to available', async () => {
    const cancelRes = await request(`/reservations/${bookedReservation.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ reason: 'Schedule change' })
    });
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.data.cancelled, true);

    // Verify seat is now available again
    const avail = await request('/reservations/spaces/spc_lib_upper/availability?date=2026-11-20&start_time=09:00&end_time=11:00');
    const seatStatus = avail.data.seats.find(s => s.id === testSeatId);
    assert.strictEqual(seatStatus.status, 'available', 'Cancelled seat must immediately be available');
  });

  await test('Seating 11: Staff maintenance block prevents student reservation', async () => {
    // 1. Staff blocks the seat for maintenance
    const blockRes = await request(`/staff/seating/seats/${testSeatId}/toggle-block`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ block_reason: 'Desk leg repair' })
    });
    assert.strictEqual(blockRes.status, 200);
    assert.strictEqual(blockRes.data.seat.is_blocked, 1);

    // 2. Student attempts to hold the blocked seat -> 409
    const holdRes = await request('/reservations/hold', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        seat_id: testSeatId,
        space_id: 'spc_lib_upper',
        date: '2026-11-20',
        start_time: '09:00',
        end_time: '11:00'
      })
    });
    assert.strictEqual(holdRes.status, 409, 'Blocked seat cannot be held');

    // 3. Staff unblocks the seat
    const unblockRes = await request(`/staff/seating/seats/${testSeatId}/toggle-block`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    assert.strictEqual(unblockRes.status, 200);
    assert.strictEqual(unblockRes.data.seat.is_blocked, 0);
  });

  console.log('\n======================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
