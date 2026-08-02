<div align="center">

<img src="assets/favicon.svg" width="72" height="72" alt="">

# PVZ GW1 / GW2 ID Finder

**Reverse a 32-bit Garden Warfare string hash back into a real string — and browse the full GW1/GW2 hash database.**

No backend. No build step. No dependencies. Everything runs in your browser.

[![Pages](https://img.shields.io/badge/GitHub_Pages-ready-4be38a?style=flat-square)](#-deploy-to-github-pages)
[![Deps](https://img.shields.io/badge/dependencies-0-4be38a?style=flat-square)](#)
[![Tests](https://img.shields.io/badge/self--test-30_passing-4be38a?style=flat-square)](#-testing)
[![Data](https://img.shields.io/badge/hashes-31%2C486-38c6ff?style=flat-square)](#-the-databases)
[![License](https://img.shields.io/badge/license-MIT-38c6ff?style=flat-square)](LICENSE)

by **Azzinnox (qu0tas)**

</div>

---

## Contents

- [What it does](#-what-it-does)
- [Quick start](#-quick-start)
- [Deploy to GitHub Pages](#-deploy-to-github-pages)
- [The databases](#-the-databases)
- [The hash](#-the-hash)
- [The search](#-the-search)
- [Collisions — read this](#-collisions--read-this)
- [Project layout](#-project-layout)
- [Testing](#-testing)
- [Shortcuts and URLs](#-shortcuts-and-urls)
- [Browser support](#-browser-support)
- [License](#-license)

---

## ✨ What it does

| Tab | What it is for |
| :-- | :-- |
| **ID Finder** | You have a hash like `081816D8` and need a string that produces it. Finds `ID_xxxxxxxx` in milliseconds. |
| **Hash Database** | 31 486 known hashes pulled out of GW1 and GW2 with Frosty Editor. Search by hash, by bound text, filter by length, sort, paginate. |
| **Check String** | The other direction: type any string, get its hash instantly and see whether the game already binds something to it. |

Russian and English, switchable at any time. Language, game, tab and query survive a reload and travel in the URL.

---

## 🚀 Quick start

```bash
git clone https://github.com/qu0tas/PVZ-GW1-GW2-ID-FINDER.git
cd PVZ-GW1-GW2-ID-FINDER
python3 -m http.server 8080
# open http://localhost:8080
```

> [!IMPORTANT]
> Opening `index.html` directly as a `file://` path will **not** work. ES modules, Web Workers and `fetch()` all require a real `http://` origin. Any static server does the job — `python3 -m http.server`, `npx serve`, VS Code Live Server.

---

## 🌐 Deploy to GitHub Pages

Everything in this repository is static, so Pages hosts it as-is — no Actions, no build, no configuration.

1. Push the folder to your repository.
2. **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Wait about a minute. Done.

`.nojekyll` is already committed, so Pages serves every file verbatim instead of running it through Jekyll.

> [!NOTE]
> `data/gw2.json` is ~964 KB. That is far below the 100 MB per-file limit and the 1 GB repository limit, and it is fetched only when the Hash Database tab is opened — and cached afterwards. GitHub serves it gzipped, so the real transfer is roughly 200 KB.

---

## 🗂 The databases

| File | Entries | Size |
| :-- | --: | --: |
| `data/gw1.json` | 8 062 | 353 KB |
| `data/gw2.json` | 23 424 | 964 KB |

Format is deliberately boring — hash to bound value, sorted by hash so diffs stay readable:

```json
{
  "081816D8": "{(C)PRESENCE_CONTEXT_GAMEMODE_ROUND_NAME}",
  "0815FE6E": "Law Pea"
}
```

### Updating them

From a fresh Frosty CSV dump (UTF-16 or UTF-8, with or without BOM, RFC-4180 quoting):

```bash
node tools/import-csv.mjs GW1HASH.csv GW2HASH.csv
```

From an old single-file build that still has the databases inlined in `index.html`:

```bash
node tools/extract-db.mjs path/to/old-index.html
```

Both normalise hashes to 8 uppercase hex digits, drop malformed rows, merge duplicates and report what they did.

---

## 🧮 The hash

Garden Warfare uses a plain DJB2-style rolling hash seeded with `0xFFFFFFFF`:

```
h = 0xFFFFFFFF
for each BYTE c of the string:
    h = (h * 33 + c) mod 2^32
```

Two traps that silently produce wrong answers in JavaScript:

> [!WARNING]
> **`h * 33` is not safe.** Once `h` is a full 32-bit value the product exceeds `2^53`, and a JS double quietly drops the low bits. `Math.imul(h, 33)` is a real 32-bit multiply and is the only correct primitive here.

> [!WARNING]
> **Hash bytes, not characters.** `charCodeAt` returns UTF-16 code units and diverges from the game on anything non-ASCII. `TextEncoder` gives the actual UTF-8 bytes the engine sees.

Both are verified against a `BigInt` reference implementation in the self-test.

---

## ⚡ The search

The hash is a linear polynomial over `ℤ/2³²`, which means it splits. For a suffix cut into halves `A` and `B`:

```
H(prefix + A + B) = H(prefix + A) · 33^|B| + Q(B)   (mod 2³²)
```

where `Q` is the same polynomial seeded with 0. Rearranged for a target `T`:

```
H(prefix + A) · 33^|B|  ≡  T − Q(B)   (mod 2³²)
```

So: tabulate the left side for every `A` once, then stream every `B` and probe. That is **meet-in-the-middle**, and it turns `|alphabet|^L` into roughly `2 · |alphabet|^(L/2)`.

For hex suffixes of length 8 that is **131 072 candidates instead of 4 294 967 296** — about 30 ms.

Implementation notes:

- The table is an open hash table over flat `Uint32Array` / `Int32Array` buffers with chaining, not a JS object with string keys. No GC pressure, no rehashing, duplicate keys handled correctly.
- Halves are generated iteratively in odometer order, never recursively.
- The whole thing runs in a **Web Worker**, so the page stays responsive and **Stop** actually stops.
- Progress is real, reported from the worker roughly 20× per second.
- Lengths whose halves would blow the memory budget (`MAX_HALF = 2²²`) are skipped and named in the status line rather than freezing the tab.
- **Every hit is re-verified** with the full hash function before it is displayed. An arithmetic mistake can never produce a wrong result — only a missing one.

| Preset | Lengths | Candidates | Time |
| :-- | :-- | --: | --: |
| fast | 8 | 131 072 | ~30 ms |
| standard | 4–9 | 1 327 872 | ~50 ms |
| thorough | 1–10 | 3 425 345 | ~70 ms |

---

## ⚠ Collisions — read this

A 32-bit hash has only 4.3 billion possible outputs, so collisions are not an edge case, they are the norm. A typical target has **dozens** of `ID_` preimages.

Every string the finder returns genuinely hashes to your target. But it is almost certainly **not** the original string the developers wrote.

That is why, when your target hash exists in the GW1/GW2 database, the real bound value is shown **above** the results. That line is usually the answer you actually wanted; the generated `ID_` strings are only useful when nothing is bound.

---

## 📁 Project layout

```
index.html               markup only — no styles, no logic, no data
css/style.css            all styling, one file
js/
  hash.js                the hash function (Math.imul + UTF-8 bytes)
  search-core.js         meet-in-the-middle search — pure, no DOM, testable
  search-worker.js       runs search-core off the main thread
  database.js            lazy loading, filtering, sorting
  finder.js              ID Finder tab
  db-view.js             Hash Database tab
  checker.js             Check String tab
  i18n.js                every UI string, RU + EN
  util.js                DOM, clipboard, URL-state helpers
  main.js                bootstrap, tabs, keyboard, persistence
data/                    gw1.json, gw2.json
tools/
  import-csv.mjs         Frosty CSV -> data/*.json
  extract-db.mjs         old inlined index.html -> data/*.json
  selftest.mjs           correctness + timing
  make-sample-data.mjs   placeholder data for development
  qa-shots.mjs           headless screenshots of every screen
```

Nothing imports anything it does not need, and `search-core.js` has no DOM dependency at all — which is exactly why it can be tested in Node and reused in a worker.

---

## 🧪 Testing

```bash
node tools/selftest.mjs
```

30 assertions: the hash against a `BigInt` reference (including empty strings, 300-character strings and Cyrillic), `pow33`, input parsing, round-trip inversion, the `length = 1` edge case where one half is empty, odd-length splits, empty prefixes, larger alphabets, result limits, and memory-budget skipping. Every returned candidate is re-hashed and checked.

```bash
node tools/qa-shots.mjs   # needs a local server on :8124 and Playwright
```

Renders 11 screens at 1280 px and 390 px and fails loudly on any console error.

---

## ⌨ Shortcuts and URLs

| Key | Action |
| :-- | :-- |
| `/` | Focus the search field of the current tab |
| `Esc` | Stop a running search |
| `←` `→` `Home` `End` | Move between tabs |

State lives in the query string, so any view is shareable:

```
?tab=finder&hash=081816D8
?tab=db&game=gw2&q=peashooter
?lang=en
```

---

## 🌐 Browser support

Chrome, Edge, Firefox and Safari, desktop and mobile. Requires ES modules, `Math.imul`, `TextEncoder` and module Web Workers — everything shipped by 2023. If workers are unavailable the search transparently falls back to time-sliced execution on the main thread.

Fully responsive: single-column layout on phones, 44 px touch targets, safe-area insets for notched screens, no zoom-on-focus, and `prefers-reduced-motion` respected.

---

## 📄 License

[MIT](LICENSE) for the code.

Database contents are extracted from *Plants vs. Zombies: Garden Warfare* and belong to PopCap Games / Electronic Arts. This project is not affiliated with or endorsed by them.
