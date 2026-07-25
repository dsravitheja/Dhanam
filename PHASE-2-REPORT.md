# Phase 2 Report — Persistence, Dhanam Worth & the D1 Palette Sweep

*Completed: 2026-07-25 · Executed from `TASK-UX-REDESIGN.md` (Phase 2a/2b/2c/2e/2f with B2 = yes, plus D1 out of Phase 4) and the persistence design in `UX-ANALYSIS.md` §2.1–§2.5.*

---

## Decisions this ran with

- **B2 — persistence:** approved. **Option B** (localStorage), scoped to **tier-1 data only**, with **Option C** (JSON export/import) shipping in the *same* pass rather than deferred, and every mitigation in §2.3 treated as a ship condition rather than a nicety.
- **Session scope:** the "Worth goes live" slice — palette cleanup, persistence primitive, then the Worth hub with the change tile and backup controls. The trend chart and projection bridge were **deliberately cut** and are tracked as R3/R1. Rationale: the balance sheet, the storage layer and the delta have to be right first; the chart and projections are read-layers over the same `history` data and add nothing to the risk of getting the foundation wrong.
- **Change tile design:** its own card (not a footnote on the hero), red/green with an arrow, per your request.
- **Accounts/backend:** acknowledged as a future direction, explicitly out of scope, and recorded in §2.5 with a "don't half-build it" constraint.

---

## Documentation first — expanding the persistence design

`UX-ANALYSIS.md` Strategic issue #2 previously said "localStorage persistence *(recommended)*" in a single table row. It now carries five subsections, because "save the inputs" turned out to be badly under-specified:

- **§2.1 — the tier split.** Tier 1 (facts about you) persists; tier 2 (market/statutory assumptions — the 8.75% rate default, stamp duty, tax slabs, IRDAI tables) must **never** persist. The failure mode this prevents is specific: save 8.75% today and in 2028 the app confidently computes an EMI at a rate that has been wrong for three years, with nothing indicating the number came from a stale session rather than a maintained default.
- **§2.2 — why it's a gate**, with the worked before/after example (9 fields and no memory vs. 2 fields and a delta).
- **§2.3 — risks R1–R6 with mitigations M1a–M6c**, each tagged so the task brief and the code can reference them individually.
- **§2.4 — the change tile and the collapsed chart.**
- **§2.5 — accounts/backend boundary**, including why nothing here has to be undone later: the tier-1/tier-2 split is already the store-vs-compute line a server would use, and the Option C JSON schema is the natural sync payload.

`TASK-UX-REDESIGN.md` Phase 2 was then split from one bullet list into **2a–2f with per-block acceptance criteria**, and every mitigation referenced by tag so nothing could be quietly dropped during execution.

---

## D1 — the gray sweep (done first, on purpose)

Sequencing call: building a new hub on a palette with 20+ hardcoded grays means the hub either copies them or diverges from them. So D1 came out of Phase 4 and went first.

Every hardcoded gray now resolves through `:root`. Four new **neutral** tokens (palette rule 1 holds — still exactly three chromatic hues):

| Token | Value | Use |
|---|---|---|
| `--border-subtle` | `#1c1c1c` | in-card row dividers |
| `--hero-grad-1` / `-2` | `#1c1a11` / `#1a1a1a` | `.total-card` / `.sp-result-card` gradient |
| `--on-accent` | `#0a0a0a` | ink on gold fills |
| `--header-grad-mid` / `-end` | `#141414` / `#181818` | header sheen |

Swept: all stat/table dividers, the two hero-card gradients, the toast (→ `--surface2`), the toggle track (→ `--border`), ink on every gold fill, the header gradient, and `manifest.json`'s `background_color` (`#0f0f0f` → `#0a0a0a`, so a PWA launch flashes brand black rather than a lighter gray). Computed values verified identical to pre-sweep except the toggle track, which moved 3 units (`#333` → `#303030`).

**Two deliberate calls beyond pure tokenization**, flagged rather than slipped in:

