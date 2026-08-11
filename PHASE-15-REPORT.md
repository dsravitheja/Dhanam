# Phase 15 Report — Mid-project review remediation: two live defects and the doc sweep

*Completed: 2026-08-11 · Implements `TASK-UX-REDESIGN.md`'s Phase 15 spec (R62–R64), remediating the two live defects `MID-PROJECT-REVIEW.md` found on 2026-08-10 (§6.1, §6.2) and finishing its §7 documentation sweep. No financial math touched; `calc.js`, `tests.js`, and `tests.html` were not opened.*

---

## What shipped

**R62 — the D7 iOS-zoom-on-focus regression.** `index.html:505`'s `@media(max-width:600px)` block used to enumerate input classes one at a time, and that list had failed **six** separate ways, in **three** distinct modes: (1) two phases (9, extended in 14; 6a) added new input/select classes without adding them to the list (`.cc-field input, .cc-field select` at 14px; `.qf select` at 15px); (2) two rules that *were* covered by a listed selector still rendered below 16px because a more specific rule out-ranked it in the cascade (`.field.highlight input` and `.loan-field input.hl`, both `(0,2,1)` beating the list's `(0,1,1)` `.field input`/`.loan-field input`); and (3) two more — `.sip-inline-input` (`index.html:627` pre-Phase-15) and `.disb-tr-field input` (`:679`) — were listed at *equal* specificity but **declared below the media block**, so plain source order beat the list and they rendered at 14px too.

**Mode (3) was found in the Phase 15 code review, not by the mid-project review or this build pass** — both of which described the failure as four-way. It is the most important of the three for anyone later tempted to reinstate a list: it requires no forgotten class and no specificity error, only a rule declared further down the file, and it means the D7 fix had been partly illusory for the disbursement tranche fields and the Buy-vs-SIP inline inputs since those sections were written. Both are now genuinely covered for the first time — which also makes them the two fields whose rendered size actually *changes* with this phase (14px → 16px), alongside `.cc-field`, `.qf select`, and the two `.hl` rules. The owner's decision, given rather than re-derived: stop enumerating and use a catch-all instead.

```css
/* before */
@media(max-width:600px){
  /* Mobile Safari auto-zooms any focused input under 16px (D7). Every new
     input class must be added here too. */
  .qf input, .field input, .field select, .cf-input,
  .loan-field input, .cy-input, .sip-inline-input, .disb-tr-field input,
  .w-row input {
    font-size:16px;
  }
}

/* after */
@media(max-width:600px){
  /* D7/R62: this used to be an explicit selector list, and the list was the
     defect — it failed SIX ways, in three distinct modes, which is why the
     fix is a new mechanism rather than a longer list:
       (1) never added — .cc-field input/select, .qf select;
       (2) listed but out-specified — .field.highlight input,
           .loan-field input.hl, both (0,2,1) beating the list's (0,1,1);
       (3) listed but out-ORDERED — .sip-inline-input, .disb-tr-field input,
           declared BELOW this block at equal specificity, so plain source
           order beat the list. Mode (3) is the one no amount of "remember
           to add your class" diligence would ever have caught.
     …[full comment in index.html]…
     Verified safe to blanket: no input/select/textarea anywhere in this
     file sets a font-size above 16px (15px is the current max). */
  input, select, textarea { font-size:16px !important; }
}
```

Verified safe before shipping, not just asserted: no `input`/`select`/`textarea` rule in the file sets a font-size above 16px (15px is the maximum), so the catch-all can only enlarge, never shrink, anything in it. `grep -nE 'font-size:[^;]*!important' index.html` returns exactly one line — the catch-all itself — which is the check that actually matters, since a second `!important` font-size is the only thing that could defeat it.

*(Correction, made in the Phase 15 code review.)* This paragraph originally cited `grep -nE '(input|select|textarea)[^{}]*\{[^}]*font-size:1[0-9]px' index.html` as returning "exactly six rules" before and after the edit. Run literally, that pattern now returns **seven** — it matches the catch-all's own `font-size:16px`, since 16 is inside `1[0-9]`. Worse, being line-based it never saw the file's multi-line rules at all, including `.qf input, .qf select` at 15px — the exact rule R62 was filed for. The grep was a weaker check than it read as; the `!important`-count check above replaces it, and CLAUDE.md's manual checklist item 57 was rewritten to say so explicitly.

