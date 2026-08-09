# Phase 11 Report — Wave 0 parallel execution (R21/6a, R32/7b, R10-core)

*Completed: 2026-08-08 · Executed from `TASK-PARALLEL-EXECUTION.md`'s Wave 0 plan — the first wave of that document's dependency analysis over `TASK-UX-REDESIGN.md`'s remaining Phase 5/6/7 work, chosen because it's "today, zero blockers, fully parallel." Three agents ran concurrently in isolated `git worktree`s (two) and directly (one, doc-only), controlled by one integration agent, mirroring the Phase 4b/10 pattern those same worktrees were modeled on.*

---

## What shipped

**R21/6a — State-aware stamp duty & registration selector.** The highest-severity open item in `TASK-UX-REDESIGN.md`: the app hardcoded Telangana's stamp duty (4%) and registration (0.5%) rates and presented the resulting total with no regional qualifier, so a user outside Telangana got a confidently wrong number with nothing on screen looking broken. A `q-state` selector in Quick Estimate (defaulting to Telangana) now drives `q-reg`/`d-stamp`/`d-regfee` from a short, dated (2026-08-08), explicitly non-exhaustive `PROPERTY_STATES` table covering 9 major states/UTs. The active state's name is shown next to every figure it drives (`qr-state-lbl`, `d-stamp-hint`, `d-regfee-hint`) and flows into the PNG snapshot and Excel export headers too. All three rate fields stay directly, individually editable after a state is picked — the selector sets a default, it doesn't lock anything. Persists as `DS.propertyState` (a state code only, never the rates) unconditionally, mirroring Compare Cars' B11 "tier-1 fact about the user" reasoning rather than gating it behind the loan panel's opt-in "Remember my inputs" toggle. Telangana stays the unchanged default, so today's numbers reproduce exactly with nothing selected.

The implementing agent found and fixed two adjacent instances of the same bug class while building this: `toggleSection()`'s first-open of Detailed Cost Analysis was silently prefilling Telangana's split rates regardless of which state was actually selected, and both `exportSnapshot()` (PNG) and `buildDetailRows()` (Excel) hardcoded "Hyderabad"/"Telangana" in their output headers — an exported document is just as much "on screen" as the app itself for R21's purposes, so a Karnataka user's export was silently mislabeled the same way the live page used to be.

**R32/7b — Tax-aware modeling assessment.** Committed scope was the assessment only, per the spec's own acceptance criteria. **Recommendation: state-and-don't-model, not build.** Grounded in the actual code rather than the spec's generic framing: `calcStepupSIP`'s loop folds every month's contribution into one scalar `balance` with no way to later recover which installment cleared the 12-month LTCG threshold, so per-installment holding-period bucketing needs a genuinely different data shape (a ledger, not a modified scalar loop) — a real restructure, not a tweak. The B6 ~1% timing-convention gap between `calcSIP`/`calcStepupSIP` turns out to be a hard prerequisite rather than a footnote: at short horizons (a 5-year SIP) it's the same order of magnitude as the tax effect itself, verified against 5 sample scenarios computed directly from `calc.js`. A 20-year post-tax projection would also assert a specific redemption date and tax regime under law that has already changed three times since 2018 — a precisely-wrong number is worse than an honest, dated assumption stated in copy. The assessment drafted concrete on-screen copy for that alternative, in the app's existing caveat voice. No `calc.js` change shipped; a future "build" decision would be new, not a reopening of this one.

**R10-core — three small trust/consistency fixes**, the non-nav-coupled parts of R10 (the nav-tab overflow item stays bundled with the About-page/nav work in `TASK-PARALLEL-EXECUTION.md`'s Cluster A, deliberately deferred to a later wave):
- `renderCarLoan()`'s `tenureStats(yr)` helper now calls the shared `calcEMI()` (calc.js) instead of duplicating the EMI formula inline. Verified bit-identical across 7 tenure/rate/price combinations before and after (the only non-identical case, `rate === 0`, is unreachable — `renderCarLoan()`'s own early-return already excludes it).
- Six wide tables (`.pay-table`, `.disb-schedule-table`, three `.milestone-table` instances, `.depr-table`) now wrap in a new reusable `.table-scroll { overflow-x:auto; }` container, matching the existing chart-host overflow discipline.
- The hub-apartment Reset button now reads "Reset Home Inputs" instead of a bare "Reset" — `resetAll()` only ever touched that hub's own fields (Quick Estimate, Detail, Loan, Loan Disbursement), never `hub-car`/`hub-sip`/`hub-worth`, so the old label overstated its own scope.

---

