const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'client', 'dist');
const destination = path.join(__dirname, '..', 'public');

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
console.log(`Copied Vite build into ${destination}`);
