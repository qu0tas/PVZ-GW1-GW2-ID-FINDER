/**
 * Algebraic (non-brute-force) inversion of the Frostbite string hash.
 *
 * FsLocalizationStringDatabase.HashStringId is additive with a constant
 * multiplier, so it is not a one-way function at all — it is a linear
 * polynomial over Z/2^32 and can be solved directly.
 *
 * For a prefix P followed by n unknown characters c[0..n-1]:
 *
 *   target = 33^n * H(P) + c[0]*33^(n-1) + c[1]*33^(n-2) + ... + c[n-1]   (mod 2^32)
 *
 * Move the known part to the left:
 *
 *   X = (target - 33^n * H(P))  mod 2^32
 *
 * Each character is written as 65 + d with d in 0..32, so subtract the
 * baseline that all those 65s contribute:
 *
 *   G = 33^0 + 33^1 + ... + 33^(n-1) = (33^n - 1) / 32
 *   D = (X - 65 * G)  mod 2^32
 *
 * What remains is exactly the base-33 expansion of D:
 *
 *   D = d[0]*33^(n-1) + ... + d[n-1],  with every d in 0..32
 *
 * With n = 7, 33^7 = 42 618 442 977 > 2^32, so every target is reachable.
 *
 * One subtlety worth exploiting: D is only known modulo 2^32, and any
 * D + k*2^32 that still fits in 7 base-33 digits is an equally valid
 * solution. That gives up to 10 distinct answers per prefix for free
 * (floor((33^7 - 1) / 2^32) = 9), which is why this module returns a list.
 *
 * All arithmetic below stays under 2^53, so plain Numbers are exact.
 */

import { HASH_SEED, HASH_MULT, hashString, pow33 } from './hash.js';

const TWO32 = 4294967296;

/** Character code for base-33 digit d: 0 -> 'A' (65), 32 -> 'a' (97). */
export const DIGIT_BASE = 65;
export const DIGIT_COUNT = 33;

/** Default suffix length: the smallest n with 33^n > 2^32. */
export const DEFAULT_N = 7;

/** Characters that fall inside 65..97 but are not letters or digits. */
const NON_ALNUM = /[^0-9A-Za-z]/;

/** Exact (non-modular) 33^n as a Number. Safe up to n = 10 (< 2^53). */
function pow33Exact(n) {
  let r = 1;
  for (let i = 0; i < n; i++) r *= HASH_MULT;
  return r;
}

/** G = (33^n - 1) / 32, reduced mod 2^32. */
function geometricSum(n) {
  let g = 0;
  for (let i = 0; i < n; i++) g = (g + pow33(i)) >>> 0;
  return g >>> 0;
}

/**
 * Solve for the n characters that must follow `prefix` to reach `target`.
 *
 * @param {number} target      32-bit target hash
 * @param {string} prefix      known leading text, e.g. "ID_"
 * @param {number} n           number of unknown characters (7 covers everything)
 * @param {boolean} alnumOnly  drop solutions containing [ \ ] ^ _ `
 * @returns {string[]} full strings (prefix included), verified against the hash
 */
export function solveSuffix(target, prefix, n = DEFAULT_N, alnumOnly = true) {
  if (n < 1 || n > 10) return [];

  const prefixHash = hashString(prefix);
  const X = (target - Math.imul(pow33(n), prefixHash)) >>> 0;
  const D0 = (X - Math.imul(DIGIT_BASE, geometricSum(n))) >>> 0;

  const capacity = pow33Exact(n);          // exclusive upper bound for n digits
  const out = [];

  // Every lift D0 + k*2^32 that still fits in n base-33 digits is a solution.
  for (let k = 0; D0 + k * TWO32 < capacity; k++) {
    let value = D0 + k * TWO32;

    const chars = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      chars[i] = String.fromCharCode(DIGIT_BASE + (value % DIGIT_COUNT));
      value = Math.floor(value / DIGIT_COUNT);
    }

    const suffix = chars.join('');
    if (alnumOnly && NON_ALNUM.test(suffix)) continue;

    const candidate = prefix + suffix;
    // Never trust the algebra: confirm with the real hash function.
    if (hashString(candidate) === (target >>> 0)) out.push(candidate);
  }

  return out;
}

/** Filler characters inserted between the prefix and the solved tail. */
const FILLERS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_';

/**
 * Produce many distinct solutions by padding the prefix with filler characters
 * and re-solving the tail each time.
 *
 * @param {object} options
 * @param {number} options.target     32-bit target hash
 * @param {string} options.prefix     e.g. "ID_"
 * @param {number} [options.n]        solved tail length (default 7)
 * @param {number} [options.limit]    maximum number of results
 * @param {boolean} [options.alnumOnly]
 * @param {number} [options.maxPad]   how many filler characters to try appending
 * @returns {{ results: string[], exhausted: boolean }}
 */
export function solveMany({
  target,
  prefix = 'ID_',
  n = DEFAULT_N,
  limit = 30,
  alnumOnly = true,
  maxPad = 2,
}) {
  const seen = new Set();
  const results = [];

  const push = (list) => {
    for (const value of list) {
      if (seen.has(value)) continue;
      seen.add(value);
      results.push(value);
      if (results.length >= limit) return true;
    }
    return false;
  };

  // Pad level 0: the plain prefix.
  if (push(solveSuffix(target, prefix, n, alnumOnly))) {
    return { results, exhausted: false };
  }

  // Pad level 1..maxPad: prefix + filler(s), tail re-solved.
  let level = [''];
  for (let depth = 1; depth <= maxPad; depth++) {
    const next = [];
    for (const pad of level) {
      for (const ch of FILLERS) {
        const padded = pad + ch;
        next.push(padded);
        if (push(solveSuffix(target, prefix + padded, n, alnumOnly))) {
          return { results, exhausted: false };
        }
      }
    }
    level = next;
  }

  return { results, exhausted: true };
}
