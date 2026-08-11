# Dhanam — UI/UX Design Analysis

*Reviewed: 2026-07-19 · Source: `index.html` (~2,900 lines), `manifest.json`, `sw.js` · No code was changed for this review.*

> **📍 Status header, added 2026-08-10.** This document is the **original analysis and its rationale** — it is deliberately *not* updated as things ship, because its value is the reasoning at the time. Two things a reader needs to know before trusting a detail in it:
>
> 1. **`TASK-UX-REDESIGN.md`'s "Remaining work" table is the live view of what's left**, and **`MID-PROJECT-REVIEW.md` (2026-08-10) is the audit of this document against the code that actually shipped.** Scorecard: **11 of the 14 design defects fully closed, D12 half-closed, D7 regressed, D8 untouched.**
> 2. **Two visual descriptions below are stale.** The verdict paragraph and the first "What's working well" bullet describe a *"forest green + gold"* palette. That palette was replaced by the true-neutral near-black **"Quiet Luxury / Private Bank"** system (gold as the sole accent, disciplined green/red for real deltas) — see `COLOR-PALETTE-ANALYSIS.md` and `TASK-COLOR-PALETTE.md`. The *argument* those sentences make (that the app has a real visual identity, unusually for a calculator) still holds; only the hue names are wrong. `index.html` is also now 5,589 lines, not ~2,900.
>
> **Where this document's own predictions landed** (detail in `MID-PROJECT-REVIEW.md` §2.2): **Strategic #1 (the front door) — solved**, goal-framed tiles, Grow first. ⚠️ Watch that the tile grid has grown to 7 and **4 of the 7 now lead to home/loan destinations**; the original complaint was "three of six tiles are loan-related", and the underlying gravity has returned even though goal-framing masks it. **Strategic #2 (Worth as the anchor) — about a third built, and stalled**: the projection bridge ships, but the two things promised in §Strategic-2 below — the prepayment simulator showing its effect on *your* net worth, and the verdict cards becoming personal — were never given R-numbers and never built. The bridge runs one way only. **That is now tracked as R65**, whose acceptable outcome includes an explicit decision *not* to build it — recorded here rather than left looking half-finished by accident.

---

## Verdict up front

**Dhanam succeeds as a beautifully-themed collection of expert calculators. It does not yet succeed as a "personal finance app."** The difference is the difference Steve Jobs kept hammering on: *"Design is not just what it looks like and feels like. Design is how it works."* The visual layer (forest green + gold, serif display numerals, mono figures) is distinctive and far above the typical calculator site. But the *structure* of the app is organized around how it was built — home buying first, everything else appended — rather than around what a person managing their money actually needs. Your own instinct in raising this is correct, and it's the single most important thing to fix.

Three structural gaps keep it from being a finance *app* rather than a calculator *toolbox*:

1. **It leads with the least universal need** (buying an apartment in Hyderabad) instead of the most universal one (growing money / knowing where you stand).
2. **It has no concept of "you."** Every visit starts from zero. Nothing is remembered. A finance app without memory is a brochure.
3. **It only knows the future.** Every calculator is a projection. There is no anchor in the present — which is exactly why Net Worth feels impossible to place. (More on how to fix this below.)

The good news: the bones are excellent. The fixes are mostly re-ordering, pruning, and one new primitive (local persistence) — not a rebuild.

---

## What's working well

- **A real visual identity.** The green/gold palette, `Playfair Display` for hero numbers, `DM Mono` for figures, and `Inter` for UI is a confident, luxurious system that fits the name *Dhanam* (wealth). Almost no calculator app has a brand; this one does.
- **Zero-friction interaction model.** No submit buttons, no page loads — every input recalculates live. This is the Apple "it just works" quality and it's already there.
- **Indian-first details.** ₹ Cr/L formatting, `en-IN` locales, Telangana stamp duty hints, IT-rule perquisite tables, IRDAI depreciation. This domain depth is the app's moat.
- **Privacy as a feature.** "Nothing is saved or sent anywhere" is a genuinely differentiating promise (with two caveats flagged below).
- **Progressive disclosure exists.** Collapse cards, tag badges, quick-estimate → detail flow show real information-architecture instinct.
- **Honest caveats.** The car-tax notes ("Consult a CA…") build trust rather than eroding it.

---

## Strategic issue #1 — The front door is wrong (your first concern)

**Observation.** The landing grid orders tiles: Dhanam Home → Home Loan → Dhanam Car → Dhanam Grow → Loan Disbursement → Dhanam Worth (disabled). Two of the first two tiles are about buying an apartment; three of six tiles are loan-related. The apartment hub is also by far the most developed surface. The app's information architecture mirrors its *development history*, not its users' priorities.

**Why it matters.** For most people, the funnel of financial life is roughly: *know where I stand → grow savings (SIP) → big purchases (home, car) → optimize loans.* Home buying is a once-or-twice-a-lifetime event; SIP planning and net worth are monthly habits. An app whose front door is its rarest use case will feel like "someone else's tool" to most visitors. Jobs' filter applies directly: *what is the one thing a first-time visitor should do?* Right now the app doesn't answer that — it presents six equal-weight doors, and the first one is niche.