1. `.action-btn:hover` and `.collapse-card:hover` used off-palette `#555`/`#444` borders. Both now use `--hl-border`, matching the gold hover the landing tiles already had — palette rule 2 makes gold the emphasis colour, so this is a consistency fix rather than a new decision.
2. The **PNG-export canvas** had ten hardcoded colours, including a stale `#8a9a8e` left over from the *old green theme*. Canvas can't read CSS custom properties, so a small `palette()` helper now pulls them off `:root` at export time — one source of truth, and the export can't silently drift from the app again. Export naming and fonts are untouched; that's D10/R9.

**Two stale items in the brief corrected:** Phase 4 said to set `background_color` to `#04140d` — a pre-overhaul green value — and said the cache version was at `apt-cost-v3`. Both fixed in the brief.

---

## Phase 2a — the persistence primitive

Shipped **on its own, wired to one low-stakes surface**, before any Worth data depended on it. This was the single most useful sequencing decision of the session: every failure path below was found and fixed on a surface where a bug cost nothing.

The layer, on a single versioned key `dhanam.v1`:

- **Tier-1 only**, per §2.1.
- `loadState()` treats corrupt, foreign, or wrong-version blobs as **absent** and never throws. This matters more than the usual defensive-coding argument: it's the first bug class in the app that a **reload cannot rescue the user from** — a throw at init would leave them stuck until they cleared site data by hand, which they will not know how to do.
- Hydration runs **after** the first render, never before (M2b).
- **Flat, additive schema** — unknown keys ignored, missing keys defaulted (M6a); version bumps reserved for genuinely breaking changes (M6b).
- `lastSaved` timestamp (M1b) plus a separate `dhanam.seen` marker so browser eviction is *detectable* rather than silent (M1c).

**Loan panel opt-in:** a "Remember my inputs on this device" toggle, default off. Saving flows through `renderLoans()` so there's one update path per the CLAUDE.md convention. Switching it off deletes the stored inputs and drops the whole key when nothing else remains, rather than leaving an empty blob behind.

**A genuine ambiguity in my own spec, found by implementing it.** The interest rate straddles the tiers: 8.75% as the *app default* is tier 2, but "my loan is at 8.4%" is tier 1. Resolution: **persist such a field only when its value differs from the app default.** An untouched field keeps tracking the maintained default; a deliberately changed one is remembered. The trade-off — someone who explicitly types today's default will later get the future default instead — is acceptable and preferable to freezing a stale rate. Recorded as a §2.1 refinement so the rule applies to any future default-bearing input.

**Landing copy (M4a).** "Nothing is saved or sent anywhere" was about to become false. Now: "Everything updates live as you type. Nothing is ever sent anywhere — anything you choose to save stays on this device."

---

## Phase 2b/2c/2e — Dhanam Worth

The sixth tile is no longer disabled. `hub-worth`, `w-*` prefix, single `renderWorth()` entry point.

