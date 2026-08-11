# Dhanam — Mid-Project Review

*Written 2026-08-10, at the pause after Phase 14 shipped. Reviews `UX-ANALYSIS.md`, `ARCHITECTURE-ANALYSIS.md`, `TASK-UX-REDESIGN.md`, `TASK-TEST-HARNESS.md`, `TASK-COLOR-PALETTE.md`, `TASK-PARALLEL-EXECUTION.md`, `COLOR-PALETTE-ANALYSIS.md` and all 14 phase reports against the code actually in `index.html` (5,589 lines), `calc.js` (377), `tests.js` (653) and `sw.js` at commit `017b476`. Every claim below that could be checked in code was checked in code; the commands used are named inline so they can be re-run.*

---

## Verdict up front

**We are on track on execution and off track on sequencing.**

Of the 60 numbered work items in `TASK-UX-REDESIGN.md`, **55 have shipped and 5 remain open** — and the five that remain are, with one exception, the same five that were open on 2026-08-08, two days and three phases ago. In that window we shipped Phase 13 and Phase 14: ~1,150 lines of churn in `index.html`, all of it in `hub-car`.

That is the whole finding in one sentence. **The work that got done was done well. The work that got done was not the work the planning documents ranked highest.**

Three specific things are true at once, and the review is worth reading because they pull in different directions:

1. **Quality has been genuinely high and is improving.** The test suite went 0 → 95 assertions. Two consecutive phases (13, 14) were caught by code review before shipping, each time for a real, concrete, numbers-are-wrong bug that a QA pass with a live browser had already missed. That is a working process, not a lucky streak.
2. **Dhanam Car has absorbed 39% of all `index.html` churn and 6 of 14 phases**, while Dhanam Grow — the hub `UX-ANALYSIS.md` argued should be the *front door* — has never had a phase of its own, and Dhanam Worth has been untouched since Phase 2.
3. **The launch-blocking set has not shrunk since 2026-08-08.** `TASK-UX-REDESIGN.md` itself warned about this on 2026-08-07 ("Phase 9 shipping is not evidence that the launch-blocking set has shrunk"). It then happened twice more.

There is also one genuinely better-than-planned outcome (§4) and **two live defects found during this review** (§6), one of which is a regression against a rule the briefs explicitly flagged as a standing obligation.

---

## 1. Method

| Source of truth | What it claims | How it was checked |
|---|---|---|
| `UX-ANALYSIS.md` D1–D14, Strategic #1/#2 | 14 design defects + 2 structural gaps | Read each defect, then grepped/read the corresponding code region |
| `ARCHITECTURE-ANALYSIS.md` | 4 ranked recommendations | Counted globals, functions, inline handlers, file size; checked for error handling |
| `TASK-UX-REDESIGN.md` | 60 R-items, 13 B-decisions | Cross-checked each open item against code; verified "shipped" claims by grep |
| `TASK-TEST-HARNESS.md` | 8 pure functions, Option A | `node tests.js`; counted functions in `calc.js` |
| `TASK-COLOR-PALETTE.md` / `COLOR-PALETTE-ANALYSIS.md` | exactly 3 chromatic hues | Extracted every hex literal in `index.html` |
| 14 phase reports | what each phase shipped | Spot-checked the load-bearing claims (e.g. `grep -c 'id="cb-'` → 0) |

**Not checked:** anything requiring a live browser (chart geometry, focus behaviour, PWA install). Those stay on CLAUDE.md's manual checklist. Findings below marked *(code-verified)* were confirmed by reading source; *(inferred)* means I reasoned from the code but did not run it.

---

## 2. Scorecard — original intent vs. what exists

### 2.1 `UX-ANALYSIS.md` design defects

