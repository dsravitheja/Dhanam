# TASK-CAR-REDESIGN — Dhanam Car as three tiles, buyer-first

Design agreed 2026-09-29. **Planned, not yet built** — `CLAUDE.md` and
`ARCHITECTURE.md` describe the shipped two-tool hub until this lands. Each
item below is sized to hand to Claude Code as one task and has a **Done when**
line; if it can't be checked, it isn't done. IDs are `CR<n>` (Car Redesign)
so they don't collide with R / B / D / S.

---

## Why

Dhanam is for **every Indian car buyer**, not just salaried employees — and
among salaried employees, a company car lease exists only where the employer
offers one. Self-employed people, business owners, retirees, and most
salaried staff can't lease through an employer at all.

Today's hub is built for the minority:

- The first card ("Car loan or company lease?") asks for **monthly fixed pay
  and tax regime** before it shows anything — irrelevant, and mildly
  intrusive, for someone who just wants to buy a car on a loan.
- The first answer is "lease costs ₹X less/more than a loan" — a comparison
  against an option this visitor doesn't have.
- The only buyer-relevant tool ("Which car costs less to own?") comes second,
  and its loan knobs (term, rate) sit inside "Explore further".
- The 2026-09-25 simplification (S5–S7) deleted the features a plain buyer
  uses — Cash mode, the down-payment opportunity cost, the tenure grid, the
  loan-balance-vs-value overlay — while protecting the lease analysis.

A non-lease buyer leaves within seconds. **B19's premise ("a Loan visitor
doesn't know a lease exists, so show it first") is retired** — see
`DECISIONS.md` §Dhanam Car tile redesign.

## Governing rule

A first-time visitor who **has no lease option** gets a meaningful car-buying
number (on-road cost and EMI) within 20 seconds, with zero typed inputs and
**no salary or tax-regime field on screen**. The lease analysis keeps its full
depth (the "gate, don't simplify" rule still holds) — it just lives behind its
own tile.

## Target structure

`hub-car` opens on a row of three tiles that doubles as the hub's own tab bar
(see CD-2). Selecting a tile shows that tool below the row; the row stays put,
so switching is one tap and there is no back button to manage.

| Tile | Question | Contents | Status |
|---|---|---|---|
| **1. Buy a car** (default) | "What will this car really cost me?" | On-road cost breakdown · EMI, total interest, total paid · loan vs pay cash · loan balance vs car value | **New** (engine mostly exists in `calc.js`) |
| **2. Which car costs less to own?** | unchanged | Today's Tool B: shortlist, ranking, cost-over-time chart, EV breakeven; "Paying by" gains Cash back | **Moved**, small changes |
| **3. Company car lease** | "My employer offers a car lease — is it worth it?" | Today's Tool A (loan-vs-lease answer + cross-mode cards) + the payslip analysis (`#car-lease-panel`) | **Moved**, depth unchanged |

Tile 3's subtitle says who it's for ("If your employer offers a car lease") so
a non-lease visitor can dismiss it at a glance.

---

## Wave 0 — Research. No UI.

### CR1. Research and date the on-road cost constants
- Road tax / lifetime tax by state, by fuel type and price band (several
  states exempt or discount EVs; many use price slabs). Cover the same states
  as `PROPERTY_STATES` (`index.html`, R21) plus an "Other — enter %" path.
- Registration + other one-time charges (HSRP plate, FASTag, smart card etc.) as
  one indicative figure; editable.
- **TCS on vehicles above ₹10L ex-showroom** — confirm the current rate and
  the section number under the Income-tax Act 2025 (in force 2026-04-01).
  TCS is **creditable against income tax** — it's upfront cash, not a
  cost. The UI must say so in words (R32 "state, don't model").
- First-year insurance: reuse `CAR_RUNNING_DEFAULTS`' insurance % rather than
  a new constant, unless research says it's badly off for year 1.
- All of this is tier-2: lives in code, dated in a comment, dated in visible
  caveat copy, listed on the About provenance page, pinned in `tests.js`
  (invariants 4 and 9). Indicative, editable defaults — same posture as the
  stamp-duty table.
- **Done when:** a dated table (e.g. `CAR_STATE_CHARGES`) and a pure
  `calcOnRoadCost({exShowroom, stateCode, fuel})` exist in `calc.js`;
  `node tests.js` is 100% with new pinned assertions; sources and dates are
  written down for the About page.

---

## Wave 1 — Hub shell. Move, don't change.

