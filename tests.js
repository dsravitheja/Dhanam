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
  calcIncomeTax, calcPerquisite, calcCarDepreciation
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
// calcPerquisite — exact lookup table per IT Rule 3(2)
// =====================================================================
ok('calcPerquisite: small engine, no driver -> 1800', calcPerquisite(false, false) === 1800);
ok('calcPerquisite: big engine, no driver -> 2400', calcPerquisite(true, false) === 2400);
ok('calcPerquisite: small engine, with driver -> 2700', calcPerquisite(false, true) === 2700);
ok('calcPerquisite: big engine, with driver -> 3300', calcPerquisite(true, true) === 3300);

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
