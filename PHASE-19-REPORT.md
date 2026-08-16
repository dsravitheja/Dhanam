# Phase 19 Report — Worth becomes the spine (R67–R69)

*Completed: 2026-08-16 · Implements `TASK-UX-REDESIGN.md`'s Phase 19, filed the same day from `UX-ANALYSIS.md` §Strategic-3 (Worth is the anchor in the documents and the fifth-of-five nav tab in the app). Structure and copy only — no `calc.js` change, no new persisted key.*

---

## What shipped

**R67 — Nav and tile grid reordered around Worth.** `.hub-nav-inner`'s five buttons are now `⌂ Home · Dhanam Worth · Dhanam Grow · Dhanam Home · Dhanam Car` — frequency-of-need order, markup-only (`switchHub()` is id-driven and needed no change). No sixth tab was added. The landing tile grid drops from 7 tiles to 6 — the "Know My Net Worth" tile is gone; the other six keep their existing copy, order, and destinations.

**R68 — `#landing-worth-card`, one component with three faces.** Sits in the old Worth tile's slot, above `.tile-grid`. `renderLandingWorth()` is the second consumer of `worthSnapshot()` (after R65's `renderAdvWorthBridge()`) — reads `DS` only, never the `w-a-*`/`w-l-*` DOM inputs, so it's correct even when `hub-worth` has never been opened this session:

| Face | When | What it shows |
|---|---|---|
| Invitation | `worthSnapshot()` returns `null` | Copy + one button into `hub-worth`. No `₹`/`0`/`—` in a number slot. |
| "Just started" | A balance sheet exists, `worthDelta()` has no comparison base yet | The `savedAtLabel()` date, no delta — matches `renderWorth()`'s own change tile showing nothing in the same state. |
| Delta | Both exist | Arrow + "Up/Down ₹X (±Y%) since `<date>`" — `worthDelta()` verbatim, the same comparison `renderWorth()`'s own change tile uses. |

Storage-failure states (`storageEvicted`/`storageUnreadable`/`storageFailed`) surface on this card too, not just `#w-notice` inside the hub — the one failure class a reload can't rescue the user from. Called once at init (right after `loadState()`, since `buildWorth()`'s `worthBuilt` latch means `renderWorth()` never runs on a cold load) and again at the tail of every `renderWorth()` call, so editing the balance sheet and returning to the landing page without a reload shows the update immediately.

**R69 — D15 resolved by construction, not by extending `.amounts-hidden`.** **B14 was answered the same day: delta-only** — this document's own recorded lean. Because the landing card never renders the absolute net-worth figure, "Hide amounts" (scoped to `#worth-main`) has nothing on this card to reach. The one place this had to be enforced deliberately rather than assumed: `renderWorth()`'s own `#w-change-basis` line prints `"· was ₹X"` (the previous absolute total) inside the hub, protected by `.amounts-hidden`. `renderLandingWorth()`'s basis line — `set('landing-worth-basis', `since ${prettyDate(d.date)}`)` — deliberately omits that clause. Copying the hub's basis string verbatim onto the landing card would have been the exact leak D15 was filed against; this was caught while writing the function, not in review.

## Files touched

- **`index.html`** — `.hub-nav-inner` reordered; the landing tile grid's Worth tile removed; `#landing-worth-card` markup inserted above `.tile-grid`; `.landing-worth-card`/`.lw-*` CSS (reusing `.worth-change`/`.wc-*` verbatim for the delta face, stripped of its own card chrome); `renderLandingWorth()` (near `worthSnapshot()`); called from `renderWorth()`'s tail and once at init after `loadState()`; header tagline reordered to match (`Worth · Grow · Home · Car`).
- **`sw.js`** — `CACHE` bumped `apt-cost-v23` → `apt-cost-v24`.
- **`CLAUDE.md`** — new "Nav order and the landing Worth card (R67–R69, Phase 19)" section; hub bullet list reordered to match nav; manual checklist items **64–65** added; the `sw.js` cache-name mention bumped.
- **`TASK-UX-REDESIGN.md`** — B14 marked answered; Phase 19's header, R67/R68/R69, and the "Remaining work" status header all marked shipped.
- **`PHASE-19-REPORT.md`** — this file.

Not touched: `calc.js`, `tests.js`, `tests.html`, `manifest.json`. No financial calculation changed anywhere.

