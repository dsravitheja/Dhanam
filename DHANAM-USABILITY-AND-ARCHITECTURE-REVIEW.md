# Dhanam — Usability & Architecture Review

> **Historical snapshot (2026-09-18).** Its action plan became `TASK-SIMPLIFY.md`. For Dhanam Car, its recommendations (lease-first Tool A, deleting Cash, the tenure grid, the loan-balance view) were superseded by `TASK-CAR-REDESIGN.md` (2026-09-29), which is the current plan. Figures below describe the app as it was then.

*Reviewed 2026-09-18 against `main` (build stamp 2026-09-09). Covers `index.html` (6,566 lines), `calc.js`, `sw.js`, `tests.js`, and the project docs. Numbers below were measured from the source, and the Car hub's default outputs were reproduced by running `calc.js` directly.*

---

## 1. The short version

**Your instinct is right, and the source confirms it.** The app has one hub that works the way you want the whole app to work (Grow), one that is nearly there (Worth), one that is fine but over-represented on the landing page (Home), and one that has become a product-inside-a-product that nobody can finish (Car).

The pattern behind the Car problem is not a Car problem. It shows up everywhere at a smaller scale, and it comes from three habits the project has picked up over 22 phases:

1. **The app explains itself defensively instead of answering.** 28 caveat bullets averaging 37 words each, 25 field hints, 16 term popovers of 32–52 words, and an "advice-free" rule so strict that the app refuses to conclude anything. The user asked a question; the app returns an answer plus five paragraphs on why the answer might be wrong.
2. **Defaults are chosen for correctness, not for demonstrating value.** The "Why a Lease?" card, at its shipped defaults, answers *"a lease costs you ₹61,772 more than a loan."* The Company Car Lease panel, at its defaults, shows ₹0 tax saved. A first-time visitor's very first impression of the hub is that the tool has nothing for them.
3. **Every feature was added, none was removed.** The Car hub alone has three reveal buttons, three collapse cards, two charts, a tenure grid, a depreciation table, a breakeven card, and a cross-mode card stacked under one scroll — each one individually justified in a phase report, none of them justified together.

On architecture: **traffic scale is not a concern** (static, no backend, zero server cost at any user count). **Code scale is now a real concern**, but for a different reason than file size: the state lives in the DOM, hubs read each other's inputs by element id, and the documentation has grown to ~900 KB against ~4,800 lines of actual code. That last number is the one to worry about — see §4.

**What to do, in order:** decide what to cut (§3), *then* restructure (§4), *then* run the five-person beta the docs planned in July and never ran (§5). Cutting first means you won't spend effort modularizing code you're about to delete.

---

## 2. What's working — keep these

