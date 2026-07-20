# Dhanam — Architecture Analysis: Is the single-file approach risky for a public launch?

*Reviewed: 2026-07-20 · Source: `index.html` (144 KB, 2,888 lines), `manifest.json`, `sw.js` · No code was changed for this review.*

---

## TL;DR

**The risk isn't the single file. It's the absence of anything that catches mistakes before real users see them.** A static, dependency-free, no-backend app is actually an *unusually strong* architecture to take public — it's cheap, infinitely scalable, has almost no attack surface, and stores nothing anywhere but the user's own device (once you add the localStorage layer from the UX review, it stays that way). That part of the decision holds up fine at any user count.

What doesn't hold up as the app grows is everything **orthogonal to file-count**: no automated tests on financial formulas, no type-checking, no lint, all state living in ~8 mutable global variables shared across every hub, and 93 inline event-handler strings wiring markup straight to global functions. Those are the actual sources of risk for a money app with strangers depending on its arithmetic — and they'd be exactly as risky if the same code were split into fifty files. Splitting files without adding tests would be rearranging furniture.

So the honest framing for you: **don't ask "should I break up the file?" — ask "how do I catch a wrong EMI number before a stranger trusts it?"** File structure is a legitimate follow-on question, but it's the smaller one.

---

## What "single-file" actually means here today

It's not literally one file — it's four: `index.html` (the app), `manifest.json` (PWA metadata), `sw.js` (service worker), and a logo. The *code* — all CSS and all JavaScript — is inline in `index.html`: one `<style>` block, one `<script>` block, 63 top-level functions, no modules, no imports, no build step. That's the part under discussion.

---

## Where this architecture is a genuine strength for going public

It's worth being honest about this before listing risks, because the instinct "single file = risky" is usually wrong for an app shaped like this one.

- **Hosting cost and scale are a non-issue.** Static files on any CDN (GitHub Pages, Cloudflare Pages, Netlify, S3+CloudFront) serve effectively unlimited concurrent users for close to free. There's no server to fall over, no connection pool to exhaust, no autoscaling to configure. A Hacker-News-front-page spike is a non-event.
- **The attack surface is close to zero.** There's no backend to breach, no database to leak, no auth tokens to steal, no server-side secret that can be exfiltrated — because there is no server. The worst a malicious actor can do is view source (which is already the point of a client-side calculator) or attempt XSS through the one remaining external call. Compare this to any app with a backend: that's an entire category of public-launch risk (SQLi, auth bypass, rate-limiting, DDoS, secrets management) that simply doesn't apply here.
- **Privacy/compliance posture is strong by construction.** No data leaves the device (after the fonts fix below, *literally* none). Under India's DPDP Act or any privacy regulation, "we never receive your data" is the strongest possible compliance story — it means no data-breach notification exposure, no consent-management burden, no data-retention policy to write.
- **Deploys are trivial and instantly reversible.** No build pipeline to break, no dependency to go vulnerable overnight (no `npm audit` surface at all — there are zero third-party packages). Rolling back is `git revert`.
- **Offline-by-default fits the product.** A finance calculator that works on a flight or in a signal-dead basement is a real feature, not just a PWA checkbox.

None of this changes if you go from 10 users to 100,000. **The infrastructure risk of "public with real users" is already solved by this architecture — that's not where your exposure is.**

---

## Where it becomes a real liability

### 1. No safety net on financial correctness — the actual public-launch risk
There are zero automated tests. `calcEMI`, `loanAtYear`, `calcIncomeTax`, `calcPerquisite`, `calcCarDepreciation`, `calcSIP` are the entire value proposition of the app, and every one of them is verified today by a human opening a browser and eyeballing numbers (per CLAUDE.md's manual checklist). That's a reasonable process when you're the only user. It stops being reasonable the moment a stranger uses the perquisite calculator to justify a salary restructuring, or the loan calculator to decide a 20-year commitment, and a regression silently ships a wrong tax slab or a sign error.

**This is true regardless of whether the code lives in one file or fifty.** The fix is a test harness, not a refactor — even a single dependency-free `tests.html` that loads the same functions and asserts known values (e.g., "₹50L loan, 8.75%, 20yr → EMI = ₹43,391 exactly") would catch the highest-cost class of bug: a silently wrong financial answer shipped to the public.

### 2. Shared global mutable state across unrelated features
`QD`, `DD`, `LD`, `loanTotalLocked`, `detailOpened`, `loanOpened`, `disbTranches`, `MODES` are plain globals read and written from functions all over the file — e.g. `calcDetail()` (apartment hub) reaches across to read `chk('q-uc')`, and `renderLoans()` reads module-level `LD` that three *other* render functions (`renderAdvLoan`, `renderSIPComparison`, `buildLoanRows`) also depend on implicitly. At 6 hubs this is manageable because you, the author, hold the whole file's state graph in your head. It will not stay manageable as Dhanam Worth is added (per the UX redesign brief) and starts needing its own cross-hub reads (net worth's projection section explicitly wants to read SIP and loan state). **The risk here is name collisions and hidden coupling, not "too many files."** A `w-total` variable added carelessly next to `l-total`, `d-total`, `disb-total-*` is a real, easy mistake in a codebase with no namespacing.

