# Task Brief: Add a Correctness Test Harness for Dhanam's Financial Calculations

> **Status: ✅ SHIPPED — Option A, in Phase 1 (commit `c292d4b`).** This brief is kept as the record of
> *why* the harness exists and how the option was chosen; it is **no longer a work item.**
> This task implements recommendation #1 from `ARCHITECTURE-ANALYSIS.md`: *"the actual risk in going
> public isn't the single-file structure — it's that nothing catches a wrong financial answer before
> a stranger trusts it."* This was the highest-leverage, lowest-cost fix identified there.
>
> **What actually shipped, and where it exceeded this brief** (verified 2026-08-10, see `MID-PROJECT-REVIEW.md` §2.4):
> Option A was taken. `calc.js` holds **14** pure functions, not the 8 scoped below — `calcRunningCost`,
> `calcInsuranceTotal`, `calcOwnershipCost`, `calcBreakevenKm`, `calcOwnershipCurve` and `calcLumpsumGrowth`
> were added by Phases 9, 13 and 14 and are covered too. `tests.js` and `tests.html` both exist and run the
> same assertions. The suite is at **95 assertions**, not the ~39 this brief's scope implies, and now includes
> an independent bisection oracle for `calcEMI` and conservation/monotonicity properties.
>
> ⚠️ **Do not use the expected values in the "Test cases to implement" section below as-is.** They were written
> on 2026-07-20, before three statutory-correctness phases. **`calcPerquisite`'s four expected values are now
> flatly wrong** (superseded by R37's Income-tax Rules 2026 table) and **`calcIncomeTax`'s new-regime bullet
> describes a cliff that R34 deliberately removed** — both are annotated inline below. `tests.js` is the live
> specification; this section is history, kept for the reasoning rather than the numbers.

## Context to load first

1. `ARCHITECTURE-ANALYSIS.md` — why this task exists and why it's independent of any file-splitting work.
2. `CLAUDE.md` — current architecture, "no build system / dependency-free static site" constraint, and the existing manual test checklist (which this harness *supplements*, not replaces, for anything DOM-related).
3. `index.html` — read the calculation functions listed below in place before touching anything.

## Goal

Catch a wrong EMI, tax, SIP, or depreciation number **before** it reaches a real user — via automated, hand-written assertions against known-correct values — without adding a runtime dependency to the shipped app and without changing any financial formula's behavior.

## Hard constraints

- **Zero new runtime dependencies in the shipped app.** `index.html` must work exactly as it does today, offline, dependency-free.
- **No change to any calculation's output.** This task adds verification, not new behavior. If a test reveals a real bug, fix the bug in a separate, clearly-flagged step — don't silently "fix" a test to match buggy output.
- Test tooling itself (Node scripts, an optional headless browser) is allowed to be dev-only — never shipped, never loaded by `index.html` in production — see the options below for what "dev-only" costs.

## Scope: which functions this task covers

These 8 functions are **pure** — they take arguments and return values, with no `document.getElementById`/DOM reads or writes inside them. That makes them testable in isolation, which is what makes this task cheap. (Approximate current locations in `index.html`, confirm exact lines before editing.)

| Function                                                                        | ~Line | What it computes                                   |
| ------------------------------------------------------------------------------- | ----- | -------------------------------------------------- |
| `calcEMI(P, annualRate, years)`                                                 | 1686  | Standard EMI formula                               |
| `loanAtYear(P, annualRate, totalYears, checkYear)`                              | 1693  | Balance/principal/interest at a point in tenure    |
| `simulateLoan(P, annualRate, totalYears, extraEmiPerYear, extraLumpsumPerYear)` | 1710  | Amortization with prepayments                      |
| `calcSIP(monthly, annualCagr, years)`                                           | 2458  | SIP future value (annuity formula)                 |
| `calcStepupSIP(startMonthly, annualStepupPct, annualCagr, years)`               | 2597  | SIP with annual step-up, month-by-month simulation |
| `calcIncomeTax(annualTaxable, regime)`                                          | 2681  | New/old regime slabs + cess + 87A rebate           |
| `calcPerquisite(bigEngine, hasDriver)`                                          | 2708  | Company car perquisite lookup (IT Rule 3(2))       |
| `calcCarDepreciation(price, years)`                                             | 2826  | IRDAI-schedule resale estimate                     |

### Explicitly out of scope for this task

`calcDetail`/`renderDetail`, `renderLoans`, `renderAdvLoan`, `renderCarCalc`, `renderCarLoan`, `renderLoanDisb`, `renderSIPComparison`, and the SIP-planner `update*` functions all read/write the DOM directly (`v()`, `chk()`, `set()`, `el()`) and aren't pure. Testing them requires either a headless browser (see Option C) or a refactor to separate "compute" from "render" — bigger scope than this task. Leave them covered by the existing manual checklist in CLAUDE.md for now; note them as a natural follow-on once Option C infrastructure exists, if ever adopted.

## Decision needed before execution: how are the pure functions made testable?

All three options are technically workable. **A is recommended** because it's the cheapest and also happens to be the first small step of the "light modularization" already flagged as optional future work in `ARCHITECTURE-ANALYSIS.md` — one change serves two purposes. State a choice (or a variant) before the executing agent starts.

### Option A — Extract the 8 pure functions into `calc.js` (recommended)

Move just those 8 function bodies out of the inline `<script>` into a new sibling file, `calc.js`, loaded by `index.html` via `<script src="calc.js"></script>` in the same position. Add a small guarded export at the bottom of `calc.js` so the *identical* file can also be `require()`d from plain Node with no npm install:

```js
if (typeof module !== 'undefined') module.exports = { calcEMI, loanAtYear, simulateLoan, calcSIP, calcStepupSIP, calcIncomeTax, calcPerquisite, calcCarDepreciation };
```

Then:

- `tests.js` — a plain Node script (`node tests.js`, zero installs) that `require('./calc.js')` and runs the assertions below, printing PASS/FAIL per case, exiting non-zero on any failure (so it's CI-ready later if wanted).
- Optionally, `tests.html` — loads `calc.js` via a normal `<script>` tag and renders the same assertions as a visual pass/fail list in a browser, for the times the owner doesn't have Node open (matches CLAUDE.md's browser-first workflow).

*Cost:* mechanically relocate 8 function bodies (must not alter their logic), update `CLAUDE.md`'s file list and add a short "Testing" section.

### Option B — Test the inline code in place, no `index.html` changes

Write `tests.html` that fetches the raw text of `index.html` and regex-extracts the 8 function source blocks to `eval`, testing the actual shipped code without moving anything.

*Cost:* fragile — extraction breaks silently if a function's formatting changes; can't easily run headlessly/in CI; doesn't reduce the global-state collision risk `ARCHITECTURE-ANALYSIS.md` flags. Only pick this if touching `index.html`'s structure at all is unacceptable right now.

### Option C — Headless browser against the real, unmodified `index.html`

Use a dev-only npm dependency (e.g. Playwright) to load `index.html` as a real browser would, fill inputs, and read rendered output — testing the full stack including the DOM-coupled render functions currently out of scope above, and the cross-hub sync behavior (e.g., quick-calc total flowing into the loan panel).

*Cost:* this would be the app's first-ever dependency of any kind (dev-only, never shipped) and needs Node + `npm install` set up. Heavier, but the only option that can eventually also cover the render functions and the CLAUDE.md-documented tranche invariants automatically. Worth it only if the owner is comfortable crossing the "zero dependencies, ever" line even for tooling.

## Test cases to implement

Wherever a case says "verify independently" — **do not trust hand-computed figures in this brief.** Cross-check any absolute rupee value against Excel's `PMT` function or a reputable bank/IT-department EMI or tax calculator before writing it into an assertion. Wrong expected values are worse than no test.

**`calcEMI`**

- Zero-rate branch is exact, not approximate: `calcEMI(1200000, 0, 10)` must equal `1200000 / 120` exactly.
- Reference case: `calcEMI(1000000, 10, 1)` — verify the expected EMI independently (a commonly-cited textbook answer is in the ~₹87,900s for this input; confirm the precise value yourself rather than trusting that range).
- Monotonicity: for fixed `P`/`rate`, `calcEMI(P,rate,15) > calcEMI(P,rate,20) > calcEMI(P,rate,30)`.

**`loanAtYear`**

- At `checkYear === totalYears`: `balance` ≈ 0 and `principalPaid` ≈ `P` (within a rupee of rounding).
- At `checkYear === 0`: `balance` ≈ `P`, `principalPaid` ≈ 0, `interestPaid` ≈ 0.
- Identity: `principalPaid + balance ≈ P` at any `checkYear`.

**`simulateLoan`**

- `simulateLoan(P, rate, years, 0, 0)`: `actualMonths ≈ years*12`, `monthsSaved ≈ 0`, and `totalInterest` matches `calcEMI(P,rate,years)*years*12 - P`.
- Adding extra payments strictly reduces `actualMonths` and `totalInterest` versus the no-extra case (monotonic improvement).
- Large `extraLumpsumPerYear` (e.g., equal to `P`) pays the loan off within the first year or two — confirm it terminates quickly and doesn't run to the `safetyLimit`.
- Confirm the function always terminates (never hits `safetyLimit`) for ordinary inputs.

**`calcSIP`**

- Zero-rate branch is exact: `calcSIP(10000, 0, 10)` must equal `10000 * 120` exactly.
- `calcSIP(0, 12, 20)` === 0.
- Monotonic in both `years` and `cagr`.

**`calcStepupSIP`**

- **Cross-check worth investigating, not assuming:** with `annualStepupPct = 0`, this function should conceptually reduce to the same corpus as `calcSIP(monthly, cagr, years)`. While reading the code, I noticed `calcStepupSIP` compounds as `balance = balance*(1+r) + currentSIP` (contribution credited *after* that period's growth — an ordinary annuity), whereas `calcSIP`'s closed-form includes an extra `*(1+r)` factor (annuity-due — contribution grows immediately). These are two different timing conventions and may **not** actually agree, even at 0% step-up. Write this test, see what it reports, and treat any mismatch as a real finding to resolve (either the two SIP paths are inconsistently modeled and should be aligned, or there's a reason they intentionally differ — but that reason isn't currently documented anywhere). Do not assume either function is "correct" going in.

**`calcIncomeTax`**

- `calcIncomeTax(0, 'new')` === 0; `calcIncomeTax(-100000, 'new')` === 0 (guard clause).
- New regime 87A cliff: `calcIncomeTax(1200000, 'new')` === 0, `calcIncomeTax(1200001, 'new')` > 0 — confirm this cliff-edge jump is intentional per current tax rules (it's a real, well-known feature of the 87A rebate, not obviously a bug, but worth asserting explicitly since cliff edges are where off-by-one errors hide).
  - ⚠️ **Answered, and it was a bug — this brief's instinct was right.** The suspicion recorded above ("cliff edges are where off-by-one errors hide") is exactly what **R34/D14** later found: real law grants **Section 87A marginal relief** across ₹12,00,000–₹12,70,588.24, capping tax before cess at `taxable − 1200000`. The app was applying the naive slab jump and over-taxing that band by up to ~₹31K/year. Both assertions above still hold, but the *shape* changed: `calcIncomeTax(1200001, 'new')` is now ≈ ₹1.04, not ~₹62,400. `tests.js` pins the boundary and the breakeven. **The old-regime ₹5L rebate is a genuine cliff in law and must stay one** — there is a test pinning it so a future "consistency" fix can't quietly extend relief to it.
- Old regime 87A cliff: `calcIncomeTax(500000, 'old')` === 0, `calcIncomeTax(500001, 'old')` > 0.

**`calcPerquisite`** (exact lookup table, per IT Rule 3(2) as coded — high confidence, should be exact)

> 🛑 **SUPERSEDED — do not write these assertions.** The four values below are the **Income-tax Rules 1962** figures that were in the code when this brief was written on 2026-07-20. They were found stale by four months during Phase 8b and replaced by the **Income-tax Rules, 2026** table (in force 2026-04-01) under **R37**: ₹5,000/mo for ≤1.6L *or electric*, ₹7,000/mo above 1.6L, +₹3,000/mo for a chauffeur. `tests.js` now pins the current values **and** asserts that no superseded figure survives anywhere in the table. Left visible rather than deleted because this is the worked example behind CLAUDE.md's rule that *statutory constants rot silently — date them and pin them in the same commit.*

- ~~`calcPerquisite(false, false)` === 1800~~ → **5000**
- ~~`calcPerquisite(true, false)` === 2400~~ → **7000**
- ~~`calcPerquisite(false, true)` === 2700~~ → **8000**
- ~~`calcPerquisite(true, true)` === 3300~~ → **10000**

**`calcCarDepreciation`**

- `calcCarDepreciation(price, 1)` === `price * 0.80` exactly (year-1 loop doesn't execute).
- `calcCarDepreciation(price, 2)` === `price * 0.80 * 0.85` exactly.
- Monotonically decreasing as `years` increases; `calcCarDepreciation(0, 5)` === 0.

### Cross-hub invariants already documented in CLAUDE.md (note only — out of scope unless Option C is chosen)

CLAUDE.md's manual checklist already specifies two precise, provably-correct invariants for the loan-disbursement calculator (a single 100%-at-month-0 tranche must equal the plain `calcEMI` panel exactly; a 50/50 split at 9% must produce first-year pre-EMI interest of exactly `0.5 × loan × 0.09`). These involve `renderLoanDisb`, which is DOM-coupled and out of scope per above — they stay manual-only unless Option C's headless-browser infrastructure gets built.

## Acceptance criteria

- Chosen option is implemented; `index.html`'s live behavior is unchanged (walk the relevant parts of CLAUDE.md's manual checklist to confirm).
- Tests run with a single command and zero installs beyond what's already on the machine (`node tests.js` for Option A/B; documented setup step for Option C).
- Running the suite exits non-zero and prints a clear failure list if any assertion fails; exits 0 and prints a summary if all pass.
- Every function in the scope table has at least one exact-value edge case and one property/monotonicity case.
- The `calcStepupSIP` vs `calcSIP` consistency question above is explicitly investigated and the outcome is documented (either "confirmed intentional difference, comment added" or "bug found and fixed, filed/flagged separately per the constraint above").
- `CLAUDE.md` gains a short "Testing" section describing how to run the suite and what it covers (and, if Option A, `calc.js` added to the architecture file list).

## Out of scope

Testing DOM-coupled render functions (unless Option C chosen), fixing any bug the tests happen to reveal beyond documenting it clearly for a follow-up, adding CI/GitHub Actions wiring, adding any new calculation feature.
