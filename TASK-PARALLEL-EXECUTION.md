# Parallel-Agent Execution Analysis

*Written 2026-08-08, after Phase 4b + Phase 10 shipped together via two parallel subagents in isolated `git worktree`s, controlled by one integration agent (see `PHASE-4B-REPORT.md`, `PHASE-10-REPORT.md`). This document asks two questions about the work that's still open in `TASK-UX-REDESIGN.md`: which of it can run in parallel the same way, and whether a dedicated test-running agent is worth having alongside the agents that build. It does not re-derive scope or acceptance criteria — those live in `TASK-UX-REDESIGN.md` and are only summarized here for the dependency analysis.*

---

> **Addendum, 2026-08-09 — Phase 13 carries its own wave plan.** A new phase
> (**R49**–**R54**: the resale credit becomes an explicit reveal, a
> cumulative-cost-vs-car-value chart becomes the default) was specced after this
> document was written, and the owner asked for it to be structured for parallel
> agents. **Its wave plan lives in `TASK-UX-REDESIGN.md`'s Phase 13 section**,
> not here, so the spec and the execution plan can't drift apart. It follows
> every convention below — isolated worktrees, one integration agent per merge,
> shared touchpoints (`sw.js`'s `CACHE`, `BUILD_STAMP`, CLAUDE.md placement)
> reserved to the integrator, `git merge-base` verified before any diff is
> trusted.
>
> Two findings from this document generalised there and are worth noting here
> because they'll recur: **(1)** a phase confined to one `render*` function
> mostly *doesn't* parallelise, and the honest plan says so rather than
> manufacturing agents — Phase 13 has exactly two genuine build-parallel splits
> out of six items; **(2)** §2's Cluster-A lesson reappeared in a new form —
> two agents each drawing a two-series chart in different regions will invent
> two different visual languages unless the shared conventions are written into
> both briefs *before* the wave starts. That's a decision the integration agent
> makes once, not a merge conflict to resolve later.

## 1. What's actually still open

> ⚠️ **This section is stale — it was written 2026-08-08 and predates Phases 11, 12, 13 and 14.** The *conventions* in this document (isolated worktrees, one integration agent per merge, shared touchpoints reserved to the integrator, `git merge-base` verified before any diff is trusted) are still current and still binding; only the inventory below is out of date. **`TASK-UX-REDESIGN.md`'s "Remaining work" table is the live view**, and `MID-PROJECT-REVIEW.md` (2026-08-10) is the audit behind its current state. In short: R10, R21, R22, R24 and R45 have since shipped; what remains is **R8** (now re-rated **High**), **R23**, the rest of **R25**, **R31** (still gated on B10), and the five new items **R62–R66** filed by the mid-project review. Note also that **R62–R64 are deliberately single-agent work** — three small edits in one file each, where the coordination cost of a wave would exceed the work.

Per `TASK-UX-REDESIGN.md`'s "Remaining work" table (as of this writing): Phase 5 (**R8**, **R10**), Phase 6 (**R21**–**R25**, **R45**-the-build-stamp — not to be confused with the now-shipped Phase 10a hero, which collided on the same number; see that file's note), and Phase 7 (**R31**, **R32**). Phases 1–4, 4b, 8, 8b, 9, and 10 are shipped.

| Item | What it touches | Blocked by | Notes |
|---|---|---|---|
| **R8** (Phase 5) | Every hub — collapse headers, both tab bars, all mode toggles, `toggleSection()`'s three paths | — | The widest-reaching item left. Not a "new feature," a sweep over what already exists. |
| **R10** (Phase 5) | Mostly small/scattered (`renderCarLoan()`, table wrappers, Reset label); one sub-item (nav-tab overflow affordance) is landing/nav | — | Splits cleanly into an independent part and a nav-coupled part — see §2. |
| **R21 / 6a** | `hub-apartment`'s `d-*` fields (stamp duty, registration) | — | The one correctness bug left in the document. Owner-flagged as do-first. |
| **R22 / 6b** | New About page/section; a new nav or landing entry | Content needs 6a's state table; **must not ship while any off-origin request exists** (R5, already satisfied) | Explicitly the one entry that reads other assumptions to build its provenance list. |
| **R23 / 6c** | One new component + ~12 placement points across **every** hub (`car-*`, `disb-*`, `sp-`/`su-`/`ls-*`, `d-*`, `w-*`) | Doc says explicitly: "coordinate with R8 or do it after" | Second-widest sweep after R8. |
| **R24 / 6d + 6d-i** | New landing tile; `hub-apartment`'s loan-panel comparison copy | R14 accordion (shipped) | Tile addition is landing/nav-coupled, same region as 6b. |
| **R25 / 6e** | Landing-page dismissible line; contact route | R45 for the build stamp | The full feedback *composer* is explicitly deferred past the beta per the doc's own sequencing note — only the build stamp + a plain contact link ship now. |
| **R45 / 6e-ii** (build stamp) | New small UI element, homed on the About page (6b) | Soft dependency on 6b existing as its home | Doc says it "can land any time, ahead of the rest of Phase 6" — but has nowhere to live until 6b's page exists. |
| 6f (beta protocol) | Not code | — | Owner activity, not an agent task — see §4. |
| **R31 / 7a** | `hub-sip` (Grow) | **B10** (owner decision, unanswered) + **6b** (needs the provenance list to disclose the tax rate against) | Isolated to one hub once unblocked. |
| **R32 / 7b** | Assessment only — a written recommendation, not code by default | Nothing, for the assessment itself. `R32`'s table row lists R26/B10/6b as prerequisites, but the spec's own acceptance criteria only require those if the assessment concludes "build" | Genuinely zero-conflict: it can start today, in parallel with everything else, producing a doc rather than touching `index.html`. |

