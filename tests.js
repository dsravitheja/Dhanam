// =====================================================================
// Correctness tests for Dhanam's pure financial calculations (calc.js).
//
// Run with: node tests.js
// Zero installs, zero dependencies — same philosophy as the rest of the
// app. Exits 0 with a summary when everything passes, non-zero with a
// failure list otherwise (safe to wire into CI later if ever wanted).
//
// See TASK-TEST-HARNESS.md for the brief this implements, and
// ARCHITECTURE-ANALYSIS.md for why this exists: nothing previously
// verified these formulas beyond a human eyeballing the browser.
// =====================================================================

const {
  calcEMI, loanAtYear, simulateLoan,
  calcSIP, calcStepupSIP,
  calcIncomeTax, calcPerquisite, calcCarDepreciation,
  calcRunningCost, calcInsuranceTotal, calcLeaseNetCost, calcBreakevenKm,
  calcOwnershipCurve,
} = require('./calc.js');

let pass = 0, fail = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push({ name, detail });
  }
}

function approxEqual(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance;
}

// ---------------------------------------------------------------------
// Independent oracle for calcEMI: solve for the EMI that drains the
// loan to exactly zero over n months via simulation + bisection. This
// does NOT use the closed-form annuity formula at all, so it validates
// calcEMI's formula itself, not just guards against future regressions.
// ---------------------------------------------------------------------
function referenceEMIByBisection(P, annualRate, years) {
  const r = annualRate / 12 / 100;
  const n = years * 12;
  if (r === 0) return P / n;
  function balanceAfter(emi) {
    let bal = P;
    for (let i = 0; i < n; i++) {
      bal = bal + bal * r - emi;
    }
    return bal;
  }
  let lo = P / n, hi = P;
  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    if (balanceAfter(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// =====================================================================
// calcEMI
// =====================================================================
ok('calcEMI: zero-rate branch is exact',
  calcEMI(1200000, 0, 10) === 1200000 / 120,
  `got ${calcEMI(1200000, 0, 10)}`);

{
  const P = 1000000, rate = 10, years = 1;
  const emi = calcEMI(P, rate, years);
  const reference = referenceEMIByBisection(P, rate, years);
  ok('calcEMI: matches independent bisection oracle (P=10L, 10%, 1yr)',
    approxEqual(emi, reference, 1),
    `calcEMI=${emi.toFixed(2)} vs bisection oracle=${reference.toFixed(2)}`);
}
{
  const P = 5000000, rate = 8.75, years = 20;
  const emi = calcEMI(P, rate, years);
  const reference = referenceEMIByBisection(P, rate, years);
  ok('calcEMI: matches independent bisection oracle (P=50L, 8.75%, 20yr)',
    approxEqual(emi, reference, 1),
    `calcEMI=${emi.toFixed(2)} vs bisection oracle=${reference.toFixed(2)}`);
}

ok('calcEMI: monotonically decreasing as tenure increases',
  calcEMI(5000000, 9, 15) > calcEMI(5000000, 9, 20) && calcEMI(5000000, 9, 20) > calcEMI(5000000, 9, 30),
  `15yr=${calcEMI(5000000,9,15).toFixed(0)} 20yr=${calcEMI(5000000,9,20).toFixed(0)} 30yr=${calcEMI(5000000,9,30).toFixed(0)}`);

// =====================================================================
// loanAtYear
// =====================================================================
{
  const P = 5000000, rate = 8.75, years = 20;
  const atEnd = loanAtYear(P, rate, years, years);
  ok('loanAtYear: balance ~0 at full tenure', approxEqual(atEnd.balance, 0, 1), `balance=${atEnd.balance.toFixed(2)}`);
  ok('loanAtYear: principalPaid ~P at full tenure', approxEqual(atEnd.principalPaid, P, 1), `principalPaid=${atEnd.principalPaid.toFixed(2)}`);

  const atStart = loanAtYear(P, rate, years, 0);
  ok('loanAtYear: balance ~P at year 0', approxEqual(atStart.balance, P, 1), `balance=${atStart.balance.toFixed(2)}`);
  ok('loanAtYear: principalPaid ~0 at year 0', approxEqual(atStart.principalPaid, 0, 1), `principalPaid=${atStart.principalPaid.toFixed(2)}`);
  ok('loanAtYear: interestPaid ~0 at year 0', approxEqual(atStart.interestPaid, 0, 1), `interestPaid=${atStart.interestPaid.toFixed(2)}`);

  const atMid = loanAtYear(P, rate, years, 10);
  ok('loanAtYear: principalPaid + balance == P at year 10 (conservation)',
    approxEqual(atMid.principalPaid + atMid.balance, P, 0.01),
    `principalPaid=${atMid.principalPaid.toFixed(2)} + balance=${atMid.balance.toFixed(2)} = ${(atMid.principalPaid+atMid.balance).toFixed(2)}, expected ${P}`);
}

// =====================================================================
// simulateLoan
// =====================================================================
{
  const P = 5000000, rate = 8.75, years = 20;
  const normal = simulateLoan(P, rate, years, 0, 0);
  ok('simulateLoan: no-extra case runs full tenure',
    approxEqual(normal.actualMonths, years * 12, 0),
    `actualMonths=${normal.actualMonths}, expected ${years*12}`);
  ok('simulateLoan: no-extra monthsSaved is 0', normal.monthsSaved === 0, `monthsSaved=${normal.monthsSaved}`);

  const expectedInterest = calcEMI(P, rate, years) * years * 12 - P;
  ok('simulateLoan: no-extra totalInterest matches calcEMI*n - P',
    approxEqual(normal.totalInterest, expectedInterest, 1),
    `simulateLoan=${normal.totalInterest.toFixed(2)} vs expected=${expectedInterest.toFixed(2)}`);

  const withExtra = simulateLoan(P, rate, years, 1, 0);
  ok('simulateLoan: extra EMI/year strictly reduces tenure',
    withExtra.actualMonths < normal.actualMonths,
    `normal=${normal.actualMonths}mo, withExtra=${withExtra.actualMonths}mo`);
  ok('simulateLoan: extra EMI/year strictly reduces total interest',
    withExtra.totalInterest < normal.totalInterest,
    `normal=${normal.totalInterest.toFixed(0)} withExtra=${withExtra.totalInterest.toFixed(0)}`);

  const bigLumpsum = simulateLoan(P, rate, years, 0, P);
  ok('simulateLoan: a lumpsum equal to P pays off within ~2 years, not the safety limit',
    bigLumpsum.actualMonths <= 24,
    `actualMonths=${bigLumpsum.actualMonths}`);
}

// =====================================================================
// calcSIP
// =====================================================================
ok('calcSIP: zero-rate branch is exact',
  calcSIP(10000, 0, 10) === 10000 * 120,
  `got ${calcSIP(10000, 0, 10)}`);
ok('calcSIP: zero contribution gives zero corpus',
  calcSIP(0, 12, 20) === 0,
  `got ${calcSIP(0, 12, 20)}`);
ok('calcSIP: monotonically increasing in years',
  calcSIP(10000, 12, 10) < calcSIP(10000, 12, 20),
  `10yr=${calcSIP(10000,12,10).toFixed(0)} 20yr=${calcSIP(10000,12,20).toFixed(0)}`);
ok('calcSIP: monotonically increasing in cagr',
  calcSIP(10000, 9, 20) < calcSIP(10000, 15, 20),
  `9%=${calcSIP(10000,9,20).toFixed(0)} 15%=${calcSIP(10000,15,20).toFixed(0)}`);

// =====================================================================
// calcStepupSIP — cross-check against calcSIP at 0% step-up
// =====================================================================
// FINDING (see TASK-TEST-HARNESS.md and PHASE-1-REPORT.md): calcSIP's
// closed form is an annuity-DUE (contribution grows immediately, hence
// the trailing "* (1+r)" factor). calcStepupSIP's loop is
//   balance = balance*(1+r) + currentSIP
// which credits growth to the OLD balance first, then adds the new
// contribution un-grown — an ORDINARY annuity. These are two different,
// real interest-timing conventions, not equivalent formulas. At 0%
// step-up they do NOT converge to the same corpus. This test documents
// the measured gap rather than asserting equality — do not "fix" this
// test by loosening it further without addressing the underlying
// inconsistency (flagged, not silently patched, per the task brief's
// constraint against changing calculation output in this task).
{
  const monthly = 10000, cagr = 12, years = 20;
  const flat = calcSIP(monthly, cagr, years);
  const stepupAtZero = calcStepupSIP(monthly, 0, cagr, years).corpus;
  const diff = flat - stepupAtZero;
  const diffPct = (diff / flat) * 100;
  console.log(`  [finding] calcSIP(flat)=${flat.toFixed(0)} vs calcStepupSIP(0% stepup)=${stepupAtZero.toFixed(0)} — differ by ${diffPct.toFixed(2)}% (annuity-due vs ordinary-annuity timing convention)`);
  ok('calcStepupSIP @ 0% step-up: gap vs calcSIP is small and explained by timing convention, not a gross bug (<5%)',
    Math.abs(diffPct) < 5,
    `diff=${diffPct.toFixed(2)}% — if this grows much larger than one month's rate of return, something other than the known timing-convention gap is at play`);
}
ok('calcStepupSIP: 0% step-up final SIP equals starting SIP',
  approxEqual(calcStepupSIP(10000, 0, 12, 20).finalSIP, 10000, 0.01),
  `finalSIP=${calcStepupSIP(10000, 0, 12, 20).finalSIP}`);
ok('calcStepupSIP: step-up produces more corpus than flat SIP at same start/cagr/years',
  calcStepupSIP(10000, 10, 12, 20).corpus > calcStepupSIP(10000, 0, 12, 20).corpus,
  `stepup10%=${calcStepupSIP(10000,10,12,20).corpus.toFixed(0)} stepup0%=${calcStepupSIP(10000,0,12,20).corpus.toFixed(0)}`);

// =====================================================================
// calcIncomeTax — slab arithmetic is simple enough to hand-verify exactly
// =====================================================================
ok('calcIncomeTax: zero income -> zero tax (new)', calcIncomeTax(0, 'new') === 0);
ok('calcIncomeTax: negative income -> zero tax, no throw (new)', calcIncomeTax(-100000, 'new') === 0);

// New regime, taxable = 15,00,000 (above the 87A rebate cliff, so slabs actually apply):
// 0-4L@0%=0, 4-8L@5%=20000, 8-12L@10%=40000, 12-15L@15% on remaining 3L=45000
// slab total = 105000; cess 4% -> 105000*1.04 = 109200
ok('calcIncomeTax: new regime, taxable=15L -> exact hand-verified slab total',
  approxEqual(calcIncomeTax(1500000, 'new'), 109200, 0.01),
  `got ${calcIncomeTax(1500000, 'new')}, expected 109200`);

// Old regime, taxable = 10,00,000 (above its 87A cliff of 5L):
// 0-2.5L@0%=0, 2.5-5L@5%=12500, 5-10L@20% on remaining 5L=100000
// slab total = 112500; cess 4% -> 112500*1.04 = 117000
ok('calcIncomeTax: old regime, taxable=10L -> exact hand-verified slab total',
  approxEqual(calcIncomeTax(1000000, 'old'), 117000, 0.01),
  `got ${calcIncomeTax(1000000, 'old')}, expected 117000`);

// 87A rebate cliffs — exact per the coded thresholds
ok('calcIncomeTax: new regime 87A cliff, taxable=12,00,000 -> 0 tax',
  calcIncomeTax(1200000, 'new') === 0,
  `got ${calcIncomeTax(1200000, 'new')}`);
ok('calcIncomeTax: new regime 87A cliff, taxable=12,00,001 -> tax > 0',
  calcIncomeTax(1200001, 'new') > 0,
  `got ${calcIncomeTax(1200001, 'new')}`);
ok('calcIncomeTax: old regime 87A cliff, taxable=5,00,000 -> 0 tax',
  calcIncomeTax(500000, 'old') === 0,
  `got ${calcIncomeTax(500000, 'old')}`);
ok('calcIncomeTax: old regime 87A cliff, taxable=5,00,001 -> tax > 0',
  calcIncomeTax(500001, 'old') > 0,
  `got ${calcIncomeTax(500001, 'old')}`);

// =====================================================================
// calcIncomeTax — Section 87A marginal relief, new regime (R34 / D14)
// =====================================================================
// Without relief the ₹12L rebate is a cliff: slab tax at 12,00,000 is already
// ₹60,000, so earning ₹1 more would cost ₹62,400 (with cess). The law caps tax
// before cess at (taxable − 12,00,000) until slab tax falls back below it, at
// taxable = 12,00,000 + 60000/0.85 = 12,70,588.24.
const MARGINAL_RELIEF_BREAKEVEN = 1200000 + 60000 / 0.85; // 12,70,588.24

// Just above the threshold: relief binds hard — ₹1 of extra income costs ₹1.04,
// not the naive ₹62,400 of slab tax + cess.
ok('calcIncomeTax: 87A marginal relief, taxable=12,00,001 -> tax = excess + cess (not slab tax)',
  approxEqual(calcIncomeTax(1200001, 'new'), 1 * 1.04, 0.01),
  `got ${calcIncomeTax(1200001, 'new')}, expected ${1 * 1.04}`);

// Mid-band, hand-verified: excess = 10,000; slab tax = 60000 + 15% of 10,000
// = 61,500, so relief caps tax at 10,000 -> 10,400 with cess (naive: 63,960).
ok('calcIncomeTax: 87A marginal relief, taxable=12,10,000 -> 10,400 (naive slab would be 63,960)',
  approxEqual(calcIncomeTax(1210000, 'new'), 10400, 0.01),
  `got ${calcIncomeTax(1210000, 'new')}, expected 10400`);

// At the breakeven the two are equal, so relief neither binds nor changes anything:
// slab tax = 60000 + 0.15 * 70588.24 = 70588.24 = the excess itself.
ok('calcIncomeTax: 87A marginal relief, at the ~12,70,588 breakeven relief exactly ties slab tax',
  approxEqual(calcIncomeTax(MARGINAL_RELIEF_BREAKEVEN, 'new'), (MARGINAL_RELIEF_BREAKEVEN - 1200000) * 1.04, 0.01),
  `got ${calcIncomeTax(MARGINAL_RELIEF_BREAKEVEN, 'new')}`);

// Above the breakeven relief stops mattering — plain slab math returns.
// taxable = 13,00,000: 0-4L@0 + 4-8L@5%=20000 + 8-12L@10%=40000 + 1L@15%=15000
// = 75,000 slab; cess 4% -> 78,000. The excess (1,00,000) is larger, so no cap.
ok('calcIncomeTax: above breakeven (13L) -> full slab tax, relief no longer binds',
  approxEqual(calcIncomeTax(1300000, 'new'), 78000, 0.01),
  `got ${calcIncomeTax(1300000, 'new')}, expected 78000`);

// The whole point of marginal relief is that no extra rupee of income can ever
// reduce take-home. Sweep the band and assert tax never rises faster than income.
{
  let cliffFound = null;
  for (let t = 1195000; t <= 1300000; t += 1000) {
    const here = calcIncomeTax(t, 'new');
    const next = calcIncomeTax(t + 1000, 'new');
    if (next - here > 1000 * 1.04 + 0.01) { cliffFound = t; break; }
  }
  ok('calcIncomeTax: no cliff across the 87A band — tax never rises faster than income',
    cliffFound === null,
    cliffFound === null ? '' : `tax jumps by more than the income increase at taxable=${cliffFound}`);
}

// Old regime has no marginal-relief provision at its ₹5L rebate — its cliff is
// real law, not a bug, and R34 must not have "fixed" it. At 5,00,001 the tax is
// the full slab amount (12,500.20 + cess), not the ₹1 of excess.
ok('calcIncomeTax: old regime cliff is untouched by the new-regime relief fix',
  approxEqual(calcIncomeTax(500001, 'old'), 12500.2 * 1.04, 0.01),
  `got ${calcIncomeTax(500001, 'old')}, expected ${12500.2 * 1.04}`);

// =====================================================================
// calcPerquisite — exact lookup table, Income-tax Rules 2026 (R37 / D15)
// =====================================================================
// In force from 2026-04-01. These four assertions exist to *pin* the current
// statutory values, not to prove arithmetic — the function is a lookup table,
// so the only way it can go wrong is by holding stale law, which is exactly
// what happened before Phase 8b (it still returned the Rules 1962 figures
// ₹1,800 / ₹2,400 / ₹900 months after they were superseded). A failure here
// means someone changed the constants: check it against the Act before
// "fixing" the test.
ok('calcPerquisite: <=1.6L or EV, no driver -> 5000', calcPerquisite(false, false) === 5000,
  `got ${calcPerquisite(false, false)}`);
ok('calcPerquisite: >1.6L, no driver -> 7000', calcPerquisite(true, false) === 7000,
  `got ${calcPerquisite(true, false)}`);
ok('calcPerquisite: <=1.6L or EV, with driver -> 8000', calcPerquisite(false, true) === 8000,
  `got ${calcPerquisite(false, true)}`);
ok('calcPerquisite: >1.6L, with driver -> 10000', calcPerquisite(true, true) === 10000,
  `got ${calcPerquisite(true, true)}`);

// The chauffeur add-on must be a flat ₹3,000 regardless of engine size — a
// property the four point assertions above imply but don't state, and the one
// most likely to be broken by a careless edit to the ternaries.
ok('calcPerquisite: chauffeur add-on is a flat 3000, independent of engine size',
  calcPerquisite(false, true) - calcPerquisite(false, false) === 3000 &&
  calcPerquisite(true, true) - calcPerquisite(true, false) === 3000);

// None of the Rules 1962 values may survive anywhere in the table.
ok('calcPerquisite: no pre-2026 value (1800/2400/900/2700/3300) is still returned',
  ![1800, 2400, 900, 2700, 3300].some(stale =>
    [calcPerquisite(false, false), calcPerquisite(true, false),
     calcPerquisite(false, true), calcPerquisite(true, true)].includes(stale)));

// =====================================================================
// calcCarDepreciation
// =====================================================================
ok('calcCarDepreciation: year 1 is exactly 80% of price',
  calcCarDepreciation(1000000, 1) === 1000000 * 0.80,
  `got ${calcCarDepreciation(1000000, 1)}`);
ok('calcCarDepreciation: year 2 is exactly 80% * 85% of price',
  approxEqual(calcCarDepreciation(1000000, 2), 1000000 * 0.80 * 0.85, 0.0001),
  `got ${calcCarDepreciation(1000000, 2)}`);
ok('calcCarDepreciation: monotonically decreasing in years',
  calcCarDepreciation(1000000, 1) > calcCarDepreciation(1000000, 3) && calcCarDepreciation(1000000, 3) > calcCarDepreciation(1000000, 5),
  `y1=${calcCarDepreciation(1000000,1).toFixed(0)} y3=${calcCarDepreciation(1000000,3).toFixed(0)} y5=${calcCarDepreciation(1000000,5).toFixed(0)}`);
ok('calcCarDepreciation: zero price -> zero resale',
  calcCarDepreciation(0, 5) === 0);

// =====================================================================
// calcEMI — fv (balloon/residual) argument, Phase 9 / R38
// =====================================================================
// At fv=0, calcEMI must take the exact original 3-arg code path, so every
// existing caller stays bit-identical (not just algebraically equal — see
// the comment above calcEMI in calc.js for why that distinction matters).
function preFvCalcEMI(P, annualRate, years) {
  const r = annualRate / 12 / 100;
  const n = years * 12;
  if (r === 0) return P / n;
  return P * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1);
}
{
  const cases = [[1000000, 10, 1], [5000000, 8.75, 20], [1200000, 0, 10], [2000000, 9.5, 15]];
  const allBitIdentical = cases.every(([P, rate, years]) =>
    calcEMI(P, rate, years) === preFvCalcEMI(P, rate, years) &&
    calcEMI(P, rate, years, 0) === preFvCalcEMI(P, rate, years));
  ok('calcEMI: fv=0 (explicit or defaulted) is bit-identical to the pre-fv formula for every existing caller shape',
    allBitIdentical);
}

// Correctness oracle for the fv path: amortize month-by-month at the
// returned payment; the balance after n months must equal fv exactly.
function balanceAfterMonths(P, annualRate, emi, n, fv) {
  const r = annualRate / 12 / 100;
  let bal = P;
  for (let i = 0; i < n; i++) bal = bal + bal * r - emi;
  return bal;
}
{
  const P = 2000000, rate = 10, years = 4, fv = 200000;
  const emi = calcEMI(P, rate, years, fv);
  const n = years * 12;
  const terminalBalance = balanceAfterMonths(P, rate, emi, n, fv);
  ok('calcEMI: balloon path amortizes to exactly fv (₹20L @ 10% / 4yr / ₹2L residual)',
    approxEqual(emi, 47319.32, 0.01) && approxEqual(terminalBalance, fv, 0.01),
    `emi=${emi.toFixed(2)} (expected ~47319.32), terminalBalance=${terminalBalance.toFixed(4)} (expected ${fv})`);
}
ok('calcEMI: zero-rate balloon is exactly (P - fv) / n',
  calcEMI(1200000, 0, 10, 200000) === (1200000 - 200000) / 120,
  `got ${calcEMI(1200000, 0, 10, 200000)}`);
ok('calcEMI: 0% residual (fv=0 via 100% financing) equals the plain calcEMI result',
  calcEMI(2000000, 9, 4, 0) === calcEMI(2000000, 9, 4),
  `balloon-at-0=${calcEMI(2000000,9,4,0)} plain=${calcEMI(2000000,9,4)}`);

// =====================================================================
// calcInsuranceTotal — closed-form geometric series vs. year-by-year loop
// =====================================================================
function insuranceLoop(price, rate, depRate, years) {
  let total = 0, base = price;
  for (let y = 0; y < years; y++) {
    total += base * rate;
    base *= (1 - depRate);
  }
  return total;
}
{
  const price = 2000000, rate = 0.03, years = 5;
  const closedForm15 = calcInsuranceTotal(price, rate, 0.15, years);
  const loop15 = insuranceLoop(price, rate, 0.15, years);
  ok('calcInsuranceTotal: closed form matches year-by-year loop at dep=15%',
    approxEqual(closedForm15, loop15, 0.01),
    `closedForm=${closedForm15.toFixed(2)} loop=${loop15.toFixed(2)}`);

  const closedForm0 = calcInsuranceTotal(price, rate, 0, years);
  const loop0 = insuranceLoop(price, rate, 0, years);
  ok('calcInsuranceTotal: dep=0 guard matches year-by-year loop (flat rate x years)',
    approxEqual(closedForm0, loop0, 0.01) && closedForm0 === price * rate * years,
    `closedForm=${closedForm0.toFixed(2)} loop=${loop0.toFixed(2)} flat=${(price*rate*years).toFixed(2)}`);
}

// =====================================================================
// calcRunningCost
// =====================================================================
{
  const a = { cityKm: 8000, hwyKm: 4000, petrolPrice: 117, iceHwyMult: 1.35, homeRate: 8, publicRate: 20, evHwyMult: 1.15 };
  const ice = calcRunningCost('ICE', 15, a);
  ok('calcRunningCost: ICE perKm * totalKm == annual',
    approxEqual(ice.perKm * (a.cityKm + a.hwyKm), ice.annual, 0.01),
    `perKm=${ice.perKm.toFixed(4)} totalKm=${a.cityKm+a.hwyKm} product=${(ice.perKm*(a.cityKm+a.hwyKm)).toFixed(2)} annual=${ice.annual.toFixed(2)}`);

  const ev = calcRunningCost('EV', 15, a);
  ok('calcRunningCost: EV perKm * totalKm == annual',
    approxEqual(ev.perKm * (a.cityKm + a.hwyKm), ev.annual, 0.01),
    `perKm=${ev.perKm.toFixed(4)} totalKm=${a.cityKm+a.hwyKm} product=${(ev.perKm*(a.cityKm+a.hwyKm)).toFixed(2)} annual=${ev.annual.toFixed(2)}`);

  const zeroMileageRow = calcRunningCost('ICE', 0, { ...a, cityKm: 0, hwyKm: 0 });
  ok('calcRunningCost: zero-mileage/zero-efficiency row produces 0, never NaN/Infinity',
    zeroMileageRow.annual === 0 && zeroMileageRow.perKm === 0 &&
    isFinite(zeroMileageRow.annual) && isFinite(zeroMileageRow.perKm),
    `annual=${zeroMileageRow.annual} perKm=${zeroMileageRow.perKm}`);

  const zeroKmOnly = calcRunningCost('ICE', 15, { ...a, cityKm: 0, hwyKm: 0 });
  ok('calcRunningCost: zero total km with valid mileage still gives finite perKm (no div-by-zero)',
    isFinite(zeroKmOnly.perKm) && zeroKmOnly.perKm === 0,
    `perKm=${zeroKmOnly.perKm}`);
}

// =====================================================================
// calcLeaseNetCost
// =====================================================================
{
  const base = {
    price: 2000000, annualRate: 10, residualPct: 0.10, years: 4,
    hasDriver: false, marginalRate: 0.312,
    type: 'ICE', efficiency: 15,
    cityKm: 8000, hwyKm: 4000, petrolPrice: 117, iceHwyMult: 1.35,
    homeRate: 8, publicRate: 20, evHwyMult: 1.15,
    maintAnnual: 9000, insRate: 0.03, depRate: 0.15,
  };
  const result = calcLeaseNetCost({ ...base, bigEngine: true });
  ok('calcLeaseNetCost: netCost === rawOutflow - taxSaved (internal consistency)',
    approxEqual(result.netCost, result.rawOutflow - result.taxSaved, 0.01),
    `netCost=${result.netCost.toFixed(2)} rawOutflow-taxSaved=${(result.rawOutflow-result.taxSaved).toFixed(2)}`);
  ok('calcLeaseNetCost: netCostAfterResale === netCost - resaleValue',
    approxEqual(result.netCostAfterResale, result.netCost - result.resaleValue, 0.01));

  // Pin: the perquisite must come from calcPerquisite, not a flat/hardcoded
  // value (correction 2, R39) — a big-engine ICE row and an otherwise-
  // identical row (same price/EMI/running/maint/insurance, bigEngine=false,
  // as an EV row's perquisite bracket would compute) must differ in netCost
  // by exactly marginalRate * (7000-5000) * months = 2000 * 0.312 * 48 = 29952.
  const normalPerq = calcLeaseNetCost({ ...base, bigEngine: false });
  const expectedGap = 2000 * base.marginalRate * (base.years * 12);
  ok('calcLeaseNetCost: perquisite sourced from calcPerquisite — big-engine vs. <=1.6L/EV bracket differ by exactly marginalRate*2000*months (₹29,952 at defaults)',
    approxEqual(result.netCost - normalPerq.netCost, expectedGap, 0.01),
    `diff=${(result.netCost-normalPerq.netCost).toFixed(2)} expected=${expectedGap.toFixed(2)}`);
  ok('calcLeaseNetCost: ₹29,952 pin holds at the stated defaults (31.2% marginal rate, 4yr)',
    approxEqual(expectedGap, 29952, 0.01), `got ${expectedGap}`);

  // taxSaved stays signed (not clamped) — a below-perquisite EMI is a real
  // negative, not a bug to hide.
  const tinyLease = calcLeaseNetCost({ ...base, price: 100000, bigEngine: false });
  ok('calcLeaseNetCost: taxSaved can be negative (EMI below perquisite) and is not clamped to 0',
    tinyLease.taxSaved < 0, `taxSaved=${tinyLease.taxSaved.toFixed(2)}`);
}

// =====================================================================
// calcOwnershipCurve (Phase 13, R49) — the cost-vs-value chart's engine.
// Reference case (₹20L ICE, 10% residual, 10% rate, 4yr, app defaults —
// the same `base`/bigEngine:false shape as calcLeaseNetCost's own pin
// above) was verified by hand before this spec was written: endpoint
// 2406795.0641, gap 1424195.0641.
// =====================================================================
{
  const base = {
    price: 2000000, annualRate: 10, residualPct: 0.10, years: 4,
    hasDriver: false, marginalRate: 0.312, bigEngine: false,
    type: 'ICE', efficiency: 15,
    cityKm: 8000, hwyKm: 4000, petrolPrice: 117, iceHwyMult: 1.35,
    homeRate: 8, publicRate: 20, evHwyMult: 1.15,
    maintAnnual: 9000, insRate: 0.03, depRate: 0.15,
  };
  const curve = calcOwnershipCurve(base);
  const net = calcLeaseNetCost(base);
  const last = curve.years.length - 1;

  ok('calcOwnershipCurve: reference case endpoint pins to 2406795.0641',
    approxEqual(curve.cumulativeCost[last], 2406795.0641, 0.01),
    `got ${curve.cumulativeCost[last].toFixed(4)}`);
  ok('calcOwnershipCurve: reference case gap pins to 1424195.0641',
    approxEqual(curve.cumulativeCost[last] - curve.carValue[last], 1424195.0641, 0.01),
    `got ${(curve.cumulativeCost[last] - curve.carValue[last]).toFixed(4)}`);

  ok('calcOwnershipCurve: cumulativeCost[N-1] === calcLeaseNetCost netCost — the curve\'s endpoint IS the card\'s headline',
    approxEqual(curve.cumulativeCost[last], net.netCost, 0.01),
    `curve=${curve.cumulativeCost[last].toFixed(4)} netCost=${net.netCost.toFixed(4)}`);
  ok('calcOwnershipCurve: cumulativeCost[N-1] - carValue[N-1] === netCostAfterResale — the gap IS the reveal figure',
    approxEqual(curve.cumulativeCost[last] - curve.carValue[last], net.netCostAfterResale, 0.01),
    `gap=${(curve.cumulativeCost[last]-curve.carValue[last]).toFixed(4)} netCostAfterResale=${net.netCostAfterResale.toFixed(4)}`);

  let costRising = true, valueFalling = true;
  for (let i = 1; i < curve.years.length; i++) {
    if (curve.cumulativeCost[i] <= curve.cumulativeCost[i-1]) costRising = false;
    if (curve.carValue[i] >= curve.carValue[i-1]) valueFalling = false;
  }
  ok('calcOwnershipCurve: cumulativeCost is strictly rising year over year', costRising,
    `values=${curve.cumulativeCost.map(v=>v.toFixed(0))}`);
  ok('calcOwnershipCurve: carValue is strictly falling year over year', valueFalling,
    `values=${curve.carValue.map(v=>v.toFixed(0))}`);

  // N=1: a single point, no crossing to speak of — must still compute
  // finite values and agree with calcLeaseNetCost at the one point.
  const single = calcOwnershipCurve({ ...base, years: 1 });
  const singleNet = calcLeaseNetCost({ ...base, years: 1 });
  ok('calcOwnershipCurve: N=1 produces exactly one point',
    single.years.length === 1 && single.cumulativeCost.length === 1 && single.carValue.length === 1,
    `years.length=${single.years.length}`);
  ok('calcOwnershipCurve: N=1 endpoint still matches calcLeaseNetCost at the same tenure',
    approxEqual(single.cumulativeCost[0], singleNet.netCost, 0.01),
    `curve=${single.cumulativeCost[0].toFixed(4)} netCost=${singleNet.netCost.toFixed(4)}`);
  ok('calcOwnershipCurve: N=1 values are finite (no NaN/Infinity)',
    isFinite(single.cumulativeCost[0]) && isFinite(single.carValue[0]));

  // Zero-rate case: calcEMI's r===0 branch, still no NaN/Infinity and
  // still agrees with calcLeaseNetCost at the endpoint.
  const zeroRate = calcOwnershipCurve({ ...base, annualRate: 0 });
  const zeroRateNet = calcLeaseNetCost({ ...base, annualRate: 0 });
  ok('calcOwnershipCurve: zero-rate case is finite throughout',
    zeroRate.cumulativeCost.every(isFinite) && zeroRate.carValue.every(isFinite),
    `cumulativeCost=${zeroRate.cumulativeCost}`);
  ok('calcOwnershipCurve: zero-rate case endpoint still matches calcLeaseNetCost',
    approxEqual(zeroRate.cumulativeCost[zeroRate.years.length-1], zeroRateNet.netCost, 0.01),
    `curve=${zeroRate.cumulativeCost[zeroRate.years.length-1].toFixed(4)} netCost=${zeroRateNet.netCost.toFixed(4)}`);
}

// =====================================================================
// calcBreakevenKm — three distinct outcomes
// =====================================================================
ok('calcBreakevenKm: EV never cheaper per km (denom<=0) -> null, not Infinity/NaN',
  calcBreakevenKm(100000, 6, 200000, 5, 4) === null,
  `got ${calcBreakevenKm(100000, 6, 200000, 5, 4)}`);
{
  const alreadyCheaper = calcBreakevenKm(100000, 2, 200000, 5, 4);
  ok('calcBreakevenKm: EV fixed cost already lower -> a value <= 0, never a positive "needs more km" figure',
    alreadyCheaper !== null && alreadyCheaper <= 0,
    `got ${alreadyCheaper}`);
}
{
  const needsMore = calcBreakevenKm(300000, 2, 200000, 5, 4);
  ok('calcBreakevenKm: normal case -> a positive breakeven km/yr',
    approxEqual(needsMore, 8333.33, 0.01),
    `got ${needsMore}`);
}

// =====================================================================
// SUMMARY
// =====================================================================
console.log(`\n${pass} passed, ${fail} failed (${pass + fail} total)`);
if (fail > 0) {
  console.log('\nFAILURES:');
  failures.forEach(f => console.log(`  ✗ ${f.name}\n    ${f.detail}`));
  process.exit(1);
} else {
  console.log('All tests passed.');
  process.exit(0);
}
