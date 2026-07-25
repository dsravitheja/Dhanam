# Phase 3B Report — Chart Coverage, Redraw Correctness & Panel Accordion

*Completed: 2026-07-25 · Executed from `TASK-UX-REDESIGN.md`'s Phase 3b spec (R11–R14), which closed a chart-coverage gap between `UX-ANALYSIS.md`'s D5 issue and what Phase 3 actually shipped, plus an owner-requested accordion for the Dhanam Home section panels.*

---

## Scope this ran with

Phase 3 shipped two of the three charts D5 named ("corpus growth, principal-vs-interest crossover, depreciation curve") and left the corpus-growth chart on the Monthly SIP tab only. A 2026-07-25 review wrote this gap down instead of re-discovering it later, and the resulting Phase 3b spec bundled four items, in the dependency order the spec itself called for:

- **R11** — fix `renderChart()`'s silent 0-width-fallback distortion and give every reveal path (tab switch, hub re-entry, accordion reopen, `resetAll()`, window resize) one redraw mechanism instead of zero.
- **R12** — corpus-growth charts for the step-up and lumpsum Grow tabs (R11 is a hard dependency: both hosts are `display:none` at load).
- **R13** — a resale-value curve for the car-buying depreciation table (same R11 dependency).
- **R14** — accordion the three Dhanam Home section panels so only one is ever open at a time (owner-requested the same day; depends on R11 because the accordion turns "chart host gets hidden and reopened" from a rare path into a routine one).

No calculation changed. `node tests.js` stayed at 39/39 throughout — every new chart reuses an existing pure `calc.js` function (`calcStepupSIP`, `calcSIP`, `calcCarDepreciation`) called per-year instead of once.

---

## R11 — one redraw mechanism, not per-caller plumbing

The spec offered two directions and asked for one: an explicit `redrawChart(targetId)` callers invoke on every reveal path, or a `ResizeObserver` per chart host that redraws automatically whenever the host's box size changes away from zero. Went with the observer — it "subsumes the resize handler and every reveal path at once," which was true in practice: zero call sites needed to change in `switchSIPPlannerTab()`, `switchHub()`, `resetAll()`, or the new accordion to get correct redraws, because none of them needed to know a chart existed.

Implementation, in `renderChart()`:
- `chartCache: Map<targetId, {series, opts}>` remembers the last data a chart was asked to draw.
- `chartObservers: Map<targetId, {ro, node}>` — one `ResizeObserver` per host, created the first time that host is rendered, storing the DOM node it's attached to alongside the observer.
- On every render, if a host's *current* node differs from the node its cached observer is attached to, the old observer is disconnected and a fresh one created. This turned out to matter immediately, not hypothetically: `cb-depr-body`'s `innerHTML` gets fully rewritten on every `renderCarLoan()` call, which destroys and recreates the `cb-depr-chart` div with the same id on every keystroke. Without the node-identity check, the first observer would keep watching a permanently-detached element and the resale chart would never redraw after its first render — caught by writing the R13 chart against this exact host before assuming the cache-by-id-alone version was fine.
- `toggleChartCard()` shrank to a thin wrapper: toggle the card, optionally call `redraw()` once for the "data was never computed at all" case. The Worth trend card is still the only caller; the observer, not the explicit call, is what actually fixes the distorted-viewBox problem now.

**A pre-existing live bug the spec called out by name, confirmed and fixed as a side effect of R11, not a separate patch:** entering the Grow hub with a non-monthly tab active drew the monthly chart at 0 width and never redrew it on returning to that tab, because `switchHub('sip')` calls all three `update*` functions but only one tab is visible. Verified this exact sequence in a live browser (below) both before believing it was fixed and after: **before** the fix, `sp-growth-chart`'s viewBox stayed at the 600px fallback after `switchHub('sip')` → `switchSIPPlannerTab('stepup')` → `switchHub('landing')` → `switchHub('sip')` → `switchSIPPlannerTab('monthly')`; **after**, it measured 890×140 against an 890px-wide host, matching exactly.

