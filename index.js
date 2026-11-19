// Vercel requires its Express entry point to import Express directly.
require('express');

// Export the configured app so the API runs as a Vercel Node.js Function.
module.exports = require('./server/vercel-app');
