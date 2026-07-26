# Task Brief: Dhanam UX Redesign (for a future sub-agent)

> **Status: approved and in progress.** Phases 0, 1, 2, 3b, and 3c have shipped
> in full — see `PHASE-1-REPORT.md`, `PHASE-2-REPORT.md`, `PHASE-3-REPORT.md`
> (which also covers the Phase 2 items — R1, R3, R6 — completed alongside
> Phase 3), and `PHASE-3B-REPORT.md` (now covering both 3b and its 3c
> addendum) for what was actually built and verified.
> Phase 3's density pass (R2) shipped in the Phase 3 pass; Phase 3b (R11–R14)
> closed the D5 chart-coverage gap that review found on 2026-07-25 and added
> the owner-requested Dhanam Home accordion.
> **Phase 3c (R15–R20) has now shipped in full too** — a 2026-07-25 code review of
> the Phase 3b diff found six defects, four of them in the charts Phase 3b shipped;
> see `PHASE-3B-REPORT.md`'s Phase 3c addendum for what was fixed and verified.
> Phase 5 has not been started.
> **New on 2026-07-25: B4 is answered — Dhanam is going public**, after a
> close-circle beta. That adds **Phase 6 (R21–R25)**, promotes part of R5 to
> launch-blocking, and turns the location defaults from a convenience into a
> correctness bug (**R21**, now the highest-severity open item here).
> **Phase 4 (R5, R7, R9) has now shipped in full** — see `PHASE-4-REPORT.md`.
> B5 (logo asset) is answered: the owner confirmed compressing the existing
> star-mark logo as-is, rather than commissioning or supplying a new one.
> A 2026-07-26 review of the Phase 4 diff verified its substantive claims live
> (offline reload from cache, zero off-origin requests, real ₹ glyph coverage in
> the self-hosted fonts) and found five small leftovers — now **Phase 4b
> (R26–R30)**, of which only R26 (missing iOS/tab icon links) has a real user
> consequence.
> **Start at the Remaining work table
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
- **Bump the `sw.js` cache version** with any shipped change (currently `apt-cost-v9`).
- Follow existing CSS custom properties and utility classes; do not invent parallel color systems.
- Verify by serving locally (`python3 -m http.server`) and walking the manual test checklist in CLAUDE.md, plus the new acceptance checks below.

## Blocking decisions (owner must answer before execution)

| # | Question | Affects |
|---|---|---|
| B1 | ~~Landing page: reorder existing tiles, or rebuild as goal-based framing?~~ **ANSWERED: goal-based framing**, keeping the 6-tile grid structure. Shipped. | Phase 1 (done) |
| B2 | ~~Is localStorage persistence approved (privacy copy changes to "saved only on your device")?~~ **ANSWERED 2026-07-25: yes** — Option B, scoped to tier-1 inputs, Option C (JSON export/import) ships in the same phase, all §2.3 mitigations are ship conditions. See `UX-ANALYSIS.md` §2.1–§2.5. | Phase 2 (unblocked) |
| B3 | ~~May Loan Disbursement move inside Dhanam Home (top-level tile/tab removed)?~~ **ANSWERED: yes.** Shipped as `section-disb`. | Phase 1 (done) |
| B4 | ~~Personal tool vs. general audience (keeps or generalizes Hyderabad/Telangana defaults)?~~ **ANSWERED 2026-07-25: general audience.** The owner intends a public release, preceded by a close-circle beta. This promotes the location defaults from a convenience to a **correctness** problem — see R15/Phase 6a — and makes several Phase 4/5 items launch-blocking rather than polish. | Phases 4, 5, 6 |
| B5 | ~~Is a smaller/vector logo asset available?~~ **ANSWERED 2026-07-26: no — compress the existing star-mark logo as-is.** The owner was shown the mark's resemblance to a Star of David (likely an unintentional AI-generation artifact) before this answer, so it's an informed decision, not an oversight. Shipped: 5.2 MB → 10.9 KB header logo, plus real 512×512 `any`/`maskable` manifest icons generated from the same mark. See `PHASE-4-REPORT.md`. | Phase 4 (done) |

Two further owner decisions have accumulated and are **still open**:

| # | Question | Affects |
|---|---|---|
| B6 | `calcStepupSIP` (month-by-month, ordinary annuity) and `calcSIP` (closed form, annuity-due) disagree by ~1% at 0% step-up. Align the conventions, or leave the documented gap? Aligning changes live output slightly. **Phase 3c (R16) routed around this rather than resolving it** — the step-up tab's chart and `su-vs-flat` figure now both compare against `calcStepupSIP(…, 0, …)`, so the on-screen inversion this gap was causing is fixed without touching `calc.js`. The underlying ~1% gap between the two functions is unchanged and still open; it'll resurface the next time anything plots `calcSIP` and `calcStepupSIP` against each other directly (e.g. the Buy-vs-SIP comparison already does, in table form, not yet as a chart). | `calc.js`, `tests.js` — flagged since `PHASE-1-REPORT.md`; `updateStepupSIP()`'s on-screen symptom fixed in Phase 3c |
| B7 | Dhanam Worth persists as soon as you type, with no per-hub opt-in (unlike the loan panel toggle). This follows §2.2 — an opt-in there would recreate the rejected Option A — but should it ask first? | `hub-worth` |
| B8 | Should the car-buying resale curve (R13) overlay outstanding loan balance (`loanAtYear`) in `--red`, so the crossover — when the car is worth less than what's owed on it — is visible? The 3b spec flagged this as worth asking rather than building; the shipped single-series version is the committed scope until answered. | `renderCarLoan()` |
| **B9** | **Firebase (or any) backend — if, when, and on what terms?** Raised by the owner 2026-07-25 as a "wider audience" idea. **Do not act on this during Phases 4–6.** The conditions it would have to meet are written up under **Out of scope** below; the decision should be made against them rather than from scratch, because the privacy promise is a one-way ratchet — it can be tightened silently but never loosened silently. | Architecture; the "never sent anywhere" copy; Phase 6b |

## Remaining work (as of 2026-07-25)

R1–R4, R6, R11–R20, and R5/R7/R9 (Phase 4) have all shipped (see `PHASE-3-REPORT.md`, `PHASE-3B-REPORT.md` — covering 3b and 3c — and `PHASE-4-REPORT.md`). What's left is Phase 5 and the new **Phase 6**, most valuable first. Phase numbers link to the full specs below.

**Sequencing changed on 2026-07-25 when B4 was answered.** Everything up to Phase 3c was built for an audience of one, where a wrong regional default or an unexplained term costs nothing — the owner knows what the numbers mean and where they came from. A beta tester doesn't. Two consequences worth reading before picking up the table: **R21 is now the highest-severity open item in the document** (it is a correctness bug, not a polish item), and **R5 stops being Phase 4 polish** — a landing page that promises "nothing is ever sent anywhere" while calling `fonts.googleapis.com` on every load is a claim a stranger can disprove in thirty seconds with devtools.

