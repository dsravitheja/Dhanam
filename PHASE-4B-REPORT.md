# Phase 4b Report — Phase 4 review findings

*Completed: 2026-08-08 · Executed from `TASK-UX-REDESIGN.md`'s Phase 4b spec (R26–R30), filed by the 2026-07-26 headless-Chrome review of Phase 4.*

---

## Scope this ran with

Five small leftovers from the Phase 4 review, none of which changes a number on screen: R26 (missing iOS/desktop icon links), R27 (icons exposed to screen readers with no `aria-hidden`), R28 (icon-colour code/docs disagreement), R29 (`sw.js` cache writes that could reject unhandled), R30 (one dead sprite symbol). No calculation touched anywhere — `node tests.js` stayed at **65/65** throughout.

**Deviation from the original plan worth recording:** the task table filed R27 for "inside R8's pass, not separately" (Phase 5's accessibility sweep hasn't started). It shipped standalone here instead, since it was cheap, mechanical, and R8 has no fixed start date. **Phase 5/R8 should not re-do this** — it's done.

## R26 — icon links

Added `<link rel="apple-touch-icon" href="icon-512.png">` and `<link rel="icon" href="dhanamlogo.png">` to `<head>`. Both PNGs were already in `sw.js`'s `ASSETS` precache list from Phase 4 (R5), so nothing new to precache.

## R27 — `aria-hidden`/`focusable` on every icon

Every `<svg class="icon">` usage in the file was an identical, exact string — confirmed by grep before touching anything — so this was one deterministic find/replace to `<svg class="icon" aria-hidden="true" focusable="false">`. Count at merge time: **78** (not the 70 the original finding counted, since Phase 8b/8 and Phase 9 had added more icon usages by the time this landed — the replace covers all of them since it re-ran on the current file, not a stale count). Verified no accessible name was removed: only the `<svg>` tag itself was touched, parent buttons/spans with `aria-label` or adjacent text labels are untouched.

## R28 — icon-colour code vs. docs

Kept the existing `.tile-icon, .ab-icon { color:var(--text-mid); }` pin (did not make icons inherit) — the CSS comment above `.icon` and CLAUDE.md's Icons section both previously claimed inheritance applies universally, which was true for every icon *except* these two classes. Rewrote both to state the exception explicitly and why it exists: `.tile-title` is permanently gold as a design choice (not a state), so an inheriting tile icon would be gold on every tile at all times, competing with the headline; `.action-btn.active`'s gold is a real state change, and the pin keeps that gold reserved for the text rather than doubling it onto the icon.

## R29 — `sw.js` cache writes can't throw

Added a `safePut(req, res)` helper wrapping `caches.open(CACHE).then(c => c.put(req, res))` in `.catch(() => {})`, used at both call sites (the HTML network-first branch and the static-asset cache-first-with-fill branch). Tightened the static-asset branch's guard from `res.ok` (true for `206`) to `res.status === 200`, so a partial-content response — which `cache.put` rejects on — never reaches the cache at all. Same discipline CLAUDE.md already documents for the `localStorage` layer: a failed cache write must never surface as an error, since the response has already gone back to the page by the time this runs.

## R30 — dead sprite symbol

Grepped every `<symbol id="i-NAME">` against every `href="#i-NAME"` usage (including the two dynamic `setAttribute` hrefs behind the Worth hub's hide-amounts eye/eye-off toggle). `i-x` was defined, never referenced anywhere, and deleted. Re-ran the same audit after the Phase 10 merge (below) to confirm nothing else went stale in the interim — clean.

## A note on how this actually got built

The implementing subagent's isolated worktree branched from a stale point in history (`main`, several merges behind `claude/phase-9-compare-cars`) rather than the intended branch tip — missing Phase 8b's perquisite-table fix and all of Phase 9's Compare Cars feature. Rather than cherry-pick a diff computed against the wrong base (which would have silently skipped the `svg.icon` usages Phase 8b/9 added), the five fixes were reapplied directly on the correct tip by the controlling agent, using the subagent's diff purely as a spec of *what* to change. Worth knowing for next time this pattern is used: confirm an isolated worktree's base commit before trusting its diff, don't just trust the branch name.

## Verification

- `node tests.js` → 65/65, unchanged (nothing here touches `calc.js`).
- `node --check sw.js` → syntax OK.
- Grep sweep: 0 remaining un-attributed `<svg class="icon">` usages; 0 remaining references to the deleted `i-x` symbol.
- `sw.js`'s `CACHE` bumped `apt-cost-v13` → `apt-cost-v14` (collapsed into a single bump after Phase 10's independent bump to the same value merged in — see `PHASE-10-REPORT.md`).
