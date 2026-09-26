# TASK-SIMPLIFY — Action plan from the 2026-09-18 usability & architecture review

Extracted from `DHANAM-USABILITY-AND-ARCHITECTURE-REVIEW.md`. Each item is written so it can be handed to Claude Code as a single task. Every item has a **Done when** line — if it can't be checked, it isn't done.

**Governing rule for every item:** on every hub, a first-time visitor gets a meaningful number within 20 seconds and zero typed inputs. Grow and Home Quick Estimate already pass. Everything below moves Car and Worth to passing, and stops the other hubs from regressing.

Order matters: **Wave 0 → 1 → 2 → 3 → 4.** Do not start Wave 3 (restructure) before Wave 1 (cuts) — otherwise you modularize code you're about to delete.

---

## Wave 0 — Hours. Ship this week, current codebase.

### S1. Strip internal IDs from user-facing copy
- Remove every `(D17)`, `(Phase 22)`, `R76`, "tier-2", `§87A` from rendered text outside the About page. Known spots: `#lg-hero-note`, the Compare Cars caveat list (the "Marginal tax rate is derived…" bullet).
- Add to `MANUAL-TESTS.md`: "grep rendered HTML (not comments) for `\(D[0-9]+\)|\(R[0-9]+\)|\(B[0-9]+\)|Phase [0-9]+|tier-[123]` — must be empty."
- **Done when:** the grep returns nothing.

### S2. Fix contradicting labels and artefacts
- `car-basic` label "Basic Monthly Salary (₹)" → "Monthly Fixed Pay (₹)". Shorten its hint to "Basic + HRA + allowances, from your payslip".
- `#lg-hero-note` shows "(currently )" before JS fills `#lg-terms-used`. Render the note only after the span is populated, or drop the parenthetical.
- Home Detail: "East Facing Premium (₹100/sft)" and "Corner Facing Premium (₹100/sft)" hardcode the rate in the label while every other row has an editable rate. Give them an editable ₹/sft input like the others.
- **Done when:** no label contradicts its hint; no empty parenthetical at first paint.

### S3. Landing page: one door per hub
- Reduce `.tile-grid` from 6 tiles to 4: Grow · Home · Car · About/feedback stays in the footer. Worth keeps `#landing-worth-card`.
- Delete the three deep-link tiles (`Finance My Home`, `Buying Under Construction?`, `Should I Prepay My Loan?`). Their targets remain reachable via the accordion buttons inside Dhanam Home. Keep `openLoanCalc()`/`openDisbCalc()`/`openPrepayCalc()` as functions if anything else calls them; otherwise delete.
- Merge the two orientation lines ("What do you want to do?…" and "First time here?…") into one dismissible line.
- **Done when:** landing shows Worth card + 4 tiles + footer, one orientation line.

### S4. Worth: illustrative empty state
- On first open with no saved data, render `#w-proj-card` with illustrative defaults (e.g. ₹5,00,000 investable, ₹10,000/mo, 10% CAGR, no debt) and a hero that reads "Add your balances above to make this yours." Do **not** write these illustrative values to `dhanam.v1` — persistence stays gated on a non-zero user input, exactly as now.
- **Done when:** a fresh-profile visitor sees a projected figure on first open; `localStorage` stays empty until they type.

---

## Wave 1 — Days. The Car hub cut.

### S5. Split Dhanam Car into two tools