- **Balance sheet** — 8 asset rows (cash/bank, FD/RD, mutual funds, stocks, EPF/PPF/NPS, property, gold, other) and 3 liability rows, generated from `W_ASSETS`/`W_LIABS` rather than hand-written markup, so adding a category is a one-line change. Each row shows its share of its own side, which keeps a long list readable.
- **Hero** — gold net-worth figure in the existing `.total-card` style, assets and liabilities as sub-items.
- **Change tile** — its own card. Arrow + "Up/Down ₹X (±Y%)" + "since &lt;date&gt; · was ₹Z". Green/red is a real financial delta (rules 3/4) and **never the only signal** — the glyph and the words carry it independently, so it reads in greyscale and with red-green colour vision deficiency (rule 5). It compares against the newest history entry from a **different day**, so today's own running entry is never its own baseline.
- **History** — append-only `{date, netWorth}`, one per save-day (same-day saves overwrite), capped at 120. Shipped in the v1 schema even though the chart didn't, because history cannot be reconstructed retroactively.
- **Neutral and edge states** — no tile at all on a first visit; a neutral "No change" at zero rather than green; `—` everywhere on an empty sheet; and **nothing written to storage until a field is non-zero**, so an empty first visit can't seed a bogus ₹0 baseline for tomorrow's delta. A negative net worth renders `−₹X` and turns the hero red — a real negative position (rule 4), with the minus sign carrying it too.
- **Your-data controls** — download/restore a JSON backup, erase everything behind a confirm, a hide-amounts blur for shared devices, a `lastSaved` line, an eviction notice, and a PWA install nudge (installed apps keep their storage; browsers evict it for sites you haven't opened in a while). Imports are validated **exactly as `loadState()` validates** — a bad-JSON file and a wrong-version backup are both rejected with a message rather than a crash.

---

## Three bugs found while testing, not by inspection

1. **`sw.js` never precached `calc.js`.** `index.html` loads it via `<script src>`, and the SW's asset branch is `match(req) || fetch(req)` with no `cache.put` — so **offline, the app 404'd its own calculation functions and broke entirely** rather than degrading. One line in `ASSETS`; cache bumped to `apt-cost-v6`. This was already latent before Phase 2, but Worth storing real data that users will want to open offline made it urgent. The rest of D9 stays in Phase 4.
2. **The quota-failure path lied to the user.** With `localStorage.setItem` throwing (storage full, or Safari private mode), typing correctly kept working — but the UI still displayed "Saved on this device". `saveState()` now reports failure and the hint says it couldn't save. A persistence feature that claims data is safe when it isn't is worse than one that doesn't persist at all.
3. **The new Worth inputs missed the Phase 0 iOS-zoom fix** — 13px at 375px, so mobile Safari would zoom on every field tap. The D7 rule is a media query listing input classes *explicitly*, so it silently fails to cover new ones. Fixed, commented in place, and written into the brief as a standing obligation rather than a one-off.

Plus one privacy leak in my own feature: **hide-amounts blurred the headline figures but not the per-row `%` shares** (which reveal portfolio composition) **or the change tile's "was ₹X" line**. Both added to the blur selector, and CLAUDE.md now says any new number-bearing element must be added there too.

---

## Verification performed

No Playwright module is installed, but Chrome for Testing is cached and Node 24 ships a global `WebSocket`, so I wrote a **zero-dependency CDP driver** (scratchpad, not committed) that navigates, evaluates, reloads, and screenshots. That made the failure paths — which are the whole point of 2a — actually testable rather than asserted.

**Persistence, failure paths first:**
- Hand-corrupted `dhanam.v1` (`"{ this is not json"`) → app loads and works from defaults; hint reports the data couldn't be read.
- `v: 99` blob → ignored cleanly.
- State removed while `dhanam.seen` survives → correctly reports browser eviction.
- `localStorage.setItem` overridden to throw → EMI still recalculated (₹74,395), hint honestly says it couldn't save.
- Opt-out → both `dhanam.v1` and `dhanam.seen` removed, back to a clean state.
- Default rate 8.75% confirmed **not** stored; 8.4% confirmed stored.

**Persistence, happy path:** values survive reload (₹1,17,56,250 / 8.4% / `loanTotalLocked` restored, total hint reads "Remembered on this device"); nothing written at all while the toggle is off.

**Worth:** the doc's worked example reproduces exactly — assets ₹1.49 Cr, liabilities ₹58.00 L, **net ₹90.50 L**; with a planted 12-June snapshot the tile reads **▲ Up ₹2.00 L (+2.2%) · since 12 June · was ₹90.50 L**. Down state (▼ red) and neutral ("No change") both confirmed. Backup → erase → restore round-trips the sheet and history; bad-JSON and `v: 77` imports both rejected with messages. Negative sheet → `−₹80.00 L`, hero red. All-empty sheet → `—` everywhere, and a regex sweep of the hub's text found **no `NaN`, `Infinity`, or `undefined`**. Hide-amounts confirmed `blur(7px)` on hero, totals, inputs, shares, and basis line.

**Regression:** landing still the default view with `⌂ Home` active, 6 tiles, **0 disabled tiles and 0 disabled tabs**; every hub toured (apartment quick estimate ₹1.18 Cr, SIP ₹99.91 L, car, disbursement schedule rendering) with no console errors; disbursement panel unaffected. At **375px**: inputs 16px, no horizontal scroll, single-column layout. `node tests.js` **39/39** throughout.

**Stored-blob audit:** keys are exactly `v, lastSaved, rememberInputs, loan, worth, history`, and a regex check confirms no tier-2 value (`8.75`, stamp, slab) appears anywhere in it.

---

## CLAUDE.md updated

- Hub list now includes `hub-worth`, naming its three deferred pieces so they can't be mistaken for missing-by-accident.
- "No backend, no persistence" rewritten as **"No backend; persistence is local-only and deliberately narrow"** — the one-key rule, the tier-1/tier-2 prohibition, the never-throw requirement, the additive-schema rule, the `history` contract, and the backup/erase story.
- New **Dhanam Worth specifics** section: `renderWorth()` as the single entry point, the different-day baseline rule, empty/negative states, and the blur-selector obligation.
- `w-a-*`/`w-l-*` added to the ID-prefix conventions; `renderWorth()` to the core-functions list.
- **Manual checklist items 11–17** added, failure paths first: corrupt load, wrong-version load, eviction, quota/private-mode, tier-2 leakage audit, change-tile states, backup round-trip, blur coverage, empty/negative edges.

---

## What this does NOT include (by design)

- **R1 — the projection bridge.** The +5/+10/+20-year "Projected worth" section reusing `calcSIP`/`loanAtYear`. This is the item that makes Worth the app's anchor rather than a seventh calculator, and it's now the highest-value remaining work. Note it needs one input the balance sheet doesn't yet collect: a monthly SIP/savings figure.
- **R3 — the trend chart**, and **R6 — `buildWorthRows()` Excel export.**
- **Phases 3, 4 and 5 entirely** (density/charts, brand/PWA, accessibility/ARIA) beyond the D1 sweep and the `calc.js` precache fix pulled forward.
- **No automated coverage for any of this.** `tests.js` covers `calc.js`'s pure functions only; `renderWorth()` and the storage layer are DOM- and browser-coupled, so they're on the manual checklist. My CDP driver was throwaway — if you want it repeatable, `/run-skill-generator` can turn it into a project skill, which would make these seventeen checklist items a command instead of an afternoon.
- **B6 (the `calcStepupSIP`/`calcSIP` ~1% convention gap) is still unresolved** — open since Phase 1 and still your call.
- **B7, new:** Worth persists as soon as you type, with no per-hub opt-in. That follows §2.2 (an opt-in there would recreate the rejected Option A), and I made it visible rather than silent — `lastSaved` line, prominent erase, blur toggle. If you'd rather it asked first, say so.

---

## Files touched

- `index.html` — D1 sweep + `palette()` helper; persistence layer (~130 lines); loan-panel toggle and hydration; the whole `hub-worth` markup, CSS and logic; Worth tile and nav tab enabled; landing privacy copy; `.w-row input` added to the mobile-font rule. **3,335 lines, up from 2,801** at the start of this session — a 19% growth in the single file, which is exactly the trajectory `ARCHITECTURE-ANALYSIS.md` flagged as worth revisiting once the Worth hub and persistence landed. Nothing is broken by it; it's just now a fair question whether the next phase should split the file.
- `sw.js` — `calc.js` precached; cache `v5` → `v6`.
- `manifest.json` — `background_color` → `#0a0a0a`.
- `CLAUDE.md` — persistence rules, Worth hub section, ID prefixes, checklist items 11–17.
- `UX-ANALYSIS.md` — §2.1–§2.5 (+104 lines); B2 marked answered.
- `TASK-UX-REDESIGN.md` — Phase 2 split into 2a–2f; status markers on every phase; consolidated **Remaining work** table (R1–R10); B1/B3 marked answered, B6/B7 added; stale `#04140d` and cache-version references corrected.
- `PHASE-2-REPORT.md` *(new, this file)*.

**Commits** (branch `claude/clever-pascal-rn4p3h`, pushed):

| | |
|---|---|
| `649ab6c` | `docs: expand persistence design, resolve B2, spec net-worth change tile` |
| `d2a7a60` | `feat: complete D1 gray sweep into the palette custom-property system` |
| `92b7316` | `feat: add localStorage persistence primitive behind a loan-panel opt-in` |
| `370a319` | `feat: ship Dhanam Worth — balance sheet, net-worth hero, change tile, backups` |
