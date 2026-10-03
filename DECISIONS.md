# DECISIONS.md

Append-only log of "we considered X, chose Y — don't quietly revert to X."
One line per decision, newest work at the bottom of each group. This is the
"have we already settled this?" lookup — it does **not** replace the full
reasoning, which lives in `ARCHITECTURE.md` (how the chosen design works),
the `PHASE-*-REPORT.md` files (what shipped when), `UX-ANALYSIS.md` /
`ARCHITECTURE-ANALYSIS.md` (the D-numbered findings), and
`TASK-UX-REDESIGN.md` (the R-numbered work items and B-numbered owner calls).

`CLAUDE.md`'s "Read before you touch X" index points into `ARCHITECTURE.md`;
come here when you're about to add something that a past phase might already
have deliberately left out or taken out.

**Legend:** R = work item, B = owner decision, D = analysis finding.
"⚠ don't" marks a reversal that would reintroduce a shipped bug or break a
stated principle.

---

## Cross-cutting principles

- **D6 — never rebuild an input row's `innerHTML` from its own `oninput`.** Focus is dropped mid-keystroke. Applies to `section-disb` tranche rows, Compare Cars shortlist rows, and any future editable-row list. Rebuild on add/remove/hydrate and on `<select>` `onchange` only. → `ARCHITECTURE.md` (Loan disbursement, Compare Cars).
- **D7 / R62 (Phase 15) — the 16px mobile-input rule is a `!important` catch-all, not a selector list.** The list failed six times in three modes (never-added, out-specified, out-ordered). ⚠ don't reintroduce a list, and don't "improve" the verification grep into one that enumerates sub-16px rules (it goes blind to multi-line rules). → `ARCHITECTURE.md` §Styling, `MANUAL-TESTS.md` #57.
- **D8 / B4 / R8 (Phase 17) — full keyboard + ARIA support; audience is general public, not power users.** Every collapse header is a real `<button>`; every new collapse/expand control sets `aria-expanded`. ⚠ don't ship a `<button>` collapse control with no `aria-expanded` update. → `ARCHITECTURE.md` §Keyboard & ARIA.
- **R32 / R63 — "state, don't model."** When a real figure would need an assumption the app can't know (post-tax redemption timing, a specific lease's foreclosure cost, property appreciation), state the caveat in words rather than computing a number that looks authoritative. → `ARCHITECTURE.md` §Styling (Grow caveat), Dhanam Car (employer-tie caveat).
- **Advice-free copy (R22 #42, R65, R74/R75).** No sentence anywhere reads as a recommendation ("you should", "we recommend", "the best option is"). Comparisons state arithmetic and name their own biases; they never pick for the user. ⚠ don't turn a comparison card into "personal advice" — `UX-ANALYSIS.md` §Strategic-2's second promise was declined on purpose.
- **Statutory constants rot silently (R33, R34, R37).** Any tax/duty/slab/perquisite value: (a) date it in a comment, (b) state that date in visible caveat copy, (c) add a `tests.js` assertion pinning it — including that no superseded value survives.
- **Colour discipline (palette rules 1–5, `COLOR-PALETTE-ANALYSIS.md`).** Exactly three hues: gold (hero/emphasis), green (real positive delta), red (real cost/negative delta). ⚠ don't add a fourth hue without revisiting that doc. Colour is never the only signal.

## Persistence & storage

- **Tier-1 only (`UX-ANALYSIS.md` §2.1).** Store facts about the user; never store tier-2 market/statutory assumptions — they must reload from code. A field with a meaningful default persists only when changed from it.
- **Reads/writes never throw.** Corrupt/foreign/wrong-version blob → treated as absent (`storageUnreadable`); failed write → `storageFailed`; hydration runs after first paint.
- **`history` is append-only**, one entry per save-day, cap 120. Can't be reconstructed — don't drop it.
- **B11 (2026-08-07) — Compare Cars persists by design** (first calculator hub to), tier-1 = `ccCars` + `cc-city-km`/`cc-hwy-km` only. Reasoning: a dealer-quoted shortlist is closer to a balance sheet than a scratch calc. *(S9, 2026-09-25: the km pair became one `annualKm`; stored shape is `DS.carCompare = { cars, annualKm }`.)*
- **R21 (Phase 6a) — `DS.propertyState` persists a state code only**, never the resolved rates (still tier-2, re-resolved from `PROPERTY_STATES`).
- **R25 (Phase 17) — tier-3 UI state (dismissals, reveal open/closed, selected-car index) never touches `dhanam.v1`.** `dhanam.orientationSeen` is a separate key so `eraseState()` and backup export/import can't touch it. Same rule for `ccRevealOpen`/`ccOppRevealOpen`/`ccCrossRevealOpen`/`ccOwnCurveIdx`/`carMode`. *(Reveal flags and `carMode` retired by S6/S7; today's Car tier-3 state is `carActiveTile`, `ccOwnCurveIdx`, `ccDirty` and collapse open/closed.)*
- **R65 (Phase 16) — `worthSnapshot()` is the single accessor for `DS.worth` outside `hub-worth`.** Reads the blob, not the DOM; returns `null` (never a fabricated ₹0) when nothing real is saved. Any new cross-hub reader of the balance sheet must go through it.
- **No sync, ever** — it would require a backend. JSON backup/restore is the only cross-device path (`UX-ANALYSIS.md` §2.5).

