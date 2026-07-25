# Task Brief: Dhanam UX Redesign (for a future sub-agent)

> **Status: approved and in progress.** Phases 0, 1 and most of 2 have shipped —
> see `PHASE-1-REPORT.md` and `PHASE-2-REPORT.md` for what was actually built and
> verified. Phases 3–5 have not been started. **Start at the Remaining work table
> below**; the phase sections that follow are the full specs, annotated with what
> is done and what is left.
> Issue numbers (D1–D11) refer to `UX-ANALYSIS.md`.

## Context you must load first

1. Read `CLAUDE.md` — it defines the single-file architecture, naming conventions (`v()`/`set()`/`el()` helpers, per-section ID prefixes, one `render*` entry point per feature), the service-worker cache-version rule, and the manual test checklist. **All of it stays binding.**
2. Read `UX-ANALYSIS.md` — the rationale for everything below.
3. Skim `index.html` end to end before editing; all CSS and JS are inline in that one file.

## Hard constraints

- **No build system, no dependencies, no framework.** Everything stays in `index.html` + `manifest.json` + `sw.js`. Inline SVG is fine; CDN scripts are not.
- **Preserve all calculation math.** This is a UX/structure task. Any refactor must keep every existing output numerically identical (spot-check against the checklist in CLAUDE.md, e.g. the 100%-tranche-at-month-0 ≡ plain EMI invariant).
- **Bump the `sw.js` cache version** with any shipped change (currently `apt-cost-v6`).
- Follow existing CSS custom properties and utility classes; do not invent parallel color systems.
- Verify by serving locally (`python3 -m http.server`) and walking the manual test checklist in CLAUDE.md, plus the new acceptance checks below.

## Blocking decisions (owner must answer before execution)

| # | Question | Affects |
|---|---|---|
| B1 | ~~Landing page: reorder existing tiles, or rebuild as goal-based framing?~~ **ANSWERED: goal-based framing**, keeping the 6-tile grid structure. Shipped. | Phase 1 (done) |
| B2 | ~~Is localStorage persistence approved (privacy copy changes to "saved only on your device")?~~ **ANSWERED 2026-07-25: yes** — Option B, scoped to tier-1 inputs, Option C (JSON export/import) ships in the same phase, all §2.3 mitigations are ship conditions. See `UX-ANALYSIS.md` §2.1–§2.5. | Phase 2 (unblocked) |
| B3 | ~~May Loan Disbursement move inside Dhanam Home (top-level tile/tab removed)?~~ **ANSWERED: yes.** Shipped as `section-disb`. | Phase 1 (done) |
| **B4** | **Personal tool vs. general audience (keeps or generalizes Hyderabad/Telangana defaults)?** — still open | Phase 5 scope |
| **B5** | **Is a smaller/vector logo asset available?** — still open | Phase 4 |

Two further owner decisions have accumulated and are **still open**:

| # | Question | Affects |
|---|---|---|
| B6 | `calcStepupSIP` (month-by-month, ordinary annuity) and `calcSIP` (closed form, annuity-due) disagree by ~1% at 0% step-up. Align the conventions, or leave the documented gap? Aligning changes live output slightly. | `calc.js`, `tests.js` — flagged since `PHASE-1-REPORT.md` |
| B7 | Dhanam Worth persists as soon as you type, with no per-hub opt-in (unlike the loan panel toggle). This follows §2.2 — an opt-in there would recreate the rejected Option A — but should it ask first? | `hub-worth` |

## Remaining work (as of 2026-07-25)

Everything still outstanding, most valuable first. Phase numbers link to the full specs below.