Two open owner decisions gate real work: **B10** (post-tax default) blocks R31 from starting at all; **B6** (the `calcSIP`/`calcStepupSIP` ~1% convention gap) doesn't block anything directly but is "load-bearing" for whatever R32 recommends, per the existing doc.

## 2. Where the conflicts actually are

The lesson from Phase 4b/10 wasn't "worktrees prevent conflicts" — they don't, by themselves; the two branches still collided in `index.html` and `sw.js` and needed a real merge. What worktrees buy is that each *agent* works from a clean, uncorrupted copy instead of two agents racing edits on the same live tree. The conflicts still have to be reasoned about up front. Three clusters stand out:

**Cluster A — the landing page / nav bar.** R22 (6b) wants a new page reachable from landing+nav; R24 (6d) wants a new landing tile; R10's nav-overflow sub-item exists *because* the nav is already tight and both of the above make it worse — the doc says so explicitly ("adding a tab makes it worse — consider a footer/landing-tile route"). Three agents independently touching this ~200-line region of `index.html` is close to guaranteed conflict, and worse, a *content* conflict (does the About page get a tile or a footer link? does that choice also solve the nav-overflow problem, or fight it?) that a mechanical merge can't resolve — a human/architectural call has to be made once, not three times independently. **Do not parallelize this cluster.** Run 6b + 6d + R10's nav sub-item as one sequential unit (one agent, or a tight sequence of agents that each read the previous one's result before starting), the same way this session's controlling agent reasoned about `sw.js`'s single cache-version line rather than letting two agents both touch it blind.

**Cluster B — the two exhaustive sweeps (R8, R23/6c).** Both touch literally every hub. Running them concurrently in separate worktrees would produce a diff so tangled the merge would cost more than doing them sequentially. The existing doc already flags this ("coordinate with R8 or do it after" for 6c) — worth taking literally: **run R8 to completion first, then R23 as a second full sweep that can lean on R8's now-established focus/ARIA pattern** (the tap-friendly `ⓘ` needs `:focus-visible`/ARIA treatment per its own acceptance criteria, and re-deriving that pattern independently risks a second, slightly different one). This mirrors how R7 (icons) and R27 (`aria-hidden`) each shipped as one deterministic, whole-file pass rather than piecemeal — and this session's real lesson about that pattern: **a mechanical whole-file sweep is safest done fresh, once, against the current tip** — not cherry-picked from a subagent branch that might have started from stale history (see §3).

**Cluster C — `hub-car`'s `renderCarLoan()`.** R10 lists "`renderCarLoan()` should call `calcEMI` instead of its inline formula" as a small independent item — but Phase 10 (already shipped) restructured that exact function around a new `tenureStats(yr)` helper (`PHASE-10-REPORT.md`). Whoever picks up R10 needs to target `tenureStats()`, not the pre-Phase-10 shape the original R10 bullet was written against. Not a parallelization risk (nothing else is touching this function right now) but a **stale-spec risk** worth calling out explicitly in that agent's brief, the same way Phase 10's own subagent had to be told about Phase 8b/9's EPF/perquisite changes it would otherwise have missed.

