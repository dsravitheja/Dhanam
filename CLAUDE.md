# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository. This file
is the lean orientation doc — what the app is, how to run it, and the
cross-cutting rules that apply to almost any change. The depth lives in three
companion files (see **Documentation map** below); load them when a task
actually touches the subsystem they cover.

## What this is

Dhanam is a personal financial hub for Indian users: property cost/loan calculators, company car lease tax analysis, car loan/depreciation, and SIP (mutual fund) investment planning. It ships as an installable, offline-capable PWA. There is no backend, no build system, and nothing ever leaves the device.

## Commands

Dependency-free static site. The only automated tests cover `calc.js`'s pure functions; everything DOM-coupled is verified by hand against `MANUAL-TESTS.md`.

- **Run locally**: serve the directory (`python3 -m http.server`) so the service worker and manifest register (they need `http(s)://`, not `file://`). Opening `index.html` directly works for everything except SW/PWA behaviour.
- **Test**: `node tests.js` (zero installs) — exits 0 with a pass count, non-zero with a failure list. `tests.html` is the same assertions as a browser page.
- **Lint/build**: none. All logic is reactive via `oninput`/`onchange`; results update live, no reload.
- **Deploy**: manual/external — no CI or deploy config in the repo. GitHub Pages serves `main`.

## Architecture at a glance

Most of the app is one file, `index.html` (~5,600 lines: inline `<style>` then inline `<script>`). Support files:

- `calc.js` — the app's **pure** financial-calculation functions (no DOM access). Loaded by `index.html` via `<script src>` **before** the inline script, and by `tests.js`/`tests.html` in Node/browser. Any new calculation that doesn't touch the DOM belongs here; anything DOM-coupled (`render*`, `calc*` reading `v()`/`chk()`/`el()`) stays in `index.html`. **Served network-first by `sw.js`, like the HTML shell** — it's API-locked to the inline script and must never skew from it across a deploy.
- `sw.js` — service worker. Network-first for the app shell (`index.html` **and** `calc.js`); cache-first for everything else, `cache.put`-ing misses. `ASSETS` precaches the shell, `calc.js`, `manifest.json`, the logo, both manifest icons, and all 8 font files. `CACHE` is a hand-bumped version string (`apt-cost-v32` as of Buy a car, CR4–CR7) — bump it on any change that should bust old caches.
- `manifest.json` — PWA metadata. `fonts/` — 8 self-hosted `woff2` files (each family ships **latin + latin-ext** `@font-face` rules; latin-ext carries `₹` U+20B9 — never drop it).

### The hubs

The UI is "hubs" (top-level tabs) toggled via `switchHub(tab)`, each a `<div class="hub-content" id="hub-<name>">`. **`hub-landing` is the default on load** — a tile grid plus `#landing-worth-card`.

| Hub | Name | What it does |
|---|---|---|
| `hub-worth` | Dhanam Worth | net-worth tracker: balance sheet, hero figure, change tile, trend chart, +5/+10/+20yr projection, Excel export, backup/erase. **The primary stateful hub.** |
| `hub-sip` | Dhanam Grow | SIP planner — monthly / step-up / lumpsum sub-tabs |
| `hub-apartment` | Dhanam Home | property cost, home loan, loan-disbursement (pre-EMI). Largest hub; a 3-panel exclusive accordion (`section-detail`/`-loan`/`-disb`). |
| `hub-car` | Dhanam Car | A three-tile row that is the hub's own tab bar (`car-tile-*` → `car-panel-*`, `switchCarTile()`, **Buy a car** default; selection is tier-3, in memory only). Tile 1 **Buy a car** (`cbuy-*`, `renderCarBuy()`) — on-road cost by state/fuel, EMI + 3/5/7-yr table, loan vs pay cash, and when the loan exceeds the insured value; persists nothing (CD-7). Tile 3 **Company car lease** holds **"Car loan or company lease?"** (`lg-*`, 3 inputs, hero + 3 reconciling line items; "Reconcile against my payslip" opens the lease tax panel `car-*`). Tile 2 holds **"Which car costs less to own?"** (`cc-*`, prefilled example cars, ranking + one chart; everything else inside one "Explore further" collapse, where a `cc-mode` select picks Loan/Company lease). **Redesign in progress** (Waves 0–2 shipped; tiles 2/3 changes next): `TASK-CAR-REDESIGN.md` |
| `hub-about` | About | what Dhanam is + dated provenance for every default. Reached via a header link, **not** a 6th nav tab. |