**Recommended fix (documented only, not applied):**

- **Reorder by frequency-of-need, not by build order:** Grow (SIP) and Worth (once built) first, Home second, Car third, loan tools last or nested.
- Alternatively (stronger): reframe the landing as **goals, not tools** — "Grow my money", "Know my net worth", "Plan a home purchase", "Get a car". Goal language is how people think; tool names ("Loan Disbursement") are how engineers think.
- **Demote "Loan Disbursement" from a top-level hub.** Pre-EMI on an under-construction property is a sub-topic of home buying. It belongs inside Dhanam Home next to Loan Analysis. Six top-level destinations where 2½ are home-loan-related is fragmentation — the "say no" principle says a hub must earn its tile.
- **Fix the naming inconsistency** (it actively confuses the mental model):
  - The nav tab says **"💸 Dhanam Loan"** but its landing tile says **"Loan Disbursement"** — same destination, two names.
  - The **"Home Loan"** tile has *no* corresponding nav tab and deep-links into the middle of the apartment hub — a second door into the same room.
  - Tiles mix branded names (Dhanam Home/Car/Grow/Worth) with generic ones (Home Loan, Loan Disbursement). Pick one system.

---

## Strategic issue #2 — Net Worth doesn't fit because the app has no "present tense" (your second concern)

**Observation.** Every existing calculator answers *"what will X cost/become in N years?"* — pure, stateless projection. Net worth answers *"what do I have today?"* — a stateful snapshot. The app's architecture (no localStorage, state dies with the tab, per CLAUDE.md a deliberate choice) makes a net worth tracker literally impossible today: you'd retype your entire balance sheet every visit.

**The reframe that resolves it:** Net worth isn't a seventh calculator — it's the **anchor** the other six orbit. Once the app knows "you have ₹X across these assets and ₹Y of loans," every existing projection engine gains meaning:

- The SIP planner stops being abstract: *your* corpus + *your* monthly SIP → projected worth at 40/50/60.
- The prepayment simulator can show its effect on *your* net worth curve, not a hypothetical loan.
- The verdict cards ("SIP wins by ₹…") become personal advice instead of generic comparisons.

This is how Dhanam graduates from toolbox to app: **Worth is the noun; the calculators are the verbs.**

**Three implementation postures (in ascending commitment):**

| Option                                          | What it is                                                                                                                                                                                                                 | Trade-off                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Session worksheet + export**               | An assets/liabilities form (cash, FD, MF, EPF/PPF, property, gold, loans) that totals live and exports via the existing `buildExcel` pipeline. Nothing persists.                                                           | Zero architecture change, ships fast — but retyping every visit means nobody will use it twice. Honest MVP, weak product.                           |
| **B. localStorage persistence** *(recommended)* | Same worksheet, saved to `localStorage` on the device. Update the promise to "saved only on this device, never sent anywhere" — which is still a *stronger* privacy story than any fintech app. Add export/erase controls. | One new primitive (a small `saveState`/`loadState` layer). Also unlocks remembering inputs across *all* hubs — fixing the "no memory" gap app-wide. |
| **C. File-based snapshots**                     | Export/import a JSON "Dhanam file" the user owns.                                                                                                                                                                          | Maximum privacy purity, but import friction kills habitual use. Better as a backup feature on top of B.                                             |

**Recommendation: B**, with the Worth hub structured as: (1) editable balance-sheet with Indian asset categories, (2) hero net-worth number in the existing `total-card` style, (3) a **change-since-last-visit tile** (see §2.4), (4) a net-worth trend chart behind an expanded view, and (5) a "projected worth" section that *reuses* `calcSIP`/`loanAtYear` to draw the future from today's snapshot — the bridge between Worth and Grow that no standalone calculator can offer.

**Decision (2026-07-25): Option B approved**, scoped per §2.1, with Option C shipped alongside it as a backup mechanism rather than deferred. The sections below expand what that commits to.

---

## §2.1 What gets persisted — the decision that matters most

"Save the inputs" is under-specified, and getting it wrong is the most likely way this feature starts producing *wrong* answers rather than merely annoying ones. Split every input into three tiers:

| Tier                                   | Examples                                                                                                            | Persist?                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **1 — Facts about you**                | Asset/liability balances, salary, loan principal & tenure, monthly SIP amount, property purchase price              | **Yes.** This is the entire point.                          |
| **2 — Market & statutory assumptions** | 8.75% SBI rate, 4% Telangana stamp duty, FY2025-26 tax slabs, ₹100/sft floor-rise premium, IRDAI depreciation table | **No.** Always reload the app's current maintained default. |
| **3 — Ephemeral UI state**             | Which hub is open, which collapse cards are expanded, active SIP sub-tab                                            | Optional. Low value, low risk — defer.                      |

