# Phase 4 Report — Brand & PWA Integrity

*Completed: 2026-07-26 · Executed from `TASK-UX-REDESIGN.md`'s Phase 4 spec (R5, R7, R9), re-scoped 2026-07-25 by B4 (Dhanam is going public) from ordinary polish to partly launch-blocking: the Google Fonts request and the 5.2 MB logo were both flagged as contradicting the "nothing is ever sent anywhere" / installability claims a stranger can now actually go check.*

---

## Scope this ran with

Phase 4 was "🟡 PARTLY DONE" at the top of this pass — D1 (palette tokens) had already shipped. What was left:

- **R5** — PWA integrity: compress/replace the 5.2 MB `dhanamlogo.png`, generate real manifest icons (192/512, incl. maskable), self-host the three Google Fonts families (removing the `fonts.googleapis.com` request entirely), precache the new logo/font assets in `sw.js`, and fix a real bug where `sw.js`'s cache-first branch never `cache.put` a miss.
- **R7** — replace every emoji used as a UI-chrome icon (nav tabs, landing tiles, action buttons, panel-card headers, section titles, collapse headers, buttons) with a shared inline-SVG line-icon set on `currentColor`. Emoji explicitly stay in body/warning copy — that's out of scope.
- **R9** — rebrand the Excel exports and the PNG snapshot export away from the stale "Apartment Cost Analyzer" name and Georgia/Arial fonts, onto "Dhanam" and the app's own type (Playfair Display / Inter / DM Mono).

**B5 (logo asset) was the one open blocking decision going in.** Asked the owner directly; answer was **"compress as-is"** — see the logo note below for what "as-is" actually turned out to mean.

No calculation changed. `node tests.js` stayed at **39/39** throughout — every edit this phase touched `index.html`'s markup/CSS/asset-export code or files outside it (`sw.js`, `manifest.json`, new `fonts/*.woff2`, new icon PNGs); `calc.js` was never opened.

---

## A logo finding surfaced before starting, not after

Before touching anything, `dhanamlogo.png` was opened to see what "compress" would actually be compressing. It's a gold hexagram — a Star of David — with a stylized "D" inside, on a black background. That reads as an unintentional AI-generation artifact (a "gold letter D" prompt landing on a six-pointed star shape) rather than a deliberate choice, but B4 means this mark is now headed for a public manifest icon and PWA install prompt, not just a private header. Flagged it to the owner directly rather than silently compressing and shipping it. The owner's answer — **compress as-is, it's fine** — is recorded as the resolution to B5 in the task brief; this report proceeds on that basis and doesn't relitigate it.

---

## R5 — PWA integrity

### Logo: 5.2 MB → 10.9 KB

The original PNG was 2816×1536 (a wide canvas with the mark roughly centered) — far larger than anything a 42–54px header slot or even a 512px install icon needs. Cropped to a centered 1536×1536 square containing the full mark (verified visually, not just by arithmetic — the crop was previewed before committing to it), then:

- **`dhanamlogo.png`** (header `<img>`, also the manifest's 192×192 entry): resized to 192×192, quantized with `pngquant --quality=65-90`. **10.9 KB**, a 480× reduction from 5.2 MB. Visually lossless at the sizes it's actually displayed (54px header, browser install prompts).
- **`icon-512.png`** (new, manifest `purpose: any`, 512×512): same pipeline at 512px. **63 KB**.
- **`icon-512-maskable.png`** (new, manifest `purpose: maskable`): the mark padded to ~72% of the canvas (matching Android's maskable safe-zone convention — OS launchers crop maskable icons into a circle/squircle/rounded-square and anything near the edge gets clipped) before the same resize/quantize pipeline. **33 KB**. One cosmetic artifact: the source image's background isn't a flat color (it's a soft dark gradient, brightest near the mark), so the padding introduces a faint seam where the flat pad color meets the image's real background. Tuned the pad color against a sampled corner pixel to minimize it; what's left is only visible zoomed in, and maskable icons get their corners cropped by the OS mask anyway, so it wasn't worth more tool-fighting than that.

No image-editing library was available (no PIL, no ImageMagick). Used macOS `sips` for crop/resize and installed `pngquant` via Homebrew for the lossy PNG quantization that actually got the file size down — `sips` alone produced a 512px PNG at 368 KB, still fine but not tight; `pngquant` took that to 63 KB with no visible quality loss.

### Manifest icons: real files, not an emoji data URI

`manifest.json`'s `icons` array was a single `data:image/svg+xml` entry containing a `💰` emoji drawn onto a rect — that fails Lighthouse's PWA installability check (no real ≥512×512 icon) and doesn't produce a usable home-screen icon on either platform. Replaced with three real PNG entries: `dhanamlogo.png` (192, `any`), `icon-512.png` (512, `any`), `icon-512-maskable.png` (512, `maskable`).

### Fonts: self-hosted, including the character the "latin" subset drops

The `@import url('https://fonts.googleapis.com/...')` was both a render-blocking request and the one thing on the page actively contradicting the landing copy's "nothing is ever sent anywhere" claim — the exact contradiction the task brief called out by name as launch-blocking under B4.

Fetched the same families/weights (Inter 300–700, Playfair Display 400/700/900, DM Mono 400/500) directly from `fonts.gstatic.com` and self-hosted them as `woff2` files under a new `fonts/` directory, referenced via local `@font-face` rules replacing the `@import`.

**One thing this could easily have gotten wrong, and didn't:** Google's plain "latin" unicode-range subset (`U+0000-00FF, ... U+2000-206F, U+20AC, ...`) does **not** include `U+20B9`, the Indian Rupee sign — and this app prints `₹` **85 times** in `index.html` alone. Downloading only the "latin" file per family would have silently replaced every `₹` with the browser's fallback font mid-word the moment the self-hosted fonts became authoritative. Fetched Google's actual served CSS (not assumed the subsetting), found `₹` lives in the second unicode-range block (`U+0100-02BA, ..., U+20A0-20AB, U+20AD-20C0, ...`) each family already ships as a second file, and downloaded **both** ranges per family. Also discovered Inter and Playfair Display are single variable-font files under the hood — every weight in the `@import`'s `wght@300;400;500;600;700` list resolved to the identical URL — so a single `font-weight: 300 700` range rule per family/range covers all five weights; only DM Mono ships genuinely separate static files per weight (400, 500).

Result: **8 files, 252 KB total** (`inter-{latin,latinext}.woff2`, `playfair-display-{latin,latinext}.woff2`, `dm-mono-{400,500}-{latin,latinext}.woff2`) — self-hosted, same-origin, and every character the app actually prints is covered by at least one of them. Verified live (below) that `₹` renders correctly in the self-hosted DM Mono, not as a tofu box or a fallback-font substitution.

### `sw.js`: precache the new assets, and fix a real caching bug

- Added the logo, both new manifest icons, and all 8 font files to `ASSETS` (precached on install), alongside the pre-existing `./`, `./index.html`, `./calc.js`, `./manifest.json`.
- **Fixed a bug, not just extended the list:** the fetch handler's cache-first branch for static assets was `caches.match(req).then(r => r || fetch(req))` — a cache miss fetched the resource but never stored it, so anything not in the hand-maintained `ASSETS` array (including, previously, the logo and fonts) could never become available offline no matter how many times it was successfully fetched online. Changed the miss path to `cache.put` a successful response before returning it, so any future asset added to the page without a matching `sw.js` edit still becomes offline-available after its first real fetch, instead of silently staying network-only forever.
- Bumped `apt-cost-v9` → `apt-cost-v10` (this phase's only cache-version bump — R7/R9 changed `index.html`, which the HTML branch already re-fetches network-first on every load regardless of cache version).

---

## R7 — emoji → shared inline-SVG icon set

### What was actually there

A systematic sweep (not a spot-check) found **29 distinct emoji used as icons** across nav tabs, landing tiles, action-row buttons, panel-card headers, section titles, collapse headers, and buttons — roughly **70 individual usages** once repeats are counted. That's a wider net than the task brief's own estimate ("~6–10 line icons") assumed; the brief's number undercounted how many *distinct pictographs* the app actually uses as icons; the *reused* icon count (below) is much closer to that estimate.

The sweep was run twice: once against a hand-built list of emoji spotted while reading the file, and again with a broad Unicode-range regex sweep after the first pass looked complete — the second pass caught **four emoji the first pass missed** (`⚡` Quick Estimate, `⬆️` Restore backup, `🗑️` Erase my data, plus confirming `💸` on the "Buying Under Construction?" tile hadn't been forgotten). Worth recording as a lesson: a manual grep list against a ~4,000-line file undercounts; the regex sweep is what actually closed it out, and it's what caught that `🙈`/`👁️`'s dynamic swap (below) needed special handling that a static markup search alone wouldn't have surfaced.

### The icon set: 29 SVGs, consolidated by meaning where the emoji already overlapped

Built one hidden `<svg><defs>` sprite of `<symbol>` elements right after `<body>`, each a small stroke-based line icon (`viewBox="0 0 24 24"`, `currentColor`), referenced everywhere via `<svg class="icon"><use href="#i-name"></use></svg>`. `.icon` is sized in `em` (so it scales with whatever font-size its wrapping span/button already had for the emoji it replaced) and colored via inheritance only — never a fixed hue, so an icon in an active/gold-colored ancestor (e.g. the active action-tab) turns gold along with its text, same as before, without the icon set itself introducing a fourth chromatic color outside palette rule 1.

29 distinct emoji were consolidated to icons by genuine semantic overlap (e.g. `🏠`/`⌂` → one house icon; `💰`/`💵`/`🪙`/`💸` → one banknote icon; `🏦`/`🏛️` → one bank/columns icon) — not force-fit to hit a round number, since every icon here sits next to a text label doing the actual meaning-carrying work; the icon is reinforcement, not the sole signal. That landed the *reused* icon count in the ballpark the brief expected.

**One icon was redesigned after a visual check caught it, not assumed correct from the code:** the first banknote/currency design (a circle with a simplified ₹ mark inside) rendered, at the sizes actually used, as an unmistakable **"®"** — i.e., it looked like a registered-trademark symbol, not money. Caught this by actually looking at a rendered screenshot rather than trusting the path data, and replaced it with an unambiguous banknote shape (rounded rectangle, center circle, two edge ticks) — a standard "cash" glyph with no misreading risk. Re-screenshotted to confirm.

### The one usage that couldn't be a straight text-swap

`toggleHideAmounts()` updated the "Hide amounts" button via `set(id, txt)`, which writes `textContent` — meaning the button's entire label, including any icon, would need to be plain text on every toggle, which an `<svg>` can't be. Restructured that one button into a static icon (`<use>`) plus a separately-`id`'d label span; the toggle function now swaps the icon by setting the `<use>` element's `href` attribute (`#i-eye` / `#i-eye-off`) and updates only the label span's text — same `set()` helper, same pattern as everywhere else, just split into two elements instead of one. Verified live that both directions of the toggle show the correct icon and label (below).

### What was deliberately left alone

- **`⚠️` in the disbursement tranche-sum warning message** — body/warning copy, not an icon slot; explicitly in scope's carve-out.
- **`✕` on the tranche remove button** — not actually an emoji (it's the plain Unicode multiplication-x dingbat, U+2715), already renders in a single consistent color via the button's own `color: var(--red)` CSS rule on every platform. Converting it would be scope creep on a symbol that was never the platform-inconsistent-rendering problem R7 exists to fix.

---

## R9 — export rebranding

- **Excel titles**: `buildDetailRows()`'s `'APARTMENT COST ANALYZER — HYDERABAD'` → `'DHANAM — HOME COST ANALYSIS (HYDERABAD)'`; `buildLoanRows()`'s `'LOAN ANALYSIS — APARTMENT COST ANALYZER'` → `'DHANAM — HOME LOAN ANALYSIS'`. (`buildWorthRows()` already said `'DHANAM WORTH — BALANCE SHEET'` — Phase 2 shipped that one correctly the first time, confirmed by grep before assuming it needed a fix.) The `(HYDERABAD)` qualifier stays for now — removing location-specificity is R21/Phase 6a's job, not R9's; rebranding the product name and dropping the location claim are different fixes and this phase only owns the first one.
- **Excel filenames**: `apartment_cost_analysis.xlsx` / `apartment_loan_analysis.xlsx` / `apartment_full_analysis.xlsx` → `dhanam_home_cost_analysis.xlsx` / `dhanam_home_loan_analysis.xlsx` / `dhanam_home_full_analysis.xlsx`.
- **PNG snapshot** (`exportSnapshot()`): header text `'Apartment Cost Analysis'` → `'Dhanam — Home Cost Analysis'`; footer `'Apartment Cost Analyzer · ' + timestamp` → `'Dhanam · ' + timestamp`; download filename `apartment_cost_snapshot.png` → `dhanam_home_cost_snapshot.png`. Every `ctx.font` call in the canvas-drawing code — 7 of them — swapped from `Georgia, serif` / `Arial` to `'Playfair Display', serif` / `'Inter', sans-serif` (and the one `12px monospace` row-amount font to `'DM Mono', monospace`), matching the palette's actual type system instead of generic system fonts. These fonts are guaranteed already loaded by the time a user can click an export button, since the same families render the whole page around that button.

---

## Verification performed

- **`node tests.js` — 39/39**, unchanged; `calc.js` was never touched this phase.
- **Live in a real, unmodified Google Chrome** (the installed desktop build, not a stub), driven headless via the Chrome DevTools Protocol over Node 24's native `WebSocket` client (no `ws`/`puppeteer` — this project has no package manager, so a ~40-line CDP client using `fetch` for the `/json/new` handshake and native `WebSocket` for the session was enough), served over a real `python3 -m http.server` (not `file://`, so the service-worker/manifest code paths are actually reachable):
  - **Landing page, full render**: header shows the compressed logo at correct size with the drop-shadow filter intact; all 6 tile icons render as clean monochrome line icons; nav tabs render icons at the correct inline size; Playfair Display headings and Inter body text both render (confirming the self-hosted `@font-face` rules resolved, not silently falling back to system fonts).
  - **`₹` rendering specifically**: loan-panel hero (`₹66,490/mo`), quick-estimate figures, and the SIP corpus hero (`₹99.91 L`) all render the Rupee sign correctly in self-hosted DM Mono — the exact case the latin-ext-subset research above exists to guarantee.
  - **The `i-coin` redesign**: screenshotted before and after: before, the "Know My Net Worth" and "Buying Under Construction?" tiles' icons were legible as "®"; after, both show an unambiguous banknote shape.
  - **Every hub driven and screenshotted**: landing, Dhanam Home (quick estimate → loan panel open, with the principal-vs-interest chart and all three collapse headers — Compare/Advanced/Buy-vs-SIP — showing their respective icons), Dhanam Car (salary inputs, tax scenarios, "🏆 Best option" now a trophy icon, "ℹ️ Important Notes" now an info-circle icon, car-buying/depreciation section), Dhanam Grow (all three SIP-planner tabs, each tab button and each panel-card header), Dhanam Worth (assets/liabilities/projection/your-data cards, all icons present and distinct).
  - **The eye/eye-off toggle specifically**: called `toggleHideAmounts()` live — first call blurred every figure and swapped the button to an open-eye icon reading "Show amounts"; second call reversed both. Confirmed via screenshot, not just by reading the new code.
  - **Zero console errors** across a single scripted session that touched every hub, every SIP-planner tab, the loan panel's nested collapse cards, the disbursement deep-link, the car-buying price input, the Worth hub's hide-amounts toggle (both directions), and back to landing — checked via `Runtime.exceptionThrown`/`Runtime.consoleAPICalled(type: 'error')` CDP events, not just "the page looked fine."
  - **No leftover icon-slot emoji**: a final broad Unicode-range regex sweep after all edits found exactly two remaining matches in the whole file — the deliberately-untouched `✕` (dingbat, not emoji) and `⚠️` (body copy) — confirming the earlier "29 distinct, ~70 usages" count was fully closed out, not just mostly.

---

## What this does NOT include

- **Phase 5** (D8/D11 — keyboard/ARIA pass, trust/consistency nicks, R8/R10) — unchanged, still open.
- **Phase 6** (R21–R25) — unchanged, still open; R21 (state-aware assumptions) remains the highest-severity open item in the whole document.
- **B6, B7, B8, B9** — unchanged, still open. **B5 is now answered** (this report, "compress as-is") — removed from the open-questions table.
- **A genuine offline/installed-PWA walkthrough** (airplane-mode reload, Lighthouse installability run) — verified the *pieces* live (real ≥512px icons in the manifest, all assets in `sw.js`'s `ASSETS`, the cache-put-on-miss fix, same-origin fonts with no outbound request) but did not install the PWA to a home screen or run Lighthouse against it in this pass; flagging rather than claiming a check that wasn't actually run.
- **The maskable icon's faint padding seam** — cosmetically minimized, not eliminated; see the R5 section above for why it wasn't worth further tool-fighting given the OS crops that region anyway.

---

## Files touched

- `index.html` — R5: replaced the Google Fonts `@import` with 8 local `@font-face` rules (latin + latin-ext per family, documented inline with the ₹-coverage rationale). R7: new icon sprite (29 `<symbol>`s) after `<body>`, `.icon`/`.tile-icon`/`.ab-icon` CSS, ~70 emoji-to-`<use>` replacements across markup and the JS template-literal/`textContent` call sites, `toggleHideAmounts()` restructured for the icon-swap-plus-label-swap pattern. R9: 2 Excel title strings, 3 Excel filenames, the PNG snapshot's header/footer text and all 7 `ctx.font` calls, the snapshot's download filename. ~3,970 → 4,091 lines.
- `sw.js` — `ASSETS` extended with the logo, both new manifest icons, and 8 font files; cache-first branch now `cache.put`s a miss; `apt-cost-v9` → `apt-cost-v10`.
- `manifest.json` — emoji data-URI icon replaced with 3 real PNG entries (192 `any`, 512 `any`, 512 `maskable`).
- `dhanamlogo.png` — replaced in place (5.2 MB → 10.9 KB).
- `icon-512.png`, `icon-512-maskable.png` *(new)*.
- `fonts/inter-latin.woff2`, `fonts/inter-latinext.woff2`, `fonts/playfair-display-latin.woff2`, `fonts/playfair-display-latinext.woff2`, `fonts/dm-mono-400-latin.woff2`, `fonts/dm-mono-400-latinext.woff2`, `fonts/dm-mono-500-latin.woff2`, `fonts/dm-mono-500-latinext.woff2` *(new, 252 KB total)*.
- `TASK-UX-REDESIGN.md` — Phase 4 marked shipped (R5, R7, R9), B5 answered and removed from the open-questions table.
- `PHASE-4-REPORT.md` *(new, this file)*.