## Service worker / PWA

- **R5 (Phase 4) — no outbound requests at all.** Fonts self-hosted; the About page's "watch the Network tab" claim depends on this. ⚠ don't add a CDN font, an analytics ping, or an error-reporting endpoint (R66).
- **R29 (Phase 4b) — `safePut` swallows cache-write errors** (the response is already served; a rejected `cache.put` would just be console noise).
- **`calc.js` is served network-first, like `index.html` (Phase 22.1 hotfix).** It's shell code, API-locked to the inline script; a fresh HTML shell against a cache-first stale `calc.js` broke the app after the Phase 22 deploy (`ReferenceError: calcLeaseMarginalRate`). ⚠ don't move `calc.js` back to the cache-first branch. Bump `CACHE` **and** `BUILD_STAMP` by hand on every user-visible ship.

## Navigation & landing

- **R10 (Phase 6a) — 5 nav tabs is the ceiling.** Overflow gets a pure-CSS scroll-shadow (background-image only, nothing over the tabs). ⚠ don't add a 6th tab — `hub-about` reaches via a header link + landing footer instead (R22).
- **R22 (Phase 6b) — `hub-about` is a `hub-content`, not a `.hub-tab`.** Provenance list disowns its defaults (states the date, never the *why*). Privacy claim is checkable.
- **R24 (Phase 6d) — deep-link helpers open nested drill-downs idempotently** (`openPrepayCalc()` opens `section-loan` + `adv-section`), and a second click never collapses what it opened.
- **R25 (Phase 17) — first-run orientation is one dismissible line, not a modal/tour.**
- **R67–R69 / B14 (Phase 19) — Worth is the anchor.** Nav order is frequency-of-need (`Home · Worth · Grow · Home · Car`); the landing "Know My Net Worth" tile became `#landing-worth-card` (full-width, above the grid). **B14: the card shows the delta only, never the absolute net-worth figure** (D15: "Hide amounts" can't reach the landing page). ⚠ don't copy the hub's `"· was ₹X"` basis clause onto this card.

## `hub-apartment` (Dhanam Home)

- **R14 (Phase 3b) — `section-detail`/`section-loan`/`section-disb` are an exclusive accordion.** Opening one closes the others; clicking an open one collapses it. Scoped to exactly these three — nested `.collapse-card`s are legitimate parallel drill-downs and are **not** part of it. Panels lazy-init once (`*Opened` latches); collapse is a CSS change, never a re-render.
- **R21 (Phase 6a) — `q-state` drives stamp duty / registration** from `PROPERTY_STATES` (9 states, dated, non-exhaustive). All three rate fields stay editable; the active state's name flows into every label + export header. Telangana default reproduces every pre-R21 number.
- **R24's 6d-i — the Buy-vs-SIP `.sip-caveat` sits above the hero**, outside the closed compare card, and names *both* sides' ignored factors (SIP tax/uncertainty; the loan's own §24/80C benefits). No tax rate printed in it. **Superseded by S10 (2026-09-26):** the on-hero line is now one sentence ("Loan side is guaranteed and tax-free; SIP side is not."); the full framing moved to `#home-limits-card`, the hub's one collapsed "Assumptions & limits" panel.
- **Loan disbursement (`section-disb`)** was once its own hub; folded in as a sub-topic of home buying. ⚠ don't call `renderDisbTranches()` from `renderLoanDisb()` (D6 focus trap).

## Dhanam Grow (`hub-sip`)

- **R16/R18 (Phase 3c) — `su-stepup` treats a typed `0` as a real value** (not blank); years inputs clamp to 1–50 on the field itself, not just in the calc.
- **B6 — `calcSIP` (annuity-due) and `calcStepupSIP` (ordinary-annuity) disagree ~1% even at 0% step-up.** Documented and bounded in `tests.js`, not "fixed". ⚠ don't plot the two functions against each other as two lines — the step-up chart compares `calcStepupSIP` at the real vs 0% step-up instead.
- **R63 (Phase 15) — one pre-tax `.sip-caveat` above the tab row** (D4: once, not per-tab — every tab-open path already crosses it). Copy only; **R31** (an actual post-tax figure) remains unbuilt, gated on **B10** (unanswered). **Superseded by S10 (2026-09-26):** the above-tab-row `.sip-caveat` is gone; the pre-tax facts (₹1.25L exemption, 12.5% rate, 23 Jul 2024) now live in `#sp-limits-card`, a collapsed panel below the section title, plus a "Shown pre-tax" note on the `ti-corpus` popover.

## Dhanam Car (`hub-car`)

- **R56 (Phase 14) — Loan / Lease / Cash selector, Loan default.** Before this, the hub opened on the lease panel and demanded salary/EPF/regime before showing anything — a wall for the ~80% without a lease policy. *(Superseded: S6 removed the hub-level selector on 2026-09-25; the tile redesign makes **Buy a car** the default and puts the lease in tile 3, CR2/CR3.)*
- **The lease panel is gated, not simplified.** `setCarMode()` toggles its `display` only. The lease perquisite analysis is the app's most differentiated feature *because* it's deep. ⚠ if asked to "simplify/unify" the lease fields with loan/cash — gate visibility instead. **Amended Phase 22:** this protects *depth*; R75/R76 deliberately change *sequencing* (the glance comes first) and unify *derived* parameters (not the panel's own gross/EPF/regime inputs). **Amended 2026-09-29/10-01 (CR3, CR9):** the gate is now tile 3 itself (`setCarMode()` no longer exists); depth is unchanged.
- **R55 (Phase 14) — `calcLeaseNetCost` → `calcOwnershipCost({mode,...})`**, one engine, three capital layers over a shared running/maintenance/insurance/depreciation core. Real rename, every call site updated, no shim. `taxSaved = 0` for loan/cash is **correct Indian law**, stated on screen, not a blank.
- **R33 / D14 (Phase 8) — `car-epf-amt` is an entered payslip figure**, never `car-epf-pct × car-basic` (that overstated the deduction ~₹32K/mo and hit take-home directly). `car-basic` is *total fixed pay*, not statutory Basic. EPF is constant across both scenarios. ⚠ don't reintroduce `car-epf-pct` or a per-scenario EPF derivation.
- **R34 (Phase 8) — new-regime §87A marginal relief** caps tax-before-cess at `taxable − 1200000` (removes the old cliff, stops binding at ₹12,70,588.24). **The old-regime ₹5L rebate stays a genuine cliff** — a test pins it. ⚠ don't "consistency-fix" relief onto the old regime.
- **R37 (Phase 8b) — `calcPerquisite` holds Income-tax Rules 2026** (₹5,000 / ₹7,000 / +₹3,000), in force 2026-04-01, replacing the 1962 figures (₹1,800/₹2,400/₹900). Electric is always the ≤1.6L bracket.
- **R74 / D17 (Phase 22) — Additive B ("car on top of full CTC") retired.** It didn't hold employer spend constant, so it won 7/7 tested combinations — a branch that structurally can't lose. ⚠ **do not re-add it as a missing feature.** Survives as one caveat line. `renderCarCalc()` now compares Baseline vs Carve-out only.
- **R45 (Phase 10a) — `#car-hero` promotes the live winner** (Baseline vs Carve-out) with an in-words advantage sentence and a legible zero/negative state; `car-summary-box` was dropped, not folded (every number is elsewhere).

### Compare Cars (`cc-*`)

- **R38/R39/R41/R42/R43/R44 (Phase 9)** — `calcEMI` gains `fv` (residual/balloon; `fv=0` ≡ plain EMI); perquisite comes from `calcPerquisite` not a flat ₹5,000; rank-1 is gold and green appears only for real positive deltas; breakeven renders as sentences; blank/partial rows (`price>0 && eff>0` off raw state) contribute nothing; only `ccCars` + `cityKm`/`hwyKm` persist (now `annualKm`, S9).
- **B12 (2026-08-07) → retired by R50 (Phase 13).** Ranking is on `netCost` — money out the door — full stop. The after-resale figure moved behind the R51/R52 reveal, so there's no competing figure on every card for the ranking to justify itself against. `#cc-caveat` states the consequence (favours cheaper cars over ones that hold value).
- **R40 → superseded by R50/R51/R52 (Phase 13).** `calcCarDepreciation` is an IRDAI insured-declared-value schedule, not a resale predictor, and one ICE curve applied to EVs too — so `netCost`/`netCostAfterResale` are both still computed but the after-resale figure is reveal-only (tier-3), shown one car at a time on the cost-vs-value chart with a permanent "a forecast, not part of the ranking" label. `#cc-caveat` / the caveat list say what the figure actually is (R54). *(S7, 2026-09-25: no reveal any more. Resale is a plain line under `cc-owncurve-chart`, still outside the ranking.)*
- **R49 (Phase 13) — `calcOwnershipCurve()`** produces the per-year series; EMI computed once at full term; `cumulativeCost[N−1] === netCost` and `− carValue[N−1] === netCostAfterResale` hold by construction (pinned).
- **R53 / B8 (Phase 13) — outstanding-loan-balance overlay** on the depreciation chart: `--red` series, sliced to the *actual selected term* (`cc-years`, not a literal `5`), underwater note names the real first-through-last year range (never "from year N onward"). Guard is `loan > 0` only (0% rate is valid linear amortization). *(Deleted from Compare Cars by S7; the same check returned as tile 1's underwater section, `calcLoanUnderwater` + `cbuy-uw-chart`, CR7. The real-year-range rule still applies.)*
- **R57/R58/R59/R60 (Phase 14)** — per-car down payment (Loan mode, show/hide not grey); opportunity-cost reveal visible in **all three modes** (B13 fairness — a Loan user's down payment gets the same question as a Cash buyer's full price); **Car Buying / `cb-*` section retired**, its tenure grid + depreciation table + balance overlay migrated verbatim into the per-car detail view (`ccRenderLoanDetail()`), then deleted; cross-mode card compares the same car three ways, and `#cc-crossmode-assumptions` states the hidden-mode inputs in words. *(S7 deleted the opportunity-cost reveal and cut the cross-mode card to two columns; CR9 moved it to tile 3 as `lg-cross-cards`. Per-car down payment remains Loan-mode only.)*
- **R76 / D17 (Phase 22) — marginal rate is derived, not a field.** `cc-marginal-rate` and `cc-has-driver` deleted. `calcLeaseMarginalRate()` (`calc.js`) is the single derivation — exact incremental rate over the shield band (reproduces the §87A dip), signed shield never clamped, bounded at 150%. `carLeaseProfile()` reads the Company Car Lease panel's salary/EPF/regime/driver once per render. ⚠ don't "restore a default marginal rate" — at the hub's defaults the honest answer is a 0% rate / ₹0 shield, and that's the point.
- **R77 / D18 (Phase 22) — separate `cc-lease-rate` and `cc-loan-rate`** (defaults 10% / 9% — a company lease really does cost more than a retail loan); the Lease side of the lease/loan cards (tile 3's `lg-cross-cards` since CR9) shows its own signed Tax Saved line; caveat list gains the employer-tie/foreclosure risk (words, no arithmetic).

### "Why a lease?" glance (`lg-*`, Phase 22)

- **B19 — `#lg-card` is above the mode selector, visible in all three modes.** A Loan-mode visitor is exactly who doesn't know a carve-out lease exists. Ships with worked defaults so it answers on first paint. **Superseded by the Car tile redesign (shipped CR2/CR3, 2026-09-29):** its premise assumed every visitor might have a lease; most don't. `#lg-card` now lives in tile 3. See §Dhanam Car tile redesign below.
- **B18 — the tax shield is derived from `lg-basic` + `lg-regime`, not a hand-typed rate.** Only the derived path produces the honest "at this income you pay no tax, so a carve-out saves nothing" answer. `lg-basic`/`lg-regime` are a small, accepted duplication of `car-basic`/`car-regime` (same shape as B15/B16) — the glance must render before Lease mode is ever opened. Everything else (term, rates, residual, engine/driver flags) is genuinely shared, read live. *(Superseded 2026-10-01 by CR9/CD-5: `lg-basic`/`lg-regime` retired; one `car-basic`/`car-regime` inside `#lg-card`.)*
- **R75 — three states in the shield copy**, not just a number: zero-tax, negative shield (taxing more than saving), and the normal case. Persists nothing.

### Dhanam Car simplification (S1–S9, 2026-09-25)

- **Split into two tools: "Car loan or company lease?" (Tool A, was the glance) and "Which car costs less to own?" (Tool B, was Compare Cars).** Cash mode removed from the UI (`calcOwnershipCost({mode:'cash'})` stays in `calc.js`, still tested) — its only distinct output was the opportunity-cost reveal, deleted below. Mode is now a single `<select id="cc-mode">` inside Tool B, Loan default. *(Reversed in part by CD-3/CR8, 2026-10-01: Cash is back in `cc-mode`, which sits in tile 2's visible "How are you paying?" strip.)*
- **Reveals, the tenure grid, the depreciation table/chart, the net-cost-vs-km crossover chart, and per-card nested collapses are all deleted**, not demoted — resale is now a plain always-shown line; the lease-vs-loan comparison lost its Cash column and moved into one "Explore further ▾" (the section's only collapse control). *(CR9 moved the lease/loan comparison to tile 3. CD-6 gave tile 2 its own limits collapse, so tile 2 has two collapses. CR5/CR7 brought a 3/5/7-yr table and the underwater check back in tile 1.)*
- **Running-cost assumptions (highway multipliers, maintenance, insurance, IDV depreciation, public charging) are frozen into `CAR_RUNNING_DEFAULTS`** (`calc.js`), dated on the About page — Tool B's Assumptions card dropped from 17 fields to 7. *(CR8: term, loan rate, lease rate and residual became the shared `carTerms`, so the card now holds 3: fuel, home charging, annual km.)* `splitAnnualKm()`/`evEfficiencyFromRange()` (`calc.js`) replace the old city/highway-km pair and EV kWh/100km field.
- **Tool B derives lease pay from Tool A** (`lg-basic`/`lg-regime`) **until the payslip panel is opened once** — a one-way prefill copies both fields at that first open; afterwards they're independent, same shape as the pre-existing `lg-*`/`car-*` duplication. *(Superseded 2026-10-01 by CR9: one profile, latch retired.)*
- **Tool B's two example cars never persist until the user actually edits something** (`ccDirty` gate) — a fresh, look-only visit writes nothing to `dhanam.v1`.

### Dhanam Car tile redesign (CR1–CR13, decided 2026-09-29; **shipped: CR1–CR3 2026-09-29, CR4–CR9 2026-10-01, CR10–CR12 2026-10-03**; CR13 owner-run buyer test open)

Full plan and task breakdown: `TASK-CAR-REDESIGN.md`. Every entry below describes shipped behaviour.

- **Audience correction: Dhanam Car is for every car buyer, not the salaried-with-a-lease-policy minority.** Self-employed people, business owners, retirees and most salaried staff have no employer lease. The shipped hub opened on a salary + tax-regime form and a loan-vs-lease answer — a dead end for them. ⚠ **don't put a salary, tax-regime, perquisite or EPF field anywhere outside the lease tile.**
- **Three tiles, buyer first: "Buy a car" (default) · "Which car costs less to own?" · "Company car lease".** The tile row doubles as the hub's tab bar (CD-2 default). Supersedes the S5 two-tool stack and B19's "lease glance above everything".
- **The lease analysis keeps its depth — it moves, it isn't simplified.** "Gate, don't simplify" still holds; the gate is now the lease tile instead of a toggle on the first screen.
- **Partly reverses S6/S7 (and D-A): Cash, the loan-vs-cash comparison, and loan-balance-vs-car-value come back, in the Buy tile.** The S pass optimised for the lease persona and cut the plain buyer's features. ⚠ don't re-delete them citing S6/S7. The engine (`calcOwnershipCost({mode:'cash'})`, `calcOwnershipCurve`, `calcCarDepreciation`, `loanAtYear`) was kept in `calc.js`, so this is UI work.
- **New tier-2 on-road constants (road tax by state/fuel, registration, TCS above ₹10L) — indicative, editable, dated, pinned**, same posture as `PROPERTY_STATES`. TCS is shown as creditable against income tax, not as a cost (R32 "state, don't model").
- **Waves 0–1 shipped (2026-09-29): tile row is a real tab bar, not three links.** `switchCarTile()` is the one switch; `switchHub('car')` re-renders only the visible tile. Selected tile is tier-3 (in memory; reload returns to **Buy a car**). Hidden-tile charts rely on the existing `renderChart` `ResizeObserver` — ⚠ don't add a redraw call to `switchCarTile()`. Active tile carries a gold inset bottom bar (shape, not colour alone); the in-hub tiles deliberately drop `.tile`'s hover lift so an unselected tile never looks selected.
- **CD-6 applied: `#car-limits-card` split into `#car-limits-compare` (tile 2) and `#car-limits-lease` (tile 3)**, bullet text unchanged; bullets true of both (Tax Saved ₹0, employer tie, estimates) sit in both. Invariant 11 now reads "one per tool".
- **Feedback: one link per tile; new `car-buy` key** (`'Dhanam Car: buying a car (on-road cost, EMI)'`) — the matching Q1 choice must exist on the live form (see §Public-beta feedback link).
- **Business-owner / self-employed business-use car tax (depreciation, interest as expense, GST credit) — parked (CD-1).** Owner call: complex tax logic, not the target now; a good-to-have once the app has traction. ⚠ don't build it in as a "missing feature" before the owner reopens it; at most one caveat line.
- **2026-10-01 (CR6): loan vs cash compares end-of-term investment values, both compounded monthly.** The loan path invests the amount borrowed as a lump sum; the cash path invests each month the EMI you'd otherwise pay (end of month). Both compound at the nominal return, same convention as `calcEMI`, so a return equal to the loan rate gives a zero gap by the annuity identity. Chose this over `calcLumpsumGrowth` (annual compounding), which leaves a ~1% gap at equal rates and contradicts the "about even" copy. ⚠ Don't swap in annual compounding.
- **2026-10-01 (CR7): underwater check uses insured value on ex-showroom.** It compares loan balance with `calcCarDepreciation(ex-showroom)` — IRDAI IDV is ex-showroom based, not on-road — so financing road tax/insurance can make year 1 underwater. Sentence disappears with no crossover rather than saying "never".
- **2026-10-01 (CR8/CD-4): financing terms are one `carTerms` object with mirrored fields, not one shared strip.** Each tile keeps the field next to the number it drives (tile 1's EMI card, tile 2's "How are you paying?" strip, tile 3's "Change rates and term"); typing in any mirror writes the others. Chose mirrors over a hub-level strip so tile 1's answer stays above the fold. One shared term (1–7 yrs, default 5) — tile 2's ownership horizon and tile 3's lease term are the same number by design. Tier-2, never persisted. ⚠ Don't reintroduce per-tile copies of the state.
- **2026-10-01 (CR9/CD-5): one lease profile, no prefill latch.** `lg-basic`/`lg-regime` retired; `car-basic`/`car-regime` moved into the glance card. `carLeaseProfile()` always reads pay + bonus + EPF + regime, so the glance now includes EPF in the old regime's 80C (it passed 0 before). The B18 reason for the duplication no longer applies once both live in one tile.
- **2026-10-01 (CR9): side-by-side lease/loan cards moved from tile 2 to tile 3, financing only.** They use the glance's own car and results, so they reconcile to the rupee with its hero; running costs are identical in both modes so leaving them out changes no difference. Tile 2 keeps only "Paying by".
- **2026-10-01: primary answer open, follow-ups collapsed with a header preview — not hidden until typed.** Owner asked for gradual reveal. Hiding results until input would break the governing rule (an answer with zero typed inputs) and repeat what S7 deleted. Instead each tile keeps its first answer open; tile 1's cash comparison and underwater check and tile 3's side-by-side cards are closed collapses whose header shows the answer in a few words. Tile 1 labels its prefilled car as an example until the first edit. ⚠ Don't gate the primary hero behind input.

## Charts

- **R11 (Phase 3b) — the `ResizeObserver` in `renderChart()` is the only redraw mechanism.** No per-caller `redraw()`, no manual resize listeners. Observer keyed by DOM node (survives `innerHTML` rebuilds of the parent). ⚠ don't remove the node-identity check as a "simplification".
- **R15 (Phase 3c) — empty a chart host with `clearChart()`, never `innerHTML = ''`** (a bare clear leaves stale series in `chartCache` for the observer to repaint).
- **R17 (Phase 3c) — `chartSvg()` spaces by array index.** Non-uniform sequences must be expanded to uniform before `renderChart()`.
- **R19 — every year-based chart states its x-axis extent in the caption.**
- **R20 (Phase 3c) — a chart host must be a static DOM node**, not markup regenerated inside a parent's `innerHTML` template (rebuilding a `ResizeObserver` every keystroke). Applies to `cc-owncurve-chart`, `cc-depr-chart`, `cc-tenure-cards`, `cc-crossmode-cards`. *(The last three are deleted; today's Car chart hosts are `cc-owncurve-chart` and `cbuy-uw-chart`.)*

### Wave 2 integration (S10–S12, 2026-09-26)

- **Copy budget adopted:** hero (one number + one sentence), field hint (≤8 words), term popover (≤20 words), one "Assumptions & limits" collapse per hub (≤10 words/line, links to About). Long-form caveats consolidated on About page.
- **Per-hub caveats merged:** Car had the only pre-existing caveat lists — the lease panel's 7-bullet "Important Notes & Caveats" and Compare Cars' own 8-bullet "Assumptions & limits" — folded into one `#car-limits-card` (split per tile by CD-6, 2026-09-29: `car-limits-buy`/`-compare`/`-lease`). Home's 93-word Buy-vs-SIP `.sip-caveat` and Grow's 67-word pre-tax `.sip-caveat` are similarly folded into `#home-limits-card`/`#sp-limits-card`. Every hub now has exactly one collapsed "Assumptions & limits" card (Dhanam Car: one per tile since CD-6), long-form moved to About's "Known gaps" section. No internal IDs, no "tier-2" mention, no advice.
- **Nested collapse flattened:** two-level max (`panel → collapse`). Loan panel's `#adv-section` contains `#adv-worth-card` and `#adv-compare-card` as inline divs (no inner collapse); Buy-vs-SIP's `#sip-compare-card` renders inline inside `sip-section` (no collapse). Reduces cognitive load, surfaces full content on expand.
- **R65's "net-worth card closed by default" mitigation now applies at the `#adv-section` level (S12):** with `#adv-worth-card` flattened to a plain div (no collapse control of its own), the privacy protection is that `adv-section` itself starts closed — opening "What if I prepay?" now shows the real net-worth figures immediately, with no second expand step inside it.
- **Naming unified:** hub headers are brand names (Dhanam Worth/Grow/Home/Car), tile sublines are goal phrasing, in-hub section headers are questions (no " — " form). Aligns mental models.
- **Home loan rate:** line updated from "SBI's ~8.75% average (2025)" to neutral "8.75% p.a. default — edit to your own quote", matching About page's stance on tier-2 assumptions.

## Icons (R7, Phase 4)

- Inline SVG `<symbol>` sprite; usage is `<svg class="icon" aria-hidden="true" focusable="false">` (R27). `.icon` is `em`-sized and `currentColor` — except `.tile-icon`/`.ab-icon`, pinned to `--text-mid` so they don't inherit `.tile-title`'s permanent gold (R28). Reuse a symbol across related concepts rather than 1:1 emoji mapping; delete unused symbols (R30). Emoji stay in body/warning copy.

## Client-side error visibility (R66, Phase 16)

- `window.onerror` **and** `unhandledrejection`, both. Writes to a dismissible `#err-panel` only — ⚠ **never** `fetch`/`XHR`/`sendBeacon`/pixel, not even to a free third-party logger (forfeits the privacy claim). Deduped with a `(×N)` counter; the handler is fully `try/catch`-wrapped and falls back to one `alert`. `--red` header is the one sanctioned use outside a financial delta.

## Public-beta feedback link (2026-09-26)

- **A Google Form, not a shared doc or an in-app composer.** A form's per-question breakdown (which tool, free text) is more useful for a public beta than a single shared inbox, and it needed zero new UI beyond a prefilled link — no textarea, no submit handler, no local draft state to persist.
- **Prefill carries exactly two facts: which part of the app (`FEEDBACK_PARTS[key]`) and `BUILD_STAMP`** — never anything the user typed into a calculator. This is what keeps the About page's "nothing leaves this page" claim true: the one outbound link only ever fires on a click, never on load, and carries no calculator input.
- **`FEEDBACK_PARTS`'s nine strings must match the live form's Q1 options character-for-character.** Google Forms preselects a prefilled radio by matching the parameter's text against the choice text; ⚠ renaming a choice in the form (even fixing a typo) silently stops that option from preselecting — no error, no console warning, just a blank Q1. Check both sides whenever either changes.
- **⚠ Don't embed or iframe the form.** An embedded form would load `docs.google.com` the moment the page (or the embedding hub) renders, not on a click — the exact background request invariant 1 exists to prevent. A same-tab redirect was also rejected: it would navigate the user's only tab away from a live calculator session mid-input. `target="_blank"` keeps the app tab alive.
- **The controls are real `<a target="_blank" rel="noopener noreferrer">` elements with a static (un-prefilled) `href`, not buttons that call `window.open()`.** `prepFeedbackLink()` swaps in the prefilled URL from the `onclick`, but if that throws for any reason the anchor's original `href` still opens the plain form — the link is never fully dead.
- **`hub-apartment`'s single feedback link resolves `home` → `home-cost`/`home-loan`/`home-disb` at click time** from whichever `.section-panel` currently has the `open` class (the same check `toggleSection()` uses) — one link, not three, for a hub whose actual sub-tool varies by which accordion panel is open.
