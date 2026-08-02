#!/usr/bin/env node
/**
 * Extracts the inlined GW1/GW2 hash databases out of the OLD single-file
 * index.html and writes them to data/gw1.json + data/gw2.json.
 *
 * Run once, from the project root:
 *
 *     node tools/extract-db.mjs path/to/old-index.html
 *
 * It scans for object literals whose first key looks like an 8-digit hex hash,
 * brace-matches them (string- and escape-aware), parses them, and keeps the two
 * largest. Order of appearance decides GW1 vs GW2, unless a nearby variable
 * name says otherwise.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const source = process.argv[2];
if (!source) {
  console.error('usage: node tools/extract-db.mjs <old-index.html>');
  process.exit(1);
}

const html = readFileSync(source, 'utf8');

/** Brace-match a JSON object starting at `start`, respecting strings/escapes. */
function matchObject(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

const candidates = [];
const opener = /\{\s*"[0-9A-Fa-f]{8}"\s*:/g;
let match;
while ((match = opener.exec(html)) !== null) {
  const end = matchObject(html, match.index);
  if (end === -1) continue;
  const slice = html.slice(match.index, end);
  let parsed;
  try {
    parsed = JSON.parse(slice);
  } catch {
    continue;
  }
  const size = Object.keys(parsed).length;
  if (size < 50) continue;
  // Look back a little for a variable name hinting at the game.
  const context = html.slice(Math.max(0, match.index - 120), match.index).toLowerCase();
  const hint = /gw2|garden_?warfare_?2/.test(context) ? 'gw2'
             : /gw1|garden_?warfare_?1/.test(context) ? 'gw1'
             : null;
  candidates.push({ at: match.index, size, data: parsed, hint });
  opener.lastIndex = end;
}

if (candidates.length === 0) {
  console.error('No inlined hash databases found. Is this the right file?');
  process.exit(2);
}

candidates.sort((a, b) => b.size - a.size);
const top = candidates.slice(0, 2).sort((a, b) => a.at - b.at);

const assigned = {};
for (const candidate of top) {
  const key = candidate.hint && !assigned[candidate.hint]
    ? candidate.hint
    : (!assigned.gw1 ? 'gw1' : 'gw2');
  assigned[key] = candidate.data;
}

mkdirSync(resolve(root, 'data'), { recursive: true });
for (const [game, data] of Object.entries(assigned)) {
  // Normalise keys to uppercase 8-char hex so lookups are exact.
  const normalised = {};
  for (const [hash, name] of Object.entries(data)) {
    normalised[hash.toUpperCase().padStart(8, '0')] = name;
  }
  const out = resolve(root, 'data', `${game}.json`);
  writeFileSync(out, JSON.stringify(normalised));
  const bytes = Buffer.byteLength(JSON.stringify(normalised));
  console.log(`${game}: ${Object.keys(normalised).length} entries -> data/${game}.json (${(bytes / 1024).toFixed(0)} KB)`);
}

if (!assigned.gw2) {
  console.warn('Only one database found; data/gw2.json was not written.');
}