Persisting tier 2 is a quiet trap: save 8.75% today and in 2028 the app confidently computes an EMI at a rate that has been wrong for three years, with no indication the number came from a stale session rather than the app's maintained default. Same failure mode for tax slabs and stamp duty. Mixing "what I own" with "what the market does" into one blob also makes every future default update a silent no-op for existing users.

**Rule:** the persisted blob contains only tier 1. Tier 2 values live in code, are re-read on every load, and are covered by the "Assumptions as of <date>" line from D11.

**Refinement found while implementing 2a (2026-07-25):** a few fields straddle the two tiers. The interest rate is the clearest case — 8.75% as the *app default* is tier 2, but "my loan is at 8.4%" is tier 1. Resolution: **persist such a field only when its value differs from the app default.** An untouched field stays unstored and keeps tracking the maintained default; a deliberately changed one is remembered as the user's own fact. The trade-off is that someone who explicitly types today's default gets the future default instead of their typed value — acceptable, and preferable to freezing a stale rate. Applies to `l-rate` today; use the same rule for any future default-bearing input.

---

## §2.2 Why persistence is a gate, not a convenience

Worth without persistence isn't harder — it's pointless. The second-order effect is the larger prize: once yesterday's number is on disk you get **deltas and a trend**, which is the actual motivating feature of any net-worth tracker and the natural home for the chart work in D5. Without stored history there is nothing to plot and nothing to compare against.

**Worked example.**

*Without persistence*, checking your net worth on 25 July means typing 7 asset rows (savings ₹4.5L, FD ₹8L, MF ₹18L, EPF ₹12L, stocks ₹6L, gold ₹5L, property ₹95L) and 2 liabilities (home loan ₹52L, car loan ₹6L) — **9 fields, ~2 minutes**, mostly re-entering numbers you looked up last month. Result: **₹90.5L**. Is that good? Unknowable; June's figure lives in your head or nowhere. Next month you repeat all 9. Realistically you check once and never return.

*With persistence*, the same visit opens on ₹90.5L from 12 June. Your MF balance is now ₹19.4L and one EMI has taken the home loan to ₹51.4L. You edit **2 fields** and it reads:

> **₹92.5L** · ▲ ₹2.0L (+2.2%) since 12 June

**~15 seconds**, and for the first time the app says something no calculator can: the direction you're moving. The projection bridge then runs on your real balance sheet (₹43.4L investable, ₹25k/mo SIP, ₹51.4L amortizing) instead of a hypothetical.

That gap — 9 fields and no memory versus 2 fields and a delta — is the whole argument. Everything below is risk management around it.

---

## §2.3 Risks and required mitigations

Each of these is a condition of shipping B, not an optional nicety.

**R1. Safari silently deletes `localStorage` after 7 days.** Safari's tracking prevention wipes script-writable storage for origins with no user interaction in 7 days. Home-screen-installed PWAs are exempt, but a desktop-Safari or in-browser iPhone user who checks monthly finds the app **empty every single time** — and empty-after-being-promised-persistence is worse than never having promised it. *This is the heaviest risk.*

- **M1a.** Ship Option C (one-click JSON export / import of a "Dhanam file") in the same phase, not later — it's the honest answer to eviction *and* to cross-device.
- **M1b.** Store and display a `lastSaved` date on the Worth hub so a wipe is visible and explicable rather than mysterious.
- **M1c.** If a previously-populated state is found missing (a `dhanam.seen` marker exists but the state key is gone), show a one-line non-alarming notice: "Your saved data was cleared by your browser. Import a backup or start fresh." Never a silent blank form.
- **M1d.** Nudge PWA installation from the Worth hub specifically, since installation is what actually buys durable storage on iOS.

**R2. This is the first bug class that can brick the app on load.** Today every bug is recoverable by reloading, because state dies with the tab. A malformed or half-written blob parsed at init throws *before* first paint, and reloading won't fix it — the user must clear site data, which they will not know how to do.

- **M2a.** `loadState()` wraps everything in `try/catch` and treats any unreadable or version-mismatched state as absent, never as fatal.
- **M2b.** `loadState()` is off the critical path of first paint: render the app from defaults, then hydrate.
- **M2c.** `saveState()` also `try/catch`-wrapped (quota / private-mode `SecurityError` must not break typing).
- **M2d.** Add corrupt-state and wrong-version cases to the manual checklist in `CLAUDE.md` — `tests.js` covers only pure `calc.js` functions, so this class is manual-verification territory.

**R3. Shared-device exposure.** A household laptop now shows a full balance sheet to whoever opens the browser next; without a backend there is no meaningful lock.

- **M3a.** A "hide amounts" blur toggle on the Worth hub (state itself may be tier 3 / not persisted).
- **M3b.** Never surface net worth on the landing page or in the nav — it stays inside the hub.
- **M3c.** Prominent, clearly-labelled "Erase my data" control with a confirm step.

