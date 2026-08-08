# Phase 3 Report — Density & Hierarchy, plus the Phase 2 Leftovers (R1, R3, R6)

*Completed: 2026-07-25 · Executed from `TASK-UX-REDESIGN.md`'s Remaining-work table (R1–R4, R6) and the Phase 2 / Phase 3 specs it points to, plus `UX-ANALYSIS.md` §2.2 for the projection bridge's rationale.*

---

## Scope this ran with

The task brief's Remaining-work table put five items ahead of everything else: R1 (Worth projection bridge), R2 (hero-answer-first density pass), R3 (Worth trend chart), R4 (SIP-growth / principal-vs-interest charts), and R6 (Worth Excel export). R1, R3 and R6 were Phase 2 leftovers, deliberately deferred in that session because they're read-layers over data the persistence primitive already collects — the risk was in the balance sheet and the storage layer, not in these. R2 and R4 are Phase 3 proper. All five shipped together in this pass, since R3 and R4 share one chart helper by design and R1's projection card sits in the same hub as R3's chart.

Not in scope: Phase 4 (brand/PWA integrity) and Phase 5 (accessibility/ARIA) — both still fully unstarted; see the Remaining-work table for R5, R7–R10.

---

## R3 + R4 — one chart helper, three call sites

Per the task brief's explicit reuse note ("R3 and R4 are the same problem — write one small inline-SVG line/area helper and call it three times"), the first thing built was `chartSvg(series, opts)`: a single dependency-free SVG string-builder that takes one or more `{ values, color, area }` series on a shared min/max scale and returns an `<svg preserveAspectRatio="none">`. `preserveAspectRatio="none"` is what lets the same markup fill a 960px desktop card or a 375px phone width without ever causing horizontal scroll — the SVG stretches to whatever box the surrounding CSS gives it (`.dhanam-chart { width:100%; height:140px }`).

That stretch has a catch I initially got wrong and caught in review (see below): if the viewBox width doesn't match the container's actual pixel width, the stretch is non-uniform and dots render as ellipses. So callers go through **`renderChart(targetId, series, opts)`**, which measures the host and sets the viewBox to match — filling the container *and* drawing at 1:1. `toggleChartCard()` handles the collapsed-card case, where a hidden host would otherwise measure 0.

Two edge cases the acceptance criteria called out by name, both handled inside the helper itself so every call site gets them for free:

- **A single data point** draws one dot, no path — a chart with one point has no "shape" to show, and a degenerate zero-length `<path>` would either be invisible or throw.
- **A long series** (120 history entries is the Worth history cap) only dots the last point instead of all 120, so the chart stays legible instead of a wall of circles; the line and filled area still draw across the full length.

Three call sites:

- **Worth trend chart (R3)** — `renderWorthTrend()`, a `.collapse-card` closed by default (per D4 and the existing change-tile design: the tile answers "am I up or down," the chart answers "what shape has it been"). Absent entirely with zero history; with exactly one point it shows a "not enough history yet" message instead of an empty chart box; two or more points get a real gold line/area chart captioned with the first/last dates and the value range.
- **SIP corpus growth curve (R4, Dhanam Grow)** — added to the Monthly SIP tab between the hero result card and the milestone table: corpus (gold, filled) vs. amount invested (dim grey, unfilled line) year by year, reusing the exact `calcSIP` calls the hero and milestones already make.
- **Principal-vs-interest chart (R4, loan panel)** — a new panel-card in `section-loan` showing cumulative principal (gold) vs. cumulative interest (red) paid, year by year over the 20-year hero tenure, reusing `loanAtYear` the same way the existing scenario cards do.

All three are additive rendering — no calculation function changed, so `node tests.js` stays untouched at 39/39.

---

## R1 — the projection bridge

The brief flagged one real gap up front: projecting net worth forward needs a monthly-savings figure the balance sheet doesn't collect, and flagged that a dedicated `w-*` field is simpler than reading the Grow hub's value. Went with that. New "Projected Net Worth" panel-card, visible once the balance sheet has any non-zero field:

