#!/usr/bin/env node
/**
 * Imports Frosty Editor hash dumps (CSV) into data/gw1.json and data/gw2.json.
 *
 *     node tools/import-csv.mjs GW1HASH.csv GW2HASH.csv
 *     node tools/import-csv.mjs --gw2 GW2HASH.csv        # just one of them
 *
 * Accepts UTF-16 LE/BE (with or without BOM) and UTF-8, CRLF or LF, and
 * RFC-4180 quoting (embedded commas, quotes doubled as "").
 * Expected shape per line:  HASH,"Bound value"
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Decode a buffer, sniffing UTF-16 by BOM or by the NUL pattern of ASCII text. */
function decode(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.toString('utf16le', 2);
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return buffer.swap16().toString('utf16le', 2);
  const head = buffer.subarray(0, 200);
  const nuls = head.filter((b) => b === 0).length;
  if (nuls > head.length / 3) {
    // No BOM but half the bytes are NUL -> UTF-16. Odd positions NUL = LE.
    let leHits = 0;
    for (let i = 1; i < head.length; i += 2) if (head[i] === 0) leHits++;
    return leHits > head.length / 5
      ? buffer.toString('utf16le')
      : Buffer.from(buffer).swap16().toString('utf16le');
  }
  return buffer.toString('utf8');
}

/** Minimal RFC-4180 parser: returns rows of fields. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }

    if (ch === '"' && field === '') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const HASH_RE = /^[0-9A-Fa-f]{1,8}$/;

function convert(path) {
  const text = decode(readFileSync(path)).replace(/^\uFEFF/, '');
  const rows = parseCsv(text);

  const out = {};
  const stats = { rows: rows.length, kept: 0, skipped: 0, duplicates: 0, conflicts: 0 };

  for (const row of rows) {
    if (row.length < 2) { if (row.join('').trim()) stats.skipped++; continue; }
    const rawHash = row[0].trim();
    if (!HASH_RE.test(rawHash)) { stats.skipped++; continue; }   // also drops a header line
    const hash = rawHash.toUpperCase().padStart(8, '0');
    // Anything after the first comma belongs to the value if it was unquoted.
    const value = row.slice(1).join(',').replace(/\u0000/g, '').trim();
    if (!value) { stats.skipped++; continue; }

    if (hash in out) {
      stats.duplicates++;
      if (out[hash] !== value) {
        stats.conflicts++;
        // Keep the longer, more descriptive value.
        if (value.length > out[hash].length) out[hash] = value;
      }
      continue;
    }
    out[hash] = value;
    stats.kept++;
  }

  // Sort by hash so diffs stay readable and the default table order is stable.
  const sorted = {};
  for (const key of Object.keys(out).sort()) sorted[key] = out[key];
  return { data: sorted, stats };
}

// ---- argument handling ----------------------------------------------------

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node tools/import-csv.mjs [--gw1] GW1HASH.csv [--gw2] GW2HASH.csv');
  process.exit(1);
}

const jobs = [];
let forced = null;
for (const arg of args) {
  if (arg === '--gw1' || arg === '--gw2') { forced = arg.slice(2); continue; }
  const guessed = /gw2|_2|warfare.?2/i.test(basename(arg)) ? 'gw2' : 'gw1';
  jobs.push({ game: forced || guessed, path: arg });
  forced = null;
}

mkdirSync(resolve(root, 'data'), { recursive: true });

for (const job of jobs) {
  const { data, stats } = convert(job.path);
  const json = JSON.stringify(data);
  writeFileSync(resolve(root, 'data', `${job.game}.json`), json);
  console.log(
    `${job.game}: ${stats.kept.toLocaleString('en-US')} entries -> data/${job.game}.json ` +
    `(${(Buffer.byteLength(json) / 1024).toFixed(0)} KB)`
  );
  if (stats.skipped) console.log(`      ${stats.skipped} line(s) skipped (header / malformed)`);
  if (stats.duplicates) console.log(`      ${stats.duplicates} duplicate hash(es), ${stats.conflicts} with differing values`);
}