| # | Defect | Status | Notes |
|---|---|---|---|
| D1 | Off-palette gray remnants | ✅ Shipped | Only 2 stray hex literals remain in `index.html`, both duplicates of tokens (`#c9a84c`, `#0a0a0a`) in `<meta>`/manifest contexts. Palette discipline held perfectly across 12 subsequent phases. |
| D2 | Contrast failures on small text | ✅ Shipped | `.field-hint` now `var(--text-dim)` (`#a39d8f`), not `#555`. **But see §7** — the docs disagree with each other about whether a `--text-faint` token exists. It does not. |
| D3 | Emoji as the icon system | ✅ Shipped | `<symbol>`/`<use>` sprite, `currentColor`, `aria-hidden` |
| D4 | Answer buried in a wall of numbers | ✅ Shipped (twice) | `hub-apartment` in Phase 3, `hub-car` in Phase 10. **`hub-sip` and `hub-worth` never had this pass** — they were less dense to begin with, but this was never argued anywhere, it just didn't come up. |
| D5 | Nothing is a chart | ✅ Exceeded | Planned 3 charts, shipped 8 call sites on one shared helper with a `ResizeObserver` redraw contract |
| D6 | Tranche focus-loss bug | ✅ Shipped | And the *pattern* was documented and re-applied correctly to `cc-*` rows in Phase 9 |
| D7 | iOS zoom-on-focus | ⚠️ **Regressed** | See §6.1. The fix shipped; two later phases added input classes that were never added to its selector list. |
| D8 | Keyboard & screen-reader access | ❌ **Not started** | *(code-verified)* `aria-expanded`: 0 occurrences. `role="tablist"`: 0. `aria-selected`: 0. `tabindex`: 0. `min-height:44px`: 0. `:focus-visible`: 3 rules. 15 `<div class="collapse-header">` still not buttons. |
| D9 | PWA promises it doesn't keep | ✅ Shipped | 5.2 MB → 10.9 KB logo, fonts self-hosted, `cache.put` on miss, real icons |
| D10 | Stale identity in exports | ✅ Shipped | |
| D11 | Trust & consistency nicks | ✅ Mostly | "Assumptions as of" folded into the About provenance list rather than shipped as a standalone line — a reasonable call, recorded |
| D12 | Pre-tax vs guaranteed comparison | 🟡 Half | Framing caveat shipped in `hub-apartment` (6d-i). **`hub-sip` still carries no pre-tax statement anywhere on screen** — see §6.2 |
| D13 | Regional defaults presented as universal | ✅ Shipped | `PROPERTY_STATES`, 9 states, dated, persisted as a code only |
| D14 | Car EPF base + 87A relief | ✅ Shipped | Plus D15 (stale perquisite table) found in the same sweep |

**11 of 14 fully closed, 1 half, 1 regressed, 1 untouched.**

### 2.2 `UX-ANALYSIS.md` strategic issues

**Strategic #1 — "the front door is wrong."** ✅ **Solved, with a caveat worth watching.** The landing page is goal-framed, Grow is first, Worth second, and the naming inconsistency is gone. But the tile grid has grown from 6 to 7, and **4 of the 7 tiles now lead to home/loan destinations** (Plan a Home Purchase, Finance My Home, Buying Under Construction?, Should I Prepay My Loan?). The original complaint was "three of six tiles are loan-related." Goal-framing masks it — each of the four names a genuinely different goal — but the underlying gravity is back. Worth a deliberate look before an 8th tile.

**Strategic #2 — "Worth is the noun; the calculators are the verbs."** 🟡 **About a third built, and it stalled.** What shipped: the balance sheet, the hero, the change tile, the trend chart, the projection bridge (`calcSIP` + `loanAtYear` reading the saved sheet), export/erase/backup. What the analysis promised and does *not* exist:

- *"The prepayment simulator can show its effect on **your** net worth curve, not a hypothetical loan."* — `renderAdvLoan()` never reads `DS`.
- *"The verdict cards ('SIP wins by ₹…') become personal advice instead of generic comparisons."* — `renderSIPComparison()` never reads `DS`.