**R4. It creates a sync expectation the architecture can't meet.** Once the data is trusted, "why isn't this on my phone too?" follows immediately. Cross-device access requires a backend — no static-file trick avoids it (see `ARCHITECTURE-ANALYSIS.md`, "no backend" section).

- **M4a.** Copy is explicit that storage is per-device: "saved only on this device — never sent anywhere."
- **M4b.** JSON export/import (M1a) is the sanctioned manual bridge between devices.
- **M4c.** See §2.5 for the accounts/backend question, which is deliberately out of scope for this redesign.

**R5. Ordinary browser hygiene wipes it** — "clear browsing data", private windows, cleanup extensions. Unavoidable; covered by M1a–M1c.

**R6. Schema churn.** Every new Worth field is a migration decision. Bumping `dhanam.v1` → `v2` and discarding v1 is safe but silently destroys the user's data, which for a net-worth tracker *is* the asset.

- **M6a.** Keep the persisted shape flat and additive so new fields are absent-not-invalid; unknown keys are ignored, missing keys fall back to defaults.
- **M6b.** Only bump the version for genuinely breaking shape changes, and write a real migration when you do — never a silent discard.
- **M6c.** The exported JSON carries the same version field so imports can be validated and migrated identically.

---

## §2.4 The net-worth change tile

Once state persists, the delta becomes the most valuable pixel in the hub — it's the only place in Dhanam where a colour genuinely encodes a real financial change over time.

- **Its own tile**, sibling to (not inside) the hero net-worth `total-card`: current net worth stays the gold hero figure; the change gets a dedicated card so it reads as a distinct fact rather than a footnote.
- **Contents:** direction arrow (▲/▼), absolute change (`inCr()`-formatted), percentage change, and the comparison basis — "since 12 June" — because a delta without a date is meaningless.
- **Colour:** `--green` for an increase, `--red` for a decrease. This is a textbook legitimate use under the palette rules — a real positive/negative financial delta, not decoration or emphasis.
- **Never colour-only** (palette rule 5): the arrow glyph *and* a text label ("up ₹2.0L since 12 June") carry the meaning independently, so the tile is fully readable with red-green colour vision deficiency or in greyscale.
- **Neutral states matter:** first-ever visit → no tile at all (nothing to compare); zero change → neutral `--text-dim` with "no change since <date>", not green; missing/evicted history → the M1c notice, not a fabricated ₹0 delta.

**Trend chart — behind an expanded view.** A net-worth-over-time line/area chart lives inside a `.collapse-card`, **closed by default**, consistent with D4's hero-answer-first principle: the tile answers "am I up or down?"; the chart answers "what has the shape been?" for whoever wants to dig. Same inline-SVG, dependency-free approach as the D5 charts, same theme colours. Requires keeping a small append-only history of `{ date, netWorth }` snapshots (one per save-day, capped) rather than only the latest value — worth designing into the v1 schema now even if the chart ships after the tile, because history can't be reconstructed retroactively.

---

## §2.5 Future: accounts and a backend (explicitly out of scope)

Owner's intent, noted here so it isn't rediscovered later: user accounts are a plausible future direction, and it is understood that they require a real backend. Recording the boundary:

- **Everything in this document is achievable with zero backend.** localStorage + JSON export/import covers "remember my data on this device" and "move it myself", which is most of the value.
- **Accounts are a different product**, not a bigger version of this one. They bring authentication, a server-side store of highly sensitive financial data, breach exposure, DPDP Act obligations as a data fiduciary, hosting cost and uptime duty — and they forfeit the "never sent anywhere" promise that is currently one of Dhanam's genuine differentiators.
- **Sequencing:** ship B + C, see whether the net-worth habit actually forms and whether cross-device demand is real (from real use, not speculation). If it is, the JSON schema from §2.1 becomes the natural sync payload, and the tier-1/tier-2 split already drawn here is exactly the boundary a server would store versus compute. Nothing in the local design has to be undone to move later — which is the point of doing it in this order.
- **Do not half-build it.** No analytics, no "optional cloud backup", no telemetry as a stepping stone; those forfeit the privacy claim without delivering accounts.

**Update 2026-07-25 — the audience answer changes the stakes here, not the conclusion.** Going public makes the "never sent anywhere" claim a promise to strangers rather than a note to self, which *raises* the bar for adding a backend rather than lowering it. Firebase specifically has been raised as the likely candidate; the conditions it would have to meet are written up in `TASK-UX-REDESIGN.md` under "Out of scope" (tracked as B9). The three that matter most:

- **The promise is a one-way ratchet.** It can be tightened silently; it cannot be loosened silently. If data ever reaches a server, the copy changes *everywhere* — landing page, About page, Worth hub — **before** the feature ships, not after.
- **Adopt a server only for a feature that cannot exist without one**, and name that feature first. Cross-device is already answered, imperfectly but honestly, by the JSON backup. "It would be nice to have accounts" is not a feature.
- **If it happens, encrypt client-side before upload** so the server holds a blob it cannot read. That's the only shape in which the differentiator survives roughly intact — and note that in a client-only app, Firestore security rules are the *entire* security model, with nothing behind them.

