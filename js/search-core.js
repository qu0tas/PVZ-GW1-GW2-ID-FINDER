/**
 * Meet-in-the-middle reverse search for the GW1/GW2 string hash.
 *
 * The hash is a linear polynomial over Z_2^32:
 *
 *   H(prefix + A + B) = H(prefix + A) * 33^|B| + Q(B)      (mod 2^32)
 *
 * where Q(B) is the same polynomial evaluated with seed 0. So for a target T:
 *
 *   H(prefix + A) * 33^|B|  ==  T - Q(B)   (mod 2^32)
 *
 * We tabulate the left side for every A (one half of the suffix) in an open
 * hash table, then stream every B (the other half) and probe. Cost drops from
 * |alphabet|^L to ~2 * |alphabet|^(L/2).
 *
 * Everything runs on flat typed arrays: a Map<string, number> for the same job
 * costs roughly 40x the memory and is far slower to build.
 *
 * `search()` is a generator that yields progress between blocks so the caller
 * (worker or main-thread fallback) stays responsive and cancellable.
 */

import { hashString, pow33, toHex } from './hash.js';

export const ALPHABETS = {
  hex:             '0123456789ABCDEF',
  hexLower:        '0123456789abcdef',
  digits:          '0123456789',
  upper:           '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  upperUnderscore: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_',
};

export const DEPTHS = {
  fast:     { minLen: 8, maxLen: 8 },
  standard: { minLen: 4, maxLen: 9 },
  thorough: { minLen: 1, maxLen: 10 },
};

/** Max entries per half. 4.2M -> ~85MB peak, safe on mobile Chrome/Safari. */
export const MAX_HALF = 1 << 22;

const GOLDEN = 0x9e3779b1;
const BLOCK = 1 << 16;

/** Integer pow with overflow guard; returns Infinity past MAX_HALF. */
function ipow(base, exp) {
  let r = 1;
  for (let i = 0; i < exp; i++) {
    r *= base;
    if (r > MAX_HALF) return Infinity;
  }
  return r;
}

/** Split length L into halves and report the cost of each side. */
export function planLength(L, m) {
  const la = L >> 1;
  const lb = L - la;
  return { L, la, lb, nA: ipow(m, la), nB: ipow(m, lb) };
}

/**
 * Build every hash of `prefixHash` extended by `len` alphabet characters,
 * in odometer order (first character varies slowest).
 */
function expand(seed, len, codes) {
  const m = codes.length;
  let cur = new Uint32Array(1);
  cur[0] = seed >>> 0;
  for (let p = 0; p < len; p++) {
    const next = new Uint32Array(cur.length * m);
    let k = 0;
    for (let i = 0; i < cur.length; i++) {
      const h = cur[i];
      for (let j = 0; j < m; j++) next[k++] = (Math.imul(h, 33) + codes[j]) >>> 0;
    }
    cur = next;
  }
  return cur;
}

/** Odometer index -> string over the alphabet. */
function decode(index, len, chars) {
  if (len === 0) return '';
  const m = chars.length;
  const out = new Array(len);
  let idx = index;
  for (let p = len - 1; p >= 0; p--) {
    out[p] = chars[idx % m];
    idx = (idx / m) | 0;
  }
  return out.join('');
}

/**
 * @param {object} opts
 * @param {number} opts.target     32-bit target hash
 * @param {string} opts.prefix     literal prefix, e.g. "ID_"
 * @param {string} opts.chars      alphabet used for the suffix
 * @param {number} opts.minLen     min suffix length
 * @param {number} opts.maxLen     max suffix length
 * @param {number} opts.limit      stop after this many hits
 * @yields {{type:'progress', progress:number, found:number}}
 * @returns {{results:string[], skipped:number[], truncated:boolean}}
 */
export function* search({ target, prefix = 'ID_', chars, minLen, maxLen, limit = 100 }) {
  const codes = Array.from(chars, (c) => c.charCodeAt(0));
  const m = codes.length;
  const t = target >>> 0;

  // ---- plan: drop lengths whose halves exceed the memory budget ----------
  const steps = [];
  const skipped = [];
  for (let L = minLen; L <= maxLen; L++) {
    const p = planLength(L, m);
    if (p.nA > MAX_HALF || p.nB > MAX_HALF) skipped.push(L);
    else steps.push(p);
  }

  const totalWork = steps.reduce((s, p) => s + p.nA + p.nB, 0) || 1;
  let done = 0;

  const results = [];
  const seen = new Set();
  let truncated = false;

  const prefixHash = hashString(prefix);

  outer:
  for (const step of steps) {
    const { la, lb, nA, nB } = step;

    // ---- side A: table of H(prefix + A) * 33^|B| -------------------------
    const keys = expand(prefixHash, la, codes);
    const P = pow33(lb);
    for (let i = 0; i < nA; i++) keys[i] = Math.imul(keys[i], P) >>> 0;

    let size = 16;
    while (size < nA * 2) size <<= 1;
    const mask = size - 1;
    const head = new Int32Array(size).fill(-1);
    const next = new Int32Array(nA);
    for (let i = 0; i < nA; i++) {
      const b = (Math.imul(keys[i], GOLDEN) >>> 0) & mask;
      next[i] = head[b];
      head[b] = i;
    }

    done += nA;
    yield { type: 'progress', progress: done / totalWork, found: results.length };

    // ---- side B: stream Q(B) and probe ----------------------------------
    const qs = expand(0, lb, codes);

    for (let start = 0; start < nB; start += BLOCK) {
      const end = Math.min(nB, start + BLOCK);
      for (let i = start; i < end; i++) {
        const need = (t - qs[i]) >>> 0;
        const b = (Math.imul(need, GOLDEN) >>> 0) & mask;
        for (let j = head[b]; j !== -1; j = next[j]) {
          if (keys[j] !== need) continue;
          const candidate = prefix + decode(j, la, chars) + decode(i, lb, chars);
          // Independent verification: guards against any arithmetic slip.
          if (hashString(candidate) !== t) continue;
          if (seen.has(candidate)) continue;
          seen.add(candidate);
          results.push(candidate);
          if (results.length >= limit) {
            truncated = true;
            done = totalWork;
            yield { type: 'progress', progress: 1, found: results.length };
            break outer;
          }
        }
      }
      done += end - start;
      yield { type: 'progress', progress: done / totalWork, found: results.length };
    }
  }

  results.sort((a, b) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0));
  return { results, skipped, truncated, targetHex: toHex(t) };
}

/** Total number of candidate strings a given configuration will touch. */
export function estimateWork(chars, minLen, maxLen) {
  const m = chars.length;
  let work = 0;
  let skipped = 0;
  for (let L = minLen; L <= maxLen; L++) {
    const p = planLength(L, m);
    if (p.nA > MAX_HALF || p.nB > MAX_HALF) skipped++;
    else work += p.nA + p.nB;
  }
  return { work, skipped };
}
