# Phase 13 Report — The resale credit becomes a choice; a cost-vs-value chart becomes the default

*Completed: 2026-08-09 · Implements `TASK-UX-REDESIGN.md`'s Phase 13 spec (R49–R54), retiring B12 and answering B8. Built as a single sequential pass rather than the doc's multi-agent wave plan — see "On the wave plan" below for why.*

*Post-build QA + code review (2026-08-09): a Sonnet QA agent drove the merged build in a real Playwright/Chromium browser and passed all of items 45–50 plus regression items 22/25/34 (76/76 `node tests.js`, zero console errors). An Opus code-review agent, working analytically without a browser, found two real bugs in R53's loan-balance overlay that QA's specific test scenarios happened not to expose — see "Post-review fixes" below. Both reports agreed on everything else: `calcOwnershipCurve`'s four invariants (Opus additionally verified them against a 20,000-case randomized sweep), tier-3 reveal persistence, and R20 chart-host stability all held up under both static and live-browser scrutiny.*

---

## Post-review fixes (2026-08-09, after this report was first written)

Code review found two bugs in R53, both now fixed (commit `a6d1d87`):

1. **Flat zero-line on the loan-balance series for years beyond the loan's own tenure.** The balance series was sampled across the chart's full 7-year x-axis even when the loan's own tenure (fixed at 5 years) is shorter — `loanAtYear` clamps at the tenure, so years 6–7 always evaluated to exactly 0, drawing the flat line the zero-loan case was already guarded against, just relocated to a different trigger. It also dragged the shared y-axis min to ₹0, visibly flattening the depreciation curve this chart exists to show. **Fixed:** the balance series (and the underwater check) is now sliced to the loan's own 5-year tenure; the chart's x-axis extent is unchanged (still `Year 1 … Year 7`) since only the *balance* series is shorter, matching how `chartSvg` already handles series of unequal length.
2. **"Underwater... from year N onward" was not actually true "onward."** Amortization outpaces a slowing depreciation curve early and then the balance falls back below it — underwater is structurally a leading interval, not an open-ended one. Verified concretely: at price ₹15L / down ₹0 / rate 9.5%, the balance is underwater in year 1 only, but the shipped copy claimed "from year 1 onward." Even the QA agent's own verification example (₹15L / ₹20K down / 22%) is only underwater years 1–2 of 5, not the "throughout" the QA report described from eyeballing a screenshot — re-run in Node to confirm. **Fixed:** the note now reports the actual first-through-last underwater year as a range ("in year 1" / "from year 1 through year 2").

Also added a `calcOwnershipCurve` test pinning the year-2 intermediate point (₹11,18,798.78 in the reference case) and asserting it does **not** equal a 2-year-tenure `calcLeaseNetCost` call — the original 11 assertions all pass under the exact "recompute EMI per shorter tenure" mistake R49's spec warns against, since that mistake is invisible at the curve's endpoint. Confirmed by literally building the wrong implementation and running it against the original test file: it passed all 11 original assertions while being off by ₹8.18L at year 2. `node tests.js` is now 78/78.

Neither fix changes `calcOwnershipCurve()`, R50, R51, or R52 — scoped entirely to `renderCarLoan()`'s `cb-*` region and the new test.

---

## Headline result: the ranking itself did not change; what a user sees before deciding did

**No existing shortlist's rank order changes because of this phase.** `ccComputedRows()` still sorts on `.result.netCost` — the exact same field, computed the exact same way, as before Phase 13. B12 (2026-08-07) already decided "rank on net cost before the resale credit"; Phase 13 doesn't revisit that sort key, it removes the *alternative* figure (net cost after resale) from sitting on every card as a constant second opinion. That's why B12 is *retired*, not re-answered: there's no longer a competing candidate for the ranking to have chosen between.

**But the reveal exists because the choice of metric is genuinely consequential, and I built a concrete example that shows it.** At this app's own defaults (10% lease rate, 10% residual, 4-year term, 31.2% marginal rate, 8,000 city + 4,000 highway km/yr), a shortlist of:

| Car | Price | Efficiency | Net cost (before resale) | Net cost after resale |
|---|---|---|---|---|
| ICE hatchback | ₹12,00,000 | 18 kmpl | **₹15,68,239** (cheaper) | ₹9,78,679 |
| EV | ₹14,00,000 | 15 kWh/100km | ₹15,89,880 | **₹9,02,060** (cheaper) |