### CR2. Tile row as the in-hub tab bar
- Three tiles at the top of `hub-car`, styled from the landing `.tile`
  pattern, behaving as a tab bar: `role="tablist"`, each tile
  `role="tab"` + live `aria-selected` + `aria-controls` — the same semantics
  as `.sip-planner-tabs` and the hub nav (invariant 8, `ARCHITECTURE.md`
  §Keyboard & ARIA). Tab/Enter reachability is required; arrow-key roving
  is not (neither existing tab bar has it). Check the tiles still meet the
  44px touch target at ≤600px (`.tile` is excluded from that rule today).
- Default selection: **Buy a car**. Selected tile uses gold (active state) —
  colour rule 2.
- The selected tile is tier-3 UI state: in-memory only, never in
  `dhanam.v1` (R25).
- `switchHub('car')` re-renders only the visible tile's entry point (today
  it calls `renderCarCompare()` unconditionally).
- Charts in a tile that was hidden at render time: verify the
  `ResizeObserver` redraw fires when the tile is shown (hidden hosts
  currently measure 0 and fall back to 600px). Fix via the observer, not a
  second redraw path (invariant 6).
- **Done when:** keyboard-only user can switch tiles; screen reader
  announces the selected tile; switching tiles never shows a stale or
  600px-wide chart.

### CR3. Move today's tools into tiles 2 and 3 — no behaviour change
- Tool B (`cc-*`) → tile 2, as-is.
- Tool A (`#lg-card`) + `#car-lease-panel` → tile 3, as-is (tidied in CR9).
- Split `#car-limits-card` per CD-6.
- Beta feedback links: one per tile. Tile 1 needs a new
  `FEEDBACK_PARTS` key (`car-buy`) — **add the choice to the live Google
  Form first**, then the key, character-for-character (see `DECISIONS.md`
  2026-09-26).
- **Done when:** every existing Car item in `MANUAL-TESTS.md` passes with
  only navigation steps changed; tile 1 can be an empty placeholder at this
  point.

---

## Wave 2 — Tile 1, "Buy a car" (new)

Inputs are prefilled with a worked example (e.g. a ₹10L ex-showroom petrol
car in Telangana, 20% down, 5 years, 9%) so the tile answers on first paint.
Copy budget (invariant 11) applies: hero = one number + one sentence.

