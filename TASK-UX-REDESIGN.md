# Task Brief: Dhanam UX Redesign (for a future sub-agent)

> **Status: NOT approved for execution.** This brief describes work identified in `UX-ANALYSIS.md`.
> Do not start until the owner has answered the **Blocking decisions** below and explicitly said go.
> Issue numbers (D1–D11) refer to that analysis document.

## Context you must load first

1. Read `CLAUDE.md` — it defines the single-file architecture, naming conventions (`v()`/`set()`/`el()` helpers, per-section ID prefixes, one `render*` entry point per feature), the service-worker cache-version rule, and the manual test checklist. **All of it stays binding.**
2. Read `UX-ANALYSIS.md` — the rationale for everything below.
3. Skim `index.html` end to end before editing; all CSS and JS are inline in that one file.

## Hard constraints

- **No build system, no dependencies, no framework.** Everything stays in `index.html` + `manifest.json` + `sw.js`. Inline SVG is fine; CDN scripts are not.
- **Preserve all calculation math.** This is a UX/structure task. Any refactor must keep every existing output numerically identical (spot-check against the checklist in CLAUDE.md, e.g. the 100%-tranche-at-month-0 ≡ plain EMI invariant).
- **Bump the `sw.js` cache version** (`apt-cost-v3` → next) with any shipped change.
- Follow existing CSS custom properties and utility classes; do not invent parallel color systems.
- Verify by serving locally (`python3 -m http.server`) and walking the manual test checklist in CLAUDE.md, plus the new acceptance checks below.

## Blocking decisions (owner must answer before execution)

| # | Question | Affects |
|---|---|---|
| B1 | Landing page: reorder existing tiles, or rebuild as goal-based framing? | Phase 1 |
| B2 | Is localStorage persistence approved (privacy copy changes to "saved only on your device")? | Phase 2 (gates the whole Worth hub design) |
| B3 | May Loan Disbursement move inside Dhanam Home (top-level tile/tab removed)? | Phase 1 |
| B4 | Personal tool vs. general audience (keeps or generalizes Hyderabad/Telangana defaults)? | Phase 5 scope |
| B5 | Is a smaller/vector logo asset available? | Phase 4 |

## Phases (each independently shippable; do them in order)

### Phase 0 — Quick bug & accessibility fixes (no design decisions needed)
- **D6:** Fix the tranche-input focus-loss bug in `hub-disb`: `oninput` must update `disbTranches[i]` and recompute results *without* rebuilding the row's `innerHTML`. Re-render rows only on add/remove.
- **D2:** Replace all `#555` text colors (`.field-hint`, `.note-text`, `.br-calc`, inline uses) with a new `--text-faint` custom property meeting ≥4.5:1 on `--surface`; audit `--text-dim` at 10–11px sizes.
- **D7:** Ensure all inputs render at ≥16px font on touch/mobile widths (media query is acceptable) to stop iOS zoom-on-focus.
- *Acceptance:* type multi-digit values continuously into a tranche field without refocusing; hints legible; no viewport jump on iPhone-width input focus.

### Phase 1 — Landing & information architecture (needs B1, B3)
- Reorder tiles by frequency of need: Grow first, Worth second (still "Soon" until Phase 2), Home, Car, then loan tooling per B3.
- Unify naming: one label per destination everywhere (tile text = nav tab text). Resolve "Dhanam Loan" vs "Loan Disbursement" and the tab-less "Home Loan" tile.
- If B3 = yes: fold the disbursement calculator into `hub-apartment` as a section alongside `section-loan` (keep `disb-*` IDs and `renderLoanDisb()` intact; only its container moves), and remove the top-level tab. Keep a landing deep-link if the owner wants one (mirror the `openLoanCalc()` pattern).
- If B1 = goal-based: tiles read as goals ("Grow my money", "Plan a home purchase", …) with the tool name as the sub-line.
- *Acceptance:* CLAUDE.md landing checklist passes; no two entry points with different names reach the same destination; update CLAUDE.md's hub/tab documentation to match.

