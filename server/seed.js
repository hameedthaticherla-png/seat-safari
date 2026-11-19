const bcrypt = require('bcryptjs');
const { run, query, get, logAudit, setSetting } = require('./db');
const { DEFAULT_SETTINGS } = require('./config');

async function seed() {
  console.log('--- Starting Seat Safari Seed Process ---');

  // 1. Seed Configurable Settings
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = get('SELECT key FROM settings WHERE key = ?', [key]);
    if (!existing) {
      let desc = '';
      if (key === 'report_expiry_minutes') desc = 'Minutes before a student availability report expires (default 30m)';
      else if (key === 'report_rate_limit_minutes') desc = 'Minutes between report submissions per student per space (default 15m)';
      else if (key === 'hold_max_hours') desc = 'Maximum duration for a group room hold (default 2h)';
      else if (key === 'hold_checkin_window_minutes') desc = 'Minutes to check-in before auto-release (default 15m)';
      else if (key === 'hold_daily_limit') desc = 'Maximum number of room holds per student per day';
      else if (key === 'staleness_threshold_days') desc = 'Days before space last_checked triggers amber warning (default 7d)';
      else if (key === 'hold_retention_days') desc = 'Days before expired hold logs are purged (default 30d)';

      run('INSERT INTO settings (key, value, description) VALUES (?, ?, ?)', [key, value, desc]);
    }
  }

  // Seed seat reservation specific settings
  const seatHoldSetting = get('SELECT key FROM settings WHERE key = ?', ['seat_hold_minutes']);
  if (!seatHoldSetting) {
    run('INSERT INTO settings (key, value, description) VALUES (?, ?, ?)', [
      'seat_hold_minutes',
      '5',
      'Minutes to temporarily hold a selected seat before purchase/checkout timeout'
    ]);
  }
  const seatCheckinSetting = get('SELECT key FROM settings WHERE key = ?', ['seat_checkin_window_minutes']);
  if (!seatCheckinSetting) {
    run('INSERT INTO settings (key, value, description) VALUES (?, ?, ?)', [
      'seat_checkin_window_minutes',
      '15',
      'Minutes window after reservation start time before marking no-show and auto-releasing'
    ]);
  }

  // 2. Seed Users
  const salt = await bcrypt.genSalt(10);
  const studentPw = await bcrypt.hash('Student123!', salt);
  const libraryPw = await bcrypt.hash('Library123!', salt);
  const nehaPw = await bcrypt.hash('Neha123!', salt);
  const arjunPw = await bcrypt.hash('Arjun123!', salt);

  const demoUsers = [
    {
      id: 'usr_student_demo',
      email: 'student@demo.test',
      password_hash: studentPw,
      role: 'student',
      display_name: 'Alex Student (Demo)',
      staff_scope: null
    },
    {
      id: 'usr_library_demo',
      email: 'library@demo.test',
      password_hash: libraryPw,
      role: 'staff',
      display_name: 'Sarah Librarian (Demo)',
      staff_scope: 'library'
    },
    {
      id: 'usr_neha_demo',
      email: 'neha@demo.test',
      password_hash: nehaPw,
      role: 'student',
      display_name: 'Neha Patel (Solo Hunter)',
      staff_scope: null
    },
    {
      id: 'usr_arjun_demo',
      email: 'arjun@demo.test',
      password_hash: arjunPw,
      role: 'student',
      display_name: 'Arjun Sharma (Group Lead)',
      staff_scope: null
    }
  ];

  for (const u of demoUsers) {
    const exists = get('SELECT id FROM users WHERE email = ?', [u.email]);
    if (!exists) {
      run(
        'INSERT INTO users (id, email, password_hash, role, display_name, staff_scope) VALUES (?, ?, ?, ?, ?, ?)',
        [u.id, u.email, u.password_hash, u.role, u.display_name, u.staff_scope]
      );
      console.log(`Seeded user: ${u.email} (${u.role})`);
    }
  }

  // 3. Seed Buildings & Floors (Location Hierarchy)
  const buildings = [
    {
      id: 'bld_library',
      name: 'Central Library',
      code: 'LIB',
      campus: 'Main Campus',
      description: 'Primary academic research library, 24/7 exam access, and digital commons.',
      hours: '08:00 - 22:00',
      sort_order: 1
    },
    {
      id: 'bld_engineering',
      name: 'Engineering Hall',
      code: 'ENG',
      campus: 'Engineering Quad',
      description: 'Departmental laboratories, active project team rooms, and open study atrium.',
      hours: '07:30 - 21:00',
      sort_order: 2
    },
    {
      id: 'bld_science',
      name: 'Science Complex',
      code: 'SCI',
      campus: 'North Campus',
      description: 'Lecture theaters, tutorial seminar rooms, and open laboratory halls.',
      hours: '08:00 - 19:00',
      sort_order: 3
    },
    {
      id: 'bld_union',
      name: 'Student Union Building',
      code: 'UNN',
      campus: 'Central Campus',
      description: 'Student commons, cafeteria tables, informal collaboration, and lounge seating.',
      hours: '08:00 - 23:00',
      sort_order: 4
    },
    {
      id: 'bld_north',
      name: 'North Campus Annex',
      code: 'NOA',
      campus: 'North Campus',
      description: 'Quiet detached study alcove with natural lighting.',
      hours: '08:30 - 18:00',
      sort_order: 5
    }
  ];

  const academicBlocks = ['26', '27', '28', '29', '33', '34'];
  for (const [index, block] of academicBlocks.entries()) {
    buildings.push({
      id: `bld_academic_${block}`,
      name: `Academic Block ${block}`,
      code: `AB${block}`,
      campus: 'Academic Blocks',
      description: 'Six computer labs on the third floor.',
      hours: 'Until 19:00',
      sort_order: 10 + index,
    });
  }

  for (const b of buildings) {
    const exists = get('SELECT id FROM buildings WHERE id = ?', [b.id]);
    if (!exists) {
      run(
        'INSERT INTO buildings (id, name, code, campus, description, hours, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [b.id, b.name, b.code, b.campus, b.description, b.hours, b.sort_order]
      );
      console.log(`Seeded building: ${b.name}`);
    }
  }

  const floors = [
    {
      id: 'flr_lib_l1',
      building_id: 'bld_library',
      floor_number: 1,
      name: '1st Floor · Basement',
      description: 'Open discussion and collaborative study area; not enclosed.',
      sort_order: 1
    },
    {
      id: 'flr_lib_l2',
      building_id: 'bld_library',
      floor_number: 2,
      name: '2nd Floor',
      description: 'Charging tables and a separate quiet reading area.',
      sort_order: 2
    },
    {
      id: 'flr_lib_l3',
      building_id: 'bld_library',
      floor_number: 3,
      name: '3rd Floor',
      description: 'Computer labs for students who need a library computer.',
      sort_order: 3
    },
    {
      id: 'flr_lib_l4',
      building_id: 'bld_library',
      floor_number: 4,
      name: '4th Floor',
      description: 'Study Areas A and B, plus four discussion rooms.',
      sort_order: 4
    },
    {
      id: 'flr_lib_l5',
      building_id: 'bld_library',
      floor_number: 5,
      name: '5th Floor',
      description: 'Study Areas A and B, plus four discussion rooms.',
      sort_order: 5
    },
    {
      id: 'flr_eng_l2',
      building_id: 'bld_engineering',
      floor_number: 2,
      name: 'Floor 2 (Mezzanine & Rooms)',
      description: 'Engineering study atrium and enclosed project team rooms',
      sort_order: 2
    },
    {
      id: 'flr_sci_l2',
      building_id: 'bld_science',
      floor_number: 2,
      name: 'Floor 2 (West Wing)',
      description: 'Classrooms open between scheduled lecture sessions',
      sort_order: 2
    },
    {
      id: 'flr_union_l1',
      building_id: 'bld_union',
      floor_number: 1,
      name: 'Level 1 (Central Hub)',
      description: 'Open communal lounge and campus dining tables',
      sort_order: 1
    },
    {
      id: 'flr_north_g',
      building_id: 'bld_north',
      floor_number: 0,
      name: 'Ground Floor',
      description: 'Reading alcove and peaceful corner',
      sort_order: 0
    },
    ...academicBlocks.map((block, index) => ({
      id: `flr_academic_${block}_l3`,
      building_id: `bld_academic_${block}`,
      floor_number: 3,
      name: '3rd Floor',
      description: 'Six computer labs · available until 7:00 PM.',
      sort_order: 3 + index,
    }))
  ];

  for (const f of floors) {
    const exists = get('SELECT id FROM floors WHERE id = ?', [f.id]);
    if (!exists) {
      run(
        'INSERT INTO floors (id, building_id, floor_number, name, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [f.id, f.building_id, f.floor_number, f.name, f.description, f.sort_order]
      );
      console.log(`Seeded floor: ${f.name}`);
    }
    if (f.building_id === 'bld_library') {
      run('UPDATE floors SET floor_number = ?, name = ?, description = ?, sort_order = ? WHERE id = ?',
        [f.floor_number, f.name, f.description, f.sort_order, f.id]);
    }
  }

  // Central Library's occupancy-only zones. Seat counts/layouts are intentionally
  // left unseeded until the library supplies real capacities.
  const libraryAreas = [
    ['cl_basement_open', 'Open Discussion Area', 'flr_lib_l1', ['wifi', 'desk_chair', 'discussion']],
    ['cl_f2_charging', 'Charging Tables', 'flr_lib_l2', ['power', 'wifi', 'desk_chair']],
    ['cl_f2_reading', 'Reading Area', 'flr_lib_l2', ['wifi', 'desk_chair']],
    ['cl_f3_computer', 'Computer Labs', 'flr_lib_l3', ['wifi', 'pc_terminal']],
  ];
  for (const floorId of ['flr_lib_l4', 'flr_lib_l5']) {
    const floorNo = floorId.endsWith('l4') ? 4 : 5;
    libraryAreas.push(
      [`cl_f${floorNo}_area_a`, 'Study Area A', floorId, ['power', 'wifi', 'fan', 'ac', 'desk_chair']],
      [`cl_f${floorNo}_area_b`, 'Study Area B', floorId, ['power', 'wifi', 'fan', 'ac', 'desk_chair']],
      [`cl_f${floorNo}_room_1`, 'Discussion Room 1 · 5 seats', floorId, ['power', 'wifi', 'fan', 'ac']],
      [`cl_f${floorNo}_room_2`, 'Discussion Room 2 · 5 seats', floorId, ['power', 'wifi', 'fan', 'ac']],
      [`cl_f${floorNo}_room_3`, 'Discussion Room 3 · 5 seats', floorId, ['power', 'wifi', 'fan', 'ac']],
      [`cl_f${floorNo}_room_4`, 'Discussion Room 4 · 10 seats', floorId, ['power', 'wifi', 'fan', 'ac']]
    );
  }
  for (const [id, name, floorId, facilities] of libraryAreas) {
    const location = `Central Library, ${floorId}`;
    const facilityJson = JSON.stringify(facilities);
    const existing = get('SELECT id FROM spaces WHERE id = ?', [id]);
    if (!existing) {
      run(
        `INSERT INTO spaces (id, name, location, zone_type, zone_rule, facilities, hours,
          only_if_no_class, hold_enabled, last_checked_at, owner_scope, description,
          capacity_hint, map_zone, building_id, floor_id, layout_type, is_occupancy_tracked)
         VALUES (?, ?, ?, 'Flexible', 'Occupancy tracking only', ?, '08:00 - 22:00',
          0, 0, datetime('now'), 'library', ?, NULL, ?, 'bld_library', ?, 'grid', 1)`,
        [id, name, location, facilityJson, name, name, floorId]
      );
    } else {
      run(
        `UPDATE spaces SET name = ?, location = ?, facilities = ?, building_id = 'bld_library',
          floor_id = ?, is_occupancy_tracked = 1, description = ? WHERE id = ?`,
        [name, location, facilityJson, floorId, name, id]
      );
    }
  }

  const academicLabs = [];
  for (const block of academicBlocks) {
    for (let labNumber = 1; labNumber <= 6; labNumber++) {
      academicLabs.push({
        id: `acad_${block}_lab_${labNumber}`,
        name: `Computer Lab ${labNumber}`,
        buildingId: `bld_academic_${block}`,
        floorId: `flr_academic_${block}_l3`,
        location: `Academic Block ${block}, 3rd Floor`,
      });
    }
  }
  for (const lab of academicLabs) {
    const facilityJson = JSON.stringify(['wifi', 'pc_terminal']);
    const existing = get('SELECT id FROM spaces WHERE id = ?', [lab.id]);
    if (!existing) {
      run(
        `INSERT INTO spaces (id, name, location, zone_type, zone_rule, facilities, hours,
          only_if_no_class, hold_enabled, last_checked_at, owner_scope, description,
          capacity_hint, map_zone, building_id, floor_id, layout_type, is_occupancy_tracked)
         VALUES (?, ?, ?, 'Flexible', 'Occupancy tracking only', ?, 'Until 19:00',
          0, 0, datetime('now'), 'academic', 'Computer laboratory seating', '40 seats',
          ?, ?, ?, 'grid', 1)`,
        [lab.id, lab.name, lab.location, facilityJson, lab.location, lab.buildingId, lab.floorId]
      );
    } else {
      run(
        `UPDATE spaces SET name = ?, location = ?, facilities = ?, hours = 'Until 19:00',
          building_id = ?, floor_id = ?, is_occupancy_tracked = 1,
          description = 'Computer laboratory seating', capacity_hint = '40 seats' WHERE id = ?`,
        [lab.name, lab.location, facilityJson, lab.buildingId, lab.floorId, lab.id]
      );
    }
  }

  // Provision the stated 100 seats per floor. Distribution within spaces is an
  // editable starting layout: 50/50 on floor 2; rooms use their stated capacities
  // on floors 4/5 and the remaining 75 seats split 37/38 between Areas A and B.
  const occupancyCounts = {
    cl_basement_open: 100,
    cl_f2_charging: 50,
    cl_f2_reading: 50,
    cl_f3_computer: 100,
    cl_f4_area_a: 37,
    cl_f4_area_b: 38,
    cl_f4_room_1: 5,
    cl_f4_room_2: 5,
    cl_f4_room_3: 5,
    cl_f4_room_4: 10,
    cl_f5_area_a: 37,
    cl_f5_area_b: 38,
    cl_f5_room_1: 5,
    cl_f5_room_2: 5,
    cl_f5_room_3: 5,
    cl_f5_room_4: 10,
  };
  for (const lab of academicLabs) occupancyCounts[lab.id] = 40;
  for (const [spaceId, count] of Object.entries(occupancyCounts)) {
    const space = get('SELECT facilities FROM spaces WHERE id = ?', [spaceId]);
    let facilities = [];
    try { facilities = JSON.parse(space?.facilities || '[]'); } catch { facilities = []; }
    const seatType = facilities.includes('pc_terminal') ? 'computer'
      : (spaceId.includes('charging') || spaceId.includes('area_') ? 'socket' : 'standard');
    for (let n = 1; n <= count; n++) {
      const seatId = `seat_${spaceId}_${String(n).padStart(3, '0')}`;
      const existingSeat = get('SELECT id FROM seats WHERE id = ?', [seatId]);
      if (!existingSeat) {
        const row = Math.ceil(n / 10);
        const col = ((n - 1) % 10) + 1;
        run(
          `INSERT INTO seats (id, space_id, seat_number, row_label, col_index, seat_type,
            facilities, is_blocked, grid_x, grid_y)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [seatId, spaceId, String(n).padStart(3, '0'), `Row ${row}`, col, seatType,
            JSON.stringify(facilities), col, row]
        );
      }
    }
  }

  // 4. Seed Spaces
  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const currentIso = now.toISOString();

  const sampleSpaces = [
    {
      id: 'spc_lib_upper',
      name: 'Library Upper Floor',
      location: 'Central Library, Level 3',
      zone_type: 'Quiet',
      zone_rule: 'Quiet: no talking nearby. Whispers only if essential, silent headphones.',
      facilities: JSON.stringify(['power', 'wifi', 'desk_chair']),
      hours: '08:00 - 22:00',
      only_if_no_class: 0,
      hold_enabled: 0,
      last_checked_at: currentIso,
      owner_scope: 'library',
      description: 'Expansive individual carrels with dedicated power sockets and natural daylight. Ideal for solo exam study and reading.',
      capacity_hint: 'Spacious floor with ~80 individual study carrels',
      map_zone: 'Library Level 3',
      building_id: 'bld_library',
      floor_id: 'flr_lib_l3',
      layout_type: 'grid'
    },
    {
      id: 'spc_lib_group',
      name: 'Library Group Zone',
      location: 'Central Library, Level 1 East Wing',
      zone_type: 'Discussion',
      zone_rule: 'Discussion: collaborative group talk and discussion welcome.',
      facilities: JSON.stringify(['power', 'wifi', 'board', 'desk_chair']),
      hours: '08:00 - 22:00',
      only_if_no_class: 0,
      hold_enabled: 0,
      last_checked_at: currentIso,
      owner_scope: 'library',
      description: 'Modular pod tables with rolling whiteboards and power strips. Great for collaborative assignments.',
      capacity_hint: '12 open collaborative group tables (4-6 seats each)',
      map_zone: 'Library Level 1',
      building_id: 'bld_library',
      floor_id: 'flr_lib_l1',
      layout_type: 'tables'
    },
    {
      id: 'spc_dept_study',
      name: 'Department Study Area',
      location: 'Engineering Building, 2nd Floor Mezzanine',
      zone_type: 'Quiet',
      zone_rule: 'Quiet: no talking nearby. Respect intense engineering problem sets.',
      facilities: JSON.stringify(['power', 'wifi', 'desk_chair']),
      hours: '07:30 - 20:00',
      only_if_no_class: 0,
      hold_enabled: 0,
      last_checked_at: twoDaysAgo,
      owner_scope: 'engineering',
      description: 'High-density desk bank overlooking the engineering atrium with reliable AC outlets at every seat.',
      capacity_hint: 'Medium space with ~30 desk spaces',
      map_zone: 'Engineering Level 2',
      building_id: 'bld_engineering',
      floor_id: 'flr_eng_l2',
      layout_type: 'grid'
    },
    {
      id: 'spc_dept_proj_214',
      name: 'Department Project Room (Room 214)',
      location: 'Engineering Building, Room 214',
      zone_type: 'Discussion',
      zone_rule: 'Discussion: team project room with dual wall whiteboards and presentation screen.',
      facilities: JSON.stringify(['power', 'wifi', 'board', 'desk_chair']),
      hours: '08:00 - 21:00',
      only_if_no_class: 0,
      hold_enabled: 1, // OPTED-IN FOR HOLDS!
      last_checked_at: currentIso,
      owner_scope: 'engineering',
      description: 'Enclosed team collaboration room. Opted-in for whole-room reservations and student group holds.',
      capacity_hint: 'Enclosed room for 6-8 students',
      map_zone: 'Engineering Level 2',
      building_id: 'bld_engineering',
      floor_id: 'flr_eng_l2',
      layout_type: 'group_room'
    },
    {
      id: 'spc_union_common',
      name: 'Student Union Common Area',
      location: 'Student Union Building, Ground Floor Central',
      zone_type: 'Flexible',
      zone_rule: 'Flexible: casual conversations, informal study, movable armchairs and tables.',
      facilities: JSON.stringify(['power', 'wifi', 'desk_chair']),
      hours: '08:00 - 23:00',
      only_if_no_class: 0,
      hold_enabled: 0,
      last_checked_at: twoDaysAgo,
      owner_scope: 'union',
      description: 'Lively campus nexus with coffee shop nearby. Good for multitasking, light reading, and casual catch-ups.',
      capacity_hint: 'Large open lounge with mixed seating',
      map_zone: 'Union Ground',
      building_id: 'bld_union',
      floor_id: 'flr_union_l1',
      layout_type: 'tables'
    },
    {
      id: 'spc_cafeteria_annex',
      name: 'Campus Cafeteria Tables',
      location: 'Campus Hub, Dining Hall South Annex',
      zone_type: 'Discussion',
      zone_rule: 'Discussion: open social dining & work tables. Background chatter expected.',
      facilities: JSON.stringify(['wifi', 'desk_chair']), // Note: No power outlets
      hours: '09:00 - 18:00',
      only_if_no_class: 0,
      hold_enabled: 0,
      last_checked_at: currentIso,
      owner_scope: 'catering',
      description: 'Long wooden communal tables. Ample Wi-Fi coverage; note that electrical sockets are scarce.',
      capacity_hint: 'High turnover dining/study tables',
      map_zone: 'Campus Hub',
      building_id: 'bld_union',
      floor_id: 'flr_union_l1',
      layout_type: 'tables'
    },
    {
      id: 'spc_sci_classroom_204',
      name: 'Science Hall 204 (Empty Classroom)',
      location: 'Science Hall, 2nd Floor West Wing',
      zone_type: 'Flexible',
      zone_rule: 'Flexible: open for independent study only when no scheduled lecture is in session.',
      facilities: JSON.stringify(['power', 'wifi', 'board', 'desk_chair']),
      hours: '08:00 - 19:00',
      only_if_no_class: 1, // Only if no class!
      hold_enabled: 0,
      last_checked_at: currentIso,
      owner_scope: 'science',
      description: 'Tiered seminar room with chalkboard and front projector. Usable between class slots.',
      capacity_hint: 'Tiered classroom (~40 seats)',
      map_zone: 'Science Hall Level 2',
      building_id: 'bld_science',
      floor_id: 'flr_sci_l2',
      layout_type: 'grid'
    },
    {
      id: 'spc_north_nook',
      name: 'North Annex Quiet Reading Nook',
      location: 'North Annex, Room 102',
      zone_type: 'Quiet',
      zone_rule: 'Quiet: no talking nearby. Silent study and deep reading only.',
      facilities: JSON.stringify(['wifi', 'desk_chair']),
      hours: '08:30 - 18:00',
      only_if_no_class: 0,
      hold_enabled: 0,
      last_checked_at: tenDaysAgo, // >7 days ago! Amber staleness test case
      owner_scope: 'library',
      description: 'Hidden quiet alcove away from foot traffic. Compact and peaceful with natural lighting.',
      capacity_hint: 'Small intimate alcove with 12 armchairs',
      map_zone: 'North Annex',
      building_id: 'bld_north',
      floor_id: 'flr_north_g',
      layout_type: 'grid'
    }
  ];

  for (const s of sampleSpaces) {
    const existing = get('SELECT id FROM spaces WHERE id = ?', [s.id]);
    if (!existing) {
      run(
        `INSERT INTO spaces (
          id, name, location, zone_type, zone_rule, facilities, hours, 
          only_if_no_class, hold_enabled, last_checked_at, owner_scope, 
          description, capacity_hint, map_zone, building_id, floor_id, layout_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, s.name, s.location, s.zone_type, s.zone_rule, s.facilities, s.hours,
          s.only_if_no_class, s.hold_enabled, s.last_checked_at, s.owner_scope,
          s.description, s.capacity_hint, s.map_zone, s.building_id, s.floor_id, s.layout_type
        ]
      );
      console.log(`Seeded space: ${s.name} (${s.zone_type})`);
    } else {
      // Update building_id, floor_id, and layout_type if null
      run(
        'UPDATE spaces SET building_id = ?, floor_id = ?, layout_type = ? WHERE id = ?',
        [s.building_id, s.floor_id, s.layout_type, s.id]
      );
    }
  }

  // 5. Seed Space Tables & Seats (BookMyShow visual seating arrangement)
  // --- A. Library Upper Floor (spc_lib_upper) ---
  const upperTables = [
    { id: 'tbl_lib_t01', space_id: 'spc_lib_upper', table_number: 'T01', label: 'Carrel Cluster T01', shape: 'rectangle', capacity: 4, x: 1, y: 1 },
    { id: 'tbl_lib_t02', space_id: 'spc_lib_upper', table_number: 'T02', label: 'Carrel Cluster T02', shape: 'rectangle', capacity: 4, x: 5, y: 1 },
    { id: 'tbl_lib_t03', space_id: 'spc_lib_upper', table_number: 'T03', label: 'Carrel Cluster T03', shape: 'rectangle', capacity: 4, x: 1, y: 3 },
    { id: 'tbl_lib_t04', space_id: 'spc_lib_upper', table_number: 'T04', label: 'Carrel Cluster T04', shape: 'rectangle', capacity: 4, x: 5, y: 3 },
  ];

  for (const t of upperTables) {
    const exists = get('SELECT id FROM space_tables WHERE id = ?', [t.id]);
    if (!exists) {
      run(
        'INSERT INTO space_tables (id, space_id, table_number, label, shape, capacity, x, y) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [t.id, t.space_id, t.table_number, t.label, t.shape, t.capacity, t.x, t.y]
      );
    }
  }

  // Seats for Library Upper Floor
  const upperSeats = [
    // Table T01 (Seats A1-A4)
    { id: 'seat_lib_A1', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t01', seat_number: 'A1', row_label: 'Row A', col_index: 1, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 1, grid_y: 1 },
    { id: 'seat_lib_A2', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t01', seat_number: 'A2', row_label: 'Row A', col_index: 2, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 2, grid_y: 1 },
    { id: 'seat_lib_A3', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t01', seat_number: 'A3', row_label: 'Row A', col_index: 3, seat_type: 'standard', facilities: '["wifi","desk_chair"]', is_blocked: 0, grid_x: 1, grid_y: 2 },
    { id: 'seat_lib_A4', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t01', seat_number: 'A4', row_label: 'Row A', col_index: 4, seat_type: 'standard', facilities: '["wifi","desk_chair"]', is_blocked: 0, grid_x: 2, grid_y: 2 },

    // Table T02 (Seats B1-B4)
    { id: 'seat_lib_B1', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t02', seat_number: 'B1', row_label: 'Row B', col_index: 1, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 4, grid_y: 1 },
    { id: 'seat_lib_B2', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t02', seat_number: 'B2', row_label: 'Row B', col_index: 2, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 5, grid_y: 1 },
    { id: 'seat_lib_B3', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t02', seat_number: 'B3', row_label: 'Row B', col_index: 3, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 4, grid_y: 2 },
    { id: 'seat_lib_B4', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t02', seat_number: 'B4', row_label: 'Row B', col_index: 4, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 5, grid_y: 2 },

    // Table T03 (Seats C1-C4)
    { id: 'seat_lib_C1', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t03', seat_number: 'C1', row_label: 'Row C', col_index: 1, seat_type: 'standard', facilities: '["wifi","desk_chair"]', is_blocked: 0, grid_x: 1, grid_y: 4 },
    { id: 'seat_lib_C2', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t03', seat_number: 'C2', row_label: 'Row C', col_index: 2, seat_type: 'standard', facilities: '["wifi","desk_chair"]', is_blocked: 0, grid_x: 2, grid_y: 4 },
    { id: 'seat_lib_C3', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t03', seat_number: 'C3', row_label: 'Row C', col_index: 3, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 1, grid_y: 5 },
    { id: 'seat_lib_C4', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t03', seat_number: 'C4', row_label: 'Row C', col_index: 4, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 2, grid_y: 5 },

    // Table T04 (Seats D1-D4)
    { id: 'seat_lib_D1', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t04', seat_number: 'D1', row_label: 'Row D', col_index: 1, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 4, grid_y: 4 },
    { id: 'seat_lib_D2', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t04', seat_number: 'D2', row_label: 'Row D', col_index: 2, seat_type: 'socket', facilities: '["power","wifi","desk_chair"]', is_blocked: 0, grid_x: 5, grid_y: 4 },
    { id: 'seat_lib_D3', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t04', seat_number: 'D3', row_label: 'Row D', col_index: 3, seat_type: 'standard', facilities: '["wifi","desk_chair"]', is_blocked: 0, grid_x: 4, grid_y: 5 },
    { id: 'seat_lib_D4', space_id: 'spc_lib_upper', table_id: 'tbl_lib_t04', seat_number: 'D4', row_label: 'Row D', col_index: 4, seat_type: 'standard', facilities: '["wifi","desk_chair"]', is_blocked: 0, grid_x: 5, grid_y: 5 },

    // Window View Row (Standalone desks along outer glass wall)
    { id: 'seat_lib_W1', space_id: 'spc_lib_upper', table_id: null, seat_number: 'W1', row_label: 'Window Row', col_index: 1, seat_type: 'window', facilities: '["power","wifi","window_view","desk_chair"]', is_blocked: 0, grid_x: 7, grid_y: 1 },
    { id: 'seat_lib_W2', space_id: 'spc_lib_upper', table_id: null, seat_number: 'W2', row_label: 'Window Row', col_index: 2, seat_type: 'window', facilities: '["power","wifi","window_view","desk_chair"]', is_blocked: 0, grid_x: 7, grid_y: 2 },
    { id: 'seat_lib_W3', space_id: 'spc_lib_upper', table_id: null, seat_number: 'W3', row_label: 'Window Row', col_index: 3, seat_type: 'window', facilities: '["power","wifi","window_view","desk_chair"]', is_blocked: 0, grid_x: 7, grid_y: 4 },
    { id: 'seat_lib_W4', space_id: 'spc_lib_upper', table_id: null, seat_number: 'W4', row_label: 'Window Row', col_index: 4, seat_type: 'window', facilities: '["power","wifi","window_view","desk_chair"]', is_blocked: 0, grid_x: 7, grid_y: 5 },

    // Ergonomic & Computer Terminals
    { id: 'seat_lib_E1', space_id: 'spc_lib_upper', table_id: null, seat_number: 'E1', row_label: 'Ergonomic Pod', col_index: 1, seat_type: 'ergonomic', facilities: '["power","wifi","ergonomic","desk_chair"]', is_blocked: 0, grid_x: 1, grid_y: 7 },
    { id: 'seat_lib_E2', space_id: 'spc_lib_upper', table_id: null, seat_number: 'E2', row_label: 'Ergonomic Pod', col_index: 2, seat_type: 'ergonomic', facilities: '["power","wifi","ergonomic","desk_chair"]', is_blocked: 0, grid_x: 2, grid_y: 7 },
    { id: 'seat_lib_E3', space_id: 'spc_lib_upper', table_id: null, seat_number: 'E3', row_label: 'Computer Station', col_index: 3, seat_type: 'computer', facilities: '["power","wifi","pc_terminal","desk_chair"]', is_blocked: 0, grid_x: 4, grid_y: 7 },
    { id: 'seat_lib_E4', space_id: 'spc_lib_upper', table_id: null, seat_number: 'E4', row_label: 'Computer Station', col_index: 4, seat_type: 'computer', facilities: '["power","wifi","pc_terminal","desk_chair"]', is_blocked: 1, block_reason: 'Power adapter under maintenance', grid_x: 5, grid_y: 7 }
  ];

  for (const s of upperSeats) {
    const exists = get('SELECT id FROM seats WHERE id = ?', [s.id]);
    if (!exists) {
      run(
        `INSERT INTO seats (
          id, space_id, table_id, seat_number, row_label, col_index, seat_type, 
          facilities, is_blocked, block_reason, grid_x, grid_y
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, s.space_id, s.table_id, s.seat_number, s.row_label, s.col_index, s.seat_type,
          s.facilities, s.is_blocked, s.block_reason || null, s.grid_x, s.grid_y
        ]
      );
    }
  }

  // --- B. Project Room 214 (spc_dept_proj_214 - Group Room Whole Reservation) ---
  const projTable = { id: 'tbl_eng_214', space_id: 'spc_dept_proj_214', table_number: 'T214', label: 'Team Conference Table', shape: 'rectangle', capacity: 8, x: 2, y: 2 };
  const existsTable214 = get('SELECT id FROM space_tables WHERE id = ?', [projTable.id]);
  if (!existsTable214) {
    run(
      'INSERT INTO space_tables (id, space_id, table_number, label, shape, capacity, x, y) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [projTable.id, projTable.space_id, projTable.table_number, projTable.label, projTable.shape, projTable.capacity, projTable.x, projTable.y]
    );
  }

  const projRoomSeat = {
    id: 'seat_eng_p214_whole',
    space_id: 'spc_dept_proj_214',
    table_id: 'tbl_eng_214',
    seat_number: 'ROOM-214',
    row_label: 'Whole Room',
    col_index: 1,
    seat_type: 'group_room',
    facilities: '["power","wifi","board","desk_chair","display_screen"]',
    is_blocked: 0,
    grid_x: 2,
    grid_y: 2
  };
  const existsProjSeat = get('SELECT id FROM seats WHERE id = ?', [projRoomSeat.id]);
  if (!existsProjSeat) {
    run(
      `INSERT INTO seats (
        id, space_id, table_id, seat_number, row_label, col_index, seat_type, 
        facilities, is_blocked, grid_x, grid_y
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projRoomSeat.id, projRoomSeat.space_id, projRoomSeat.table_id, projRoomSeat.seat_number,
        projRoomSeat.row_label, projRoomSeat.col_index, projRoomSeat.seat_type,
        projRoomSeat.facilities, projRoomSeat.is_blocked, projRoomSeat.grid_x, projRoomSeat.grid_y
      ]
    );
  }

  // --- C. Library Group Zone (spc_lib_group - Discussion Pods) ---
  const groupTables = [
    { id: 'tbl_lib_g01', space_id: 'spc_lib_group', table_number: 'G01', label: 'Whiteboard Pod 1', shape: 'round', capacity: 4, x: 1, y: 1 },
    { id: 'tbl_lib_g02', space_id: 'spc_lib_group', table_number: 'G02', label: 'Whiteboard Pod 2', shape: 'round', capacity: 4, x: 4, y: 1 },
    { id: 'tbl_lib_g03', space_id: 'spc_lib_group', table_number: 'G03', label: 'Open Discussion Table', shape: 'rectangle', capacity: 6, x: 1, y: 4 },
  ];
  for (const t of groupTables) {
    const exists = get('SELECT id FROM space_tables WHERE id = ?', [t.id]);
    if (!exists) {
      run(
        'INSERT INTO space_tables (id, space_id, table_number, label, shape, capacity, x, y) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [t.id, t.space_id, t.table_number, t.label, t.shape, t.capacity, t.x, t.y]
      );
    }
  }

  const groupSeats = [
    { id: 'seat_lib_g1_1', space_id: 'spc_lib_group', table_id: 'tbl_lib_g01', seat_number: 'G1-A', row_label: 'Pod 1', col_index: 1, seat_type: 'socket', facilities: '["power","wifi","board"]', grid_x: 1, grid_y: 1 },
    { id: 'seat_lib_g1_2', space_id: 'spc_lib_group', table_id: 'tbl_lib_g01', seat_number: 'G1-B', row_label: 'Pod 1', col_index: 2, seat_type: 'socket', facilities: '["power","wifi","board"]', grid_x: 2, grid_y: 1 },
    { id: 'seat_lib_g1_3', space_id: 'spc_lib_group', table_id: 'tbl_lib_g01', seat_number: 'G1-C', row_label: 'Pod 1', col_index: 3, seat_type: 'standard', facilities: '["wifi","board"]', grid_x: 1, grid_y: 2 },
    { id: 'seat_lib_g1_4', space_id: 'spc_lib_group', table_id: 'tbl_lib_g01', seat_number: 'G1-D', row_label: 'Pod 1', col_index: 4, seat_type: 'standard', facilities: '["wifi","board"]', grid_x: 2, grid_y: 2 },

    { id: 'seat_lib_g2_1', space_id: 'spc_lib_group', table_id: 'tbl_lib_g02', seat_number: 'G2-A', row_label: 'Pod 2', col_index: 1, seat_type: 'socket', facilities: '["power","wifi","board"]', grid_x: 4, grid_y: 1 },
    { id: 'seat_lib_g2_2', space_id: 'spc_lib_group', table_id: 'tbl_lib_g02', seat_number: 'G2-B', row_label: 'Pod 2', col_index: 2, seat_type: 'socket', facilities: '["power","wifi","board"]', grid_x: 5, grid_y: 1 },
    { id: 'seat_lib_g2_3', space_id: 'spc_lib_group', table_id: 'tbl_lib_g02', seat_number: 'G2-C', row_label: 'Pod 2', col_index: 3, seat_type: 'standard', facilities: '["wifi","board"]', grid_x: 4, grid_y: 2 },
    { id: 'seat_lib_g2_4', space_id: 'spc_lib_group', table_id: 'tbl_lib_g02', seat_number: 'G2-D', row_label: 'Pod 2', col_index: 4, seat_type: 'standard', facilities: '["wifi","board"]', grid_x: 5, grid_y: 2 },
  ];
  for (const s of groupSeats) {
    const exists = get('SELECT id FROM seats WHERE id = ?', [s.id]);
    if (!exists) {
      run(
        `INSERT INTO seats (
          id, space_id, table_id, seat_number, row_label, col_index, seat_type, 
          facilities, is_blocked, grid_x, grid_y
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [s.id, s.space_id, s.table_id, s.seat_number, s.row_label, s.col_index, s.seat_type, s.facilities, s.grid_x, s.grid_y]
      );
    }
  }

  // --- D. Department Study Area (spc_dept_study) ---
  const engSeats = [
    { id: 'seat_eng_1', space_id: 'spc_dept_study', table_id: null, seat_number: 'E-01', row_label: 'Row 1', col_index: 1, seat_type: 'socket', facilities: '["power","wifi"]', grid_x: 1, grid_y: 1 },
    { id: 'seat_eng_2', space_id: 'spc_dept_study', table_id: null, seat_number: 'E-02', row_label: 'Row 1', col_index: 2, seat_type: 'socket', facilities: '["power","wifi"]', grid_x: 2, grid_y: 1 },
    { id: 'seat_eng_3', space_id: 'spc_dept_study', table_id: null, seat_number: 'E-03', row_label: 'Row 1', col_index: 3, seat_type: 'socket', facilities: '["power","wifi"]', grid_x: 3, grid_y: 1 },
    { id: 'seat_eng_4', space_id: 'spc_dept_study', table_id: null, seat_number: 'E-04', row_label: 'Row 2', col_index: 1, seat_type: 'standard', facilities: '["wifi"]', grid_x: 1, grid_y: 2 },
    { id: 'seat_eng_5', space_id: 'spc_dept_study', table_id: null, seat_number: 'E-05', row_label: 'Row 2', col_index: 2, seat_type: 'standard', facilities: '["wifi"]', grid_x: 2, grid_y: 2 },
    { id: 'seat_eng_6', space_id: 'spc_dept_study', table_id: null, seat_number: 'E-06', row_label: 'Row 2', col_index: 3, seat_type: 'socket', facilities: '["power","wifi"]', grid_x: 3, grid_y: 2 }
  ];
  for (const s of engSeats) {
    const exists = get('SELECT id FROM seats WHERE id = ?', [s.id]);
    if (!exists) {
      run(
        `INSERT INTO seats (
          id, space_id, table_id, seat_number, row_label, col_index, seat_type, 
          facilities, is_blocked, grid_x, grid_y
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [s.id, s.space_id, s.table_id, s.seat_number, s.row_label, s.col_index, s.seat_type, s.facilities, s.grid_x, s.grid_y]
      );
    }
  }

  // 6. Seed Sample Confirmed Seat Reservations (so the user sees booked vs available seats right away)
  const todayStr = new Date().toISOString().split('T')[0];
  const sampleReservations = [
    {
      id: 'res_sample_01',
      booking_reference: 'SAFARI-849102',
      user_id: 'usr_arjun_demo',
      space_id: 'spc_lib_upper',
      seat_id: 'seat_lib_A2',
      reservation_date: todayStr,
      start_time: '11:00',
      end_time: '13:00',
      status: 'confirmed',
      qr_code_token: 'qr_safari_res_849102',
      notes: 'Midday silent study'
    },
    {
      id: 'res_sample_02',
      booking_reference: 'SAFARI-592810',
      user_id: 'usr_neha_demo',
      space_id: 'spc_lib_upper',
      seat_id: 'seat_lib_W1',
      reservation_date: todayStr,
      start_time: '13:00',
      end_time: '15:00',
      status: 'confirmed',
      qr_code_token: 'qr_safari_res_592810',
      notes: 'Window desk research session'
    }
  ];

  for (const r of sampleReservations) {
    const exists = get('SELECT id FROM seat_reservations WHERE id = ?', [r.id]);
    if (!exists) {
      run(
        `INSERT INTO seat_reservations (
          id, booking_reference, user_id, space_id, seat_id, reservation_date,
          start_time, end_time, status, qr_code_token, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          r.id, r.booking_reference, r.user_id, r.space_id, r.seat_id, r.reservation_date,
          r.start_time, r.end_time, r.status, r.qr_code_token, r.notes
        ]
      );
    }
  }

  // 7. Seed Usual Busy Times
  const sampleBusyTimes = [
    {
      id: 'busy_lib_upper',
      space_id: 'spc_lib_upper',
      day_type: 'teaching_days',
      start_time: '11:00',
      end_time: '16:00',
      busy_level: 'busy',
      notes: 'Peak after lunch to mid-afternoon (about 11 AM to 4 PM on teaching days)'
    },
    {
      id: 'busy_lib_group',
      space_id: 'spc_lib_group',
      day_type: 'teaching_days',
      start_time: '11:00',
      end_time: '16:00',
      busy_level: 'busy',
      notes: 'Peak group collaboration period after lunch'
    },
    {
      id: 'busy_dept_study',
      space_id: 'spc_dept_study',
      day_type: 'teaching_days',
      start_time: '00:00',
      end_time: '23:59',
      busy_level: 'unknown',
      notes: 'Usual busy times unknown'
    },
    {
      id: 'busy_dept_proj',
      space_id: 'spc_dept_proj_214',
      day_type: 'teaching_days',
      start_time: '00:00',
      end_time: '23:59',
      busy_level: 'unknown',
      notes: 'Usual busy times unknown'
    },
    {
      id: 'busy_union',
      space_id: 'spc_union_common',
      day_type: 'teaching_days',
      start_time: '00:00',
      end_time: '23:59',
      busy_level: 'unknown',
      notes: 'Usual busy times unknown'
    },
    {
      id: 'busy_cafe',
      space_id: 'spc_cafeteria_annex',
      day_type: 'teaching_days',
      start_time: '12:00',
      end_time: '14:00',
      busy_level: 'busy',
      notes: 'Lunchtime dining rush'
    },
    {
      id: 'busy_sci_hall',
      space_id: 'spc_sci_classroom_204',
      day_type: 'teaching_days',
      start_time: '00:00',
      end_time: '23:59',
      busy_level: 'unknown',
      notes: 'Depends on daily academic lecture timetable'
    },
    {
      id: 'busy_north_nook',
      space_id: 'spc_north_nook',
      day_type: 'teaching_days',
      start_time: '00:00',
      end_time: '23:59',
      busy_level: 'unknown',
      notes: 'Usual busy times unknown'
    }
  ];

  for (const b of sampleBusyTimes) {
    const existing = get('SELECT id FROM usual_busy WHERE id = ?', [b.id]);
    if (!existing) {
      run(
        'INSERT INTO usual_busy (id, space_id, day_type, start_time, end_time, busy_level, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [b.id, b.space_id, b.day_type, b.start_time, b.end_time, b.busy_level, b.notes]
      );
    }
  }

  // 8. Seed Fresh Sample Reports
  const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const twentyMinsFromNow = new Date(now.getTime() + 20 * 60 * 1000).toISOString();
  
  const existingReport = get('SELECT id FROM reports WHERE space_id = ?', ['spc_lib_upper']);
  if (!existingReport) {
    run(
      `INSERT INTO reports (id, space_id, user_id, status, created_at, expires_at, hidden, flagged, flag_count)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)`,
      ['rep_sample_01', 'spc_lib_upper', 'usr_student_demo', 'Filling up', tenMinsAgo, twentyMinsFromNow]
    );
    console.log('Seeded sample report for Library Upper Floor (Filling up, 10m ago)');
  }

  // 9. Seed Sample Audit Log
  const existingAudit = get('SELECT id FROM audit_logs LIMIT 1');
  if (!existingAudit) {
    logAudit('system_init', 'system', 'system_seed', 'System', 'Initialized Seat Safari with sample spaces and rules');
    logAudit('Sarah Librarian (Demo)', 'staff', 'confirm_accurate', 'Library Upper Floor', 'Manual verification of facilities');
  }

  console.log('--- Seat Safari Seed Completed Successfully ---');
}

// Execute seed if run directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seed };