## Fixed after an inline code review

A `code-review` pass (medium effort) over the diff surfaced two findings, both fixed:

- **Stray-space bug in the "just started" face.** `savedAtLabel()` returns `''` when `DS.lastSaved` is absent or unparsable — reachable via the same manual-`localStorage`-tampering paths checklist item 11 already exercises (a hand-edited or pre-`lastSaved`-era backup). The original markup injected the date into a fixed sentence template (`"Balance sheet started <span>…</span>. Come back…"`), so an empty date left `"Balance sheet started . Come back…"` with a stray space before the period. Fixed by building the whole sentence as one string in JS and writing it with a single `set()` call — the markup's inner `<span>` was removed, since `textContent` now owns the whole line.
- **Duplicated delta-formatting logic.** The arrow-glyph + "Up/Down ₹X (±Y%)"/"No change" wording was written out twice — once in `renderWorth()`'s own `#w-change` block, once in `renderLandingWorth()` — reintroducing exactly the two-model-drift risk `CLAUDE.md`'s single-accessor discipline (`worthSnapshot()`/`calcNetWorthProjection()`) exists to prevent, here at the copy layer instead of the calculation layer. Factored into one shared `worthDeltaWords(net, d)`, called from both sites; the deliberate difference between them (the hub's basis line prints `"· was ₹X"`, the landing card's never does, per B14) stays as separate basis-line construction at each call site, since that difference is intentional, not incidental.

`node tests.js` stayed at 100/100 through both fixes.

## A second review pass found two more, also fixed

A second `code-review` pass (medium effort) over the updated diff surfaced two further findings, both structural/maintainability rather than live bugs, both fixed:

- **B14's "delta-only, never the absolute total" rule was enforced only by a comment.** `worthDeltaWords()` only formats the arrow + amount; each caller still hand-built its own basis-line string, and nothing stopped a future edit to `renderLandingWorth()` from copying `renderWorth()`'s adjacent `· was ₹X` clause back in. Split into two named functions — `worthDeltaBasisWithTotal(d)` (the hub's own, prints the absolute total) and `worthDeltaBasisPublic(d)` (never does, D15/B14) — so the constraint lives at the call site as a function name, not a comment two functions away. `renderWorth()` calls the first, `renderLandingWorth()` the second; R73 (Phase 21's planned Grow reverse bridge, which the spec says "inherits this same B14 answer") has a ready-made function to reuse instead of re-deriving the rule a third time.
- **Storage-failure notice text was composed twice, independently.** `renderLandingWorth()`'s notice string and `updateWorthStatus()`'s `#w-notice`/`#w-saved-at` both branched the same three flags (`storageFailed`/`storageEvicted`/`storageUnreadable`) with independently-written wording. Extracted the "what happened" half into `storageEvictedNotice()`/`storageFailedNotice()`, shared by both; each caller still composes and appends its own call-to-action locally (the hub's "Restore a backup below…", which makes no sense on the landing page and stays hub-only).

`node tests.js` stayed at 100/100 through this round too.

## What was verified, and how

- **`node tests.js`: 100 passed, 0 failed** — unchanged throughout, as expected (`calc.js` untouched).
- **No duplicate DOM ids**: `grep -oE 'id="[^"]+"' index.html | sort | uniq -d` returns nothing.
- **No leftover reference to the removed tile**: `grep -n "Know My Net Worth" index.html` returns nothing.
- **Tile count**: `grep -c '<button class="tile"' index.html` → 6.
- **Nav order**: `grep -n 'id="ht-' index.html` confirms `ht-landing, ht-worth, ht-sip, ht-apartment, ht-car`.

## Deliberately left undone / could not verify

- **No browser was run** — this environment has none. Every on-screen claim above (the three faces actually rendering correctly, the delta matching the hub's own tile pixel-for-pixel, storage-notice copy reading sensibly, the nav scroll-shadow still behaving at 375px with reordered tabs) is argued from code reading and the `node`-based checks only. Manual checklist item 65 names this gap explicitly, matching the precedent items 60–63 already set.
- **Phases 20 (income primitive) and 21 (projection-growth honesty + Grow reverse bridge)** remain unstarted — separate phases, gated on their own open decisions (B16, B17), out of this phase's scope.
