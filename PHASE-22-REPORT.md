# Phase 22 Report — "Why a lease?" answered before anything is typed (R74–R77)

*Completed: 2026-09-07 · Implements `TASK-UX-REDESIGN.md`'s Phase 22, filed 2026-09-06 from `UX-ANALYSIS.md` §Strategic-4 (owner + potential-user feedback: `hub-car` answered "how should my employer pay me", users ask "is this better than a loan"). One new pure helper in `calc.js` (`calcLeaseMarginalRate()`), extended to two after code review (`calcTaxableIncome()`) — no new financial model, no new persisted key.*

---

## What shipped

**R74 — Additive B retired.** `car-scenario-cards` drops from three scenarios to two (Baseline, Carve-out). D17 found the third scenario ("car on top of full CTC") didn't hold the employer's spend constant, so it was free money by construction and won 7 of 7 tested combinations — a comparison where one branch structurally cannot lose tells the reader nothing. It survives as one caveat-list line, not a scenario. Retiring it also un-masks the hero's honest zero-state: at this hub's own shipped defaults, taxable income sits under the §87A threshold, so "Carve-out saves you ₹0/mo" is the true answer.

**R75 — The "why a lease?" glance (`#lg-card`).** Sits above the mode selector, visible in all three financing modes (B19) — a Loan-mode visitor, the default since Phase 14, is exactly the person who doesn't know a carve-out lease exists. Two cards, same illustrative car — *Car Loan* and *Company Carve-out Lease* — with worked defaults (`lg-basic` ₹1,00,000, `lg-price` ₹15,00,000) so it renders a complete, zero-interaction answer (B18). The mechanism is shown as line items, not just a total: each side's EMI, that the loan is paid from already-taxed take-home, that the lease is taxed on a ₹5,000–₹10,000/mo perquisite instead, the shield itself, the residual buyout, and the net difference over the term. Three states in the shield's explanatory copy — the two negative ones are the point: genuine zero-tax income, a real negative shield (EMI below the perquisite, signed and never clamped), or the shield actually applying.

**R76 — One source of truth for the lease's derived parameters.** Before this phase, the marginal tax rate was entered twice — an exact scenario-tax comparison inside the tax panel, and a flat hand-typed `cc-marginal-rate` field (default 31.2%) inside Compare Cars — with nothing reconciling them, so the same lease could cost two different amounts depending which part of the hub you read. `calcLeaseMarginalRate()` (`calc.js`) is now the one implementation, called by the glance, `ccOwnershipInput()`, and the cross-mode card. `cc-marginal-rate` and `cc-has-driver` are retired; the driver flag now reads `car-has-driver` from the Company Car Lease panel via `carLeaseProfile()`.

**R77 — The cross-mode card states its own mechanism, and prices lease/loan separately.** `renderCCCrossMode()`'s Lease column now shows a signed **Tax Saved** line (previously computed by `calcOwnershipCost` and silently discarded by the renderer). `cc-lease-rate` and `cc-loan-rate` are now separate fields (previously one shared rate quoted a company lease at retail car-loan pricing, flattering it). A new caveat-list line names the employer-tie/foreclosure risk. The glance links to Compare Cars' shortlist via a scroll-to button rather than restructuring render order.

## Files touched

