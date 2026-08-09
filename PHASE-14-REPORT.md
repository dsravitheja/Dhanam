# Phase 14 Report — Financing modes: Loan, Lease, Cash on one engine

*Completed: 2026-08-09 · Implements `TASK-UX-REDESIGN.md`'s Phase 14 spec (R55–R61), needing/resolving **B13**. Continued and finished by a second agent instance after a prior instance was paused mid-task (by the user, for a session break — not because of a bug); this instance's job was to verify R55–R59 (already built), build/verify R60, and complete R61 (docs, checklist, report).*

---

## Handoff state at the start of this pass

Confirmed before touching anything: working directory `/Users/ravithejadasika/Documents/Dhanam/.claude/worktrees/agent-a87289d3a48de4b48`, branch `claude/phase-14-financing-modes`, tip commit `fc8ae76`, clean working tree, `node tests.js` passing 93/93. Three prior commits on this branch already carried R55–R59 and a first pass of the `CLAUDE.md` architecture section:

- `dd10cec` — `calc.js`'s `calcOwnershipCost({mode,...})`/`calcOwnershipCurve()` (mode-aware)/`calcLumpsumGrowth()`, the mode selector and lease-panel gating, `cb-*` absorbed into Compare Cars' per-car detail view and deleted.
- `acce585` — landing tile copy made mode-neutral; a sweep for stray `cb-*` references.
- `fc8ae76` — `CLAUDE.md`'s "Dhanam Car — financing modes" section, written mid-build.

## What was verified (already correct, not rebuilt)

**R55 — `calcOwnershipCost`/`calcOwnershipCurve`/`calcLumpsumGrowth` (`calc.js`).** Read the full implementation and cross-checked it against the spec's pseudocode line by line: lease mode is bit-identical to the old `calcLeaseNetCost`, loan mode correctly zeroes `taxSaved` and folds the down payment into `capital`, cash mode is `emi=0, capital=price, taxSaved=0`. Manually traced a worked example in Python (₹15L ICE car, 15 kmpl, 4yr, 10% rate, 10% residual, 31.2% marginal rate, ₹3L down payment for loan mode) and got sane, orderable results: **Lease ₹19.51L < Cash ₹20.54L < Loan ₹23.15L** net cost — lease wins on the tax shield, cash beats loan by the interest cost of financing, which is exactly the shape a real comparison should have. `node tests.js` already carried the R55 acceptance tests (residual=0 lease ≡ downPayment=0 loan EMI identity, `calcOwnershipCurve` endpoint = `calcOwnershipCost` netCost in all three modes) — all passing.

**R56 — Mode selector and lease gating.** `setCarMode()` only toggles `#car-lease-panel`'s `display` and re-renders; confirmed no field inside the lease panel itself changed shape. Landing tile copy ("Work Out My Next Car" / "Compare cars, and loan, lease or cash — whichever way you're paying") and the hub's outer section title ("Dhanam Car — Cost of Ownership") are both mode-neutral; the lease panel's own internal title ("Company Car Lease — Tax Analysis") is fine to keep lease-specific since it's no longer the hub's first title.

