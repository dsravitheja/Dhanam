# Phase 18 Report — Inline `ⓘ` term definitions (R23)

*Completed: 2026-08-15 · Implements `TASK-UX-REDESIGN.md`'s R23 (Phase 6c), the highest-severity open item in that document once Phase 17/R8 shipped, since 6c was explicitly specced to build on R8's now-established focus/ARIA pattern rather than invent its own.*

---

## What shipped

**One reusable component** — `.term-info` (wrapper), `.term-info-btn` (the tap-friendly `ⓘ` trigger, a real `<button>`), `.term-info-pop` (the definition popover), and one shared JS function, `toggleTermInfo(id)` — placed at **17 terms** across every hub:

| Term | Hub / location | Notes |
|---|---|---|
| Perquisite value | `hub-car` lease panel hero | |
| The two tax regimes | `hub-car` lease panel, regime toggle | Old vs. New explained together, one popover |
| Pre-EMI | `section-disb` summary | |
| Tranche | `section-disb`, first tranche row only | See **Placement judgment calls** below |
| Step-up | Dhanam Grow, Step-up tab | |
| CAGR | `hub-apartment` Buy-vs-SIP card, Dhanam Grow Monthly tab, Dhanam Worth projection card | 3 placements, not 6 — see below |
| Corpus | Dhanam Grow Monthly tab | 1 placement, not 3 |
| Floor / Rise Charges | `hub-apartment` Detail panel | |
| Amenities / Clubhouse | `hub-apartment` Detail panel | |
| Corpus Fund | `hub-apartment` Detail panel | |
| Stamp Duty | `hub-apartment` Detail panel | |
| Registration Fee | `hub-apartment` Detail panel | |
| GST on Construction | `hub-apartment` Detail panel | |
| IRDAI Depreciation | Compare Cars' absorbed loan-detail view | |
| Investable assets + flat-property assumption | Dhanam Worth projection hero | Combined into one popover — the spec itself groups these as one bullet |

**Interaction contract**, matching the spec's acceptance criteria exactly:

- Reachable in one tap — no hover-only affordance (mobile-first audience).
- Real `<button>` triggers, reusing **R8's exact `aria-expanded` convention** rather than a second pattern.
- Only one popover open at a time — `openTermInfoId` is the single source of truth; opening a second closes whichever was already open.
- Dismissible three ways: re-tapping the trigger, tapping/clicking outside, or Escape (which also returns focus to the trigger — the standard disclosure-widget contract).
- No new hue: the glyph reuses the existing `#i-info` `<symbol>` at `--text-dim`.

## The layout bug found and fixed before it ever reached a commit

The first draft used `position:absolute` for the popover, anchored to `.term-info` (`position:relative`). Before writing any placement markup, a check of the surrounding CSS turned up that **`.panel-card` and `.collapse-card` both set `overflow:hidden`**, and nearly every one of the 17 placements sits inside one or the other. An absolutely-positioned popover is clipped by the nearest ancestor whose overflow is non-visible — so a popover opening near the bottom of a tall card (GST on Construction, near the bottom of the Detail panel's Government Charges card, was the specific case checked) would have rendered partially or fully invisible, with no error and nothing to signal the bug short of someone actually tapping it in a browser.

**Fixed by switching to `position:fixed`**, with `toggleTermInfo()` computing `top`/`left` from the trigger's `getBoundingClientRect()` at open time, clamped to stay inside the viewport horizontally and flipped to open upward when there's no room below. Fixed positioning is not contained by an ancestor's `overflow:hidden` — it escapes the containing-block chain up to the viewport — so this class of clipping is structurally impossible regardless of which card a future term ends up inside. The tradeoff: a fixed-position element doesn't move with the page, so the popover closes on scroll or resize rather than trying to reposition itself continuously; this was judged simpler and safer than the alternative.

This was caught by reading the existing CSS before writing the interaction code, not by testing in a browser (this environment has none) — worth recording as the kind of check worth doing by default before adding any new positioned UI element to a page with two different `overflow:hidden` container classes already in wide use.

## How this was built, and the third stale-worktree occurrence

Following Phase 17's own precedent, this was first attempted via a single isolated-worktree Sonnet subagent (not parallelized — R23 is an exhaustive whole-file sweep, and the project's own `TASK-PARALLEL-EXECUTION.md` explicitly warns against running two such sweeps concurrently). The subagent was briefed to verify its own base commit against the actual intended tip (`d8c0c3d`) before writing any code, per the lesson recorded in `PHASE-17-REPORT.md`.

