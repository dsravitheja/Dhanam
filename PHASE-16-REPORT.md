# Phase 16 Report — Unfinished theses: the Worth bridge and the architecture mitigation

*Completed: 2026-08-11 · Implements `TASK-UX-REDESIGN.md`'s Phase 16 spec (R65–R66), closing two commitments that were made in the original analysis documents (`UX-ANALYSIS.md`, `ARCHITECTURE-ANALYSIS.md`) but never converted into R-numbers, per `MID-PROJECT-REVIEW.md` §2.2/§2.3.*

---

## What shipped

**R65 — the reverse Worth bridge, half built, half explicitly declined.** `UX-ANALYSIS.md` §Strategic-2 promised two things thirteen phases ago: *"the prepayment simulator can show its effect on your net worth curve, not a hypothetical loan"* and *"the verdict cards become personal advice instead of generic comparisons."* Both were owner-settled decisions going into this phase, not open questions — build the first, decline the second in writing.

- **The bridge (built).** `renderAdvLoan()`'s "Advanced: Extra Payments Projection" panel (`hub-apartment`) gained a closed-by-default `.collapse-card`, "What this does to your net worth" (`#adv-worth-card`), rendered by a new function, `renderAdvWorthBridge(interestSaved)`. It shows, against the user's real saved balance sheet instead of the panel's hypothetical loan:
  - A fact line: current net worth and (when recorded) the Home Loan Outstanding figure, both read straight from storage.
  - "Your Worth projection today" — Dhanam Worth's own +10-year projection, computed with the *exact same function and arguments* Worth's own hero uses, so the two numbers cannot legitimately disagree.
  - "With this plan's interest saved" — that same figure plus the interest this scenario is projected to save (the number already on screen as `#adv-hero-value`), stated as two calculations placed side by side, not a merged model — with a caveat explaining why (Worth's own debt projection uses one blended rate/tenure for *all* liabilities, not this specific loan's real terms).
  - An empty-state message with a link to Dhanam Worth when no real balance sheet is saved — never a fabricated ₹0.
- **The advice (declined, on the record).** `renderSIPComparison()` was not touched; no verdict card anywhere in the app was changed to name a winner as personal advice. The decision and its reasoning are written into `UX-ANALYSIS.md` §Strategic-2 itself (not just this report or the task tracker) — see **What was written down** below.

**R66 — client-side error visibility, the cheap option.** `ARCHITECTURE-ANALYSIS.md` recommendation #2 had been open since day one; the only `onerror` anywhere in the app was `reader.onerror` on the backup-file input. Installed as the literal first statement in `index.html`'s inline `<script>` (ahead of `BUILD_STAMP` and everything else, so init-time failures are caught too, not just post-load ones):

- `window.onerror` **and** `window.addEventListener('unhandledrejection', …)` — both, since a rejected promise never reaches the first.
- A dismissible `#err-panel` (its own element, not a reuse of `showToast()` — a toast auto-hides in 3.2s and diagnostics need to sit still long enough to read and copy) states the current `BUILD_STAMP`, the error message, source/line/column, and the stack when available, plus a "Copy diagnostics" button (`navigator.clipboard.writeText`, falling back to a hidden-textarea `execCommand('copy')` for browsers without the Clipboard API).
- **Deduped, not stacked.** The same error repeating updates the existing panel and a `(×N)` counter instead of piling up new panels; a genuinely different error replaces it and resets the counter.
- **Cannot itself throw or loop.** Every DOM-touching step is wrapped in its own `try/catch`; if the panel itself fails to build, it falls back to a single `window.alert` and gives up rather than re-entering `window.onerror`.
- **Sends nothing anywhere.** No `fetch`, `XMLHttpRequest`, `sendBeacon`, or tracking pixel — verified by `grep -n "fetch(\|XMLHttpRequest\|sendBeacon\|new Image(" index.html`, which returns only the comment stating this rule. The About page's *"open devtools, watch the Network tab — you'll see no request leave this page"* claim still holds.
- Recommendation #4 (splitting the inline `<script>`) was **not** taken, per the Phase 16 brief's explicit "pick one, not both, not a rewrite" — recorded as a decision in `ARCHITECTURE-ANALYSIS.md`'s status table, not left ambiguous.

## The one new pure function