## Why these three, together

Per `TASK-PARALLEL-EXECUTION.md` §1–2: all three are independently blocked by nothing else in the remaining work, and their file footprints don't overlap. R21/6a touches Quick Estimate's markup, the Detail panel's two hint spans, `blankState()`/persistence, `toggleSection()`'s first-open branch, `resetAll()`, the two export functions, and the init block. R10-core touches `renderCarLoan()`'s `tenureStats()`, six table wrappers, and one button label. R32/7b touches only `TASK-UX-REDESIGN.md`. No two of the three edit the same line range of `index.html`, which is why both worktree branches merged with zero conflicts (confirmed below).

---

## Integration notes

Both worktree agents independently hit and self-corrected the same stale-worktree-base trap flagged in `TASK-PARALLEL-EXECUTION.md` §3 and already seen twice in Phase 4b/10: each worktree's `HEAD` was pinned at an older commit (`6134c6e`, missing Phase 10's R45–R48 hero/density work). Both diagnosed this themselves before writing any code and reset/merged onto the real tip (`2d71323`) first — the third time this exact caveat has paid for itself, which is worth carrying forward as a permanent line in every future agent's brief rather than a one-off warning.

Both worktree branches were committed and merged sequentially onto `claude/phase-9-compare-cars` via `git merge --no-ff`, in the order R10-core → R21/6a. Both merges were clean — **zero conflicts**, confirming the file-footprint analysis above. `node tests.js` held at **65/65** before either merge and after both (neither branch touches `calc.js`).

R32/7b ran directly against the main tree rather than in a worktree, since it only ever intended to touch `TASK-UX-REDESIGN.md` — no merge step was needed for it; its edit is folded into this same integration pass.

## Verification

- `node tests.js` → 65/65, unchanged.
- Inline `<script>` block parses (`new Function()` in Node); `sw.js` syntax OK.
- No duplicate DOM ids; `<div>`/`<table>` tags balanced across the full file.
- `svg.icon` usages: 77 `class="icon"` against 78 `aria-hidden="true"` — this one-off gap is pre-existing (identical count on the pre-Wave-0 tip, `2d71323`), not introduced by this wave; not investigated further here.
- `sw.js`'s `CACHE` bumped `apt-cost-v14` → `apt-cost-v15` (R21/6a's agent, per the app's own documented cache-bust convention for a shipping UI change).
- CLAUDE.md updated: a new "State-aware stamp duty / registration" paragraph in the `hub-apartment` section, a `.table-scroll` note in the Charts section, and manual-checklist items 40–41.
- `TASK-UX-REDESIGN.md` updated: R21's summary-table row and 6a section marked shipped; R10's row/Phase 5 section marked partially shipped (three sub-items done, two — the assumptions-date line and nav-overflow affordance — still open); R32's row and 7b section carry the assessment's recommendation.
- **Browser QA (real Chromium, `python3 -m http.server`, full console-error monitoring): PASS, no failures.** Fresh load defaults to Telangana/4.5%; switching to Karnataka moves `q-reg` (6%), the total, and the "(Karnataka)" label live; a manual edit after selecting a state sticks (not overwritten); Detailed Cost Analysis's first open with a non-Telangana state selected prefills that state's split rates, not Telangana's; Reset Home Inputs returns everything to Telangana; a reload after selecting Karnataka round-trips the selection (`dhanam.v1`'s `propertyState` holds `"KA"` only, no rate anywhere in the blob); a PNG export with Maharashtra selected headers itself "Maharashtra," not "Hyderabad." R10-core: the Reset button reads "Reset Home Inputs"; none of the six wrapped tables show any layout breakage at desktop or 375px; the car-buying 5-year EMI hero and the 5-year card inside the expanded compare grid are identical (confirming they share `tenureStats()`), and a hand-calculated EMI matched the app's figure to rounding. A full click-through of all four hubs produced zero console errors. Full transcript retained by the QA agent; not reproduced here.**

## What's still open after this wave

Per `TASK-PARALLEL-EXECUTION.md`'s wave plan: **Wave 1** (Cluster A — 6b About page + 6d/6d-i prepayment tile + R10's nav-overflow sub-item + R45's build stamp, run as one sequential unit, not split) is next and still has no owner blocker. **Wave 2** (R8's accessibility sweep, then R23/6c's term-definition sweep, sequentially) follows. **Wave 3** (R31/7a) remains gated on **B10** (post-tax default, unanswered) and needs 6b to exist first. R32/7b is now resolved as "don't build," so nothing in Phase 7 needs R32 implementation work — only R31 remains, still blocked.