- **`calc.js`** — `calcLeaseMarginalRate()` (the shield/marginal-rate derivation, with a `zeroTax` field added in code review) and `calcTaxableIncome()` (standard deduction + old-regime 80C cap, extracted in the third review pass and shared with `renderCarCalc()`'s `scenarioCalc()`). Both exported.
- **`index.html`** — `car-scenario-cards` reduced to two scenarios; `#lg-card`/`renderLeaseGlance()` added, including an `#lg-empty` guard for a blank/zero car price; `cc-lease-rate`/`cc-loan-rate` split; `cc-marginal-rate`/`cc-has-driver` fields removed; `renderCCCrossMode()`'s Tax Saved line added; `carLeaseProfile()`/`ccAssumptions()` extended; a handful of small shared helpers added (`carRegime()`, `signedColor()`) to remove duplication code review found; `ccComputedRows()`'s rows now carry the `input` object alongside `result` so callers stop rebuilding it; `renderCCOwnCurve()`/`renderCCChart()` take an optional `rows` param to avoid recomputing per render.
- **`sw.js`** — `CACHE` bumped `apt-cost-v24` → `apt-cost-v26` (v25 mid-phase, v26 at final ship after the third review pass).
- **`CLAUDE.md`** — new "Dhanam Car — 'Why a Lease?' glance" and "`calcLeaseMarginalRate()` and `carLeaseProfile()`" sections; the "gate, don't simplify" rule amended (gate depth; never duplicate a derived parameter; never let the deep model be the first thing a first-time visitor meets); manual checklist items **66–68** added; `cc-*` naming-convention entries updated for the retired ids.
- **`TASK-UX-REDESIGN.md`** — B18/B19 marked answered; Phase 22's header, R74–R77, and the "Remaining work" status header all marked shipped.
- **`UX-ANALYSIS.md`** — §Strategic-4, D17, D18 (pre-existing from this session's filing, not newly added by this report).
- **`PHASE-22-REPORT.md`** — this file (replaces the working session's `phase22summary.md` scratch note).

Not touched: `manifest.json`, `tests.html`'s structure (assertions carried over automatically since it loads `calc.js` directly).

## Review history

**First code-review pass** (during implementation) found 7 issues, all fixed: stale Compare Cars state on lease-panel edits, an unbounded old-regime marginal-rate cliff, a missing 80C deduction, a misplaced pure function, triplicated derivation logic, a double-render, redundant DOM reads.

**Second code-review pass** found 9 more issues, all fixed:

1. `calcLeaseMarginalRate()` now returns a `zeroTax` field (`calcIncomeTax(taxableFull, regime) === 0`), checked independently of the shield. The glance's shield-note previously read `marginalRate === 0` as "you pay no tax," which also fires on the coincidence of `leaseEmi === perquisite` (a real car/rate/residual combination with nothing to do with the user's tax bracket) — that case now gets its own, separate message.
2. `ccOwnershipInput()`'s `annualRate` no longer silently falls back to the lease rate in cash mode (cash never reads a rate; was harmless today, a latent landmine).
3. The shield derivation is only computed in lease mode (unused elsewhere); `ccComputedRows()` is computed once per `renderCarCompare()` call and threaded through instead of being recomputed by each of `renderCCOwnCurve()`/`renderCCChart()`.
4. A markup comment near `#cc-crossmode-card` describing the retired single-rate model was corrected.
5. A comment in `renderCarCalc()` overstated when `setCarMode()` calls it; corrected, along with an unrelated dead reference to a nonexistent `ccCrossModeStats()` (should be `renderCCCrossMode()`) found while editing the area.
6. Added a dated comment (FY2025-26) on the new `stdDed`/80C constants.
7. `renderCCCrossMode()` now reads the Lease column's derived marginal rate off the input object `ccOwnershipInput()` already built, instead of calling `calcLeaseMarginalRate()` a second, independent time.
8. `renderLeaseGlance()` now sources term/rates/residual/driver from `ccAssumptions()`/`carLeaseProfile()` instead of re-reading those DOM fields with its own inline fallbacks.
9. A new `.lg-grid` CSS class duplicated the pre-existing `.grid-2` (identical shape, only the mobile breakpoint differed); deleted, both usages switched to `.grid-2`.

`node tests.js`: 112/112 (110 → 112, two new pinned cases for the `zeroTax` fix).

**Third code-review pass** (high effort) found 9 more issues — 8 fixed, 1 deliberately skipped:

1. **Real bug, fixed:** `renderLeaseGlance()` had no guard for `lg-price <= 0` — a cleared/zero car price still rendered a confident "Loan saves ₹X"/"Lease saves ₹X" headline driven entirely by a phantom perquisite tax on a nonexistent car. Added an `#lg-empty` guidance message and an early-return guard, matching Compare Cars' own `c.price > 0` blank-row filter.
2. **Fixed:** extracted `calcTaxableIncome(grossAnnual, regime, epfAnnual, extraIncome)` into `calc.js` — the standard-deduction/80C formula was independently duplicated inline in both `calcLeaseMarginalRate()` and `renderCarCalc()`'s `scenarioCalc()`. Both now call the one shared function. 5 new pinned tests.
3–5. **Fixed (doc-only):** `CLAUDE.md` had a stale test count ("110/110"), a reference to a nonexistent `deriveMarginalRate()` (should be `calcLeaseMarginalRate()`, also corrected in `TASK-UX-REDESIGN.md`), and a documented return shape for `calcLeaseMarginalRate()` missing the `zeroTax` field added in the second pass.
6. **Fixed:** `carLeaseProfile()` and `renderCarCalc()` each independently read `document.querySelector('input[name="car-regime"]:checked').value`; extracted a shared `carRegime()` helper.
7. **Fixed:** `renderCCOwnCurve()` rebuilt `ccOwnershipInput()` (re-running `calcLeaseMarginalRate()`/`calcEMI`/`calcPerquisite`) for the selected car even though `ccComputedRows()` had already built and discarded that exact object a few lines up. Rows now carry `input` alongside `result`; `renderCCOwnCurve()` reuses `row.input` for `calcOwnershipCurve()`.
8. **Deliberately skipped:** the reviewer flagged that salary-panel fields call `renderCarCompare()` on every keystroke regardless of `carMode`, even in Cash mode where nothing reads the derived marginal rate. The reviewer's own note: "harmless at this hub's ≤5-car scale." Gating this by mode would add real branching complexity for a cost that doesn't exist in practice — not worth it.
9. **Fixed:** the signed tax-shield color ternary (`taxSaved < 0 ? red : (taxSaved > 0 ? green : '')`) was duplicated verbatim in `renderLeaseGlance()` and `renderCCCrossMode()`; extracted a shared `signedColor(n)` helper alongside the app's other small DOM helpers.

`node tests.js`: 117/117 (112 → 117, five new pinned cases for `calcTaxableIncome()`).

## What was verified, and how

- **`node tests.js`: 117 passed, 0 failed.** Grew from 100 (R76's own scope) → 110 (R76's pinned cases) → 112 (second pass's `zeroTax` cases) → 117 (third pass's `calcTaxableIncome()` cases).
- **Inline script syntax check** (`new Function()` over the extracted `<script>` block) passes — no parse errors introduced across three rounds of edits.
- **No retired ids survive:** `grep -c 'id="cc-marginal-rate"\|id="cc-has-driver"'` and `grep -c 'lg-grid'` both return 0.
- **`.grid-2` still has exactly one definition** after `.lg-grid`'s removal.
- **No `deriveMarginalRate()` references remain** anywhere in `CLAUDE.md`/`TASK-UX-REDESIGN.md`.

## Deliberately left undone / could not verify

- **No browser was run** — this environment has none. Every on-screen claim (the glance's three shield-note states actually reading correctly, the cross-mode card's Tax Saved line reconciling visually, the `#lg-empty` guard's copy at 375px) is argued from code reading and the `node`-based checks only, matching the precedent Phases 16–19 already set for this gap.
- **Finding #8 from the third review pass** (salary-field edits re-rendering Compare Cars regardless of active mode) is a known, accepted inefficiency at this app's scale — see above.
- **Phases 20–21** (income primitive; projection-growth honesty + Grow reverse bridge) remain unstarted, per `TASK-UX-REDESIGN.md`'s own sequencing note — Phase 22 was an insertion by severity, not a reprioritisation away from Worth.
