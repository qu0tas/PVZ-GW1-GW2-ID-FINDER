/** Hash Database tab: lazy load, debounced filtering, paginated rendering. */

import { $, el, debounce, formatNumber, copyText, toast, urlState, store, appendHighlighted } from './util.js';
import { loadDb, filterEntries } from './database.js';
import { t, onLangChange } from './i18n.js';

const countNode = $('#dbCount');
const hashInput = $('#dbHashQuery');
const nameInput = $('#dbNameQuery');
const lenMinInput = $('#dbLenMin');
const lenMaxInput = $('#dbLenMax');
const sortSel = $('#dbSort');
const perPageSel = $('#dbPerPage');
const bodyNode = $('#dbBody');
const pagination = $('#dbPagination');
const pgInfo = $('#pgInfo');
const pgNum = $('#pgNum');
const pgJump = $('#pgJump');

const state = {
  game: 'gw1',
  page: 1,
  db: null,
  filtered: [],
  loading: false,
};

const num = (node) => {
  const n = parseInt(node.value, 10);
  return Number.isFinite(n) ? n : NaN;
};

// --------------------------------------------------------------------------
// rendering
// --------------------------------------------------------------------------

function renderEmpty(message, hint) {
  bodyNode.textContent = '';
  const box = el('div', 'db-empty');
  box.appendChild(el('b', null, message));
  if (hint) {
    box.appendChild(document.createElement('br'));
    box.appendChild(document.createTextNode(hint));
  }
  bodyNode.appendChild(box);
  pagination.hidden = true;
}

function renderPage() {
  const perPage = Number(perPageSel.value) || 100;
  const total = state.filtered.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  state.page = Math.min(Math.max(1, state.page), pages);

  countNode.innerHTML = t('db.stats', {
    game: state.game.toUpperCase(),
    total: formatNumber(state.db ? state.db.entries.length : 0),
    shown: formatNumber(total),
  });

  if (!total) {
    renderEmpty(t('db.nothing'), t('db.nothingHint'));
    return;
  }

  const from = (state.page - 1) * perPage;
  const to = Math.min(total, from + perPage);
  const hashNeedle = hashInput.value.trim().replace(/^#/, '').replace(/^0x/i, '').toUpperCase();
  const nameNeedle = nameInput.value.trim();

  // One fragment, one reflow — instead of innerHTML += in a loop.
  const frag = document.createDocumentFragment();
  for (let i = from; i < to; i++) {
    const entry = state.filtered[i];
    const row = el('div', 'db-row');
    row.setAttribute('role', 'listitem');

    const hashCell = el('span', 'col-hash');
    hashCell.tabIndex = 0;
    hashCell.title = t('common.copy');
    appendHighlighted(hashCell, entry.hash, hashNeedle);
    const copyHash = async () => {
      if (await copyText(entry.hash)) toast(t('common.copied'));
    };
    hashCell.addEventListener('click', copyHash);
    hashCell.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); copyHash(); }
    });

    const nameCell = el('span', 'col-name');
    appendHighlighted(nameCell, entry.name, nameNeedle);

    row.append(hashCell, nameCell);
    frag.appendChild(row);
  }
  bodyNode.textContent = '';
  bodyNode.appendChild(frag);
  bodyNode.scrollTop = 0;

  pagination.hidden = pages <= 1 && total <= perPage;
  pgInfo.innerHTML = t('db.range', {
    from: formatNumber(from + 1),
    to: formatNumber(to),
    total: formatNumber(total),
  });
  pgNum.innerHTML = t('db.pageOf', { page: formatNumber(state.page), pages: formatNumber(pages) });
  pgJump.max = String(pages);
  pgJump.value = String(state.page);
  $('#pgFirst').disabled = $('#pgPrev').disabled = state.page <= 1;
  $('#pgNext').disabled = $('#pgLast').disabled = state.page >= pages;
}

function applyFilters(resetPage = true) {
  if (!state.db) return;
  if (resetPage) state.page = 1;
  state.filtered = filterEntries(state.db.entries, {
    hashQuery: hashInput.value,
    nameQuery: nameInput.value,
    lenMin: num(lenMinInput),
    lenMax: num(lenMaxInput),
    sort: sortSel.value,
  });
  renderPage();
  urlState.patch({
    q: nameInput.value.trim() || null,
    h: hashInput.value.trim() || null,
  });
}

const applyFiltersDebounced = debounce(() => applyFilters(true), 180);

// --------------------------------------------------------------------------
// loading
// --------------------------------------------------------------------------

export async function selectGame(game, { rerender = true } = {}) {
  state.game = game;
  store.set('gwt.game', game);
  urlState.patch({ game });

  document.querySelectorAll('[data-game]').forEach((button) => {
    const active = button.dataset.game === game;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  if (state.loading) return;
  state.loading = true;
  countNode.textContent = t('common.loading');
  renderEmpty(t('common.loading'));

  try {
    state.db = await loadDb(game);
    if (rerender) applyFilters(true);
  } catch {
    state.db = null;
    state.filtered = [];
    countNode.innerHTML = t('err.dbLoad');
    renderEmpty(t('db.nothing'));
  } finally {
    state.loading = false;
  }
}

let initialised = false;

/** Called the first time the Hash DB tab becomes visible. */
export function initDbView() {
  if (initialised) return;
  initialised = true;

  const params = urlState.read();
  if (params.q) nameInput.value = params.q;
  if (params.h) hashInput.value = params.h;

  [hashInput, nameInput].forEach((node) => node.addEventListener('input', applyFiltersDebounced));
  [lenMinInput, lenMaxInput].forEach((node) => node.addEventListener('input', applyFiltersDebounced));
  [sortSel, perPageSel].forEach((node) => node.addEventListener('change', () => applyFilters(true)));

  document.querySelectorAll('[data-game]').forEach((button) => {
    button.addEventListener('click', () => selectGame(button.dataset.game));
  });

  const go = (page) => { state.page = page; renderPage(); };
  $('#pgFirst').addEventListener('click', () => go(1));
  $('#pgPrev').addEventListener('click', () => go(state.page - 1));
  $('#pgNext').addEventListener('click', () => go(state.page + 1));
  $('#pgLast').addEventListener('click', () => go(Number.MAX_SAFE_INTEGER));
  pgJump.addEventListener('change', () => go(parseInt(pgJump.value, 10) || 1));

  onLangChange(() => { if (state.db) renderPage(); });

  const initialGame = params.game || store.get('gwt.game') || 'gw1';
  selectGame(initialGame === 'gw2' ? 'gw2' : 'gw1');
}
