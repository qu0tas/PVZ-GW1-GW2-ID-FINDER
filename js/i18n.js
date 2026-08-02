/**
 * Minimal i18n. All copy lives here — adding a language is one more object.
 *
 * Markup opts in with:
 *   data-i18n="key"                 -> innerHTML (values may contain <code>)
 *   data-i18n-placeholder="key"     -> placeholder attribute
 *   data-i18n-aria-label="key"      -> aria-label attribute
 *   data-i18n-title="key"           -> title attribute
 *
 * Values are authored by us, never by user input, so innerHTML is safe here.
 * Anything derived from the database goes through textContent instead.
 */

import { store, urlState } from './util.js';

export const STRINGS = {
  ru: {
    'a11y.skip': 'Перейти к содержимому',
    'a11y.language': 'Язык',
    'a11y.sections': 'Разделы',
    'a11y.game': 'Игра',
    'a11y.first': 'Первая страница',
    'a11y.prev': 'Предыдущая страница',
    'a11y.next': 'Следующая страница',
    'a11y.last': 'Последняя страница',

    'header.eyebrow': 'Plants vs. Zombies',
    'header.title': 'Garden Warfare Tools',
    'header.subtitle': 'База хешей и подбор ID для GW1 / GW2. Всё считается локально в браузере — ничего никуда не отправляется.',

    'tabs.finder': 'ID Finder',
    'tabs.db': 'База хешей',
    'tabs.check': 'Check String',

    'finder.intro': 'Вставь целевой хеш (например <code>081816D8</code>, с <code>0x</code> или без) — страница подберёт строку вида <code>ID_xxxxxxxx</code>, дающую ровно этот хеш.',
    'finder.target': 'Целевой хеш',
    'finder.search': 'Найти ID',
    'finder.cancel': 'Стоп',
    'finder.depth': 'Глубина',
    'finder.depthAlgebra': 'алгебра (мгновенно)',
    'finder.depthFast': 'быстро (длина 8)',
    'finder.depthStd': 'стандарт (4–9)',
    'finder.depthDeep': 'тщательно (1–10)',
    'finder.depthCustom': 'свои настройки',
    'finder.alphabet': 'Алфавит',
    'finder.limit': 'Максимум',
    'finder.minLen': 'Длина от',
    'finder.maxLen': 'до',
    'finder.prefix': 'Префикс',
    'finder.copyAll': 'Копировать все',
    'finder.found': 'Найдено: <b>{count}</b>',
    'finder.howTitle': 'Как это работает',
    'finder.how1': 'Хеш: <code>h = 0xFFFFFFFF; для каждого байта c строки: h = (h * 33 + c) mod 2^32</code>.',
    'finder.how2': 'Поиск — «встреча посередине» (meet-in-the-middle): суффикс делится пополам, для первой половины строится хеш-таблица, для второй перебираются варианты и ищется совпадение. Стоимость падает с N до корня из N.',
    'finder.how3': '⚠ 32-битный хеш — это множество коллизий. Найденная строка даёт нужный хеш, но почти наверняка не является настоящим оригинальным ID. Если хеш есть в базе GW1/GW2, настоящее значение показывается в статусе поиска.',

    'db.intro': 'Готовая база известных хешей, извлечённая из игры через Frosty Editor. Можно искать по хешу или по названию — как в списке ассетов самого Frosty.',
    'db.byHash': 'Поиск по хешу',
    'db.byName': 'Поиск по названию',
    'db.lenFrom': 'Длина от',
    'db.lenTo': 'Длина до',
    'db.sort': 'Сортировка',
    'db.sortDefault': 'По умолчанию',
    'db.sortLenDesc': 'Сначала длинные',
    'db.sortLenAsc': 'Сначала короткие',
    'db.sortAz': 'По алфавиту A→Z',
    'db.sortZa': 'По алфавиту Z→A',
    'db.sortBraces': 'Сначала с {}',
    'db.perPage': 'На странице',
    'db.colHash': 'Хеш',
    'db.colName': 'Привязано к',
    'db.page': 'стр.',

    'check.intro': 'Введи строку (например <code>ID_081816D8</code>) — страница посчитает её хеш и проверит, привязано ли к нему значение в выбранной базе.',
    'check.input': 'ID / строка',
    'check.hash': 'Хеш',
    'check.value': 'Текущее значение',
    'check.db': 'База',
    'check.idle': 'Ожидание ввода',
    'check.found': 'Найдено в базе',
    'check.missing': 'Нет в базе',

    'common.copy': 'Копировать',
    'common.copied': 'Скопировано',
    'common.loading': 'Загрузка…',

    'footer.note': 'Работает без сервера. Данные баз извлечены из игры через Frosty Editor.',

    'err.empty': 'Введи хеш',
    'err.notHex': 'Только шестнадцатеричные символы: 0–9, A–F',
    'err.tooLong': 'Максимум 8 символов (32 бита)',
    'err.badRange': 'Минимальная длина больше максимальной',
    'err.dbLoad': 'Не удалось загрузить базу. Проверь, что файлы <code>data/gw1.json</code> и <code>data/gw2.json</code> на месте и сайт открыт по http, а не через file://',

    'st.searching': 'Поиск… найдено: {found}',
    'st.algebra': 'Прямое решение: хеш линеен по mod 2³², перебор не нужен. Ответ есть для любого хеша.',
    'st.doneAlgebra': 'Решено алгеброй: {count} вариантов за {time}.',
    'st.doneAlgebraNone': 'Алгебра не нашла вариант только из букв и цифр. Увеличь лимит или используй перебор.',
    'st.doneNone': 'Ничего не найдено за {time}. Попробуй увеличить глубину или сменить алфавит.',
    'st.done': 'Найдено {count} за {time}.',
    'st.doneTruncated': 'Найдено {count} за {time} (достигнут лимит, вариантов больше).',
    'st.skipped': 'Пропущены длины {lens} — слишком большой объём памяти.',
    'st.cancelled': 'Поиск остановлен.',
    'st.known': 'Этот хеш есть в базе {game}: «{name}»',
    'st.budget': 'Перебор: <b>~{work}</b> вариантов половинок (вместо {naive} полного).',
    'st.budgetSkip': '{base} Некоторые длины будут пропущены: слишком большой алфавит для такой длины.',

    'db.stats': 'Записей в базе {game}: <b>{total}</b> · показано: <b>{shown}</b>',
    'db.nothing': 'Ничего не найдено',
    'db.nothingHint': 'Попробуй ослабить фильтры или другой запрос.',
    'db.pageOf': 'стр. <b>{page}</b> из {pages}',
    'db.range': '{from}–{to} из <b>{total}</b>',
  },

  en: {
    'a11y.skip': 'Skip to content',
    'a11y.language': 'Language',
    'a11y.sections': 'Sections',
    'a11y.game': 'Game',
    'a11y.first': 'First page',
    'a11y.prev': 'Previous page',
    'a11y.next': 'Next page',
    'a11y.last': 'Last page',

    'header.eyebrow': 'Plants vs. Zombies',
    'header.title': 'Garden Warfare Tools',
    'header.subtitle': 'Hash database and ID finder for GW1 / GW2. Everything runs locally in your browser — nothing is uploaded.',

    'tabs.finder': 'ID Finder',
    'tabs.db': 'Hash Database',
    'tabs.check': 'Check String',

    'finder.intro': 'Paste a target hash (e.g. <code>081816D8</code>, with or without <code>0x</code>) and the page will find a string like <code>ID_xxxxxxxx</code> that hashes to exactly that value.',
    'finder.target': 'Target hash',
    'finder.search': 'Find ID',
    'finder.cancel': 'Stop',
    'finder.depth': 'Depth',
    'finder.depthAlgebra': 'algebra (instant)',
    'finder.depthFast': 'fast (length 8)',
    'finder.depthStd': 'standard (4–9)',
    'finder.depthDeep': 'thorough (1–10)',
    'finder.depthCustom': 'custom',
    'finder.alphabet': 'Alphabet',
    'finder.limit': 'Max results',
    'finder.minLen': 'Length from',
    'finder.maxLen': 'to',
    'finder.prefix': 'Prefix',
    'finder.copyAll': 'Copy all',
    'finder.found': '<b>{count}</b> found',
    'finder.howTitle': 'How it works',
    'finder.how1': 'Hash: <code>h = 0xFFFFFFFF; for each byte c of the string: h = (h * 33 + c) mod 2^32</code>.',
    'finder.how2': 'The search is meet-in-the-middle: the suffix is split in half, a hash table is built for the first half, the second half is streamed and probed against it. Cost drops from N to the square root of N.',
    'finder.how3': '⚠ A 32-bit hash collides constantly. A found string does produce the target hash, but it is almost certainly not the real original ID. If the hash exists in the GW1/GW2 database, the real value is shown in the search status.',

    'db.intro': 'A prebuilt database of known hashes extracted from the game with Frosty Editor. Search by hash or by the name/text it is bound to — just like the Frosty asset list.',
    'db.byHash': 'Search by hash',
    'db.byName': 'Search by name',
    'db.lenFrom': 'Length from',
    'db.lenTo': 'Length to',
    'db.sort': 'Sort',
    'db.sortDefault': 'Default',
    'db.sortLenDesc': 'Longest first',
    'db.sortLenAsc': 'Shortest first',
    'db.sortAz': 'Alphabetical A→Z',
    'db.sortZa': 'Alphabetical Z→A',
    'db.sortBraces': 'With {} first',
    'db.perPage': 'Per page',
    'db.colHash': 'Hash',
    'db.colName': 'Bound to',
    'db.page': 'page',

    'check.intro': 'Enter a string (e.g. <code>ID_081816D8</code>) — the page computes its hash and checks whether anything in the selected database is bound to it.',
    'check.input': 'ID / string',
    'check.hash': 'Hash',
    'check.value': 'Current value',
    'check.db': 'Database',
    'check.idle': 'Waiting for input',
    'check.found': 'Found in database',
    'check.missing': 'Not in database',

    'common.copy': 'Copy',
    'common.copied': 'Copied',
    'common.loading': 'Loading…',

    'footer.note': 'Serverless. Database contents extracted from the game with Frosty Editor.',

    'err.empty': 'Enter a hash',
    'err.notHex': 'Hexadecimal characters only: 0–9, A–F',
    'err.tooLong': 'Maximum 8 characters (32 bits)',
    'err.badRange': 'Minimum length is greater than maximum',
    'err.dbLoad': 'Could not load the database. Make sure <code>data/gw1.json</code> and <code>data/gw2.json</code> exist and the page is served over http, not file://',

    'st.searching': 'Searching… found: {found}',
    'st.algebra': 'Solved directly: the hash is linear mod 2³², so no brute force is needed. Every target is reachable.',
    'st.doneAlgebra': 'Solved algebraically: {count} results in {time}.',
    'st.doneAlgebraNone': 'No alphanumeric-only solution found. Raise the limit or switch to brute force.',
    'st.doneNone': 'Nothing found in {time}. Try a greater depth or a different alphabet.',
    'st.done': 'Found {count} in {time}.',
    'st.doneTruncated': 'Found {count} in {time} (limit reached, more exist).',
    'st.skipped': 'Skipped lengths {lens} — memory budget exceeded.',
    'st.cancelled': 'Search stopped.',
    'st.known': 'This hash is in the {game} database: “{name}”',
    'st.budget': 'Work: <b>~{work}</b> half-candidates (instead of {naive} for full brute force).',
    'st.budgetSkip': '{base} Some lengths will be skipped: the alphabet is too large for them.',

    'db.stats': '{game} database entries: <b>{total}</b> · shown: <b>{shown}</b>',
    'db.nothing': 'Nothing found',
    'db.nothingHint': 'Try relaxing the filters or a different query.',
    'db.pageOf': 'page <b>{page}</b> of {pages}',
    'db.range': '{from}–{to} of <b>{total}</b>',
  },
};

