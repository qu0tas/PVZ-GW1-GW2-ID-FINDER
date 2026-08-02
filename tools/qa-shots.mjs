import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const exe = execSync('which chromium || which chromium-browser').toString().trim();
const base = 'http://127.0.0.1:8124';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

async function shot(name, { width, height, url, prepare }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle' });
  if (prepare) await prepare(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/data/shots/${name}.png`, fullPage: true });
  console.log(`${name}: ${errors.length ? 'JS ERRORS -> ' + errors.join(' | ') : 'clean'}`);
  await page.close();
}

const D = { width: 1280, height: 900 };
const M = { width: 390, height: 844 };

await shot('01-finder-desktop', { ...D, url: base });

await shot('02-finder-results', {
  ...D, url: base,
  prepare: async (page) => {
    await page.fill('#targetHash', '081816D8');
    await page.click('#btnSearch');
    await page.waitForSelector('.row-result', { timeout: 15000 });
    await page.waitForTimeout(600);
  },
});

await shot('03-finder-error', {
  ...D, url: base,
  prepare: async (page) => {
    await page.fill('#targetHash', 'ZZZZ');
    await page.click('#btnSearch');
    await page.waitForSelector('#targetHashError:not([hidden])');
  },
});

await shot('04-db-desktop', {
  ...D, url: base,
  prepare: async (page) => {
    await page.click('#tab-db');
    await page.waitForSelector('.db-row', { timeout: 15000 });
  },
});

await shot('05-db-search', {
  ...D, url: base,
  prepare: async (page) => {
    await page.click('#tab-db');
    await page.waitForSelector('.db-row', { timeout: 15000 });
    await page.fill('#dbNameQuery', 'pea');
    await page.waitForTimeout(500);
  },
});

await shot('06-db-empty', {
  ...D, url: base,
  prepare: async (page) => {
    await page.click('#tab-db');
    await page.waitForSelector('.db-row', { timeout: 15000 });
    await page.fill('#dbNameQuery', 'zzzzzznothing');
    await page.waitForSelector('.db-empty');
  },
});

await shot('07-check-en', {
  ...D, url: `${base}/?lang=en`,
  prepare: async (page) => {
    await page.click('#tab-check');
    await page.fill('#checkInput', 'ID_081816D8');
    await page.waitForTimeout(600);
  },
});

await shot('08-finder-custom', {
  ...D, url: base,
  prepare: async (page) => {
    await page.selectOption('#optDepth', 'custom');
    await page.selectOption('#optAlphabet', 'upper');
    await page.waitForTimeout(300);
  },
});

await shot('09-finder-mobile', { ...M, url: base });

await shot('10-db-mobile', {
  ...M, url: base,
  prepare: async (page) => {
    await page.click('#tab-db');
    await page.waitForSelector('.db-row', { timeout: 15000 });
  },
});

await shot('11-results-mobile', {
  ...M, url: base,
  prepare: async (page) => {
    await page.fill('#targetHash', '081816D8');
    await page.click('#btnSearch');
    await page.waitForSelector('.row-result', { timeout: 15000 });
    await page.waitForTimeout(600);
  },
});

await browser.close();
console.log('done');
