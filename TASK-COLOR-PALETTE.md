# Task Brief: Color Palette Overhaul (Quiet Luxury / Private Bank)

> **Status: ✅ SHIPPED** — the palette overhaul in commit `728666e`, completed by the D1 gray sweep in `d2a7a60`. This brief is kept as the record of what was changed and why; it is **no longer a work item.**
> This implements the recommendations in `COLOR-PALETTE-ANALYSIS.md` — read that document first; this brief assumes its reasoning and only restates the actionable parts.
>
> **Held up under audit (2026-08-10, see `MID-PROJECT-REVIEW.md` §2.4).** Twelve phases of new UI later, the three-hue rule has never been broken: `index.html` contains only two hex literals outside `:root`, both duplicates of existing tokens in `<meta>`/manifest contexts. Neutral-scale extensions were added deliberately (`--border-subtle`, `--hero-grad-1/2`, `--on-accent`, `--header-grad-mid/end`) — neutrals only, no new hues, as the rules require.
> ⚠️ Note for anyone re-reading the constraints below: the test-count sanity check says *"expect 39/39"*, which was true in July 2026. The suite is now at **95** assertions. The constraint is "unchanged", not "39".

## Goal

Collapse the palette from 5 decorative hues (gold, green, red, blue, purple, plus an untokenized second purple) down to exactly 3 chromatic colors — gold (hero/emphasis), green (gain only), red (cost only) — on a true-neutral near-black base, per the "Quiet Luxury / Private Bank" direction. Fix the semantic collisions this uncovers along the way (green used for "big number" styling and export buttons; blue used for plain informational figures and as a second, incorrect "status" color).

## Hard constraints

- **CSS/token-level change only.** No financial calculation changes — `calc.js`/`tests.js`/`tests.html` are out of scope and must be untouched; re-run `node tests.js` at the end purely as a sanity check that nothing there was accidentally touched (expect 39/39, unchanged).
- **No new hues.** Per the design rules in the analysis doc, if something seems to need a 4th color, stop and flag it rather than adding one.
- Keep the existing dependency-free, single-file-plus-`calc.js` architecture — this is pure CSS custom-property and class-usage changes in `index.html`, no new files needed.
- Follow `CLAUDE.md`'s existing conventions (reuse `.panel-card`/`.collapse-card`/etc. patterns; don't introduce one-off inline styles where a shared class already does the job).

## New token values (verified — see analysis doc for contrast math)

Replace the `:root` block's relevant tokens:

```css
--bg: #0a0a0a;
--surface: #161616;
--surface2: #1e1e1e;
--surface3: #121212;
--border: #303030;
--accent: #c9a84c;        /* unchanged */
--accent2: #e8c96a;       /* unchanged */
--accent-dim: rgba(201,168,76,0.12);  /* unchanged */
--gold-shine: rgba(201,168,76,0.22);  /* unchanged */
--green: #6db87a;         /* unchanged — pending confirmation below */
--red: #e07070;           /* unchanged — pending confirmation below */
--text: #ede8df;          /* unchanged */
--text-dim: #a39d8f;
--text-mid: #c9c3b6;
--hl-bg: rgba(201,168,76,0.08);   /* unchanged */
--hl-border: rgba(201,168,76,0.35); /* unchanged */
```

**Delete `--blue` and `--purple` entirely** once every reference below is migrated — don't leave unused tokens in `:root`.

## Confirm before starting (quick — my recommendation is stated, override if you disagree)

