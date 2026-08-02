#!/usr/bin/env node
/**
 * Generates small placeholder databases so the site is runnable before you
 * extract the real ones. Overwritten by tools/extract-db.mjs.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'data'), { recursive: true });

const seedNames = [
  'Peashooter', 'Sunflower', 'Chomper', 'Cactus', 'All-Star', 'Foot Soldier',
  'Engineer', 'Scientist', 'Citron', 'Rose', 'Kernel Corn', 'Imp', 'Super Brainz',
  'Captain Deadbeard', 'Garden Ops', 'Gardens & Graveyards', 'Team Vanquish',
  'Suburbination', 'Taco Bandits', 'Gnome Bomb', 'Weapon Upgrade', 'Ice Pea',
  'Fire Pea', 'Toxic Plant Food', 'Sombrero', 'Bowler', 'Coconut Hat',
  'Vanquish {0:d} {3:s} with the {2:s}', 'Heal {0:d} Teammates', '{0:d}%',
  '{(C)PRESENCE_CONTEXT_GAMEMODE_ROUND_NAME}', 'PLANTS WIN!', 'ZOMBIES WIN!',
  'Short/Mid Range', 'Impact Damage', 'Electric Damage', 'Splash Damage',
  'Continuously generates sundrops, which can heal nearby Plants.',
  'Land {0:d} hits with the {1:s}', 'Revive {0:d} Teammates', 'Respawn',
  'Options', 'Quit', 'Retry', 'Customization', 'Sticker Shop', 'Coins Earned',
];

// Deterministic pseudo-random so repeated runs give identical files.
let seed = 1234567;
const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;

function build(count, suffix) {
  const out = {};
  while (Object.keys(out).length < count) {
    const hash = Math.floor(rnd() * 0xffffffff).toString(16).toUpperCase().padStart(8, '0');
    const base = seedNames[Math.floor(rnd() * seedNames.length)];
    out[hash] = rnd() < 0.25 ? `${base} ${suffix} ${Math.floor(rnd() * 99)}` : base;
  }
  return out;
}

for (const [game, count, suffix] of [['gw1', 640, 'GW1'], ['gw2', 480, 'GW2']]) {
  const path = resolve(root, 'data', `${game}.json`);
  if (existsSync(path) && !process.argv.includes('--force')) {
    console.log(`${game}: already exists, skipped (use --force to overwrite)`);
    continue;
  }
  const data = build(count, suffix);
  writeFileSync(path, JSON.stringify(data));
  console.log(`${game}: ${Object.keys(data).length} sample entries -> data/${game}.json`);
}
