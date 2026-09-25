# ARCHITECTURE.md

How Dhanam's subsystems actually work, and the constraints that aren't obvious
from reading the code. `CLAUDE.md` is the lean orientation doc and carries the
cross-cutting invariants; this file is the depth. Load it when you're about to
touch one of the subsystems below — `CLAUDE.md`'s "Read before you touch X"
index points here.

**Cross-references** to *Testing*, *Naming / ID conventions*, *Core calculation
functions*, and the numbered *Color rules* point to sections that live in
`CLAUDE.md`. The append-only log of "we chose X over Y, don't revert" lives in
`DECISIONS.md` (indexed by R / B / D number). The 68-item by-hand regression
list lives in `MANUAL-TESTS.md`.

---

## Hub / tab model

The UI is organized into "hubs" (top-level tabs), toggled via `switchHub(tab)`, each a `<div class="hub-content" id="hub-<name>">`. **`hub-landing` is the default view on load** — a tile grid (`.tile-grid`/`.tile`) with one tile per hub (Grow, Home, Car) plus an above-the-grid `#landing-worth-card` for the Worth hub, linking into each destination. Clicking a tile calls `switchHub(...)` to enter that hub. The header logo/title and a `⌂ Home` nav tab (`ht-landing`) return to the landing page from anywhere.

The hubs:

- `hub-worth` → **Dhanam Worth** — net worth tracker: editable balance sheet, hero net-worth figure, change-since-last-update tile, a collapsed net-worth trend chart, a +5/+10/+20-year projection reusing `calcSIP`/`loanAtYear`, Excel export, and the backup/erase controls. The only hub that persists data — see **Persistence layer** below.
- `hub-sip` → **Dhanam Grow** — SIP planner (monthly / step-up / lumpsum sub-tabs via `switchSIPPlannerTab`)
- `hub-apartment` → **Dhanam Home** — property cost, home loan, and loan-disbursement (pre-EMI) calculators; the largest and most developed hub
- `hub-car` → **Dhanam Car** — a Loan/Lease/Cash financing-mode selector (Loan default) gating a company-car lease tax perquisite panel, plus Compare Cars (ICE vs EV cost-of-ownership across all three modes, absorbing the car-buying loan/depreciation detail as a per-car drill-down since Phase 14)
- `hub-about` → the About page (see below — deliberately **not** a sixth nav tab)

**First-run orientation line (R25/6e, Phase 17).** `#landing-orientation`, one dismissible line above `.tile-grid` — not a modal, not a tour. Dismissal is tier-3 UI state: a dedicated `ORIENTATION_SEEN_KEY` (`dhanam.orientationSeen`) localStorage key, deliberately separate from `STORE_KEY`/`SEEN_KEY` so `eraseState()` (which only ever touches those two) can't accidentally resurrect or accidentally clear it, and so it never rides along in a JSON backup export/import. `dismissOrientationLine()` hides the element and sets the key; an init-time check right after the existing `rememberingInputs()` hydration hides it again on any later load where the key is already set.

**`hub-about` is a fifth `hub-content`, deliberately not a sixth `.hub-tab` (R22, Phase 6b).** `switchHub()` already no-ops safely on a tab-less hub (its `if (btn) ...` guard on the `ht-<name>` lookup), so nothing in `switchHub()` itself needed to change. It's reached two ways instead: a small `.header-about-link` button, a sibling of `.header-inner` (not nested inside it, so it needs no `event.stopPropagation()` to avoid also triggering the logo's own "back to landing" handler) and visible on every hub since `.header` is persistent chrome, not part of the horizontally-scrolling `.hub-nav` tab row; and a `.landing-footer` under the tile grid, which doubles as R25/6e's landing contact-link placement (one footer, two links — "About · How this works" and a plain `mailto:` "Have feedback?" link — rather than two separate footers for two overlapping requirements). This was a deliberate call, not an oversight: R10's nav-tab overflow problem was already tight on phones with 5 tabs, and a 6th would have made it worse — see `TASK-PARALLEL-EXECUTION.md`'s "Cluster A" reasoning for why this and the nav-overflow fix below had to be decided together, once, rather than by independent guesses.

**Nav-tab overflow affordance (R10, Phase 6a-adjacent).** `.hub-nav`'s `overflow-x:auto` (unchanged) now pairs with a pure-CSS scroll-shadow: two "cover" gradients (`background-attachment:local`, scrolling with the tab row, hiding themselves once you've scrolled all the way to that edge) plus two "shadow" gradients (`attachment:scroll`, fixed to the viewport) that read as an edge fade whenever more tabs exist off-screen. Background-image only — no extra DOM element, so there's nothing that needs `pointer-events:none` and nothing that can block a tap on the last visible tab.

**About page provenance (R22, Phase 6b).** `hub-about` states what Dhanam is, a checkable privacy claim ("open devtools, watch the Network tab — you'll see no request leave this page," true because R5 already removed the only off-origin request the app ever made), a dated `.provenance-list` covering every statutory/market default in the app (motor-car perquisite, both tax regimes, IRDAI depreciation, `PROPERTY_STATES`, GST, the four rate defaults, Worth's projection defaults, Compare Cars' tier-2 group), a "known gaps" panel (B6's ~1% SIP timing-convention disagreement; every corpus/gain figure being pre-tax, per R32's "state-and-don't-model" assessment), and a build stamp + contact email. Per 6b's own instruction, the provenance list **disowns its defaults** — it never explains *why* 12% or 8.75% were chosen, only that they're starting points to replace, since explaining the reasoning would itself read as a recommendation. A `.provenance-row`/`-term`/`-value`/`-date` stacked list, not a table — a 3-column table squeezes the dated-prose values into unreadable narrow columns at 375px.

