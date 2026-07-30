# Phase 8 Report — Dhanam Car Salary & Tax Correctness

*Completed: 2026-07-30 · Executed from `TASK-UX-REDESIGN.md`'s Phase 8 spec (R33, R34; R35 had already shipped earlier the same day). Origin: D14 in `UX-ANALYSIS.md` — the owner compared "Optimize My Car"'s take-home figure against their real payslip and found it off by roughly ₹40K/month.*

---

## What made this phase different

Every prior phase in this task was design work — density, charts, icons, fonts. This one was a defect. The app was producing a wrong number from correctly-entered inputs, and doing it confidently: nothing looked broken, no field appeared wrong, and the arithmetic was internally consistent. The only way to notice was to hold the screen next to a payslip, which is exactly what the owner did.

That framing set the bar for the fix. It wasn't enough to make the number correct; the number had to become *checkable*. A user who can't reconcile take-home against their own payslip line by line has no way to catch the next version of this bug either.

---

## R33 — EPF was computed on the wrong base

### The defect

`renderCarCalc()` had exactly one salary-amount field, `car-basic`, and used it for two incompatible purposes:

1. **The base for annual gross salary** — correct. Gross for tax purposes is Basic + HRA + Special Allowance, i.e. total fixed pay.
2. **The base for the EPF deduction** (`basic * epfPct`) — wrong. Statutory EPF applies to **Basic + DA only**, which is typically 40–50% of total fixed pay in Indian salary structures.

So a user entering their whole fixed pay — the only thing the field allowed, and after R35 the thing its own hint explicitly told them to do — got EPF calculated on roughly twice the correct base. The overstatement lands directly on take-home, rupee for rupee.

**The derivation existed in three independent places**, which is the part worth remembering:

| Site | Code | Scenario affected |
|---|---|---|
| `scenarioCalc()` | `basic * epfPct`, plus `Math.min(basic * 12 * epfPct, basic * 12)` for the 80C cap | Baseline |
| Scenario A inline | `const aEpfMonthly = effectiveBasic * epfPct` | Carve-out A |
| Scenario B inline | `const bEpfMonthly = basic * epfPct` | Additive B |

Fixing only `scenarioCalc()` — the obvious single entry point, and the one the bug report pointed at — would have left A and B wrong and the three cards mutually inconsistent. This is the concrete reason the fix collapses all three onto one computation rather than patching each in place.

### The fix

`car-epf-pct` ("EPF Employee (%)", hint *"Applied on basic salary"*) was **retired outright** rather than kept alongside the new field. The spec allowed either; retiring won because a percentage field that no longer drives anything is worse than no field — it invites the user to tune a number that does nothing, which is how the original confusion started.

In its place, `car-epf-amt`:

```html
<label>Monthly EPF Deduction (₹)</label>
<input type="number" id="car-epf-amt" value="6000" step="100" oninput="renderCarCalc()">
<span class="field-hint">Copy the employee PF line straight off your payslip —
  EPF applies to Basic + DA only, not your full fixed pay</span>
```

The default of ₹6,000 is 12% of a ~50% Basic on the ₹1,00,000 default salary — a plausible figure so the calculator isn't blank on load, and it's static rather than reactive to `car-basic`. A default that recalculated itself from the salary field would have been a fourth derivation wearing a disguise, and it would have fought the user mid-typing.

`renderCarCalc()` now computes the pair **once**, at the top, with a comment explaining why:

```js
const epfMonthly = Math.max(0, +v('car-epf-amt') || 0);
const epfAnnual = epfMonthly * 12;
```

`scenarioCalc()`, scenario A, scenario B and the old-regime 80C cap all read those two. `epfPct`, `aEpfMonthly` and `bEpfMonthly` are gone; `grep -n epfPct index.html` returns nothing.

### A third wrongness found while fixing the first

Scenario A wasn't just deriving EPF from the wrong field — it was deriving it from `effectiveBasic`, i.e. `basic − carPkg`, the salary *after* the car carve-out. So a carve-out scenario silently reduced the user's provident fund contribution as well as their salary.

That's the same category error one level down. A carve-out is taken out of the flexible/allowance side of a package, not out of statutory Basic; the PF line on the payslip doesn't move when you swap Special Allowance for a car. **EPF is now identical across all three scenarios**, which has a second benefit: it cancels out of every vs-baseline delta, so the comparison the hub exists to make is no longer contaminated by an artifact of the EPF model.

`effectiveBasic` still legitimately drives scenario A's *gross* — the carve-out genuinely does reduce taxable salary. Only its EPF role was wrong.

### Making the number checkable

The scenario cards' Monthly Cash Flow block gained an explicit row:

```
EPF deduction        −₹21,600
Take-home (pre car)  ₹3,26,350
```

Take-home is now `annual gross ÷ 12 − EPF − monthly tax` with every term on screen, so it reconciles against a payslip without the user having to guess what the app assumed. Given that this whole phase exists because a hidden assumption produced a wrong number, exposing the assumption was the cheap part of the fix and probably the durable part.

