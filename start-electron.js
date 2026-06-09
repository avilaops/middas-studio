// This script ensures Electron is always started from the project root, using the correct entry point.
// Place this as 'start-electron.js' in your project root and use `node start-electron.js` to launch Electron safely.

const { spawn } = require('child_process');
const path = require('path');

const electronPath = require('electron');
const mainEntry = path.join(__dirname, 'electron', 'main.js');

const child = spawn(electronPath, [mainEntry], {
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code) => {
  process.exit(code);
});