`calcNetWorthProjection(investable, propertyVal, liabilities, cagr, debtRate, debtYears, monthlySip, years)` (`calc.js`) — extracted verbatim from `renderWorthProjection()`'s inline `projectedNet` closure. `renderWorthProjection()` now calls it (one-line body, bit-identical output for the same inputs — a refactor, not a new model), and `renderAdvWorthBridge()` calls the same function with `worthSnapshot()`'s figures at the same +10-year horizon. **This is how the two net-worth projections are guaranteed to agree**: not by cross-checking two independently-written formulas, but by there being only one formula for both call sites to call.

## Files touched

- **`calc.js`** — `calcNetWorthProjection()` added (after `calcOwnershipCurve()`, before the `module.exports` block); added to `module.exports`.
- **`index.html`**:
  - R66's error-handler IIFE installed as the first statement inside the inline `<script>`, before `BUILD_STAMP`.
  - `.err-panel` and related CSS added near `.toast`'s existing rules.
  - `renderWorthProjection()`'s `projectedNet` closure now calls `calcNetWorthProjection()` instead of computing inline.
  - `worthSnapshot()` added (before `renderWorth()`) — the sole accessor for `DS.worth` outside `hub-worth`'s own code.
  - `adv-section`'s markup gained the `#adv-worth-card` collapse-card (empty state + fact line + projection figures + caveat), between `#adv-hero` and `#adv-compare-card`.
  - `renderAdvLoan()` now shows/hides `#adv-worth-card` alongside the existing hero/compare-card show/hide, and calls `renderAdvWorthBridge(heroInterestSaved)`.
  - `renderAdvWorthBridge(interestSaved)` added (after `renderAdvLoan()`).
  - `BUILD_STAMP` already read `'2026-08-11'` (today's date) — no change needed.
- **`sw.js`** — `CACHE` bumped `apt-cost-v20` → `apt-cost-v21`.
- **`tests.js`** — `calcNetWorthProjection` added to the `require()` destructure; 5 new assertions added (see **Test count** below).
- **`tests.html`** — the same 5 assertions mirrored.
- **`CLAUDE.md`**:
  - `sw.js` cache-name mention bumped to `apt-cost-v21`/"as of Phase 16".
  - New bullet under **No backend; persistence…** documenting `worthSnapshot()` — signature, data source, null contract, one-consumer rule.
  - New bullet under **Dhanam Worth specifics** documenting `calcNetWorthProjection()` and the reverse Worth bridge (accessor, empty state, "two calculations not one model" decision, `.amounts-hidden` non-reach + closed-by-default decision, persists-nothing).
  - New **Client-side error visibility (R66, Phase 16)** section (placed before **Dhanam Worth specifics**) documenting the handler's shape, constraints, and verification method.
  - `renderWorth()`'s bullet in **Core calculation functions** extended with a `calcNetWorthProjection`/`renderWorthProjection()` line cross-referencing both new sections.
  - Manual checklist items **59** (Worth bridge — empty state, agreement with Worth's own projection, live recompute, closed-by-default, no-advice-language check) and **60** (error panel — trigger, dedupe, unhandledrejection coverage, Network-tab send check, no persistence across reload) added.
- **`UX-ANALYSIS.md`** — status header (top of file) updated with an R65-resolved note; §Strategic-2 gained a "Resolution, 2026-08-11" block directly under the two original promise bullets, recording promise 1 built (with where) and promise 2 declined (with the full reasoning), per the task's explicit "record it in the document that made the promise" instruction.
- **`ARCHITECTURE-ANALYSIS.md`** — recommendation #2's status-table row flipped ❌→✅ with what shipped and the never-sends-anything verification; recommendation #4's row reworded from "declined by default" to "declined by decision, per R66's pick-one instruction"; the "What this means" section's mitigations paragraph updated to reflect #2 shipping while #4 stays open.
- **`TASK-UX-REDESIGN.md`** — Phase 16 heading flipped ❌ NOT STARTED → ✅ SHIPPED 2026-08-11, its two bullets rewritten past tense with what was actually built/declined and an acceptance line (test count, no-browser caveat); the R65 row in the "Remaining work" table marked shipped with explicit "half built, half declined" framing (not "done in full"); the R66 row marked shipped with what was taken and what (recommendation #4) was named and left open.
- **`PHASE-16-REPORT.md`** — this file.

Not touched: any other file. No financial calculation already in the app was changed — `calcNetWorthProjection` reproduces `renderWorthProjection()`'s pre-existing formula exactly.

## Empty-state behaviour (no balance sheet saved)

`worthSnapshot()` returns `null` — never a fabricated ₹0 — under three conditions: no `DS` at all, `DS.worth` absent, or every stored asset/liability figure is zero. `renderAdvWorthBridge()` checks this first: when `null`, it shows `#adv-worth-empty` (a message plus a working `switchHub('worth')` link) and hides `#adv-worth-body` entirely — no number of any kind renders. The card itself (`#adv-worth-card`) still appears and can be expanded whenever a loan is entered in the panel above it, regardless of whether Worth has data yet, so the feature is discoverable even before a user has anything saved.

## The accessor

```js
function worthSnapshot() {
  if (!DS || !DS.worth) return null;
  // ...sums W_ASSETS/W_LIABS off DS.worth.a/DS.worth.l...
  if (!any) return null;
  return {
    assets, liabs, net, aVals, lVals,
    investable, propertyVal,
    cagr, debtRate, debtYears, monthlySip,   // falls back to PROJ_DEFAULT_* / 10 / 0
  };
}
```

It reads `DS.worth` (the persisted blob), **not** the DOM. This matters concretely: `buildWorth()` only creates the `w-a-*`/`w-l-*` input elements the first time `hub-worth` is opened in a given session, so a returning user with a saved balance sheet who opens the loan panel without visiting Worth this session has *no* `w-a-*`/`w-l-*` elements in the DOM at all — reading via `v('w-a-cash')` would silently return `0`. Reading the stored blob instead sidesteps that failure mode entirely. It is documented in both the function's own comment and in `CLAUDE.md` as the one accessor any future feature wanting the real balance sheet must go through.

## Error handler: loop/storm avoidance and the "never sends" evidence

- **Cannot loop:** `showErrorPanel()`'s body is wrapped in a single `try/catch`; the `catch` calls `window.alert` inside its *own* nested `try/catch` and does not call back into `window.onerror` or re-throw. `window.onerror`'s own body and the `unhandledrejection` listener's body are each wrapped in `try/catch` too, so even a failure inside `showErrorPanel()`'s dedupe logic can't propagate back out as a second uncaught exception.
- **Cannot storm:** a `lastKey` (message+source+line) and `errCount` pair dedupe repeats — the same error updates one panel's `(×N)` label instead of appending a new panel node each time, which is the concrete case the brief called out (a render function throwing on every keystroke).
- **Never sends anything — verification, not just a claim:**
  ```
  $ grep -n "fetch(\|XMLHttpRequest\|sendBeacon\|new Image(" index.html
  2445://    R25/6e-i). If you are tempted to add a fetch/XHR/sendBeacon call
  ```
  The only match is the comment stating the rule. There is no other network-capable API call anywhere in the new code — the panel only ever writes `textContent`/`innerHTML` to a DOM node and reads/writes the clipboard, which is local to the browser and not a network request.

## Test count

- Before this phase: `node tests.js` → 95/95.
- After: **`node tests.js` → 100/100.** 5 new assertions, all pinning `calcNetWorthProjection()`:
  1. All-zero inputs at year 0 → `0`.
  2. Year 0 with no SIP contribution → exactly `investable + propertyVal − liabilities` (no growth/decay has had time to apply — an exact equality, not an approximation, since `loanAtYear(P, r, n, 0).balance === P` algebraically).
  3. A 0%-cagr/0%-debt-rate case cross-checked against `calcSIP()` + `loanAtYear()` composed *independently* in the test itself, not just against `calcNetWorthProjection`'s own internals — so a bug shared between the extracted function and its two primitives wouldn't hide behind self-agreement.
  4. Property held flat: with investable/liabilities/SIP all `0`, the result equals `propertyVal` unchanged at a 20-year horizon.
  5. Debt fully amortized by the horizon (`years >= debtYears`) leaves only the grown investable amount — no negative liability, matching `loanAtYear`'s existing "clamped at 0" contract.
- Mirrored into `tests.html`: pre-existing count there was 67 (a known, pre-existing gap against `tests.js`'s fuller coverage — `tests.html` was already missing several sections, including all of `calcBreakevenKm`, before this phase; out of scope to backfill here). With the same 5 new assertions added, `tests.html` now runs **71/71** (verified by extracting its inline script and running it under Node with a stubbed `document`, since this environment has no browser to open the page in directly).

## What was verified, and how

- **Syntax:** the full inline `<script>` was extracted from `index.html` and run through `node --check` after every substantive edit — passes.
- **`node tests.js`: 100 passed, 0 failed**, run both before starting this phase's remaining work and after every file was touched.
- **`tests.html`'s script, extracted and run under Node with a stubbed `document.getElementById`: 71 passed, 0 failed.**
- **The never-sends-anything claim**, via the grep shown above.
- **That `calcNetWorthProjection()` is genuinely a refactor, not a behavior change**: `renderWorthProjection()`'s `projectedNet` closure is now a single-line call into the extracted function with the same argument order it always computed inline; no other line in that function changed.
- **File integrity after the connection interruption noted by the coordinator**: re-ran `node tests.js` (100/100), re-extracted and syntax-checked the inline script (clean), and grepped for the presence and single occurrence of `worthSnapshot`, `renderAdvWorthBridge`, `calcNetWorthProjection`, `window.onerror =`, and `unhandledrejection` — each appears exactly where this report describes, with no truncation or duplication.

## Deliberately left undone / could not verify

- **No browser was run at all** — not a device, not a simulator, not devtools. Every on-screen claim in this report (the error panel's appearance and dismiss/copy behaviour, the Worth-bridge card's live recompute as `adv-extra-emi`/`adv-extra-lump` change, the empty-state link actually navigating to `hub-worth`, layout at 375px) is argued from code reading and the `node`-based checks above, not confirmed visually. Manual checklist items 59 and 60 name this gap explicitly and are the first hands-on pass this feature still owes.
- **`UX-ANALYSIS.md` §Strategic-2's third bullet (verdict-cards-as-advice) remains permanently undone by design** — this is the intended outcome of the decision, not a gap to close later.
- **`ARCHITECTURE-ANALYSIS.md` recommendation #4 (light modularization) remains open**, now as a named decision rather than an oversight — out of scope for this phase per the brief's explicit "not both" instruction.
- **`tests.html`'s pre-existing coverage gap against `tests.js`** (67 vs. 95 assertions before this phase, now 71 vs. 100) was not backfilled — it predates this phase and fixing it was not part of the R65/R66 brief.
- Every other open item this phase didn't touch — R8, R23, R31 (gated on B10), the 6f beta protocol — remains exactly as `MID-PROJECT-REVIEW.md` left it.

## Code-review corrections (applied 2026-08-11, after QA)

Phase 16 was built by one agent, QA'd by a second (10/10 mechanical checks passed, including an independent confirmation that `calcNetWorthProjection()` is arithmetically identical to the inline formula it replaced), and reviewed by a third pass. One substantive problem was found and fixed; it is recorded here rather than folded silently into the diff.

**The Worth-bridge card overstated its headline, twice over.** The card's heading reads "Projected Net Worth in 10 Years." Its second line added `interestSaved` — the *whole-loan* interest saving from the 20-year prepayment scenario — straight onto the +10-year baseline, and its "Difference" line reported that same figure as the plan's effect. Two independent problems:

1. **Horizon mismatch.** For a ₹50L loan at 8.75% over 20 years with one extra EMI a year, the plan saves ₹10.92L and pays the loan off at **year 16.7**. Adding all ₹10.92L to a **year-10** projection credits a saving that does not exist yet at that date.
2. **The plan's own cost appeared nowhere.** Those extra payments cost about ₹44,186/yr — roughly **₹4.42L** paid in by year 10 — money that is not invested, and that the baseline's SIP growth implicitly still assumes is available. The card counted the benefit and none of the cost.

Both were disclosed by neither the labels nor the caveat, which explained only that the two figures were not a merged simulation. That is the same asymmetry this app already wrote a caveat about: `hub-apartment`'s Buy-vs-SIP `.sip-caveat` names the ignored benefits on *both* sides precisely so neither option looks free.

**Fixed by stating both gaps, not by modelling them** — the `state-and-don't-model` outcome this codebase reaches for (R63, R32), and no new calculation: the payoff year and the annual outlay were already computed in `renderAdvLoan()` and are now passed into `renderAdvWorthBridge()`. The second line's label names the horizon ("Plus interest saved over the full loan (through yr 16.7)"), the difference line is labelled "Interest saved by yr 16.7" rather than presented as a net-worth delta, and the caveat names the horizon gap, the cash cost, and closes by calling the second line **an upper bound on the plan's effect, not a projection of your net worth**. CLAUDE.md's checklist item 59 now pins all of this, with the worked numbers, so a future edit to the labels or horizon cannot quietly restore the overstatement.

Nothing else changed: `calcNetWorthProjection()`, `worthSnapshot()`, the empty state, and the whole of R66 were left exactly as built. `node tests.js` remains 100/100.
