# Phase 8b Report — Motor-Car Perquisite Constants (Income-tax Rules, 2026)

*Completed: 2026-07-30 · Executed from `TASK-UX-REDESIGN.md`'s Phase 8b spec (R37). Origin: D15 in `UX-ANALYSIS.md` — the owner asked directly, the same day Phase 8 shipped, whether Dhanam Car reflects the perquisite rules effective 2026-04-01. It didn't.*

---

## The shape of this bug

Phase 8 fixed two bugs in how the car hub *computed* things. This one is different and, in a way, worse: nothing was computed wrong. `calcPerquisite()` did exactly what it was written to do. It just held numbers that stopped being law on **2026-04-01**, four months before anyone asked.

```js
// before
function calcPerquisite(bigEngine, hasDriver) {
  return (bigEngine ? 2400 : 1800) + (hasDriver ? 900 : 0);
}
```

Those are the Income-tax Rules, 1962 figures. The Income-tax Rules, 2026 — made under the Income-tax Act, 2025, CBDT-notified **2026-03-20**, in force from **2026-04-01** — roughly tripled them:

| Scenario | Rules 1962 (what the app returned) | Rules 2026 (in force since April) |
|---|---|---|
| Engine ≤1.6L **or electric** | ₹1,800/mo | **₹5,000/mo** |
| Engine >1.6L | ₹2,400/mo | **₹7,000/mo** |
| Chauffeur add-on | ₹900/mo | **₹3,000/mo** |

No test would have caught this, because there was nothing wrong to catch — the old tests asserted the old values and passed happily. Nothing on screen carried a date. This is rot, not breakage, and it's a different failure mode from anything the test suite was built to find.

---

## Verifying before changing

The brief handed me the replacement numbers. I checked them against independent sources anyway, for a specific reason: this whole two-phase effort exists because the app shipped confidently wrong numbers, and swapping one set of unverified constants for another would repeat that mistake with better intentions.

Three things came back from that check:

1. **The values and dates hold.** ₹5,000 / ₹7,000 / ₹3,000, notified 2026-03-20, commencing 2026-04-01 — confirmed across multiple independent write-ups.

2. **The row mapping is the part that could have gone wrong, and it's correct.** The old Rule 3(2) table had *two* rows for an employer-provided car: one where the employer meets running and maintenance expenses (₹1,800/₹2,400), and one where the employee does (₹600/₹900). The ₹5,000/₹7,000 figures replace the **employer-meets-expenses** row — which is precisely what this hub models, since its inputs are the employer paying EMI, fuel and driver allowance. One early source summary described the new figures as applying where expenses are *not* reimbursed; a second, more detailed source contradicted it and matched the 1,800 → 5,000 lineage. Had the first been taken at face value, this fix would have introduced a brand-new wrong number while claiming to remove one.

3. **The rule *number* could not be confirmed.** No source I found states which rule of the Rules 2026 governs motor-car perquisite valuation. The caveat copy previously read "per IT Rule 3(2)" — a citation into the 1962 rulebook. Rather than carry that forward into a new rulebook where it may not hold, the copy now cites the instrument and its commencement date and stops there. **An unverifiable citation is worse than no citation**, because it looks checkable and isn't.

---

## What changed

### `calc.js` — the four constants

```js
function calcPerquisite(bigEngine, hasDriver) {
  return (bigEngine ? 7000 : 5000) + (hasDriver ? 3000 : 0);
}
```

Above it, a comment records the instrument, the notification and commencement dates, which row of the table this models, what it superseded, and why an EV belongs in the `bigEngine = false` branch — so the next person to read this doesn't have to redo the research above to know whether it's current.

`calcIncomeTax()` was **deliberately not touched**, per the spec. The slabs, the ₹75,000 standard deduction and the ₹12L/₹60,000 rebate were checked in the same pass and are unchanged for FY2026-27. Bundling an unrelated edit would have made this commit harder to review against its stated scope.

### `index.html` — the copy, and one addition

The caveat line stated the old figures verbatim, so it was wrong on screen, not just in code. It now names the instrument, its commencement date, the new figures, **and what they replaced** — the last part deliberately, because a user who knew the old ₹1,800 number and sees ₹5,000 deserves to know it's a rule change rather than an app bug:

> Perquisite per the Income-tax Rules, 2026 (in force 1 Apr 2026): ≤1600cc or electric = ₹5,000/mo · >1600cc = ₹7,000/mo · company driver = +₹3,000/mo. These replaced the long-standing ₹1,800/₹2,400/₹900 figures under the Income-tax Rules, 1962 — roughly a 3× increase, so a car package that looked worthwhile under the old table may not under this one.

**One scope addition beyond the brief:** the engine checkbox now reads "Engine > 1600cc *(leave off for electric)*". The ≤1.6L bracket explicitly covers EVs, and nothing on screen said so. An EV owner reasoning "my car isn't small" and ticking the box would overstate their perquisite by ₹24,000/year. This is a one-span change to a field whose meaning the rule change altered, so it belongs in this commit rather than a later copy pass.

---

## Effect on the numbers

`perqAnnual` feeds **Carve-out A** and **Additive B**'s taxable income. **Baseline never calls `calcPerquisite()`**, so it's unaffected — which makes the comparison, not just the absolute figures, the thing that moves.

