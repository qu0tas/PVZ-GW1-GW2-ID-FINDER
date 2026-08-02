/** Tiny DOM + misc helpers. No framework, no dependencies. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Trailing-edge debounce. */
export function debounce(fn, wait = 180) {
  let timer = 0;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/** 1234567 -> "1 234 567" */
export function formatNumber(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
}

export function formatDuration(ms) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Clipboard with a graceful fallback for non-secure contexts. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

let toastTimer = 0;
export function toast(message) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 1800);
}

/**
 * Append `text` to `parent`, wrapping every case-insensitive occurrence of
 * `needle` in <mark>. Uses textContent throughout — database values contain
 * quotes, braces and angle brackets, so innerHTML here would be an XSS hole.
 */
export function appendHighlighted(parent, text, needle) {
  if (!needle) {
    parent.textContent = text;
    return;
  }
  const haystack = text.toLowerCase();
  const target = needle.toLowerCase();
  let from = 0;
  let at = haystack.indexOf(target);
  if (at === -1) {
    parent.textContent = text;
    return;
  }
  const frag = document.createDocumentFragment();
  while (at !== -1) {
    if (at > from) frag.appendChild(document.createTextNode(text.slice(from, at)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(at, at + target.length);
    frag.appendChild(mark);
    from = at + target.length;
    at = haystack.indexOf(target, from);
  }
  if (from < text.length) frag.appendChild(document.createTextNode(text.slice(from)));
  parent.appendChild(frag);
}

/** localStorage that never throws (private mode, disabled storage, quota). */
export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
};

/** Shallow URL query-string state, so any view can be shared as a link. */
export const urlState = {
  read() {
    return Object.fromEntries(new URLSearchParams(location.search));
  },
  patch(changes) {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === undefined || value === '') params.delete(key);
      else params.set(key, String(value));
    }
    const qs = params.toString();
    history.replaceState(null, '', qs ? `?${qs}${location.hash}` : location.pathname + location.hash);
  },
};
