#!/usr/bin/env node
/**
 * Restores src/core/Simulation.ts from gzip+base64 payload parts.
 * Supports any number of .partN files (part1, part2, ...).
 * Skips if a full Simulation.ts (>10KB) is already present.
 * Runs on npm run dev / npm run build via predev/prebuild.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const core = path.join(root, 'src', 'core');
const outPath = path.join(core, 'Simulation.ts');

if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) {
  console.log('Simulation.ts already present (' + fs.statSync(outPath).size + ' bytes) — skip restore');
  process.exit(0);
}

function readPayload() {
  const parts = [];
  for (let n = 1; n <= 20; n++) {
    const p = path.join(core, `Simulation.ts.gz.b64.part${n}`);
    if (!fs.existsSync(p)) break;
    parts.push(fs.readFileSync(p, 'utf8').trim());
  }
  if (parts.length > 0) return parts.join('');

  const gzB64Path = path.join(core, 'Simulation.ts.gz.b64');
  if (fs.existsSync(gzB64Path)) {
    return fs.readFileSync(gzB64Path, 'utf8').trim();
  }
  return null;
}

const payload = readPayload();
if (!payload) {
  console.error('No Simulation payload found and no full Simulation.ts present.');
  process.exit(1);
}

try {
  const buf = zlib.gunzipSync(Buffer.from(payload, 'base64'));
  fs.writeFileSync(outPath, buf);
  console.log('Restored Simulation.ts from gzip+base64 (' + buf.length + ' bytes)');
} catch (e) {
  console.error('Payload restore failed:', e.message);
  process.exit(1);
}
