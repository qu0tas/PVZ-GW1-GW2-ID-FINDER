#!/usr/bin/env node
/**
 * Correctness + performance self-test for the hash and the search.
 * Run: node tools/selftest.mjs
 */

import { hashString, toHex, parseHash, pow33 } from '../js/hash.js';
import { search, ALPHABETS, DEPTHS, estimateWork } from '../js/search-core.js';

let failures = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  expected ${expected}, got ${actual}`}`);
};

console.log('--- hash ---');

// Reference implementation using BigInt: no precision shortcuts possible.
function hashRef(str) {
  let h = 0xffffffffn;
  for (const byte of new TextEncoder().encode(str)) {
    h = (h * 33n + BigInt(byte)) & 0xffffffffn;
  }
  return Number(h) >>> 0;
}

for (const sample of ['', 'A', 'ID_', 'ID_081816D8', 'ID_00000000', 'ID_FFFFFFFF',
                      'Peashooter', 'a'.repeat(300), '\u041f\u0440\u0438\u0432\u0435\u0442']) {
  const label = sample.length > 20 ? `${sample.slice(0, 17)}...` : JSON.stringify(sample);
  check(`hash ${label}`, toHex(hashString(sample)), toHex(hashRef(sample)));
}

check('pow33(0)', pow33(0), 1);
check('pow33(1)', pow33(1), 33);
check('pow33(8)', pow33(8), Number((33n ** 8n) & 0xffffffffn) >>> 0);
check('pow33(20)', pow33(20), Number((33n ** 20n) & 0xffffffffn) >>> 0);

console.log('\n--- parseHash ---');
check('plain', parseHash('081816D8').value, 0x081816d8);
check('0x prefix', parseHash('0x081816d8').value, 0x081816d8);
check('# prefix', parseHash(' #081816D8 ').value, 0x081816d8);
check('short', parseHash('FF').value, 0xff);
check('reject empty', parseHash('').error, 'err.empty');
check('reject non-hex', parseHash('ZZZZ').error, 'err.notHex');
check('reject long', parseHash('0123456789').error, 'err.tooLong');

console.log('\n--- search ---');

function run(options) {
  const started = Date.now();
  const iterator = search(options);
  let step = iterator.next();
  while (!step.done) step = iterator.next();
  return { ...step.value, ms: Date.now() - started };
}

// 1. Round-trip: hash a known string, then find a preimage for it.
const known = 'ID_081816D8';
const target = hashString(known);
const r1 = run({ target, prefix: 'ID_', chars: ALPHABETS.hex, minLen: 8, maxLen: 8, limit: 50 });
check('round-trip finds the original', r1.results.includes(known), true);
console.log(`      ${r1.results.length} preimages of length 8 in ${r1.ms} ms`);

// 2. Every returned string must actually hash to the target.
const allValid = r1.results.every((s) => hashString(s) === target);
check('all results verify', allValid, true);

// 3. Short lengths and odd splits must work too.
const r2 = run({ target: hashString('ID_7'), prefix: 'ID_', chars: ALPHABETS.hex, minLen: 1, maxLen: 1, limit: 10 });
check('length 1 (la=0 edge case)', r2.results.includes('ID_7'), true);

const r3 = run({ target: hashString('ID_ABC'), prefix: 'ID_', chars: ALPHABETS.hex, minLen: 3, maxLen: 3, limit: 10 });
check('odd length 3', r3.results.includes('ID_ABC'), true);

// 4. Empty prefix.
const r4 = run({ target: hashString('C0FFEE'), prefix: '', chars: ALPHABETS.hex, minLen: 6, maxLen: 6, limit: 10 });
check('empty prefix', r4.results.includes('C0FFEE'), true);

// 5. Larger alphabet.
const r5 = run({ target: hashString('ID_ZOMB'), prefix: 'ID_', chars: ALPHABETS.upper, minLen: 4, maxLen: 4, limit: 10 });
check('36-char alphabet', r5.results.includes('ID_ZOMB'), true);

// 6. Limit + skipped lengths are reported honestly.
const r6 = run({ target, prefix: 'ID_', chars: ALPHABETS.hex, minLen: 8, maxLen: 8, limit: 2 });
check('limit respected', r6.results.length, 2);
check('truncation reported', r6.truncated, true);

const r7 = run({ target, prefix: 'ID_', chars: ALPHABETS.upper, minLen: 9, maxLen: 9, limit: 5 });
check('over-budget length skipped', r7.skipped.includes(9), true);

console.log('\n--- depth presets ---');
for (const [name, preset] of Object.entries(DEPTHS)) {
  const { work, skipped } = estimateWork(ALPHABETS.hex, preset.minLen, preset.maxLen);
  const started = Date.now();
  const r = run({ target, prefix: 'ID_', chars: ALPHABETS.hex, ...preset, limit: 30 });
  console.log(`  ${name.padEnd(9)} lengths ${preset.minLen}-${preset.maxLen}  work=${work.toLocaleString('en-US')}  skipped=${skipped}  hits=${r.results.length}  ${Date.now() - started} ms`);
}

console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