| # | Item | Phase | Blocked by | Severity | Effort |
|---|---|---|---|---|---|
| R1 | **Projection bridge** — "Projected worth" section reusing `calcSIP` + `loanAtYear` to show net worth at +5/+10/+20 years from the saved balance sheet. The feature that makes Worth the anchor rather than a seventh calculator; the reason not to skip it is in §2.2. | 2b | — | High | Medium |
| R2 | **Hero-answer-first density pass** (D4) — every dense results area leads with one answer, the 3×N grids collapse. The loan panel currently renders ~100 numbers on one screen; this is now the most visible remaining problem in the app. | 3 | — | High | Medium |
| R3 | **Net-worth trend chart** (2d) — inline-SVG line/area chart inside a `.collapse-card`, closed by default, rendering from `history`. Data has been accumulating since 2026-07-25. | 2d | — | Medium | Medium |
| R4 | **Charts for SIP growth and principal-vs-interest** (D5) — same dependency-free approach; do alongside R3 to share one chart helper. | 3 | — | Medium | Medium |
| R5 | **PWA integrity** (D9) — `dhanamlogo.png` is 5.2 MB for a 54px slot; the SW asset branch still never `cache.put`s; Google Fonts is both render-blocking and an outbound request that undercuts the privacy claim; the manifest icon is an emoji data-URI. | 4 | B5 for the logo | Medium | Low–Med |
| R6 | **`buildWorthRows()` Excel export** for the Worth balance sheet, following the `buildDetailRows()`/`buildLoanRows()` pattern. | 2e | — | Low | Low |
| R7 | **Emoji → inline-SVG icon set** (D3) — ~6–10 line icons on `currentColor`. Emoji may stay in body copy. | 4 | — | Medium | Medium |
| R8 | **Keyboard & ARIA pass** (D8) — clickable `<div>`s become `<button>`s with `aria-expanded`, `role="tablist"`/`aria-selected` on both tab bars, ≥44px touch targets, `:focus-visible` everywhere. | 5 | — | Medium | Medium |
| R9 | **Export rebranding** (D10) — Excel titles and the PNG snapshot still say "Apartment Cost Analyzer" and use Georgia/Arial. The snapshot's *colours* were already brought onto the palette in the D1 sweep; naming and fonts remain. | 4 | — | Low | Low |
| R10 | **Trust & consistency nicks** (D11) — "Assumptions as of <date>" line, scope the Reset button label, `overflow-x` wrappers on wide tables, nav-tab overflow affordance on phones, and `renderCarLoan()`'s inline EMI formula should call `calcEMI`. | 5 | B4 for the defaults question | Low | Low |

**Not work, but don't lose them:** B4, B5, B6 and B7 above are unanswered owner decisions. B6 (the SIP convention gap) has been open since Phase 1.

## Phases (each independently shippable; do them in order)

### Phase 0 — Quick bug & accessibility fixes — ✅ SHIPPED (see `PHASE-1-REPORT.md`)
- **D6:** Fix the tranche-input focus-loss bug in `hub-disb`: `oninput` must update `disbTranches[i]` and recompute results *without* rebuilding the row's `innerHTML`. Re-render rows only on add/remove.
- **D2:** Replace all `#555` text colors (`.field-hint`, `.note-text`, `.br-calc`, inline uses) with a new `--text-faint` custom property meeting ≥4.5:1 on `--surface`; audit `--text-dim` at 10–11px sizes.
- **D7:** Ensure all inputs render at ≥16px font on touch/mobile widths (media query is acceptable) to stop iOS zoom-on-focus.
- *Acceptance:* type multi-digit values continuously into a tranche field without refocusing; hints legible; no viewport jump on iPhone-width input focus.
- ⚠️ **Standing obligation, not a one-off:** the D7 rule is a media query listing input classes explicitly, so it silently fails to cover new ones. Phase 2's `.w-row input` had to be added to it. **Any new input class must be added to that selector.**

### Phase 1 — Landing & information architecture — ✅ SHIPPED (see `PHASE-1-REPORT.md`)
- Reorder tiles by frequency of need: Grow first, Worth second (still "Soon" until Phase 2), Home, Car, then loan tooling per B3.
- Unify naming: one label per destination everywhere (tile text = nav tab text). Resolve "Dhanam Loan" vs "Loan Disbursement" and the tab-less "Home Loan" tile.
- If B3 = yes: fold the disbursement calculator into `hub-apartment` as a section alongside `section-loan` (keep `disb-*` IDs and `renderLoanDisb()` intact; only its container moves), and remove the top-level tab. Keep a landing deep-link if the owner wants one (mirror the `openLoanCalc()` pattern).
- If B1 = goal-based: tiles read as goals ("Grow my money", "Plan a home purchase", …) with the tool name as the sub-line.
- *Acceptance:* CLAUDE.md landing checklist passes; no two entry points with different names reach the same destination; update CLAUDE.md's hub/tab documentation to match.

