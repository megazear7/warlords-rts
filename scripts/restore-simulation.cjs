#!/usr/bin/env node
/**
 * Restores src/core/Simulation.ts from gzip+base64 payload.
 * Preference order:
 *   1. Single file Simulation.ts.gz.b64 (if present and >1KB)
 *   2. Concatenated part1..partN files
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

function readSingle() {
  const p = path.join(core, 'Simulation.ts.gz.b64');
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) {
    return fs.readFileSync(p, 'utf8').trim();
  }
  return null;
}

function readParts() {
  const parts = [];
  for (let n = 1; n <= 20; n++) {
    const p = path.join(core, `Simulation.ts.gz.b64.part${n}`);
    if (!fs.existsSync(p)) break;
    parts.push(fs.readFileSync(p, 'utf8').trim());
  }
  return parts.length > 0 ? parts.join('') : null;
}

function tryRestore(payload, label) {
  if (!payload) return false;
  try {
    const buf = zlib.gunzipSync(Buffer.from(payload, 'base64'));
    fs.writeFileSync(outPath, buf);
    console.log('Restored Simulation.ts from ' + label + ' (' + buf.length + ' bytes)');
    return true;
  } catch (e) {
    console.warn('Restore from ' + label + ' failed:', e.message);
    return false;
  }
}

// Prefer single file (more reliable), then parts
if (tryRestore(readSingle(), 'Simulation.ts.gz.b64')) process.exit(0);
if (tryRestore(readParts(), 'payload parts')) process.exit(0);

console.error('No usable Simulation payload found and no full Simulation.ts present.');
process.exit(1);