1. **Green/red hex stay exactly as-is** (`#6db87a` / `#e07070`) — they already test well against the new neutral base; only the neutral scale and blue/purple are changing. Confirm, or specify a different green/red if you'd rather change them while everything's already being touched.
2. **Export buttons** (`.btn-green` for Export Detail/Loan Excel, `.btn-blue` for Export Combined/Add Tranche): recommended treatment is folding both into a neutral/secondary style (reuse `.btn-secondary`'s look, or a shared neutral "utility action" variant) since exporting a file isn't a financial gain or loss. Alternative: make them gold, treating export as a call-to-action worth the hero color. Pick one.

## Site-by-site remediation checklist

Work through every row; each is a small, independent CSS/markup change. (Content-matched, not line-number-matched — locations will have shifted slightly since the analysis was written.)

- [ ] `.lc-title`, `.cy-card-title`, `.adv-card-title`, `.car-card-title` (incl. the untokenized raw `#9b7fd4`), and the Car hub's "Scenario Comparison" heading → all become neutral (`var(--text-mid)`), dropping their blue/purple color entirely.
- [ ] `.ls-val.blue` usages (**"Principal Paid"** in loan scenario/custom-year/advanced cards, **"Extra per year"**) → drop the `.blue` modifier; these are plain informational figures, not statuses. Style them like the unmodified `.ls-val` (plain `var(--text)`).
- [ ] `.car-stat-val.purple` → delete the CSS rule outright (confirmed dead: no template applies this class anywhere).
- [ ] `.car-card` border and `.cb-derived-item` background/border (untokenized `rgba(124,58,237,…)`) → replace with the *exact same* gold-tinted treatment already used by `.loan-derived` (`rgba(201,168,76,.06)` background, `rgba(201,168,76,.2)` border) — this unifies two duplicate "derived value box" patterns that should always have been one.
- [ ] `.cb-derived-val` (untokenized `#c4b5fd`) → `var(--accent2)`, matching `.ld-val` (same unification as above).
- [ ] Car hub's checkbox/radio `accent-color: var(--purple)` (3 sites: `car-big-engine`, `car-has-driver`, the two `car-regime` radios) → `var(--accent)`, matching every other checkbox in the app (`.cf-chk` already uses gold — this was an inconsistency even before this redesign).
- [ ] `.btn-green` / `.btn-blue` (Export Detail Excel, Export Loan Excel, Export Combined, Add Tranche) → apply whichever treatment was confirmed above (neutral/secondary, or gold). Remove the now-unused `--blue`-based `.btn-blue` color rule if going neutral; keep one consistent button style for all "utility action" buttons.
- [ ] `.ls-val.big` and `.car-stat-val.big` (Monthly EMI, car Take-home, car-loan Monthly EMI, etc.) → change the hardcoded `color:var(--green)` in both rules to `color:var(--accent2)`. This is the fix for the EMI-shown-as-a-gain collision — `.big` should mean "the headline number," which is gold's existing job everywhere else (`.total-value`, `.sp-result-value`, `.ld-val`), not green's.
- [ ] SIP scenario card titles (Conservative/Moderate/Aggressive — currently colored blue/green/gold per-scenario in `renderSIPComparison`'s `cagrs` array) → drop the per-scenario `color` entirely; render all three titles in `var(--text-mid)`. The % and label text already differentiate them; risk tier isn't a gain/loss signal.
- [ ] `sipWins ? 'var(--green)' : 'var(--blue)'` (2 sites in `renderSIPComparison`) → `sipWins ? 'var(--green)' : 'var(--accent)'`. "Buying wins" is a favorable outcome for a different choice, not a loss — red would misframe it, and it should read as "the highlighted alternative" (gold), not a second status color.
- [ ] Once every reference above is migrated, grep the file for `var(--blue)`, `var(--purple)`, `#9b7fd4`, `#c4b5fd`, `rgba(124,58,237`, `rgba(111,163,214` — all should return zero matches. Then delete the `--blue`/`--purple` custom-property declarations from `:root`.

## Also while touching this

- Bump `sw.js`'s cache version (currently `apt-cost-v4` → `v5`) since this changes visible styling across every hub.
- Update `CLAUDE.md`'s **Styling** section: replace "forest green/gold theme" with a description of the new near-black/gold-with-disciplined-status-colors system, and add the three design rules from `COLOR-PALETTE-ANALYSIS.md` (exactly 3 hues; gold = hero only; green/red = real financial deltas only, never decoration; never color-only signaling) so future work doesn't reintroduce a fourth hue by habit.

## Acceptance criteria

- `grep` for the removed-color patterns above returns nothing; `--blue`/`--purple` no longer exist in `:root`.
- Recompute contrast for the new `--text-dim`/`--text-mid`/status colors against `--surface`/`--surface2` (reuse the same Node/WCAG-formula approach as the earlier contrast fix) — all ≥4.5:1, ideally ≥7:1 given the numbers already verified in the analysis doc.
- Visual smoke test (Playwright against `python3 -m http.server`, matching the approach used in the last PR): screenshot every hub (landing, Dhanam Home incl. all three sections, Dhanam Car, Dhanam Grow) and confirm no visual breakage — gold/green/red still read distinctly, no orphaned blue/purple pixels remain, checkboxes in the Car hub now tint gold.
- `node tests.js` still reports 39/39 passing, confirming this was a CSS-only change with zero effect on the financial math.
- Full manual checklist in `CLAUDE.md` re-run (this touches every hub's visuals).
- `CLAUDE.md`'s Styling section updated as above.

## Out of scope

Any change to financial calculations, the Phase 2–5 items from `TASK-UX-REDESIGN.md` (Dhanam Worth, density/chart work, accessibility/ARIA pass), fonts, layout/spacing, or adding any color not in the 3-hue system this task establishes.