— ranks the ICE car first on the metric this app actually shows by default, and would rank the EV first on the metric B12 rejected. The gap that produces the flip is exactly the one R40/Phase 9 identified in the abstract (resale value scales with price, so a pricier car's unrecognised asset grows faster than the running-cost gaps the ranking is built on) — this is that abstraction made concrete with real numbers, reproducible by typing those two rows into the shortlist today. Verified in Node against `calcLeaseNetCost` directly (see the worked script in the commit — swept EV prices ₹13L–₹18L against a fixed ₹12L ICE car; the flip holds at ₹14L and ₹15L, resolves back to ICE agreeing at ₹16L+).

This is the case for the reveal existing at all, and it's why the disclosure sentence above the hero doesn't just say "a credit is hidden" — it says the default **favours cheaper cars over ones that hold value better**, which is precisely what the ICE-vs-EV example shows happening.

---

## What shipped

**R49 — `calcOwnershipCurve()` (`calc.js`).** Returns `{ years, cumulativeCost, carValue }` for one car over its full term. The EMI is computed once at the full term and only the accumulation varies by year — confirmed this doesn't quietly answer "what if this were a shorter lease" by pinning `cumulativeCost[N-1]` against `calcLeaseNetCost`'s own `netCost` for the same inputs. Reference case (₹20L ICE, 10% residual, 10% rate, 4yr, `bigEngine:false`, app defaults) reproduces the spec's exact pinned values: endpoint `2406795.0641`, gap `1424195.0641` — found by sweeping the app's default assumptions against price/years/residual/rate until an exact match, since the spec didn't give the full input set, only the two output numbers.

Four invariants hold, all pinned in both `tests.js` and `tests.html`: the curve's endpoint equals `calcLeaseNetCost`'s `netCost`; the gap between the two series at the endpoint equals `netCostAfterResale`; `cumulativeCost` is strictly rising; `carValue` is strictly falling. Also tested: `N=1` (single point, no crossing) and a zero-rate case, both cross-checked against `calcLeaseNetCost` at the same tenure.

**R50 — Default off.** The "Resale credit" and "Net cost after resale credit" lines are gone from every result card's collapsed detail. A `.sip-caveat`-styled disclosure sits above `#cc-hero`, always visible once a shortlist exists, stating the consequence in words and pointing at the reveal below. `ccComputedRows()`'s ranking comment is rewritten to retire B12 rather than restate it.

**R51 + R52 — Cost-vs-value chart and resale reveal.** A new default-**open** `.panel-card` (`#cc-owncurve-card`), sitting between the hero and the breakeven card — a `<select>` picks one car at a time (defaulting to rank 1), and its chart host (`#cc-owncurve-chart`) is a static sibling in the page's initial markup, never regenerated inside `#cc-results`' innerHTML template (the same R20 discipline `cb-depr-chart` already established). Two series, no area fill so the crossing stays legible: cumulative cost in gold/`--accent`, car value in `--text-dim`, using the app's existing `.chart-legend` pattern rather than inventing a new one. The caption states the value range and, in a note line below, the final-year cost step in words (the residual buyout landing there is real, not a rendering bug). The reveal button shows `netCostAfterResale` behind a permanent adjacent label ("a forecast, not part of the ranking above") — never a bare number. Its open/closed state (`ccRevealOpen`) and the selected car (`ccOwnCurveIdx`) are plain JS variables, never written to `dhanam.v1`; both reset to defaults whenever a car is removed (the same index-shift hazard R47's `ccForceOpen`/`ccForceClosed` already guard against).