Process hardening (the half of R62 the review called "what matters most"): manual checklist item 57 states the invariant in absolute terms and names both checks (the grep above, plus a real-device/emulation focus check on four representative fields); the Styling section's paragraph is rewritten to describe the catch-all and *why* the enumeration was abandoned, replacing the "known open defect" blockquote with a statement of the shipped fix that keeps the two-phases-plus-two-specificity-failures history rather than erasing it.

**R63 — Dhanam Grow's pre-tax caveat.** One `.sip-caveat`, inserted once, immediately after `hub-sip`'s `.section-title` and above `.sip-planner-tabs` — before any of the three tabs' content, so every path into the hub (Monthly, Step-up, or Lumpsum) passes it without a click. Exact copy, verbatim from `TASK-UX-REDESIGN.md`'s Phase 7b assessment (§4), with a short bolded lead-in matching the two existing `.sip-caveat` usages' style:

> **Every figure below is pre-tax.** On redemption, equity LTCG above ₹1.25L in a financial year is taxed at 12.5% (rate and exemption as of the Union Budget 2024, effective 23 Jul 2024) — actual tax depends on when you sell, how the redemption is split across financial years, and what the law says at that time, none of which this app can know. A projection, not a promise.

**Placement decision, recorded (per the task's explicit "pick one and record it"):** once, above the tab row — not once per tab. Reasoning written into both `CLAUDE.md`'s Styling section and `TASK-UX-REDESIGN.md`'s Phase 15 section: the "read only the hero" argument for a per-tab caveat exists to guard against a reader who lands on one tab and never sees a caveat placed inside another tab's content — but placing it *above* the tab row means every tab-open path scrolls past it first, so that failure mode doesn't actually apply here the way it does for `hub-apartment`'s Buy-vs-SIP caveat (which sits inside one specific collapsible panel a user might never open). With the premise gone, the D4 density argument (state it once) wins outright.

No `.sip-caveat` CSS was touched — the component already existed (`index.html:613`, used at the Buy-vs-SIP and Compare Cars caveats). No new custom property, no new component, no calculation change: `updateSIPPlanner`/`updateStepupSIP`/`updateLumpsum` were not opened. This explicitly does not answer B10 or start R31 — a computed post-tax figure remains a separate, unstarted, gated item.

**R64 — documentation sweep.** Re-checked `MID-PROJECT-REVIEW.md` §7's full itemised list against current `index.html`/`sw.js` rather than assuming the earlier landing commit (`335508e`) got everything:

- **Already correct, verified not re-fixed:** `CLAUDE.md`'s line count (`~5,590` vs. actual 5,589 pre-Phase-15), cache name (`apt-cost-v19` matched pre-bump), "Eight call sites as of Phase 14" (confirmed exactly 8 live `renderChart()` call sites by grep, excluding the function definition and comments), `.table-scroll` count (**wrong — see the correction below**), checklist items 22 and 41 (both already read `cc-depr-chart`/`ccRenderLoanDetail()`, not the retired `cb-*` names), and the `cb-*` ID-prefix row (already marked retired with the confirming grep). `UX-ANALYSIS.md`'s "forest green + gold" line already carries a correction note (added in `335508e`) rather than being rewritten in place, matching this codebase's established pattern of leaving a historical line intact with a pointer to current truth (the same pattern `sw.js`'s own `CACHE` comment uses) — left as-is.
- **Genuinely still wrong, fixed this pass:** the `--text-faint` contradiction. `TASK-UX-REDESIGN.md`'s Phase 0 (D2, line 249) and Phase 3b-b (the step-up chart's third series, line 343) both instructed using a `--text-faint` custom property that was never created — `CLAUDE.md:195` (now the Charts section) was always correct that no such token exists. Both lines corrected in place to name the tokens that actually shipped: `--text-dim` for D2's `#555` replacement, `--text-mid`/`--text-dim` for the step-up chart's flat-SIP and total-invested series, each with a short inline correction note explaining the brief assumed a token that was never built. `PHASE-3B-REPORT.md` was deliberately left untouched, as instructed — it already documents this deviation correctly.
- **One more genuinely-stale item found and fixed, not originally in the "still open" list but caught by re-checking rather than assuming:** `TASK-PARALLEL-EXECUTION.md`'s §1 shipped-phase sentence ("Phases 1–4, 4b, 8, 8b, 9, and 10 are shipped") still omitted 11–14 even though the ⚠️ warning box immediately above it (added in `335508e`) already says the section predates those phases. Fixed with a short inline note rather than rewriting the sentence itself, consistent with that box's own framing that the inventory below it is a deliberate historical snapshot. Also updated the warning box's own "what remains" list to move R62–R64 from "still open" to "shipped 2026-08-11," since this pass's own work would otherwise leave that box stating something now false the moment it landed.
- `TASK-UX-REDESIGN.md`'s "Remaining work" heading date (checked at line 160: `## Remaining work (as of 2026-08-10, after the mid-project review)`) was **already current** — not stale, contrary to the older complaint that predated the mid-project review's own fix pass. No change needed.

