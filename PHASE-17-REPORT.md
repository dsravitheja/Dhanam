# Phase 17 Report — Keyboard & ARIA pass (R8) and the landing orientation line (R25)

*Completed: 2026-08-15 · Implements `TASK-UX-REDESIGN.md`'s R8 (Phase 5) and R25's orientation-line half (Phase 6e), per `MID-PROJECT-REVIEW.md`'s recommendation to pick these up next. B10 (post-tax default in Dhanam Grow) was also answered the same day, per this document's own recorded lean — see the doc's status header and the B10/R31 rows.*

---

## What shipped

**R8 — Keyboard & ARIA accessibility pass**, app-wide:

- Every `.collapse-header`/`.adv-header`/`.sip-header` `<div onclick>` converted to a real `<button type="button">` — 17 conversions across `hub-apartment` (Detail-panel breakdown cards, `l-compare-card`, `adv-compare-card`), `adv-section`/`sip-section` headers, `hub-car` (`car-compare-card`, `cc-assumptions-card`, `cc-tenure-card`, `cc-crossmode-card`, `cc-chart-card`, the per-row `cc-detail-${i}` template), and `hub-worth` (`w-trend-card`) — **plus an 18th, `#adv-worth-card`** (the Phase 16 reverse Worth bridge card), found and fixed during integration — see **What the integrating pass caught**, below.
- `toggleCard(id)` now sets `aria-expanded` on the card's own `:scope > .collapse-header` button generically, which covers every `toggleCard()`/`toggleChartCard()` caller for free; `toggleSection()`, `toggleAdv()`, `toggleSIP()`, and `ccToggleDetail()` each set it explicitly, since none of them route through `toggleCard()`.
- `role="tablist"` + `role="tab"`/`aria-selected` on the hub nav and the Dhanam Grow SIP planner tabs, kept live by `switchHub()`/`switchSIPPlannerTab()`.
- The car financing-mode selector (Loan/Lease/Cash) uses `aria-pressed` instead — a toggle-button group choosing one setting, not navigation between panels of unrelated content the way the two tab bars are. Documented as a deliberate pattern choice, not an inconsistency, in CLAUDE.md's new **Keyboard & ARIA accessibility** section.
- 44px touch targets on tabs/mode-toggles/collapse-headers via one `@media(max-width:600px)` rule; one global `:focus-visible` ring reusing the existing gold `--accent` ring three pre-existing rules already established.
- Accessible-name gaps filled on `#l-remember`, `#w-hide-btn`, `#w-import-file`, and the icon-only remove buttons in `disbRemoveTranche()`/`ccRemoveCar()`.
- **Known gap left on record, not fixed**: the header-logo's clickable div is still keyboard-unreachable — a deliberate scoping call (it's redundant with the already-accessible `⌂ Home` nav tab), not an oversight.

**R25 (orientation-line half) — first-run landing-page orientation line:**

- `#landing-orientation`, one dismissible line above `.tile-grid` — not a modal, not a tour, matching the spec's explicit rejection of onboarding flows.
- Dismissal is a dedicated `dhanam.orientationSeen` localStorage key (`ORIENTATION_SEEN_KEY`), never part of `dhanam.v1`, never touched by `eraseState()` (verified by reading that function — it only ever removes `STORE_KEY`/`SEEN_KEY`) and never carried in the JSON backup export/import — tier-3 UI state per the spec's own instruction.
- `dismissOrientationLine()` hides the element and sets the key; an init-time check near the end of the script (right after the existing `rememberingInputs()` hydration) hides it again on any later load where the key is already set.
- The feedback composer (the other half of R25/6e) remains **deliberately** unbuilt — deferred past the beta per 6e-i's own sequencing decision, not a gap.

## The one new pure function / calc.js change

None. Both items are pure markup/CSS/UI-state changes; `calc.js` was not touched, and `node tests.js` stayed at **100/100** throughout both build passes and the integration.

## How this was built: two parallel subagents, and what the integration pass caught