| Hub | Inputs to first answer | Verdict |
|---|---|---|
| **Dhanam Grow** | 0 (defaults render a full answer) | **The model for the whole app.** Three tabs, three inputs each, one hero number, one chart, one table. Nothing to fix. |
| **Dhanam Home — Quick Estimate** | 0 | Good first screen. Four fields, one total. The heavy Detail panel (12 toggle rows, ₹/sft-vs-lump switches) is correctly hidden behind a button. |
| **Dhanam Worth** | 1+ (needs real data) | Right concept, right position (nav #2, landing card). The empty state is the only weak point — see §3.4. |
| **Privacy claim** | — | "Open devtools, watch the Network tab" is true and checkable. Genuinely differentiating. Keep it absolute. |
| **`calc.js` + 117 tests** | — | Pure, DOM-free, Node-runnable, with a bisection oracle for `calcEMI`. This is the best-engineered part of the codebase and the foundation for everything in §4. |
| **Live recalculation, no submit buttons** | — | Already the "it just works" quality. Don't lose it in a rewrite. |

The Grow hub is proof that the team knows how to build the thing you're asking for. The task is to hold every other hub to the Grow standard.

---

## 3. Usability findings, by severity

### 3.1 The Car hub is three products fused into one scroll — *high*

**What a first-time visitor actually sees** when they tap "Work Out My Next Car" (Loan mode is the default):

1. A card titled **"Why a Lease?"** — for someone who chose *Loan* — whose default answer is that a lease is ₹62K *worse* than a loan, followed by a 90-word note mentioning "§87A rebate/marginal-relief effect near ₹12L–₹12.7L taxable income (D17)".
2. A Loan / Company Lease / Cash mode selector.
3. Two blank car rows asking for **on-road price from a dealer quote** and **mileage (kmpl)** or **efficiency (kWh/100km)**. Nothing renders until both are filled for at least one car. Most people don't have a dealer quote when they're "working out their next car," and almost nobody knows an EV's kWh/100km — Indian EV marketing quotes range in km and battery in kWh.
4. A collapsed **Assumptions** card with **17 fields** (petrol price, home charging rate, public charging rate, city km, highway km, ICE highway multiplier, EV highway multiplier, ICE maintenance, EV maintenance, ICE insurance %, EV insurance %, IDV depreciation %, lease rate, loan rate, residual %, term, opportunity-cost CAGR).
5. Then, once a car is entered: a caveat, a hero, a cost-over-time chart with a car selector, **"Reveal resale-adjusted net cost (forecast)"**, **"Reveal opportunity cost of tied-up capital (forecast)"**, a collapsed tenure grid, a depreciation table with a loan-balance overlay chart, a collapsed **"Lease vs. Loan vs. Cash — this car, three ways"** card with a third reveal button, a breakeven card, a collapsed crossover chart, ranked result cards each with its own nested collapse, and **13 caveat bullets** (~500 words).

That is ~50 inputs, 3 charts, 3 reveals, 6 collapse cards, and ~1,000 words of explanatory copy for a hub whose landing tile promises *"Compare cars, and loan, lease or cash."* You lost interest after two minutes because there is nothing to finish — there is no point at which the hub says "here is your answer."

**Specific defects found in the source:**

- **Internal project IDs leak into user-facing copy.** `#lg-hero-note` ends with "(D17)". A caveat bullet in Compare Cars ends with "(Phase 22)". These are references to `UX-ANALYSIS.md` finding numbers and phase reports — meaningless to a user and a sign the doc-driven process has become the product's voice.
- **A label contradicts its own hint.** The field is labelled **"Basic Monthly Salary (₹)"**; the hint underneath says *"Total fixed pay per month (Basic + HRA + Special Allowance combined), not Basic alone."* The label should just say "Monthly Fixed Pay" (which is what the `lg-basic` field, 300 px above it, already says).
- **The lease answer is non-monotonic in income, and nothing explains it.** Reproduced from `calc.js` at the shipped car (₹15L, 4 yr, 10%/9%, 10% residual):

  | Monthly fixed pay | Derived marginal rate | Lease advantage over loan |
  |---|---|---|
  | ₹1,00,000 (default) | 0% | **−₹61,772** (loan wins) |
  | ₹1,25,000 | 26.6% | +₹3,28,228 |
  | ₹1,50,000 | 17.4% | +₹1,92,533 |
  | ₹2,00,000 | 25.4% | +₹3,10,235 |
  | ₹3,00,000 | 31.2% | +₹3,94,838 |

  The dip at ₹1.5L is the §87A marginal-relief band and is *correct law*. But the first person who nudges the salary field up from ₹1.25L to ₹1.5L watches their saving drop by ₹1.36L and concludes the tool is broken. The copy tries to pre-empt this with the "§87A … (D17)" note, which is exactly the wrong fix: a paragraph of tax code instead of a one-line, inline "at this income you're in the rebate taper — the saving dips here and recovers above ₹1.6L" shown *only when it applies*.
- **The default salary makes the hub's headline feature moot.** ₹1,00,000/mo fixed pay is below the tax threshold under the new regime. A company car lease is not offered at that pay grade. The default should be a salary at which a lease is actually plausible (₹2L+), so the card demonstrates the mechanism instead of a zero.
- **"Reveal" is a UI pattern invented to avoid a decision.** Three buttons in one hub say "Reveal X (forecast)". The docs explain that resale value is an IRDAI schedule, not a market prediction, so it shouldn't be a default headline. That is a reasonable *editorial* stance. But the user-facing result is three mystery buttons whose labels don't say what they'll show. Either show the figure with a label ("est. resale value") or don't compute it. A button that reveals a number you've decided not to stand behind is the worst of both.
- **Cash mode adds a third path with almost no distinct value.** In cash mode `emi = 0`, `capital = price`, `taxSaved = 0`. Its only unique output is the opportunity-cost reveal. That's one line in a deep-dive table, not a top-level mode.

**Recommendation — split the Car hub into two tools, each with one question and ≤4 inputs to a full answer:**

**Tool A: "Car loan or company lease?"**
- Inputs: car on-road price, monthly fixed pay, regime (new/old). Three fields. Ship with defaults where a lease is plausible.
- Answer: one hero ("Lease saves you ₹3.1L over 4 years" or "Loan is cheaper by ₹62K — at this income there's no tax to shield"), then **three line items** (EMI difference, tax saved, residual buyout). That's the whole first screen.
- Deep dive (collapsed, one button): the current Company Car Lease panel for people reconciling against a payslip (EPF, bonus, driver, engine size, scenario cards). Keep every bit of its depth here — the docs are right that it's the differentiated feature. It just can't be the first thing anyone sees.

**Tool B: "Which car costs less to own?"**
- Inputs per car: name, fuel type, on-road price (or ex-showroom — say which), and **one efficiency field in the unit people actually know**: kmpl for petrol/diesel; for EVs ask "claimed range (km)" and "battery (kWh)" and derive kWh/100km, or ask "km per kWh" with a hint. Prefill two example cars so the ranking renders on first paint.
- Answer: ranked cards with net cost over N years and ₹/km. One chart (cost over time). Done.
- Deep dive (collapsed): assumptions (trimmed — see below), the cross-mode table, breakeven, resale estimate as a labelled column rather than a reveal.
- **Cut from the default view entirely:** the opportunity-cost reveals, the tenure grid, the depreciation table + loan-balance overlay, the crossover chart, the per-card nested collapses. Move what survives into a single "Explore further" panel; delete the rest. The tenure grid and the loan-balance overlay were migrated from a section the owner already decided to retire ("a commodity every bank site has") — they survived the retirement by moving rooms.
- **Trim the assumptions card from 17 fields to ~7** for the default view: petrol price, home charging rate, annual km, term, loan rate, lease rate, residual. Highway multipliers, per-type maintenance, per-type insurance %, IDV depreciation, public charging, opportunity CAGR go into an "advanced" sub-section or become fixed constants documented on the About page.

### 3.2 The app over-explains everywhere — *high*

Measured from the markup (static content only; dynamically rendered copy adds more):

| Hub | Words of visible copy | Inputs | Collapse controls | Caveat blocks |
|---|---|---|---|---|
| Car | **2,730** | 30 static + per-car rows | 10 | 3 (13 bullets) |
| Home | 1,231 | 46 | 20 | 3 |
| About | 955 | 0 | 0 | 2 |
| Worth | 463 | 5 | 2 | 0 |
| Grow | 398 | 10 | 0 | 1 |

Grow has the fewest words and is the hub that works. That is not a coincidence.

The root cause is a principle in `DECISIONS.md` — *"state, don't model"* and *"advice-free copy"* — applied without a ceiling. The intent (don't fabricate precision, don't tell people what to do) is sound. The execution has become: for every number, state every assumption behind it, in a bullet, in full sentences, on the same screen. Users experience this as noise, and noise is what makes people leave after two minutes.

**Recommendation — a copy budget per screen, enforced in review:**
- **Hero:** one number, one sentence of context. No "forecast, not a promise" on the hero — put it once on the About page and once in a collapsed "Assumptions & limits" panel.
- **Field hints:** ≤8 words, only where the label is ambiguous. "Copy the employee PF line straight off your payslip — EPF applies to Basic + DA only, not your full fixed pay" becomes "From your payslip's PF line".
- **Term popovers:** ≤20 words. Current ones run 32–52. A popover is a definition, not an essay.
- **Caveats:** one collapsed "Assumptions & limits" panel per hub, plain list, ≤10 words per line. The long-form reasoning already lives in the About page's provenance list — link to it, don't duplicate it.
- **Zero internal references.** Add a check to the manual test list (or a grep in CI, §4): no `(D\d+)`, `(R\d+)`, `(B\d+)`, `Phase \d+`, "tier-2", or `§` outside the About page ever appears in rendered text.

### 3.3 Landing page: six doors, four into the same room — *medium*

Of six tiles, four (`Plan a Home Purchase`, `Finance My Home`, `Buying Under Construction?`, `Should I Prepay My Loan?`) go to `hub-apartment`, and two of those (`Finance My Home`, `Should I Prepay`) land on the same Loan Analysis panel. `UX-ANALYSIS.md` flagged this drift twice (§Strategic-1 in July, §Strategic-3 in August); goal-framed titles masked it rather than fixing it.

There are also two orientation lines saying the same thing back-to-back: *"What do you want to do? Everything updates live as you type…"* immediately followed by the dismissible *"First time here? Pick a goal below, type in your numbers, and watch everything recalculate live."*

**Recommendation:** four tiles, one per hub, in nav order — Worth (card, as now) · Grow · Home · Car. Home's three panels are already reachable inside the hub via the accordion buttons; the deep-link tiles add doors, not value. Keep one orientation line.

### 3.4 Worth's empty state gives a new user nothing to do — *medium*

Worth is correctly positioned as the retention surface, but a first-time visitor sees a hero showing "—", an invitation, and a balance sheet of empty rows. The projection card is hidden until a field is non-zero. There is no first-run value.

**Recommendation:** on first open, show the projection card with illustrative defaults (e.g. ₹5L investable, ₹10K/mo SIP) and a hero reading "Add your balances above to make this yours." The user sees what the hub *does* before committing data. Grow already works this way.

### 3.5 Naming uses three systems at once — *low, cheap*

- Brand names: Dhanam Worth / Grow / Home / Car (nav)
- Goal names: "Grow My Money", "Work Out My Next Car" (tiles)
- Section names: "Company Car Lease — Tax Analysis", "Compare Cars — Cost of Ownership", "Dhanam Grow — SIP Planner" (in-hub headers)

Pick brand names for nav and hub headers, goal phrasing for tile sublines only. The in-hub section headers should read as questions ("Which car costs less to own?"), matching §3.1.

### 3.6 Smaller items

- **Home Detail panel:** 12 toggle rows, each with a checkbox, a label, sometimes a ₹/sft-vs-lump switch and two inputs. It's behind a button, so acceptable, but "East Facing Premium (₹100/sft)" and "Corner Facing Premium (₹100/sft)" hardcode the rate in the label while every other row has an editable rate — inconsistent.
- **Loan panel** has both a "Buy-vs-SIP" comparison and an "Advanced: Extra Payments Projection" with a "What this does to your net worth" bridge nested inside. Three layers of nesting inside a panel inside an accordion. Cap nesting at two levels: panel → one collapse.
- **Term popovers** close on any scroll. On mobile, tapping ⓘ then trying to read a 50-word popover that vanishes when your thumb moves is frustrating. Shorter popovers (≤20 words) make this a non-issue.
- **"Reset Home Inputs"** is the only reset in the app. Either every hub gets one or none does.
- **`#lg-hero-note`** contains "(currently )" with an empty span at first paint — a visible rendering artefact until JS fills it.

---

## 4. Architecture

### 4.1 What scales fine (don't touch)

- **Static hosting on GitHub Pages.** Zero marginal cost per user, no attack surface, no ops. Handles 10 users or 10 million identically. `ARCHITECTURE-ANALYSIS.md` got this right and it still holds.
- **No backend, local-only persistence.** Correct for the privacy positioning. Adding accounts/sync is a separate product decision (already parked in your notes as local-first vs. zero-knowledge sync) and isn't needed for beta.
- **`calc.js` as a pure, tested module.** Extend it; don't restructure it.
- **The service worker / PWA shell.** Works. The manual `CACHE` + `BUILD_STAMP` double-bump is a chore that tooling removes (below).

### 4.2 What doesn't scale (measured)

| Metric | July 2026 (ARCH-ANALYSIS) | Aug 2026 (MID-REVIEW) | Now |
|---|---|---|---|
| `index.html` lines | 2,888 | 5,589 | **6,566** |
| Module-scope globals | ~8 | 38 | **40** |
| Inline `on*=""` handler strings | 93 | 167 | **191** |
| Top-level functions | 63 | 118 | **133** |
| Largest render function | — | — | **146 lines** (`renderCarCompare`) |
| Doc bytes / code bytes | — | — | **~4 : 1** (912 KB docs, ~230 KB `index.html`) |

`ARCHITECTURE-ANALYSIS.md` recommended in July: "don't restructure as a prerequisite for launch." That was the right call at 2,888 lines with no tests. The two conditions that made it right have both flipped: tests exist now, and the file has more than doubled with cross-hub coupling the July doc predicted but hadn't seen yet. The four problems, in order of how much they'll hurt:

**1. State lives in the DOM, and hubs read each other's DOM by id.** There is no data model. Every `render*` function calls `v('some-id')` on 10–30 inputs at render time. Since Phase 22, `renderLeaseGlance()` (Car, top of page) reads `cc-years`, `cc-lease-rate`, `cc-loan-rate`, `cc-residual-pct` (Compare Cars, bottom of page) and `car-big-engine`, `car-has-driver` (lease panel, middle, hidden in Loan mode). `ccOwnershipInput()` reads `car-basic`/`car-regime` from a panel the user may never have opened. Renaming one id breaks a feature in a different section with no error until someone notices a wrong number. Modes are `display:none` toggles over one shared DOM. This is the coupling the July analysis warned about, and it has arrived via legitimate "single source of truth" refactors — which is precisely why it's hard to see as a problem.

**2. Rendering is `innerHTML` template strings with inline closures.** The D6 bug class (rebuild a row from its own `oninput` → focus lost mid-keystroke) is structural, not incidental. It's currently held off by a rule in `CLAUDE.md` ("never rebuild an input row's innerHTML from its own oninput") that every future contributor has to know. Rules that substitute for structure work until the person who wrote them isn't in the room.

**3. The documentation is now the main cost of change.** `CLAUDE.md` (13 KB) lists 11 cross-cutting invariants and a "read before you touch X" table pointing into `ARCHITECTURE.md` (99 KB). `DECISIONS.md` has ~40 "⚠ don't" entries. `TASK-UX-REDESIGN.md` is 251 KB. A contributor — human or AI — touching the Car hub is expected to load roughly 150 KB of prose before editing 500 lines of code. Three observable consequences: (a) internal IDs leaking into user copy (§3.2), (b) phases that ship with three review passes and a 12 KB report for a copy-and-sequencing change (Phase 22), and (c) a "Remaining work" table that the mid-project review says has not shrunk in three phases. The docs were written to make change safe; at this size they make change slow, and slow change is why the beta protocol from July was never run.

**4. Test coverage stops at `calc.js`.** 117 assertions on pure functions, 68 manual checklist items for everything DOM-coupled, no CI. The render layer — where §3's usability defects and the Phase 13/14 wrong-number bugs actually live — has no automated check.

### 4.3 Recommendation: prune → modularize → automate, in that order

**Step 0 — Prune first (§3).** Delete before you move. Every feature cut in §3.1 is a file you don't create in step 1.

**Step 1 — ES modules with Vite, static output, same hosting.**

```
src/
  calc/            ← calc.js split by domain: loan.js, tax.js, car.js, sip.js, worth.js
  ui/              ← chart.js, collapse.js, term-info.js, format.js, toast.js
  state/           ← store.js (one plain object per hub) + persist.js (dhanam.v1 read/write)
  hubs/
    grow/          ← grow.html (template), grow.js, grow.css
    worth/
    home/
    car/
      loan-vs-lease.js
      compare.js
      lease-detail.js     ← the payslip panel
  main.js          ← hub router + init
public/            ← fonts, icons, manifest
index.html         ← shell only
```

- **Vanilla JS is fine.** You don't need React or Preact for this; the app has no complex component tree. What you need is modules, a state object per hub, and event delegation instead of 191 inline handler strings. If you later want a reactive layer, Preact + signals is the lightest fit — but decide that after step 0, not before.
- **Each hub owns its state.** `carState = { price, fixedPay, regime, cars: [...] }`. Render functions take state and return markup; input handlers update state and re-render. No hub reads another hub's DOM. Cross-hub needs (Worth snapshot in the Loan panel) go through an explicit function on the other hub's module — `worthSnapshot()` already has this shape; make it the rule, not the exception.
- **Vite PWA plugin** replaces the hand-bumped `CACHE`/`BUILD_STAMP` with a content-hashed build. The 22.1 hotfix ("fresh HTML shell against stale cache-first `calc.js`") can't recur.
- **GitHub Actions** builds on push to `main` and deploys `dist/` to Pages. The repo stays public or private independently — you already noted this.
- **Budget: this is a two-to-three-week effort, one hub at a time, Grow first** (smallest, cleanest, proves the pattern), Car last (biggest, and §3 will have shrunk it).

**Step 2 — Tooling that catches what the docs currently try to prevent by rule.**
- **ESLint** (`no-undef`, `no-unused-vars`, `no-implicit-globals`) — catches the global-namespace risk the docs describe in prose.
- **Vitest** for `calc/` (port the 117 tests as-is) **plus jsdom render tests** per hub: "hub loads with defaults and renders a non-empty hero," "typing in field X updates hero Y," "no `(D\d+)|Phase \d+` in rendered text." Ten to fifteen such tests replace most of the 68-item manual list.
- **Playwright smoke** (5 tests, one per hub, run in CI): open, type one value, screenshot. Catches the "silently dead calculator" case with a real browser.
- **A copy lint**: a test that greps rendered HTML for internal IDs and for any single visible text node over ~60 words outside the About page.

**Step 3 — Collapse the docs to what a contributor actually needs.**
- `README.md` — what it is, how to run, how to test, how to deploy. One screen.
- `ARCHITECTURE.md` — ≤300 lines. Folder layout, state-per-hub rule, how persistence works, how to add a hub. Everything currently in the 99 KB version that explains *history* moves out.
- `DECISIONS.md` — keep, but only entries that still constrain future work; ≤1 line each. Most "⚠ don't" entries become either a test (statutory constants pinned, no outbound requests) or irrelevant after step 1 (focus-loss rule, chart-host rule, 16px catch-all).
- `docs/history/` — every `PHASE-*-REPORT.md`, `TASK-*.md`, `UX-ANALYSIS.md`, `MID-PROJECT-REVIEW.md`. Archived, linked from README, never required reading.
- `CLAUDE.md` — ≤60 lines: run/test commands, the folder rule, the copy budget from §3.2, the three or four invariants a test can't express (privacy, advice-free, statutory dating).

Target: a new contributor reads ≤400 lines of prose before their first PR. Today it's several thousand.

### 4.4 On "more users and needing to scale"

Concretely, for the public beta:
- **Hosting:** nothing to do. Pages will serve any traffic you'll see.
- **Analytics:** you've already scoped the privacy-friendly options (GitHub traffic tab, Plausible/GoatCounter, Sentry). One thing to decide explicitly: the About page currently promises *"you'll see no request leave this page."* Any analytics script, however privacy-friendly, breaks that literal claim. Either keep the claim and use only GitHub's traffic tab, or soften the claim ("no data you enter ever leaves this page") and add a single disclosed script. Don't do both.
- **Feedback loop:** the `mailto:` link and the on-screen error panel are the right shape for beta. The Copy-diagnostics button on the error panel already includes `BUILD_STAMP`; keep that.
- **Accounts/sync:** not a beta question. Revisit only if beta users ask for cross-device — and if they do, your existing zero-knowledge-sync note is the right frame.

---

## 5. The instrument you haven't used

`TASK-UX-REDESIGN.md` specified a beta protocol (item "6f") in July 2026: five non-family testers, prioritising people outside Telangana, watched using the app. `MID-PROJECT-REVIEW.md` §5.2 noted it was never run, and that *"every priority call since 2026-07-25 has been made on intuition."* Phase 22 was the first phase sourced from a non-owner user — and that feedback ("too complicated", "what people want is lease vs loan") matches what you're telling me now.

Your own two-minute drop-off is the second data point. Before spending the §4 effort, get three more:

- **Five people, 20 minutes each, screen-recorded, no help from you.** Give each one task per hub ("find out what a ₹15L car costs you on a loan"; "see what ₹10K/month becomes in 15 years"). Stopwatch **time to first meaningful number** and count **where they stop scrolling**.
- **Prediction to test:** Grow will land under 15 seconds; Car will exceed two minutes or be abandoned. If that's what you see, §3.1 is confirmed and you have a video to show the next person who proposes a fourth reveal button.
- **Define the launch metric now:** *time to first answer ≤ 20 seconds on every hub, with zero prior inputs.* Grow and Home Quick Estimate already pass. Worth and Car don't. That is the whole gap.

---

## 6. Priority summary

| # | Item | Effort | Impact |
|---|---|---|---|
| 1 | Strip internal IDs from user copy; fix "Basic Monthly Salary" label; fix "(currently )" artefact | hours | Trust |
| 2 | Car: split into "Loan or lease?" (3 inputs) and "Which car?" (prefilled); move everything else behind one "Explore" panel; delete the rest | days | **Core** |
| 3 | Copy budget across all hubs (§3.2 limits); one collapsed "Assumptions & limits" per hub | days | Core |
| 4 | Landing: 4 tiles, one orientation line | hours | Medium |
| 5 | Worth: illustrative defaults on empty state | hours | Medium |
| 6 | Run the five-person beta (§5) | 1 week elapsed | Decides 7 |
| 7 | Vite + modules + per-hub state, Grow first | 2–3 weeks | Maintainability |
| 8 | ESLint, Vitest render tests, Playwright smoke, CI deploy | days (alongside 7) | Safety net |
| 9 | Docs collapse to README + short ARCHITECTURE + short DECISIONS + archive | days | Velocity |

Items 1–5 are product decisions you can make and ship this week in the current codebase. Item 6 tells you whether they worked. Items 7–9 are what make the next 20 phases cheaper than the last 22.