**Build stamp (`BUILD_STAMP`, R45/6e-ii).** A plain string constant near the top of the inline `<script>`, shown on the About page (`#about-build-stamp`, set once at init — `hub-about` has no `render*` function since it's static content, so this is a one-time `set()` call, not something that needs to survive a re-render). Deliberately distinct from `sw.js`'s `CACHE` string (that one only busts old caches and means nothing to a user); this one is what makes "I still see the bug" diagnosable on a cache-first PWA. Bump it **by hand** alongside `CACHE` whenever a user-visible change ships — neither is derived from the other, so both need editing.

**Nav order and the landing Worth card (R67–R69, Phase 19; refined Phase 22a, TASK-SIMPLIFY).** The landing page now has one door per hub: `.tile-grid` holds 3 tiles (Grow, Home, Car) plus `#landing-worth-card` above the grid for Worth, rendered by `renderLandingWorth()`. The deep-link tiles ("Finance My Home", "Buying Under Construction?", "Should I Prepay My Loan?") were removed; access those features by opening Dhanam Home and clicking the relevant action buttons in the accordion (Loan Analysis, Loan Disbursement, Advanced Payments).

`renderLandingWorth()` is the **second** consumer of `worthSnapshot()` (the first is `renderAdvWorthBridge()`, R65) — it reads `DS` only, never the `w-a-*`/`w-l-*` DOM inputs, so it renders correctly even when `hub-worth` has never been opened this session. It has three faces, chosen by what `worthSnapshot()`/`worthDelta()` return: **invitation** (`worthSnapshot()` returns `null` — no balance sheet yet; copy + one button into `hub-worth`, no `₹`/`0`/`—` in a hero slot, matching `worthSnapshot()`'s own no-fabricated-zero rule); **"just started"** (a balance sheet exists but `worthDelta()` has no comparison base yet — same state in which `renderWorth()`'s own change tile shows nothing at all; the landing card instead names the `savedAtLabel()` date so the visit isn't silent); and **delta** (reuses `worthDelta()` — the exact comparison `renderWorth()`'s own change tile uses, so the two can never independently disagree, same discipline as `calcNetWorthProjection()`'s single call site). Storage states (`storageEvicted`/`storageUnreadable`/`storageFailed`) are surfaced on this card too, not just `#w-notice` inside the hub — the one failure class a reload can't rescue the user from (§2.3) must not read as a silently empty card on the app's first screen. Called once at init (right after `loadState()`, since `buildWorth()`'s `worthBuilt` latch means `renderWorth()` itself never runs on a cold load unless `hub-worth` is opened) and again at the tail of every `renderWorth()` call, so editing the balance sheet and returning to the landing page without a reload shows the update immediately.

**B14 answered delta-only (2026-08-16) — this card never renders the absolute net-worth figure.** `.amounts-hidden`/"Hide amounts" is scoped to `#worth-main` (D15) and cannot reach the landing page, so R69 ("resolve D15 before the hero ships") is satisfied by construction here rather than by extending the blur mechanism: the delta amount itself (e.g. "Up ₹2.0L (+2.2%)") is what B14 approved showing; the landing card's basis line deliberately omits the `"· was ₹X"` clause that `renderWorth()`'s own `#w-change-basis` prints inside the hub, because that clause states the *previous absolute total* — exactly the figure "Hide amounts" exists to protect, and exactly what would leak if copied verbatim onto a page "Hide amounts" can't touch. If a future phase ever moves this card off delta-only, that clause (and the rest of D15/B14's app-wide-setting branch) has to be revisited, not just copied in.

### `hub-apartment` accordion

Within `hub-apartment`, secondary panels (`section-detail`, `section-loan`, `section-disb`) are shown/hidden via `toggleSection(id)` and `action-btn` toggle buttons, not separate routes or hubs. **They're an exclusive accordion (R14, Phase 3b):** opening one closes any other that's open, so at most one panel — and one result set — is on screen at a time; clicking an already-open panel's own button still collapses it (there's no other way back to a panel-free view). `toggleSection` lazily initializes each panel only the first time it's ever opened (`detailOpened`/`loanOpened`/`disbOpened` one-way latches) rather than on page load or on every reopen — collapsing and reopening a panel is a CSS class change only, never a re-render, so nothing typed into it is lost and `section-detail`'s prefill-from-quick-calc branch never runs a second time. This accordion is scoped to exactly these three panels; the nested `.collapse-card`s inside them (the loan/advanced/Buy-vs-SIP compare grids, the Worth trend card) are drill-downs within one task and are deliberately **not** part of it — a user comparing two of those at once is doing something legitimate. Within `section-loan`, clicking "Advanced: Extra Payments Projection" opens the nested `adv-section` idempotently and the "Buy vs. SIP" card opens its own nested compare grid — `adv-section` and `sip-section` sit deliberately outside the R14 accordion as drill-downs, so this must not, and does not, affect each other or any other nested card the user has open.

