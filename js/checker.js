/** Check String tab: live hashing + database lookup. */

import { $, debounce, copyText, toast } from './util.js';
import { hashString, toHex } from './hash.js';
import { loadDb } from './database.js';
import { t, onLangChange } from './i18n.js';

const inputNode = $('#checkInput');
const hashNode = $('#checkHash');
const valueNode = $('#checkValue');
const gameSel = $('#checkGame');
const statusNode = $('#checkStatus');
const copyButton = $('#btnCopyHash');

function setStatus(kind, key) {
  statusNode.className = 'check-status' + (kind ? ` is-${kind}` : '');
  statusNode.textContent = '';
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = t(key);
  statusNode.append(dot, label);
}

async function update() {
  const raw = inputNode.value;
  if (!raw) {
    hashNode.value = '\u2014';
    valueNode.value = '\u2014';
    setStatus('', 'check.idle');
    return;
  }

  const hex = toHex(hashString(raw));
  hashNode.value = hex;

  try {
    const db = await loadDb(gameSel.value);
    // Guard against a stale response after fast typing.
    if (toHex(hashString(inputNode.value)) !== hex) return;
    const name = db.byHash.get(hex);
    if (name != null) {
      valueNode.value = name;
      setStatus('found', 'check.found');
    } else {
      valueNode.value = '\u2014';
      setStatus('missing', 'check.missing');
    }
  } catch {
    valueNode.value = '\u2014';
    statusNode.className = 'check-status is-missing';
    statusNode.textContent = t('err.dbLoad').replace(/<[^>]+>/g, '');
  }
}

let initialised = false;

export function initChecker() {
  if (initialised) return;
  initialised = true;

  inputNode.addEventListener('input', debounce(update, 150));
  gameSel.addEventListener('change', update);
  copyButton.addEventListener('click', async () => {
    if (hashNode.value && hashNode.value !== '\u2014' && await copyText(hashNode.value)) {
      toast(t('common.copied'));
    }
  });
  onLangChange(update);
  update();
}

export function setCheckerInput(value) {
  inputNode.value = value;
  update();
}