| # | Item | Phase | Blocked by | Severity | Effort |
|---|---|---|---|---|---|
| ~~R1~~ | ~~Projection bridge~~ — ✅ **SHIPPED.** `renderWorthProjection()` reuses `calcSIP` + `loanAtYear` to show net worth at +5/+10/+20 years from the saved balance sheet. | 2b | — | — | — |
| ~~R2~~ | ~~Hero-answer-first density pass~~ (D4) — ✅ **SHIPPED.** Loan scenarios, advanced prepayment, and Buy-vs-SIP each lead with a 20-year hero answer; the full 3×N grids now sit behind closed-by-default `.collapse-card`s. | 3 | — | — | — |
| ~~R3~~ | ~~Net-worth trend chart~~ (2d) — ✅ **SHIPPED.** `renderWorthTrend()`, closed-by-default `.collapse-card`, renders from `history` via the new shared `chartSvg()` helper. | 2d | — | — | — |
| ~~R4~~ | ~~Charts for SIP growth and principal-vs-interest~~ (D5) — ✅ **SHIPPED**, sharing `chartSvg()` with R3 as planned. | 3 | — | — | — |
| ~~R5~~ | ~~PWA integrity~~ (D9) — ✅ **SHIPPED.** `dhanamlogo.png` 5.2 MB → 10.9 KB (plus new 512×512 `any`/`maskable` manifest icons from the same mark); `sw.js`'s cache-first branch now `cache.put`s a miss; all three Google Fonts families self-hosted (latin + latin-ext, so `₹` still renders) and precached, removing the `fonts.googleapis.com` request entirely; manifest icon array is real PNGs, not an emoji data-URI. | 4 | ~~B5~~ (answered) | — | — |
| ~~R6~~ | ~~`buildWorthRows()` Excel export~~ for the Worth balance sheet — ✅ **SHIPPED**, following the `buildDetailRows()`/`buildLoanRows()` pattern. | 2e | — | — | — |
| ~~R7~~ | ~~Emoji → inline-SVG icon set~~ (D3) — ✅ **SHIPPED.** 29 distinct emoji (~70 usages) across nav/tiles/headers/buttons replaced with a shared `<symbol>`/`<use>` sprite on `currentColor`; emoji left in body/warning copy as scoped. | 4 | — | — | — |
| R8 | **Keyboard & ARIA pass** (D8) — clickable `<div>`s become `<button>`s with `aria-expanded`, `role="tablist"`/`aria-selected` on both tab bars, ≥44px touch targets, `:focus-visible` everywhere. Phase 3 added more collapse headers (loan/advanced/SIP compare cards) that need this pass too. **Phase 3b raised the stakes:** `#btn-detail`/`#btn-loan`/`#btn-disb` are real `<button>`s but carry no `aria-expanded`, and the R14 accordion now silently collapses a panel the user *didn't* click — a state change on a second control with no accessible signal at all. Add `aria-expanded` in `toggleSection()`'s open, close, and sibling-collapse paths together. | 5 | — | Medium | Medium |
| ~~R9~~ | ~~Export rebranding~~ (D10) — ✅ **SHIPPED.** Excel titles/filenames and the PNG snapshot's text/filename dropped "Apartment Cost Analyzer" for "Dhanam"; the snapshot's 7 canvas `ctx.font` calls moved off Georgia/Arial onto Playfair Display/Inter/DM Mono. | 4 | — | — | — |
| R10 | **Trust & consistency nicks** (D11) — "Assumptions as of <date>" line, scope the Reset button label, `overflow-x` wrappers on wide tables, nav-tab overflow affordance on phones, and `renderCarLoan()`'s inline EMI formula should call `calcEMI`. **Unblocked: B4 answered.** The defaults half of this item has grown into R15 and moved to Phase 6a; what stays here is the small stuff. | 5 | — | Low | Low |
| ~~R11~~ | ~~Chart redraw on reveal & resize~~ — ✅ **SHIPPED.** `renderChart()` caches each chart's last series/opts and attaches a `ResizeObserver` per host that redraws whenever the host's size changes away from 0 — covers every reveal path (tab switch, hub re-entry, accordion reopen, `resetAll()`, window resize) with one mechanism, no per-caller `redraw()` convention. | 3b | — | — | — |
| ~~R12~~ | ~~Step-up & lumpsum corpus charts~~ (D5) — ✅ **SHIPPED.** All three Dhanam Grow tabs now show a chart in the same position (corpus vs. flat-SIP vs. invested on step-up; value vs. principal on lumpsum). | 3b | R11 | — | — |
| ~~R13~~ | ~~Car depreciation curve~~ (D5) — ✅ **SHIPPED**, single-series resale-value-by-year curve. Fixed a pre-existing bug in the same function: `renderCarLoan()`'s `!loan` early return was skipping the depreciation section entirely, so a 100%-down-payment car never showed a resale table *or* chart — the depreciation block now runs independently of the loan-cards early return. The loan-balance-overlay/crossover idea from the spec is flagged to the owner below, not built (committed scope was single-series). | 3b | R11 | — | — |
| ~~R14~~ | ~~Accordion the Dhanam Home panels~~ (D4) — ✅ **SHIPPED.** `toggleSection()` now closes any other open `section-panel` before opening the requested one; latches, inputs, and combined-export button visibility are all untouched by collapsing. | 3b | R11 | — | — |
| ~~R15~~ | ~~Erased chart data comes back~~ — ✅ **SHIPPED.** New `clearChart(targetId)` empties a host and deletes its `chartCache` entry together; `renderWorthTrend()`'s zero-history and one-history-point paths now call it instead of writing `innerHTML` directly. | 3c | — | — | — |
| ~~R16~~ | ~~Step-up chart's baseline is drawn on the wrong convention~~ — ✅ **SHIPPED**, via the chart-local fix (B6 left open). Both `su-vs-flat` and the chart's flat-SIP line now come from `calcStepupSIP(monthly, 0, cagr, y)` instead of `calcSIP`, so they're exactly equal to the step-up line at year 1 and never invert. **Also fixed a bug found while verifying this:** `su-stepup`'s `\|\| 10` fallback treated an explicit `0` the same as empty, so the fix's own "0% ⇒ ₹0 vs flat" acceptance bar was unreachable through the UI until that was corrected too. | 3c | — | — | — |
| ~~R17~~ | ~~Depreciation curve plots a non-uniform time axis at uniform spacing~~ — ✅ **SHIPPED.** The chart now plots every year 1–7 (the table stays at its five rows); index spacing is uniform time spacing. | 3c | — | — | — |
| ~~R18~~ | ~~`NaN×` in the lumpsum milestone table~~ — ✅ **SHIPPED.** Multiplier cell guarded the same way `ls-mult` already was. `sp-years`/`su-years`/`ls-years` are now clamped to their own markup `min`/`max` via a shared `clampYearsInput()`, written back into the field itself. | 3c | — | — | — |
| ~~R19~~ | ~~Three new charts have no x-axis extent caption~~ — ✅ **SHIPPED.** `su-growth-chart` and `ls-growth-chart` gained the same live `Year 1 … Year N` caption `sp-growth-chart` already had; `cb-depr-chart` gained a static `Year 1 … Year 7`. | 3c | — | — | — |
| ~~R20~~ | ~~Chart-render hygiene~~ — ✅ **SHIPPED.** `updateStepupSIP()` now destructures one `calcStepupSIP` call per year instead of two; `cb-depr-chart`'s host is now a static sibling of `cb-depr-body` in the markup, not regenerated inside its `innerHTML` on every keystroke. | 3c | — | — | — |
| R21 | **State-aware assumptions layer** (D11; was the defaults half of R10) — stamp duty, registration charges and other location constants are Telangana values presented as universal. A user in Pune or Bengaluru gets a **confidently wrong total with no indication anything is off**. Highest-severity open item in this document. | 6 | — | **High (correctness)** | Medium |
| R22 | **About / How this works page** — provenance for every assumption, the privacy claim stated so a stranger can verify it, scope and limitations, "not financial or tax advice", and honest disclosure of known gaps (B6). | 6 | R21 for the assumptions content | High | Low–Med |
| R23 | **Inline `ⓘ` term definitions** — ~12 terms (perquisite, pre-EMI, step-up, CAGR, corpus, floor rise, IRDAI depreciation …). The highest-value comprehension work: the risk in this app is misreading an *output*, not failing to operate an input. | 6 | — | High | Medium |
| R24 | **Prepayment as a first-class entry point** — the one externally-validated use case is four levels deep (`adv-section`, closed by default, inside `section-loan`, inside `hub-apartment`, behind a tile). | 6 | R14 (accordion, shipped) | Medium | Low |
| R25 | **First-run orientation + feedback route** — one dismissible orientation line on the landing page, and a visible contact route. With analytics ruled out by design, an unsolicited message is the *only* feedback channel that will ever exist. | 6 | — | Medium | Low |
| R26 | **iOS home-screen icon + favicon are missing** (D9, review finding) — Phase 4 generated real manifest icons, but **iOS Safari ignores manifest icons for "Add to Home Screen"** and needs `<link rel="apple-touch-icon">`; there's also no `<link rel="icon">` at all, so desktop tabs get a blank default and the browser 404s `/favicon.ico`. This is the one Phase 4 gap with a real user consequence: `hub-worth` actively nudges PWA installation *because* installed iOS apps keep their `localStorage` (M1d), so a bad install icon undercuts a deliberate design decision. | 4b | — | **Medium** | Trivial |
| R27 | **64 decorative icons have no `aria-hidden`** (D8, review finding) — R7's `svg.icon` elements carry no `aria-hidden="true"`/`focusable="false"`. Verified *not* a functional break (every icon-bearing button keeps its correct accessible name, and no icon adds a tab stop), but it is 64 unlabelled graphics exposed to screen readers. **Do this inside R8's pass, not separately** — it's the same sweep. | 4b/5 | R8 (same pass) | Low | Trivial |
| R28 | **`.ab-icon`/`.tile-icon` colour pin contradicts its own documentation** (review finding) — Phase 4 added `.tile-icon, .ab-icon { color: var(--text-mid); }`, which blocks inheritance, so an *active* `action-btn` renders a **gold label beside a grey icon**. The behaviour is defensible (it matches the pre-Phase-4 multicolour emoji, which never went gold either) — the actual defect is that the CSS comment directly above it, and the matching paragraph in CLAUDE.md's new **Icons** section, both claim the opposite ("an active/selected ancestor … still colors its icon gold too"). Pick one and make code and docs agree. | 4b | — | Low (docs) | Trivial |
| R29 | **`sw.js`'s `cache.put` calls can reject unhandled** (review finding) — neither the HTML branch (pre-existing) nor the new asset branch has a `.catch()`. A quota-exceeded write, a `206` response (`res.ok` is true for 206, which `cache.put` rejects on), or any non-`GET` request produces an unhandled rejection. Not triggerable by today's app (no media/range requests, no non-GET fetches, small fixed asset set), but the codebase already holds a strict *"reads and writes never throw"* rule for `localStorage` — the service worker should meet the same bar rather than rely on the asset list staying small. | 4b | — | Low | Trivial |
| R30 | **Dead `<symbol id="i-x">`** (review finding) — added during R7 for the tranche-remove `✕`, then left unused when `✕` was deliberately kept as-is (it's a plain dingbat already styled by CSS, not a platform-inconsistent emoji). Delete the symbol, or use it and retire the dingbat. | 4b | — | Trivial | Trivial |

**Not work, but don't lose them:** B6, B7, B8 and B9 above are unanswered owner decisions. **B5 was answered on 2026-07-26 — compress the existing logo as-is** (the owner was shown the mark's Star-of-David resemblance first, so it's an informed call). **B4 was answered on 2026-07-25 — general audience** — which is what Phase 6 exists to serve. B6 (the SIP convention gap) has been open since Phase 1 and **is now drawn on screen** — see R16; Phase 3c routed around it, but it stops being deferrable the next time either function is plotted, and it is now disclosed to strangers under Phase 6b rather than tolerated privately. B9 (backend) must not be started before Phase 6 lands.

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

### Phase 2 — Dhanam Worth — ✅ SHIPPED IN FULL (see `PHASE-2-REPORT.md` and `PHASE-3-REPORT.md`)

> **Status 2026-07-25:** 2a ✅, 2b ✅ (projection bridge shipped), 2c ✅, 2d ✅ (trend chart shipped), 2e ✅ (Excel export shipped), 2f ✅.
> R1 (projection bridge), R3 (trend chart), and R6 (Excel export) — all deferred from the original Phase 2 pass — shipped in the same session as Phase 3; see `PHASE-3-REPORT.md`. All three turned out to be exactly the read-layers over already-persisted data that deferring them assumed: the `history` array shipped in the v1 schema precisely so the chart would have something to draw.

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

**2b — Worth hub** — ✅ SHIPPED, including the projection bridge
- New `hub-worth` with `w-*` ID prefix and a single `renderWorth()` entry point, per conventions.
- Editable balance sheet with Indian categories — Assets: cash/bank, FD/RD, mutual funds, stocks, EPF/PPF/NPS, property, gold, other. Liabilities: home loan(s), car loan, personal/other. Reuse `.cf-row` checkbox-row and `.total-card` patterns.
- Hero net-worth figure in the existing `total-card` style; assets − liabilities, `inCr()` formatting, gold (`--accent`) as the hero colour per palette rule 2.
- **History:** keep an append-only `history: [{ date, netWorth }]` array in the v1 schema — one entry per save-day (same-day saves overwrite), capped (~120 entries). Design this in now even if the chart ships later; history cannot be reconstructed retroactively.
- ✅ **Projection bridge (R1) — SHIPPED.** `renderWorthProjection()` reuses `calcSIP` (investable assets — everything but property — plus a new `w-proj-sip` monthly-savings input) and `loanAtYear` (liabilities amortizing from today's outstanding balance at a user-given rate/remaining-years) to show net worth at +5/+10/+20 years. Property is held flat by design (no basis for an appreciation assumption in this hub). Went with the "add a `w-*` field" option flagged here rather than reading the Grow hub's value, keeping `renderWorth()` self-contained as suggested.
- Enable the Worth tile and nav tab; remove "Soon" badges.
- *Acceptance:* values survive reload; a 0-asset state shows a sensible empty state, never `NaN`; document the hub, the `w-*` prefix, and the persistence layer in CLAUDE.md.

**2c — Net-worth change tile (§2.4)** — ✅ SHIPPED
- Its **own card**, sibling to the hero `total-card` — not nested inside it.
- Contents: direction arrow (▲/▼), absolute change via `inCr()`, percentage change, and the comparison basis ("since 12 June"). A delta without a date is meaningless.
- Colour: `--green` for an increase, `--red` for a decrease — a real financial delta, which is the legitimate use under palette rules 3/4.
- **Never colour-only** (palette rule 5): arrow glyph *and* text label ("up ₹2.0L since 12 June") each carry the meaning independently.
- States: first-ever visit → no tile rendered; zero change → `--text-dim` "no change since <date>", not green; evicted/missing history → the M1c notice, never a fabricated ₹0 delta.
- *Acceptance:* tile absent on a fresh profile; correct sign/colour/label after editing one balance up and one down; readable in greyscale; no tile flash before hydration.

**2d — Trend chart (collapsed by default)** — ✅ SHIPPED
- Net-worth-over-time line/area chart inside a `.collapse-card`, **closed by default**, per D4's hero-answer-first principle — the tile answers "am I up or down?", the chart answers "what shape has it been?".
- Dependency-free inline SVG, theme colours only, same approach as the Phase 3 charts — literally the same helper (`chartSvg()`), written once and shared with R4 as the reuse note below suggested.
- *Acceptance:* renders at 375px with no horizontal page scroll; sensible with 1 (a "not enough history yet" message, no broken chart), 2, and 120 history points; collapsed on load.

**2e — Backup, erase, export (Option C — ships with this phase, not later)** — ✅ SHIPPED IN FULL
- **JSON export/import** of a "Dhanam file" carrying the same version field as the stored blob (**M1a/M6c**); imports validated and migrated identically to `loadState()`. This is the sanctioned answer to Safari eviction *and* the cross-device question (**M4b**).
- "Erase my data" control, prominent and clearly labelled, with a confirm step (**M3c**); reverts to a clean default state.
- **"Hide amounts" blur toggle** on the Worth hub (**M3a**); net worth never appears on the landing page or in nav (**M3b**).
- Show `lastSaved` on the hub (**M1b**); if `dhanam.seen` exists but the state key is gone, show the one-line "your browser cleared it — import a backup or start fresh" notice (**M1c**).
- Nudge PWA installation from the Worth hub, since installation is what buys durable storage on iOS (**M1d**).
- ✅ **R6 — SHIPPED.** `buildWorthRows()`/`exportWorthExcel()` via the existing `buildExcel`/rows pattern.
- *Acceptance:* export → erase → import round-trips the full balance sheet and history byte-faithfully; erase leaves no `dhanam.*` keys; a hand-edited import with a bad version is rejected with a message, not a crash; Excel export opens cleanly.

**2f — Checklist & docs** — ✅ SHIPPED (CLAUDE.md items 11–17)
- Add to the CLAUDE.md manual checklist (**M2d**): corrupt-state load, wrong-version load, quota/private-mode save failure, eviction notice, export/import round-trip, erase completeness, change-tile sign/colour/neutral states, hidden-amounts toggle. `tests.js` covers only pure `calc.js` functions, so this class is manual-verification territory.
- Document in CLAUDE.md that the app now has persistence, what tier-1/tier-2 means, and that tier-2 defaults must never be written to storage.

### Phase 3 — Density & hierarchy (D4, D5) — ✅ SHIPPED (see `PHASE-3-REPORT.md`) (**R2**, **R4**; D5's remaining chart coverage shipped in **Phase 3b**)
- Each dense results area (loan scenarios, advanced prepayment, Buy-vs-SIP) leads with **one hero answer** (opinionated default: the 20-year scenario) in `total-card`/`sp-result-card` style; the full 3×N comparison grids collapse behind the existing `.collapse-card` pattern, closed by default.
- Add one dependency-free inline-SVG chart where it explains the most: SIP corpus growth curve (Grow hub) and principal-vs-interest over tenure (loan panel). Keep to theme colors; no libraries.
- *Acceptance:* first screenful of each results section contains ≤ ~10 numbers; charts render at 375px without horizontal scroll; all previous numbers still reachable.
- **Reuse note:** R3 (the Worth trend chart) and R4 are the same problem. Write one small inline-SVG line/area helper and call it three times rather than three bespoke charts.

### Phase 3b — Chart coverage, redraw correctness & panel accordion (D4, D5 — completing Phase 3) — ✅ SHIPPED (see `PHASE-3B-REPORT.md`) (**R11**, **R12**, **R13**, **R14**)

> **Why this exists.** D5 named three candidate charts — "corpus growth, principal-vs-interest crossover, depreciation curve". Phase 3's brief narrowed that to two call sites and shipped them; the depreciation curve was dropped without a rationale being written down, and the corpus-growth chart landed on the Monthly SIP tab only, leaving step-up and lumpsum as tables. Neither omission was argued anywhere — this is scope drift between `UX-ANALYSIS.md` and the Phase 3 brief, not a decision. **This phase is the completion of Phase 3, not new scope.** No calculation changes, so `node tests.js` must stay at 39/39 throughout.

**3b-a — Redraw on reveal and resize (R11) — do this first; the other two depend on it** — ✅ SHIPPED
- `renderChart()` falls back to a 600px viewBox when the host measures 0, which draws a **distorted** chart (non-uniform stretch under `preserveAspectRatio="none"` — oval dots, direction-dependent stroke width). Today that fallback is silent: nothing tells the caller the chart it just drew is wrong, and nothing redraws it when the host becomes visible. `toggleChartCard()` patches exactly one of the several ways a host can be hidden.
- **Every current reveal path that isn't covered:**
  - `switchSIPPlannerTab()` doesn't redraw at all. Any chart on the step-up/lumpsum tabs (R12) would be drawn hidden and stay distorted.
  - `switchHub('sip')` calls all three `update*` functions, but only the *active* tab's content is visible — so entering the Grow hub with the step-up tab active draws the monthly chart at 0 width, and switching back to monthly never redraws it. **This is a live bug today**, not one R12 introduces.
  - `resetAll()` calls `renderLoans()` whenever `loanOpened` is true, which stays true after the user collapses `section-loan` — so Reset with the panel closed leaves `l-pvi-chart` distorted, and `toggleSection` only renders on *first* open, so reopening won't fix it.
  - **No `resize`/`orientationchange` handler exists anywhere.** Every chart in the app keeps its load-time viewBox width: rotate a phone or resize a desktop window and all of them stretch. This affects the three already-shipped charts, so R11 is worth doing on its own merits even if R12/R13 slip.
- *Fix direction (pick one, don't do both):* either have `renderChart()` remember its last `(series, opts)` per target id and expose a `redrawChart(targetId)` that reveal paths call, or attach a `ResizeObserver` to each chart host so a 0→N width transition redraws automatically. The observer approach subsumes the resize handler and every reveal path at once and is likely the smaller diff; the explicit-redraw approach is easier to reason about. Whichever is chosen, `toggleChartCard()` should end up as a thin wrapper over it rather than a second mechanism.
- *Acceptance:* dots are **circular** in every chart after each of — switching Grow tabs in any order, leaving and re-entering the Grow hub with a non-monthly tab active, collapsing `section-loan` then hitting Reset then reopening it, expanding the Worth trend card, and resizing the window from 1200px to 375px and back. No chart is ever drawn against a 0-width host without being redrawn once it's visible.

**3b-b — Step-up and lumpsum corpus charts (R12)** — ✅ SHIPPED
- **Step-up tab** (`su-*`): three series on the shared scale — step-up corpus (`--accent`, filled), flat-SIP corpus at the same monthly/CAGR (`--text-dim`, unfilled), and total invested (`--text-faint`, unfilled). The whole point of the tab is the divergence from a flat SIP, which the `su-vs-flat` figure states as a single number and a table can't show as a shape. Reuse `calcStepupSIP(monthly, stepup, cagr, y)` per year exactly as `su-milestones` already does — O(n²) but bounded at 50 years, i.e. nothing.
- **Lumpsum tab** (`ls-*`): one compounding curve (`--accent`, filled) plus the flat principal line (`--text-dim`) so the gain is the shaded gap. Pure arithmetic already inline in `updateLumpsum()`; no new calculation.
- Both go **between the hero result card and the milestone table**, matching where the monthly chart sits — the same element in the same place on all three tabs, per the Phase 1 naming-consistency principle.
- Both hosts are `display:none` at load, so both depend on R11.
- ⚠️ **Do not add a value-range caption.** Per CLAUDE.md's Charts rule, a caption is required only when the values appear nowhere else; here the milestone table directly below carries them, exactly as on the monthly tab.
- *Acceptance:* all three Grow tabs show a chart in the same position; the step-up chart's year-N corpus matches `su-corpus` and the milestone table exactly; the lumpsum curve's year-N value matches `ls-corpus`; 0 and 1-year inputs degrade to the single-dot case without throwing; no horizontal scroll at 375px.

**3b-c — Car depreciation curve (R13)** — ✅ SHIPPED
- `renderCarLoan()`'s `cb-depr-body` is a table of IRDAI depreciation years; D5 called this out by name as one of the three charts worth having, and resale value falling off a cliff in years 1–3 is a shape, not a list.
- One series: estimated resale value by year (`--accent`, filled) from the existing `calcCarDepreciation()` calls. Consider overlaying outstanding loan balance via `loanAtYear()` in `--red` — the crossover point (when the car is worth less than what's owed on it) is the single most useful thing this hub could show, and both functions are already called in this render path. **Flag it to the owner before building the overlay**; the single-series version is the committed scope.
- `hub-car` is inactive at load, so this depends on R11 too.
- *Acceptance:* the curve's year-N value matches the depreciation table row for year N; a 100%-down-payment (zero loan) car still renders the resale curve without `NaN`/`Infinity`; hidden along with `cb-depreciation` when that panel is hidden.

**3b-d — Accordion the Dhanam Home section panels (R14)** — ✅ SHIPPED
- **Requested by the owner, 2026-07-25:** in `hub-apartment`, opening one of the three `action-btn` panels leaves any previously-opened one expanded. Three full result sets can stack, and because the new panel opens *below* the ones already open, the thing the user just asked for can land entirely off-screen. Same D4 principle as the hero-answer-first pass: one answer at a time.
- **Scope is exactly the three `.section-panel`s** — `section-detail`, `section-loan`, `section-disb`. They're mutually-exclusive destinations off one button row, which is what makes an accordion the right pattern.
- ⚠️ **Do NOT extend this to the nested `.collapse-card`s** (the loan/advanced/Buy-vs-SIP compare grids, the Worth trend card). Those are drill-downs *within* one task, and a user comparing two of them at once is doing something legitimate — auto-collapsing siblings there would fight them. The rule is "one destination at a time", not "one open element at a time".
- Implementation is a loop at the top of `toggleSection()`'s open branch: close the other two panels and clear their `action-btn.active` state before opening the requested one. Clicking an already-open panel's button must still collapse it (current behaviour, and there's no other way back to a panel-free view).
- **Invariants this must not break:**
  - **`detailOpened`/`loanOpened`/`disbOpened` are one-way latches and must stay that way.** Collapsing a panel must not reset them, or reopening re-runs the lazy-init branch — which for `section-detail` re-prefills `d-sqft`/`d-rate`/`d-gst` from the quick calc and **would silently overwrite whatever the user typed**. `updateCombinedButtons()` also keys off both flags, so resetting them would make the combined-export buttons vanish once a panel is collapsed.
  - **`openLoanCalc()`/`openDisbCalc()` keep the "second click doesn't collapse" behaviour** (CLAUDE.md checklist items 3 and 4) while now also collapsing the sibling panel. Both already call `scrollIntoView` — route them through the same accordion path rather than adding a second one.
  - **Scroll position:** when the panel being collapsed sits *above* the one being opened, the page shifts up by that panel's full height and the newly-opened panel jumps. Collapse first, then `scrollIntoView({behavior:'smooth', block:'start'})` the opened panel — the button row should stay in view, not scroll off the top.
  - **Inputs are never cleared** — collapsing is a CSS class change only; no panel state is discarded.
- **Depends on R11.** `toggleSection()` renders each panel only on *first* open, so under an accordion — where panels now get closed and reopened constantly — `l-pvi-chart` reopens holding whatever it last drew, including a distorted 0-width render. R11's redraw contract must fire on panel re-expand, not just first open. This turns a rare stale-chart path into a routine one, which is why R11 comes first.
- *If it turns out to annoy:* the one real loss is reading the cost breakdown and the loan panel side by side. The fallback is not "revert to multi-open" but to surface the two or three figures actually being cross-referenced in both panels — a smaller fix than reopening the whole question.
- *Acceptance:* opening any of the three panels collapses the other two and leaves exactly one `action-btn` in the `.active` state; the opened panel is in view without manual scrolling; clicking an open panel's own button still collapses it; typing values into the cost breakdown, switching to the loan panel and back leaves those values intact; the combined-export buttons stay visible after both panels have been used once, regardless of which is open now; both landing-page deep links still land on an expanded, scrolled-to panel and still don't collapse it on a second click.

**3b-e — Docs & checklist** — ✅ SHIPPED
- CLAUDE.md **Charts** section: document `renderChart()`'s redraw contract explicitly (whichever mechanism R11 lands on), and list all five/six call sites, so the next chart added doesn't rediscover the 0-width trap.
- CLAUDE.md manual checklist item 22 currently covers three charts; extend it to the new ones and add the reveal/resize cases from 3b-a's acceptance list.
- CLAUDE.md's **Hub/tab model** section states that the three panels are "shown/hidden via `toggleSection(id)`" — update it to say they're an exclusive accordion, and record the deliberate carve-out that nested `.collapse-card`s are not. Checklist items 3 and 4 (the two deep links) need the sibling-collapse expectation added.
- Bump `sw.js` (`apt-cost-v7` → `v8`).
- **Explicitly out of scope, recorded so it isn't rediscovered as a gap:** the Worth projection card (+5/+10/+20) stays a table — three points is not a curve, and the trend chart already owns "shape over time" in that hub. The disbursement panel gets no chart either; its pre-EMI phase is a step function better read as the existing tranche table.

### Phase 3c — Chart correctness & state hygiene (review findings) — ✅ SHIPPED (see `PHASE-3B-REPORT.md`'s Phase 3c addendum) (**R15**–**R20**)

> **Why this exists.** A 2026-07-25 review of the Phase 3b diff (`PHASE-3B-REPORT.md`) found six defects. Phase 3b's own verification was genuinely thorough about *geometry* — it measured `viewBoxW === hostW` on all six hosts across every reveal path — but that only proves each chart is drawn undistorted, not that it is drawn from the right numbers, over the right axis, or from data that still exists. Four of the six findings are in the charts 3b shipped; the other two are pre-existing and adjacent. **This phase changes no financial formula** (R16's recommended fix is chart-local; R18 only adds guards), so `node tests.js` must stay at 39/39 unless R16's B6 option is taken, which requires updating the documented-gap test deliberately.
>
> Do these in the order below: R15 and R16 are the two that show users something false.

**3c-a — Invalidate the chart cache when a host is cleared (R15)** — ✅ SHIPPED
- `renderChart()` writes every `(series, opts)` into `chartCache` and never removes anything. `renderWorthTrend()` has two paths that *don't* go through `renderChart()`: `!h.length` hides the card outright (leaving the last SVG in the DOM, just hidden), and `h.length === 1` writes `el('w-trend-chart').innerHTML = ''` directly. Neither touches the cache, and the `ResizeObserver` on that host is still live.
- **Reproduce:** build up 3+ history entries (chart draws) → "Erase my data" → type one balance (history is back to 1 entry, so the card shows "Not enough history yet" and the host is blanked) → expand the trend card. The observer fires on the 0→N width transition, reads the stale cache, and **repaints the erased history** under the "not enough history yet" caption. A window resize in that state does the same thing. `renderWorth()` runs on every keystroke, so this is not a narrow race.
- *Fix direction:* add a `clearChart(targetId)` beside `renderChart()` that empties the host **and** `chartCache.delete(targetId)` (disconnecting the observer is optional — a cleared cache already makes the callback a no-op via its existing `if (!cached) return`). Call it from both `renderWorthTrend()` early paths instead of the bare `innerHTML = ''` / bare `hide()`. Direct `innerHTML` writes to a chart host should stop existing: that's the invariant worth writing down, because the next chart added will hit this the same way.
- *Acceptance:* after erase-then-one-entry, expanding the trend card and resizing the window both leave the chart area empty; `chartCache.has('w-trend-chart')` is false; a subsequent real 2-point history draws normally.

**3c-b — Draw the step-up chart's baseline on one convention (R16)** — ✅ SHIPPED
- `updateStepupSIP()` builds `stepupSeries` from `calcStepupSIP` (month-by-month, ordinary annuity) and `flatSeries` from `calcSIP` (closed form, annuity-due). Those are the two sides of **B6**. Plotting them as two lines on a shared scale turns a footnote into an on-screen claim, and the claim is wrong at the default 10% step-up: year 1 reads ₹1,26,825 step-up vs ₹1,28,093 flat, so the gold line **starts below the grey line** and crosses it at year 2. A step-up SIP contributes exactly the same amount as a flat SIP for the whole of year 1 — the curves must coincide there. At 0% step-up the gold line sits ~1% below the grey one at *every* year, which reads as "stepping up 0% loses money".
- Same defect, smaller: `su-vs-flat` shows `−₹0.99 L vs flat` at 0% step-up for the same reason, and it has shown that since Phase 1.
- *Fix direction (recommended, and it does **not** need B6 answered):* derive the flat baseline from the same function — `calcStepupSIP(monthly, 0, cagr, y).corpus` — for both the chart series and the `su-vs-flat` figure. Apples-to-apples within the tab, no `calc.js` change, no other hub affected, and 0% step-up becomes exactly ₹0 vs flat. The alternative is to answer B6 and align the conventions in `calc.js`, which fixes this everywhere but shifts live output slightly across the Grow hub and the Buy-vs-SIP comparison, and needs `tests.js`'s documented-gap test rewritten. **Pick one; don't do both.**
- **Found during verification, fixed in the same pass, not part of the original R16 scope:** `updateStepupSIP()` read `parseFloat(el('su-stepup').value) || 10` — since `0` is falsy in JS, typing an explicit `0` into the step-up field silently forced it back to the 10% default, making R16's own "0% step-up ⇒ `su-vs-flat` reads ₹0" acceptance bar unreachable through the actual UI (only reachable by calling `updateStepupSIP()` directly with the field pre-set). Changed to `isNaN(stepupRaw) ? 10 : stepupRaw` — an empty field still defaults to 10%, but a real `0` is now respected. Verified live: typing `0` now reads `su-vs-flat` as `₹0.00 L vs flat`, and the step-up/flat lines coincide exactly on the chart.
- *Acceptance:* at 0% step-up the two lines are pixel-identical and `su-vs-flat` reads ₹0; at any positive step-up the gold line is ≥ grey at every year and they meet at year 1; the step-up hero and milestone table are unchanged by the chart fix (or, if B6 is taken, changed consistently everywhere with tests updated to match).

**3c-c — Give the depreciation curve a real time axis (R17)** — ✅ SHIPPED
- `renderCarLoan()` plots `deprYears = [1,2,3,5,7]` through `chartSvg`, which spaces points by array index. Years 5→7 therefore occupy the same horizontal distance as 1→2, compressing the two flat years and stretching the steep ones — the exact inversion of the shape the chart exists to show ("a table of five rows hides that the drop is a cliff in years 1-3").
- *Fix direction:* plot **every year 1…7** (`calcCarDepreciation` is cheap and already per-year), keeping the table at its five rows. Index spacing then *is* uniform time, every table row is still a point on the curve, and no `chartSvg` change is needed. Adding x-value support to `chartSvg` is the other option, but it's a shared helper serving five other index-uniform callers — don't widen it for one.
- *Acceptance:* the curve has 7 points; the year-5 and year-7 points still match the table rows exactly; the visible slope between consecutive points decreases monotonically; a 100%-down-payment car still renders (the R13 control-flow fix stays intact).

**3c-d — No `NaN`, and clamp the year inputs (R18)** — ✅ SHIPPED
- `updateLumpsum()`'s milestone table computes `(val / amount).toFixed(2)` with no guard. Clearing `ls-amount` gives `0/0` → every Multiplier cell reads **`NaN×`**. The hero's own `ls-mult` is already guarded (`amount > 0 ? … : 0`) — the table just never got the same treatment. Sweep the other milestone/derived tables for the same shape while in there.
- Separately: `su-years`, `sp-years` and `ls-years` read `parseInt(...) || 20` with `max="50"` in markup only, which browsers don't enforce on typing. Harmless for the two closed-form tabs, but Phase 3b's step-up chart calls the month-by-month `calcStepupSIP` once per year, making the tab O(n²): a typed `500` is ~3M iterations **per keystroke** and visibly freezes. Clamp all three reads to their markup `max` (and `min`), in one place.
- *Acceptance:* clearing every numeric field in all three Grow tabs, the car hub and the Worth hub produces no `NaN`/`Infinity`/`undefined` anywhere on screen; typing `500` into any years field clamps to 50 and stays responsive.

**3c-e — X-axis captions on the three new charts (R19)** — ✅ SHIPPED
- `l-pvi-chart` and `sp-growth-chart` each carry `<div class="chart-caption"><span>Year 1</span><span>Year N</span></div>`; `su-growth-chart`, `ls-growth-chart` and `cb-depr-chart` carry nothing. With no gridlines, no axis labels and an auto-scaled y-axis, a caption-less curve doesn't say what span it covers. (`sipMilestones()` does always end on `maxYears`, so the span is *recoverable* from the table's last row — this is a consistency and glanceability fix, not a correctness one, which is why it's ranked Low.)
- This is **not** the value-range caption rule from CLAUDE.md's Charts section (that one is about *amounts*, and correctly doesn't apply — the tables carry those). It's the x-extent, which the two Phase 3 charts already established as the pattern. Reuse `.chart-caption`; mirror `sp-growth-end`'s live update for the two Grow tabs (`Year 1 … Year N`) and use `Year 1 … Year 7` for the resale curve.
- *Acceptance:* all six charts show their x-extent; the Grow captions track their years input live; no caption carries an amount (so none needs `w-amt`).

**3c-f — Render hygiene (R20)** — ✅ SHIPPED
- `updateStepupSIP()` calls `calcStepupSIP(monthly, stepup, cagr, y)` **twice** in the same loop iteration — once for `.corpus`, once for `.totalInvested` — doubling an O(n²) simulation to read two fields of one result. Destructure once. If 3c-d's clamp lands, this is cosmetic; if it doesn't, it's half the freeze.
  - *Optional, and only if it stays simple:* one month-by-month pass that snapshots each year boundary would make the whole series O(n). That's a new pure function, so it belongs in `calc.js` **with tests** per CLAUDE.md — worth it only if the loop is still a measurable cost after the clamp.
- `cb-depr-chart`'s host div is inside the `deprBody.innerHTML` template, so every `renderCarLoan()` keystroke destroys and recreates it, and `renderChart()`'s node-identity check dutifully tears down and rebuilds a `ResizeObserver` each time. Hoist the `<div id="cb-depr-chart">` out into `#cb-depreciation` as a static sibling of `#cb-depr-body` (markup, not JS) so the node is stable and the observer is created once. **Keep the node-identity check** — it's correct and CLAUDE.md says not to remove it; this just stops exercising it on every character.
- *Acceptance:* the depreciation chart still redraws on hub entry, on resize, and on price changes; typing in the car hub creates no new `ResizeObserver`s after the first; step-up numbers are byte-identical to before.

**3c-g — Docs & checklist** — ✅ SHIPPED
- CLAUDE.md **Charts** section: add the cache-invalidation rule from 3c-a (never write a chart host's `innerHTML` directly; use `clearChart()`), and note that `chartSvg` spaces points by **index**, so any caller with non-uniform steps must supply uniform ones (the R17 lesson).
- CLAUDE.md manual checklist: extend item 19 with the erase-then-expand case, item 22 with the x-extent captions and the "step-up ≡ flat at year 1" check, and item 17's no-`NaN` bar with the cleared-`ls-amount` case.
- If R16 takes the B6 route: update `tests.js`'s documented-gap test and CLAUDE.md's **Testing** note about it in the same commit — that note is the only place the gap is explained.
- Bump `sw.js` (`apt-cost-v8` → `v9`).

### Phase 4 — Brand & PWA integrity (D1, D3, D9, D10) — ✅ SHIPPED (see `PHASE-4-REPORT.md`) (**R5**, **R7**, **R9**)

> ⚠️ **Re-scoped 2026-07-25 by B4.** R5 is no longer polish. Two of its items are now launch-blocking: the Google Fonts `@import` **contradicts a promise the app makes in writing** and that Phase 6b is about to repeat in more detail — do not publish the About page while it exists — and the 5.2 MB logo is a real cost on Indian mobile data, paid before a first-time visitor sees a single number. R7 and R9 remain genuine polish and can wait.
- ✅ **D1 done (2026-07-25).** Every hardcoded gray now resolves through `:root`; new neutral tokens `--border-subtle`, `--hero-grad-1/2`, `--on-accent`, `--header-grad-mid/end`. The PNG-export canvas reads the custom properties via a `palette()` helper instead of hardcoding hex. `manifest.json` `background_color` is now `#0a0a0a` (`--bg`). Note the old brief said `#04140d` — that was the pre-overhaul green palette and is stale.
- ✅ **R7 — SHIPPED 2026-07-26.** 29 distinct emoji (~70 usages across nav/tiles/section headers/buttons) replaced with a shared `<symbol>`/`<use>` inline-SVG icon set on `currentColor`. Emoji remain in body/warning copy, as scoped.
- ✅ **R5 — SHIPPED 2026-07-26.** `dhanamlogo.png` compressed 5.2 MB → 10.9 KB (B5 answered: compress the existing mark as-is); real 192/512 `any` + 512 `maskable` manifest icons generated from it, replacing the emoji data-URI.
- ✅ **R5 — SHIPPED 2026-07-26.** `sw.js`'s cache-first branch now `cache.put`s a miss instead of only ever reading from precache; logo, both new manifest icons, and all 8 self-hosted font files added to `ASSETS`. Cache version `v9` → `v10`.
- ✅ **R5 — SHIPPED 2026-07-26.** Inter/Playfair Display/DM Mono self-hosted as 8 `woff2` files (latin + latin-ext per family — the latin-ext half matters because plain "latin" doesn't cover `₹`, U+20B9, which this app prints 85 times); `@import` to `fonts.googleapis.com` removed entirely.
- ✅ **R9 — SHIPPED 2026-07-26.** Excel titles/filenames and the PNG snapshot's text/filename rebranded to "Dhanam"; the snapshot's 7 canvas `ctx.font` calls moved off Georgia/Arial onto Playfair Display/Inter/DM Mono.
- *Acceptance:* airplane-mode reload shows logo + correct fonts; Lighthouse PWA installability passes; no request leaves the origin. **All three verified live** in the Phase 4b review below (offline reload from a real service-worker cache, 15/15 assets precached, zero off-origin requests) — except the Lighthouse run itself, which was not executed; R26 is the one installability gap the review found by hand.

### Phase 4b — Phase 4 review findings — ❌ NOT STARTED (**R26**–**R30**)

> **Why this exists.** A 2026-07-26 review of the Phase 4 diff (`PHASE-4-REPORT.md`) drove the app live in headless Chrome over a real HTTP server and checked Phase 4's claims rather than re-reading its code. **The substantive claims held up**, several of them more strongly than the report itself asserted:
> - **No request leaves the origin** — captured every `Network.requestWillBeSent`: 13 requests, **0 off-origin**. (The `fonts.googleapis.com`/`fonts.gstatic.com` strings still findable in `index.html` are inside the explanatory CSS comment, not a request.)
> - **Offline genuinely works** — registered the SW, went offline via `Network.emulateNetworkConditions`, reloaded: **15/15 assets precached**, 0 network failures, logo decoded from cache (`naturalWidth: 192`), all 8 font faces `loaded`, all 29 icon symbols present, and `calcEMI` executing from a cached `calc.js`. This closes the gap `PHASE-4-REPORT.md` listed under "does NOT include".
> - **`cache.addAll` is atomic**, so one bad path would have silently killed *all* offline support — all 15 URLs verified `200`.
> - **The fonts are genuinely correct**, including the part most likely to have been botched: parsed the WOFF2 table directories and confirmed Inter/Playfair are real variable fonts (`fvar`+`gvar`, so the `font-weight: 300 700`/`400 900` range declarations are valid and weight differentiation measurably works), while DM Mono is static-per-weight exactly as declared. Confirmed by **pixel-comparing rasterised glyphs against a no-such-font baseline** that all three families really do supply `₹` (U+20B9) from the self-hosted latin-ext files — the single highest-risk detail in the whole phase, since the plain "latin" subset omits it. (Note: `document.fonts.check(…, '₹')` returns `false` until the face is explicitly loaded — a Chrome API artifact, not a coverage problem. Don't "fix" a bug that isn't there.)
> - **No blind-replace damage from R7** — no `<svg>` landed inside an HTML attribute or inside a `set()`/`textContent`/toast string (either would have been ugly and visible); all 70 `<use>` elements are balanced and every one resolves to a defined `<symbol>`; no icon-bearing button lost its accessible name.
>
> ⚠️ One near-miss worth recording so it isn't re-litigated: measuring `getComputedStyle(…).color` on a nav tab **immediately** after `switchHub()` returns the *pre-transition* colour (`.hub-tab` has `transition:all .15s`), which reads exactly like a broken active state. It isn't — after letting transitions settle, the active nav tab and its icon are both `--accent`. Any future review measuring colour must wait out the transition.
>
> What's left is five small things, none of which changes a number on screen. **R26 is the only one with a real user consequence.** No calculation is involved anywhere in this phase, so `node tests.js` must stay at 39/39.

- **R26 — wire up the icon links.** Add `<link rel="apple-touch-icon" href="icon-512.png">` (iOS ignores `manifest.json` icons for Add-to-Home-Screen) and a `<link rel="icon">` for the desktop tab. The assets already exist from R5; this is markup only. Add both to `sw.js`'s `ASSETS` if a new file is introduced — though reusing `icon-512.png`/`dhanamlogo.png` means nothing new to precache. *Acceptance:* installing to an iOS home screen shows the Dhanam mark rather than a page screenshot; the desktop tab shows the mark; no new off-origin request; `/favicon.ico` is no longer requested-and-404ed.
- **R27 — `aria-hidden="true"` (and `focusable="false"`) on every `svg.icon`.** Best done as part of **R8**'s accessibility sweep rather than as its own pass — the icons sit inside exactly the controls R8 is already converting. The cheapest correct implementation is to put both attributes in the sprite-usage pattern once and apply it everywhere, not per call site. *Acceptance:* a screen reader announces each control by its text label only, with no "image"/"graphic" noise; no icon appears in the tab order; accessible names unchanged from today (they are already correct — don't regress them).
- **R28 — make the icon-colour code and its documentation agree.** Either drop `color: var(--text-mid)` from `.ab-icon` (and `.tile-icon`) so icons inherit their container's state colour as the comment claims, or keep the pin and rewrite both the CSS comment in `index.html` and the **Icons** paragraph in `CLAUDE.md` to say icons are deliberately held at a fixed neutral regardless of state. ⚠️ If you drop the pin, re-check the landing tiles: `.tile-title` is `--accent2`, so an inheriting tile icon would turn gold and compete with the headline — which is probably why the pin was added. *Acceptance:* no comment in the codebase describes behaviour the CSS doesn't have.
- **R29 — make the service worker's cache writes unable to throw.** Add a `.catch(() => {})` (or a small `safePut` helper) to both `cache.put` chains, and consider tightening `res.ok` to `res.status === 200` so a `206` never reaches `put`. Same discipline as the `localStorage` layer: a failed *cache* write must never surface as an error, because the response has already been returned to the page by then. *Acceptance:* no unhandled rejection in the SW console after a forced `put` failure (easiest to simulate by stubbing `caches.open` to return a cache whose `put` rejects).
- **R30 — delete the unused `<symbol id="i-x">`.** *Acceptance:* every defined symbol is referenced at least once (the `#i-name` occurrence in the sprite's own comment is illustrative and doesn't count as a reference).

### Phase 5 — Accessibility & trust polish (D8, D11) — ❌ NOT STARTED (**R8**, **R10**; B4 now answered — see Phase 6)
- Convert clickable `<div>`s (collapse headers, adv/sip headers) to `<button>`s with `aria-expanded`; add `role="tablist"`/`aria-selected` to hub nav and SIP planner tabs; ≥44px touch targets for mode toggles; visible `:focus-visible` on all interactive elements.
- Add an "Assumptions as of <date>" line covering tax slabs, rates, and location defaults; scope the Reset button label ("Reset Home inputs").
- Wrap wide tables in `overflow-x:auto` containers.
- ➡️ **Moved:** "if B4 = general audience, surface location-specific defaults as clearly-editable assumptions" — B4 was answered *yes* on 2026-07-25, and this grew from a polish item into a correctness bug. It is now **R21 / Phase 6a**, and it outranks everything left in Phases 4 and 5.
- `renderCarLoan()` still re-implements the EMI formula inline instead of calling `calcEMI` — a consistency risk, not a bug today (D11). Folding it in also brings it under `tests.js` coverage.
- Phase 2 added new interactive controls that this pass must cover: the `#l-remember` toggle, the four Worth data buttons, and the file input behind "Restore backup".
- *Acceptance:* full keyboard traversal of every hub; tables don't overflow at 375px.

### Phase 6 — Ready for someone who isn't you (beta, then public) — ❌ NOT STARTED (**R21**–**R25**)

> **Why this exists.** On 2026-07-25 the owner decided Dhanam should eventually be public, starting with a close-circle beta. That answers **B4 = general audience** and changes what "done" means: every phase up to 3c was built for a user who already knows what a perquisite is, that the stamp duty is Telangana's, and that 12% CAGR was a guess. A beta tester knows none of that, and **the app currently gives a stranger no way to find out.**
>
> **On the evidence behind this.** The trigger was the owner's uncle saying such a tool would have helped him plan his loan repayment. Read on its own that's the weakest class of signal — a family member being kind. Two details make it stronger: he was **specific** (loan repayment, from his own past experience, unprompted), and he said it **to a third party when the owner wasn't in the room**, which removes the politeness confound that makes most friends-and-family feedback worthless. That is close to the strongest informal signal available short of watching someone actually use it. It is still one person, and it should be treated as a hypothesis to test in the beta (6f) rather than a mandate — but it is a real one, and **R24 acts on it directly.**
>
> ⚠️ **Phase 6 changes no financial math.** `node tests.js` must stay green and every existing output must remain numerically identical, except where R21 deliberately makes a location-specific default *correct for a non-Telangana user who selects their state*.

**6a — State-aware assumptions layer (R21) — do this first; it's the only correctness bug in the phase**
- The app hardcodes Telangana/Hyderabad values — stamp duty 4%, registration 0.5%, and the ₹/sft and milestone defaults — and presents the resulting total with no regional qualifier anywhere on screen. Rates differ materially across states. **A wrong number delivered confidently is worse than no number**, and unlike every other issue in this document it can't be discovered by the user: nothing looks broken.
- Minimum viable fix: a **state selector** that sets stamp duty and registration, defaulting to Telangana (the owner's own case, so nothing regresses for him), with both values remaining directly editable afterwards. Show the active state's name next to the figures it drives, so the assumption is visible without being hunted for.
- ⚠️ **These are tier-2 values and must stay out of `localStorage`** per the §2.1 rule — with one deliberate exception to settle: the user's *chosen state* is a tier-1 fact about them, not a market assumption, and it is the one thing they'd be most irritated to re-pick every visit. Persist the **selection**, never the rates it implies; rates re-resolve from code on load, so a statutory change reaches everyone on the next deploy.
- Do not attempt to be exhaustive or authoritative on rates. A short, dated, clearly-sourced table for the major states plus "edit these if yours differs" is more honest — and more maintainable — than a comprehensive table that silently rots. Whatever ships must be reflected in 6b's provenance list.
- *Acceptance:* switching state changes stamp duty and registration and the total recomputes; the active state is visible on screen next to those figures; both fields remain manually editable after selection; the stored blob contains the state *choice* and no rates; Telangana defaults reproduce today's numbers exactly.

**6b — About / How this works (R22)**
- **This page's job is provenance and scope, not instructions.** The industry evidence on explainer pages is unkind (Carroll & Rosson's "paradox of the active user", 1987, and every onboarding study since: people skip documentation and start clicking). What a stranger actually needs from a *financial* tool is different — can I trust this, where do the numbers come from, does it apply to me, what will it do with my data. That is what belongs here.
- Contents: what Dhanam is and who it's for; where each assumption comes from and **as of when** (tax slabs, IRDAI depreciation, the state rates from 6a, the 12% CAGR default); the privacy claim stated so it's *checkable* ("open devtools, watch the network tab"); what the app deliberately doesn't do (no bank links, no sync, no accounts, no recommendations); and a plain **"this is not financial, tax or investment advice"** line.
- ⚠️ **Disown the defaults.** Explaining *why* 12% is the default makes it read as a recommendation, not less of one — anchoring works against you here. The copy must actively frame every default as a starting point to be replaced with the user's own figure.
- Include the known-gaps disclosure, starting with **B6** (the ~1% `calcStepupSIP`/`calcSIP` convention difference). Publishing a gap you've documented internally for four phases is cheap; being caught with it by a user is not.
- ⚠️ **Not legal advice, and this brief can't substitute for it:** a free calculator sits well clear of India's investment-adviser regime, but the further it drifts toward recommending specific instruments or actions, the less true that stays. **Get a lawyer's read before public launch** — not before the close-circle beta.
- Placement: reachable from the landing page and the nav. ⚠️ Nav-tab overflow on phones is already a known issue (R10) — adding a tab makes it worse; consider a footer/landing-tile route instead of a seventh tab.
- *Acceptance:* every numeric assumption in the app appears in the provenance list with a date; the privacy section makes a claim that is actually true at the time it ships (**depends on R5 — do not publish this page while the Google Fonts request still exists**); no sentence on the page recommends a course of action.

**6c — Inline `ⓘ` term definitions (R23)**
- **The highest-value comprehension work in this phase**, and the least glamorous. The inputs are self-explanatory (a box labelled "Monthly SIP"); the **outputs** are not. Perquisite value, pre-EMI, "SIP wins by ₹47L", a projection that silently holds property flat — misreading one of those is a worse failure than not knowing which button to press, and it's a failure the user won't notice.
- Recognition beats recall: a glossary read up front is forgotten by the time the term appears on screen. Definitions go **at the term**, not in a collected list.
- Candidate terms (~12, confirm against the markup before building): perquisite value and the two tax regimes (`car-*`), pre-EMI and tranche (`disb-*`), step-up, CAGR, corpus (`sp-`/`su-`/`ls-*`), floor rise, amenities/corpus fund, stamp duty, registration, GST on under-construction (`d-*`), IRDAI depreciation (`cb-*`), investable assets and the flat-property assumption (`w-*`).
- One reusable component, one pattern, `--text-dim` on the glyph — not twelve bespoke tooltips. ⚠️ Must be **tap-friendly, not hover-only** (this is a mobile-first Indian audience on Android mid-range), must not trap focus, and must inherit R8's `:focus-visible`/ARIA treatment rather than becoming a fresh accessibility debt. Coordinate with R8 or do it after.
- *Acceptance:* every listed term has a definition reachable in one tap; definitions readable at 375px without horizontal scroll; keyboard-reachable and dismissible with Escape; no new hue introduced (palette rule 1).

**6d — Prepayment as a first-class entry point (R24)**
- The single externally-validated use case in this app — "help me plan my loan repayment" — is currently at `hub-apartment` → tile → `section-loan` → `adv-section`, closed by default. **Four levels deep, and the app leads with property cost estimation instead.**
- Add a landing tile in the established goal-based voice (e.g. "Should I prepay my loan?" with a `.tile-tool` subline naming Dhanam Home · Loan Analysis, per the Phase 1 naming rule that every tile names a destination that actually exists), deep-linking via the `openLoanCalc()` pattern — and additionally opening `adv-section`, which the existing helpers don't do.
- ⚠️ Route it through `toggleSection()` like the other two helpers so it inherits R14's accordion and the "second click doesn't collapse" behaviour; don't add a third code path. Note `adv-section` is a nested `.collapse-card`, deliberately **outside** the accordion (R14) — opening it must not close anything else.
- ⚠️ This adds a seventh tile and possibly a nav entry; re-check the 375px single-column grid and the nav overflow issue (R10).
- **Test the hypothesis before over-investing.** One relative's remark justifies a tile, not a redesign. If beta testers (6f) don't reach for it, that's information — leave it as a tile and move on.
- *Acceptance:* the tile lands on the loan panel with the prepayment section already expanded, scrolled into view, results rendered; a second click doesn't collapse it; CLAUDE.md's landing checklist items 2–4 extended to cover it.

**6e — First-run orientation + feedback route (R25)**
- **One line, dismissed permanently, on the landing page** — not a modal, not a coach-mark tour, not a carousel. Skip rates on multi-step onboarding are high and retention of what was read is low; the goal-based tiles already carry most of the orientation load, and every field ships pre-filled with a plausible value showing a real answer on arrival. That is already the strongest onboarding the app has. **Don't replace it with a tour.**
- ⚠️ **Dismissal state is tier-3 UI state, not tier-1 user data.** It does not belong in the `dhanam.v1` blob; use a separate key so "Erase my data" semantics stay honest and a restored backup doesn't drag one device's UI state onto another.
- **Feedback route:** a visible contact link (About page and landing footer). Analytics are ruled out by design and should stay ruled out — but be deliberate about the consequence: **an unsolicited message from a user is the only feedback signal this app will ever produce.** Flying blind is a defensible choice; flying blind with no radio isn't.
- ⚠️ **A contact email is a privacy surface too.** Don't collect anything with it, don't pre-fill it with app state, and don't let a "send my data with this report" convenience creep in — that would forfeit the same promise 6b is built to defend.
- *Acceptance:* the orientation line appears once, dismisses permanently, and never returns after a page reload or a backup restore; erasing data does not resurrect it; the contact route is reachable from both the landing page and the About page.

**6f — Beta protocol (not code; do it while 6a–6e are being built)**
- Not a deliverable in `index.html`, but the reason the phase exists — recorded here so it doesn't get skipped in favour of building.
- **Ask about the past, not the future.** "Would you use this?" produces politeness. "What did you actually do last time you thought about prepaying — a spreadsheet, the bank's site, your RM? What couldn't you work out?" produces facts. The uncle signal was valuable precisely because it was a report of past experience, not a prediction.
- **Watch, don't demo.** Hand over a real task ("work out whether prepaying your loan beats an SIP") and stay quiet. Where someone pauses, re-reads, or asks "what does this mean?" is the R23 list, empirically derived instead of guessed.
- **Five non-family testers** surfaces most usability problems; more testers mostly re-find the same ones. Prioritise people **outside Telangana** — they're the only ones who can catch an R21 regression, and they're the users the current defaults are silently wrong for.
- **The signal that actually matters is unprompted return use, or a tester forwarding it to someone else** — the same behaviour that made the uncle's remark worth acting on. Compliments are not signal.
- Feed findings back into this document as new R-numbers rather than fixing them ad hoc, so the record of *why* each change happened survives.

## Out of scope

Backend/accounts/sync, new calculator types beyond Worth, frameworks or build tooling, analytics of any kind, changing any financial formula.

**On accounts specifically:** user accounts are a noted future direction and are understood to require a real backend (`UX-ANALYSIS.md` §2.5). They are out of scope here and must not be half-built — no "optional cloud backup", no telemetry as a stepping stone, nothing that forfeits the "never sent anywhere" promise without actually delivering accounts. Nothing in Phase 2 has to be undone to add them later: the tier-1/tier-2 split is exactly the store-vs-compute boundary a server would use, and the Option C JSON schema is the natural sync payload.

**On Firebase specifically (B9, raised 2026-07-25).** Still out of scope, but the question is now live enough to write down the conditions rather than re-derive them under pressure later. This is not legal advice and a lawyer's read is needed before any of it ships.

- **The privacy promise is a one-way ratchet.** "Nothing is ever sent anywhere" can be tightened silently; it cannot be loosened silently. The day any user data reaches a server, that copy has to change **everywhere it appears** — landing page, About page (6b), Worth hub — *before* the feature ships, not after. Shipping the backend first and updating the copy later is the one failure mode that would do real damage to the thing the app is trying to be.
- **Don't adopt a backend for sync convenience.** Cross-device is already solved, imperfectly but honestly, by the Option C JSON backup. Adopt a server only when a feature genuinely cannot exist without one — and name that feature first. "It would be nice to have accounts" is not a feature.
- **If it happens anyway, the shape that preserves the promise** is: opt-in (the app stays fully functional and local-only for anyone who declines), storing the same tier-1 JSON payload the backup already produces, **encrypted client-side before upload** so the server holds a blob it cannot read. That keeps balances unreadable to Firebase, to Google, and to a future compromised deploy — and it's the only version where the marketing claim survives roughly intact.
- **Firebase-specific hazards worth knowing before choosing it.** In a client-side app with no server of your own, **Firestore security rules are the entire security model** — a misconfigured rule is the single most common way this stack leaks data, and there is nothing behind it. Pick an Indian region (`asia-south1`) deliberately rather than accepting the default. And note that "no analytics" becomes harder to hold: several Firebase products enable telemetry by default, which would quietly contradict the stance taken in 6e.
- **Regulatory weight goes up, not down.** Net worth, salary and loan balances are personal financial data; the moment it's held on a server, obligations under India's DPDP Act (2023) — consent, purpose limitation, breach notification, deletion on request — attach to *you* in a way they simply don't for `localStorage`. "Erase my data" stops being a one-line `localStorage.clear()` and becomes a promise you have to be able to keep on someone else's infrastructure.
- **Sequencing:** do not start this before Phase 6 lands. Phase 6 is what makes the app trustworthy to a stranger; a backend added first would mean asking strangers to trust a server before the app has explained what it does with anything.

## Definition of done (whole task)

- All acceptance checks above plus the full CLAUDE.md manual checklist pass at desktop and 375px widths.
- CLAUDE.md updated wherever structure/conventions changed (hub list, new `w-*` prefix, persistence layer, icon approach).
- `sw.js` cache version bumped; previously installed PWA picks up changes on reload.
- One commit per phase, message style matching the existing history (`feat:`/`fix:`/`docs:`).
