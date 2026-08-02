/** Entry point: language, tabs, keyboard shortcuts, lazy module init. */

import { $, $$, urlState, store, copyText, toast } from './util.js';
import { initLang, setLang, applyTranslations, t } from './i18n.js';
import { initFinder, stopSearch } from './finder.js';

const TABS = ['finder', 'db', 'check'];
let dbReady = false;
let checkReady = false;

function activateTab(name, { focus = false } = {}) {
  if (!TABS.includes(name)) name = 'finder';

  $$('.maintabs button').forEach((button) => {
    const active = button.dataset.tab === name;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focus) button.focus();
  });

  $$('.tabpanel').forEach((panel) => {
    const active = panel.id === `panel-${name}`;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  });

  urlState.patch({ tab: name === 'finder' ? null : name });

  // Modules that need the (large) database only initialise on first view.
  if (name === 'db' && !dbReady) {
    dbReady = true;
    import('./db-view.js').then((m) => m.initDbView());
  }
  if (name === 'check' && !checkReady) {
    checkReady = true;
    import('./checker.js').then((m) => m.initChecker());
  }
}

function initTabs() {
  const buttons = $$('.maintabs button');

  buttons.forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
  });

  // WAI-ARIA tab keyboard interaction.
  $('.maintabs').addEventListener('keydown', (event) => {
    const index = buttons.findIndex((b) => b.dataset.tab === currentTab());
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    if (next === -1) return;
    event.preventDefault();
    activateTab(buttons[next].dataset.tab, { focus: true });
  });
}

function currentTab() {
  const active = $('.maintabs button.is-active');
  return active ? active.dataset.tab : 'finder';
}

function initLangToggle() {
  const buttons = $$('.lang-toggle button');
  const sync = (lang) => {
    buttons.forEach((button) => {
      const active = button.dataset.lang === lang;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      setLang(button.dataset.lang);
      sync(button.dataset.lang);
    });
  });
  sync(initLang());
  applyTranslations();
}

function initShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') stopSearch(false);
    // "/" focuses the search field of the active tab, unless already typing.
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (event.key === '/' && !typing) {
      event.preventDefault();
      const map = { finder: '#targetHash', db: '#dbNameQuery', check: '#checkInput' };
      $(map[currentTab()])?.focus();
    }
  });
}

/** Discord handles cannot be linked, so offer one-click copying instead. */
function initFooter() {
  const button = $('#btnDiscord');
  if (!button) return;
  const handle = button.dataset.copy || button.textContent.trim();

  button.addEventListener('click', async () => {
    if (!(await copyText(handle))) return;
    button.classList.add('is-done');
    button.textContent = t('common.copied');
    toast(t('common.copied'));
    setTimeout(() => {
      button.classList.remove('is-done');
      button.textContent = handle;
    }, 1400);
  });
}

function boot() {
  initLangToggle();
  initTabs();
  initFinder();
  initShortcuts();
  initFooter();

  const params = urlState.read();
  activateTab(params.tab || 'finder');

  // Pre-warm the last used database while the browser is idle.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  idle(() => {
    import('./database.js').then((m) => m.prefetchDb(store.get('gwt.game') || 'gw1'));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