The panel's caveat list gained a matching line stating that EPF is taken from the entered amount rather than derived, why (the app can't infer Basic + DA from total fixed pay), and that it's held constant across scenarios.

### Effect on the reported discrepancy

Owner's numbers: ₹4,50,000/month total fixed pay, no bonus, new regime, real payslip PF ₹21,600/month.

| | Before | After |
|---|---|---|
| EPF used | ₹54,000/mo (12% of ₹4.5L) | ₹21,600/mo (entered) |
| Annual tax + cess | ₹12,24,600 | ₹12,24,600 (unchanged) |
| **Take-home (pre car)** | **₹2,93,950/mo** | **₹3,26,350/mo** |

**₹32,400/month recovered** — consistent with D14's expectation that this bug is the dominant term in the ~₹40K discrepancy, with the remainder falling to the app's other disclosed simplifications (no professional tax, no old-regime HRA exemption) and to R34 for anyone whose taxable income lands in the 87A band.

---

## R34 — Section 87A marginal relief

### The defect

`calcIncomeTax()`'s new-regime branch treated the ₹12L rebate as a hard cliff:

```js
if (annualTaxable <= 1200000) tax = 0; // 87A rebate new regime
```

Slab tax at exactly ₹12,00,000 is already ₹60,000, so under this code earning **one rupee** more of taxable income cost ₹62,400 in tax. Real law has marginal relief precisely to prevent that: tax before cess is capped at the amount by which income exceeds the threshold.

### The fix

Four lines in `calc.js`, no DOM, no other file:

```js
if (annualTaxable <= 1200000) {
  tax = 0; // 87A rebate, new regime
} else {
  tax = Math.min(tax, annualTaxable - 1200000);
}
```

Relief is applied to tax **before** cess, and the existing `return tax * 1.04` then applies cess to the relieved figure — which is the correct order, and worth stating because applying cess first and relieving afterwards would produce a subtly different (wrong) number.

The relief stops binding at **₹12,70,588.24**, derived rather than hardcoded: slab tax in the 15% band is `60000 + 0.15x` for `x` above the threshold, and `60000 + 0.15x ≤ x` when `x ≥ 60000/0.85 = 70,588.24`. The comment in `calc.js` carries that derivation so the constant isn't a magic number to whoever reads it next.

**The old-regime branch was deliberately not touched.** Its ₹5L rebate cliff is genuine law — there is no marginal-relief provision attached to it — so "fixing" it for consistency would be introducing a bug, not removing one. Because that's a non-obvious asymmetry, a test now pins it (below).

### The overcharge was twice what D14 estimated

D14 estimated the impact at "up to ~₹31K/year (~₹2,600/month)". Measured during the fix, the actual worst case is **₹62,399/year — ~₹5,200/month** — at ₹12,00,001 of taxable income, decaying linearly to zero at the breakeven:

| Taxable income | Pre-fix tax | Post-fix tax | Overcharged by |
|---|---|---|---|
| ₹12,00,001 | ₹62,400 | ₹1 | ₹62,399 |
| ₹12,10,000 | ₹63,960 | ₹10,400 | ₹53,560 |
| ₹12,25,000 | ₹66,300 | ₹26,000 | ₹40,300 |
| ₹12,50,000 | ₹70,200 | ₹52,000 | ₹18,200 |
| ₹12,70,588 | ₹73,412 | ₹73,412 | — |

`UX-ANALYSIS.md`'s D14 has been corrected in place rather than quietly left at the old figure.

---

## Tests

`node tests.js` — **45 passed, 0 failed** (was 39). Six new assertions, mirrored into `tests.html`:

| Case | Assertion |
|---|---|
| Taxable = ₹12,00,001 | Tax = ₹1.04 — the excess plus cess, not the naive ₹62,400 |
| Taxable = ₹12,10,000 | Tax = ₹10,400 exactly (hand-verified: excess ₹10,000 × 1.04; naive would be ₹63,960) |
| Taxable = ₹12,70,588.24 | Relief exactly ties slab tax — the boundary is where the derivation says it is |
| Taxable = ₹13,00,000 | Tax = ₹78,000, full slab math, relief no longer binds |
| Sweep ₹11.95L → ₹13L in ₹1,000 steps | Tax never rises faster than income — no cliff survives anywhere in the band |
| Old regime, taxable = ₹5,00,001 | Tax = ₹13,000.21, the **full** slab amount — pins the old-regime cliff as intentional |

The sweep is the one that earns its place long-term. The four point assertions verify the numbers as implemented; the sweep verifies the *property* the fix exists to guarantee, and would catch a future edit that moved the threshold, changed a slab, or reintroduced a discontinuity somewhere the point tests don't sample.

The pre-existing `calcIncomeTax(1200001, 'new') > 0` assertion still passes unchanged — it was too weak to catch this bug, which is itself informative: it asserted the cliff existed rather than that it shouldn't.

The documented `calcSIP` / `calcStepupSIP` ~1% convention gap (B6) still prints its `[finding]` line and is untouched.

---

## Manual verification