### CR4. On-road cost
- Inputs: ex-showroom price, state, fuel type (Petrol / Diesel / CNG / EV).
- Output: on-road total as the hero; line items for road tax, registration
  & other charges, insurance (year 1), TCS (with its "creditable against your
  income tax" note, shown only when it applies).
- State selector sets defaults only; every line stays editable (same as
  Home's `q-state`).
- **Done when:** changing state or fuel updates every line live; an EV in a
  road-tax-exempt state shows ₹0 road tax with the reason in words.

### CR5. Loan: EMI, interest, total paid
- Inputs: down payment (₹ or %), loan rate, tenure. Loan amount =
  on-road − down payment (CD-9 covers whether some lenders finance only
  ex-showroom).
- Output: EMI (hero), total interest, total paid (down payment + all EMIs).
- A flat three-row tenure comparison (e.g. 3 / 5 / 7 years: EMI and total
  interest), not a collapse, not a grid.
- Uses `calcEMI` — no new loan engine.
- **Done when:** figures match `calcEMI`/`loanAtYear` exactly; zero-rate and
  100%-down edge cases render legibly (no NaN, no ₹0 EMI hero without words).

### CR6. Loan vs pay cash
- Same car, two ways: pay cash vs take the loan and invest the cash kept back.
  Uses `calcOwnershipCost({mode:'cash'})` (still in `calc.js`, still tested)
  and `calcLumpsumGrowth`.
- One user-editable expected return (default = the app's existing CAGR
  default, dated on About).
- Advice-free (invariant 10): state the arithmetic and name the biases —
  investment return is pre-tax and not guaranteed; loan interest is certain.
- **Done when:** the comparison never reads as a recommendation; at a return
  equal to the loan rate the gap is ~0 and the copy says so.

### CR7. When is the loan bigger than the car's value?
- Loan outstanding by year (`loanAtYear`) against the IRDAI value schedule
  (`calcCarDepreciation`), as one sentence ("From year 1 to year 2 you'd owe
  more than the car's insured value") and optionally one chart via
  `renderChart` on a static host.
- Keep the existing label that the IRDAI curve is an insured-value schedule,
  not a resale forecast (R50–R54).
- **Done when:** the sentence names the real year range (never "from year N
  onward" when it ends), and disappears when there's no crossover.

---

## Wave 3 — Tiles 2 and 3

### CR8. Tile 2 ("Which car costs less to own?") — small changes
- "Paying by" select gains **Cash** back (the engine never lost it).
- Loan rate and term come from the shared source chosen in CD-4 instead of
  a second copy of the fields.
- Promote the loan settings out of "Explore further" if CD-4 puts them in a
  shared strip.
- **Done when:** changing the loan rate in one place updates tiles 1 and 2
  identically; `ccCars` persistence and backup restore are unchanged.

### CR9. Tile 3 ("Company car lease") — tidy, keep the depth
- Title and subtitle state the audience. No salary or regime field appears
  anywhere outside this tile.
- Per CD-5: unify `lg-basic`/`car-basic` and `lg-regime`/`car-regime` into
  one field each inside the tile, and retire the one-way prefill latch.
  (The B18 reason for the duplication — "the glance must render before the
  lease panel is ever opened" — no longer applies once both sit in one tile
  with one input.)
- The loan-vs-lease comparison for a single car (today's cross-mode cards in
  tile 2's "Explore further") moves here; tile 2 keeps only the "Paying by"
  select.
- `calcLeaseMarginalRate`, `carLeaseProfile`, R74–R77, R33/R34/R37 all
  unchanged.
- **Done when:** a non-lease visitor who never opens tile 3 never sees a
  salary, regime, perquisite, or EPF field; a lease user sees everything
  they see today.

---

## Wave 4 — Close out

### CR10. Entry points and copy
- Landing tile subline leads with buying (e.g. "On-road cost, EMI, and which
  car costs less to own" — final copy per the naming rules: goal phrasing on
  tiles, questions for section headers).
- About page: `hub-car` description and provenance rows for the CR1
  constants.
- **Done when:** no landing or About copy leads with "lease".

### CR11. Persistence
- Per CD-7. Default: tile 1 persists nothing in v1 (same as Tool A today);
  `ccCars` + `annualKm` unchanged. No `STORE_VER` bump needed if nothing new
  persists.
- **Done when:** a pre-redesign backup JSON restores without error and ranks
  the same cars.

### CR12. Tests, docs, ship
- `tests.js`: `calcOnRoadCost` + the CR1 table (pinned, dated); any new pure
  helper from CR5–CR7.
- `MANUAL-TESTS.md`: new items for tile switching/ARIA, each tile's
  first-paint answer, the "no salary field outside tile 3" check, feedback
  link per tile.
- `ARCHITECTURE.md` §Dhanam Car rewritten; `CLAUDE.md` hub table + naming
  conventions (new prefix for tile 1, e.g. `cbuy-*` — **not** `cb-*`, which
  is retired); `DECISIONS.md` entries flipped from "planned" to shipped.
- Bump `sw.js` `CACHE` and `BUILD_STAMP` (invariant 12).
- **Done when:** `node tests.js` is 100%, `MANUAL-TESTS.md` passes, and the
  docs describe what shipped.

### CR13. Check with real buyers
- 3–5 people who are buying or recently bought a car **without** a lease
  option. Watch them open Dhanam Car cold. Pass = on-road cost and EMI read
  aloud within 20 seconds, nobody asks "why does it want my salary?".
- **Done when:** notes are written up and any fix is logged as a new CR item.

---

## Owner decisions

| # | Decision | Status / default |
|---|---|---|
| CD-1 | Business-owner / self-employed business-use car tax (depreciation, interest deduction, GST credit) | **Decided 2026-09-29: parked.** Good-to-have once the app has traction. v1 carries at most one caveat line; nothing computed. |
| CD-2 | Tiles that open a sub-page, or a tile row that acts as the tab bar? | Default: **tile row as tab bar** (one-tap switching, no back-button/deep-link state) |
| CD-3 | Bring Cash back into the UI? | Default: **yes** — tile 1 (CR6) and tile 2's "Paying by" (CR8). Reverses S6/D-A. |
| CD-4 | One shared loan rate + tenure for tiles 1 and 2, or separate? | Default: **one shared set** (a single source both read) |
| CD-5 | Unify `lg-*`/`car-*` salary + regime inside tile 3? | Default: **yes**, retire the prefill latch |
| CD-6 | Caveats: one list per hub (invariant 11) or one per tile? | Default: **one per tile**; amend invariant 11 to "one per tool" |
| CD-7 | Does tile 1 remember inputs? | Default: **no** in v1 |
| CD-8 | State coverage for road tax | Default: same states as `PROPERTY_STATES` + "Other — enter %" |
| CD-9 | Loan principal on on-road or ex-showroom price? | Default: **on-road minus down payment**, editable loan amount |

## Parked

- **Business-use car purchase for owners / self-employed** (CD-1) —
  depreciation, interest as business expense, GST input credit where
  eligible. Revisit after traction; ⚠ don't build it in as a "missing
  feature" before then.
- "Add this car loan to Dhanam Worth" (the `car` liability row already
  exists) — useful bridge, after CR13.
- Used-car purchase, and when to sell or upgrade.

## Not in scope

- Any change to the lease tax engine or its statutory constants.
- New hubs, accounts, sync, backend.
