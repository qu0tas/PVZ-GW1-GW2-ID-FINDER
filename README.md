<div align="center">

<img src="assets/favicon.svg" width="72" height="72" alt="">

# PVZ GW1 / GW2 ID Finder

**English** · [Русский](README.ru.md)

**Reverse a 32-bit Garden Warfare string hash back into a real string — and browse the full GW1/GW2 hash database.**

No backend. No build step. No dependencies. Everything runs in your browser.

[![Pages](https://img.shields.io/badge/GitHub_Pages-ready-4be38a?style=flat-square)](#-deploy-to-github-pages)
[![Deps](https://img.shields.io/badge/dependencies-0-4be38a?style=flat-square)](#)
[![Tests](https://img.shields.io/badge/self--test-passing-4be38a?style=flat-square)](#-testing)
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
- [Inverting the hash](#-inverting-the-hash)
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
| **ID Finder** | You have a hash like `081816D8` and need a string that produces it. Solved instantly by algebra. |
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

> [!TIP]
> The table is sorted explicitly at load time rather than trusting key order. JavaScript enumerates integer-like object keys (`"10067901"`) first, in numeric order, before every other key — which is why an unsorted build appears to start in the middle of the alphabet.

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

Garden Warfare uses a plain DJB2-style rolling hash seeded with `0xFFFFFFFF`
(`FsLocalizationStringDatabase.HashStringId`):

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

## ⚡ Inverting the hash

This hash is **not** a one-way function. It is a linear polynomial over `ℤ/2³²`, so it can be solved directly. Two modes are available.

### Algebra — the default, and the one you want

For a prefix `P` followed by `n` unknown characters:

```
target = 33ⁿ · H(P) + c₀·33ⁿ⁻¹ + c₁·33ⁿ⁻² + … + cₙ₋₁   (mod 2³²)
```

Move the known part across, then subtract the baseline that all the characters contribute (each is written as `65 + d`, with `d` in `0…32`):

```
X = (target − 33ⁿ · H(P))            mod 2³²
G = 33⁰ + 33¹ + … + 33ⁿ⁻¹ = (33ⁿ − 1) / 32
D = (X − 65·G)                       mod 2³²
```

What is left is exactly the base-33 expansion of `D`. Read off `n` digits, map each to `65 + d`, done — no searching at all.

With `n = 7`, `33⁷ = 42 618 442 977 > 2³²`, so **every possible target is reachable**.

One detail worth exploiting: `D` is only known modulo `2³²`, and any `D + k·2³²` that still fits in 7 base-33 digits is an equally valid answer. Since `33⁷` is 9.9× larger than `2³²`, that yields up to **10 distinct solutions per prefix for free**. More are produced by padding the prefix (`ID_A`, `ID_B`, …) and re-solving.

**1000 full solves take ~66 ms**, producing 30–40 results each.

### Meet-in-the-middle — for a specific alphabet

Brute force is still available when the answer must use particular characters (hex only, digits only, and so on). Splitting a suffix into halves `A` and `B`:

```
H(prefix + A + B) = H(prefix + A) · 33^|B| + Q(B)   (mod 2³²)
```

Tabulate the left side for every `A`, then stream every `B` and probe. That turns `|alphabet|^L` into roughly `2 · |alphabet|^(L/2)` — for hex suffixes of length 8, **131 072 candidates instead of 4 294 967 296**.

| Preset | Lengths | Candidates | Time |
| :-- | :-- | --: | --: |
| fast | 8 | 131 072 | ~30 ms |
| standard | 4–9 | 1 327 872 | ~50 ms |
| thorough | 1–10 | 3 425 345 | ~70 ms |

> [!NOTE]
> Brute force can legitimately find nothing. `16⁸` candidates over `2³²` outputs means roughly **37% of targets have no `ID_` + 8-hex-character preimage at all**. The algebraic mode never has that problem, which is why it is the default.

Implementation notes:

- The lookup table is an open hash table over flat `Uint32Array` / `Int32Array` buffers with chaining, not a JS object with string keys. No GC pressure, no rehashing, duplicate keys handled correctly.
- Halves are generated iteratively in odometer order, never recursively.
- Brute force runs in a **Web Worker**, so the page stays responsive and **Stop** actually stops. Progress is real, reported ~20× per second.
- Lengths whose halves would blow the memory budget (`MAX_HALF = 2²²`) are skipped and named in the status line rather than freezing the tab.
- **Every result from either mode is re-verified** with the full hash function before it is displayed. An arithmetic mistake can never produce a wrong answer — only a missing one.

---

## ⚠ Collisions — read this

A 32-bit hash has only 4.3 billion possible outputs, so collisions are not an edge case, they are the norm. A typical target has **dozens** of `ID_` preimages.

Every string returned genuinely hashes to your target. But it is almost certainly **not** the original string the developers wrote.

That is why, when your target hash exists in the GW1/GW2 database, the real bound value is shown **above** the results. That line is usually the answer you actually wanted; the generated `ID_` strings are only useful when nothing is bound.

---

## 📁 Project layout

```
index.html               markup only — no styles, no logic, no data
css/style.css            all styling, one file
js/
  hash.js                the hash function (Math.imul + UTF-8 bytes)
  algebra.js             direct algebraic inversion — the default mode
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
  algebra-check.mjs      algebra vs. brute force vs. a BigInt reference
  make-sample-data.mjs   placeholder data for development
  qa-shots.mjs           headless screenshots of every screen
```

Nothing imports anything it does not need, and `search-core.js` and `algebra.js` have no DOM dependency at all — which is exactly why they can be tested in Node and reused in a worker.

---

## 🧪 Testing

```bash
node tools/selftest.mjs
```

The hash against a `BigInt` reference (including empty strings, 300-character strings and Cyrillic), `pow33`, input parsing, round-trip inversion, the `length = 1` edge case where one half is empty, odd-length splits, empty prefixes, larger alphabets, result limits, and memory-budget skipping. Every returned candidate is re-hashed and checked.

```bash
node tools/algebra-check.mjs
```

Cross-checks three independent implementations against each other: a literal `BigInt` transcription of the game's function, the shipped `hash.js`, and both inversion modes. Confirms that `n = 7` reaches every target across 20 000 random hashes, and verifies database key ordering.

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

Every Frostbite string ID begins with `ID_`, so that prefix is fixed and has no UI control. For the rare case of hashing something that is not a string ID, override it with `?prefix=SOMETHING_`.

---

## 🌐 Browser support

Chrome, Edge, Firefox and Safari, desktop and mobile. Requires ES modules, `Math.imul`, `TextEncoder` and module Web Workers — everything shipped by 2023. If workers are unavailable the brute-force search transparently falls back to time-sliced execution on the main thread.

Fully responsive: two-column option grids on phones, 44 px touch targets, sticky table headers, safe-area insets for notched screens, no zoom-on-focus, and `prefers-reduced-motion` respected.

---

## 📄 License

[MIT](LICENSE) for the code.

Database contents are extracted from *Plants vs. Zombies: Garden Warfare* and belong to PopCap Games / Electronic Arts. This project is not affiliated with or endorsed by them.