**One more consequence of going public:** the beta itself is now the primary source of product truth. §2.2's argument — that the habit either forms or it doesn't, and speculation won't tell you which — applies to every open question in this document. The owner's own scenario-running is what surfaced D12; watching five non-family testers, ideally outside Telangana, is what will surface the next one.

---

## Design-quality issues (Apple-lens + industry best practice)

### D1. Off-palette gray remnants undermine the theme — *severity: medium, effort: low*

The `:root` palette is green/gold, but dozens of hardcoded grays from an earlier dark-gray theme survive: row borders `#1c1c1c`/`#1e1e1e`, hover borders `#444`/`#555`, hint text `#555`, toast `#2a2a2a`, hero-card gradients `#1c1a11 → #1a1a1a` (`.total-card`, `.sp-result-card` — the two most prominent surfaces in the app!), toggle track `#333`, manifest `background_color: #0f0f0f`. On the deep-green background these read as slightly "dirty" panels. *Fix:* sweep every hardcoded gray into the CSS custom-property system.

### D2. Contrast failures on the smallest text — *severity: high (accessibility), effort: low*

- `.field-hint`, `.note-text`, `.br-calc` use `color: #555` on dark green surfaces ≈ **2.3:1 contrast — clear WCAG AA failure**, on the *smallest* text in the app (10–11px). These are the "SBI avg ~8.75%", "Telangana: 4%" hints — genuinely useful content rendered nearly invisible.
- `--text-dim: #7a8a7e` lands around 4.5–5:1 — borderline for 10–11px uppercase labels used everywhere.
  *Fix:* lift hint text to at least `--text-dim`, and lift `--text-dim` itself a step for small sizes.

### D3. Emoji as the icon system — *severity: medium, effort: medium*

🏠 🚗 📈 💸 💰 ⌂ 🏦 📊 ✨ 🏛️ appear in tabs, tiles, headers, buttons. Emoji render differently on every OS, can't take the brand's gold color, and read as casual — directly against the luxe identity the palette and serif establish. Apple would never ship SF-Symbols-by-emoji. *Fix:* a tiny inline-SVG icon set (6–10 line icons, `currentColor`), keeping the single-file architecture.

### D4. Answer buried in a wall of numbers — *severity: high (core UX), effort: medium*

The loan panel renders 3 scenario cards × 8 stats + 3 custom-year cards + (opened) 3 advanced cards × 10 stats + 3 SIP cards × 3 tenures × 6 stats + 3 custom cards ≈ **100+ numbers on one screen**. The Jobs principle: give the answer, then let the curious dig. Every section should lead with one opinionated hero statement — "20-year loan: **₹43,391/mo**, total interest ₹64L" — with the comparison grid a tap away. The collapse-card pattern already in the codebase is the right tool; it's just not applied to the densest surfaces.

### D5. Nothing is a chart — *severity: medium, effort: medium*

For an app whose entire value is *compounding over time*, there is not a single graph. Milestone tables (`sp-milestones`, amortization, depreciation) make the user do the visualization in their head. One simple SVG area/line chart (corpus growth, principal-vs-interest crossover, depreciation curve) would communicate more than any table. This is the highest-leverage "delight" addition available.

### D6. Focus-loss bug while typing tranche values — *severity: high (bug), effort: low*

In `hub-disb`, each keystroke in a tranche input calls `renderLoanDisb()` → `renderDisbTranches()`, which rewrites the rows' `innerHTML` — **destroying the input mid-typing and dropping keyboard focus after every character**. Typing "50" requires re-clicking the field between digits. *Fix:* update tranche state without re-rendering the row being edited (re-render only on add/remove/blur).

### D7. iOS zoom-on-focus — *severity: medium (mobile), effort: trivial*

Inputs use 13–14px fonts (`.field input` 14px, `.cf-input` 13px). Mobile Safari auto-zooms any focused input under 16px, causing the page to lurch on every field tap — a classic mobile-web annoyance for a PWA meant to be installed on phones. *Fix:* ≥16px input font on touch widths.

> 🐛 **Shipped in Phase 0, then REGRESSED — found 2026-08-10** (`MID-PROJECT-REVIEW.md` §6.1; tracked as **R62**). The fix is a media query listing input classes **explicitly**, which means it silently fails to cover any class added later. `TASK-UX-REDESIGN.md`'s Phase 0 flagged this as a *"standing obligation, not a one-off"* and the CSS itself carries the comment *"Every new input class must be added here too."* Two later phases added classes and neither was added to the list: **`.cc-field input`/`.cc-field select`** at 14px (Phase 9, extended by Phase 14 — every Compare Cars field including the Down Payment) and **`.qf select`** at 15px (Phase 6a — `q-state`, the control that makes the app correct for non-Telangana users). **The lesson generalises past this defect:** a rule enforced only by a comment failed twice in six weeks in a codebase that is otherwise unusually disciplined about writing rules down. Where a rule is a *list that must be extended*, it needs a check, not a comment.