The bridge runs **one way only** (Worth reads the calculators' engines; no calculator reads Worth). That's not a bug — it was never specced as an R-item — but it means the single most-argued thesis in `UX-ANALYSIS.md` is one-third delivered, and nothing in `TASK-UX-REDESIGN.md` currently tracks the other two-thirds. **This is the largest silent gap in the project.**

### 2.3 `ARCHITECTURE-ANALYSIS.md` recommendations

| # | Recommendation | Status |
|---|---|---|
| 1 | Minimal correctness test harness | ✅ **Exceeded.** Option A shipped; 8 planned functions → 14 in `calc.js`; 0 → 95 assertions, including a bisection oracle for `calcEMI` and conservation properties |
| 2 | Basic client-side error visibility (`window.onerror`) | ❌ **Not done.** *(code-verified)* The only `onerror` in `index.html` is `reader.onerror` on the backup-file input. A stranger hitting a JS exception sees a silently dead calculator. |
| 3 | Close the Google Fonts gap | ✅ Shipped |
| 4 | Light modularization, one hub at a time | ❌ **Not done, and the numbers moved the wrong way** |

Recommendation 4 deserves its own row of evidence, because the document made a specific prediction and we blew through it:

| Metric | At analysis (2026-07-20) | Now | Analysis said |
|---|---|---|---|
| `index.html` lines | 2,888 | **5,589** | *"easily pushing this past 4,000–5,000 lines"* |
| Module-scope globals | ~8 | **38** | *"will not stay manageable as Dhanam Worth is added"* |
| Inline event-handler strings | 93 | **167** | *"particularly fragile… fails silently"* |
| Top-level functions | 63 | **118** | — |
| Files of JS | 1 | 2 (`calc.js`) | *"splitting the inline `<script>` into a handful of `<script src=…>` files grouped by hub"* |

Nine of the 38 globals are Compare Cars UI state alone (`ccCars`, `ccBuilt`, `ccForceOpen`, `ccForceClosed`, `ccOwnCurveIdx`, `ccRevealOpen`, `ccOppRevealOpen`, `ccCrossRevealOpen`, plus `carMode`). The analysis named "each new hub is a good moment to split it out into its own file" as the natural entry point — we have had four such moments since (Worth, Compare Cars, financing modes, the absorbed loan detail) and took none of them.

To be fair to the decision: recommendation 4 was explicitly ranked **last** and called "optional, lower urgency than 1–3." Not doing it is defensible. **Not doing it while also not doing #2 is less so** — those were the two mitigations for the same risk (a silent failure in a 5,600-line file with no error visibility and no type checking).

### 2.4 The other task briefs

- **`TASK-TEST-HARNESS.md`** — Option A implemented and exceeded. **The brief itself was never updated**: it still says *"Status: NOT approved for execution"* and its `calcPerquisite` test cases still pin `1800/2400/2700/3300`, the pre-2026 figures that R37 replaced. A future reader following this brief would write tests that fail — or worse, "fix" the code to match. See §7.
- **`TASK-COLOR-PALETTE.md`** — shipped (commit `728666e`), brief still says *"Status: NOT approved for execution"* and *"expect 39/39"* tests (now 95).
- **`TASK-PARALLEL-EXECUTION.md`** — accurate and useful; correctly predicted that Phase 13 "mostly doesn't parallelise" and said so instead of manufacturing agents. Its "what's actually still open" list is now stale (it predates Phases 11–14).
- **`COLOR-PALETTE-ANALYSIS.md`** — held up completely. Twelve phases of new UI and the three-hue rule never broke.

---

## 3. Where the process worked

Worth writing down, because these are the parts to protect:

1. **Code review after QA, not instead of it.** Phase 13 and Phase 14 each had a Sonnet QA agent drive a real browser *and* an Opus code-review agent working analytically. In both phases, **QA passed and review found real bugs** — the hardcoded 5-year loan tenure (Phase 14) and the flat zero-line balance series (Phase 13). Both were wrong-number bugs on screen, not style issues. The lesson is explicit in `PHASE-13-REPORT.md`: *"the original 11 assertions all pass under the exact mistake R49's spec warns against."* Live-browser QA verifies what you thought to look at; analytical review finds what you didn't.
2. **Tests as bug archaeology.** Phase 13's fix included *literally building the wrong implementation* to prove the existing tests couldn't catch it, then adding the assertion that could. That's a level of rigour most codebases with a build system don't reach.
3. **Statutory constants get dated, pinned, and postmortem'd.** R33/R34/R37 produced a written rule in CLAUDE.md ("statutory constants rot silently — date them and pin them in the same commit") that has since been followed.
4. **Owner pushback is treated as data, not as noise.** B12 → retired by R50. B13 → resolved as an explicit reveal. The Phase 14 restructure came from a single owner observation ("not every company offers a lease policy, but everyone aspires to buy a car") and was executed as a *gating* change that preserved the differentiated lease panel rather than flattening it. That was the right call and the reasoning is recorded.
5. **Security hygiene held up without being asked for.** *(code-verified)* Every path that interpolates a user-entered car name into `innerHTML` — result cards, `<option>` lists, breakeven rows, and even the chart's `aria-label` — routes through `xesc()`. Since `ccCars` is persisted and restorable from an imported JSON file, that's a real injection surface, and it is closed.

---

## 4. Where we ended up better than planned

**Phase 14's `calcOwnershipCost({ mode, … })` is a better architecture than any of the planning documents asked for, and it should be recognised as the project's best design decision so far.**

None of `UX-ANALYSIS.md`, `ARCHITECTURE-ANALYSIS.md` or the original `TASK-UX-REDESIGN.md` contains the idea. It emerged from a single owner observation and one design insight: **TCO is financing-agnostic.** Running cost, maintenance, insurance and depreciation are properties of the *car*; lease, loan and cash are capital layers on top. That insight bought four things at once:

- Three financing modes on **one** engine instead of three parallel calculators.
- The retirement of a whole duplicated section (`cb-*`) as a *migration with a parity checklist* rather than a delete.
- A cross-mode comparison (R60) that no single-mode design could have produced — the same car, three ways, directly comparable — which is a genuinely differentiated answer to a question every Indian car buyer actually asks.
- A fairness rule (B13) that generalised: the opportunity-cost reveal applies the *same* formula to whatever capital each mode ties up, so a lease's structural lack of upfront capital reads as a finding rather than a rigged comparison.

Two smaller ones:

- **The chart system is over-delivered.** D5 asked for "one simple SVG area/line chart." We have eight call sites on one helper with a `ResizeObserver` redraw contract, a node-identity check for `innerHTML`-rebuilt hosts, a `clearChart()` cache-eviction path, and a documented index-vs-value spacing trap. Every one of those was a real bug first (R11, R15, R17, R20).
- **The test suite crossed from "does it regress" into "is the model right."** The `calcOwnershipCurve` invariants — endpoint === `netCost`, endpoint gap === `netCostAfterResale` — mean the chart and the card cannot silently disagree. That's a design property enforced by a test, which is a different and better thing than coverage.

---

## 5. Where we drifted

### 5.1 Effort has concentrated on the least universal hub

*(code-verified, from `git log --numstat -- index.html`)*

| Hub | Dedicated phases | `index.html` churn | Share |
|---|---|---|---|
| **Dhanam Car** | 8, 8b, 9, 10, 13, 14 (**6**) | ~1,908 lines | **38.8%** |
| Dhanam Home | 0 dedicated (served by 0, 1, 3, 3b, 3c, 6a) | — | — |
| Dhanam Worth | 2 (**1**) | ~356 lines | 7.2% |
| **Dhanam Grow** | **0** | — | — |
| Cross-cutting (palette, PWA, icons, charts, landing, About) | 1, 3, 3b, 3c, 4, 4b, 11, 12 | — | — |

`UX-ANALYSIS.md` opened with: *"It leads with the least universal need… instead of the most universal one (growing money / knowing where you stand)."* We fixed that in the **UI** in Phase 1 and then spent the next twelve phases reproducing it in the **roadmap**. Dhanam Grow — first tile on the landing page, the hub the analysis said was the most universal need — has never been the subject of a phase. Its only open item (R31) is unstarted, and the one piece of copy Phase 7's own assessment recommended shipping was never placed there (§6.2).

**This is not an argument that Phases 9/13/14 were wrong.** They were owner-driven, tied to a real decision the owner was making, and Phase 14 in particular produced the best design in the project. It *is* an argument that the roadmap has been running on immediacy rather than on the priority order the analysis documents established, and that nobody has said so out loud until now.

### 5.2 The launch-blocking set has not shrunk in three phases

`TASK-UX-REDESIGN.md` wrote this warning on 2026-08-07, about Phase 9:

> **R21 did not lose its severity by being deferred**, and Phase 9 shipping is not evidence that the launch-blocking set has shrunk — pick up Phase 6/R21 next.

R21 was picked up (Wave 0). But the same pattern then repeated for Phases 13 and 14, and the items still open are:

| Item | What it is | Severity in doc | Reality check |
|---|---|---|---|
| **R8** / Phase 5 | Keyboard & ARIA pass | Medium | *(code-verified)* Zero progress. 15 non-button collapse headers, no `aria-expanded` anywhere, no tab semantics, no 44px targets. **"Medium" was set when the audience was one person.** B4 was answered "general audience" on 2026-07-25 and this item's severity was never revisited. |
| **R23** / 6c | Inline `ⓘ` term definitions | **High** | *(code-verified)* Zero occurrences. The doc calls it *"the highest-value comprehension work in this phase."* It is the highest-severity open item in the whole document and has been open since Phase 6 was filed. |
| **R25** / 6e | Orientation line + feedback composer | Medium | Contact link shipped; orientation line not. Composer deliberately deferred past the beta — that deferral is sound and documented. |
| **R31** / Phase 7 | Post-tax figures in Grow | Medium | Blocked on **B10**, unanswered since 2026-07-26 |
| **6f** | Beta protocol (not code) | — | Never run. Five non-family testers, prioritising people outside Telangana. |

Note what 6f being un-run means: **every priority call since 2026-07-25 has been made on intuition.** `TASK-UX-REDESIGN.md` says so itself about Phase 14 — *"Phase 14's whole premise… is market intuition, not evidence. This protocol is the instrument for converting that into a finding."* We built the feature and skipped the instrument.

### 5.3 Four owner decisions are still open and two are load-bearing

| # | Question | Open since | Blocks |
|---|---|---|---|
| **B10** | Are post-tax figures on by default? | 2026-07-26 | **R31 cannot start** |
| **B6** | Align `calcSIP`/`calcStepupSIP`'s ~1% timing gap, or leave it documented? | Phase 1 | Any future work that plots them together; a hard prerequisite for a tax layer |
| B7 | Should Worth ask before persisting? | Phase 2 | Nothing today |
| B9 | Backend/Firebase — if, when, on what terms? | 2026-07-25 | Correctly parked until Phase 6 lands |

B6 has now been open for **thirteen phases**. It is disclosed on the About page, routed around in the step-up chart, and re-confirmed as a blocker by Phase 7's assessment. It is not urgent, but "open since Phase 1" is the kind of item that becomes permanent by default.

### 5.4 Architecture debt was taken on without the mitigations that were prescribed for it

Covered in §2.3. The short version: we doubled the file, quintupled the globals, and skipped both the cheap mitigation (`window.onerror`) and the structural one (per-hub script files). Neither was ever argued down — they just weren't picked up.

---

## 6. Live defects found during this review

### 6.1 D7 (iOS zoom-on-focus) has regressed in Compare Cars and the state selector — *(code-verified)*

`index.html:505` carries the D7 fix and a comment that is, in hindsight, exactly right:

```css
@media(max-width:600px){
  /* Mobile Safari auto-zooms any focused input under 16px (D7). Every new
     input class must be added here too. */
  .qf input, .field input, .field select, .cf-input,
  .loan-field input, .cy-input, .sip-inline-input, .disb-tr-field input,
  .w-row input { font-size:16px; }
}
```

`TASK-UX-REDESIGN.md`'s Phase 0 flagged this as a **standing obligation, not a one-off**. Two later phases added input classes and neither was added to the selector:

| Class | Font size | Shipped in | Fields affected |
|---|---|---|---|
| `.cc-field input`, `.cc-field select` (`index.html:692`) | **14px** | Phase 9, extended Phase 14 | Every Compare Cars shortlist field — Type, Name, On-Road Price, Mileage/Efficiency, **Down Payment** — plus the `.cc-field` assumptions inputs |
| `.qf select` (`index.html:181`) | **15px** | Phase 6a (R21) | `q-state`, the state selector — the fix for D13 |

On an iPhone, tapping any of these lurches the viewport. Compare Cars is the hub the owner uses for real decisions, and the state selector is the control that makes the app correct for non-Telangana users — i.e. the two surfaces a beta tester outside Telangana would touch first.

**Fix:** add `.cc-field input, .cc-field select, .qf select` to that selector. One line. *(Not applied — this review is read-only by intent; filed as R62 below.)*

### 6.2 Dhanam Grow states nothing about tax, anywhere — *(code-verified)*

`TASK-UX-REDESIGN.md`'s Phase 7b assessment (2026-08-08) concluded **"state-and-don't-model"** and wrote the exact sentence to ship:

> *"This figure is pre-tax. On redemption, equity LTCG above ₹1.25L in a financial year is taxed at 12.5%… A projection, not a promise."*

Its own recommendation ends: *"**Do not build 7b.** Ship 7a's copy-only caveat (and 6d-i's, which already exists) instead."*

6d-i shipped. **7a's did not.** `grep -in "tax" ` across `hub-sip` (`index.html:1917–2103`) returns nothing. The word "pre-tax" appears exactly twice in the whole app: in the Buy-vs-SIP caveat inside `hub-apartment`, and in the About page's known-gaps list.

So the situation is: a user who opens Dhanam Grow — **the first tile on the landing page** — types ₹50,000/month over 20 years, and reads a ₹4.98 Cr corpus with no indication anywhere on screen that it is pre-tax. The honest disclosure exists, is written, was recommended by our own assessment, and lives on a page most users will never open. This is D12's "precision" half, still fully open on the hub where it applies most.

It is one paragraph of copy in a `.sip-caveat` div. The component already exists and is used twice.

---

## 7. Documentation drift (concrete list)

The docs are unusually good — `TASK-UX-REDESIGN.md` in particular is maintained with real discipline, including recording *why* decisions were reversed. The drift below is small and mechanical, but two items would actively mislead someone acting on them.

**Would mislead — fix these:**

| File | Line | Says | Actually |
|---|---|---|---|
| `TASK-TEST-HARNESS.md` | 3 | *"Status: NOT approved for execution"* | Shipped as Option A; `calc.js` + `tests.js` + `tests.html` exist |
| `TASK-TEST-HARNESS.md` | 115–118 | `calcPerquisite` expects `1800/2400/2700/3300` | R37 replaced these with `5000/7000/+3000` (Income-tax Rules 2026). **A reader following this brief would write failing tests, or "fix" correct code to match.** |
| `TASK-COLOR-PALETTE.md` | 3 | *"Status: NOT approved for execution"* | Shipped in commit `728666e` |
| `TASK-COLOR-PALETTE.md` | 12 | *"expect 39/39, unchanged"* | 95/95 |
| `CLAUDE.md` | 146 | ID convention: `` `cb-*` — car buying/loan inputs `` | Retired in Phase 14; zero live `cb-` ids. Listing it invites someone to use the prefix. |

**Merely stale — worth a sweep:**

| File | Says | Actually |
|---|---|---|
| `CLAUDE.md:20` | `index.html` is *"~3970 lines"* | 5,589 |
| `CLAUDE.md:23` | cache name *"`apt-cost-v14`"* | `apt-cost-v19` (five bumps behind) |
| `CLAUDE.md:184` | *"Six call sites as of Phase 3b… plus the car-buying resale-value curve"* | 8 call sites; the car-buying one is now `cc-depr-chart` |
| `CLAUDE.md:199` | `.table-scroll` on *"the Detail panel's… all three Grow… and the car depreciation table"* | 7 wrappers |
| `CLAUDE.md:236` (checklist 22) | lists `cb-depr-chart` among the five year-based charts | now `cc-depr-chart` |
| `CLAUDE.md:255` (checklist 41) | *"`renderCarLoan()`'s EMI now runs through `calcEMI`"*, present tense | `renderCarLoan()` no longer exists |
| `CLAUDE.md:195` | *"there is no `--text-faint` token in this codebase"* | Correct — but `TASK-UX-REDESIGN.md`'s Phase 0 and 3b-b both instruct using one. The two docs contradict each other. |
| `UX-ANALYSIS.md:9,23` | *"forest green + gold"* palette | Replaced by the true-neutral near-black "Quiet Luxury" palette |
| `UX-ANALYSIS.md:3` | *"Source: `index.html` (~2,900 lines)"* | 5,589 |
| `TASK-PARALLEL-EXECUTION.md:§1` | *"Phases 1–4, 4b, 8, 8b, 9, and 10 are shipped"* | 11, 12, 13, 14 also shipped |
| `TASK-UX-REDESIGN.md:142` | *"Remaining work (as of 2026-08-07)"* | Content is current through Phase 14; only the heading date is stale |

**One structural nit:** `R45` is assigned to two unrelated items (the 6e build stamp and the Phase 10a lease hero). The doc notes this and deliberately declines to renumber. That was the right call — but `R36` was never assigned, so there was a free number. Not worth changing now; noted so nobody "fixes" it later.

---

## 8. Recommendations

Ordered by (severity × cheapness), not by phase number.

### Do before anything else — hours, not days

**R62 — Restore the D7 selector.** Add `.cc-field input, .cc-field select, .qf select` to the `@media(max-width:600px)` block. One line, fixes §6.1. While there: convert the comment into a rule that's actually checkable — *"if you add an input/select rule below 16px, add its selector here"* — and add a checklist item that greps for `font-size:1[0-5]px` on input rules.

**R63 — Ship 7a's copy-only caveat in Dhanam Grow.** The sentence is already written in `TASK-UX-REDESIGN.md`'s Phase 7b assessment. Place a `.sip-caveat` above the corpus hero on all three Grow tabs (or once, above the tab row). This closes §6.2, closes the D12 precision half at the copy level, and **does not need B10 answered** — B10 gates a *computed* post-tax figure (R31), not a stated caveat. Untangling those two has been blocking a one-paragraph fix for two weeks.

**R64 — Doc-drift sweep.** The two "would mislead" items in §7 (both TASK-brief status headers, and especially the stale `calcPerquisite` expectations) plus the CLAUDE.md staleness list. Mechanical.

### Do next — the launch-readiness set, in the order the docs already ranked it

**R23 / 6c — inline `ⓘ` term definitions.** Still the highest-severity open item in `TASK-UX-REDESIGN.md`, and the argument for it has only strengthened: Phase 14 added *more* terms a stranger won't know (residual, capital tied up, opportunity cost, perquisite in three modes). Do it after or with R8, per the doc's own note.

**R8 / Phase 5 — keyboard & ARIA.** And **re-rate it.** It is documented as Medium; that rating predates B4 being answered "general audience" on 2026-07-25. An app that is about to be handed to strangers, with 15 keyboard-unreachable collapse headers and no tab semantics, has a High accessibility gap, not a Medium one. Phase 14 added four more collapsible surfaces (`#cc-tenure-card`, `#cc-crossmode-card`, and both reveals) — **this item grows with every phase that isn't it.**

**Answer B10.** One decision, unblocks R31, open 15 days. The doc's own lean is recorded (default-off in Grow, structural in the comparisons); if that lean still holds, saying so costs a sentence.

**Run 6f — the beta protocol.** Five non-family testers, prioritising outside Telangana, with the two named tasks ("work out whether prepaying beats an SIP", "work out whether it's cheaper to lease or finance this car"). This is the single highest-information action available and it is not a build task. Everything since 2026-07-25 has been prioritised on intuition; this converts intuition into findings, and it will produce the R23 term list empirically instead of by guesswork.

### Do deliberately, as a decision rather than a drift

**R65 — Close the Strategic-#2 loop, or explicitly drop it.** `UX-ANALYSIS.md`'s central thesis promised that Worth would make the calculators personal. One direction shipped; the other never got an R-number. Two candidate items, both small because the persistence layer already exists:

- The prepayment comparison reads `DS` to show the effect on *your* net worth, not a hypothetical loan.
- The Buy-vs-SIP verdict card reads `DS`'s investable assets.

If we don't want these — reasonable; they add cross-hub coupling that `ARCHITECTURE-ANALYSIS.md` warned about — then **write that down in `UX-ANALYSIS.md` §Strategic-2 as a decision**, so the thesis isn't left looking half-finished by accident.

**R66 — Take one of the two architecture mitigations.** Not both, and not a rewrite. Either:
- *(cheap)* a `window.onerror`/`unhandledrejection` handler that surfaces a "something went wrong — build `<BUILD_STAMP>`, copy diagnostics" toast. ~15 lines, pairs naturally with the R25 feedback composer, and closes `ARCHITECTURE-ANALYSIS.md` recommendation #2, which has been open since day one; **or**
- *(structural)* split the inline `<script>` at the next hub-sized change — `car.js` is the obvious first cut at ~39% of churn and 9 of the 38 globals.

The cheap one is the better bet right now: it directly serves the beta, where the failure mode is "a tester says it broke and we have nothing."

**Rebalance the roadmap consciously.** Not a rule against more car work — Phase 14 was excellent and the cross-mode comparison is a real differentiator. But before the next `hub-car` phase, either (a) do one Grow or Worth item first, or (b) write down why car work still outranks them. The failure mode isn't any single phase; it's that six phases in a row each looked locally justified and nobody added them up.

---

## 9. Suggested next wave

A concrete proposal, sized to a single session, that clears the cheap wins and unblocks the rest:

| Wave | Items | Why together |
|---|---|---|
| **Wave A (hours)** | R62 (D7 selector), R63 (Grow tax caveat), R64 (doc sweep) | Three unrelated one-file fixes; no dependencies; closes both live defects |
| **Wave B (decisions, no code)** | Answer B10; re-rate R8; run 6f | Costs no build time and changes what Wave C should be |
| **Wave C (build)** | R8 + R23 together, per the doc's own coordination note | The two widest sweeps; doing R23's tooltips without R8's focus/ARIA treatment creates fresh accessibility debt |
| **Wave D** | R66 (`window.onerror`) + R25's orientation line | Both are beta-readiness; both are small |

Phase 7's R31 stays parked behind B10. Phase 14's own follow-on (whatever 6f surfaces about lease-vs-loan) should be filed as new R-numbers, per the protocol's rule that findings become R-items rather than ad-hoc fixes.

---

## 10. Bottom line

**Nothing needs to be undone.** There is no phase in this project I'd reverse, no architectural decision I'd relitigate, and the one design that was invented rather than planned (`calcOwnershipCost`'s mode parameter) is the best thing in the codebase.

What needs to change is **what gets picked up next**. The planning documents already contain the right answer — R23 High, R8 growing, 6f un-run, B10 unanswered, Grow untouched — and have contained it for two weeks while three excellent phases shipped somewhere else. The discipline that made those phases good (write the reasoning down, review after QA, pin the constants) has not yet been applied to the question of *which* phase to do.

Pausing to ask was the right instinct. The answer is: **stop adding to `hub-car`, spend a day on the two live defects and the four open decisions, run the beta, and let five real users pick the next phase.**

---

*Verification commands used, for re-running this review later:*

```sh
node tests.js                                     # 95/95
grep -c "aria-expanded\|role=\"tablist\"" index.html    # 0 — R8 unstarted
grep -c 'id="cb-' index.html                      # 0 — R59 migration complete
awk 'NR>=1917 && NR<=2103' index.html | grep -ic tax    # 0 — Grow has no tax copy
grep -nE "^\.cc-field input|^\.qf input" index.html     # font sizes vs the D7 media query
grep -cE "^(let|var|const) " index.html           # 38 module-scope globals
git log --oneline --numstat -- index.html         # churn by phase
```