**It did exactly that, and correctly refused to build.** Its worktree had branched from `9ea183c` (Phase 15's merge commit) — the same stale point one of Phase 17's two subagents had branched from — meaning `aria-expanded` (R8's pattern, which this task explicitly depends on extending) didn't exist anywhere in its checkout. It reported the mismatch, made no changes, and stopped. This is the desired outcome of the check the previous phase's report asked for — a subagent volunteering "my base is wrong" before writing code is strictly better than one that builds anyway and hopes for the best.

**It is also the third occurrence of the same failure in two consecutive phases** (Phase 17 had it twice — once caught by the agent, once not — and this makes three for three). At that rate, the isolation mechanism in this environment cannot currently be trusted to branch from the intended tip by default. Rather than retry a fourth time, this phase's actual work was done **directly**, with no worktree — a reasonable choice specifically because R23 is single-agent sequential work in the first place; the isolation mechanism's value (protecting a *parallel* agent from another agent's concurrent edits) doesn't apply when there's no second agent to isolate from. **Recorded in `TASK-UX-REDESIGN.md`'s status header**: if this recurs on a future phase that genuinely needs parallel agents, the mechanism itself — not just the base-commit-verification habit — needs investigating before relying on it again.

## Files touched

- **`index.html`** — the `.term-info`/`.term-info-btn`/`.term-info-pop` CSS block (near `.sip-caveat`); `toggleTermInfo()`/`closeTermInfo()` plus the document-level `click`/`scroll`/`resize`/`keydown` listeners (near `toggleCard()`); the 17 markup placements themselves, each a `<span class="term-info">` containing the trigger button and its popover, inserted as a sibling after `</label>` where the existing label carried a `for=` attribute (to avoid the info button's tap also toggling an unrelated checkbox) and inline the label text otherwise.
- **`sw.js`** — `CACHE` bumped `apt-cost-v22` → `apt-cost-v23`.
- **`CLAUDE.md`** — new **Inline term definitions (R23, Phase 18)** section (placed next to the R8 accessibility section, both being app-wide sweeps); manual checklist item **63** added; the `sw.js` cache-name mention bumped.
- **`TASK-UX-REDESIGN.md`** — status header extended with the Phase 18 paragraph (including the third-stale-worktree finding and the recommendation it produced); R23's table row and its Phase 6c section marked shipped; Phase 6's overall header and the "Remaining work" summary paragraph updated for 2026-08-15.
- **`PHASE-18-REPORT.md`** — this file.

Not touched: `calc.js`, `tests.js`, `tests.html`, `manifest.json`. No financial calculation changed anywhere.

## What was verified, and how

- **`node tests.js`: 100 passed, 0 failed** — before starting, after the initial 17-placement pass, after the `position:fixed` rework, and after every doc/integration edit. Unchanged throughout, as expected (`calc.js` untouched).
- **Syntax**: the inline `<script>` was extracted and run through `node --check` after the placement pass and again after the `position:fixed` rework — clean both times.
- **No duplicate DOM ids**: `grep -oE 'id="[a-zA-Z0-9_-]+"' index.html | sort | uniq -d` returns nothing, including after the tranche-row template change (which deliberately renders its term-info markup only for `i === 0`, specifically to avoid a duplicate-id bug a naive per-row placement would have introduced).
- **Placement count**: `grep -c 'class="term-info-btn"' index.html` → 17, matching the table above.
- **No stray `.right`/absolute-positioning leftovers** after the `position:fixed` rework: grepped for `classList.*'right'` and `term-info-pop.right` — zero matches, confirming the old clamping approach was fully replaced, not left dangling alongside the new one.

## Deliberately left undone / could not verify

- **No browser was run** — this environment has none. Every on-screen claim above (the popover actually rendering unclipped inside a `.panel-card`, the fixed-position math producing a sane on-screen location at 375px, focus genuinely returning to the trigger on Escape, tap-vs-click parity on a real touch device) is argued from code reading and the `node`-based checks only. Manual checklist item 63 names this gap explicitly, matching the precedent items 60–62 already set.
- **`R25`'s feedback composer** remains undone by design — deferred past the beta, unrelated to this phase.
- **`R31`/7a** (post-tax figures in Dhanam Grow) is now unblocked on both fronts (B10 answered in Phase 17, and Phase 6c's term-definition work — which 7a's own dependency chain implicitly assumed would exist — is now done) but not started.
- **6f** (the beta protocol) is the only item left in `TASK-UX-REDESIGN.md`'s "Remaining work" list that is neither shipped nor deliberately deferred. It is owner activity, not a build task.
