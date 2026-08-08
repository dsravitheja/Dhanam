# Phase 10 Report — Dhanam Car density & hierarchy

*Completed: 2026-08-08 · Executed from `TASK-UX-REDESIGN.md`'s Phase 10 spec (R45–R48), filed 2026-08-07 from direct owner feedback: "The Dhanam Car section feels too busy with too many details and numbers... hidable tiles, proper hero numbers/words." Same D4 wall-of-numbers defect R2 already fixed once in `hub-apartment`, extended here to all three `hub-car` sections that never got that pass.*

---

## Scope this ran with

Markup/CSS only, no calculation logic touched anywhere — `node tests.js` held at **65/65** before and after. Three sub-sections, each with its own density problem, plus a docs pass:

## 10a — Lease Tax Analysis hero (R45)

`renderCarCalc()` / `#car-scenario-cards`: added a live `.total-card` hero (`#car-hero`) above the three always-visible scenario cards. It reuses the exact `aAdv`/`bAdv` comparison that used to feed the old `car-summary-box`'s "Best option" line — not recomputed a second way — so it can never disagree with the cards below it. States the winning scenario's effective net/mo, the ₹ advantage in words ("saves you ₹X/mo over owning the car yourself"), and keeps the perquisite value directly underneath as the one figure that explains *why* the scenarios differ. It's dynamic by construction, not a fixed default: recalculated on every `renderCarCalc()` call, so it always tracks whichever option currently wins.

The three-card grid moved into a `.collapse-card` ("Compare all three scenarios ▾"), closed by default, at the same `#car-scenario-cards` spot — `buildCard()`'s own output is untouched.

`car-summary-box`/`#car-summary` was **dropped, not folded into the collapsed card**: every number it stated (perquisite, each scenario's effective net, the best-option verdict) was already on the hero or the card it restated, so keeping a third copy would have reintroduced exactly the density problem this phase exists to remove. The now-unused `.car-summary-box`/`.car-summary-row`/`.car-summary-lbl`/`.car-summary-val` CSS was deleted during integration once nothing referenced it (see below).

## 10b — Car Buying loan-analysis hero (R46)

`renderCarLoan()` / `#cb-cards`: mirrors the home-loan panel's hero pattern with a car-appropriate default — **5 years**, not 20, the shortest of the offered 3/5/7-year options and the closest to a typical car-loan term. `#cb-hero` (`.total-card`) shows the 5-year EMI, total interest, and total paid. A shared `tenureStats(yr)` helper feeds both the hero and the 3/5/7-year grid, so they can't independently drift out of agreement. The grid moved into a `.collapse-card` ("Compare 3 / 5 / 7-year tenures ▾"), closed by default. `cb-depreciation` (the resale-value table/chart) was left untouched, per spec — it's a separately-scoped, already-correct surface. Existing 0%-down-payment / 0%-rate early-return behavior is preserved (both hero and grid inherit it via `tenureStats`).

## 10c — Compare Cars ranked-card density (R47)

`renderCarCompare()` / `#cc-results`: each `.cc-rank-card` now shows a compact default — rank badge, car name/type, one hero number (net cost, large), one supporting line (`EMI ₹X/mo · ₹Y/km`). Everything else (resale credit, net cost after resale, raw cash outflow, signed tax-saved) sits behind a per-card "Full breakdown ▾" `.collapse-card`, toggled by a new `ccToggleDetail(i)`.

Rank-1 defaults open, ranks 2+ default closed — tracked as **independent per-card state** (`ccForceOpen`/`ccForceClosed` Sets keyed by the car's stable index), not an accordion, matching the same carve-out CLAUDE.md already documents for `hub-apartment`'s nested loan/advanced/SIP `.collapse-card`s: opening one card's breakdown must never close another's. This needed explicit state because `#cc-results`' `innerHTML` gets rewritten on nearly every keystroke elsewhere in the section (price/mileage edits) — without tracking which cards the user opened, a rebuild would silently reset everyone back to the rank-1-only default. Both Sets are cleared on `ccRemoveCar()`/hydration, since removing a car shifts every subsequent index.

## 10d — Docs & checklist (R48)

- CLAUDE.md: hero pattern documented in "Dhanam Car lease analysis specifics"; a new "Car Buying — Loan Analysis specifics" section added (didn't exist as its own subsection before this phase); the per-card disclosure model documented in "Compare Cars specifics" as a second, distinct pattern from the section-level `.collapse-card`s.
- Manual test checklist extended with items 37–39 covering the ≤~10-numbers-on-first-screenful bar (10a/10b) and the rank-1-open/others-closed default plus independent-disclosure behavior (10c).
- `sw.js`'s `CACHE` bumped `apt-cost-v13` → `apt-cost-v14`.

## Integration notes

This phase's implementing subagent hit the same stale-worktree-base issue as Phase 4b's (see `PHASE-4B-REPORT.md`) — its isolated worktree also branched from a point missing Phase 8b/9 — but caught it itself before starting, merging its branch onto `claude/phase-9-compare-cars`'s actual tip first. Its work landed cleanly on the correct base as a result.

Merging Phase 10 onto the (separately re-based) Phase 4b work produced one real conflict: `renderCarCalc()`'s old `car-summary-box` rendering vs. this phase's new `#car-hero`. Resolved in favor of Phase 10's hero — it's a strict improvement and the whole point of this phase — and cleaned up the CSS classes `car-summary-box`'s removal left orphaned. `sw.js`'s `CACHE` conflict was cosmetic: both phases bumped it independently to the identical string (`apt-cost-v14`), so it collapsed to one value with no actual disagreement to resolve.

## Verification

- `node tests.js` → 65/65, unchanged (no `calc.js` changes).
- Inline `<script>` block parses (`new Function()` in Node).
- `sw.js` syntax OK.
- All `svg.icon` usages carry `aria-hidden`/`focusable` post-merge (Phase 4b's R27 sweep covers the new hero/collapse markup too, since it ran after this phase's markup was in place).
- No duplicate DOM ids; `<div>` open/close tags balanced across the full file.
- Not walked in an interactive browser session by either subagent (no headless browser available) — **items 37–39 of the manual checklist should be walked by hand** (375px and desktop) before this is considered fully verified, per CLAUDE.md's own standard for anything DOM-coupled.
