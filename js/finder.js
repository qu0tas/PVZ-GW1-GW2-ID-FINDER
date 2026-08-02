/** ID Finder tab: form handling, worker orchestration, result rendering. */

import { $, el, formatNumber, formatDuration, copyText, toast, urlState, debounce } from './util.js';
import { parseHash, toHex } from './hash.js';
import { ALPHABETS, DEPTHS, estimateWork } from './search-core.js';
import { t, onLangChange } from './i18n.js';
import { prefetchDb } from './database.js';

const form = $('#finderForm');
const input = $('#targetHash');
const errorNode = $('#targetHashError');
const btnSearch = $('#btnSearch');
const btnCancel = $('#btnCancel');
const depthSel = $('#optDepth');
const alphaSel = $('#optAlphabet');
const limitSel = $('#optLimit');
const minLenInput = $('#optMinLen');
const maxLenInput = $('#optMaxLen');
const prefixInput = $('#optPrefix');
const budgetNode = $('#budget');
const progressWrap = $('#progressWrap');
const progressBar = $('#progressBar');
const progressPct = $('#progressPct');
const statusNode = $('#finderStatus');
const resultsHead = $('#resultsHead');
const resultsCount = $('#resultsCount');
const resultsNode = $('#results');
const btnCopyAll = $('#btnCopyAll');

let worker = null;
let fallbackTimer = 0;
let lastResults = [];

// --------------------------------------------------------------------------
// config
// --------------------------------------------------------------------------

function readConfig() {
  const depth = depthSel.value;
  const chars = ALPHABETS[alphaSel.value] || ALPHABETS.hex;
  const preset = DEPTHS[depth];
  const minLen = preset ? preset.minLen : clampLen(minLenInput.value, 1);
  const maxLen = preset ? preset.maxLen : clampLen(maxLenInput.value, 9);
  return {
    chars,
    minLen,
    maxLen,
    limit: Number(limitSel.value) || 30,
    prefix: prefixInput.value ?? '',
  };
}

function clampLen(value, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(12, Math.max(1, n));
}

function syncCustomFields() {
  const isCustom = depthSel.value === 'custom';
  document.querySelectorAll('.opt-custom').forEach((node) => { node.hidden = !isCustom; });
}

function updateBudget() {
  const { chars, minLen, maxLen } = readConfig();
  if (minLen > maxLen) {
    budgetNode.classList.add('over');
    budgetNode.textContent = t('err.badRange');
    return;
  }
  const { work, skipped } = estimateWork(chars, minLen, maxLen);
  let naive = 0;
  for (let L = minLen; L <= maxLen; L++) naive += Math.pow(chars.length, L);
  const base = t('st.budget', {
    work: formatNumber(work),
    naive: naive > 1e15 ? naive.toExponential(1) : formatNumber(naive),
  });
  budgetNode.classList.toggle('over', skipped > 0);
  budgetNode.innerHTML = skipped > 0 ? t('st.budgetSkip', { base }) : base;
}

// --------------------------------------------------------------------------
// status + results
// --------------------------------------------------------------------------

function setStatus(html, kind) {
  statusNode.className = 'status' + (kind ? ` is-${kind}` : '');
  statusNode.innerHTML = html;
}

function setBusy(busy) {
  btnSearch.disabled = busy;
  btnCancel.hidden = !busy;
  progressWrap.hidden = !busy;
  if (!busy) setProgress(0);
}

function setProgress(fraction) {
  const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  progressBar.style.width = `${pct}%`;
  progressPct.textContent = `${pct}%`;
}

function showError(key) {
  errorNode.textContent = t(key);
  errorNode.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

function clearError() {
  errorNode.hidden = true;
  input.removeAttribute('aria-invalid');
}

function renderResults(results, prefix) {
  lastResults = results;
  resultsNode.textContent = '';
  resultsHead.hidden = results.length === 0;
  resultsCount.innerHTML = results.length ? t('finder.found', { count: formatNumber(results.length) }) : '';
  if (!results.length) return;

  const frag = document.createDocumentFragment();
  for (const value of results) {
    const row = el('div', 'row-result');

    const idWrap = el('div', 'id');
    // Prefix in plain text, generated suffix highlighted — all via textContent.
    idWrap.appendChild(document.createTextNode(prefix));
    const strong = el('b', null, value.slice(prefix.length));
    idWrap.appendChild(strong);
    idWrap.appendChild(el('span', 'meta', `${value.length} ch · suffix ${value.length - prefix.length}`));

    const copy = el('button', 'ghost', t('common.copy'));
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      if (await copyText(value)) {
        copy.textContent = t('common.copied');
        copy.classList.add('is-done');
        setTimeout(() => {
          copy.textContent = t('common.copy');
          copy.classList.remove('is-done');
        }, 1400);
      }
    });

    row.append(idWrap, copy);
    frag.appendChild(row);
  }
  resultsNode.appendChild(frag);
}

