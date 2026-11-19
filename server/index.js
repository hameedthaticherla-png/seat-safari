const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const { PORT } = require('./config');
const { seed } = require('./seed');

const occupancyRoutes = require('./routes/occupancy');

const app = express();

app.use(cors());
app.use(express.json());

// Request logger for debugging
app.use((req, res, next) => {
  // Silent health check logging
  if (req.path !== '/api/health') {
    console.log(`[${new Date().toISOString().substring(11, 19)}] ${req.method} ${req.path}`);
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Only seat occupancy is exposed by the focused Central Library app.
app.use('/api/occupancy', occupancyRoutes);

// Serve built client frontend if dist exists
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Initialize seed data and start server
seed()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`  Seat Safari API Server active on port ${PORT}`);
      console.log(`  Health Check: http://localhost:${PORT}/api/health`);
      console.log(`===============================================`);
    });
  })
  .catch((err) => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