Following `TASK-PARALLEL-EXECUTION.md`'s conventions (isolated worktrees per agent, one integration agent per merge), R8 was assigned to a Sonnet subagent and R25 to a Haiku subagent, launched concurrently in separate `git worktree`s, each briefed to touch only `index.html` and to leave `sw.js`/`CLAUDE.md`/`TASK-UX-REDESIGN.md`/phase reports to the integrator. Both were briefed to avoid each other's regions (R8 was told not to touch the landing page/tile grid beyond the hub-nav tab bar; R25 was told not to touch `.hub-nav`, `switchHub()`, or any collapse/toggle code).

**This validated, in practice, the exact caveat `TASK-PARALLEL-EXECUTION.md` §3 already carried forward from an earlier session:** *"verify a worktree's actual base commit before trusting its diff... both of today's subagents' worktrees branched from stale history rather than the intended tip."* It happened again, in both worktrees, independently:

- **The R8 (Sonnet) agent caught its own staleness and said so unprompted.** Its worktree had checked out Phase 15 (commit `9ea183c`), one phase behind the intended tip (`fe5b159`, Phase 16). It correctly reported that Phase-16-specific elements (`worthSnapshot()`, `#err-panel`, `#adv-worth-card`) didn't exist in its checkout, and that it therefore could not have swept them. This was the right call — better to build correctly against what's actually there and flag the gap than to guess at code it couldn't see.
- **The R25 (Haiku) agent did not notice or report its staleness, and its commit silently deleted a large amount of unrelated, already-shipped work.** Diffing its commit against the correct tip (`fe5b159`) rather than against `main` (itself further behind) revealed that alongside its genuine orientation-line addition, the commit's tree was **missing** — i.e., its diff against `fe5b159` showed as *deleted* — the entire R66 error-visibility panel (CSS, the `window.onerror`/`unhandledrejection` IIFE, `#err-panel`), the entire R65 reverse Worth bridge (`worthSnapshot()`, `renderAdvWorthBridge()`, `#adv-worth-card`'s markup, and `renderAdvLoan()`'s calls into it), and reverted `renderWorthProjection()`'s `calcNetWorthProjection()` call back to a hand-duplicated inline formula. **Its own `node tests.js` — 100 passed, 0 failed — did not catch any of this**, because `tests.js` only exercises `calc.js`'s pure functions; every deleted piece lived in `index.html`'s DOM/inline-script code, which the automated suite does not cover (see CLAUDE.md's **Testing** section — this is exactly the documented coverage boundary).

**Neither bad commit was merged as-is.** For both, the integrating pass diffed the worktree's commit against the actual current tip (`git diff fe5b159 HEAD`, not `git diff main`) before trusting it:

- R25's commit was discarded outright; only its genuine addition (the CSS rules, the markup block, `ORIENTATION_SEEN_KEY`, `dismissOrientationLine()`, and the init-time check) was hand-applied directly onto the correct tip.
- R8's commit merged cleanly via `git merge --no-commit --no-ff` (no textual conflicts — its stale base didn't overlap the lines Phase 16 had touched), but left one real gap: `#adv-worth-card` (added by Phase 16, after R8's worktree branched) still had a plain `<div class="collapse-header" onclick="toggleCard(...)">` instead of the `<button>` pattern R8 applied everywhere else. Fixed by hand, using the exact same conversion R8 used on its sibling card `#adv-compare-card` two lines below it in the markup — `toggleCard()` is generic (it finds `:scope > .collapse-header` on whatever card it's toggling), so this was a markup-only fix with no JS change needed.

**The practical lesson, recorded in `TASK-UX-REDESIGN.md`'s status header for the next person running parallel agents:** a subagent volunteering "my worktree looked stale" is a good sign, not a bad one — it means the check happened. The absence of that flag is not evidence the check passed; it's evidence it didn't happen. Diff every worktree commit against the actual intended tip yourself, every time, regardless of what the agent's own report claims.

## Files touched