### 3. No compiler/linter/type-checker
Every bug class a linter or TypeScript would catch for free — a typo'd `el()` id, a function called before its argument exists, an unreachable branch — is instead caught by manually clicking through the app (or not caught at all until a user reports it). 93 inline `onclick`/`oninput` handler strings are particularly fragile: a typo inside one of those quoted strings fails **silently** in the browser console with no build-time warning, because there's no build step to warn.

### 4. Debugging and support at real-user scale
Right now, if something breaks, the user is you and you have the DevTools open. Once strangers are the users, you'll rely on bug reports like "the loan section showed wrong numbers" with no error tracking, no session replay, no stack traces, no way to reproduce their exact input state. This isn't a single-file problem specifically, but a single-file *dependency-free* philosophy has so far also meant zero error-monitoring (e.g., no lightweight client-side error logging at all — not even a `window.onerror` handler). That's worth reconsidering independent of file structure.

### 5. Code review and change safety get harder as the file grows
2,888 lines today; the UX redesign brief alone proposes a new hub, a persistence layer, and a chart system, easily pushing this past 4,000–5,000 lines. Practically: `git diff` on a single 5,000-line file is harder to review than the same change scoped to a 200-line module; merge conflicts (if you ever have a second contributor, human or agent) land in the same file constantly; and "does this change affect the loan hub?" requires either perfect memory or grepping the whole file, because nothing enforces the section boundaries CLAUDE.md documents by convention only.

### 6. Feature ceiling: this architecture cannot support accounts or cross-device sync
This is the one place where "single file" and "no backend" become the same risk. Everything today works precisely *because* there's no server. The moment you want a user to see their net worth on both their phone and laptop, or log in, or have their data survive a device wipe, you need a backend — full stop, no static-file trick avoids this. That's not a reason to add one now (per the UX brief, localStorage covers "remember my inputs on this device," which is most of the value), but it's worth being explicit that **"go public with real users"** and **"let users access their data across devices"** are different asks, and only the second one requires abandoning the static architecture.

### 7. One quiet violation of the app's own privacy promise
The Google Fonts `@import` (`index.html:14`) is currently the only outbound network call in the entire app — everything else genuinely stays local. It's a minor point technically, but at public-launch scale, "nothing is sent anywhere" is a marketing claim real users may scrutinize (or a privacy-conscious reviewer will point out), and it's currently not quite true. Self-hosting the three font families closes this gap completely and is a low-effort fix (already flagged as D9 in the UX analysis).

---

## Reframing the actual question

| If you're asking... | The honest answer |
|---|---|
| "Is a static, no-backend, dependency-free app too risky to expose to strangers?" | No — this is a *strength*. Keep it. |
| "Is a single 2,900-line file with no tests too risky to expose to strangers?" | The **no tests** part, yes. The **single file** part, not by itself. |
| "Will this file structure survive the Worth hub + persistence + charts?" | It will still *run*, but global-state collisions and review friction will get noticeably worse. Worth revisiting. |
| "Do I need a backend to launch publicly?" | No. You need one only if you want accounts or cross-device sync — a separate, later decision. |

---

## Recommendation

**Don't restructure the file as a prerequisite for going public.** The static architecture is not the risk; ship it. Instead, before or alongside a public launch, prioritize in this order:

1. **A minimal correctness test harness** (even a plain `tests.html` with hand-written assertions against `calcEMI`, `calcIncomeTax`, `calcSIP`, etc., run manually or via a headless-browser CI step). This is the single highest-leverage risk reduction available and costs almost nothing in the "no dependencies" philosophy — it's just more inline JavaScript.
2. **Basic client-side error visibility** — at minimum a `window.onerror`/`unhandledrejection` handler that surfaces failures somewhere you'll actually see them (even a simple free error-logging endpoint, or a "copy diagnostic info" button users can paste into a bug report). Optional but cheap.
3. **Close the Google Fonts gap** so the privacy claim is fully true — small, fast, already on the UX punch list.
4. **Only then**, as a maintainability improvement rather than a launch blocker, consider lightly modularizing: splitting the inline `<script>` into a handful of `<script src="js/loan.js">`-style files grouped by hub (still zero build tooling, still fully static, just less of a single scroll-forever file), and namespacing each hub's state behind an object (`Loan.state`, `Worth.state`) instead of bare globals. This directly reduces the collision risk in point 2 above and makes review diffs scoped to the feature that changed. It's optional, lower urgency than 1–3, and worth doing incrementally rather than as a big-bang rewrite — natural entry points are exactly the phases already planned in `TASK-UX-REDESIGN.md` (each new hub is a good moment to split it out into its own file).

**In one sentence:** the architecture you chose is right for a free, private, static finance-calculator app at any scale of traffic — the thing that actually needs fixing before strangers rely on it isn't the file count, it's the total absence of automated verification that the math is correct.