Understatement of `perqAnnual`, all four combinations:

| Configuration | Was | Now | Understated by |
|---|---|---|---|
| ≤1.6L / EV, no driver | ₹21,600/yr | ₹60,000/yr | ₹38,400 |
| >1.6L, no driver | ₹28,800/yr | ₹84,000/yr | ₹55,200 |
| ≤1.6L / EV + driver | ₹32,400/yr | ₹96,000/yr | ₹63,600 |
| >1.6L + driver | ₹39,600/yr | ₹1,20,000/yr | ₹80,400 |

D15 originally gave this range as ₹38,400–₹55,200. That covers only the no-chauffeur cases; the add-on itself more than tripled, so the true top of the range is ₹80,400. `UX-ANALYSIS.md` corrected in place.

On the owner's scenario (₹4.5L/mo fixed pay, ₹30K car EMI, ₹5K fuel, ≤1.6L, no driver, new regime), both company-car options lose ₹998/month of advantage — the extra ₹38,400 of taxable perquisite at 30% plus 4% cess:

| | Before | After |
|---|---|---|
| Baseline — effective net | ₹2,91,350/mo | ₹2,91,350/mo *(unchanged, as expected)* |
| Carve-out A vs baseline | +₹10,358/mo | **+₹9,360/mo** |
| Additive B vs baseline | +₹34,438/mo | **+₹33,440/mo** |

The recommendation doesn't flip here, but it's now computed against current law — and at smaller car packages the margin between "company car wins" and "it doesn't" is exactly where a ₹38K–80K/year swing in taxable income decides the answer.

---

## Tests

`node tests.js` — **47 passed, 0 failed** (was 45). The four existing `calcPerquisite` assertions were asserting the superseded values, so they were updated rather than added to, and two property checks were added alongside:

| Assertion | Why |
|---|---|
| `calcPerquisite(false, false) === 5000` | Pins ≤1.6L / EV |
| `calcPerquisite(true, false) === 7000` | Pins >1.6L |
| `calcPerquisite(false, true) === 8000` | Pins ≤1.6L + chauffeur |
| `calcPerquisite(true, true) === 10000` | Pins >1.6L + chauffeur |
| Chauffeur add-on is flat ₹3,000 across both engine sizes | A property the four point assertions imply but never state — and the one most likely to break under a careless edit to the ternaries |
| No value in `[1800, 2400, 900, 2700, 3300]` is returned by any combination | Directly targets the failure mode that caused this bug: a revert to superseded law. A generic "did the number change" test wouldn't say *why* it matters; this one names the stale table |

The block carries a comment saying plainly that these exist to **pin statutory values, not to prove arithmetic** — the function is a lookup table, so the only way it can be wrong is by holding stale law. A failure here means someone changed the constants, and the right response is to check the Act, not to update the expectation.

Manual verification of `renderCarCalc()` (DOM-coupled, outside `tests.js`) via the same headless stub harness Phase 8 used: the summary reads ₹5,000/mo · ₹60,000/yr; the A/B advantages land at the figures above; Baseline is byte-identical to before; and the edge sweep (empty inputs, zero EPF, old regime, both checkboxes on) produced no `NaN`/`Infinity`/`undefined`. Inline scripts re-parsed clean.

---

## Files changed

| File | Change |
|---|---|
| `calc.js` | `calcPerquisite()` → Rules 2026 table, with instrument/dates/row-mapping recorded in a comment |
| `index.html` | Caveat line rewritten (new figures, instrument, commencement date, what they replaced); engine checkbox gains "(leave off for electric)" |
| `tests.js` | Four assertions updated to current law + two property checks (45 → 47) |
| `tests.html` | Same, mirrored |
| `sw.js` | Cache version `apt-cost-v11` → `apt-cost-v12` |
| `CLAUDE.md` | `calcPerquisite` documented in the Dhanam Car section and the function list; new "statutory constants rot silently" convention; checklist item 28 (old 28 → 29) |
| `UX-ANALYSIS.md` | D15 marked fixed with outcome; priority row 0d struck; understatement range corrected to ₹38,400–₹80,400 |
| `TASK-UX-REDESIGN.md` | R37 struck through; Phase 8b marked shipped; remaining-work paragraphs updated (R21 is again the top open item) |

---

## The pattern worth naming

**Three bugs in two days — R33 (EPF model), R34 (87A cliff), R37 (perquisite table) — all in the same hub, all statutory.** Each was a number that was correct when it was typed. None had a date attached anywhere a user could see. None had a test that would fail when the law moved.

R37 is the purest case: no logic error at all, just four integers that quietly stopped being true on a Wednesday in April. The app kept computing confidently the whole time.

Phase 6b's provenance/as-of-date work is the structural fix, and this phase shipped a one-hub version of it. Until 6b lands, the cheap mitigation is now written into CLAUDE.md as a convention: **any commit touching a tax, duty, slab or perquisite constant must date it in the visible copy and pin it with a test, in that same commit.** Together those turn a silent rot into a claim a user can check and a test can defend.

## What's next

Phase 8b closes D15. **R21 (state-aware assumptions — stamp duty and registration presented as universal Telangana values) is once again the single highest-severity open item**, and it is the same class of defect as this one, one layer larger: constants that are confidently wrong for most users with nothing on screen to indicate it.