### Phase 2 — Dhanam Worth (needs B2 = yes; if no, build Option A from the analysis instead)
- New `hub-worth` with `w-*` ID prefix and a single `renderWorth()` entry point, per conventions.
- Editable balance sheet with Indian categories — Assets: cash/bank, FD/RD, mutual funds, stocks, EPF/PPF/NPS, property, gold, other. Liabilities: home loan(s), car loan, personal/other. Reuse `.cf-row` checkbox-row and `.total-card` patterns.
- Hero net-worth figure in the existing `total-card` style; assets − liabilities, with `inCr()` formatting.
- Minimal persistence layer: `saveState()`/`loadState()` on `localStorage` under a single versioned key (e.g. `dhanam.v1`), saved on input, loaded on init. Include an explicit "Erase my data" button and update the landing privacy line to "saved only on this device — never sent anywhere."
- **Projection bridge:** a "Projected worth" section reusing `calcSIP` (investable assets + monthly SIP growth) and `loanAtYear` (declining loan balances) to show net worth at +5/+10/+20 years. This is the feature that connects Worth to the rest of the app — don't skip it.
- Excel export via the existing `buildExcel`/rows pattern (`buildWorthRows()`).
- Enable the Worth tile and nav tab; remove "Soon" badges.
- *Acceptance:* values survive reload; erase works and reverts the tile to a clean state; single 0-asset state shows a sensible empty state, never `NaN`; export opens in Excel; document the hub in CLAUDE.md.

### Phase 3 — Density & hierarchy (D4, D5)
- Each dense results area (loan scenarios, advanced prepayment, Buy-vs-SIP) leads with **one hero answer** (opinionated default: the 20-year scenario) in `total-card`/`sp-result-card` style; the full 3×N comparison grids collapse behind the existing `.collapse-card` pattern, closed by default.
- Add one dependency-free inline-SVG chart where it explains the most: SIP corpus growth curve (Grow hub) and principal-vs-interest over tenure (loan panel). Keep to theme colors; no libraries.
- *Acceptance:* first screenful of each results section contains ≤ ~10 numbers; charts render at 375px without horizontal scroll; all previous numbers still reachable.

### Phase 4 — Brand & PWA integrity (D1, D3, D9, D10; needs B5 for the logo)
- Sweep every hardcoded gray (`#1c1c1c`, `#1e1e1e`, `#2a2a2a`, `#333`, `#444`, `#555`, `#0f0f0f`, `#1a1a1a`, `#1c1a11` gradients) into the custom-property palette.
- Replace emoji icons in nav/tiles/section headers/buttons with a small inline-SVG icon set using `currentColor` (~6–10 line icons). Emoji may remain in body copy only.
- Compress/replace `dhanamlogo.png` (target ≤50 KB or SVG); generate proper manifest icons (192/512 incl. maskable) from it; set manifest `background_color` to `--bg` (`#04140d`).
- Fix `sw.js`: precache the logo (and fonts if self-hosted); make the asset branch cache-put successful responses so offline actually works. Bump cache version.
- Self-host subsetted Inter/Playfair/DM Mono (woff2, base64 or sibling files) to remove the Google Fonts request — restores the privacy claim and offline fonts.
- Rebrand exports: Excel titles and PNG snapshot become "Dhanam — …" with brand colors; drop the stale "Apartment Cost Analyzer" name.
- *Acceptance:* airplane-mode reload shows logo + correct fonts; Lighthouse PWA installability passes; no request leaves the origin.

### Phase 5 — Accessibility & trust polish (D8, D11; scope per B4)
- Convert clickable `<div>`s (collapse headers, adv/sip headers) to `<button>`s with `aria-expanded`; add `role="tablist"`/`aria-selected` to hub nav and SIP planner tabs; ≥44px touch targets for mode toggles; visible `:focus-visible` on all interactive elements.
- Add an "Assumptions as of <date>" line covering tax slabs, rates, and location defaults; scope the Reset button label ("Reset Home inputs").
- Wrap wide tables in `overflow-x:auto` containers.
- If B4 = general audience: surface location-specific defaults (stamp duty, milestones) as clearly-editable assumptions.
- *Acceptance:* full keyboard traversal of every hub; tables don't overflow at 375px.

## Out of scope

Backend/accounts/sync, new calculator types beyond Worth, frameworks or build tooling, analytics of any kind, changing any financial formula.

## Definition of done (whole task)

- All acceptance checks above plus the full CLAUDE.md manual checklist pass at desktop and 375px widths.
- CLAUDE.md updated wherever structure/conventions changed (hub list, new `w-*` prefix, persistence layer, icon approach).
- `sw.js` cache version bumped; previously installed PWA picks up changes on reload.
- One commit per phase, message style matching the existing history (`feat:`/`fix:`/`docs:`).
