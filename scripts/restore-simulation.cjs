#!/usr/bin/env node
/**
 * Restores src/core/Simulation.ts from the committed gzip+base64 payload.
 * Run: node scripts/restore-simulation.cjs
 * Or: npm run restore-sim
 * Auto-runs on npm run dev / npm run build via predev/prebuild.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const gzB64Path = path.join(root, 'src/core/Simulation.ts.gz.b64');
const plainB64Path = path.join(root, 'src/core/Simulation.ts.b64');
const outPath = path.join(root, 'src/core/Simulation.ts');

let buf;
if (fs.existsSync(gzB64Path)) {
  const b64 = fs.readFileSync(gzB64Path, 'utf8').trim();
  buf = zlib.gunzipSync(Buffer.from(b64, 'base64'));
  console.log('Restored Simulation.ts from gzip+base64');
} else if (fs.existsSync(plainB64Path)) {
  const b64 = fs.readFileSync(plainB64Path, 'utf8').trim();
  buf = Buffer.from(b64, 'base64');
  console.log('Restored Simulation.ts from plain base64');
} else {
  console.error('No Simulation payload found (src/core/Simulation.ts.gz.b64)');
  process.exit(1);
}
fs.writeFileSync(outPath, buf);
console.log('Wrote', outPath, '(' + buf.length + ' bytes)');
