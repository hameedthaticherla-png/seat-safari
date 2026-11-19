const express = require('express');
const path = require('node:path');
const occupancyRoutes = require('./vercel-occupancy');
const { getPool, initializeSchema } = require('./vercel-db');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12kb' }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', async (_req, res) => {
  try {
    await initializeSchema();
    await getPool().query('SELECT 1');
    res.json({ status: 'ok', time: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ status: 'unavailable' });
  }
});

app.use('/api/occupancy', occupancyRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));

// Vercel serves public assets from its CDN; this fallback supports React Router deep links.
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled application error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
