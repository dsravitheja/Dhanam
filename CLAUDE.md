# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Dhanam is a personal financial hub for Indian users: property cost/loan calculators, company car lease tax analysis, car loan/depreciation, and SIP (mutual fund) investment planning. It ships as an installable, offline-capable PWA.

## Commands

There is no build system or package manager — this is a dependency-free static site. There is a minimal, dependency-free test suite for the pure calculation functions (see **Testing** below); everything else is still verified by hand.

- **Run locally**: open `index.html` directly in a browser, or serve the directory (`python3 -m http.server` or similar) so the service worker and manifest register correctly (they require `http(s)://`, not `file://`).
- **Test**: `node tests.js` (zero installs). Covers `calc.js` only — see **Testing** below for scope and the manual checklist for everything else.
- **Lint/build**: none configured. Verify UI/DOM changes by loading the page in a browser and exercising the affected calculator (all logic is reactive via `oninput`/`onchange`, so results update live — no reload needed).
- **Deploy**: no CI/deploy config exists in the repo; treat any deploy step as manual/external.

## Architecture

Most of the app is one file, `index.html` (~2800 lines: inline `<style>` then inline `<script>`), plus a small set of support files:
- `calc.js` — the app's pure financial-calculation functions (`calcEMI`, `loanAtYear`, `simulateLoan`, `calcSIP`, `calcStepupSIP`, `calcIncomeTax`, `calcPerquisite`, `calcCarDepreciation`). Loaded by `index.html` via `<script src="calc.js"></script>` before the main inline `<script>`. These functions take plain arguments and return plain values — no DOM access — which is what lets `tests.js`/`tests.html` load the identical file in Node or a browser. See **Testing** below. Any new calculation that doesn't touch the DOM belongs here, not in the inline script; anything DOM-coupled (`render*`, `calc*` that reads `v()`/`chk()`/`el()`) stays in `index.html`.
- `manifest.json` — PWA metadata (name, theme colors, icon)
- `sw.js` — service worker: network-first for the HTML shell (so deploys show up immediately), cache-first for everything else. Cache name is versioned (`apt-cost-v4`); bump it when shipping a change that should bust old caches.

### Hub/tab model

The UI is organized into "hubs" (top-level tabs), toggled via `switchHub(tab)`, each a `<div class="hub-content" id="hub-<name>">`. **`hub-landing` is the default view on load** — a tile grid (`.tile-grid`/`.tile`) linking into each hub. Landing tiles use goal-oriented headlines ("Grow My Money", "Plan a Home Purchase") with a small `.tile-tool` subline naming the actual destination (e.g. "Dhanam Home · Loan Analysis") so every tile's copy maps unambiguously onto a hub/section — this was a deliberate fix for a prior inconsistency where the same destination had different names in different places. Clicking a tile calls `switchHub(...)`, or one of the deep-link helpers `openLoanCalc()` / `openDisbCalc()`, which switch to `hub-apartment` and expand `section-loan` / `section-disb` respectively. The header logo/title and a `⌂ Home` nav tab (`ht-landing`) return to the landing page from anywhere.

- `hub-apartment` → **Dhanam Home** — property cost, home loan, and loan-disbursement (pre-EMI) calculators; the largest and most developed hub
- `hub-car` → **Dhanam Car** — company car lease tax perquisite analysis, and a separate car-buying loan/depreciation section
- `hub-sip` → **Dhanam Grow** — SIP planner (monthly / step-up / lumpsum sub-tabs via `switchSIPPlannerTab`)
- `hub-worth` → **Dhanam Worth** — net worth tracker: editable balance sheet, hero net-worth figure, change-since-last-update tile, and the backup/erase controls. The only hub that persists data — see **Persistence** below. Still missing (deferred, see `TASK-UX-REDESIGN.md` Phase 2d and the projection bridge in 2b): the collapsed net-worth trend chart, the +5/+10/+20-year projection reusing `calcSIP`/`loanAtYear`, and `buildWorthRows()` Excel export.