- **`index.html`** — R8's 18 button conversions (17 by the subagent, 1 — `#adv-worth-card` — by the integrator), `toggleCard()`'s generic `aria-expanded` line, tablist/tab markup on both tab bars, `aria-pressed`/`role="group"` on the car mode selector, the 44px-touch-target media rule, the global `:focus-visible` rule, the accessible-name fixes; R25's `.landing-orientation`/`-text`/`-close` CSS, the `#landing-orientation` markup block, `ORIENTATION_SEEN_KEY`, `dismissOrientationLine()`, and the init-time hide check; `BUILD_STAMP` bumped to `'2026-08-15'`.
- **`sw.js`** — `CACHE` bumped `apt-cost-v21` → `apt-cost-v22`.
- **`CLAUDE.md`** — new **Keyboard & ARIA accessibility (R8, Phase 17)** section (placed next to the R66 error-visibility section, both being app-wide infrastructure rather than hub-scoped); a new paragraph under the Hub/tab model section documenting the orientation line; the `sw.js` cache-name mention bumped; manual checklist items **61** (R8 verification) and **62** (R25 verification) added.
- **`TASK-UX-REDESIGN.md`** — status header extended with a Phase 17 paragraph (including the stale-worktree finding, on the record for future parallel-agent runs); B10 marked answered; R31's blocked-by cleared; R8 and R25's table rows marked shipped; Phase 5 and Phase 6/6e section text updated to match; the "Remaining work" summary paragraph rewritten for 2026-08-15.
- **`PHASE-17-REPORT.md`** — this file.

Not touched: `calc.js`, `tests.js`, `tests.html`, `manifest.json`. No financial calculation changed anywhere.

## What was verified, and how

- **`node tests.js`: 100 passed, 0 failed** — checked before either subagent started, after each subagent's own build pass (self-reported: R8 100/100 baseline... actually 95/95 in its stale Phase-15 checkout, since Phase 16 hadn't shipped there yet; R25 100/100), and again after every integration edit (the R25 hand-reapplication, the R8 merge, the `#adv-worth-card` fix, the doc/sw.js bumps). Unchanged throughout — expected, since neither item touches `calc.js`.
- **Syntax**: the inline `<script>` was extracted and run through `node --check` after the R25 reapplication and again after the R8 merge — clean both times.
- **No duplicate DOM ids**: `grep -oE 'id="[a-zA-Z0-9_-]+"' index.html | sort | uniq -d` returns nothing, checked after the final merge.
- **Zero remaining unconverted collapse headers**: `grep -c '<div class="collapse-header"\|<div class="adv-header"\|<div class="sip-header"' index.html` → 0, confirming the `#adv-worth-card` fix closed the one gap R8's stale checkout left.
- **Phase 16 survived intact**: `grep -c "err-panel\|worthSnapshot\|renderAdvWorthBridge"` and equivalent checks were run after both the R25 reapplication and the R8 merge, confirming nonzero/expected counts at each step — this is the check that would have caught the R25 regression even without manually diffing, and is now written into this report as the thing to re-run if a similar situation recurs.
- **`eraseState()` and the backup export/import path were re-read directly** to confirm `ORIENTATION_SEEN_KEY` appears in neither — it only appears in its own `const` declaration, `dismissOrientationLine()`, and the init-time check.

## Deliberately left undone / could not verify

- **No browser was run** — this environment has none. Every on-screen claim above (focus rings actually rendering, the tablist/tab announcing correctly to a screen reader, the orientation line's actual placement/wrapping at 375px, the 44px touch targets measuring correctly on a real device) is argued from code reading and the `node`-based checks only. Manual checklist items 61 and 62 name this gap explicitly, matching item 60's own precedent from Phase 16.
- **R23/6c** (inline term definitions) remains unstarted, and is now — per the doc's own sequencing note — the item best picked up next, since it was explicitly specced to build on R8's now-established focus/ARIA pattern rather than invent its own.
- **The feedback composer** (the other half of R25/6e) remains undone by design, not oversight — deferred past the beta.
- **R31/7a** is now unblocked (B10 answered) but not started.
- **The header-logo click target** remains keyboard-unreachable — named as a known, deliberately out-of-scope gap in both this report and CLAUDE.md's new R8 section.