`renderCarCalc()` is DOM-coupled, so it's outside `tests.js`'s scope. It was exercised headlessly by extracting the function from `index.html` and running it against stub `v`/`el`/`fmt`/`document` implementations — enough to check the rendered output of all three cards without a browser:

- **Owner's scenario** (₹4.5L, PF ₹21,600, new regime): all three cards show the same ₹21,600 EPF line; take-home reconciles to gross ÷ 12 − EPF − tax on each; baseline ₹3,26,350, carve-out A ₹3,01,708, additive B ₹3,25,788.
- **Edge sweep** — all-empty inputs, EPF = 0, EPF = ₹5,00,000 (larger than gross), negative EPF, old regime, and a car package larger than the salary: **no `NaN`, `Infinity` or `undefined` in any rendered card or the summary block.** A large EPF legitimately drives take-home negative; that's the user's input, and it renders as a number rather than breaking.
- **Defaults** (₹1L salary, ₹6,000 EPF, new regime): taxable ₹11,25,000 sits under the rebate, so tax is ₹0 and take-home is exactly ₹94,000 — the arithmetic is verifiable by hand from the visible fields, which is the point of R33.

Both inline `<script>` blocks in `index.html` were re-parsed after the edits to confirm no syntax damage.

Two new items were added to CLAUDE.md's manual checklist (26 → 28) for the browser-level checks this harness can't make: that all three cards move together with `car-epf-amt` and stay put when `car-basic` changes, and that the 87A band shows a few hundred rupees of tax rather than ~₹62,400 just above the threshold.

---

## Self-review before commit

A review pass over the finished diff turned up nothing wrong with the math — but two quality defects **in this phase's own new code**, both corrected before committing:

- **The "EPF deduction" row was painted `red`.** Every other red figure in these cards is a genuine cost (tax, car out-of-pocket, loan interest), and `COLOR-PALETTE-ANALYSIS.md` rule 4 reserves red for exactly that. EPF isn't a cost — it's the user's own money moving into a retirement account, and `W_ASSETS` (`index.html:3143`) lists **"EPF / PPF / NPS" as an asset** in Dhanam Worth. The app would have painted as a loss, in one hub, the thing it counts as savings in another. The row is now neutral; the `−` prefix carries the "subtracted from cash flow" meaning on its own, and a comment records why the class is absent so it doesn't get "fixed" back.
- **`car-epf-amt` had no `min="0"`.** The `Math.max(0, …)` guard made the *calculation* safe, but a typed negative would sit visibly in the field while the app quietly used 0 — field and figure disagreeing. Eleven other inputs in the file already carry `min="0"`, and checklist item 26 (R18, Phase 3c) established that this project clamps the field itself rather than only the calculation.

One finding was **deliberately not fixed here**: `fmt()` (`index.html:1738`) renders negatives as `₹-3,00,000`, minus after the ₹, while `hub-worth` deliberately uses `−₹X`. It's pre-existing — `renderCarCalc()`'s "worse" delta has always had it — but a mistyped EPF now makes negative take-home reachable in this hub too. `fmt()` is called from every hub, so changing it needs a full cross-hub manual pass that doesn't belong in a commit scoped to Dhanam Car. Filed as **R36** against Phase 5's consistency sweep rather than left to be rediscovered.

---

## Files changed

| File | Change |
|---|---|
| `calc.js` | 87A marginal relief in `calcIncomeTax()`'s new-regime branch, with the breakeven derivation in a comment |
| `index.html` | `car-epf-pct` → `car-epf-amt` (markup + hint); `epfMonthly`/`epfAnnual` computed once in `renderCarCalc()`; three derivations removed; "EPF deduction" row added to the scenario cards; two caveat-list lines updated/added |
| `tests.js` | Six new `calcIncomeTax` assertions (39 → 45) |
| `tests.html` | Same six, mirrored |
| `sw.js` | Cache version `apt-cost-v10` → `apt-cost-v11` |
| `CLAUDE.md` | New "Dhanam Car lease analysis specifics" section; `calcIncomeTax` entry notes marginal relief and the deliberate old-regime asymmetry; `car-*` prefix note; checklist items 27–28 |
| `UX-ANALYSIS.md` | D14 marked fixed with outcome; priority-map row 0c struck; the ~₹31K estimate corrected to the measured ₹62,399 |
| `TASK-UX-REDESIGN.md` | R33/R34 struck through with shipped detail; Phase 8 marked shipped; **new R36** filed from the self-review; sequencing and remaining-work paragraphs updated (R21 is again the top open item) |

No new assets, so `sw.js`'s `ASSETS` precache list is unchanged; the version bump is what makes an installed PWA pick up the corrected math.

---

## What's next

Phase 8 closes the last open correctness bug in the document. **R21 (state-aware assumptions — stamp duty and registration are Telangana values presented as universal) is once again the single highest-severity open item**, and it's the same class of defect this phase just fixed: a confidently wrong number with nothing on screen to indicate anything is off.

Nothing here unblocked or blocked any other item. B6 (the SIP convention gap) remains open and remains load-bearing for Phase 7.