Within `hub-apartment`, secondary panels (`section-detail`, `section-loan`, `section-disb`) are shown/hidden via `toggleSection(id)` and `action-btn` toggle buttons, not separate routes or hubs. `toggleSection` lazily initializes each panel the first time it's opened (`detailOpened`/`loanOpened`/`disbOpened` flags) rather than on page load.

### Loan disbursement calculator (`section-disb`, inside `hub-apartment`)

For under-construction property loans where the bank disburses funds in stages and the borrower pays pre-EMI (interest-only) on the cumulative disbursed principal until the final tranche. This used to be its own top-level hub (`hub-disb`); it was folded into Dhanam Home as a third `toggleSection` panel, next to Detailed Cost Analysis and Loan Analysis, since it's a sub-topic of home buying rather than a distinct destination — reachable via the "Loan Disbursement (Pre-EMI)" action button or the landing page's `openDisbCalc()` deep-link tile.

- Inputs: sanctioned loan amount, rate, tenure, an editable tranche table (`disbTranches` — array of `{ pct, month }`, rendered by `renderDisbTranches()`, edited via `disbAddTranche()`/`disbRemoveTranche(i)`), and a "pay full EMI from day 1" toggle that skips the pre-EMI phase entirely.
- `renderLoanDisb()` is the single entry point: sums interest month-by-month on the disbursed-so-far principal up to the final tranche's month, then hands off to the existing `calcEMI()` for normal amortization over the given tenure. Warns (doesn't block) when tranche percentages don't sum to ~100%.
- **Do not call `renderDisbTranches()` from inside `renderLoanDisb()`.** `renderDisbTranches()` rewrites the tranche rows' `innerHTML`, which drops keyboard focus mid-typing if it runs on every keystroke (this was a real bug — fixed). It's only called on add/remove (`disbAddTranche`/`disbRemoveTranche`), on first open (`toggleSection`'s `disbOpened` branch), and from `resetAll()`. `renderLoanDisb()` itself just recomputes and updates the results table/summary from the current `disbTranches` state.
- A single 100%-at-month-0 tranche degenerates to a plain EMI loan and must match the `hub-apartment` loan panel's numbers exactly for the same principal/rate/tenure — useful as a sanity check when touching this code.

### No backend; persistence is local-only and deliberately narrow

There are no API calls, no database, and nothing ever leaves the device. Every input has an `oninput`/`onchange` handler that recalculates and re-renders synchronously (no debouncing, no async).

Since Phase 2a there *is* a small `localStorage` layer, and the rules around it are strict:

- **One versioned key**, `dhanam.v1`, plus a `dhanam.seen` marker used to detect browser eviction. `saveState()`/`loadState()`/`eraseState()` are the only entry points.
- **Only tier-1 data is stored** — facts about the user (balances, their loan's numbers). **Never store tier-2 market or statutory assumptions** (the 8.75% rate default, stamp duty %, tax slabs, IRDAI depreciation): they must reload from code every time, or a stale saved value silently outlives reality. A field that has a meaningful app default (like `l-rate`) is persisted *only when the value differs from that default*. Full rationale in `UX-ANALYSIS.md` §2.1.
- **Reads and writes never throw.** A corrupt, foreign, or wrong-version blob is treated as *absent* (`storageUnreadable`), a failed write sets `storageFailed` so the UI never claims data is safe when it isn't, and hydration runs **after** first render so a bad blob can't block paint. This matters more than usual: it's the only bug class in the app that a reload can't rescue the user from.
- **The schema is flat and additive** — unknown keys ignored, missing keys defaulted. Only bump `STORE_VER` for genuinely breaking shape changes, and write a real migration when you do; never silently discard a user's balance sheet.
- **`history` is append-only**, one `{date, netWorth}` entry per save-day (same-day saves overwrite), capped at 120. It exists so the change tile and the future trend chart have something to compare against — history cannot be reconstructed retroactively, so don't drop it.
- Calculator hubs persist nothing unless the user opts in via the loan panel's "Remember my inputs on this device" toggle (default off; switching it off deletes the stored inputs). `hub-worth` persists by design — a balance sheet you retype every visit is worthless.
- Users can **download a JSON backup, restore one, and erase everything**. Imports are validated exactly as `loadState()` validates. This is the only way to move data between devices; there is no sync and adding one would require a backend (`UX-ANALYSIS.md` §2.5).

### Dhanam Worth specifics (`hub-worth`, `w-*` prefix)

`renderWorth()` is the single entry point: reads all rows, totals both sides, writes the hero figure, updates the change tile, and persists. Rows are generated from the `W_ASSETS`/`W_LIABS` arrays by `buildWorth()` on first open (`worthBuilt` flag) — add a category there, not in the markup.

- **The change tile** compares against the most recent history entry from a *different* day, so today's own running entry is never its own baseline. It renders nothing at all on a first visit, a neutral "No change" at zero, and `--green`/`--red` only for a real delta — always with an arrow glyph *and* the words "Up"/"Down", so colour is never the only signal (palette rule 5).
- **Empty state** shows `—`, never `NaN` and never a fabricated ₹0 net worth; nothing is written to storage until at least one field is non-zero, so an empty first visit can't seed a bogus baseline for tomorrow's delta.
- **Negative net worth** renders with a `−` prefix and turns the hero red (a real negative financial position, palette rule 4).
- **"Hide amounts"** adds `.amounts-hidden` to `#worth-main`, which blurs every figure. If you add any element that displays a number or a share, add it to that selector too — the per-row `%` shares and the change tile's "was ₹X" basis line both had to be included.

### Naming/ID conventions

DOM IDs are short prefixed codes tying markup to JS lookups via the `v(id)` (numeric value), `chk(id)` (checkbox), `set(id, txt)` (write text), and `el(id)` (raw element) helpers:
- `q-*` — Quick Estimate inputs (apartment)
- `d-*` — Detail panel inputs/outputs (apartment cost breakdown)
- `l-*` — Loan panel (home loan)
- `adv-*` — Advanced/prepayment loan comparison
- `sip-*` — SIP comparison within the loan panel
- `car-*` — company car lease inputs
- `cb-*` — car buying/loan inputs
- `sp-*` / `spt-*` — SIP planner (Dhanam Grow) tabs and inputs
- `disb-*` — loan disbursement / pre-EMI calculator
- `w-a-*` / `w-l-*` — Dhanam Worth asset / liability rows (generated from `W_ASSETS`/`W_LIABS`); other Worth elements are plain `w-*`

When adding a new field, follow the existing prefix for its section and wire it through the section's single `render*`/`calc*` function rather than adding a new update path.

### Core calculation functions

Each major feature has one `calc*`/`render*` entry point that reads all relevant inputs, computes, and writes all outputs for that section. Functions marked **(calc.js)** are pure (no DOM access) and live in `calc.js`, not the inline script — see **Testing** below.

- `calcDetail()` / `renderDetail()` — apartment cost breakdown (floor rise, parking, amenities, corpus, maintenance, legal, stamp duty, registration, GST)
- `calcEMI`, `loanAtYear`, `simulateLoan` **(calc.js)**, `renderLoans()` — home loan amortization and prepayment simulation
- `renderAdvLoan()` — extra-EMI/lumpsum prepayment scenario comparison
- `calcSIP` **(calc.js)**, `renderSIPComparison()` — SIP-vs-prepayment comparison
- `calcIncomeTax`, `calcPerquisite` **(calc.js)**, `renderCarCalc()` — company car lease tax analysis (old vs. new regime)
- `calcCarDepreciation` **(calc.js)**, `renderCarLoan()` — car loan + IRDAI depreciation-based resale estimate
- `updateSIPPlanner`, `calcStepupSIP` **(calc.js)**, `updateStepupSIP`, `updateLumpsum` — Dhanam Grow SIP planner
- `renderLoanDisb()` — loan disbursement / pre-EMI tranche calculator (`section-disb` inside `hub-apartment`)
- `renderWorth()` — Dhanam Worth balance sheet, net-worth hero, change tile, and persistence (`hub-worth`)

### Testing

`calc.js`'s pure functions are covered by automated, dependency-free tests:
- `node tests.js` — runs in plain Node, zero installs. Exits 0 and prints a pass count when everything passes; exits non-zero with a failure list otherwise.
- `tests.html` — the same assertions rendered as a pass/fail page in a browser (open it like any other page, e.g. via `python3 -m http.server`), for whenever Node isn't handy.

Run both after touching anything in `calc.js`. They check exact values (e.g. zero-rate edge cases, IT-slab arithmetic, IRDAI depreciation-year-1), an independent bisection-based oracle for `calcEMI` (so a formula bug — not just a regression — would be caught), and a few monotonicity/conservation properties (e.g. `principalPaid + balance == P` at any point in a loan's tenure). They do **not** cover the DOM-coupled `render*`/`calcDetail`/`renderLoanDisb` functions in `index.html` — those are still verified by hand per the checklist below.

One known, deliberately-not-silently-fixed finding lives in these tests: `calcStepupSIP` (month-by-month simulation, ordinary-annuity timing) and `calcSIP` (closed-form, annuity-due timing) disagree by about 1% even at 0% step-up, because they use different interest-crediting conventions. The test documents and bounds this gap rather than asserting the two are equal — see the comment above that test in `tests.js` before changing either function.

### Excel export

Exports are hand-built with no library: `buildZip`/`_u16`/`_u32` construct a raw ZIP, `buildExcel`/`rowsToSheetXml` generate minimal SheetXML, and `exportDetailExcel`/`exportLoanExcel`/`exportCombinedExcel`/`exportSnapshot` assemble the rows per report. If you need to add a new export, follow the `buildDetailRows()`/`buildLoanRows()` pattern (return an array of row arrays) and pass it into `buildExcel`.

### Manual test checklist — landing page, loan disbursement & persistence

No DOM-level test framework exists (see **Testing** above for the automated coverage that does exist, scoped to `calc.js`); re-run this list by hand (`python3 -m http.server`) whenever touching `hub-landing`, `section-disb`, `hub-worth`, the persistence layer, or navigation:

1. **Landing default**: fresh load shows the landing page, not the apartment hub; nav shows `⌂ Home` as the active tab.
2. **Tile navigation**: each tile opens its destination and marks the matching nav tab active; the Dhanam Worth tile does nothing and looks dimmed. Every tile's `.tile-tool` subline should name a destination that actually exists (no orphaned or renamed hubs/sections).
3. **Loan deep-link**: the "Finance My Home" tile (`openLoanCalc()`) lands on the apartment hub with `section-loan` expanded and scrolled into view, with results already rendered; clicking it a second time (panel already open) must not collapse the panel.
4. **Disbursement deep-link**: the "Buying Under Construction?" tile (`openDisbCalc()`) lands on the apartment hub with `section-disb` expanded and scrolled into view; clicking it a second time must not collapse the panel. The "Loan Disbursement (Pre-EMI)" action button inside the apartment hub opens the same panel.
5. **Return paths**: the `⌂ Home` tab and the header logo both return to the landing page from any hub.
6. **Hover states**: tiles lift and show the gold border on hover (desktop); no hover artifacts on touch/mobile widths.
7. **Responsive**: at ~375px width the tile grid is a single column with no horizontal scroll; inputs render at ≥16px on touch widths (no iOS zoom-on-focus).
8. **Existing hubs unaffected**: apartment quick estimate, car lease, car loan, and all three SIP planner tabs still recalculate live on input.
9. **Disbursement math spot-checks**:
   - Single tranche of 100% at month 0 must match the plain home-loan EMI panel for the same amount/rate/tenure (total interest equal, no pre-EMI phase).
   - Two tranches (e.g. 50% at month 0, 50% at month 12, 9% rate): pre-EMI interest for the first 12 months must equal `0.5 × loan × 0.09` (interest on only the disbursed half).
   - Adding/removing a tranche row recalculates immediately; tranche percentages that don't sum to 100% show a visible warning rather than silently computing.
   - Zero/empty inputs must not produce `NaN` or `Infinity` in any output cell.
   - Typing multiple digits into a tranche's `%`/month input must not lose keyboard focus between keystrokes.
10. **PWA cache**: after bumping the `sw.js` cache version, a previously installed instance picks up the new landing page on reload.
11. **Persistence — failure paths first** (these matter more than the happy path, because a bad blob is the only failure a reload can't rescue the user from). In devtools → Application → Local Storage:
    - Write garbage into `dhanam.v1` and reload: the app must load normally from defaults, and the Worth hub must say the saved data couldn't be read.
    - Set `v` to a different number and reload: the blob is ignored cleanly, same as above.
    - Delete `dhanam.v1` but leave `dhanam.seen` and reload: the Worth hub reports that the browser cleared the data and offers restore.
    - Override `localStorage.setItem` to throw, then type: calculators keep working and the UI says it couldn't save — it must never still claim "Saved on this device".
    - Private/incognito window: everything calculates; no crash.
12. **Persistence — happy path**: enter a balance sheet, reload, values and net worth return. Turn the loan panel's "Remember my inputs" toggle on, reload, inputs return and the total's hint reads "Remembered on this device"; toggle off and confirm `dhanam.v1` is gone.
13. **Tier-2 leakage check**: confirm the stored blob contains no rates, stamp duty, tax-slab, or depreciation values. An untouched `l-rate` (8.75%) must **not** be stored; change it to 8.4% and it must be.
14. **Change tile**: no tile at all on a first-ever visit; after planting an older `history` entry, editing one balance up shows a green ▲ with "Up ₹X (+Y%) since <date>"; editing down shows a red ▼ with "Down"; returning to the exact prior figure shows a neutral "No change". Readable in greyscale (colour is never the only signal).
15. **Backup round-trip**: Download backup → Erase my data (form clears, `dhanam.*` keys gone) → Restore backup returns the same balance sheet and history. A non-JSON file and a wrong-version backup are both rejected with a message, not a crash.
16. **Hide amounts**: every figure blurs — hero, assets/liabilities totals, per-row inputs, per-row `%` shares, and the change tile's "was ₹X" line. Labels stay readable.
17. **Worth empty/edge states**: an all-empty sheet shows `—` everywhere and writes nothing to storage; liabilities exceeding assets shows a red `−₹X` hero; no `NaN`/`Infinity`/`undefined` anywhere in the hub.

### Styling

All CSS is inline in `index.html`, using custom properties defined on `:root` — a "Quiet Luxury / Private Bank" theme: a true-neutral near-black base (`--bg`, `--surface`, `--surface2`, `--surface3`, `--border`) with gold as the sole hero accent (`--accent`, `--accent2`) and disciplined green/red status colors (`--green`, `--red`) for real financial deltas. Fonts are Google Fonts (`Inter` for body, `Playfair Display` for headings/large numbers, `DM Mono` for numeric values) loaded via `@import`. Reuse existing custom properties and utility classes (`.panel-card`, `.collapse-card`, `.section-title`, etc.) rather than introducing new color values or one-off components.

**Color rules (see `COLOR-PALETTE-ANALYSIS.md` for the full rationale):**
1. Exactly three chromatic hues exist in the app: gold, green, red. Everything else is neutral (the true-black scale + warm-cream text). No fourth hue gets added without revisiting that document first.
2. Gold is the one hero/emphasis color — the primary highlighted answer in any card, active/selected states, focus rings. Not used for section identity or decoration.
3. Green is a real, positive financial delta only — never "this is a big/important number" alone, and never UI chrome unless the action itself represents a gain.
4. Red is a real cost or negative financial delta only — same rule as green, mirrored.
5. Color is never the only signal — colored values keep an adjacent text label; comparison verdicts keep their emoji/text framing.
