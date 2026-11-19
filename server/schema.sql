-- Seat Safari SQLite Database Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student', 'staff')),
  display_name TEXT NOT NULL,
  staff_scope TEXT DEFAULT 'all', -- 'all', 'library', 'engineering', etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  zone_type TEXT NOT NULL CHECK(zone_type IN ('Quiet', 'Discussion', 'Flexible')),
  zone_rule TEXT NOT NULL,
  facilities TEXT NOT NULL, -- JSON string array: ["power", "wifi", "board", "desk_chair"]
  hours TEXT NOT NULL,
  only_if_no_class INTEGER NOT NULL DEFAULT 0,
  hold_enabled INTEGER NOT NULL DEFAULT 0,
  last_checked_at DATETIME NOT NULL,
  owner_scope TEXT NOT NULL DEFAULT 'library',
  description TEXT,
  capacity_hint TEXT,
  map_zone TEXT, -- e.g. "Zone A - Level 3", "Zone B - Ground Floor"
  building_id TEXT,
  floor_id TEXT,
  layout_type TEXT DEFAULT 'grid', -- 'grid', 'tables', 'group_room'
  is_occupancy_tracked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usual_busy (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  day_type TEXT NOT NULL, -- 'teaching_days', 'weekend', 'all'
  start_time TEXT NOT NULL, -- '11:00'
  end_time TEXT NOT NULL, -- '16:00'
  busy_level TEXT NOT NULL, -- 'busy', 'moderate', 'quiet', 'unknown'
  notes TEXT,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Server-only for rate limits. NEVER exposed to staff or public!
  status TEXT NOT NULL CHECK(status IN ('Free', 'Filling up', 'Full')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  flagged INTEGER NOT NULL DEFAULT 0,
  flag_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS holds (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  checked_in_at DATETIME,
  released_at DATETIME,
  status TEXT NOT NULL CHECK(status IN ('active', 'checked_in', 'released', 'expired', 'cancelled_by_staff')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS problem_reports (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  note TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favourites (
  user_id TEXT NOT NULL,
  space_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, space_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NOT NULL
);

-- ============================================================================
-- BOOKMYSHOW-STYLE SEAT RESERVATION SYSTEM TABLES
-- Campus -> Building -> Floor -> Room/Zone -> Table -> Seat
-- ============================================================================

CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  campus TEXT NOT NULL DEFAULT 'Main Campus',
  description TEXT,
  hours TEXT NOT NULL DEFAULT '08:00 - 22:00',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL,
  floor_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS space_tables (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  table_number TEXT NOT NULL,
  label TEXT NOT NULL,
  shape TEXT NOT NULL DEFAULT 'rectangle', -- 'rectangle', 'round', 'booth', 'square'
  capacity INTEGER NOT NULL DEFAULT 4,
  x INTEGER NOT NULL DEFAULT 0,
  y INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seats (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  table_id TEXT,
  seat_number TEXT NOT NULL, -- e.g. "A1", "T04-1"
  row_label TEXT NOT NULL, -- e.g. "A", "B", "T1"
  col_index INTEGER NOT NULL, -- 1, 2, 3...
  seat_type TEXT NOT NULL DEFAULT 'standard' CHECK(seat_type IN ('standard', 'socket', 'window', 'computer', 'ergonomic', 'group_room')),
  facilities TEXT NOT NULL DEFAULT '["power","wifi","desk_chair"]',
  is_blocked INTEGER NOT NULL DEFAULT 0, -- 1 if maintenance/blocked by staff
  block_reason TEXT,
  grid_x INTEGER NOT NULL DEFAULT 0,
  grid_y INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES space_tables(id) ON DELETE SET NULL,
  UNIQUE(space_id, seat_number)
);

CREATE TABLE IF NOT EXISTS seat_reservations (
  id TEXT PRIMARY KEY,
  booking_reference TEXT UNIQUE NOT NULL, -- e.g. "SAFARI-849201"
  user_id TEXT NOT NULL,
  space_id TEXT NOT NULL,
  seat_id TEXT NOT NULL,
  reservation_date TEXT NOT NULL, -- "YYYY-MM-DD"
  start_time TEXT NOT NULL, -- "09:00"
  end_time TEXT NOT NULL, -- "11:00"
  status TEXT NOT NULL CHECK(status IN ('held', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show', 'expired')),
  held_until DATETIME,
  checked_in_at DATETIME,
  cancelled_at DATETIME,
  cancellation_reason TEXT,
  qr_code_token TEXT UNIQUE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE,
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_seat_res_lookup ON seat_reservations(seat_id, reservation_date, status);
CREATE INDEX IF NOT EXISTS idx_seat_res_user ON seat_reservations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_space ON seats(space_id);
CREATE INDEX IF NOT EXISTS idx_floors_bld ON floors(building_id);

CREATE TABLE IF NOT EXISTS seat_occupancy (
  seat_id TEXT PRIMARY KEY,
  occupied INTEGER NOT NULL DEFAULT 0 CHECK (occupied IN (0, 1)),
  device_token TEXT,
  expires_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS occupancy_feedback (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('suggestion', 'complaint', 'issue', 'feedback')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 2000),
  seat_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_occupancy_feedback_created ON occupancy_feedback(created_at DESC);