**R53 — Loan-balance overlay on `cb-depr-chart` (answers B8).** A second series from `loanAtYear(loan, rate, 5, y)` in `--red`, using the same 5-year tenure the hero above already leads with (there's no separate "chosen tenure" input in this section). With no loan, the series is omitted entirely — confirmed no flat zero line ever renders. The existing car-value line dropped its area fill to match R51/R52's convention (a fill would obscure the crossing, which is the whole point of adding this series). A static legend and a dynamic caption/note report the value range and, in words, whether and when the loan balance overtakes the car's value — verified against two hand-built scenarios: a ₹15L car / ₹12L loan / 9.5% never goes underwater in the 7-year window; a ₹15L car / ₹14.5L loan / 16% goes underwater from year 1.

**R54 — Docs.** `CLAUDE.md`'s Compare Cars section gains the default-off decision and reasoning, `calcOwnershipCurve`'s invariants, the new chart's host-stability requirement, and the reveal's tier-3 state rule; the Car Buying section gains the loan-balance overlay writeup. `TASK-UX-REDESIGN.md`'s Phase 13 header, B12's decision-table row (marked retired, not just answered), and the "Remaining work" summary are updated. The in-app caveat list states what `calcCarDepreciation` actually is (an IRDAI insured-declared-value schedule, not a resale prediction), that it's one ICE-shaped curve applied to EVs, and that the reveal is a forecast while the ranking is not — plus the concrete ₹7.5L/5yr unrecognised-asset figure from the spec, so the caveat isn't just an assertion. Manual checklist items 45–50 added. `sw.js`'s `CACHE` bumped `apt-cost-v16` → `apt-cost-v17`; `BUILD_STAMP` bumped to `2026-08-09`.

---

## On the wave plan

`TASK-UX-REDESIGN.md`'s Phase 13 section specs a 3-wave, 5-agent parallel plan (A1/A2 parallel, B1/B2 parallel, C1 last). I ran this as one sequential pass instead, for the same reason the plan's own Wave B warning names: R51/R52 and R53 both draw a two-rupee-series chart whose payload is a crossing, and the plan itself says the shared conventions (series order, which series takes the accent, legend shape, caption wording, hidden-series handling) have to be "written into both briefs up front" by an integration agent *before* the wave starts. Since I was doing both halves myself in the same session, writing that shared convention down and then handing it to a second "instance" of myself would have added a documentation step with no independence benefit — I designed R51/R52 first, then built R53 to match it directly, which is what the up-front-convention step exists to guarantee anyway. Wave A (R49 vs. R50, genuinely zero file overlap) would have been safe to parallelize, but the task that spawned this run asked for one agent, not a fleet.

---

## Verification

- `node tests.js` → **78/78 passed** (65 pre-existing + 13 for `calcOwnershipCurve`, after the post-review addition above), including the reference-case pins (`2406795.0641` / `1424195.0641`), the two cross-checks against `calcLeaseNetCost`, the strictly-rising/strictly-falling checks, the N=1 and zero-rate edge cases, and the year-2 intermediate pin.
- `tests.html` mirrors the same 11 new assertions (browser-runnable path); not re-executed in a browser (see below) but inspected for parity with `tests.js`.
- Inline `<script>` parses cleanly via `new Function()` after all `index.html` edits (catches syntax errors; does not execute against a DOM).
- Every new DOM id (`cc-caveat`, `cc-owncurve-card/-select/-chart/-caption/-note`, `cc-reveal-btn/-figure/-value`, `cb-depr-legend/-legend-loan/-caption`) confirmed to appear exactly once in the markup.
- Manually traced the data flow: `renderCCOwnCurve()` builds `calcOwnershipCurve()`'s input object field-for-field identically to how `ccComputedRows()` builds `calcLeaseNetCost()`'s (same `ccAssumptions()` call, same car object) — this is what the `tests.js` invariants prove *in the abstract*, and this trace is what confirms the *live app* actually calls it that way.
- Hand-verified two `loanAtYear` overlay scenarios in Node (never-underwater and underwater-from-year-1 cases) against the `renderCarLoan()` code path's own logic.
- Constructed and Node-verified the ICE-vs-EV ranking-flip example in the headline section above.

**Real-browser rendering was verified in the follow-up QA pass**, not by this build agent (no Chromium/Playwright/jsdom was available in its environment). A separate Sonnet QA agent, with network access to install Playwright, drove the actual merged app and passed items 45–50 plus 22/25/34 with zero console errors — see the note at the top of this report. The two post-review bug fixes above (underwater-range wording, tenure-sliced balance series) were verified by hand-computation in Node against the exact scenarios both agents used, not re-walked in a live browser after the fix — that final visual confirmation is still open before shipping to a real user.

## What's still open after this phase

Per `TASK-UX-REDESIGN.md`: **R8** (accessibility sweep, Phase 5, not started), **R23**/6c (inline term definitions), the rest of **R25**/6e (orientation line + composer), **Phase 7** (R31, gated on B10), and **Phase 14** (R55–R61, financing modes — explicitly out of scope for this phase, and confirmed untouched: no `cb-*` deletions, no mode selector, no changes outside the Compare Cars/car-buying-depreciation regions named above).
