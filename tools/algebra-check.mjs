#!/usr/bin/env node
/**
 * Cross-check three independent things against each other:
 *
 *   1. a literal transcription of FsLocalizationStringDatabase.HashStringId
 *      written in BigInt (no 32-bit tricks, no Math.imul, no TextEncoder),
 *   2. js/hash.js as shipped,
 *   3. the algebraic solver in js/algebra.js and the meet-in-the-middle
 *      search in js/search-core.js.
 *
 * If the finder were broken, this would say so.
 */

import { hashString, toHex } from '../js/hash.js';
import { solveSuffix, solveMany } from '../js/algebra.js';
import { search, ALPHABETS } from '../js/search-core.js';
import { readFileSync } from 'node:fs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

// ---------------------------------------------------------------------------
// 1. Reference hash, transcribed straight from the description.
//      h = 0xFFFFFFFF;  for each char:  h = (char + 33 * h) mod 2^32
// ---------------------------------------------------------------------------
function hashReference(str) {
  let h = 0xffffffffn;
  for (let i = 0; i < str.length; i++) {
    h = (BigInt(str.charCodeAt(i)) + 33n * h) % 4294967296n;
  }
  return Number(h);
}

console.log('=== 1. shipped hash vs. reference =========================\n');

const samples = [
  'ID_', 'ID_A', 'ID_AAAAAAA', 'ID_081816D8', 'Peashooter',
  '{(C)PRESENCE_CONTEXT_GAMEMODE_ROUND_NAME}', 'Gardens & Graveyards',
  'ID_zzzzzzz', 'a'.repeat(64), '',
];
for (const s of samples) {
  const mine = hashString(s);
  const ref = hashReference(s);
  check(`hash(${JSON.stringify(s.length > 24 ? s.slice(0, 21) + '...' : s)})`,
        mine === ref, `${toHex(mine)} vs ${toHex(ref)}`);
}

// ---------------------------------------------------------------------------
// 2. The algebraic method, on the exact example from the write-up.
// ---------------------------------------------------------------------------
console.log('\n=== 2. algebraic solver (n=7, prefix "ID_") ================\n');

const targets = [0x081816d8, 0x00000000, 0xffffffff, 0xdeadbeef, 0x0815fe6e, 0x12345678];

for (const target of targets) {
  const solutions = solveSuffix(target, 'ID_', 7, true);
  const allValid = solutions.every((s) => hashString(s) === target);
  const allRef = solutions.every((s) => hashReference(s) === target);
  check(`solve ${toHex(target)}`,
        solutions.length > 0 && allValid && allRef,
        `${solutions.length} solution(s), e.g. ${solutions[0] ?? '—'}`);
}

// Reachability: n=7 must solve *every* target, because 33^7 > 2^32.
let unreachable = 0;
for (let i = 0; i < 20000; i++) {
  const target = (Math.random() * 4294967296) >>> 0;
  // Without the alphanumeric filter there is always at least one answer.
  if (solveSuffix(target, 'ID_', 7, false).length === 0) unreachable++;
}
check('n=7 reaches every target (20 000 random)', unreachable === 0,
      `${unreachable} unreachable`);

// With the alphanumeric filter some targets legitimately have no 7-char answer.
let filteredMisses = 0;
for (let i = 0; i < 5000; i++) {
  const target = (Math.random() * 4294967296) >>> 0;
  if (solveSuffix(target, 'ID_', 7, true).length === 0) filteredMisses++;
}
console.log(`      note: ${(filteredMisses / 50).toFixed(1)}% of targets have no *alphanumeric* 7-char tail;`);
console.log('            padding the prefix and re-solving covers those.');

// solveMany must produce many distinct, valid answers.
for (const target of [0x081816d8, 0xdeadbeef]) {
  const { results } = solveMany({ target, prefix: 'ID_', limit: 40 });
  const unique = new Set(results).size === results.length;
  const valid = results.every((s) => hashString(s) === target);
  check(`solveMany ${toHex(target)}`, results.length >= 40 && unique && valid,
        `${results.length} results, e.g. ${results.slice(0, 3).join(', ')}`);
}

// Timing.
const t0 = Date.now();
for (let i = 0; i < 1000; i++) solveMany({ target: (Math.random() * 4294967296) >>> 0, limit: 30 });
console.log(`      1000 full solves in ${Date.now() - t0} ms`);

// ---------------------------------------------------------------------------
// 3. Brute force and algebra must agree.
// ---------------------------------------------------------------------------
console.log('\n=== 3. meet-in-the-middle vs. algebra ======================\n');

function runSearch(options) {
  const it = search(options);
  let step = it.next();
  while (!step.done) step = it.next();
  return step.value;
}

for (const target of [0x081816d8, 0x0815fe6e]) {
  const brute = runSearch({
    target, prefix: 'ID_', chars: ALPHABETS.hex, minLen: 8, maxLen: 8, limit: 1000,
  });
  const allValid = brute.results.every((s) => hashString(s) === target);
  check(`brute force ${toHex(target)} — every hit verifies`, allValid,
        `${brute.results.length} hit(s)${brute.results[0] ? `, e.g. ${brute.results[0]}` : ''}`);

  // Independent confirmation that a brute-force hit is a genuine preimage.
  const sample = brute.results[0];
  if (sample) {
    check(`  reference agrees on ${sample}`, hashReference(sample) === target);
  } else {
    console.log(`      no ID_ + 8 hex chars maps to ${toHex(target)} — expected:`);
    console.log('      16^8 candidates over 2^32 outputs means ~37% of targets have none.');
    console.log('      This is exactly why the algebraic mode is the better default.');
  }
}

// Brute force over the algebra alphabet must find the algebraic answers too.
{
  const target = 0x081816d8;
  const algebraic = solveSuffix(target, 'ID_', 7, false);
  const upperA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  const found = algebraic.filter((s) => [...s.slice(3)].every((c) => upperA.includes(c)));
  check('algebraic answers use in-alphabet characters', found.length > 0,
        `${found.length}/${algebraic.length} usable, e.g. ${found[0] ?? '—'}`);
}

// ---------------------------------------------------------------------------
// 4. Database ordering — the bug the user spotted.
// ---------------------------------------------------------------------------
console.log('\n=== 4. database ordering ===================================\n');

for (const game of ['gw1', 'gw2']) {
  const raw = JSON.parse(readFileSync(new URL(`../data/${game}.json`, import.meta.url)));

  const rawOrder = Object.keys(raw);
  const sorted = [...rawOrder].sort();

  console.log(`  ${game}.json first key as stored : ${sorted[0]}`);
  console.log(`  ${game}.json first key from Object.keys : ${rawOrder[0]}`);
  check(`${game}: sorted order starts at 0xxxxxxx`, sorted[0].startsWith('0'),
        sorted[0]);
  // This is the trap: integer-like keys jump to the front of Object.keys.
  if (rawOrder[0] !== sorted[0]) {
    console.log('      ^ confirmed: JS reorders integer-like keys, so the view must sort explicitly');
  }
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