Nav order is `⌂ Home · Dhanam Worth · Dhanam Grow · Dhanam Home · Dhanam Car`. Each hub has one `render*`/`calc*` entry point (see **Core calculation functions**); wire new fields through it.

A **BETA** badge sits next to the header wordmark, and every hub carries a quiet "Beta — tell us what worked and what didn't →" link (Dhanam Car has one per tile: `car-buy` / `car-compare` / `car-lease`) to a public feedback Google Form. The on-screen controls are real `<a target="_blank" rel="noopener noreferrer">` elements with a static (plain-form) `href`; `prepFeedbackLink()` swaps in the prefilled URL from the `onclick`, building it from the frozen `FEEDBACK_PARTS` map (short key → the form's exact Q1 option string) plus `BUILD_STAMP`. If `prepFeedbackLink()` throws for any reason, the anchor's original `href` still opens the plain form — the link is never fully dead. **Q1's option strings in `FEEDBACK_PARTS` must match the live Google Form exactly** — see `ARCHITECTURE.md` and `DECISIONS.md`'s 2026-09-26 entry.

## Cross-cutting invariants

These apply to almost any change. The reasoning and history for each is in `DECISIONS.md` / `ARCHITECTURE.md`.

1. **Nothing leaves the device.** No `fetch`/`XHR`/`sendBeacon`/tracking pixel/CDN asset anywhere — not for fonts, not for analytics, not for error reporting. The About page's "watch the Network tab" claim depends on it. The one outbound link is the beta feedback Google Form, opened only on a user click in a new tab, carrying only the tool name and `BUILD_STAMP`.
2. **`calc.js` purity.** DOM-free functions with a matching `tests.js` assertion. Run `node tests.js` after any `calc.js` change — it must stay 100%.
3. **One entry point per feature.** Each section has a single `render*`/`calc*` that reads all its inputs and writes all its outputs. Add fields to the section's array/function, not a new update path.
4. **Persistence is tier-1 only.** One key `dhanam.v1` (+ `dhanam.seen`). Store facts about the user; **never** store tier-2 market/statutory assumptions (rates, stamp duty, tax slabs, depreciation) — they reload from code. A field with a default persists only when changed. Reads/writes never throw; hydration runs after first paint. `history` is append-only (cap 120). Tier-3 UI state (dismissals, reveal open/closed) never touches `dhanam.v1`. `worthSnapshot()` is the only reader of `DS.worth` outside `hub-worth`.
5. **Never rebuild an input row's `innerHTML` from its own `oninput`** — focus is dropped mid-keystroke (D6). Rebuild on add/remove/hydrate and `<select>` `onchange` only.
6. **Charts go through `renderChart(targetId, series, opts)`**, never `chartSvg()` directly; empty a host with `clearChart()`, never `innerHTML = ''`. One `ResizeObserver` is the only redraw mechanism. Chart hosts must be static DOM nodes.
7. **Touch-width inputs: nothing to do.** A single `!important` catch-all forces 16px on every `input`/`select`/`textarea` at ≤600px (mobile Safari zoom). ⚠ never replace it with a selector list; never add a second `!important` font-size.
8. **New collapse/expand controls set `aria-expanded`** (call `toggleCard()` or set it explicitly). All three tab bars (hub nav, Grow's sub-tabs, Dhanam Car's tile row) use `role="tablist"`/`aria-selected`.
9. **Statutory constants:** date them in a comment, state the date in visible caveat copy, pin them in `tests.js`.
10. **Advice-free.** No sentence reads as a recommendation. Comparisons state arithmetic and name their own biases.
11. **Copy budget — every hub (S10–S12, Wave 2).** Hero: one number + one sentence. Field hint: ≤ 8 words. Term popover: ≤ 20 words. One "Assumptions & limits" collapse per tool (per hub, except Dhanam Car: one per tile — CD-6); ≤ 10 words per line; link to About for long form. Projections disclosed once per hub and once on About, never on a hero. Section headers are questions, no " — " form.
12. **On every user-visible ship:** bump `sw.js`'s `CACHE` **and** `index.html`'s `BUILD_STAMP` (neither derives from the other).

## Read before you touch X

| Touching… | Read |
|---|---|
| `hub-apartment` accordion, deep-links, `q-state`/stamp duty | `ARCHITECTURE.md` §Hub/tab model, §`hub-apartment` accordion |
| `section-disb` / `renderLoanDisb` / tranche rows | `ARCHITECTURE.md` §Loan disbursement calculator |
| `hub-car` modes, `calcOwnershipCost`, the lease panel | `ARCHITECTURE.md` §Dhanam Car — financing modes + lease analysis specifics; `DECISIONS.md` §Dhanam Car |
| the "why a lease?" glance, `calcLeaseMarginalRate`, `carLeaseProfile` | `ARCHITECTURE.md` §"Why a Lease?" glance + §`calcLeaseMarginalRate()` |
| Compare Cars (`cc-*`), ranking, resale reveal, cross-mode card | `ARCHITECTURE.md` §Compare Cars specifics; `DECISIONS.md` §Compare Cars |
| `hub-worth`, `worthSnapshot`, the reverse Worth bridge | `ARCHITECTURE.md` §Dhanam Worth specifics; §Persistence layer |
| persistence / `saveState` / backup / erase | `ARCHITECTURE.md` §Persistence layer; `UX-ANALYSIS.md` §2 |
| any chart | `ARCHITECTURE.md` §Charts |
| CSS, fonts, the 16px rule | `ARCHITECTURE.md` §Styling |
| icons | `ARCHITECTURE.md` §Icons |
| `window.onerror` / error panel | `ARCHITECTURE.md` §Client-side error visibility |
| ARIA / keyboard | `ARCHITECTURE.md` §Keyboard & ARIA accessibility |
| `sw.js` / caching / PWA | this file's Architecture section; `DECISIONS.md` §Service worker |
| adding a feature a past phase might have cut | `DECISIONS.md` (⚠ markers) |
| anything in `hub-car` before the tile redesign ships | `TASK-CAR-REDESIGN.md` — check the change isn't about to be moved or replaced |

## Documentation map

- **`ARCHITECTURE.md`** — how each subsystem works and the non-obvious constraints (the old per-hub "specifics" sections).
- **`DECISIONS.md`** — append-only "we chose X over Y, don't revert" log, indexed by R / B / D number.
- **`MANUAL-TESTS.md`** — the 87-item by-hand regression checklist.
- `UX-ANALYSIS.md` / `ARCHITECTURE-ANALYSIS.md` / `COLOR-PALETTE-ANALYSIS.md` — the D-numbered findings and full rationale.
- `TASK-UX-REDESIGN.md` — the R-numbered work items and B-numbered owner calls.
- `TASK-CAR-REDESIGN.md` — the CR-numbered Dhanam Car tile redesign (planned 2026-09-29) and its CD-numbered owner decisions.
- `PHASE-*-REPORT.md` — what shipped in each phase.

---

## Naming / ID conventions

DOM IDs are short prefixed codes, resolved via `v(id)` (numeric value), `chk(id)` (checkbox), `set(id, txt)` (write text), `el(id)` (raw element):

- `q-*` — Quick Estimate inputs (apartment)
- `d-*` — Detail panel (apartment cost breakdown)
- `l-*` — Loan panel (home loan) · `adv-*` — prepayment comparison · `sip-*` — SIP comparison within the loan panel
- `car-tile-*` / `car-panel-*` — Dhanam Car's tile row and its three tab panels (`buy`/`compare`/`lease`); `car-limits-compare` / `car-limits-lease` / `car-limits-buy` replaced the single `car-limits-card` (CD-6).
- `cbuy-*` — Buy a car (tile 1) inputs/outputs.
- `car-*` — company car lease inputs. `car-basic` is *total fixed pay*; `car-epf-amt` is the payslip EPF amount (`car-epf-pct` is retired — see `DECISIONS.md` R33).
- `lg-*` — the "why a lease?" glance. `lg-basic`/`lg-price`/`lg-regime` are its own inputs (deliberate small duplication of `car-basic`/`car-regime`); every other `lg-*` id is output-only.
- `cc-*` — Which-car (Compare Cars) shortlist + assumptions. `cc-city-km`/`cc-hwy-km`/`cc-cash-cagr` and `car-mode-btn-*` are **retired** ids (S6–S8). Rows have no per-field ids (inline `oninput` closures index into `ccCars` by position). `cc-marginal-rate` / `cc-has-driver` are **retired** ids (R76) — do not reuse; those values are now derived.
- `cb-*` — **retired** (Phase 14/R59); absorbed into Compare Cars as `cc-*`. `grep -n 'id="cb-' index.html` returns nothing.
- `sp-*` / `spt-*` — SIP planner (Dhanam Grow) · `disb-*` — loan disbursement
- `w-a-*` / `w-l-*` — Dhanam Worth asset / liability rows (generated from `W_ASSETS`/`W_LIABS`); other Worth elements are plain `w-*`

Follow the section's existing prefix for new fields.

## Core calculation functions

Functions marked **(calc.js)** are pure (no DOM) and covered by `node tests.js`.

- `calcDetail()` / `renderDetail()` — apartment cost breakdown
- `calcEMI`, `loanAtYear`, `simulateLoan` **(calc.js)**, `renderLoans()` — home loan amortization + prepayment. `calcEMI`'s optional 4th arg `fv` (default 0) is a lease residual/balloon; at `fv=0` it's the exact original code path.
- `renderAdvLoan()` — extra-EMI/lumpsum prepayment scenario; calls `renderAdvWorthBridge()`
- `calcSIP` **(calc.js)**, `renderSIPComparison()` — SIP-vs-prepayment
- `calcIncomeTax`, `calcPerquisite`, `calcTaxableIncome` **(calc.js)**, `renderCarCalc()` — company car lease tax analysis (old vs new regime). `calcPerquisite` holds the Income-tax Rules 2026 table; `calcIncomeTax`'s new regime applies §87A marginal relief (old-regime ₹5L rebate stays a cliff — pinned).
- `calcCarDepreciation` **(calc.js)** — IRDAI depreciation resale estimate (20% yr 1, 15%/yr after)
- `calcRunningCost`, `calcInsuranceTotal`, `calcOwnershipCost`, `calcBreakevenKm`, `calcOwnershipCurve`, `splitAnnualKm`, `evEfficiencyFromRange`, `CAR_RUNNING_DEFAULTS` **(calc.js)**, `renderCarCompare()` — Which car costs less to own (ICE vs EV TCO, Loan or Lease; Cash stays in `calcOwnershipCost` but has no UI). `calcOwnershipCost({mode,...})` is the shared engine.
- `calcLeaseMarginalRate` **(calc.js)**, `renderLeaseGlance()`, `carLeaseProfile()` — the "why a lease?" glance's and Compare Cars' shared tax-shield / marginal-rate derivation
- `calcOnRoadCost`, `calcCarBuyLoan`, `calcLoanVsCash`, `isLoanVsCashEven`, `calcLoanUnderwater`, `CAR_STATE_CHARGES` **(calc.js)**, `renderCarBuy()` — Buy a car (tile 1). Note `calcLoanVsCash` compounds the return monthly (nominal), matching `calcEMI`, so equal rates give a zero gap.
- `updateSIPPlanner`, `calcStepupSIP` **(calc.js)**, `updateStepupSIP`, `updateLumpsum` — Dhanam Grow SIP planner
- `renderLoanDisb()` — loan disbursement / pre-EMI tranche calculator
- `calcNetWorthProjection` **(calc.js)**, `renderWorth()` → `renderWorthProjection()` / `renderWorthTrend()` — Dhanam Worth. `worthSnapshot()` + `renderAdvWorthBridge()` + `renderLandingWorth()` call `calcNetWorthProjection()` against the real balance sheet.

## Testing

- `node tests.js` — plain Node, zero installs. `tests.html` — same assertions as a browser page.
- Run both after touching `calc.js`. They check exact values, an independent bisection oracle for `calcEMI`, and monotonicity/conservation properties. They do **not** cover the DOM-coupled `render*`/`calcDetail`/`renderLoanDisb` functions — those are `MANUAL-TESTS.md`.
- **Known, deliberately-not-fixed:** `calcStepupSIP` (ordinary-annuity) and `calcSIP` (annuity-due) disagree ~1% even at 0% step-up. The test bounds the gap rather than asserting equality — read the comment above it before changing either function.

## Color rules

Full rationale in `COLOR-PALETTE-ANALYSIS.md`.

1. Exactly three chromatic hues: **gold, green, red**. Everything else is neutral (true-black scale + warm-cream text). No fourth hue without revisiting that document.
2. **Gold** is the one hero/emphasis color — the primary highlighted answer, active/selected states, focus rings. Not for section identity or decoration.
3. **Green** is a real, positive financial delta only — never "this is a big number", never UI chrome unless the action itself is a gain.
4. **Red** is a real cost or negative financial delta only — same rule, mirrored. (The one sanctioned exception: the error panel's header/border, R66.)
5. **Color is never the only signal** — colored values keep an adjacent text label; comparison verdicts keep their text framing.
