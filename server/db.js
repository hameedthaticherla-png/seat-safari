const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.SAFARI_DB_PATH || path.join(__dirname, 'data', 'safari.db');

// Ensure data folder exists
if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// Initialize tables from schema.sql
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// Safe migrations for spaces table
try {
  const columns = db.prepare("PRAGMA table_info('spaces')").all();
  const colNames = columns.map(c => c.name);
  if (!colNames.includes('building_id')) {
    db.exec('ALTER TABLE spaces ADD COLUMN building_id TEXT;');
  }
  if (!colNames.includes('floor_id')) {
    db.exec('ALTER TABLE spaces ADD COLUMN floor_id TEXT;');
  }
  if (!colNames.includes('layout_type')) {
    db.exec("ALTER TABLE spaces ADD COLUMN layout_type TEXT DEFAULT 'grid';");
  }
  if (!colNames.includes('is_occupancy_tracked')) {
    db.exec('ALTER TABLE spaces ADD COLUMN is_occupancy_tracked INTEGER NOT NULL DEFAULT 0;');
  }
  const occupancyColumns = db.prepare("PRAGMA table_info('seat_occupancy')").all().map((column) => column.name);
  if (!occupancyColumns.includes('device_token')) {
    db.exec('ALTER TABLE seat_occupancy ADD COLUMN device_token TEXT;');
  }
  if (!occupancyColumns.includes('expires_at')) {
    db.exec('ALTER TABLE seat_occupancy ADD COLUMN expires_at TEXT;');
  }
  // Existing occupied rows use the current 90-minute lease instead of remaining stale forever.
  db.exec(`UPDATE seat_occupancy
    SET expires_at = datetime(updated_at, '+90 minutes')
    WHERE occupied = 1 AND (expires_at IS NULL OR expires_at > datetime(updated_at, '+90 minutes'));`);
} catch (migErr) {
  console.error('Migration warning (non-fatal):', migErr.message);
}

// Clean wrapper functions
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

function exec(sql) {
  return db.exec(sql);
}

// Atomic transaction execution wrapper
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Settings helpers
function getSetting(key, defaultValue) {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  if (!row) return defaultValue;
  const num = Number(row.value);
  return isNaN(num) ? row.value : num;
}

function setSetting(key, value) {
  run(
    'INSERT INTO settings (key, value, description) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value), `Configuration for ${key}`]
  );
}

function getAllSettings() {
  return query('SELECT key, value, description FROM settings');
}

// Log audit action
function logAudit(actor, actor_role, action, target, details = '') {
  const id = 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  run(
    "INSERT INTO audit_logs (id, actor, actor_role, action, target, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
    [id, actor, actor_role, action, target, details]
  );
}

module.exports = {
  db,
  query,
  get,
  run,
  exec,
  transaction,
  getSetting,
  setSetting,
  getAllSettings,
  logAudit,
};