### D8. Keyboard & screen-reader access is near zero — *severity: medium, effort: medium*

Collapse headers, `adv-header`, `sip-header` are `<div onclick>` — unreachable by keyboard, no `aria-expanded`. Hub nav has no `tablist`/`aria-selected` semantics. Mode-toggle buttons (`₹/sft`/`Lump`) are ~20px tall — far below the 44px touch-target minimum. Only `.tile` defines `:focus-visible`. *Fix:* buttons for all clickables, ARIA states on expand/collapse and tabs, larger touch targets.

### D9. PWA promises it doesn't keep — *severity: medium, effort: low*

- **5.2 MB logo PNG** (`dhanamlogo.png`) for a 54px header image — likely multi-second first paint on mobile data; the entire rest of the app is ~144 KB.
- The service worker **never caches non-HTML assets** (the cache-first branch does `match(req) || fetch(req)` with no `cache.put`), and the logo/fonts aren't in `ASSETS` — so **offline, the logo and Google Fonts are missing** despite "offline-capable PWA."
- Google Fonts via `@import` = render-blocking chain *and* quietly contradicts "nothing is sent anywhere" (every visit pings Google). Self-hosting/subsetting fonts fixes speed, offline, and the privacy claim in one move.
- Manifest icon is an emoji-in-SVG data URI — the installed home-screen icon is a 💰 on gray, the single most brand-visible pixel on a user's phone. `background_color: #0f0f0f` flashes gray, not brand green, at launch.

### D10. Stale/inconsistent identity in exports — *severity: low, effort: low*

Excel and PNG exports are titled "APARTMENT COST ANALYZER — HYDERABAD" — the app's pre-Dhanam name. Snapshot PNG uses Georgia/Arial, not the brand fonts, and the old gray-black palette. Exports are the only artifacts users *share*; they should carry the brand.

### D11. Small trust & consistency nicks — *severity: low*

- "Reset" sits next to global-looking Export but only resets the apartment/loan hub — no scope indication.
- Hardcoded-year facts ("FY2025-26", "SBI ~8.75% (2025)") will silently go stale; they need a visible "assumptions as of…" line.
- Tax-slab constants, Hyderabad milestones, ₹100/sft premiums are invisible assumptions in otherwise-editable calculators.
- Six nav tabs overflow horizontally on phones with no scroll affordance; the active tab can sit off-screen.
- Milestone/amortization tables have no `overflow-x` wrapper at narrow widths.
- Car loan EMI re-implements the formula inline instead of calling `calcEMI` (consistency risk, not a bug today).

> ⚠️ **Third bullet promoted out of this list (2026-07-25).** "Invisible assumptions in otherwise-editable calculators" was rated *low* here because the audience was one person who knew what the assumptions were. Once the audience question was answered — general — it stopped being a nick and became a correctness bug. It is now **D13**, high severity. The rest of D11 stays low.

### D12. Comparisons mix pre-tax, post-tax and risk-adjusted numbers — *severity: high (correctness/trust), effort: low for the framing, high for the modeling*

Found on 2026-07-26 by the owner running a real scenario — defer a house purchase two years, invest the would-be EMI as an SIP — and noticing the SIP looked better than it was. Two distinct problems, and conflating them leads to building the expensive one first:

- **Framing (the serious one).** The Buy-vs-SIP and prepay-vs-SIP panels place a **risky, pre-tax** figure beside a **guaranteed, effectively tax-free** one and present the difference as though it were real. Prepaying a loan returns the loan rate with certainty and triggers no tax event; an SIP returns an uncertain amount taxed on redemption. Much of the displayed gap is an artifact of comparing two different kinds of number. **This is not fixable by adding figures** — it needs the framing changed. The distortion runs both ways: the borrow side has untaxed benefits (Section 24, 80C, old regime) the app also ignores, so naming only the SIP side's tax drag would swap one bias for its mirror image.
- **Precision (the ordinary one).** Every corpus and gain figure in the app is pre-tax, which systematically overstates what the user actually ends up with.

**The test that separates them, and the general rule this document should apply from here on:** *if the user reads only the hero number and nothing else, are they **misled**, or merely **imprecise**?* Misled ⇒ change the number or its framing; a footnote won't help, because people read numbers and skip notes. Imprecise ⇒ a dated, plainly-worded disclaimer is honest and sufficient. Redemption timing and future tax law are the second kind — the app genuinely cannot know them, and saying so is the correct answer. The comparison panels are the first kind.

