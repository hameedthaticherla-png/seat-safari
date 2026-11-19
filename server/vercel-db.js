const { Pool } = require('@neondatabase/serverless');

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the Vercel deployment.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

let schemaReady;

function initializeSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getPool();
      await db.query(`
        CREATE TABLE IF NOT EXISTS seat_occupancy (
          seat_id TEXT PRIMARY KEY,
          occupied BOOLEAN NOT NULL DEFAULT FALSE,
          device_token TEXT,
          expires_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS one_active_seat_per_device
        ON seat_occupancy (device_token)
        WHERE occupied = TRUE AND device_token IS NOT NULL
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS occupancy_feedback (
          id UUID PRIMARY KEY,
          category TEXT NOT NULL CHECK (category IN ('suggestion', 'complaint', 'issue', 'feedback')),
          message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
          seat_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

module.exports = { getPool, initializeSchema };