**Tool A — "Car loan or company lease?"** (replaces `#lg-card` as the whole first screen)
- Inputs: on-road price, monthly fixed pay, regime. Three fields, nothing else visible.
- Defaults: a salary at which a lease is plausible — ₹2,00,000/mo fixed pay, ₹15L car, new regime. (At the current ₹1L default the hub's own first answer is "loan wins by ₹62K" because there is no tax to shield.)
- Output: one hero sentence + three line items only: **EMI difference over the term · Tax saved · Residual buyout**. No caveat list on this screen.
- §87A handling: when the derived marginal rate is inside the relief band, show one inline line under the hero — "You're in the ₹12L–₹12.7L rebate taper: the saving dips here and recovers above ~₹1.6L/mo." Show it **only** when it applies. Delete the permanent 90-word explanation.
- Deep dive: one button, "Reconcile against my payslip ▾", opens the current `#car-lease-panel` (EPF, bonus, driver, engine, both scenario cards, its caveat list) unchanged. Its `car-basic`/`car-regime` should **prefill from** Tool A's inputs on first open (one-way copy at open time; the existing "not wired together" decision stays — they're separate fields after that).
- The Loan / Lease / Cash mode selector is removed from the top of the hub. See S6 for where mode goes.

**Tool B — "Which car costs less to own?"** (replaces Compare Cars' default view)
- Per-car inputs: name, type (Petrol/Diesel/EV), on-road price, and one efficiency field in a unit people know: **kmpl** for ICE; for EV, **claimed range (km)** + **battery (kWh)** → derive kWh/100km internally (`100 × kWh / range`). Keep `eff` in the state as kWh/100km so `calcRunningCost` is untouched.
- Prefill two example cars (e.g. "Petrol hatchback ₹9L / 18 kmpl" and "EV ₹15L / 400 km / 40 kWh") so the ranking renders on first paint; the row placeholder text says "Replace with your own quote."
- Default view shows: ranked cards (net cost over N years + ₹/km) and **one** chart (cost over time). That's all.
- Everything else moves under a single collapsed "Explore further ▾" panel — see S7 for what survives.
- **Done when:** with zero inputs, both tools render a complete answer; the hub's visible copy above the fold is under 150 words.

### S6. Financing mode becomes a Tool B assumption, not a hub-level state
- Remove the `#car-mode-row` buttons from the top of the hub. Inside Tool B's assumptions, one `<select>`: "Paying by: Loan / Company lease". Loan default.
- **Delete Cash mode.** Its only distinct output was the opportunity-cost reveal (S7 deletes that). `calcOwnershipCost({mode:'cash'})` can stay in `calc.js` with its tests; the UI just never selects it.
- `carMode` global → a field on Tool B's state.
- **Done when:** no `car-mode-btn-*` ids remain; `node tests.js` still 100%.

### S7. Delete or demote the Compare Cars extras
Delete (remove markup, render code, and their `MANUAL-TESTS.md` items):
- Opportunity-cost reveal (`#cc-opp-reveal-btn`, `ccOppRevealOpen`, `ccOpportunityCost`, `cc-cash-cagr` field).
- Cross-mode "three ways" reveal (`#cc-cross-reveal-btn`, `ccCrossRevealOpen`).
- Tenure grid (`#cc-tenure-card`, `tenureStats`).
- Depreciation table + loan-balance overlay (`#cc-depr-section`, `#cc-depr-chart`, `ccRenderLoanDetail` except the parts S5/S8 keep).
- Net-cost-vs-km crossover chart (`#cc-chart-card`, `renderCCChart`).
- Per-card nested collapses (`ccToggleDetail`, `ccForceOpen`/`ccForceClosed`). Each rank card shows its 4–5 lines flat.

Demote into "Explore further ▾" (collapsed, one level, no nested collapses):
- Assumptions (trimmed per S8).
- Lease-vs-loan table for the selected car (`renderCCCrossMode`, two columns now that Cash is gone) — keep the Tax Saved line.
- Breakeven km sentence (`#cc-breakeven-card`).
- Resale estimate: replace the "Reveal resale-adjusted…" button with a plain labelled line on the cost-over-time card: "Est. resale value at year N (IRDAI schedule): ₹X". No button.
- **Done when:** Compare Cars has exactly one collapse control; no element whose label starts with "Reveal".

### S8. Trim the assumptions card 17 → 7
Keep visible: petrol price · home charging ₹/unit · annual km (one field; drop the city/highway split — sum them) · term · loan rate · lease rate · residual %.
Move to constants in `calc.js` (dated, on the About page provenance list, pinned in `tests.js`): ICE/EV highway multipliers, ICE/EV annual maintenance, ICE/EV insurance %, IDV depreciation %, public charging rate.
- **Done when:** `#cc-assumptions-card` has 7 inputs; About page lists the new constants with a date.

### S9. Persistence cleanup for Car
- Tool B persists `cars` + `annualKm` (tier-1, as before). Tool A persists nothing (as before).
- `hydrateCC()` must migrate an existing `dhanam.v1` blob: `cityKm + hwyKm → annualKm`; drop `downPayment` if S6 removed per-car down payment (keep it if Loan mode still uses it — it does; keep).
- **Done when:** a pre-S5 backup JSON restores without error and ranks the same cars.

---

## Wave 2 — Days. Copy budget, all hubs.

### S10. Enforce the copy budget
| Element | Limit |
|---|---|
| Hero | one number + one sentence |
| Field hint | ≤ 8 words, only where the label is ambiguous |
| Term popover (`.term-info-pop`) | ≤ 20 words |
| Caveats | one collapsed "Assumptions & limits ▾" per hub; ≤ 10 words per line; link to About for the long form |
| "A projection, not a promise" and similar | once on About, once inside the hub's Assumptions panel — never on a hero |

- Pass every hub. Current worst offenders: Car (2,730 words static copy), Home Loan panel, the 16 popovers at 32–52 words.
- Add to `MANUAL-TESTS.md`: "no visible text node outside About exceeds 60 words."
- **Done when:** Car ≤ 800 static words, Home ≤ 700, every popover ≤ 20 words, one caveat panel per hub.
- **Status: done 2026-09-26**

### S11. One naming system
- Nav + hub headers: brand names (Dhanam Worth / Grow / Home / Car).
- Tile sublines only: goal phrasing.
- In-hub section headers: questions ("Which car costs less to own?", "What will this property cost?").
- Delete headers of the form "X — Y Analysis".
- **Done when:** no section header contains " — ".
- **Status: done 2026-09-26**

### S12. Nesting cap
- Max two levels anywhere: panel → one collapse. The Loan panel's `adv-section` → `adv-worth-card` nesting is three; flatten `#adv-worth-card`'s content into `adv-section` directly (still closed-by-default at the `adv-section` level).
- Term popovers: with S10's 20-word cap, the close-on-scroll behaviour is fine; leave it.
- **Done when:** no `.collapse-card` inside a `.collapse-card` inside a `.section-panel`.
- **Status: done 2026-09-26**

---

## Wave 3 — 1 week elapsed. Run the beta.

### S13. Five-person watch test
- Five people, not family, at least three outside Telangana. 20 minutes each, screen-recorded, you don't speak.
- One task per hub: "Find out what ₹10K/month becomes in 15 years." "What would a ₹60L flat cost you to buy?" "You're offered a company lease on a ₹15L car — is it better than a loan?" "Which of these two cars is cheaper to run?" "Record your net worth."
- Record per task: **seconds to first meaningful number**, **furthest scroll depth**, **abandoned Y/N**, one quote.
- Launch metric: every hub ≤ 20 s to first number. If Car is still > 60 s after Wave 1, Wave 1 isn't finished.
- **Done when:** a 1-page `BETA-1-FINDINGS.md` exists with the table above filled in for 5 × 5 tasks.
- **Status: skipped by owner 2026-09-26 (human beta, not agent work)**

---

## Wave 4 — 2–3 weeks. Restructure (only after Waves 1–2 shipped).

### S14. Vite + ES modules, static output, same hosting
```
src/
  calc/      loan.js  tax.js  car.js  sip.js  worth.js      ← split calc.js by domain
  ui/        chart.js  collapse.js  term-info.js  format.js  toast.js
  state/     store.js (one plain object per hub)  persist.js (dhanam.v1)
  hubs/
    grow/    grow.html  grow.js  grow.css
    worth/
    home/
    car/     loan-vs-lease.js  compare.js  lease-detail.js
  main.js    ← hub router + init
public/      ← fonts, icons, manifest.json
index.html   ← shell only
```
- Vanilla JS. No framework. Event delegation per hub (`hubEl.addEventListener('input', …)`) replaces every inline `on*=""` string.
- Migrate **Grow first** (smallest, proves the pattern), then Worth, Home, Car.
- `vite-plugin-pwa` replaces `sw.js`'s hand-bumped `CACHE` and `BUILD_STAMP` with content hashes. Delete both constants and CLAUDE.md invariant #11.
- GitHub Actions: build on push to `main`, deploy `dist/` to Pages.
- **Done when:** `grep -c 'on[a-z]*="' dist/index.html` is 0; each hub's module reads no other hub's DOM.

### S15. Per-hub state, no cross-hub DOM reads
- Each hub: `state = { … }`; `render(state)` writes DOM; input handler updates `state` then calls `render`. Rows are rendered from state, so the D6 focus-loss rule becomes unnecessary — replace it with the standard "only re-render the changed row's outputs, never its inputs" in the row renderer.
- Cross-hub reads go through an exported function on the source hub's module (`worth.snapshot()` is the existing example). Car's lease detail reads Tool A's state via `car.loanVsLease.state`, not `v('lg-basic')`.
- Delete all 40 module-scope globals; `grep -cE '^(let|var|const) ' src/main.js` ≤ 5.
- **Done when:** renaming any input id in one hub cannot change a number in another hub.

### S16. Tooling that replaces rules-in-prose
- **ESLint**: `no-undef`, `no-unused-vars`, `no-implicit-globals`, `eqeqeq`.
- **Vitest**: port the 117 `tests.js` assertions unchanged; add ~12 jsdom render tests: per hub "renders non-empty hero with defaults", "input X changes hero Y", plus the two copy lints from S1 and S10 as tests.
- **Playwright**: 5 smoke tests (one per hub): open, type one value, assert hero changed, screenshot. Run in CI.
- **Done when:** CI is green on `main` and blocks merge on red.

### S17. Collapse the docs
- `README.md` — what/run/test/deploy, one screen.
- `ARCHITECTURE.md` — ≤ 300 lines: folder layout, state rule (S15), persistence, how to add a hub.
- `DECISIONS.md` — ≤ 1 line per entry; keep only entries a test can't express (privacy: no outbound requests; advice-free copy; statutory constants dated + pinned). Everything else either became a test in S16 or is moot after S14/S15.
- `CLAUDE.md` — ≤ 60 lines: commands, folder rule, copy budget (S10), the 3–4 remaining invariants.
- `docs/history/` — move every `PHASE-*-REPORT.md`, `TASK-*.md`, `UX-ANALYSIS.md`, `ARCHITECTURE-ANALYSIS.md`, `MID-PROJECT-REVIEW.md`, `COLOR-PALETTE-ANALYSIS.md`. Link from README. Not required reading.
- `MANUAL-TESTS.md` — ≤ 20 items after S16 automates the rest.
- **Done when:** a new contributor reads ≤ 400 lines of prose before their first PR; `du -sh docs/history` is where the rest went.

---

## Explicit decisions needed from the owner before Wave 1

| # | Decision | Default if you don't decide |
|---|---|---|
| D-A | Keep Cash mode anywhere? | No (S6) |
| D-B | EV efficiency input: range + battery, or km/kWh? | Range + battery |
| D-C | Keep the About page's literal "no request leaves this page" claim, or add one disclosed analytics script? | Keep the claim; use GitHub's traffic tab only for beta |
| D-D | Does the Loan panel keep both "Buy-vs-SIP" and "Extra payments" or pick one for the default view? | Keep both; S12 flattens the nesting |

## Not in scope
- Accounts, sync, backend — revisit only if S13 testers ask for cross-device.
- Post-tax figures in Grow (R31) — after Wave 4.
- Any new calculator. Nothing gets added until Car passes the 20-second test.