/** If the target hash is a known asset, say so — that is the answer the user wants. */
async function annotateKnown(hex) {
  for (const game of ['gw1', 'gw2']) {
    try {
      const db = await prefetchDb(game);
      const name = db.byHash.get(hex);
      if (name) {
        const note = el('p', 'status is-ok');
        note.textContent = t('st.known', { game: game.toUpperCase(), name });
        statusNode.after(note);
        setTimeout(() => note.remove(), 30000);
        return;
      }
    } catch { /* database is optional for the finder */ }
  }
}

// --------------------------------------------------------------------------
// search execution
// --------------------------------------------------------------------------

function stopSearch(silent) {
  if (worker) { worker.terminate(); worker = null; }
  if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = 0; }
  setBusy(false);
  if (!silent) setStatus(t('st.cancelled'), 'bad');
}

function finish(payload, prefix) {
  setBusy(false);
  renderResults(payload.results, prefix);
  const time = formatDuration(payload.ms ?? 0);
  let key = 'st.done';
  if (!payload.results.length) key = 'st.doneNone';
  else if (payload.truncated) key = 'st.doneTruncated';
  let html = t(key, { count: formatNumber(payload.results.length), time });
  if (payload.skipped && payload.skipped.length) {
    html += ' ' + t('st.skipped', { lens: payload.skipped.join(', ') });
  }
  setStatus(html, payload.results.length ? 'ok' : 'bad');
}

function createWorker() {
  try {
    return new Worker(new URL('./search-worker.js', import.meta.url), { type: 'module' });
  } catch {
    return null;   // e.g. file:// or a browser without module workers
  }
}

/** Main-thread fallback: drive the same generator in setTimeout slices. */
async function runFallback(payload, prefix) {
  const { search } = await import('./search-core.js');
  const iterator = search(payload);
  const started = performance.now();

  const pump = () => {
    const sliceEnd = performance.now() + 40;   // keep frames under ~50ms
    let step;
    do {
      step = iterator.next();
      if (step.done) {
        finish({ ...step.value, ms: performance.now() - started }, prefix);
        fallbackTimer = 0;
        return;
      }
    } while (performance.now() < sliceEnd);

    setProgress(step.value.progress);
    setStatus(t('st.searching', { found: step.value.found }), 'busy');
    fallbackTimer = setTimeout(pump, 0);
  };

  fallbackTimer = setTimeout(pump, 0);
}

function startSearch() {
  stopSearch(true);
  clearError();

  const parsed = parseHash(input.value);
  if (!parsed.ok) {
    showError(parsed.error);
    input.focus();
    return;
  }

  const config = readConfig();
  if (config.minLen > config.maxLen) {
    showError('err.badRange');
    return;
  }

  const hex = toHex(parsed.value);
  input.value = hex;
  urlState.patch({ tab: 'finder', hash: hex });

  renderResults([], config.prefix);
  setBusy(true);
  setProgress(0);
  setStatus(t('st.searching', { found: 0 }), 'busy');
  annotateKnown(hex);

  const payload = { target: parsed.value, ...config };

  worker = createWorker();
  if (!worker) {
    runFallback(payload, config.prefix);
    return;
  }

  worker.onmessage = (event) => {
    const data = event.data;
    if (data.type === 'progress') {
      setProgress(data.progress);
      setStatus(t('st.searching', { found: data.found }), 'busy');
    } else if (data.type === 'done') {
      finish(data, config.prefix);
      worker.terminate();
      worker = null;
    } else if (data.type === 'error') {
      setBusy(false);
      setStatus(data.message, 'bad');
    }
  };
  worker.onerror = () => {
    // Module workers unavailable at runtime — degrade instead of dying.
    worker.terminate();
    worker = null;
    runFallback(payload, config.prefix);
  };

  worker.postMessage({ cmd: 'search', payload });
}

// --------------------------------------------------------------------------
// wiring
// --------------------------------------------------------------------------

export function initFinder() {
  syncCustomFields();
  updateBudget();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    startSearch();
  });

  btnCancel.addEventListener('click', () => stopSearch(false));

  depthSel.addEventListener('change', () => { syncCustomFields(); updateBudget(); });
  [alphaSel, minLenInput, maxLenInput].forEach((node) => {
    node.addEventListener('input', debounce(updateBudget, 120));
  });

  input.addEventListener('input', clearError);

  btnCopyAll.addEventListener('click', async () => {
    if (!lastResults.length) return;
    if (await copyText(lastResults.join('\n'))) toast(t('common.copied'));
  });

  onLangChange(() => {
    updateBudget();
    renderResults(lastResults, prefixInput.value ?? '');
  });

  // Deep link: ?hash=081816D8 pre-fills and runs the search.
  const { hash } = urlState.read();
  if (hash) {
    input.value = hash;
    const parsed = parseHash(hash);
    if (parsed.ok) startSearch();
  }
}

export function setFinderHash(hex) {
  input.value = hex;
  clearError();
}

export { stopSearch };
