#!/usr/bin/env node
/**
 * Restores src/core/Simulation.ts from the committed gzip+base64 payload.
 * Supports single file (.gz.b64) or split parts (.gz.b64.part1/2/3).
 * Run: node scripts/restore-simulation.cjs
 * Auto-runs on npm run dev / npm run build via predev/prebuild.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const core = path.join(root, 'src', 'core');
const outPath = path.join(core, 'Simulation.ts');

function readPayload() {
  const parts = [1, 2, 3].map((n) => path.join(core, `Simulation.ts.gz.b64.part${n}`));
  if (parts.every((p) => fs.existsSync(p))) {
    return parts.map((p) => fs.readFileSync(p, 'utf8').trim()).join('');
  }
  const gzB64Path = path.join(core, 'Simulation.ts.gz.b64');
  if (fs.existsSync(gzB64Path)) {
    return fs.readFileSync(gzB64Path, 'utf8').trim();
  }
  const plainB64Path = path.join(core, 'Simulation.ts.b64');
  if (fs.existsSync(plainB64Path)) {
    return { plain: fs.readFileSync(plainB64Path, 'utf8').trim() };
  }
  return null;
}

const payload = readPayload();
if (!payload) {
  console.error('No Simulation payload found');
  process.exit(1);
}

let buf;
if (typeof payload === 'object' && payload.plain) {
  buf = Buffer.from(payload.plain, 'base64');
  console.log('Restored Simulation.ts from plain base64');
} else {
  buf = zlib.gunzipSync(Buffer.from(payload, 'base64'));
  console.log('Restored Simulation.ts from gzip+base64');
}
fs.writeFileSync(outPath, buf);
console.log('Wrote', outPath, '(' + buf.length + ' bytes)');