- **Growth side** reuses `calcSIP` twice in spirit: existing investable assets (everything except property, since assuming a property-appreciation rate is exactly the kind of tier-2 guess this hub has no basis to make) compound as a lumpsum (`investable × (1+cagr)^years`), and a new monthly-savings input compounds through `calcSIP` itself as ongoing contributions. Property is held flat and added back unchanged.
- **Debt side** reuses `loanAtYear` with a twist that avoids needing data the balance sheet never asked for: rather than requiring the *original* loan amount/tenure, it treats today's outstanding liability total as a fresh principal amortizing over a user-given "years to become debt-free" at a user-given rate. That's a faithful model of "what happens if this debt keeps amortizing normally from here" without inventing a second loan-detail form inside Worth.
- **Tier split, applied consistently with the existing `l-rate` precedent:** the monthly-savings figure and "years to debt-free" are facts about the user and always persist; the two rate assumptions persist only when changed from their defaults (10% growth, 9% debt rate), so an untouched field keeps tracking the app's maintained default instead of freezing today's guess.
- Hero card shows the +10-year figure (an opinionated middle default, same convention as R2's 20-year loan hero) plus a 5/10/20-year row; a negative projection renders with a `−` prefix and red, matching how the main net-worth hero already handles a negative position.
- Hidden entirely on an empty balance sheet — nothing to project yet, and the acceptance bar was "never a fabricated number," same as every other Worth empty state.

---

## R6 — Worth Excel export

`buildWorthRows()` + `exportWorthExcel()`, following the `buildDetailRows()`/`buildLoanRows()` pattern exactly: an array of row-arrays into the existing `buildExcel()`/ZIP-building code, no new export machinery. Sheets: assets (only non-zero rows, plus total), liabilities (same), net worth, and — when present — the full `history` array, so a downloaded workbook captures more than the live balance sheet does. A new "📊 Export Excel" button sits in the Worth hub's "Your data" card next to the JSON backup controls.

---

## R2 — hero-answer-first density pass

The brief named the exact three areas and the exact fix: loan scenarios, advanced prepayment, and Buy-vs-SIP each get **one hero answer** in `total-card` style (opinionated default: the 20-year scenario, and for Buy-vs-SIP the "Moderate" 12% CAGR bucket that already existed elsewhere in the same panel), with the full 3×N comparison grid moved behind a `.collapse-card` closed by default.

- **Loan scenarios** — new hero card (20-year EMI, total interest, total paid) sits where the always-visible 3-card grid used to be; that grid plus the custom-year-analysis section now live inside a "Compare 15 / 20 / 30-year scenarios & custom year" collapse card. The principal-vs-interest chart (R4) sits between the hero and the collapse card, so the first screenful is: one EMI number, one chart, done — down from the ~36 numbers the old 3-card-plus-custom-year layout rendered unconditionally.
- **Advanced prepayment** — this section was already gated behind its own top-level toggle (`adv-section`, closed by default), but opening it dropped the user straight into a 3-card comparison grid. Now opening it shows a hero (interest saved, new tenure, extra/year) first, with the 3-card grid moved into a second, nested "Compare 15 / 20 / 30-year tenures" collapse card.
- **Buy vs. SIP** — same pattern: a hero (SIP advantage/deficit vs. buying, EMI, corpus) leads, with the full CAGR × tenure grid and the custom-scenario inputs moved into a "Compare across CAGR & tenure scenarios" collapse card.

All three heroes and their nested collapse cards correctly hide (not just render dashes) when there's no loan amount yet, matching how the sections already behaved before this pass — verified by reading the `!loan` early-return branch in each of `renderLoans()`/`renderAdvLoan()`/`renderSIPComparison()`, which now call `hide()`/`show()` on the new elements alongside the existing guidance-message logic.

No calculation changed — every hero number is computed with the exact same `calcEMI`/`loanAtYear`/`simulateLoan`/`calcSIP` calls the (still-present, still-reachable) comparison grids already used, just for one scenario instead of three.

---

## Verification performed

- `node tests.js` — **39/39**, unchanged from before this pass (no `calc.js` edit; every new number reuses an existing pure function).
- Full inline-`<script>` block extracted and run through `node --check` after each major edit — catches syntax errors without needing a browser.
- Every new DOM id was cross-checked programmatically: each of the ~30 new element ids introduced by R1/R2/R3/R4/R6 appears in the markup exactly once and is referenced by at least one `el()`/`set()`/`show()`/`hide()`/`onclick` call, and vice versa — no dangling references either direction.
- **Live in a real browser**, via a zero-dependency CDP driver (same approach as Phase 2's) against the cached Chrome-for-Testing binary. `http://localhost` navigation hung indefinitely for reasons unrelated to the app (Chrome blocking on a network-dependent startup check with no general internet egress available in this sandbox — a plain `data:` URL navigated fine, which pointed at the cause); switching the driver to navigate `index.html` directly via `file://` sidestepped it and worked cleanly. Everything below was run this way, at both 1000px and 375px widths, with screenshots captured at each step:
  - Loan panel: opening `section-loan` shows the 20-year hero (`₹83,113/mo`, `₹1.05 Cr` interest, `₹2.23 Cr` total) and the principal-vs-interest chart immediately, with the "Compare 15/20/30" card present but closed (`compareOpen: false`); opening it renders all 3 scenario cards and all 3 custom-year cards.
  - Advanced prepayment and Buy-vs-SIP: opening each shows its hero (`₹20.55 L` interest saved / `+₹6.31 Cr` SIP advantage) with its own comparison card closed underneath, each with all 3 cards present once opened.
  - **Found and fixed one real bug this way, not by inspection:** dropping the loan total to zero while Advanced/SIP were open correctly hid the main loan hero, but left the Advanced and Buy-vs-SIP heroes showing stale numbers. Root cause: `renderLoans()`'s `!loan` branch `return`s before reaching the existing "re-render Advanced/SIP if open" calls at the end of the function — a pre-existing control-flow gap (those two sections already went stale/unrendered in this state before this session; R2 just made the staleness visible as a wrong-looking hero instead of a wrong-looking grid). Fixed by moving those two calls into the early-return branch as well; re-ran the same check afterward and confirmed all three heroes now hide together.
  - Grow hub: the corpus-growth chart renders with two visibly distinct series (gold corpus, grey invested) and its milestone table's year-20 figure matches the chart and hero exactly (`₹99.91 L`).
  - Worth: empty state hides the projection card and trend card; filling a balance sheet (₹1.45 Cr assets, ₹58.00 L liabilities) produces a projection hero whose numbers were hand-verified against `calcSIP`/`loanAtYear` by computing them independently (+10-year figure landed on `₹2.74 Cr` after adding a ₹20,000 monthly SIP input, matching a manual calculation to the rupee); a negative sheet (₹1.00 L assets, ₹80.00 L liabilities) renders `−₹79.00 L` in red with the minus sign, a red "Down" change tile, a declining trend line, and zero occurrences of `NaN`/`Infinity`/`undefined` anywhere in the hub's HTML; `buildWorthRows()` produces a net-worth row and a history section; "Hide amounts" blurs both the projection inputs and the trend-chart SVG.
  - 375px: no horizontal page scroll (`scrollWidth ≤ 376`) on the Worth hub, the loan panel, or the SIP planner.
- The CLAUDE.md manual checklist items 18–22 added below reflect exactly what was just walked by hand this way — they are not aspirational.

---

## Post-implementation review — four defects found and fixed

A dedicated review pass over the diff (rather than over my own summary of it) turned up four real problems, all introduced or exposed by this phase. Each was reproduced in the browser before fixing and re-verified after.

1. **Empty-state guidance regression (introduced by R2).** The loan panel's "Enter total property cost above to calculate EMI scenarios." message lived inside `#l-cards`' own `innerHTML`. R2 moved that grid into a collapse card that is *hidden* when there's no loan — so the message became unreachable and the panel rendered inputs, then a blank gap, then the Advanced section. Confirmed by screenshot and by asserting zero visible `.note-text` in the panel. Fixed by giving the guidance its own element (`#l-empty`) outside the collapse card.

2. **Charts drew distorted (introduced by R3/R4).** `preserveAspectRatio="none"` with a fixed 600-unit viewBox meant an 890px-wide container scaled x by 1.48× and y by 1×. Measured: every dot rendered as a **7.42 × 5.00 px ellipse** (aspect 1.48) and stroke width varied with line direction. Fixed by measuring the host and drawing at 1:1 via a new `renderChart()` wrapper, plus `vector-effect="non-scaling-stroke"`. Re-measured after: aspect **1.00**, dots 5×5. Because a *hidden* host measures 0 (the trend chart lives in a collapsed card, so this was its permanent state), added `toggleChartCard()` to expand-then-redraw.

3. **The trend chart had no readable scale.** Zero axis labels, zero gridlines, and a y-axis auto-scaled to the data — measured, a **1.1% change consumed 89% of the chart height**, visually indistinguishable from a doubling. In a net-worth chart this is a real honesty problem, and it's the one chart whose values appear nowhere else on the page (the SIP and loan charts have their tables/heroes alongside). Fixed by printing the value range in the caption, marked `w-amt` so "Hide amounts" still covers it. Deliberately *not* zero-based: forcing a ₹0 baseline would flatten a property-heavy sheet into a useless straight line.

4. **The projection silently assumed a large undisclosed cash outflow.** Setting "years to become debt-free" amortizes the liabilities to zero, but the required repayment was never shown anywhere. With the doc's own worked example — ₹58.00 L cleared over 5 years — that is **₹1,20,398/mo of repayments**, on top of the ₹20,000/mo of savings the user entered, and the card said nothing about it. The model itself is defensible (EMI comes from income, savings are surplus), but presenting a projection that quietly requires ₹1.4 L/month of cash flow is not. Fixed with an explicit line stating the implied repayment and that it's "paid from income, which this balance sheet doesn't track"; it hides when liabilities are zero.

Also removed a dead `zeroBase` option in `chartSvg()` that no caller ever passed.

Re-verified after all four fixes: `node tests.js` 39/39, no `NaN`/`Infinity`/`undefined` in the Worth hub, hide-amounts covers both new amount-bearing elements, and 375px still has no horizontal scroll with charts at 1:1.

**One unrelated pre-existing issue this surfaced, worth noting for R5:** with no network egress, the page **hangs in `readyState: "loading"` indefinitely** — the Google Fonts `@import` blocks stylesheet load, which blocks script execution, so the entire app never initializes. This is not a slow-fonts-degrade-gracefully situation; it's a hard hang until the request times out. R5 already calls for self-hosting the fonts on privacy grounds; this is a second, arguably stronger reason.

## CLAUDE.md updated

- Hub list: `hub-worth`'s entry now names the trend chart, projection bridge, and Excel export as shipped instead of listing them as missing.
- New **Charts** subsection documenting `chartSvg()` — its signature, its two degenerate-input behaviors (single point, >24 points), and the rule that any new chart should call it rather than rolling another SVG builder.
- **Dhanam Worth specifics** section gained three bullets (trend chart, projection bridge, Excel export) and the "Hide amounts" blur-selector bullet now also names the projection card's inputs and the trend-chart SVG, both of which had to be added to `.amounts-hidden`.
- **Excel export** section's function list now includes `exportWorthExcel()`/`buildWorthRows()`.
- Manual checklist: fixed a stale item 2 (said the Worth tile "does nothing and looks dimmed," which stopped being true in Phase 2 but was never corrected), and added items 18–22 covering the projection bridge, trend chart, Worth Excel export, the hero-answer-first density pass, and chart overflow/edge-count checks at 375px.
- Corrected two more small staleness bugs found while editing, unrelated to this phase's features but noticed in passing: the `sw.js` cache-version mention (said `apt-cost-v4`, actually `v6` before this session's bump) and the `index.html` line-count estimate (said ~2800, actually ~3700 even before this session's growth).

---

## What this does NOT include

- **Phase 4** (D1 already done in Phase 2; D3/D9/D10 — icon set, PWA asset/logo/font integrity, export rebranding — still open, tracked as R5/R7/R9).
- **Phase 5** (D8/D11 — keyboard/ARIA pass, trust/consistency nicks — still open, tracked as R8/R10). R8 now additionally covers the new collapse headers this phase introduced (loan/advanced/SIP compare cards, the Worth trend-chart card).
- **B4, B5, B6, B7** — still open owner decisions, unchanged by this session. B6 in particular (the `calcStepupSIP`/`calcSIP` ~1% convention gap) has now been open since Phase 1.
- A **PWA/service-worker check** (item 10 on the existing checklist) — `file://` navigation was used for all of this session's browser verification precisely because `http://` navigation hung in this sandbox (see above), and service workers require `http(s)://` to register at all. The cache-version bump was applied but not walked by hand against an installed PWA instance; that one item is still owed on a machine with normal network access.

---

## Files touched

- `index.html` — `chartSvg()`/`renderChart()`/`toggleChartCard()` chart helpers (~60 lines); Worth projection card, trend-chart card, and Excel-export button (markup + `renderWorthProjection()`/`renderWorthTrend()`/`buildWorthRows()`/`exportWorthExcel()`/`clearWorthProjFields()`); loan-panel hero + principal-vs-interest chart + "Compare" collapse card; advanced-prepayment hero + nested collapse card; Buy-vs-SIP hero + nested collapse card; SIP-growth chart in Dhanam Grow's Monthly tab; five new CSS rules (`.dhanam-chart`, `.chart-caption`, `.chart-legend*`) and one blur-selector addition; plus the four review fixes above (`#l-empty` guidance, 1:1 chart measurement, trend-chart value range, projection repayment disclosure). 3,335 → ~3,760 lines.
- `sw.js` — cache `v6` → `v7`.
- `CLAUDE.md` — sections listed above.
- `TASK-UX-REDESIGN.md` — Remaining-work table (R1–R4, R6 marked shipped), Phase 2 and Phase 3 status headers and sub-item statuses, stale cache-version reference corrected.
- `PHASE-3-REPORT.md` *(new, this file)*.
