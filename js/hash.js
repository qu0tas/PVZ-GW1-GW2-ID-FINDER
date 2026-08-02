/**
 * PvZ Garden Warfare 1/2 string hash.
 *
 *   h = 0xFFFFFFFF
 *   for each BYTE c of the string:  h = (h * 33 + c) mod 2^32
 *
 * Two details the naive implementation gets wrong:
 *
 *  1. `h * 33` overflows IEEE-754's exact integer range (2^53) once h is
 *     32-bit, so plain multiplication silently loses low bits. `Math.imul`
 *     performs a true 32-bit multiply and is the only correct primitive here.
 *  2. The game hashes BYTES, not UTF-16 code units. `charCodeAt` diverges from
 *     the game for any non-ASCII input, so we encode to UTF-8 first.
 */

export const HASH_SEED = 0xffffffff;
export const HASH_MULT = 33;

const encoder = new TextEncoder();

/** Hash an array of byte values (0-255). */
export function hashBytes(bytes, seed = HASH_SEED) {
  let h = seed >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h = (Math.imul(h, HASH_MULT) + bytes[i]) >>> 0;
  }
  return h >>> 0;
}

/** Hash a JS string (encoded as UTF-8, matching the game). */
export function hashString(str, seed = HASH_SEED) {
  return hashBytes(encoder.encode(str), seed);
}

/** 33^n mod 2^32 — needed by the meet-in-the-middle split. */
export function pow33(n) {
  let r = 1;
  for (let i = 0; i < n; i++) r = Math.imul(r, HASH_MULT) >>> 0;
  return r >>> 0;
}

/** 32-bit value -> canonical 8-char uppercase hex. */
export function toHex(value) {
  return (value >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Parse user input into a 32-bit hash.
 * Accepts `081816D8`, `0x081816D8`, `#081816d8`, with surrounding whitespace.
 * Returns { ok, value } or { ok:false, error } where error is an i18n key.
 */
export function parseHash(input) {
  let s = String(input ?? '').trim();
  if (!s) return { ok: false, error: 'err.empty' };
  s = s.replace(/^#/, '').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]+$/.test(s)) return { ok: false, error: 'err.notHex' };
  if (s.length > 8) return { ok: false, error: 'err.tooLong' };
  return { ok: true, value: parseInt(s, 16) >>> 0 };
}