⚠️ **Modeling this properly is harder than it looks and may not be worth it.** Each SIP installment carries its own holding-period clock, so a redemption splits into long-term and short-term buckets by installment date; `calcSIP` is a closed-form annuity that structurally cannot express that (only a month-by-month simulation can). And equity tax treatment changed in 2018, 2023 and 2024 — a precise post-tax figure projected twenty years out asserts both a redemption event that may never happen and rules that will certainly change. **A precisely wrong number is worse than a roughly right range, and worse than an honest "we don't model this."**

*Tracked as 6d-i (framing, ships with the prepayment tile) and R31/R32 (Phase 7) in `TASK-UX-REDESIGN.md`.*

> **Status 2026-08-10 — the serious half shipped, the ordinary half did not, and the gap is now in the wrong place** (`MID-PROJECT-REVIEW.md` §6.2). **Framing (the serious one): ✅ closed** — 6d-i's caveat sits above the Buy-vs-SIP hero and names both the SIP side's uncertainty/tax exposure *and* the loan side's ignored Section 24/80C benefits, so it doesn't trade one bias for its mirror image. **Precision (the ordinary one): ❌ still fully open on the hub where it applies most.** R32 was assessed and correctly declined (*state-and-don't-model*), and that assessment ended by saying: ship the one-sentence caveat instead. **It was never placed in Dhanam Grow.** As of today, `hub-sip` — the app's *first landing tile* — contains no occurrence of the word "tax" at all: a user typing ₹50,000/month over 20 years reads a ₹4.98 Cr corpus with nothing on screen indicating it is pre-tax. The honest disclosure exists, is written, was recommended by our own assessment, and lives only on the About page and inside a different hub's caveat. **Tracked as R63** — and note it does *not* need B10 answered, because B10 gates a computed figure, not a stated assumption. That conflation is what kept a one-paragraph fix queued behind a modeling decision for two weeks.

### D13. Regional defaults are presented as universal — *severity: high (correctness), effort: medium*

Promoted out of D11 on 2026-07-25 when the audience question was answered in favour of a general Indian user base. Stamp duty (4%), registration (0.5%), the ₹/sft premiums and the milestone schedule are Telangana values, hardcoded, with **no regional qualifier anywhere on screen**. A user in Pune or Bengaluru receives a confidently wrong total and — unlike every other issue in this document — has no way to notice: nothing looks broken, no field appears wrong, the arithmetic is internally consistent. **A wrong number delivered confidently is worse than no number.**

The fix isn't an exhaustive rate database, which would silently rot. A state selector driving stamp duty and registration, defaulting to Telangana so nothing regresses for the owner, with both values still directly editable and the active state visible beside the figures it drives, is more honest and more maintainable. *Tracked as R21/Phase 6a.*

### D14. Dhanam Car overstates the EPF deduction, understating take-home by tens of thousands/month — *severity: high (correctness/bug), effort: low–medium*

Found on 2026-07-30 by the owner comparing "Optimize My Car"'s take-home figure against their real payslip and finding it off by roughly ₹40K/month. Two distinct bugs, of different sizes:

- **The big one — EPF computed on the wrong base.** `renderCarCalc()` in `index.html` has exactly one salary-amount field, `car-basic` ("Basic Monthly Salary"), and reuses it for two different things: it's the base for annual gross salary (correct — gross for tax purposes should include Basic + HRA + Special Allowance), *and* it's the base for the EPF deduction (`basic * epfPct`, wrong — real EPF is calculated only on statutory Basic + DA, not on HRA or Special Allowance). A user who — reasonably, since there's no other field for it — enters their whole fixed pay into `car-basic` gets EPF calculated on their entire fixed pay instead of just the Basic slice of it. Since Basic is often only ~40–50% of total fixed pay in Indian salary structures, this can overstate the EPF deduction by ₹25–35K/month at upper-middle salary levels, which lands directly on the take-home figure. The field's own hint text ("Applied on basic salary") describes the intended behaviour, not the actual one, once the field is being used to hold total fixed pay rather than pure Basic.
- **The small one — no Section 87A marginal relief.** `calcIncomeTax()` in `calc.js` treats the ₹12L new-regime rebate as a hard cliff (`if (annualTaxable <= 1200000) tax = 0`). Real law has marginal relief for taxable income between ₹12,00,000 and ~₹12,70,000 that caps tax at `taxable − 1200000`; the app's naive slab math overtaxes anyone landing in that ~₹70K band by up to ~₹31K/year (~₹2,600/month).

Both bugs push the same direction — the app **overstates** deductions/tax and **understates** take-home — so they compound rather than partially cancel, which is consistent with the owner's ~₹40K/month discrepancy being explained almost entirely by the first bug, with the second contributing a smaller amount if their taxable income happens to sit in that band.

*Fix path (agreed with owner, not yet implemented):* rejected adding a second "true Basic" field, since most people don't know that split any better than they know the EPF math — it would just relocate the confusion. Instead, add a dedicated **"Monthly EPF Deduction (₹)"** input (defaulted to a reasonable estimate, fully editable) taken straight off the user's payslip, and stop deriving EPF from `car-basic` entirely. *Tracked as R33 (EPF field), R34 (marginal relief) in `TASK-UX-REDESIGN.md`.* The `car-basic` field's hint text was updated immediately (2026-07-30, ahead of the rest of this fix) to clarify it means total fixed pay, not Basic alone — *tracked as R35*.

---

## Priority map

> **Read this as the original ordering, not the live one.** Most of what follows has shipped; `TASK-UX-REDESIGN.md`'s "Remaining work" table is the authoritative view of what's left. Three items were added after the original analysis and sit **above everything still open below** — each is a real numbers-are-wrong bug or a universality gap, not a polish item:
> 
> | #   | Item                                                      | Type                  | Severity | Effort                          |
> | --- | --------------------------------------------------------- | --------------------- | -------- | ------------------------------- |
> | 0a  | D13 regional defaults presented as universal              | **Correctness**       | **High** | Medium                          |
> | 0b  | D12 comparison framing (pre-tax vs guaranteed)            | **Correctness/trust** | **High** | Low (framing) / High (modeling) |
> | 0c  | D14 Dhanam Car EPF base bug + missing 87A marginal relief | **Correctness/bug**   | **High** | Low–Medium                      |

| #   | Item                                                                                  | Type       | Severity | Effort  |
| --- | ------------------------------------------------------------------------------------- | ---------- | -------- | ------- |
| 1   | Landing reorder + naming coherence (Strategic #1)                                     | Structure  | High     | Low     |
| 2   | Worth hub w/ localStorage + change tile + projection bridge (Strategic #2, §2.1–§2.4) | Structure  | High     | High    |
| 3   | D6 tranche focus-loss bug                                                             | Bug        | High     | Low     |
| 4   | D2 contrast failures                                                                  | A11y       | High     | Low     |
| 5   | D4 hero-answer-first density reduction                                                | UX         | High     | Medium  |
| 6   | D9 PWA: logo size, SW caching, fonts, manifest icon                                   | Perf/trust | Medium   | Low–Med |
| 7   | D7 iOS input zoom                                                                     | Mobile     | Medium   | Trivial |
| 8   | D1 gray-remnant sweep                                                                 | Polish     | Medium   | Low     |
| 9   | D3 emoji → SVG icons                                                                  | Brand      | Medium   | Medium  |
| 10  | D5 charts                                                                             | Delight    | Medium   | Medium  |
| 11  | D8 keyboard/ARIA                                                                      | A11y       | Medium   | Medium  |
| 12  | D10–D11 export branding, stale-data labels, misc                                      | Polish     | Low      | Low     |

---

## Open questions for you (decisions that shape the redesign)

1. **Landing model:** reorder the existing tool tiles, or reframe as goal-based language ("Grow my money" / "Plan a home purchase")? Goal-based is the bigger swing and the more Apple-like one.
2. ~~**Persistence:** are you willing to amend "nothing is saved" to "saved only on your device"?~~ **Answered 2026-07-25: yes.** Option B approved, scoped to tier-1 inputs only (§2.1), with Option C JSON export/import shipping alongside it and all mitigations in §2.3 treated as ship conditions. Net-worth change tile and collapsed trend chart per §2.4. Accounts/backend acknowledged as a future direction and explicitly out of scope (§2.5).
3. **Loan Disbursement:** okay to demote it into Dhanam Home (keeping a deep-link tile if you want), or does it stay top-level for your own workflow?
4. ~~**Audience:** is Dhanam primarily *your* personal tool or heading toward general Indian users?~~ **Answered 2026-07-25: general Indian users**, with a public release planned after a close-circle beta. This is the most consequential answer in this list. It converts the invisible-assumptions nick into **D13** (high, correctness), makes the fonts/logo items in D9 launch-blocking rather than polish, and adds a whole class of work this document didn't originally contain — provenance, disclaimers, term definitions, orientation for people who don't already know what a perquisite is. See Phase 6 in `TASK-UX-REDESIGN.md`.
5. ~~**Logo file:** is there a source/vector version of `dhanamlogo.png`?~~ **Answered 2026-07-26: no** — compress the existing mark as-is. Shipped: 5.2 MB → 10.9 KB, plus real 512×512 `any`/`maskable` manifest icons.
6. **New (2026-07-26) — post-tax figures: on by default?** If Phase 7 ships post-tax numbers, default-off hides the more honest figure behind a control most people never touch, while default-on makes every headline figure smaller and more conditional, partially undoing the D4 density work. See B10 in `TASK-UX-REDESIGN.md`.
7. **New (2026-07-25) — backend:** Firebase has been raised for the wider-audience phase. §2.5 already draws the boundary; the additional Firebase-specific conditions (client-side encryption, `asia-south1`, security rules as the entire security model, DPDP obligations, and Firebase's default-on telemetry contradicting the no-analytics stance) are recorded under "Out of scope" in `TASK-UX-REDESIGN.md` as B9. **The privacy promise is a one-way ratchet — it can be tightened silently, never loosened silently.**