### Phase 2 — Dhanam Worth — 🟡 MOSTLY SHIPPED (see `PHASE-2-REPORT.md`)

> **Status 2026-07-25:** 2a ✅, 2b 🟡 (all but the projection bridge), 2c ✅, 2d ❌ not started, 2e 🟡 (all but Excel export), 2f ✅.
> Outstanding: **R1** projection bridge, **R3** trend chart, **R6** Excel export. All three are read-layers over data that is already being persisted, which is why deferring them was safe — the `history` array shipped in the v1 schema precisely so the chart would have something to draw.

**2a — Persistence primitive (do this first, and prove it before Worth exists)** — ✅ SHIPPED
- `saveState()`/`loadState()` on `localStorage` under a single versioned key `dhanam.v1`.
- **Tier-1 only** (§2.1): persist facts about the user (balances, salary, loan principal/tenure, SIP amount, purchase price). **Never persist tier 2** — rates, stamp duty %, tax slabs, ₹/sft premiums, IRDAI tables are re-read from code on every load. Tier 3 (open hub, expanded cards) is out of scope.
- Both functions fully `try/catch`-wrapped (**M2a/M2c**): unreadable, absent, or version-mismatched state is treated as *absent*, never fatal; a `SecurityError` or quota failure on save must not interrupt typing.
- `loadState()` runs **off the critical path of first paint** (**M2b**): render from defaults, then hydrate.
- Persisted shape is flat and additive (**M6a**): unknown keys ignored, missing keys fall back to defaults. Version bumps only for genuinely breaking shape changes, and with a real migration — never a silent discard (**M6b**).
- Store `lastSaved` (ISO date) in the blob (**M1b**), plus a separate `dhanam.seen` marker so eviction is detectable (**M1c**).
- **Smallest first step:** wire this to the loan panel's principal/rate/tenure behind a visible "Remember my inputs on this device" toggle *before* pointing it at Worth data. Exercises the version check, the corrupt-state path, and the copy change on a surface where a bug costs nothing.
- Update the landing privacy line (`index.html:489`) to "saved only on this device — never sent anywhere" (**M4a**).
- *Acceptance:* loan inputs survive reload with the toggle on and don't with it off; hand-writing garbage into `dhanam.v1` via devtools still loads a working app from defaults; setting `v: 99` is ignored cleanly; private-browsing Safari still calculates normally.

**2b — Worth hub** — 🟡 SHIPPED except the projection bridge (**R1**)
- New `hub-worth` with `w-*` ID prefix and a single `renderWorth()` entry point, per conventions.
- Editable balance sheet with Indian categories — Assets: cash/bank, FD/RD, mutual funds, stocks, EPF/PPF/NPS, property, gold, other. Liabilities: home loan(s), car loan, personal/other. Reuse `.cf-row` checkbox-row and `.total-card` patterns.
- Hero net-worth figure in the existing `total-card` style; assets − liabilities, `inCr()` formatting, gold (`--accent`) as the hero colour per palette rule 2.
- **History:** keep an append-only `history: [{ date, netWorth }]` array in the v1 schema — one entry per save-day (same-day saves overwrite), capped (~120 entries). Design this in now even if the chart ships later; history cannot be reconstructed retroactively.
- ❌ **Projection bridge (R1 — the main outstanding item):** a "Projected worth" section reusing `calcSIP` (investable assets + monthly SIP growth) and `loanAtYear` (declining loan balances) to show net worth at +5/+10/+20 years. This is the feature that connects Worth to the rest of the app — don't skip it. Note it needs one input the balance sheet doesn't collect yet: a monthly SIP/savings figure. Decide whether to add a `w-*` field for it or read the Grow hub's value; a `w-*` field is simpler and keeps `renderWorth()` self-contained.
- Enable the Worth tile and nav tab; remove "Soon" badges.
- *Acceptance:* values survive reload; a 0-asset state shows a sensible empty state, never `NaN`; document the hub, the `w-*` prefix, and the persistence layer in CLAUDE.md.