Everything **not** in a cluster above is comparatively low-risk to parallelize: R21/6a (self-contained to `hub-apartment`'s detail panel), R32/7b (produces a doc, not code), and — once B10 and 6b are answered/shipped — R31/7a (self-contained to `hub-sip`).

## 3. A concrete wave plan

Modeled directly on the Phase 4b/10 run: isolated worktrees per agent within a wave, one controlling agent per merge, `node tests.js` + the structural checks (duplicate ids, balanced tags, icon-attribute coverage) run after every merge, not just at the end.

**Wave 0 (today, zero blockers, fully parallel — 2–3 agents):**
- **R21/6a** — the correctness bug, do this regardless of what else runs alongside it.
- **R32/7b** — the assessment. Genuinely no file overlap with anything; could even run as a plain research task rather than a worktree agent, since it's not expected to touch `index.html` at all unless it recommends "build," which is a separate follow-on decision.
- **R10-core** (the *non*-nav parts: `renderCarLoan()`→`calcEMI` via Phase 10's `tenureStats()`, `overflow-x` wrappers on wide tables, Reset button label scoping). Low risk, scattered but small; brief this agent on the Cluster C note above.

**Wave 1 (after Wave 0 merges; still needs no owner input) — one agent, run as a sequential unit, not split:**
- **6b + 6d/6d-i + R10's nav-overflow sub-item + R45/6e-ii's landing spot.** This is Cluster A. One agent (or one agent then a follow-on agent that reads the first's actual result, not the spec's guess at it) decides the landing/nav shape once — About page entry point, prepayment tile, and the nav-overflow fix — so the three don't each solve it differently. The build stamp (R45) slots into the About page this agent builds.
- **6e**'s remaining piece (the dismissible orientation line + a plain contact link, *not* the deferred composer) can ride along in the same agent since it shares the landing page.

**Wave 2 (after Wave 1; two full-file sweeps, run sequentially not concurrently):**
- **R8** first — full ARIA/keyboard pass over every hub, including whatever Wave 1 added.
- **R23/6c** second, built on R8's now-established focus pattern — full term-definition sweep over every hub.

**Wave 3 (gated on the owner):**
- **B10 needs an answer before this wave can start.** Once it is: **R31/7a**, isolated to `hub-sip`. Nothing else in this plan touches that hub, so it doesn't strictly need to wait for Wave 2 to *finish* — only for **6b to exist** (its tax-rate disclosure needs a provenance list to point at) and for B10 to be answered. It could run concurrently with Wave 2 if the owner answers B10 early; sequenced last here only because B10 is, as of this writing, still open.

**Not a wave — runs the whole time:** 6f, the beta protocol. It's the owner's own activity ("watch, don't demo"), not an agent task, and the doc explicitly says to run it *while* the rest of Phase 6 is being built, not after.

## 4. Should a dedicated agent just run tests while another builds?

**Not in the form the question implies — this repo doesn't have the shape that pattern is for.** A dedicated test-watcher agent earns its keep when the test suite takes long enough that a build agent would otherwise sit idle waiting on it, or when tests run against a shared environment that only one process can hold at a time (a database, a dev server with state). Neither is true here: `node tests.js` runs in a fraction of a second, there's no build step, no server needs to be up for it, and every subagent this session ran it inline, dozens of times, at zero noticeable cost. Dedicating a whole agent — with its own worktree, its own context, its own coordination overhead — to a job that costs less than the coordination overhead itself is a net loss.

**What *is* genuinely slow and worth pipelining is the manual browser checklist**, not `node tests.js`. CLAUDE.md is explicit that the automated suite only covers `calc.js`'s pure functions — every `render*`/DOM-coupled behavior (the accordion, the chart redraw contract, focus-preservation while typing, the whole manual checklist at the bottom of CLAUDE.md) is still "verified by hand." Neither of this session's two subagents had a headless browser available and both said so in their reports; Phase 10's items 37–39 are still unwalked as of `PHASE-10-REPORT.md`. *That's* the slow, real verification step in this project, and it's the one worth a dedicated role for — not because it needs to run continuously, but because it's the one stage in the pipeline a build agent can't cheaply do inline the way it does `node tests.js`.

**The actual parallel architecture this suggests is a pipeline, not a watcher:**

```
Wave N build agents (isolated worktrees)
        │
        ▼
Controlling/integration agent — merges, resolves the shared-file
touchpoints (nav markup, sw.js cache version, CLAUDE.md sections),
runs node tests.js + structural checks
        │
        ├──────────────► QA agent: `python3 -m http.server` + a real
        │                 browser, walks the relevant manual-checklist
        │                 items against the just-merged tip
        ▼
Wave N+1 build agents can start immediately, in fresh worktrees
branched off the just-merged tip — they do not need to wait for
the QA agent's browser walkthrough to finish.
```

The QA agent's browser pass and Wave N+1's build agents *can* genuinely overlap — that's the real "test agent running while another builds" opportunity here, just one stage removed from where the question first put it. If the QA agent finds a regression, it's a bug report against an already-merged, already-tagged commit — cheap to bisect back to, and it doesn't block the next wave's construction, only its own eventual merge into the trunk everyone's building on. This is exactly the shape CLAUDE.md's own "Deploy" line gestures at ("treat any deploy step as manual/external") — there's no CI here to lean on, so a QA agent using the `run` skill to actually drive the app in a browser is the closest thing to one, and it's worth having as its own role precisely because it's the one step in this project that can't be made instant the way the calc-function tests already are.

**One caveat carried forward from this session, worth baking into every future agent's brief regardless of wave:** verify a worktree's actual base commit (`git merge-base <intended-tip> <worktree-branch>`) before trusting its diff. Both of today's subagents' worktrees branched from stale history rather than the intended tip; one caught and fixed it itself, the other didn't, and its diff would have silently missed real coverage (8 icon usages that only existed in the correct history) had it been merged as-is instead of reapplied fresh. Telling each build agent to `git merge` onto the intended tip *before* starting work — as Phase 10's agent did on its own — is cheap insurance against repeating that.
