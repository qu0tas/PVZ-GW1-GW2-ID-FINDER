/**
 * Hash database access.
 *
 * The two databases are fetched lazily, once each, only when a view actually
 * needs them. This is the single biggest load-time win over the old build,
 * where both databases were inlined into index.html and had to be parsed
 * before the first paint — even for users who only ever used the ID Finder.
 */

const cache = new Map();   // game -> Promise<Db>

/**
 * @typedef {{ hash:string, name:string, nameLower:string, len:number, braces:boolean }} Entry
 * @typedef {{ game:string, entries:Entry[], byHash:Map<string,string> }} Db
 */

/** @returns {Promise<Db>} */
export function loadDb(game) {
  if (cache.has(game)) return cache.get(game);

  const promise = fetch(`data/${game}.json`, { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((raw) => {
      const entries = [];
      const byHash = new Map();
      for (const hash in raw) {
        const name = raw[hash];
        const key = hash.toUpperCase();
        byHash.set(key, name);
        entries.push({
          hash: key,
          name,
          // Precomputed once instead of lowercasing on every keystroke.
          nameLower: name.toLowerCase(),
          len: name.length,
          braces: name.includes('{'),
        });
      }
      // JSON.parse gives an object, and JS objects do NOT preserve key order:
      // keys that look like array indices ("10067901") are enumerated first, in
      // numeric order, before the rest. That silently reordered the table so it
      // started at 1xxxxxxx instead of 000xxxxx. Sort explicitly.
      entries.sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
      return { game, entries, byHash };
    })
    .catch((error) => {
      cache.delete(game);          // allow a retry on the next interaction
      throw error;
    });

  cache.set(game, promise);
  return promise;
}

/** Non-blocking lookup: returns a name only if that database is already loaded. */
export function peekName(game, hexHash) {
  const pending = cache.get(game);
  if (!pending || !pending.settledValue) return null;
  return pending.settledValue.byHash.get(hexHash.toUpperCase()) ?? null;
}

/** Warm a database in the background and remember the resolved value. */
export function prefetchDb(game) {
  const promise = loadDb(game);
  if (!promise.settledValue) {
    promise.then((db) => { promise.settledValue = db; }).catch(() => {});
  }
  return promise;
}

/** Apply query + filters + sort. Returns a new array (never mutates input). */
export function filterEntries(entries, { hashQuery, nameQuery, lenMin, lenMax, sort }) {
  const hq = (hashQuery || '').trim().replace(/^#/, '').replace(/^0x/i, '').toUpperCase();
  const nq = (nameQuery || '').trim().toLowerCase();
  const min = Number.isFinite(lenMin) ? lenMin : -Infinity;
  const max = Number.isFinite(lenMax) ? lenMax : Infinity;

  let out = entries;

  if (hq || nq || min > -Infinity || max < Infinity) {
    out = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.len < min || e.len > max) continue;
      if (hq && e.hash.indexOf(hq) === -1) continue;
      if (nq && e.nameLower.indexOf(nq) === -1) continue;
      out.push(e);
    }
  }

  if (sort && sort !== 'default') {
    out = out.slice();
    const byName = (a, b) => (a.nameLower < b.nameLower ? -1 : a.nameLower > b.nameLower ? 1 : 0);
    const comparators = {
      lenDesc: (a, b) => b.len - a.len || byName(a, b),
      lenAsc:  (a, b) => a.len - b.len || byName(a, b),
      az:      byName,
      za:      (a, b) => -byName(a, b),
      braces:  (a, b) => (b.braces - a.braces) || byName(a, b),
    };
    out.sort(comparators[sort] || (() => 0));
  }

  return out;
}
