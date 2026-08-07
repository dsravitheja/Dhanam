# Phase 9 Report — Compare Cars (ICE vs EV Under a Company Lease)

*Completed: 2026-08-07 · Executed from `TASK-UX-REDESIGN.md`'s Phase 9 spec (R38–R44). Origin: the owner brought a working Excel model (`carlease/ICE vs EV Lease Comparison.xlsx`, with a full build doc) built to help decide a real, current car-lease choice, and asked whether it belonged in the app. Marked urgent, ahead of Phase 6, for a situational reason — a live decision, not an architectural one.*

---

## What shipped

A third stacked section in `hub-car` — **Compare Cars** — below the existing single-car lease analysis and above the car-buying loan panel. It answers the question the lease panel above it doesn't: not "should I take a company car at all," but "which one." The user enters 2–5 cars they're actually considering (no shipped catalog); the app ranks them by lease net cost, shows a breakeven-km verdict per EV against a reference ICE car, and plots a net-cost-vs-annual-km crossover chart.

Four new pure functions plus a fourth argument on an existing one landed in `calc.js`, all covered by `node tests.js`:

- **`calcEMI(P, annualRate, years, fv = 0)`** — `fv` is the balance still owed at term end (a lease's residual/balloon buyout). At `fv = 0` it takes the *exact* original 3-argument code path — not just an algebraically equivalent one — so every existing caller (`loanAtYear`, `simulateLoan`, `renderLoans`, `renderAdvLoan`, `renderCarLoan`, `renderLoanDisb`, `renderWorthProjection`) is bit-identical.
- **`calcRunningCost(type, efficiency, a)`** — fuel/energy cost, annualized, city and highway split separately (ICE mileage improves on the highway, EV efficiency worsens on it).
- **`calcInsuranceTotal(price, rate, depRate, years)`** — closed-form geometric series, with a `depRate === 0` guard (the series is `0/0` there).
- **`calcLeaseNetCost(o)`** — the engine: EMI, running cost, maintenance, insurance, signed tax-saved, raw outflow, net cost, resale value, net cost after resale credit, blended ₹/km.
- **`calcBreakevenKm(evFixed, evPerKm, iceFixed, icePerKm, years)`** — three distinct outcomes (`null` / `<= 0` / a positive km figure), not one number trying to mean three things.

---

## Two owner decisions, made during the phase

The brief flagged these as blocking and stated a lean; the owner decided both before 9c/9f were built, and the shipped behavior follows the decisions, not the leans.

**B11 — does the shortlist persist without an opt-in?** **Yes — persists by design, like Dhanam Worth.** `ccCars` plus the two driving-pattern fields (`cc-city-km`, `cc-hwy-km`) are tier-1 and save automatically; every Assumptions-card field (lease rate, residual %, petrol/charging prices, maintenance, insurance, IDV depreciation, marginal rate) is tier-2 and is read fresh from the DOM on every render, never stored. This is the first *calculator* hub to persist without a toggle — matches the brief's own reasoning (a shortlist of dealer quotes is closer to a balance sheet than a scratch calculation).

**B12 — does ranking use net cost, or net cost after the resale credit?** **Net cost BEFORE the resale credit** — the owner's call, the opposite of the brief's stated lean toward the after-credit figure. Both numbers are on screen on every result card; the pre-credit figure is what drives the sort, the hero, and the rank-1 gold highlight. The worked example below shows why this isn't a cosmetic choice — it can flip the answer.

---

## Corrections made vs. the workbook (not ported)

The build doc for the source workbook was unusually thorough, including its own §8 bug writeup. Two of its remaining assumptions were still wrong in ways that materially change the answer; three more were simplifications worth naming rather than silently carrying forward.

1. **Resale credit (R40).** The workbook counts the lease-end balloon buyout as pure cost and never credits the car you then own. `calcCarDepreciation` treats that same car as retaining real value — the credit scales with on-road price, so it doesn't just inflate every total equally, it can reorder the ranking (see below). Shown as its own line, both figures on screen, never silently netted.
2. **Perquisite (correction 2).** The workbook hardcodes ₹5,000/month for every car. `calcPerquisite()` has held the real Income-tax Rules, 2026 table since Phase 8b — ₹5,000 for ≤1.6L *or electric*, ₹7,000 above 1.6L, +₹3,000 for a chauffeur. The flat figure understates a >1.6L ICE car's real perquisite, which **overstates** its tax-saved — a bug that erases a real, structural EV tax advantage. Pinned in `tests.js`: a big-engine ICE row and an otherwise-identical row differ in net cost by exactly `marginalRate × 2000 × months` — ₹29,952 at the shipped defaults (31.2%, 4yr).
3. **`calcInsuranceTotal`'s `0/0` at `depRate = 0`** — guarded to `price × rate × years`, a value a user can legitimately type.
4. **Rank 1 is gold, not green** — green is reserved for a real financial delta (palette rule 3); "selected/best" is emphasis, which is gold (rule 2). The only green in the section is the resale-credit line itself and an "already cheaper today" breakeven verdict — both real positive deltas.
5. **No "EV driven more" rebound multiplier.** The workbook models this but is honest that it makes its own ₹/km column incomparable across types. Dropped; noted in the caveat list rather than silently omitted.

Two traps this codebase had already been bitten by once, both re-guarded here explicitly:

- **Blank-row guard reads raw state.** `ccComputedRows()` filters on `c.price > 0 && c.eff > 0` straight off the `ccCars` array — the exact class of bug (a falsy-but-not-absent value slipping through) that R16 (`su-stepup`'s `|| 10` fallback) already shipped once in this codebase, and that the workbook's own §8 writeup documents independently.
- **`renderCCRows()` never runs from the `oninput` path.** Same D6/Phase-0 trap `section-disb`'s tranche rows hit — rewriting row markup on every keystroke drops focus mid-type. Verified by a jsdom smoke test that types continuously into a shortlist row and confirms the row markup is never rebuilt mid-edit.

---

## Worked example: the ranking actually flips

A synthetic two-car pair — the owner's actual 14-car shortlist wasn't available in this repo to re-run — but the shape of the effect is real and reproducible with `calc.js` directly. All figures at the shipped defaults (10% lease rate, 10% residual, 4-year tenure, 31.2% marginal rate):

| Car | Price | Efficiency | Engine | EMI/mo |
|---|---|---|---|---|
| ICE | ₹20,00,000 | 18 kmpl | >1.6L | ₹47,319 |
| EV | ₹22,00,000 | 14 kWh/100km | — | ₹52,051 |

| Model | ICE net cost | EV net cost | Winner |
|---|---|---|---|
| **Workbook** (flat ₹5,000 perquisite, no resale credit) | ₹23,49,788 | ₹23,85,582 | **ICE by ₹35,795** |
| **App, pre-credit** (correction 2 applied; B12's ranking basis) | ₹23,79,740 | ₹23,85,582 | **ICE by ₹5,843** |
| **App, after resale credit** (shown alongside, not ranked on) | ₹13,97,140 | ₹13,04,722 | **EV by ₹92,417** |

Three things happen in sequence:

1. **The perquisite fix alone closes ₹29,952 of the workbook's ICE-favoring gap** — exactly the pinned test value — because the workbook understates the >1.6L ICE car's real tax cost.
2. **The app's official answer for this pair (B12: pre-credit) is a near-toss-up** — ICE by ₹5,843 out of a ~₹24L figure, not the workbook's confident ₹35,795 margin.
3. **The resale credit, shown on the same card but not driving the rank, says the opposite** — EV cheaper by ₹92,417, because the EV's higher price means a proportionally larger resale credit under `calcCarDepreciation`.

This is why B12 wasn't a cosmetic choice. At these prices the app's headline answer and its own disclosed after-resale figure disagree with each other, and the owner chose to rank on the more conservative (pre-credit, cash-out-of-pocket) figure while still surfacing the more complete one on every card. Anyone re-running their actual shortlist through the section should read both numbers on close calls, not just the rank badge.

---

## Tests

`node tests.js` — **65 passed, 0 failed** (was 47 after Phase 8b). Eighteen new assertions:

| Group | Covers |
|---|---|
| `calcEMI` fv path | Bit-identical at `fv=0` for 4 existing-caller shapes; balloon amortizes to exactly `fv` (independent month-by-month oracle); zero-rate balloon `(P−fv)/n`; 0% residual ≡ plain `calcEMI` |
| `calcInsuranceTotal` | Closed form vs. year-by-year loop at `dep=15%` and the `dep=0` guard |
| `calcRunningCost` | `perKm × totalKm === annual` for both ICE and EV; zero-mileage and zero-km rows stay finite |
| `calcLeaseNetCost` | `netCost === rawOutflow − taxSaved`; `netCostAfterResale === netCost − resaleValue`; **the ₹29,952 perquisite pin**; `taxSaved` stays negative (not clamped) when EMI is below the perquisite |
| `calcBreakevenKm` | All three outcomes — `null`, `<= 0`, a positive figure |

DOM-coupled behavior (outside `tests.js`'s scope, same as every other `render*` function) was verified with a jsdom-driven smoke harness against the real `index.html`: switching to `hub-car`, filling shortlist rows via actual `input`/`change` events (not direct state mutation), and asserting on the rendered DOM. Confirmed, with no console errors or exceptions at any step:

- Hero, ranked cards, breakeven rows, and chart all populate correctly for 2–4 cars, including multiple ICE and multiple EV rows and reference-car reselection.
- The blank-row guard: a row with only a price and no mileage/efficiency contributes nothing to the results, the hero, or the chart.
- Clearing every field returns the section to its empty state — `cc-empty` shown, hero/breakeven/chart hidden, `#cc-results` empty — never `NaN`/`Infinity`.
- All three `calcBreakevenKm` verdicts render as sentences: "Already cheaper today" (green), "Needs N more km/yr", and (confirmed separately via the unit tests) the never-breaks-even case.
- The breakeven card hides with no EV rows present.
- Persistence: `dhanam.v1`'s `carCompare` key contains only `cars` (each car's own type/name/price/efficiency/engine flag) and `cityKm`/`hwyKm` — no lease rate, petrol price, charging rate, maintenance, insurance, or depreciation figure, confirming the tier-1/tier-2 split holds in practice, not just in code review.

No headless-browser tooling (chromium-cli, Playwright, Puppeteer) is available in this environment, and `screencapture` returned "could not create image from display" — there is no attached display to screenshot against. Layout/responsiveness at 375px (checklist items 30–36 in CLAUDE.md) could not be visually confirmed this session and should be walked by hand per the existing manual-checklist convention.

---

## Files changed

| File | Change |
|---|---|
| `calc.js` | `calcEMI` gains `fv`; new `calcRunningCost`, `calcInsuranceTotal`, `calcLeaseNetCost`, `calcBreakevenKm` |
| `tests.js` | 18 new assertions (47 → 65) |
| `index.html` | New `section-carcompare` markup (shortlist table, assumptions collapse-card, hero, breakeven card, chart, ranked result cards, caveat list) inside `hub-car`; new `.cc-*` CSS; `ccCars`/`ccBuilt` state; `ccRowHtml`/`renderCCRows`/`ccAddCar`/`ccRemoveCar`/`ccAssumptions`/`ccComputedRows`/`buildCC`/`hydrateCC`/`persistCC`/`ccVerdict`/`renderCarCompare`/`renderCCChart`; `blankState()` gains an additive `carCompare` key (no `STORE_VER` bump); `switchHub('car')`, `importWorthBackup()`, `eraseWorthData()` wired to the new hub state |
| `sw.js` | Cache version `apt-cost-v12` → `apt-cost-v13` |
| `CLAUDE.md` | New "Dhanam Car — Compare Cars specifics" section; `cc-*` in the naming-conventions list; the four new `calc.js` functions and `calcEMI`'s `fv` argument in the core-calculations list; the persistence section's calculator-hub bullet updated (Compare Cars is now the first to persist by design alongside Worth); manual-checklist items 30–36; `sw.js` cache version reference updated |
| `TASK-UX-REDESIGN.md` | Header pointer, B11/B12 rows, R38–R44 rows, and the Phase 9 section heading all marked shipped; sequencing notes updated to point at Phase 6/R21 as the next item |

---

## What's next

Phase 9 was a deliberate, disclosed deferral of **R21** (state-aware assumptions — stamp duty and registration presented as universal Telangana values), which remains the single highest-severity open item in `TASK-UX-REDESIGN.md`. Phase 9 was purely additive and touched nothing R21 will need to change, so picking it back up is unaffected by this phase.

Two things worth flagging for whoever picks up Compare Cars next:

- The `marginalRate` argument to `calcLeaseNetCost` is a flat user-entered percentage, not derived from `calcIncomeTax`. The task brief flagged this as an intentional v1 simplification (a caller-side upgrade later, no signature change needed) — it means Compare Cars doesn't pick up Section 87A marginal relief the way the lease panel above it does, and the caveat list says so.
- The worked example above used synthetic prices, not the owner's real shortlist. Re-running their actual 14 cars through the shipped section — and checking whether the real ranking (pre- and post-resale-credit) disagrees with the workbook the way the synthetic pair did — is the natural next step and the actual point of building this.