**2c — Net-worth change tile (§2.4)** — ✅ SHIPPED
- Its **own card**, sibling to the hero `total-card` — not nested inside it.
- Contents: direction arrow (▲/▼), absolute change via `inCr()`, percentage change, and the comparison basis ("since 12 June"). A delta without a date is meaningless.
- Colour: `--green` for an increase, `--red` for a decrease — a real financial delta, which is the legitimate use under palette rules 3/4.
- **Never colour-only** (palette rule 5): arrow glyph *and* text label ("up ₹2.0L since 12 June") each carry the meaning independently.
- States: first-ever visit → no tile rendered; zero change → `--text-dim` "no change since <date>", not green; evicted/missing history → the M1c notice, never a fabricated ₹0 delta.
- *Acceptance:* tile absent on a fresh profile; correct sign/colour/label after editing one balance up and one down; readable in greyscale; no tile flash before hydration.

**2d — Trend chart (collapsed by default)** — ❌ NOT STARTED (**R3**)
- Net-worth-over-time line/area chart inside a `.collapse-card`, **closed by default**, per D4's hero-answer-first principle — the tile answers "am I up or down?", the chart answers "what shape has it been?".
- Dependency-free inline SVG, theme colours only, same approach as the Phase 3 charts. Renders from `history`.
- *Acceptance:* renders at 375px with no horizontal page scroll; sensible with 1, 2, and 120 history points; collapsed on load.

**2e — Backup, erase, export (Option C — ships with this phase, not later)** — 🟡 SHIPPED except Excel export (**R6**)
- **JSON export/import** of a "Dhanam file" carrying the same version field as the stored blob (**M1a/M6c**); imports validated and migrated identically to `loadState()`. This is the sanctioned answer to Safari eviction *and* the cross-device question (**M4b**).
- "Erase my data" control, prominent and clearly labelled, with a confirm step (**M3c**); reverts to a clean default state.
- **"Hide amounts" blur toggle** on the Worth hub (**M3a**); net worth never appears on the landing page or in nav (**M3b**).
- Show `lastSaved` on the hub (**M1b**); if `dhanam.seen` exists but the state key is gone, show the one-line "your browser cleared it — import a backup or start fresh" notice (**M1c**).
- Nudge PWA installation from the Worth hub, since installation is what buys durable storage on iOS (**M1d**).
- ❌ **R6:** Excel export via the existing `buildExcel`/rows pattern (`buildWorthRows()`).
- *Acceptance:* export → erase → import round-trips the full balance sheet and history byte-faithfully; erase leaves no `dhanam.*` keys; a hand-edited import with a bad version is rejected with a message, not a crash; Excel export opens cleanly.

**2f — Checklist & docs** — ✅ SHIPPED (CLAUDE.md items 11–17)
- Add to the CLAUDE.md manual checklist (**M2d**): corrupt-state load, wrong-version load, quota/private-mode save failure, eviction notice, export/import round-trip, erase completeness, change-tile sign/colour/neutral states, hidden-amounts toggle. `tests.js` covers only pure `calc.js` functions, so this class is manual-verification territory.
- Document in CLAUDE.md that the app now has persistence, what tier-1/tier-2 means, and that tier-2 defaults must never be written to storage.

### Phase 3 — Density & hierarchy (D4, D5) — ❌ NOT STARTED (**R2**, **R4**)
- Each dense results area (loan scenarios, advanced prepayment, Buy-vs-SIP) leads with **one hero answer** (opinionated default: the 20-year scenario) in `total-card`/`sp-result-card` style; the full 3×N comparison grids collapse behind the existing `.collapse-card` pattern, closed by default.
- Add one dependency-free inline-SVG chart where it explains the most: SIP corpus growth curve (Grow hub) and principal-vs-interest over tenure (loan panel). Keep to theme colors; no libraries.
- *Acceptance:* first screenful of each results section contains ≤ ~10 numbers; charts render at 375px without horizontal scroll; all previous numbers still reachable.
- **Reuse note:** R3 (the Worth trend chart) and R4 are the same problem. Write one small inline-SVG line/area helper and call it three times rather than three bespoke charts.