let current = 'ru';
const listeners = new Set();

/** Translate a key, interpolating {placeholders}. */
export function t(key, vars) {
  const table = STRINGS[current] || STRINGS.ru;
  let value = table[key] ?? STRINGS.ru[key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(replacement);
    }
  }
  return value;
}

export const getLang = () => current;
export const onLangChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    node.innerHTML = t(node.dataset.i18n);
  });
  const attrMap = {
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-aria-label': 'aria-label',
    'data-i18n-title': 'title',
  };
  for (const [dataAttr, realAttr] of Object.entries(attrMap)) {
    root.querySelectorAll(`[${dataAttr}]`).forEach((node) => {
      node.setAttribute(realAttr, t(node.getAttribute(dataAttr)));
    });
  }
}

export function setLang(lang, { persist = true } = {}) {
  if (!STRINGS[lang] || lang === current) return;
  current = lang;
  document.documentElement.lang = lang;
  if (persist) {
    store.set('gwt.lang', lang);
    urlState.patch({ lang });
  }
  applyTranslations();
  listeners.forEach((fn) => fn(lang));
}

/** Resolve the initial language: ?lang= > localStorage > browser > ru. */
export function initLang() {
  const fromUrl = urlState.read().lang;
  const fromStore = store.get('gwt.lang');
  const fromBrowser = (navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const lang = [fromUrl, fromStore, fromBrowser].find((l) => l && STRINGS[l]) || 'ru';
  current = lang === 'ru' ? 'en' : 'ru'; // force setLang to run
  setLang(lang, { persist: false });
  document.documentElement.lang = lang;
  return lang;
}
