#!/usr/bin/env node
/**
 * Restores large source files from gzip+base64 payload.
 * Currently: Simulation.ts (src/core), InputManager.ts (src/renderer)
 * Preference: single .gz.b64 file, then part1..partN.
 * Skips if full file (>10KB) already present.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');

function restoreFile(dir, baseName) {
  const outPath = path.join(dir, baseName + '.ts');
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) {
    console.log(baseName + '.ts already present (' + fs.statSync(outPath).size + ' bytes) — skip');
    return true;
  }

  function readSingle() {
    const p = path.join(dir, baseName + '.ts.gz.b64');
    if (fs.existsSync(p) && fs.statSync(p).size > 500) {
      return fs.readFileSync(p, 'utf8').trim();
    }
    return null;
  }

  function readParts() {
    const parts = [];
    for (let n = 1; n <= 20; n++) {
      const p = path.join(dir, `${baseName}.ts.gz.b64.part${n}`);
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
      console.log('Restored ' + baseName + '.ts from ' + label + ' (' + buf.length + ' bytes)');
      return true;
    } catch (e) {
      console.warn('Restore ' + baseName + ' from ' + label + ' failed:', e.message);
      return false;
    }
  }

  if (tryRestore(readSingle(), baseName + '.ts.gz.b64')) return true;
  if (tryRestore(readParts(), 'payload parts')) return true;
  console.error('No usable ' + baseName + ' payload and no full file present.');
  return false;
}

const okSim = restoreFile(path.join(root, 'src', 'core'), 'Simulation');
const okIM = restoreFile(path.join(root, 'src', 'renderer'), 'InputManager');
if (!okSim || !okIM) process.exit(1);
