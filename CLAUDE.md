# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Dhanam is a personal financial hub for Indian users: property cost/loan calculators, company car lease tax analysis, car loan/depreciation, and SIP (mutual fund) investment planning. It ships as an installable, offline-capable PWA.

## Commands

There is no build system, package manager, or test suite — this is a dependency-free static site.

- **Run locally**: open `index.html` directly in a browser, or serve the directory (`python3 -m http.server` or similar) so the service worker and manifest register correctly (they require `http(s)://`, not `file://`).
- **Lint/build/test**: none configured. Verify changes by loading the page in a browser and exercising the affected calculator (all logic is reactive via `oninput`/`onchange`, so results update live — no reload needed).
- **Deploy**: no CI/deploy config exists in the repo; treat any deploy step as manual/external.

## Architecture

The entire app is one file, `index.html` (~2600 lines: inline `<style>` then inline `<script>`), plus two small support files:
- `manifest.json` — PWA metadata (name, theme colors, icon)
- `sw.js` — service worker: network-first for the HTML shell (so deploys show up immediately), cache-first for everything else. Cache name is versioned (`apt-cost-v3`); bump it when shipping a change that should bust old caches.

### Hub/tab model

The UI is organized into "hubs" (top-level tabs), toggled via `switchHub(tab)`, each a `<div class="hub-content" id="hub-<name>">`. **`hub-landing` is the default view on load** — a tile grid (`.tile-grid`/`.tile`) linking into each hub; clicking a tile calls `switchHub(...)` (or `openLoanCalc()` for the Home Loan tile, which deep-links into `section-loan` inside `hub-apartment`). The header logo/title and a `⌂ Home` nav tab (`ht-landing`) return to the landing page from anywhere.

- `hub-apartment` → **Dhanam Home** — property cost + home loan calculators (the largest and most developed hub)
- `hub-car` → **Dhanam Car** — company car lease tax perquisite analysis, and a separate car-buying loan/depreciation section
- `hub-sip` → **Dhanam Grow** — SIP planner (monthly / step-up / lumpsum sub-tabs via `switchSIPPlannerTab`)
- `hub-disb` → **Loan Disbursement** — tranche/pre-EMI calculator for under-construction property loans (see below)
- A sixth tile, **Dhanam Worth** (net worth tracker), is shown disabled on the landing page and its tab bar entry is `disabled` — not yet implemented.

Within `hub-apartment`, secondary panels (`section-detail`, `section-loan`) are shown/hidden via `toggleSection(id)` and `action-btn` toggle buttons, not separate routes.

### Loan disbursement calculator (`hub-disb`)

For under-construction property loans where the bank disburses funds in stages and the borrower pays pre-EMI (interest-only) on the cumulative disbursed principal until the final tranche.

- Inputs: sanctioned loan amount, rate, tenure, an editable tranche table (`disbTranches` — array of `{ pct, month }`, rendered by `renderDisbTranches()`, edited via `disbAddTranche()`/`disbRemoveTranche(i)`), and a "pay full EMI from day 1" toggle that skips the pre-EMI phase entirely.
- `renderLoanDisb()` is the single entry point: sums interest month-by-month on the disbursed-so-far principal up to the final tranche's month, then hands off to the existing `calcEMI()` for normal amortization over the given tenure. Warns (doesn't block) when tranche percentages don't sum to ~100%.
- A single 100%-at-month-0 tranche degenerates to a plain EMI loan and must match the `hub-apartment` loan panel's numbers exactly for the same principal/rate/tenure — useful as a sanity check when touching this code.

### No backend, no persistence

Everything is client-side computation over form inputs — there's no `localStorage`/`sessionStorage`, no API calls, no database. State lives only in the DOM for the duration of the page session. Every input has an `oninput`/`onchange` handler that recalculates and re-renders synchronously (no debouncing, no async).

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

When adding a new field, follow the existing prefix for its section and wire it through the section's single `render*`/`calc*` function rather than adding a new update path.