**Not touched, per the task's explicit "do not renumber" instruction:** R45's double-assignment (the 6e build stamp and the Phase 10a lease hero sharing a number) — left exactly as `TASK-UX-REDESIGN.md` already notes it, deliberately.

## Files touched

- **`index.html`** — the `@media(max-width:600px)` catch-all (R62); one `.sip-caveat` inserted into `hub-sip` (R63); `BUILD_STAMP` bumped `'2026-08-09'` → `'2026-08-11'`.
- **`sw.js`** — `CACHE` bumped `apt-cost-v19` → `apt-cost-v20`.
- **`CLAUDE.md`** — the Styling section's D7 paragraph rewritten (catch-all + hardened rationale, replacing the "known open defect" blockquote with a shipped-state note); the Grow-hub "known open gap" paragraph replaced with a shipped-state note recording the once-above-the-tabs placement decision and its reasoning; manual checklist items 57 and 58 added; the `sw.js` cache-name mention opportunistically bumped to `apt-cost-v20`/"as of Phase 15" while already in the file for other edits (per the file's own "correct this line opportunistically" rule).
- **`TASK-UX-REDESIGN.md`** — Phase 0/D2 and Phase 3b-b's `--text-faint` instructions corrected in place with inline notes; the R62/R63/R64 rows in the "Remaining work" table struck through and marked shipped, in the same `~~R48~~ ✅ SHIPPED` style already used for other closed items; the Phase 15 section header and its three bullets updated from "❌ NOT STARTED" to "✅ SHIPPED 2026-08-11," each bullet rewritten past tense with what was actually decided/built and the honest note that real iOS Safari zoom behavior was not independently confirmed.
- **`TASK-PARALLEL-EXECUTION.md`** — the stale shipped-phase sentence given an inline correction note; the existing "this section is stale" warning box updated to reflect R62–R64 shipping.

Not touched: `calc.js`, `tests.js`, `tests.html`, `PHASE-3B-REPORT.md`, `UX-ANALYSIS.md`, `ARCHITECTURE-ANALYSIS.md`, `TASK-TEST-HARNESS.md`, `TASK-COLOR-PALETTE.md`, `MID-PROJECT-REVIEW.md` — all already correct or explicitly out of scope for this pass.

## What was verified, and how

- **The CSS fix's coverage:** `grep -nE '(input|select|textarea)[^{}]*\{[^}]*font-size:1[0-9]px' index.html` before the edit, to confirm 15px/14px was genuinely the ceiling (nothing above 16px exists to be wrongly shrunk by `!important`); re-run after, to confirm the same six rules are still present in source (expected — they're the ones the catch-all is meant to override, not delete) and that no seventh, larger-font rule appeared.
- **No competing `!important` rule:** grepped every `@media(max-width:...)` block in `index.html` for a second `font-size ... !important` on an input-shaped selector; found none, so the new rule has no same-specificity source-order fight to lose.
- **The caveat's placement and wording:** read the two existing `.sip-caveat` usages (`index.html:1374` Buy-vs-SIP, `index.html:1751` Compare Cars) to match markup shape and lead-in style; confirmed the inserted copy is character-for-character the sentence drafted in `TASK-UX-REDESIGN.md`'s Phase 7b assessment; confirmed `.sip-caveat`'s CSS (`index.html:613`) was not touched and no new class was introduced.
- **§7 re-verification:** re-ran the review's own named commands against the current tree rather than trusting the prior commit's summary — `wc -l index.html` (5589 pre-Phase-15), `grep -n CACHE sw.js` (`apt-cost-v19` pre-bump), a fresh `grep -n "renderChart("` pass counted by hand to exclude the definition/comment lines (8 real call sites), `grep -c table-scroll index.html` (7 — **this one was a bad check and produced a false confirmation**; see the correction below), and read checklist items 22/41 in full rather than grepping for a substring, since a stale reference could exist without matching an obvious grep pattern.
- **`node tests.js`: 95 passed, 0 failed (95 total), unchanged before and after every edit in this phase.** Run once before starting (to record the baseline) and again after the full set of changes (to confirm nothing moved). `calc.js` was never opened during this phase.