**R57/R58 — Loan-mode down payment, cash opportunity cost.** Confirmed the per-car down payment field renders only in `ccRowHtml()` when `carMode === 'loan'` (show/hide, not grey), and that `ccOpportunityCost(mode, price, downPayment, cagr, years)` charges opportunity cost on whatever capital is tied up **at t=0** in each mode — full price in cash, only the down payment in loan, ~₹0 in lease (a lease's structural lack of upfront capital, correctly treated as a real finding rather than an inconsistency to paper over). This is option (c) from B13 exactly as specced: an explicit reveal, off by default, identical formula in every mode.

**R59 — `cb-*` absorption and deletion.** `grep -n 'id="cb-' index.html` returns zero matches — every live `cb-*` DOM id is gone. The 10 remaining bare `cb-` string occurrences in `index.html` are all inside code comments explaining the migration history, which is intentional. Read `ccRenderLoanDetail()` end to end and confirmed all three carried-over capabilities: the `tenureStats()` helper is called, not re-derived; the depreciation table/chart renders off `price` alone in every mode (R13's rule, unaffected); R53's loan-balance overlay is present with both of its post-review Phase 13 bugfixes intact verbatim (balance series sliced to its own 5-year tenure, underwater reported as an actual first-through-last year range). Confirmed the chart hosts (`#cc-owncurve-chart`, `#cc-depr-chart`) and the tenure/cross-mode card containers are static siblings in the page's initial markup — outside `#cc-results`, which is the div that gets rewritten on keystrokes — so the R20 chart-host-stability discipline holds for the new UI too.

## What was built/verified as R60 (the main net-new work this pass)

R60 was already present in the codebase at the start of this pass (`renderCCCrossMode()`, `#cc-crossmode-card`) — this pass's job was to verify it was *actually correct*, not just present, per the task brief's instruction to trace real numbers.

**Verification method:** manually re-derived `calcOwnershipCost` by hand in Python for the same car under all three modes (see the R55 worked example above) and confirmed the cross-mode card's per-column figures match `calcOwnershipCost` called three times with `mode: 'lease' | 'loan' | 'cash'` and the *same* car/assumptions object (`ccOwnershipInput(car, a, mode)` — `mode` is the one field that varies across the three calls, everything else — price, rate, term, down payment, marginal rate, driver — is identical). Confirmed the shared reveal (`ccCrossRevealOpen`) applies the resale credit and opportunity-cost figures to all three columns in the same click, and that the resale credit itself (`calcCarDepreciation(price, years)`) is mode-independent by construction — `calcOwnershipCost`'s `resaleValue` line never reads `mode` — so there's no way for the ranking's fairness rule to quietly break as a side effect of a future change to one mode's cost path.

No code changes were needed for R60; it was already built to spec and the manual trace confirmed it produces sane, genuinely comparable numbers.

## What was built this pass — R61 (docs, checklist, report)

**`CLAUDE.md` updates** (the actual deliverable of this pass, alongside verification):

1. **"Core calculation functions"** — the `calcCarDepreciation`/`renderCarLoan()` line and the Compare Cars engine line both still named the retired `renderCarLoan()` and the pre-Phase-14 `calcLeaseNetCost`. Rewritten to name `calcOwnershipCost`, `calcLumpsumGrowth`, and `ccRenderLoanDetail()`, and to point at the Compare Cars section for the absorbed detail view instead of a "Car Buying" section that no longer describes live code.
2. **"Dhanam Car — Compare Cars specifics"** — every `calcLeaseNetCost` reference updated to `calcOwnershipCost` (with a note on where it was renamed from); five new bullets added covering R57 (per-car down payment), R58 (cash opportunity-cost reveal, both its per-car and cross-mode surfacing), R59 (the absorbed `ccRenderLoanDetail()` — tenure grid, depreciation chart, loan-balance overlay, all three cross-referenced to what they replace), and R60 (the cross-mode comparison itself, including the fairness-rule mechanics). The existing R49/R51/R52 bullets (`calcOwnershipCurve`, the cost-vs-value chart, the resale reveal) were updated to state they're mode-generalized rather than lease-only, without rewriting their still-accurate Phase 13 mechanics.
3. **"Car Buying — Loan Analysis specifics"** — this entire section described `renderCarLoan()`/`cb-*` as live, current code. Replaced with a short retirement note: what it used to do, the owner's no-duplication decision, what was migrated (with the "migrate then verify then delete" order stated), and where each capability lives now. Historical R46/R53 dates preserved for archaeology.
4. Two smaller drift points fixed: the R20 chart-host-stability rule's illustrative example (`cb-depr-body`/`renderCarLoan()`) and the `.table-scroll` convention's car-buying-table example both referenced dead code; both updated to name the current `cc-depr-body`/`ccRenderLoanDetail()` path while keeping the historical "originally cb-*" note for context.
5. Manual test checklist items **51–56** added (after item 50, which is annotated "superseded by items 52-53 below" rather than rewritten, since it's an accurate historical record of what Phase 13 shipped even though the section it describes no longer exists under that name): mode gating with no field bleed, absorbed-detail-view parity with the retired `cb-*` section, the loan-balance overlay's fixes surviving the move, the cash opportunity-cost reveal's tier-3/non-persisted pattern (mirroring items 45–50's resale-reveal checks), R60's cross-mode comparison, and chart-host stability extended to the four new static containers (`cc-owncurve-chart`, `cc-depr-chart`, `cc-tenure-cards`, `cc-crossmode-cards`).

**`sw.js`** — `CACHE` bumped `apt-cost-v17` → `apt-cost-v18`. **`BUILD_STAMP`** was already `'2026-08-09'` (bumped by Phase 13 earlier the same day) and needed no further change, since it's a per-day stamp and Phase 14 ships the same day.

**Tests** — no new pure-function behavior was added this pass (R60 needed no code changes), so no new `tests.js`/`tests.html` assertions were required. Confirmed `tests.html`'s existing Phase 14 assertions actually execute and pass by extracting its inline `<script>`, stripping the DOM-writing tail, and running it under Node against `calc.js` directly: **64/64 passed**, condensed from but equivalent in coverage to `tests.js`'s more granularly-split 93 assertions (multiple `tests.js` `ok()` calls per single `tests.html` block in a few places — e.g. the loan/cash `calcOwnershipCurve` endpoint checks are one combined assertion in `tests.html` vs. two separate ones in `tests.js`).

## Test count

- Before this pass: `node tests.js` → 93/93 (unchanged from the prior instance's handoff state).
- After this pass: `node tests.js` → **93/93**, unchanged — no calc.js edits this pass.
- `tests.html` (verified by extraction + Node execution, not a browser): **64/64**, unchanged.

## Manual QA status

**Not yet run in a real browser.** This pass (like the prior instance's) worked entirely by static code reading, Node-based test execution, and hand-traced arithmetic — no Chromium/Playwright/jsdom was available in this environment. Everything reported as "verified" above was verified by one of: reading the exact code path end to end, running the pure `calc.js` functions under Node with hand-picked inputs and checking the output by independent calculation, or running the existing/mirrored test suites. **None of items 1–56 in `CLAUDE.md`'s manual checklist — including the new 51–56 — have been walked in an actual browser against the live app.** That is explicitly the next pipeline stage (per this task's own instructions: QA and code review both have to pass before `TASK-UX-REDESIGN.md`'s Phase 14 header is marked shipped, which this pass deliberately did not touch), not something this pass claims to have done. In particular:

- The mode selector's live visual behavior (field show/hide, no layout jump, focus retention while typing) has only been confirmed by reading `setCarMode()`/`updateCCModeFields()`/`ccRowHtml()`'s logic, not by clicking through it.
- The cross-mode comparison's card layout and the reveal's live redraw have not been screenshotted or interacted with.
- 375px-width rendering, dot-circularity on the two absorbed chart hosts, and the underwater-note wording at real underwater/never-underwater scenarios are all unverified in an actual browser.

## Known gaps

- **`carMode` itself is not persisted.** Every reload of `hub-car` defaults back to Loan regardless of what a user last selected. This wasn't called out as a requirement anywhere in R55–R61 or B13, and the app's existing persistence rules would classify "which mode you're comparing in" ambiguously — arguably tier-1 (a fact about how this particular user is actually paying) or tier-3 (a view toggle, like the reveals). Left as-is since no owner decision exists on this either way; worth a future B-numbered question if it turns out to matter in practice.
- **`calcLumpsumGrowth` is not yet the Grow hub's implementation**, per the spec's own explicit scope note (R55: "this is one implementation for Compare Cars' new use, not yet the only one in the codebase" — `updateLumpsum` still computes the same formula inline). Not a gap introduced by this phase; the spec named it out of scope on purpose.
- **Real-browser QA and code review are both still open**, as stated above — this is the primary gap, not a secondary one.
- Everything else flagged as open in `PHASE-13-REPORT.md`'s own "What's still open" section (R8 accessibility sweep, R23/6c inline term definitions, the rest of R25/6e, Phase 7/R31) remains open and untouched by this phase, as expected.

## Deliberately not touched

Per this task's explicit instructions: `TASK-UX-REDESIGN.md`'s Phase 14 header still reads "❌ NOT STARTED" and B13's decision-table row is untouched — both updates are reserved for after QA and code review pass, not for this pass. Nothing was pushed to `origin`; no GitHub pull request was opened, closed, commented on, or otherwise touched. All work is local commits on `claude/phase-14-financing-modes`.