**The Buy-vs-SIP comparison carries a caveat above its hero (R24's 6d-i, Phase 6).** `.sip-caveat`, inside `sip-section`'s `sip-body`, sits above `#sip-hero` — not inside the closed-by-default `#sip-compare-card` — specifically so a reader who looks only at the hero number still sees it. States the asymmetry plainly: prepaying/not taking the loan is a guaranteed, tax-free return at the loan's rate; the SIP side is uncertain and taxed on redemption; and the loan side also has its own ignored tax benefits (Section 24, 80C under the old regime), named so the caveat doesn't just trade one bias for its opposite. No tax rate is printed in it — rates are tier-2 and belong only in the About page's dated provenance list.

**State-aware stamp duty / registration (`q-state`, R21, Phase 6a).** The app used to hardcode Telangana's stamp duty (4%) and registration (0.5%) and present the resulting total with no regional qualifier — a confidently wrong number for anyone outside Telangana, with nothing on screen looking broken. A `<select id="q-state">` in Quick Estimate (defaulting to Telangana) now drives `q-reg` (the combined %) and, once `section-detail` is opened, the split `d-stamp`/`d-regfee` fields, via `applyPropertyState()`. Rates come from `PROPERTY_STATES`, a short, dated (2026-08-08), explicitly non-exhaustive table of 9 major states/UTs — single representative figures for a straightforward urban apartment purchase, not authoritative (real rates vary by buyer gender, property type, and municipal corporation even within one state). **All three fields (`q-reg`, `d-stamp`, `d-regfee`) stay directly editable after a state is picked** — the selector only sets a default. The active state's name is shown next to the figures it drives (`qr-state-lbl` in Quick Estimate's result row, `d-stamp-hint`/`d-regfee-hint` in the Detail panel) and flows into the PNG snapshot and Excel export headers too, so an exported document can't mislabel a Karnataka user's numbers as Hyderabad's. **Persists unconditionally as `DS.propertyState`** (a state code only, e.g. `'TG'` — never the rates, which stay tier-2 and always re-resolve from `PROPERTY_STATES`), the same "tier-1 fact about the user, not a market assumption" reasoning Compare Cars' shortlist already follows (B11) — re-picking your state every visit is exactly the friction that reasoning exists to avoid. Telangana is unchanged as the default, so an untouched selector reproduces every pre-R21 number exactly, and `resetAll()` resets it back to Telangana alongside its other field resets.

---

## Loan disbursement calculator (`section-disb`, inside `hub-apartment`)

For under-construction property loans where the bank disburses funds in stages and the borrower pays pre-EMI (interest-only) on the cumulative disbursed principal until the final tranche. This used to be its own top-level hub (`hub-disb`); it was folded into Dhanam Home as a third `toggleSection` panel, next to Detailed Cost Analysis and Loan Analysis, since it's a sub-topic of home buying rather than a distinct destination — reachable via the "Loan Disbursement (Pre-EMI)" action button in the Dhanam Home accordion.

- Inputs: sanctioned loan amount, rate, tenure, an editable tranche table (`disbTranches` — array of `{ pct, month }`, rendered by `renderDisbTranches()`, edited via `disbAddTranche()`/`disbRemoveTranche(i)`), and a "pay full EMI from day 1" toggle that skips the pre-EMI phase entirely.
- `renderLoanDisb()` is the single entry point: sums interest month-by-month on the disbursed-so-far principal up to the final tranche's month, then hands off to the existing `calcEMI()` for normal amortization over the given tenure. Warns (doesn't block) when tranche percentages don't sum to ~100%.
- **Do not call `renderDisbTranches()` from inside `renderLoanDisb()`.** `renderDisbTranches()` rewrites the tranche rows' `innerHTML`, which drops keyboard focus mid-typing if it runs on every keystroke (this was a real bug — fixed). It's only called on add/remove (`disbAddTranche`/`disbRemoveTranche`), on first open (`toggleSection`'s `disbOpened` branch), and from `resetAll()`. `renderLoanDisb()` itself just recomputes and updates the results table/summary from the current `disbTranches` state.
- A single 100%-at-month-0 tranche degenerates to a plain EMI loan and must match the `hub-apartment` loan panel's numbers exactly for the same principal/rate/tenure — useful as a sanity check when touching this code.

---

## Dhanam Car (`hub-car`)

Two independent tools, stacked, no hub-level mode selector. `calc.js`'s
`calcOwnershipCost`/`calcOwnershipCurve`/`calcLeaseMarginalRate`/
`CAR_RUNNING_DEFAULTS`/`splitAnnualKm`/`evEfficiencyFromRange` are the shared
engine both tools call — never two independently-maintained cost models.

### Tool A — "Car loan or company lease?" (`lg-*`)

Three inputs (`lg-price`, `lg-basic`, `lg-regime`) answer with zero
interaction from worked defaults (₹15L car, ₹2,00,000/mo, new regime).
`renderLeaseGlance()` calls `calcOwnershipCost()` twice — `mode:'loan'` and
`mode:'lease'` — with every running/maintenance/insurance input zeroed
(financing-only: EMI, tax shield, residual; running costs are Tool B's job).
Term/rates/residual come from Tool B's own `ccAssumptions()`
(`cc-years`/`cc-lease-rate`/`cc-loan-rate`/`cc-residual-pct`, inside "Explore
further"), so both tools price the same lease identically.

The hero's `lg-hero-note` states one sentence: the zero-tax case, the
EMI-equals-perquisite coincidence, a negative-shield case, or the normal
saved-X-over-N-years case (`calc.js`'s `calcLeaseMarginalRate()` returns
`zeroTax`/`shieldAnnual`/`marginalRate`, all read here). `#lg-lines` shows
exactly three signed line items — EMI difference, Tax saved, Residual
buyout — that sum exactly to the hero's own signed figure. `#lg-taper-note`
appears only when `calcLeaseMarginalRate()`'s `rebateBoost` is true: the
lease's shield pulls taxable income into the new regime's §87A relief band,
which **boosts** the saving there (not shrinks it — get the direction right
if you touch this copy). Persists nothing.

"Reconcile against my payslip ▾" (`toggleLeasePanel()`) opens the unchanged
Company Car Lease panel below it. On the panel's first open only, it copies
`lg-basic`→`car-basic` and `lg-regime`→`car-regime` (one-way) and sets
`leasePanelOpened = true`; after that the two stay independent fields. This
flag also decides what `carLeaseProfile()` (below) feeds Tool B.

### Company Car Lease — Tax Analysis (`car-*`, inside `#car-lease-panel`)

Unchanged from before this phase except `car-basic`'s label/hint/default
(now "Monthly Fixed Pay (₹)" / "Basic + HRA + allowances, from your
payslip" / ₹2,00,000). `renderCarCalc()` compares two scenarios — Baseline
(own car) and Carve-out (CTC reduced by the car package, perquisite added to
taxable) — reading every input and writing `#car-hero` + the closed-by-default
"Compare both scenarios ▾" grid in one pass. `car-basic` is *total fixed
pay*, never statutory Basic; `car-epf-amt` is a directly-entered payslip
figure, never derived from `car-basic` (real EPF applies to Basic + DA
only). `calcPerquisite()` holds the Income-tax Rules, 2026 table (₹5,000 /
₹7,000 / +₹3,000, in force 2026-04-01). The panel's own caveat list is the
disclosure surface for every simplification here.

### Tool B — "Which car costs less to own?" (`cc-*`)

A shortlist (`ccCars`) ranked by `calcOwnershipCost().netCost` — money out
the door, full stop; resale is a plain always-shown line, never part of the
ranking. Two worked example cars ("Petrol hatchback", "Electric hatchback")
ship so the ranking renders on first paint; `ccDirty` (a tier-3 flag, set
only by a genuine user edit — a field, add/remove, or the annual-km input)
gates `persistCC()`, so those two cars are never written to `dhanam.v1` on a
look-only visit.

- **Row shape**: Type (`Petrol / Diesel` / `Electric`, internal values stay
  `ICE`/`EV` so `calc.js` is untouched), Name, On-Road Price, and one
  efficiency input per type — ICE gets Mileage (kmpl) directly; EV gets
  Claimed Range (km) + Battery (kWh), and `c.eff` (kWh/100km, what
  `calcRunningCost` actually reads) is derived on input via
  `evEfficiencyFromRange()`. The `>1600cc` checkbox renders only for an ICE
  row in Lease mode (it only affects the lease perquisite); Down Payment
  renders only in Loan mode. `ccRowHtml()` never rebuilds from a text/number
  field's own `oninput` — only on add/remove/hydrate and the Type `<select>`.
- **Mode**: one `<select id="cc-mode">` ("Paying by": Loan / Company lease,
  Loan default), read via `ccMode()`/`a.mode` inside `ccAssumptions()`. Cash
  mode is gone from the UI — `calcOwnershipCost({mode:'cash'})` and its own
  `tests.js` cases stay in `calc.js`, just unreachable here.
- **Assumptions (7 inputs, inside "Explore further ▾")**: fuel price, home
  charging rate, annual km, term, loan rate, lease rate, residual %. Every
  other running-cost figure (highway multipliers, maintenance, insurance,
  IDV depreciation, public charging rate) reloads from `CAR_RUNNING_DEFAULTS`
  (`calc.js`, dated 2026-09-25) — tier-2, never a field, never persisted.
  `splitAnnualKm(annualKm)` replaces the old separate city/highway-km pair at
  a fixed 2:1 ratio.
- **Lease pricing**: `carLeaseProfile()` reads Tool A's `lg-basic`/`lg-regime`
  (with `epfAnnual: 0`) until the payslip panel has been opened once
  (`leasePanelOpened`); after that it reads the payslip panel's own
  `car-basic`/`car-bonus`/`car-epf-amt`/`car-regime`/`car-has-driver`, same
  as before. `calcLeaseMarginalRate()` is the one derivation both this and
  Tool A call — never a second, hand-typed marginal rate.
- **Result cards**: flat, no nested collapse — badge, name, type · price,
  net cost, EMI/mo (+ signed Tax Saved in lease mode), ₹/km, and the gap to
  cheapest for rank 2+. `taxSaved = 0` for Loan is correct Indian law (no
  deduction on a personal car loan), stated on the card, not a blank.
- **Chart** (`cc-owncurve-chart`, a static DOM sibling — never regenerated
  inside `#cc-results`' innerHTML, per the chart-host rule): cumulative cost
  vs. car value for one selected car, `calcOwnershipCurve()`'s endpoint
  always equal to that car's `netCost`. A plain line below it states the
  resale value at the final year — no reveal button.
- **"Explore further ▾"** (`#cc-explore-card`) is Tool B's *only* collapse
  control: the Assumptions inputs, a two-column Lease-vs-Loan card for the
  selected car (`renderCCCrossMode()`, states its rates/residual/derived
  marginal rate in words, marks the active mode "(current)"), the breakeven
  card (needs ≥1 ICE and ≥1 EV row), and an 8-bullet "Assumptions & limits"
  list. No nested collapse inside it.
- **Persistence**: tier-1 only — `DS.carCompare = { cars, annualKm }`, cars
  carrying `type/name/price/eff/range/battery/bigEngine/downPayment`. Gated
  on `ccDirty` (above). `hydrateCC()` migrates an old blob: `annualKm =
  saved.annualKm ?? (cityKm + hwyKm)`; an EV row saved before `range`/
  `battery` existed keeps its old `eff` (its row hint says so and asks for
  range/battery to update it); a row with both recomputes `eff` from them.

Deleted outright (not demoted): the opportunity-cost reveal and its
`cc-cash-cagr` field, the "three ways" cross-mode reveal, the 3/5/7-year
loan-tenure grid, the IRDAI depreciation table + loan-balance-overlay chart,
the net-cost-vs-km crossover chart, and every per-card nested collapse. All
were tier-3/drill-down features that made the hub's first screen too
expensive relative to what they added; nothing about the underlying math
changed — `calcOwnershipCost`/`calcOwnershipCurve`/`calcCarDepreciation`
still compute the same figures, just not all shown by default.


---

## Persistence layer

There are no API calls, no database, and nothing ever leaves the device. Every input has an `oninput`/`onchange` handler that recalculates and re-renders synchronously (no debouncing, no async).

Since Phase 2a there *is* a small `localStorage` layer, and the rules around it are strict (the short list of these is also in `CLAUDE.md`'s invariants):

- **One versioned key**, `dhanam.v1`, plus a `dhanam.seen` marker used to detect browser eviction. `saveState()`/`loadState()`/`eraseState()` are the only entry points.
- **Only tier-1 data is stored** — facts about the user (balances, their loan's numbers). **Never store tier-2 market or statutory assumptions** (the 8.75% rate default, stamp duty %, tax slabs, IRDAI depreciation): they must reload from code every time, or a stale saved value silently outlives reality. A field that has a meaningful app default (like `l-rate`) is persisted *only when the value differs from that default*. Full rationale in `UX-ANALYSIS.md` §2.1.
- **Reads and writes never throw.** A corrupt, foreign, or wrong-version blob is treated as *absent* (`storageUnreadable`), a failed write sets `storageFailed` so the UI never claims data is safe when it isn't, and hydration runs **after** first render so a bad blob can't block paint. This matters more than usual: it's the only bug class in the app that a reload can't rescue the user from.
- **The schema is flat and additive** — unknown keys ignored, missing keys defaulted. Only bump `STORE_VER` for genuinely breaking shape changes, and write a real migration when you do; never silently discard a user's balance sheet.
- **`history` is append-only**, one `{date, netWorth}` entry per save-day (same-day saves overwrite), capped at 120. It exists so the change tile and the trend chart have something to compare against — history cannot be reconstructed retroactively, so don't drop it.
- Calculator hubs persist nothing unless the user opts in via the loan panel's "Remember my inputs on this device" toggle (default off; switching it off deletes the stored inputs). `hub-worth` persists by design — a balance sheet you retype every visit is worthless. **Compare Cars (`hub-car`'s `cc-*` section) persists by design too (B11, Phase 9)** — the first *calculator* hub to do so — on the same reasoning: a shortlist of dealer-quoted cars is closer to a balance sheet than to a scratch calculation. Only `ccCars` and the two driving-pattern fields are stored; every other Compare Cars input is tier-2.
- Users can **download a JSON backup, restore one, and erase everything**. Imports are validated exactly as `loadState()` validates. This is the only way to move data between devices; there is no sync and adding one would require a backend (`UX-ANALYSIS.md` §2.5).
- **`worthSnapshot()` (R65, Phase 16) is the one and only place outside `hub-worth`'s own code that reads `DS.worth`.** `ARCHITECTURE-ANALYSIS.md` §2 warned specifically about a calculator reaching into another hub's state via shared globals with nothing enforcing the boundary — this function *is* that boundary. It reads the persisted blob, not the DOM (`buildWorth()` only creates the `w-a-*`/`w-l-*` inputs the first time `hub-worth` is opened this session, so a user with a saved balance sheet who hasn't visited Worth yet this session has no `w-a-*`/`w-l-*` elements to read `v()` from at all — reading `DS.worth` sidesteps that entirely). Returns `null` — never a fabricated ₹0 — when there's nothing real saved (no `DS`, no `DS.worth`, or every stored figure is zero); otherwise returns `{ assets, liabs, net, aVals, lVals, investable, propertyVal, cagr, debtRate, debtYears, monthlySip }`, falling back to the app's maintained projection defaults (`PROJ_DEFAULT_CAGR`/`PROJ_DEFAULT_DEBT_RATE`/10 years) for any tier-2 assumption the user never touched, exactly as `renderWorthProjection()` itself would. Read-only — never writes `DS`. Its consumers today are `renderAdvWorthBridge()` and `renderLandingWorth()`; any future feature wanting the user's real balance sheet must call `worthSnapshot()` too, not read `DS.worth` a second way.

---

## Client-side error visibility (R66, Phase 16)

`ARCHITECTURE-ANALYSIS.md` recommendation #2, open since day one: before Phase 16 the only `onerror` anywhere in the app was `reader.onerror` on the backup-file input, so a stranger who hit a JS exception saw a silently dead calculator with nothing to report — as unfalsifiable as "I still see the bug" was before `BUILD_STAMP` existed. This is app-wide infrastructure, not scoped to any one hub, so it lives as an IIFE at the very top of the inline `<script>` — installed before `BUILD_STAMP` and everything else, so it covers init-time failures too, not just ones after the page has loaded.

- **`window.onerror` and `window.addEventListener('unhandledrejection', …)`, both** — a rejected promise never reaches `window.onerror`, so one alone isn't enough.
- **Never sends anything anywhere — this is the one non-negotiable constraint.** No `fetch`, no `XMLHttpRequest`, no `navigator.sendBeacon`, no tracking pixel, not even to a "free error-logging" third party. It only ever writes text into a dismissible on-screen panel (`#err-panel`, appended to `document.body` on first error) for the user to read and copy by hand — the same shape and reasoning as the local feedback composer (R25/6e-i). An error-reporting endpoint would forfeit the About page's *"open devtools, watch the Network tab — you'll see no request leave this page"* claim more cheaply than a whole backend would. Verified after shipping: `grep -n "fetch(\|XMLHttpRequest\|sendBeacon\|new Image(" index.html` matches nothing but the comment stating this rule.
- **Its own dismissible element, not `showToast()`.** The existing toast auto-hides after 3.2s; diagnostics need to stay on screen long enough to read and copy, so `#err-panel` is a separate fixed-position panel with its own close button, not a reuse of `#toast`.
- **The panel states `BUILD_STAMP`, the error message, source/line/column, and the stack when available**, plus a "Copy diagnostics" button (`navigator.clipboard.writeText`, with a `document.execCommand('copy')` fallback for browsers without the Clipboard API).
- **Deduped, not stacked.** The same error repeating (e.g. thrown from inside a `render*` function called on every keystroke) updates the existing panel and a `(×N)` repeat counter instead of piling up a new panel per throw; a genuinely different error replaces it and resets the counter.
- **The handler can never itself throw or loop.** Every DOM-touching step is wrapped in its own `try/catch`; if building the panel itself fails, it falls back to a single `window.alert` and gives up — it never re-enters `window.onerror` or re-throws.
- **`--red` is used for the panel's header/border** — a real app failure, not a financial delta, but the task that specced this explicitly permits it; still exactly one hue outside the three-hue rule's normal scope (gold/green/red), no fourth colour introduced.
- Does not touch `calc.js` — this is pure UI infrastructure, not a calculation.

---

## Keyboard & ARIA accessibility (R8, Phase 17)

D8/`ARCHITECTURE-ANALYSIS.md`'s accessibility gap, re-rated Medium → High once B4 answered "general audience": before Phase 17 there were zero `aria-expanded`, `role="tablist"`, `aria-selected`, or `tabindex` occurrences anywhere in the file, and every collapse header was a clickable `<div>`, not a `<button>`. This is an app-wide sweep, not scoped to one hub.

- **Every `.collapse-header`/`.adv-header`/`.sip-header` is now a real `<button type="button">`, not a `<div onclick>`.** `grep -n '<div class="collapse-header"\|<div class="adv-header"\|<div class="sip-header"' index.html` returns nothing — treat a nonzero result as a regression. New CSS resets on those three classes neutralize native `<button>` chrome (background/border/font/width/text-align) so none of them visibly changed shape.
- **`toggleCard(id)` sets `aria-expanded` on the card's own `:scope > .collapse-header` button in one place** — this is what keeps every `toggleCard()`/`toggleChartCard()` caller correct for free. `toggleSection()`, `toggleAdv()`, `toggleSIP()`, and `toggleLeasePanel()` each set `aria-expanded` explicitly, since none of them route through `toggleCard()`. **Any new collapse/expand control must do the same** — either call `toggleCard()` or set `aria-expanded` itself; a `<button>` with no `aria-expanded` update is a silent regression of this pass, not a wash.
- **Tab semantics on both tab bars.** `role="tablist"` on `.hub-nav-inner` and `.sip-planner-tabs`; `role="tab"` + live `aria-selected` on every `.hub-tab` and `.sip-planner-tab`, kept current by `switchHub()`/`switchSIPPlannerTab()`.
- *(Historical — the car financing mode toggle-button group this bullet described, `car-mode-btn-loan/-lease/-cash` with `aria-pressed`, was removed in the 2026-09-25 Dhanam Car simplification; mode is now a plain `<select id="cc-mode">` inside Tool B. `toggleLeasePanel()`/`"Reconcile against my payslip ▾"` and `#cc-explore-card`/`"Explore further ▾"` are ordinary `aria-expanded` collapse controls — see the `toggleCard()` bullet above.)*
- **44px touch targets** via one `@media(max-width:600px)` rule covering `.hub-tab, .sip-planner-tab, .action-btn, .btn, .collapse-header, .adv-header, .sip-header` — deliberately excludes `.tile` (already sized generously) and `.mode-btn` (the small ₹/sft-vs-lump inline widget, not a tab/mode selector).
- **One global `:focus-visible` ring** (`a, button, input, select, textarea, [tabindex]`), reusing the existing gold `--accent` ring the file's three pre-existing rules already established — no new color introduced.
- **Accessible-name gaps filled on already-existing controls**: `#l-remember`'s checkbox (its visible label text lives in a sibling `<div>`, outside the wrapping `<label>`, so it previously had no accessible name at all) got an explicit `aria-label`; `#w-hide-btn` got a live `aria-pressed` from `toggleHideAmounts()`; `#w-import-file` (the restore-backup file input) got `aria-label="Restore backup file"`; the icon-only "✕" remove buttons in `disbRemoveTranche()`/`ccRemoveCar()` got `aria-label` alongside their existing `title`.
- **Known remaining gap, out of this pass's scope on purpose:** the header logo's `.header-inner.clickable` div (the "tap the logo to go home" affordance) is still not keyboard-reachable. Left as-is because it's redundant with the already-accessible `⌂ Home` nav tab — not a silent omission, a scoping call, recorded here so a future full-coverage pass knows it's the one open item.
- Does not touch `calc.js` and changes no financial output — `node tests.js` stayed at 100% throughout.

---

## Inline term definitions (R23, Phase 18)

The highest-value comprehension work identified in `TASK-UX-REDESIGN.md`'s Phase 6c: inputs are self-explanatory, but outputs like "perquisite value," "pre-EMI," or a projection that silently holds property flat are not, and misreading one is a worse failure than not knowing which button to press — one the user won't notice on their own. Definitions go **at the term**, not in a collected glossary (recognition beats recall).

- **One reusable component** — `.term-info`/`.term-info-btn`/`.term-info-pop`, `toggleTermInfo(id)` — placed at 17 terms across every hub, not twelve-plus bespoke tooltips. The trigger reuses the existing `#i-info` `<symbol>` (same icon the About-page link and caveat headers already use) at `--text-dim`, a fixed neutral rather than `currentColor`-inherited — same reasoning as `.tile-icon`/`.ab-icon`'s pin in the Icons section: this glyph should read as quiet, always-available help, not compete with whatever active/gold state its surrounding label might carry.
- **Tap-friendly, not hover-only** (mobile-first Android audience) — the glyph is a real `<button type="button">`, not a styled span. **Reuses R8's `aria-expanded` convention on the trigger exactly** — a deliberate choice not to invent a second "is this open" pattern alongside R8's collapse-header one.
- **Only one popover open at a time.** `toggleTermInfo(id)` closes whichever other one is open before showing the requested one — `openTermInfoId` is the single source of truth, mirrored by exactly one `[aria-expanded="true"]` trigger at any moment.
- **Dismissible three ways**: re-tapping the same trigger, clicking/tapping outside (a document-level `click` listener checks `.contains()` against both the popover and its trigger), or Escape (which also returns focus to the trigger button — the standard disclosure-widget contract, so a keyboard user isn't left with focus on a now-invisible element).
- **`position:fixed`, not `position:absolute` — deliberately.** Nearly every placement sits inside a `.panel-card` or `.collapse-card`, and both set `overflow:hidden` (see the Styling section's D7/R62 history for another example of a rule that looked locally correct and clipped something two files away). An absolutely-positioned popover anchored inside either would be silently clipped the moment it extended past that ancestor's box. Fixed positioning escapes the containing-block chain up to the viewport, so it can't be clipped by an ancestor's `overflow:hidden` — the tradeoff is that `toggleTermInfo()` computes `top`/`left` in JS from the trigger's `getBoundingClientRect()` at open time (clamped to stay inside the viewport horizontally, and flipped to open upward if there's no room below) rather than letting CSS position it declaratively.
- **Closes on scroll or resize instead of repositioning.** A fixed-position element doesn't move with the page, so a scroll would leave it visually detached from the trigger it's meant to explain; closing it is simpler and safer than re-running the position math on every scroll event.
- **Placement judgment calls, recorded so a future duplicate-vs-skip decision has precedent**: CAGR appears at its first/primary occurrence per hub (`sip-cagr` in `hub-apartment`'s Buy-vs-SIP card, `sp-cagr` on Dhanam Grow's Monthly tab only — not repeated on Step-up/Lumpsum, `w-proj-cagr` in Dhanam Worth's projection card) rather than at every field sharing the concept (`su-cagr`, `ls-cagr`, `cc-cash-cagr` were left undecorated). "Corpus" is defined once, on Grow's Monthly tab, not on all three. The Tranche definition renders only on the first tranche row (`i === 0` inside `disbTrancheRowHtml()`'s template) — one definition, not one per row, and it avoids a duplicate-id bug a naive per-row placement would have introduced.
- No new hue (palette rule 1); does not touch `calc.js` — pure UI/markup, no calculation changed.

---

## Dhanam Worth specifics (`hub-worth`, `w-*` prefix)

`renderWorth()` is the single entry point: reads all rows, totals both sides, writes the hero figure, updates the change tile, and persists. Rows are generated from the `W_ASSETS`/`W_LIABS` arrays by `buildWorth()` on first open (`worthBuilt` flag) — add a category there, not in the markup.

- **The change tile** compares against the most recent history entry from a *different* day, so today's own running entry is never its own baseline. It renders nothing at all on a first visit, a neutral "No change" at zero, and `--green`/`--red` only for a real delta — always with an arrow glyph *and* the words "Up"/"Down", so colour is never the only signal (palette rule 5).
- **Empty state** shows `—`, never `NaN` and never a fabricated ₹0 net worth; nothing is written to storage until at least one field is non-zero, so an empty first visit can't seed a bogus baseline for tomorrow's delta.
- **Negative net worth** renders with a `−` prefix and turns the hero red (a real negative financial position, palette rule 4).
- **"Hide amounts"** adds `.amounts-hidden` to `#worth-main`, which blurs every figure. If you add any element that displays a number or a share, add it to that selector too — the per-row `%` shares, the change tile's "was ₹X" basis line, the projection card's inputs, and the trend-chart SVG itself all had to be included.
- **Trend chart** (`renderWorthTrend()`) — a `.collapse-card`, closed by default, rendering `DS.history` through the shared `chartSvg()` helper (see **Charts** below). Hidden entirely with zero history, a friendly "not enough history yet" message with one point, a real line/area chart from two points up.
- **Projection bridge** (`renderWorthProjection()`) — a "Projected Net Worth" panel-card reusing `calcSIP` (investable-asset growth plus an ongoing monthly-savings input, `w-proj-sip`) and `loanAtYear` (liabilities amortizing from today's outstanding balance over a user-given rate/remaining-years) to project net worth at +5/+10/+20 years. Property is deliberately held flat — this hub has no basis to assume an appreciation rate. The two rate assumptions (`w-proj-cagr`, `w-proj-debt-rate`) follow the same tier-2 "persist only if changed from default" rule as `l-rate`; the monthly-savings figure and years-to-debt-free are tier-1 facts and always persist. With an all-empty balance sheet the card still renders, projecting an illustrative ₹5L/₹10,000-per-month example (labelled "— example" in its title and hero sub-line) instead of hiding — nothing about that example is written to storage; `renderWorthProjection()` returns `null` in that case, same as before.
- **Excel export** (`buildWorthRows()` / `exportWorthExcel()`) follows the `buildDetailRows()`/`buildLoanRows()` pattern — see **Excel export** below.
- **`calcNetWorthProjection(investable, propertyVal, liabilities, cagr, debtRate, debtYears, monthlySip, years)` (`calc.js`, R65, Phase 16)** holds `renderWorthProjection()`'s own formula, extracted so it and the reverse Worth bridge below can never independently drift into two different net-worth projections — both call this exact function with the exact same argument shapes. `renderWorthProjection()`'s local `projectedNet` closure is now a one-line call into it; behaviour is bit-identical to the pre-R65 inline version for the same inputs (it's a refactor, not a new model).

### Reverse Worth bridge (R65, Phase 16) — the narrow half only

`UX-ANALYSIS.md` §Strategic-2 promised two things that were never built: (1) *"the prepayment simulator can show its effect on your net worth curve, not a hypothetical loan"*, and (2) *"the verdict cards become personal advice instead of generic comparisons."* Phase 16 builds (1) and **explicitly declines (2)** — see `UX-ANALYSIS.md` §Strategic-2 for the recorded decision and reasoning (in short: this app has consistently refused to give advice — the Buy-vs-SIP `.sip-caveat` says *"not a verdict"* in as many words, and About-page `MANUAL-TESTS.md` item 42 requires no sentence read as a recommendation — and turning comparison cards into personal advice is an escalation in kind, not degree, that would contradict that shipped stance).

- **`renderAdvWorthBridge(interestSaved)`**, called from `renderAdvLoan()` (`hub-apartment`'s `adv-section`, "Advanced: Extra Payments Projection"), is a consumer of `worthSnapshot()`. It shows what the on-screen extra-payments scenario (the same 20-year-hero convention `renderAdvLoan()` already uses; `interestSaved` is the exact figure already shown as `#adv-hero-value`) does against the user's *real* saved balance sheet instead of the hypothetical loan the panel otherwise models.
- **Empty state (no balance sheet saved)** is handled explicitly, never as a fabricated ₹0: the card (`#adv-worth-card`) always renders when a loan is entered, but shows `#adv-worth-empty` (a message plus a link to Dhanam Worth) instead of any figures until `worthSnapshot()` returns non-null.
- **Two calculations placed side by side, not one merged model.** The "Your Worth projection today" line is `calcNetWorthProjection()` called with `worthSnapshot()`'s own figures at the same +10-year horizon `renderWorthProjection()`'s hero already uses — bit-identical to what Dhanam Worth's own hero would show right now, by construction. The "With this plan's interest saved" line is that same figure **plus** `interestSaved` added on top as a flat number — deliberately *not* re-run through Worth's own generic total-liability decay a second time (Worth's `debtRate`/`debtYears` assumption is a single blended figure for *all* liabilities, not this specific home loan's actual rate/tenure) — and the on-screen caveat says so explicitly, per this app's "state, don't model" convention (R63) rather than silently reconciling two models that don't actually agree.
- **`.amounts-hidden`/"Hide amounts" does not reach here** — that mechanism is scoped to `#worth-main` only, and a real net worth figure rendered inside `hub-apartment` is outside it. **Decision: closed by default** (the collapse-card starts unopened, like `adv-compare-card` beside it) rather than extending the blur mechanism — the lighter, safer of the two options named in the Phase 16 brief, so a real balance sheet is never on screen unasked.
- **Persists nothing new.** Read-only against `DS` via `worthSnapshot()`; never writes `DS`, never resurrects a tier-2 assumption from storage beyond what `worthSnapshot()` already falls back to.
- **The card's two figures measure different horizons, and both gaps must stay stated on screen (Phase 16 code review):** the second line adds the plan's *whole-loan* interest saving to a +10-year projection even though that saving accrues through the payoff year, and the extra payments' own cash cost is counted nowhere — so the labels must name the payoff year ("through yr N") and the caveat must name both the horizon gap and the ₹X/yr the plan costs, ending by calling the second line an upper bound rather than a projection. At ₹50L/8.75%/20yr with one extra EMI a year, the saving is ₹10.92L accruing to year 16.7 while the plan has consumed ₹4.42L of cash by year 10.

---

## Excel export

Exports are hand-built with no library: `buildZip`/`_u16`/`_u32` construct a raw ZIP, `buildExcel`/`rowsToSheetXml` generate minimal SheetXML, and `exportDetailExcel`/`exportLoanExcel`/`exportCombinedExcel`/`exportSnapshot`/`exportWorthExcel` assemble the rows per report. If you need to add a new export, follow the `buildDetailRows()`/`buildLoanRows()`/`buildWorthRows()` pattern (return an array of row arrays) and pass it into `buildExcel`.

---

## Charts

One dependency-free inline-SVG line/area chart helper is shared by every chart in the app rather than each hub rolling its own. **Six call sites as of 2026-09-25**: the Worth trend chart (`w-trend-chart`), the principal-vs-interest chart in the loan panel (`l-pvi-chart`), the SIP corpus-growth curve on all three Dhanam Grow tabs (`sp-growth-chart`, `su-growth-chart`, `ls-growth-chart`), and Dhanam Car's Tool B cost-vs-value curve (`cc-owncurve-chart`) — the only chart Tool B keeps; the standalone depreciation/loan-balance chart and the net-cost-vs-km crossover chart were both deleted in the Dhanam Car simplification.

- **`renderChart(targetId, series, opts)` is the entry point — always call this, not `chartSvg()` directly.** It measures the host element and draws at a 1:1 scale. This matters: the SVG uses `preserveAspectRatio="none"` so it always fills its container (never causing horizontal scroll at 375px), which means a viewBox that *doesn't* match the container's real pixel width gets non-uniformly stretched — dots render as visible ellipses and stroke width varies by line direction. Measuring is what keeps that from happening.
- `chartSvg(series, opts)` takes one or more `{ values, color, area }` series on a shared scale and returns the `<svg>` string. It degenerates gracefully: a single point renders as one dot (no path), and series longer than 24 points draw only the final point's dot to stay legible.
- **Redraw contract (R11, Phase 3b):** `renderChart()` caches the last `(series, opts)` it was called with per `targetId` in `chartCache`, and attaches one `ResizeObserver` per host (`chartObservers`) the first time that host is rendered. Whenever the host's content-box size changes away from 0 — a collapsed card opening, a hub or SIP-planner tab becoming active, a window resize/orientation change, anything — the observer redraws from the cached series at the host's *current* width. This is the **only** redraw mechanism in the app; there is no per-caller `redraw()` convention and no manual resize listener. A hidden host still measures 0 on the very first render and draws once against a 600px fallback (visibly distorted if you inspect it mid-hidden), but nothing depends on that frame being correct — the observer fixes it the moment the host becomes visible.
  - **The observer is keyed by DOM node, not just by id.** If a host's *parent* rewrites its `innerHTML`, the old host node is detached and a new one with the same id takes its place. `renderChart()` detects this (`existing.node !== host`) and re-creates the observer on the new node — without that check, the detached node's observer would silently stop firing forever. If you add a chart whose host lives inside a container that gets `innerHTML`-rewritten on every render, this is why it still works; don't remove the check as a "simplification."
  - **`toggleChartCard(cardId, redraw)`** is now a thin wrapper: it toggles the card, and optionally calls `redraw()` once more if the card just opened (useful when the chart's data hasn't been computed yet at all, not just hidden). The Worth trend card is the only caller (`renderWorthTrend` is actually already computed on every `renderWorth()`, open or not, so the `redraw` arg here is a belt-and-braces immediate correction — the ResizeObserver would catch it a tick later regardless).
- **Never write a chart host's `innerHTML` directly — use `clearChart(targetId)` to empty one (R15, Phase 3c).** `chartCache` is never pruned by `renderChart()`, so a bare `el(id).innerHTML = ''` leaves the old series cached; the next time that host's size changes away from 0 (card expands, window resizes), the `ResizeObserver` redraws the stale data right back onto the screen — a real bug found in `renderWorthTrend()`'s two paths that bypassed `renderChart()` (zero-history and one-history-point). `clearChart()` empties the host **and** deletes the cache entry, so the observer's next callback is a no-op. Any future "hide/blank this chart because its data is gone" case must go through it.
- **`chartSvg()` spaces points by array index, not by their actual value (R17, Phase 3c).** A caller that plots a non-uniform sequence — e.g. years `[1,2,3,5,7]` — draws the 5→7 gap the same width as the 1→2 gap, silently flattening whatever shape depends on the true spacing. Callers with non-uniform steps must expand to a uniform sequence before calling `renderChart()` (the car-depreciation curve plots every year 1–7, not just the five years the table shows); `chartSvg` itself stays index-based since every other caller's steps already are uniform and widening the shared helper for one caller isn't worth it.
- **The y-axis is auto-scaled to the data and there are no gridlines or axis labels**, so a 1% wiggle fills the chart exactly like a doubling would. Any chart whose values aren't already readable from an adjacent table or hero figure must print its own value range — the Worth trend chart does this in its caption, since its historical values appear nowhere else. **Separately, every chart now states its x-axis extent too** (R19, Phase 3b/3c) — `.chart-caption`'s `Year 1 … Year N` on all five year-based charts (the resale curve fixes it at `Year 1 … Year 7`, matching its uniform 1–7 plot from R17) — since there are no axis labels to read the span from otherwise.
- If you add a chart with an amount-bearing legend or caption, remember the `.amounts-hidden` blur rule above — mark those elements `w-amt`.
- Chart colours are drawn from the existing neutral scale, not a dedicated "chart palette" — there is no `--text-faint` token in this codebase (despite an earlier draft of this task brief assuming one); a third non-accent series uses `--text-mid` (secondary) alongside `--text-dim` (most muted), per palette rule 1 (no new hues without revisiting `COLOR-PALETTE-ANALYSIS.md`).
- **A chart host must be a stable DOM node, not markup regenerated inside a parent's `innerHTML` template (R20, Phase 3c).** `renderChart()`'s node-identity check (above) papers over a host that gets recreated on every render, but it still tears down and rebuilds a `ResizeObserver` every time — `cc-owncurve-chart` is a static sibling of the row/results templates that rewrite on nearly every keystroke elsewhere in Dhanam Car, for exactly this reason. Prefer that shape for any new chart whose surrounding content re-renders often. Keep the node-identity check regardless — it's still what protects the cases where a stable host isn't practical.
- **`calcStepupSIP` and `calcSIP` disagree by ~1% even at 0% step-up (B6, still open — see Testing in `CLAUDE.md`) — do not plot them against each other as two lines on one chart.** The step-up tab's growth chart and its `su-vs-flat` figure both compare `calcStepupSIP(monthly, stepup, cagr, y)` against `calcStepupSIP(monthly, 0, cagr, y)` — the *same* function at 0% step-up — specifically so the two lines are exactly equal at year 1 (a step-up SIP is definitionally identical to a flat one until its first step, at the start of year 2) and never invert. Comparing across the two functions instead reintroduces the R16 bug: at this tab's own default settings it drew the step-up line **starting below** the flat line.

**Wide tables use the same overflow discipline as charts (`.table-scroll`, R10).** A `.table-scroll { overflow-x: auto; }` wrapper `<div>` sits around every `<table>` that could plausibly overflow a 375px viewport — the Detail panel's Payment Schedule, the Loan Disbursement schedule, and all three Dhanam Grow milestone tables. There are **5** such wrappers as of 2026-09-25 (down from 6 — the car depreciation table this used to also wrap was deleted in the Dhanam Car simplification). Count `grep -c 'class="table-scroll"'`, not a bare `grep -c table-scroll` (which also counts the `.table-scroll` class definition itself). Reuse this class for any new table rather than adding a one-off wrapper.

---

## Styling

All CSS is inline in `index.html`, using custom properties defined on `:root` — a "Quiet Luxury / Private Bank" theme: a true-neutral near-black base (`--bg`, `--surface`, `--surface2`, `--surface3`, `--border`) with gold as the sole hero accent (`--accent`, `--accent2`) and disciplined green/red status colors (`--green`, `--red`) for real financial deltas. Fonts are `Inter` (body), `Playfair Display` (headings/large numbers), and `DM Mono` (numeric values), **self-hosted** (Phase 4, R5) as `woff2` files under `fonts/` rather than loaded from Google Fonts — the app's privacy claim ("nothing is ever sent anywhere") requires no outbound font request, and self-hosting also makes fonts precacheable for offline use. Each family ships **two** `@font-face` rules per weight-range — one for `unicode-range: U+0000-00FF...` ("latin") and one for `unicode-range: U+0100-02BA...20AD-20C0...` ("latin-ext") — because the plain "latin" subset Google normally serves **excludes `₹` (U+20B9)**, which this app prints constantly. Any future font change must keep both ranges; dropping the latin-ext file would silently replace every ₹ with a fallback-font glyph. Reuse existing custom properties and utility classes (`.panel-card`, `.collapse-card`, `.section-title`, etc.) rather than introducing new color values or one-off components.

**Touch-width input sizing is a catch-all rule, not a selector list (D7, hardened R62/Phase 15).** The `@media(max-width:600px)` block near the top of the `<style>` forces `font-size:16px !important` on every `input`, `select`, and `textarea`, because **mobile Safari auto-zooms any focused input under 16px** and the page lurches on every field tap. This used to be an explicit list of class selectors, and the list itself was the defect: it failed **six** times in **three** distinct modes. (1) *Never added* — `.cc-field input, .cc-field select` shipped at 14px in Phase 9 and grew in Phase 14; `.qf select` shipped at 15px in Phase 6a. (2) *Listed but out-specified* — `.field.highlight input` and `.loan-field input.hl`, both (0,2,1), out-ranked the list's own `.field input`/`.loan-field input` rules at (0,1,1) and still rendered 15px on mobile. (3) *Listed but out-ordered* — `.sip-inline-input` and `.disb-tr-field input` are **declared below the media block** at equal specificity, so plain source order beat the list and they too still rendered 14px. **Mode (3) is the one that matters most for anyone tempted to go back to a list**: it needs no new class and no specificity mistake — merely declaring a rule further down the file silently defeats an entry that is sitting right there in the block, which no amount of "remember to add your class" diligence would ever catch. A comment asking the next author to remember had, by then, already failed six times; R62 replaced the mechanism rather than extending the list a seventh. The catch-all is safe because no `input`/`select`/`textarea` rule anywhere in `index.html` sets a font-size above 16px (15px is the current maximum), so `!important` here can only enlarge a rule, never shrink one that was deliberately made small. **Any future input/select/textarea rule is covered automatically — there is nothing to add here anymore.** See `MANUAL-TESTS.md` item 57 for the standing verification.

**Dhanam Grow states its pre-tax assumption (R63/Phase 15).** One `.sip-caveat` sits in `hub-sip`, immediately after the `.section-title` and above `.sip-planner-tabs` — **once, above the tab row, not once per tab.** Decision recorded here: the D4 density argument (state it once, not three redundant times) won over the "a reader who opens only one tab should still see it" argument, because placing it above the tab row means every tab-open path already passes it — there's no tab a visitor can land on without scrolling past this div first, so the per-tab argument's premise doesn't actually hold here the way it does for `hub-apartment`'s Buy-vs-SIP caveat (which sits *inside* one specific collapsible panel, not above a tab row every path already crosses). Copy-only, per Phase 7b's `state-and-don't-model` assessment — states the ₹1.25L LTCG exemption and 12.5% rate (Union Budget 2024, effective 23 Jul 2024) and that actual tax depends on redemption timing the app can't know. **Computes nothing** — no `calc.js` change, no post-tax figure anywhere in the hub; that remains R31, still gated on the unanswered B10. See `MANUAL-TESTS.md` item 58.

---

## Icons (R7, Phase 4)

UI-chrome icons (nav tabs, landing tiles, action-row buttons, panel-card headers, section titles, collapse headers, buttons) are inline SVGs, not emoji — emoji render inconsistently across platforms/fonts, which is why R7 replaced them. One hidden sprite of `<symbol id="i-name">` elements sits in a `<svg style="position:absolute;width:0;height:0">` right after `<body>`; every usage is `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-name"></use></svg>` — the `aria-hidden`/`focusable` pair (R27, Phase 4b) keeps every icon out of the accessibility tree and the tab order, since the adjacent text label is always the real accessible name. `.icon` is sized in `em` (scales with the wrapping element's font-size, matching how the emoji it replaced used to scale) and colored via `currentColor` only — never a fixed hue, so palette rule 1 (no new hues) isn't at risk just because an icon sits inside a gold-colored active state. **`.tile-icon`/`.ab-icon` are a deliberate exception**, pinned to `var(--text-mid)` instead of inheriting (R28, Phase 4b): `.tile-title` is permanently gold as a design choice rather than a state, so an inheriting tile icon would be gold on every tile at all times, competing with the headline; `.action-btn.active`'s gold is a real state change and the pin keeps that gold reserved for the text instead of doubling it onto the icon too. **Emoji intentionally remain in body/warning copy** (e.g. the disbursement tranche-sum warning) — that's out of the icon set's scope. When adding a new icon-slot usage, check the existing `<symbol>` set for a semantic match before drawing a new one — and confirm it's actually referenced somewhere, since an unused `<symbol>` is dead weight (R30 deleted one); icons here are decorative reinforcement of an adjacent text label, not the sole carrier of meaning, so reuse across related concepts (e.g. one house icon for both `⌂` and `🏠`, one banknote icon for all money-adjacent emoji) is preferred over a 1:1 emoji-to-icon mapping. One exception to the emoji→`<use>` swap pattern: anywhere an icon's state toggles at runtime (e.g. the Worth hub's hide-amounts eye/eye-off), the element can't be updated via the `set(id, txt)` helper (`textContent` can't hold an `<svg>`) — split into a static `<use>` plus a separately-`id`'d label span, and swap the `<use>` element's `href` attribute directly instead.