### Core calculation functions

Each major feature has one `calc*`/`render*` entry point that reads all relevant inputs, computes, and writes all outputs for that section:
- `calcDetail()` / `renderDetail()` — apartment cost breakdown (floor rise, parking, amenities, corpus, maintenance, legal, stamp duty, registration, GST)
- `calcEMI`, `loanAtYear`, `simulateLoan`, `renderLoans()` — home loan amortization and prepayment simulation
- `renderAdvLoan()` — extra-EMI/lumpsum prepayment scenario comparison
- `calcSIP`, `renderSIPComparison()` — SIP-vs-prepayment comparison
- `calcIncomeTax`, `calcPerquisite`, `renderCarCalc()` — company car lease tax analysis (old vs. new regime)
- `calcCarDepreciation`, `renderCarLoan()` — car loan + IRDAI depreciation-based resale estimate
- `updateSIPPlanner`, `calcStepupSIP`, `updateStepupSIP`, `updateLumpsum` — Dhanam Grow SIP planner
- `renderLoanDisb()` — loan disbursement / pre-EMI tranche calculator (`hub-disb`)

### Excel export

Exports are hand-built with no library: `buildZip`/`_u16`/`_u32` construct a raw ZIP, `buildExcel`/`rowsToSheetXml` generate minimal SheetXML, and `exportDetailExcel`/`exportLoanExcel`/`exportCombinedExcel`/`exportSnapshot` assemble the rows per report. If you need to add a new export, follow the `buildDetailRows()`/`buildLoanRows()` pattern (return an array of row arrays) and pass it into `buildExcel`.

### Manual test checklist — landing page & loan disbursement

No test framework exists; re-run this list by hand (`python3 -m http.server`) whenever touching `hub-landing`, `hub-disb`, or navigation:

1. **Landing default**: fresh load shows the landing page, not the apartment hub; nav shows `⌂ Home` as the active tab.
2. **Tile navigation**: each tile opens its hub and marks the matching nav tab active; the Dhanam Worth tile does nothing and looks dimmed.
3. **Loan deep-link**: the Home Loan tile lands on the apartment hub with `section-loan` expanded and scrolled into view, with results already rendered; clicking it a second time (panel already open) must not collapse the panel.
4. **Return paths**: the `⌂ Home` tab and the header logo both return to the landing page from any hub.
5. **Hover states**: tiles lift and show the gold border on hover (desktop); no hover artifacts on touch/mobile widths.
6. **Responsive**: at ~375px width the tile grid is a single column with no horizontal scroll.
7. **Existing hubs unaffected**: apartment quick estimate, car lease, car loan, and all three SIP planner tabs still recalculate live on input.
8. **Disbursement math spot-checks**:
   - Single tranche of 100% at month 0 must match the plain home-loan EMI panel for the same amount/rate/tenure (total interest equal, no pre-EMI phase).
   - Two tranches (e.g. 50% at month 0, 50% at month 12, 9% rate): pre-EMI interest for the first 12 months must equal `0.5 × loan × 0.09` (interest on only the disbursed half).
   - Adding/removing a tranche row recalculates immediately; tranche percentages that don't sum to 100% show a visible warning rather than silently computing.
   - Zero/empty inputs must not produce `NaN` or `Infinity` in any output cell.
9. **PWA cache**: after bumping the `sw.js` cache version, a previously installed instance picks up the new landing page on reload.

### Styling

All CSS is inline in `index.html`, using custom properties defined on `:root` (forest green/gold theme — `--bg`, `--surface`, `--accent`, etc.). Fonts are Google Fonts (`Inter` for body, `Playfair Display` for headings/large numbers, `DM Mono` for numeric values) loaded via `@import`. Reuse existing custom properties and utility classes (`.panel-card`, `.collapse-card`, `.section-title`, etc.) rather than introducing new color values or one-off components.
