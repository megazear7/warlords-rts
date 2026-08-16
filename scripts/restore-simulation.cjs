#!/usr/bin/env node
/**
 * Restores src/core/Simulation.ts from gzip+base64 payload parts if needed.
 * If a full Simulation.ts (>10KB) is already present, does nothing.
 * Runs automatically on npm run dev / npm run build via predev/prebuild.
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
  const parts = [1, 2, 3].map((n) => path.join(core, `Simulation.ts.gz.b64.part${n}`));
  if (parts.every((p) => fs.existsSync(p))) {
    return parts.map((p) => fs.readFileSync(p, 'utf8').trim()).join('');
  }
  const gzB64Path = path.join(core, 'Simulation.ts.gz.b64');
  if (fs.existsSync(gzB64Path)) {
    return fs.readFileSync(gzB64Path, 'utf8').trim();
  }
  return null;
}

const payload = readPayload();
if (!payload) {
  console.error('No Simulation payload found and no full Simulation.ts present.');
  console.error('Copy the authoritative Simulation.ts from project artifacts or pull a complete commit.');
  process.exit(1);
}

try {
  const buf = zlib.gunzipSync(Buffer.from(payload, 'base64'));
  fs.writeFileSync(outPath, buf);
  console.log('Restored Simulation.ts from gzip+base64 (' + buf.length + ' bytes)');
} catch (e) {
  console.error('Payload restore failed:', e.message);
  console.error('Payload may be incomplete. Use the full Simulation.ts from project artifacts.');
  process.exit(1);
}