## Deliberately left undone / could not verify

- **Real iOS Safari zoom-on-focus behavior was not confirmed on a device or in Safari's own responsive-design/simulator mode — this environment has neither.** What *was* verified is the CSS mechanism that should produce that behavior: the catch-all's `!important` beats every other font-size rule on an input/select/textarea at ≤600px regardless of the other rule's own specificity (the exact failure mode that broke `.field.highlight input`/`.loan-field input.hl` under the old list), and no rule in the file sets a size that the catch-all would need to *shrink* rather than enlarge. Manual checklist item 57 names this exact gap as something a future hands-on pass must still walk.
- **The Grow-hub caveat's on-screen appearance (wrapping, spacing above the tab row, legibility at 375px) was not visually inspected in a live browser** — this environment has no browser automation available (consistent with the same limitation `PHASE-14-REPORT.md` recorded). The markup was matched structurally to the two already-shipped `.sip-caveat` instances, which are visually verified elsewhere in the app, so the risk is low but not zero.
- **R65/R66 (Phase 16 — the reverse Worth bridge and an architecture mitigation) are untouched**, as specified — out of scope for this phase.
- **R8 (accessibility sweep), R23 (inline term definitions), the rest of R25, R31 (gated on B10), and running the beta protocol (6f) all remain open**, exactly as `MID-PROJECT-REVIEW.md` left them — Phase 15's scope was deliberately narrow (R62–R64 only) and did not touch any of these.

## Test count

- Before this phase: `node tests.js` → 95/95 (unchanged handoff from Phase 14's post-review fixes).
- After every edit in this phase: `node tests.js` → **95/95**, unchanged. `calc.js`, `tests.js`, and `tests.html` were never opened, consistent with the task's explicit no-math constraint.

## Code-review corrections (applied 2026-08-11, after QA)

Phase 15 was built by one agent, QA'd by a second, and reviewed by a third pass. Four things were changed after the build agent reported done. None altered app behaviour beyond the CSS comment; all four were accuracy fixes, and they are recorded here rather than folded silently into the diff.

1. **The old selector list failed six ways, not four** — mode (3), source-order defeat of a *correctly listed* selector (`.sip-inline-input`, `.disb-tr-field input`), was missed by `MID-PROJECT-REVIEW.md` §6.1, by the build pass, and by QA. It is the strongest argument for the catch-all and the reason a list can never be made safe by diligence, so it is now stated in the CSS comment, CLAUDE.md's Styling section, and §R62 above. It also means those two fields' rendered size genuinely changes in this phase — they were never actually covered before.
2. **Checklist item 57's grep was blind to the defect it was written to catch.** The `font-size:1[0-5]px` pattern is line-based and misses every multi-line rule, `.qf input, .qf select` (15px) among them — i.e. R62's own trigger. A check that reports clean on the original bug is worse than none, so item 57 now checks that the file contains **exactly one** `!important` font-size (the catch-all), which is the only property that can actually be violated.
3. **`CLAUDE.md`'s `.table-scroll` count was 7; it is 6** (the sentence's own list names six). Pre-existing since Phase 14, but this phase claimed to have verified it — via `grep -c table-scroll`, which counts the CSS class definition as a wrapper. Found by QA. Corrected, with the counting mistake noted inline so it doesn't come back.
4. **A verification claim was made that no one could have performed.** The Phase 15 acceptance line in `TASK-UX-REDESIGN.md` said the iOS zoom fix was confirmed "by browser devtools computed-style inspection." No browser was run in this phase at all — this report's own "could not verify" section says so on the same day. Corrected to state the gap plainly. Checklist item 57's check (2) remains outstanding and is the one thing Phase 15 still owes a hands-on pass.

Also retired: `TASK-UX-REDESIGN.md`'s Phase 0 "Standing obligation" bullet, which still instructed adding every new input class to the selector list. It contradicted both the shipped code and CLAUDE.md, and it is exactly the drift R64 exists to close — struck through and marked retired rather than deleted, so the reasoning stays legible.