---

## R12 — step-up and lumpsum corpus charts

Both sit in the same position as the existing monthly-tab chart (between the hero card and the milestone table), per the Phase 1 naming-consistency principle the spec pointed at.

- **Step-up tab** — three series: step-up corpus (gold, filled), flat-SIP corpus at the same monthly/CAGR (secondary grey, unfilled), total invested (dim grey, unfilled). Computed year-by-year with the exact `calcStepupSIP`/`calcSIP` calls the milestone table already makes — no new math.
- **Lumpsum tab** — one compounding curve (gold, filled) plus the flat-principal line (dim grey), so the gain is the shaded gap. Pure arithmetic already inline in `updateLumpsum()`.
- **No caption on either** — per CLAUDE.md's Charts rule, a caption is only required when a chart's values appear nowhere else, and the milestone table directly below both charts already prints every value on the curve (same reasoning the monthly tab's chart already follows).

**One deliberate deviation from the spec's literal wording, called out here rather than left silent:** the spec's own text says the third (invested) series on the step-up chart should use `--text-faint`. That custom property doesn't exist anywhere in this codebase — grepped for it and for the `#555`→faint-token replacement Phase 0's brief describes, and neither is present; the actual `#555` cleanup evidently landed on `--text-dim` instead, and the design-doc reference to `--text-faint` is stale. Rather than inventing a new CSS custom property (which CLAUDE.md's styling rules explicitly say not to do without revisiting `COLOR-PALETTE-ANALYSIS.md`), the three-series chart uses the two existing neutral tokens: `--text-mid` (brighter, for the flat-SIP comparison line — the more important of the two secondary series) and `--text-dim` (dimmer, for invested — already shown in the hero and the milestone table). Documented in CLAUDE.md's Charts section so this isn't rediscovered as a missing token later.

---

## R13 — car depreciation curve, plus a real bug it exposed

One series, as the committed scope specified: estimated resale value by year (gold, filled), from the existing `calcCarDepreciation()` calls, over the same five years (`[1,2,3,5,7]`) the depreciation table already shows — so every point on the curve is also a row in the table beneath it, and (per the same captioning rule as R12) no caption was added.

**Flagging, not building, the overlay:** the spec named an optional second series — outstanding loan balance via `loanAtYear()`, in red, so the crossover point (car worth less than what's owed on it) is visible — and explicitly said to flag it to the owner rather than build it. Recorded as new **B8** in the task brief's blocking-decisions table rather than deciding unilaterally either way.

**Found and fixed a real pre-existing bug while building this, not by inspection:** `renderCarLoan()` had `if (!loan || !rate) { el('cb-cards').innerHTML = ''; return; }` *before* the depreciation section. A 100%-down-payment car has `loan === 0`, which hit that early return and skipped the depreciation table entirely — meaning the "zero-loan car still renders the resale curve" acceptance bar this same task sets was, before this fix, unsatisfiable by the existing code, table included, chart or no chart. Restructured so the EMI-scenario cards (which do need a nonzero loan) are gated on their own, while the depreciation block — which only needs `price` — runs unconditionally. Verified live: setting `cb-down === cb-price` (loan = 0) now shows the depreciation table and chart with no `NaN`/`Infinity`, and the loan-scenario cards correctly show nothing.

---

## R14 — Dhanam Home accordion

`toggleSection()`'s open branch now closes any other open `section-panel` — CSS class removal only, nothing else — before opening the requested one. Implementation is the loop shape the spec suggested, over a new `SECTION_IDS = ['detail', 'loan', 'disb']` constant.

Every invariant the spec called out was verified, not assumed:
- **Latches never reset.** `detailOpened`/`loanOpened`/`disbOpened` are untouched by collapsing — confirmed by setting `l-total` to an arbitrary value, closing the loan panel via the accordion (by opening `disb`), and reopening it: the value survived and `renderLoans()` did not re-run (no `syncLoanTotal()`-driven overwrite).
- **Combined-export buttons stay visible once both `detail` and `loan` have been opened, regardless of which is open now** — verified: opened detail then loan (satisfying both latches), closed loan by reopening detail, and `btn-combined-from-detail` was still visible.
- **`openLoanCalc()`/`openDisbCalc()` get the sibling-collapse behaviour for free**, with no second code path — both already call `toggleSection(...)` synchronously before their own `scrollIntoView()`, so by the time the scroll runs, any sibling panel has already collapsed and the layout has already reflowed to its final state. Nothing in either function needed to change.
- **Second click on an already-open panel still collapses it** — unaffected, since that's the pre-existing `isOpen` branch, untouched by this change.

---

## Verification performed

- **`node tests.js` — 39/39**, unchanged (no `calc.js` edit).
- **`node --check`** against the extracted inline `<script>` block — clean syntax after every edit.
- **Every new element id** (`su-growth-chart`, `ls-growth-chart`, `cb-depr-chart`) cross-checked: appears in markup exactly once, referenced in JS exactly once.
- **Live in a real, unmodified copy of Chrome for Testing** (the same build Playwright caches locally), driven via a hand-rolled, dependency-free CDP client over a raw `net.Socket` (this project has no package manager, so no `ws`/`puppeteer` — a ~150-line RFC6455 client plus a thin `Runtime.evaluate`/`Page.navigate` wrapper was enough). Navigated `index.html` directly via `file://`, at both desktop and a 375×900 `Emulation.setDeviceMetricsOverride` mobile viewport. Concretely verified, with actual DOM measurements rather than reading the code and assuming:
  - **Accordion**: opening detail → loan → disb collapses each predecessor (`{detailOpen:false, loanOpen:false, disbOpen:true}` after the third open); a second click on the open panel collapses it; `l-total` survives a close/reopen cycle untouched; combined-export buttons stay visible with only one of the two panels currently open.
  - **Chart 1:1 measurement, no distortion, on six hosts**: `l-pvi-chart`, `su-growth-chart`, `ls-growth-chart`, `sp-growth-chart`, `cb-depr-chart`, and `w-trend-chart` all measured `viewBoxW === hostW` (890 or 894px depending on host padding) after every reveal path tested below — the pre-fix failure mode (`viewBoxW: 600` against a real `hostW`) never reproduced after the fix.
  - **The specific pre-existing bug the spec named**: `switchHub('sip')` with a non-monthly tab left active, leaving the hub, and returning — `su-growth-chart` measured correctly on re-entry, and `sp-growth-chart` measured correctly after switching back to it, matching the "no chart is ever left drawn against a 0-width host" acceptance bar.
  - **`resetAll()` into a collapsed loan panel, then reopened** — `l-pvi-chart` redrew at the real width (890px), not the stale/fallback state.
  - **Worth trend chart, expanded from collapsed** — planted three synthetic `DS.history` entries, called `toggleChartCard('w-trend-card', renderWorthTrend)`, measured 894×140 against an 894px host.
  - **Window resize** — `Emulation.setDeviceMetricsOverride` from a wide viewport down to 375px while a chart was on-screen: `sp-growth-chart` redrew at 313px (matching the narrower host), `document.documentElement.scrollWidth` stayed at 375 — no horizontal scroll introduced.
  - **Depreciation chart correctness**: year-5 chart value (`₹6,26,408`) matched the table row exactly; a 100%-down-payment car (`cb-down === cb-price`) rendered the table and chart with `hasNaN: false, hasInfinity: false, deprVisible: true` — the exact case that was structurally impossible before the R13 control-flow fix.
  - **No horizontal scroll at 375px** across all five hubs (`landing`, `apartment`, `car`, `sip`, `worth`) — `scrollWidth` measured 375 in every case.

---

## CLAUDE.md updated

- **Charts section** rewritten: names all six current call sites, documents the `ResizeObserver`-per-host redraw contract as the single mechanism (superseding the old "hidden host + `toggleChartCard` expand-then-redraw" description, which was Phase 3's answer to a narrower problem), explains the node-identity check `renderChart()` needs when a host's parent rewrites `innerHTML` on every render (the `cb-depr-chart` case), and records that `--text-faint` doesn't exist in this codebase despite the task brief assuming it does.
- **Hub/tab model** section now describes the three `section-panel`s as an exclusive accordion, states the scope boundary explicitly (excludes nested `.collapse-card`s), and notes `openLoanCalc()`/`openDisbCalc()` route through the same `toggleSection()` path rather than a second one.
- **Core calculation functions**: `renderCarLoan()`'s entry now notes the depreciation chart runs independently of the loan-amount early return.
- **Manual checklist**: items 3–4 gained the sibling-collapse expectation; item 22 extended to name all six chart call sites and the new match-the-table acceptance bars; added item 24 (accordion) and item 25 (reveal/resize redraw across every path).
- `sw.js` cache-version references and the `index.html` line-count estimate (~3700 → ~3900) corrected to match this session's changes.

---

## What this does NOT include

- **Phase 4** (D3/D9/D10 — icon set, PWA asset/logo/font integrity, export rebranding — R5/R7/R9, still open).
- **Phase 5** (D8/D11 — keyboard/ARIA pass, trust/consistency nicks — R8/R10, still open).
- **B4, B5, B6, B7** — unchanged, still open. **New: B8** (car-depreciation loan-balance overlay) — flagged per the spec's instruction rather than built; see the Remaining-work table.
- A PWA/service-worker install check — same `file://`-navigation constraint noted in `PHASE-3-REPORT.md` applies here (no outbound network access in this sandbox, and service workers require `http(s)://`). The cache-version bump (`v7` → `v8`) was applied but not walked against an installed instance.

---

## Files touched

- `index.html` — `renderChart()`/`toggleChartCard()` redraw mechanism (`chartCache`, `chartObservers`, node-identity re-observe); step-up and lumpsum chart markup + `updateStepupSIP()`/`updateLumpsum()` wiring; car-depreciation chart markup + `renderCarLoan()` control-flow fix (depreciation no longer gated on `loan`) + chart wiring; `toggleSection()` accordion loop (`SECTION_IDS`). 3,791 → ~3,900 lines.
- `sw.js` — cache `v7` → `v8`.
- `CLAUDE.md` — sections listed above.
- `TASK-UX-REDESIGN.md` — Remaining-work table (R11–R14 marked shipped), Phase 3b header and all five sub-item headers marked shipped, new B8 blocking decision, stale cache-version reference corrected.
- `PHASE-3B-REPORT.md` *(new, this file)*.

<br>

# Phase 3c Addendum — Chart Correctness & State Hygiene (Review Findings)

*Completed: 2026-07-25 · Executed from `TASK-UX-REDESIGN.md`'s Phase 3c spec (R15–R20), written after a code review of the Phase 3b diff above found six defects — four of them in the charts Phase 3b itself shipped. Appended to this report rather than filed separately, since it's a direct continuation of the same chart-coverage work, not new scope.*

## Why this pass exists

Phase 3b's own verification (above) was genuine and thorough about **geometry** — it measured `viewBoxW === hostW` on all six chart hosts across every reveal path, live, in a real browser. What it didn't check is whether each chart draws the *right numbers*, over the *right axis*, from data that *still exists*. A 2026-07-25 review of that diff found six problems in exactly those three categories:

- **R15** — a chart could redraw data the user had explicitly erased.
- **R16** — the step-up chart plotted two functions with a known ~1% timing disagreement (B6) against each other as two lines on one scale, which turned a documented footnote into a false on-screen claim.
- **R17** — the depreciation curve's x-axis spacing inverted the shape it exists to show.
- **R18** — an unguarded division produced `NaN×` in the lumpsum table; a related unclamped input made the step-up tab's O(n²) chart freeze on a large typed value.
- **R19** — three of the six charts had no x-axis extent caption, unlike the other three.
- **R20** — two small render-hygiene issues (a duplicated per-year calculation; a chart host rebuilt on every keystroke).

All six are fixed below. **No calculation changed in `calc.js`** — R16's fix is chart-local (it doesn't touch either `calcSIP` or `calcStepupSIP`), and R18 only adds guards — so `node tests.js` stayed at 39/39 throughout, confirmed by diffing `calc.js`/`tests.js`/`tests.html` against `origin/main` at the end of the pass (empty diff on all three).

---

## R15 — erased chart data could come back

`chartCache` (added in Phase 3b, above) is never pruned by `renderChart()`. `renderWorthTrend()` had two paths that don't go through `renderChart()` at all: zero history hides the card outright without touching the chart host, and exactly one history point wrote `el('w-trend-chart').innerHTML = ''` directly. Neither cleared `chartCache`, and the `ResizeObserver` attached to that host in Phase 3b stayed live regardless.

**Reproduced live, not just reasoned about:** built up 3 history points (chart drawn, cached) → simulated "Erase my data" → planted one balance (history back to exactly 1 entry, so the card shows "not enough history yet" and the host is blanked) → expanded the trend card. Before the fix this would redraw the pre-erase 3-point series from the stale cache the instant the host's size changed away from 0; a window resize in that state would do the same.

**Fix:** a new `clearChart(targetId)` empties the host **and** deletes its `chartCache` entry together, documented in `index.html` as the thing any future "hide this chart because its data is gone" code must call instead of a bare `innerHTML` write. `renderWorthTrend()`'s two early-return paths now call it.

**Verified live** (headless Chrome for Testing, driven via CDP over a native `WebSocket` — Node 24 ships one, so no hand-rolled RFC6455 client was needed this time, unlike Phase 3b's): planted 3 history points, erased, planted 1 balance, expanded the card —

```
cachedBefore: true            // before erase, chart was cached as expected
cachedAfterOneEntry: false    // after erase + 1 entry, cache correctly empty
svgAfterExpand: ''            // host stayed empty on expand — no repaint
rangeText: 'Not enough history yet — check back after your next update.'
```

A separate run confirmed the zero-history path too: `w-trend-card` hidden, `chartCache.has('w-trend-chart')` false. A follow-up run with a **real** 2-point history (not erased) confirmed normal drawing still works after the fix: `hostW: 317, viewBoxW: 317` — undistorted.

---

## R16 — the step-up chart's baseline was drawn on the wrong convention, plus a bug found while verifying it

`updateStepupSIP()` plotted `calcStepupSIP` (month-by-month, ordinary annuity) against `calcSIP` (closed-form, annuity-due) as two lines on a shared scale — the two sides of **B6** (open since Phase 1: the two functions disagree by ~1% even at 0% step-up). Numerically confirmed before touching anything, at the tab's own default settings (₹10,000/mo, 10% step-up, 12% CAGR):

```
year 1  stepup ₹1,26,825   flat ₹1,28,093   ← gold line starts BELOW grey
year 2  stepup ₹2,82,417   flat ₹2,72,432
```

A step-up SIP is, by definition, identical to a flat one for the whole of year 1 (the first step only applies from year 2) — the chart was asserting the opposite for its own default settings, not just an edge case.

**Fix (the chart-local option from the spec, not the B6-alignment option):** both the chart's flat-SIP series and the `su-vs-flat` figure now derive from `calcStepupSIP(monthly, 0, cagr, y)` instead of `calcSIP(monthly, cagr, y)` — the same function, called at 0% step-up, so the two lines are exactly equal at year 1 by construction and never invert. This resolves the on-screen symptom without touching `calc.js`, without needing B6 answered, and without changing any other hub's output. B6 itself is recorded as still open in the task brief — this fix routes around it, it doesn't resolve it, and the underlying gap will resurface the moment anything else plots the two functions against each other directly.

**A second, unrelated bug found in the course of verifying this one, fixed in the same edit:** `updateStepupSIP()` read `parseFloat(el('su-stepup').value) || 10`. Because `0` is falsy in JavaScript, typing an explicit `0` into the Step-up % field was silently treated the same as leaving it blank, forcing the 10% default back in. This made R16's own acceptance bar — "at 0% step-up the two lines are pixel-identical and `su-vs-flat` reads ₹0" — genuinely unreachable through the UI; the first live verification run proved it by showing `su-vs-flat` unchanged after setting the field to `0`. Changed to `isNaN(stepupRaw) ? 10 : stepupRaw`, which keeps the empty-field default but respects a real zero. This wasn't part of the R15–R20 scope as written and is called out here rather than folded in silently.

**Verified live**, before and after the second fix:

```
// before the isNaN fix
su-vs-flat at default (10% stepup): +₹97.99 L vs flat
su-vs-flat at 0% stepup (should be ~0): +₹97.99 L vs flat   ← unchanged, bug confirmed

// after the isNaN fix
su-vs-flat at default (10% stepup): +₹97.99 L vs flat
su-vs-flat at 0% stepup (should be ~0): ₹0.00 L vs flat     ← fixed
```

Also confirmed via a direct `calc.js` call (Node, not the browser) that the fix's *logic* was correct independent of the DOM bug: `calcStepupSIP(10000,10,12,y).corpus >= calcStepupSIP(10000,0,12,y).corpus` at every year, with exact equality at year 1 (both `126825.03…`) and at every year when step-up itself is 0.

---

## R17 — the depreciation curve's x-axis inverted its own point

`chartSvg()` spaces points by array index, not by the value each point represents. The depreciation table's years — `[1, 2, 3, 5, 7]` — plotted directly through `renderChart()` therefore drew the five-to-seven (two-year) gap the same width as the one-to-two (one-year) gap, flattening the steep early years and stretching the flat later ones. The chart's own purpose, per the Phase 3b report, was "a table of five rows hides that the drop is a cliff in years 1-3, not a straight line" — the exact shape this bug erased.

**Fix:** the chart now plots every year 1 through 7 (7 points), while the table underneath keeps its original 5 rows — index spacing is then genuinely uniform time spacing, and every table row is still an exact point on the curve.

**Verified live:** `cb-depr-chart` now renders 7 `<circle>` dots (was 5). Extracted the actual plotted values via `chartCache.get('cb-depr-chart').series[0].values` and compared to the rendered table:

```
table:  Year 1 ₹12,00,000 · Year 2 ₹10,20,000 · Year 3 ₹8,67,000 · Year 5 ₹6,26,408 · Year 7 ₹4,52,579
chart:  [1,200,000, 1,020,000, 867,000, 736,950, 626,408, 532,446, 452,579]
                                                    ↑ year 5 = 626,408, matches table exactly
                                                                                 ↑ year 7 = 452,579, matches table exactly
```

Re-verified the R13 control-flow fix (zero-loan car still shows the depreciation section) still holds after this change: with `cb-down === cb-price`, `cb-depreciation` visible, `cb-cards` empty, chart present with no `NaN`/`Infinity`.

---

## R18 — `NaN×`, and an O(n²) tab that didn't clamp its own input

`updateLumpsum()`'s milestone table computed `(val / amount).toFixed(2)` unguarded — clearing `ls-amount` made every Multiplier cell read `NaN×`. `ls-mult` in the hero card above it already had the `amount > 0 ? … : 0` guard; the table simply never got the same treatment. Swept the rest of the app for the same unguarded-division shape (`w-share-a/l`, `sp-gainpct`, `cb-derived`'s down-payment %, the loan/depreciation interest-% cells) and found all of them already guarded — this was the one gap.

Separately, `su-years`/`sp-years`/`ls-years` read `parseInt(...) || 20` with `min="1" max="50"` enforced only by markup, which browsers don't apply while typing. Harmless on the two closed-form tabs, but Phase 3b's step-up chart calls the month-by-month `calcStepupSIP` once per plotted year — a typed `500` is roughly 3 million simulated months **per keystroke**.

**Fix:** the Multiplier cell now reads `amount > 0 ? (val/amount).toFixed(2)+'×' : '—'`. A new shared `clampYearsInput(id, fallback)` reads an input's own `min`/`max` attributes, clamps to them, and — unlike a purely internal clamp — writes the clamped value back into the field, so what's displayed can't silently diverge from what every chart/table below it actually used. All three years fields now go through it.

**Verified live:**

```
lumpsum table has NaN (ls-amount cleared): false
su-years after typing 500 (expect 50): 50
su-years after typing -5: 1
su-years left empty, then read: fieldValue: '' (unchanged), corpus computed at fallback 20 (₹1.97 Cr, matches years=20 by hand)
```

---

## R19 — three charts had no x-axis extent caption

`l-pvi-chart` and `sp-growth-chart` (both Phase 3) already printed a `Year 1 … Year N` caption; `su-growth-chart`, `ls-growth-chart`, and `cb-depr-chart` (all Phase 3b) didn't. With no gridlines and an auto-scaled y-axis, a caption-less curve says nothing about the span it covers.

**Fix:** `su-growth-chart` and `ls-growth-chart` gained the identical live-updating `<span id="…-growth-end">` pattern `sp-growth-chart` already used; `cb-depr-chart` gained a static `Year 1 … Year 7` (its axis is fixed by R17's uniform 1–7 plot, not user input). This is explicitly *not* the value-range caption rule from Phase 3b's Charts section — that one is about amounts, and correctly still doesn't apply here (the tables below each chart carry those).

**Verified live:** `su-growth-end` read `Year 50` after the years-clamp test above set it to 50 (confirming the caption tracks the live input, not just a load-time default); `ls-growth-end` read `Year 20`; the depreciation card's `.chart-caption` read `Year 1` / `Year 7`.

---

## R20 — render hygiene

Two small issues, neither a user-visible bug today, both flagged in the spec as the kind of thing that becomes one:

- `updateStepupSIP()`'s per-year loop called `calcStepupSIP(monthly, stepup, cagr, y)` twice — once to read `.corpus`, once for `.totalInvested` — for what is the same simulation both times. Now destructured once per iteration. (The *separate* `calcStepupSIP(monthly, 0, cagr, y)` call added for R16's flat baseline is a genuinely different computation — different `stepup` argument — so it's additional, necessary work, not the duplicate this item was about.)
- `cb-depr-chart`'s `<div>` used to live inside `cb-depr-body`'s `innerHTML` template, which `renderCarLoan()` rewrites on every keystroke in the car-buying panel. `renderChart()`'s Phase 3b node-identity check correctly detected the resulting node replacement each time and re-created the `ResizeObserver` accordingly — correctly, but needlessly, once per character typed. `cb-depr-chart` is now a static sibling of `cb-depr-body` in the markup (inside `#cb-depreciation`'s `panel-card-body`), so only the table/note underneath gets rewritten; the chart's own node — and its observer — now persist across renders.

**Verified live:** called `renderCarLoan()` twice in a row with different inputs (simulating two keystrokes) and captured `document.getElementById('cb-depr-chart')` before and after — `sameNode: true` (previously would have been `false`, per Phase 3b's own description of this exact case). Re-confirmed the resale-chart values and geometry were unaffected by the markup move (see R17's verification above, run against the same hoisted structure).

---

## Verification performed (Phase 3c)

- **`node tests.js` — 39/39**, unchanged. `git diff --stat calc.js tests.js tests.html` against the base of this pass is empty — no calculation logic touched.
- **`node --check`** against the extracted inline `<script>` block — clean syntax after every edit.
- **Live in headless Chrome for Testing** (`Google Chrome for Testing 149.0.7827.55`, from the local Playwright cache), driven via CDP over Node 24's native `WebSocket` client — simpler than Phase 3b's hand-rolled RFC6455 client since Node's now ships one. All six items above were reproduced broken *before* their fix and confirmed correct *after*, not inferred from reading the diff:
  - R15's erase-then-repaint bug reproduced and fixed, both the one-history-point and zero-history paths.
  - R16's chart inversion reproduced with exact numbers matching the hand-calculated ones above, fixed, and re-verified; the `su-stepup` falsy-zero bug found and fixed as a direct consequence of trying to verify R16's own acceptance bar.
  - R17's 5-point → 7-point change confirmed by dot count and by extracting the actual cached series values against the rendered table.
  - R18's `NaN` fix and the years-clamp (upper bound, lower bound, and empty-field fallback all separately exercised).
  - R19's captions confirmed present and, for the two Grow-tab charts, live-updating.
  - R20's node-stability fix confirmed by identity comparison across two `renderCarLoan()` calls.
  - **Chart geometry re-checked after all the above changes**, not assumed intact: `cb-depr-chart` at desktop width measured `hostW: 890, viewBoxW: 890`; the step-up chart at a 375px mobile viewport measured `hostW: 313, viewBoxW: 313` with `document.documentElement.scrollWidth: 375` (no horizontal overflow); the Worth trend chart with a genuine 2-point history (post-fix, not the erased case) measured `hostW: 317, viewBoxW: 317`. No distortion regressed from the R15/R20 markup and cache changes.

---

## What this does NOT include

- **Phase 4** (D3/D9/D10) and **Phase 5** (D8/D11) — unchanged, still open.
- **B4, B5, B7** — unchanged, still open. **B6** — still open; R16 routed around its on-screen symptom without resolving the underlying ~1% convention gap between `calcStepupSIP` and `calcSIP`, and that gap will resurface wherever the two are compared directly next (the Buy-vs-SIP comparison already does, currently as a table, not a chart). **B8** (car-depreciation loan-balance overlay) — still open, unaffected by this pass.
- A PWA/service-worker install check — same `file://`/sandbox constraint noted in the Phase 3/3b reports. The cache-version bump (`v8` → `v9`) was applied but not walked against an installed instance.

---

## Files touched (Phase 3c)

- `index.html` — `clearChart()` (new); `renderWorthTrend()`'s two early-return paths routed through it; `updateStepupSIP()`'s flat-baseline source, `su-stepup` falsy-zero fix, single-call-per-year loop, and growth-end caption; `updateLumpsum()`'s Multiplier-cell guard and growth-end caption; `updateSIPPlanner()`/`updateStepupSIP()`/`updateLumpsum()` routed through the new `clampYearsInput()`; `renderCarLoan()`'s depreciation chart now plots years 1–7 (table stays at 5 rows) and calls `clearChart()` on the zero-price path; `cb-depr-chart` markup hoisted out of `cb-depr-body`'s `innerHTML` into a static sibling, with a caption added; `su-growth-chart`/`ls-growth-chart` gained caption markup. ~3,900 → ~3,970 lines.
- `sw.js` — cache `v8` → `v9`.
- `CLAUDE.md` — Charts section: cache-invalidation rule, index-spacing rule, x-axis-caption rule, static-host-node rule, B6/step-up plotting rule; checklist items 17, 19, 22 extended; new item 26 (years clamp).
- `TASK-UX-REDESIGN.md` — Remaining-work table (R15–R20 marked shipped), Phase 3c spec section marked shipped throughout, B6 row updated to describe the routed-around fix, status banner and cache-version references updated.
- `PHASE-3B-REPORT.md` *(this addendum)*.