### Phase 4 — Brand & PWA integrity (D1, D3, D9, D10) — 🟡 PARTLY DONE (**R5**, **R7**, **R9**; needs B5 for the logo)
- ✅ **D1 done (2026-07-25).** Every hardcoded gray now resolves through `:root`; new neutral tokens `--border-subtle`, `--hero-grad-1/2`, `--on-accent`, `--header-grad-mid/end`. The PNG-export canvas reads the custom properties via a `palette()` helper instead of hardcoding hex. `manifest.json` `background_color` is now `#0a0a0a` (`--bg`). Note the old brief said `#04140d` — that was the pre-overhaul green palette and is stale.
- ❌ **R7:** Replace emoji icons in nav/tiles/section headers/buttons with a small inline-SVG icon set using `currentColor` (~6–10 line icons). Emoji may remain in body copy only.
- ❌ **R5:** Compress/replace `dhanamlogo.png` (target ≤50 KB or SVG); generate proper manifest icons (192/512 incl. maskable) from it.
- 🟡 **R5:** `sw.js` — `calc.js` was added to `ASSETS` in Phase 2 (without it the app didn't merely degrade offline, it broke, since `index.html` loads it via `<script src>`). **Still to do:** precache the logo and fonts, and make the asset branch `cache.put` successful responses so non-precached assets actually cache.
- ❌ **R5:** Self-host subsetted Inter/Playfair/DM Mono (woff2, base64 or sibling files) to remove the Google Fonts request — restores the privacy claim and offline fonts. **This is now more pressing:** the landing copy promises "nothing is ever sent anywhere", and the `@import` to `fonts.googleapis.com` on every load is the one thing still contradicting it.
- 🟡 **R9:** Rebrand exports: Excel titles and PNG snapshot become "Dhanam — …"; drop the stale "Apartment Cost Analyzer" name. The snapshot's *colours* are already on the palette (D1); its **fonts (Georgia/Arial) and title are not.**
- *Acceptance:* airplane-mode reload shows logo + correct fonts; Lighthouse PWA installability passes; no request leaves the origin.

### Phase 5 — Accessibility & trust polish (D8, D11) — ❌ NOT STARTED (**R8**, **R10**; scope per B4)
- Convert clickable `<div>`s (collapse headers, adv/sip headers) to `<button>`s with `aria-expanded`; add `role="tablist"`/`aria-selected` to hub nav and SIP planner tabs; ≥44px touch targets for mode toggles; visible `:focus-visible` on all interactive elements.
- Add an "Assumptions as of <date>" line covering tax slabs, rates, and location defaults; scope the Reset button label ("Reset Home inputs").
- Wrap wide tables in `overflow-x:auto` containers.
- If B4 = general audience: surface location-specific defaults (stamp duty, milestones) as clearly-editable assumptions.
- `renderCarLoan()` still re-implements the EMI formula inline instead of calling `calcEMI` — a consistency risk, not a bug today (D11). Folding it in also brings it under `tests.js` coverage.
- Phase 2 added new interactive controls that this pass must cover: the `#l-remember` toggle, the four Worth data buttons, and the file input behind "Restore backup".
- *Acceptance:* full keyboard traversal of every hub; tables don't overflow at 375px.

## Out of scope

Backend/accounts/sync, new calculator types beyond Worth, frameworks or build tooling, analytics of any kind, changing any financial formula.

**On accounts specifically:** user accounts are a noted future direction and are understood to require a real backend (`UX-ANALYSIS.md` §2.5). They are out of scope here and must not be half-built — no "optional cloud backup", no telemetry as a stepping stone, nothing that forfeits the "never sent anywhere" promise without actually delivering accounts. Nothing in Phase 2 has to be undone to add them later: the tier-1/tier-2 split is exactly the store-vs-compute boundary a server would use, and the Option C JSON schema is the natural sync payload.

## Definition of done (whole task)

- All acceptance checks above plus the full CLAUDE.md manual checklist pass at desktop and 375px widths.
- CLAUDE.md updated wherever structure/conventions changed (hub list, new `w-*` prefix, persistence layer, icon approach).
- `sw.js` cache version bumped; previously installed PWA picks up changes on reload.
- One commit per phase, message style matching the existing history (`feat:`/`fix:`/`docs:`).
