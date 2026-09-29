// =====================================================================
// PURE FINANCIAL CALCULATIONS
// =====================================================================
// Every function here takes plain arguments and returns a plain value
// or object — no DOM access (no document/el/v/chk/set calls). That's
// what makes them safe to load both in the browser (via <script src>
// in index.html) and in plain Node for the test harness (tests.js),
// with no bundler and no npm dependency either way.
//
// Do not add DOM-coupled code to this file. Render/UI logic belongs in
// index.html's inline <script>, next to the render* functions that call
// into these.

// ── LOAN ──────────────────────────────────────────────────────────
// fv (default 0): balance still owed at the end of the term — a lease's
// residual/balloon buyout. At fv=0 this takes the exact original 3-arg
// code path (not just an algebraically-equivalent one), so every existing
// caller (loanAtYear, simulateLoan, renderLoans, renderAdvLoan,
// renderCarLoan, renderLoanDisb, renderWorthProjection) is bit-identical.
function calcEMI(P, annualRate, years, fv = 0) {
  const r = annualRate / 12 / 100;
  const n = years * 12;
  if (fv === 0) {
    if (r === 0) return P / n;
    return P * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1);
  }
  if (r === 0) return (P - fv) / n;
  return r * (P * Math.pow(1+r, n) - fv) / (Math.pow(1+r, n) - 1);
}

function loanAtYear(P, annualRate, totalYears, checkYear) {
  const r = annualRate / 12 / 100;
  const n = totalYears * 12;
  const k = Math.min(checkYear * 12, n);
  const emi = calcEMI(P, annualRate, totalYears);
  let balance;
  if (r === 0) {
    balance = P - (P / n) * k;
  } else {
    balance = P * (Math.pow(1+r, n) - Math.pow(1+r, k)) / (Math.pow(1+r, n) - 1);
  }
  balance = Math.max(0, balance);
  const principalPaid = P - balance;
  const interestPaid = emi * k - principalPaid;
  return { balance, principalPaid, interestPaid: Math.max(0, interestPaid), totalPaid: emi * k };
}

function simulateLoan(P, annualRate, totalYears, extraEmiPerYear, extraLumpsumPerYear) {
  const r = annualRate / 12 / 100;
  const n = totalYears * 12;
  const emi = calcEMI(P, annualRate, totalYears);
  let balance = P;
  let month = 0;
  let totalInterest = 0;
  let y5Principal = 0, y5Interest = 0, y5Captured = false;
  const safetyLimit = n * 3;

  while (balance > 0.01 && month < safetyLimit) {
    month++;
    const interest = balance * r;
    const principal = Math.min(emi - interest, balance);
    balance = Math.max(0, balance - principal);
    totalInterest += interest;

    // Extra at end of each year
    if (month % 12 === 0 && balance > 0) {
      const extra = Math.min(extraEmiPerYear * emi + extraLumpsumPerYear, balance);
      balance = Math.max(0, balance - extra);
    }

    if (month === 60 && !y5Captured) {
      y5Principal = P - balance;
      y5Interest = totalInterest;
      y5Captured = true;
    }
    if (balance <= 0.01) break;
  }

  if (!y5Captured) { y5Principal = P; y5Interest = totalInterest; }

  return {
    actualMonths: month,
    actualYears: (month / 12).toFixed(1),
    totalInterest: Math.max(0, totalInterest),
    totalPaid: P + Math.max(0, totalInterest),
    y5Principal,
    y5Interest: Math.max(0, y5Interest),
    monthsSaved: Math.max(0, n - month),
    yearsSaved: Math.max(0, (n - month) / 12).toFixed(1),
  };
}

// ── SIP / INVESTMENT ──────────────────────────────────────────────
function calcSIP(monthly, annualCagr, years) {
  const r = annualCagr / 12 / 100;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

function calcStepupSIP(startMonthly, annualStepupPct, annualCagr, years) {
  const r = annualCagr / 12 / 100;
  let balance = 0, totalInvested = 0, currentSIP = startMonthly;
  for (let yr = 1; yr <= years; yr++) {
    for (let mo = 0; mo < 12; mo++) {
      balance = balance * (1 + r) + currentSIP;
      totalInvested += currentSIP;
    }
    currentSIP *= (1 + annualStepupPct / 100);
  }
  return { corpus: balance, totalInvested, finalSIP: currentSIP / (1 + annualStepupPct / 100) };
}

// ── DHANAM CAR ────────────────────────────────────────────────────
function calcIncomeTax(annualTaxable, regime) {
  if (annualTaxable <= 0) return 0;
  let tax = 0;
  if (regime === 'new') {
    const slabs = [[400000,0],[400000,.05],[400000,.10],[400000,.15],[400000,.20],[400000,.25],[Infinity,.30]];
    let remaining = annualTaxable;
    for (const [size, rate] of slabs) {
      if (remaining <= 0) break;
      const chunk = Math.min(remaining, size);
      tax += chunk * rate;
      remaining -= chunk;
    }
    if (annualTaxable <= 1200000) {
      tax = 0; // 87A rebate, new regime
    } else {
      // Section 87A marginal relief: just past the ₹12L rebate threshold, the
      // slab tax (₹60,000 at 12L) exceeds the extra income earned, so the law
      // caps tax at the excess over ₹12,00,000 instead of letting a cliff form.
      // Relief is computed on tax *before* cess; cess then applies to the
      // relieved figure. Stops binding at ~₹12,70,588, where slab tax first
      // falls back below the excess (60000 + 0.15x <= x  =>  x >= 60000/0.85).
      tax = Math.min(tax, annualTaxable - 1200000);
    }
  } else {
    const slabs = [[250000,0],[250000,.05],[500000,.20],[Infinity,.30]];
    let remaining = annualTaxable;
    for (const [size, rate] of slabs) {
      if (remaining <= 0) break;
      const chunk = Math.min(remaining, size);
      tax += chunk * rate;
      remaining -= chunk;
    }
    if (annualTaxable <= 500000) tax = 0; // 87A rebate old regime
  }
  return tax * 1.04; // 4% cess
}

// Motor-car perquisite, monthly. Income-tax Rules, 2026 (under the Income-tax
// Act, 2025) — CBDT-notified 2026-03-20, in force from 2026-04-01. Models the
// row this app's car hub actually describes: car owned/hired by the employer,
// running and maintenance met by the employer, partly personal use.
//
// Superseded the Income-tax Rules, 1962 figures (₹1,800 / ₹2,400 / ₹900 driver)
// that this function returned until Phase 8b — roughly a 3× increase. The
// ≤1.6-litre bracket explicitly covers electric vehicles, which is why an EV
// belongs in the `bigEngine = false` branch regardless of motor size.
//
// Tier-2 statutory data: never persisted, always re-read from here (see
// CLAUDE.md's persistence rules). If a later Finance Act moves these, change
// them here and update the as-of date in index.html's caveat list.
function calcPerquisite(bigEngine, hasDriver) {
  return (bigEngine ? 7000 : 5000) + (hasDriver ? 3000 : 0);
}

function calcCarDepreciation(price, years) {
  let val = price * 0.80; // 20% drop year 1
  for (let y = 1; y < years; y++) val *= 0.85; // 15%/yr thereafter
  return val;
}

// ── DHANAM CAR — COMPARE CARS (Phase 9) ────────────────────────────
// Running-cost constants, frozen out of the old editable Assumptions card
// (as of 2026-09-25; moved from the editable Assumptions card, values
// unchanged) — the simplified Compare Cars only exposes petrol price, home
// charging rate, and annual km as user-editable running-cost inputs; the
// rest reload from here every render, never persisted (CLAUDE.md's tier-2
// rule). Dated on the About page provenance list.
const CAR_RUNNING_DEFAULTS = Object.freeze({
  cityShare: 2 / 3,   // of annual km driven in the city (the old 8,000 : 4,000 default split)
  iceHwyMult: 1.35, evHwyMult: 1.15,
  publicRate: 20,     // ₹/unit public fast charging, as of Aug 2026
  iceMaint: 9000, evMaint: 4500,
  iceIns: 0.030, evIns: 0.038,
  depRate: 0.15,
});

// Splits one annual-km figure into city/highway shares at CAR_RUNNING_DEFAULTS'
// fixed 2:1 ratio. Non-finite or negative input degrades to zeros rather than
// NaN/negative km reaching calcRunningCost.
function splitAnnualKm(annualKm) {
  const km = Number.isFinite(annualKm) && annualKm > 0 ? annualKm : 0;
  const cityKm = km * CAR_RUNNING_DEFAULTS.cityShare;
  return { cityKm, hwyKm: km - cityKm };
}

// EV efficiency in kWh/100km, derived from a claimed range and battery size —
// the two figures on an EV's spec sheet, rather than asking for kWh/100km
// directly. 0 unless both inputs are genuinely positive (never NaN/Infinity).
function evEfficiencyFromRange(rangeKm, batteryKwh) {
  if (!(rangeKm > 0) || !(batteryKwh > 0)) return 0;
  return 100 * batteryKwh / rangeKm;
}

// Fuel/energy running cost, annualized. City and highway km are modeled
// separately because ICE mileage improves on the highway while EV
// efficiency worsens on it (aero drag dominates at speed). `type` is
// 'ICE' or 'EV'; `efficiency` is kmpl for ICE, kWh/100km for EV.
// a = { cityKm, hwyKm, petrolPrice, iceHwyMult, homeRate, publicRate, evHwyMult }
function calcRunningCost(type, efficiency, a) {
  const totalKm = a.cityKm + a.hwyKm;
  let annual = 0;
  if (type === 'EV') {
    annual = a.cityKm * (efficiency / 100) * a.homeRate
           + a.hwyKm * (efficiency * a.evHwyMult / 100) * a.publicRate;
  } else if (efficiency > 0) {
    annual = (a.cityKm / efficiency) * a.petrolPrice
           + (a.hwyKm / (efficiency * a.iceHwyMult)) * a.petrolPrice;
  }
  const perKm = totalKm > 0 ? annual / totalKm : 0;
  return { annual, perKm };
}

// Insurance as % of on-road price, decaying with assumed IDV depreciation,
// summed as a geometric series in closed form (not a year-by-year loop).
// depRate === 0 degenerates to a flat rate × years (the series formula is
// 0/0 there — a value a user can type into the assumptions card).
function calcInsuranceTotal(price, rate, depRate, years) {
  if (depRate === 0) return price * rate * years;
  return price * rate * (1 - Math.pow(1 - depRate, years)) / depRate;
}

// The car-ownership engine: one car, one tenure, one financing mode, full
// net-cost breakdown. Phase 14 (R55) generalises what used to be
// calcLeaseNetCost (Phase 9) into three capital layers on top of the same
// running-cost/maintenance/insurance/depreciation engine — TCO is
// financing-agnostic; lease/loan/cash only change how the capital and tax
// terms are computed. Renamed rather than kept as a lease-only alias: this
// is called from renderCarCompare()/ccComputedRows() and pinned by tests, so
// every call site was updated deliberately, not shimmed.
//
// o.mode: 'lease' | 'loan' | 'cash' (defaults to 'lease' if omitted, so a
// caller that hasn't been updated to pass mode still gets the exact
// pre-Phase-14 behavior).
//   lease: emi = calcEMI(price, rate, N, residual); capital = emi*months + residual;
//          taxSaved = marginalRate * (emi - calcPerquisite(bigEngine,hasDriver)) * months
//          — bit-identical to the old calcLeaseNetCost for the same inputs.
//   loan:  emi = calcEMI(price - downPayment, rate, N, 0); capital = downPayment + emi*months;
//          taxSaved = 0 — Indian law allows no deduction on a personal car loan;
//          this is correct, not an omission (see index.html's caveat list).
//   cash:  emi = 0; capital = price; taxSaved = 0 (same reasoning as loan).
// All modes: netCost = capital + runningTotal + maintTotal + insTotal - taxSaved;
//            resaleValue = calcCarDepreciation(price, N) — reveal-only in every
//            mode (Phase 13's rule), never a default headline line.
//
// taxSaved is deliberately signed in lease mode — an EMI below the
// perquisite means the carve-out taxes you on more than it saves, and
// clamping that to 0 would hide a real negative rather than fix a bug (see
// R39's blank-row guard, which is the actual fix for the workbook's
// analogous symptom).
function calcOwnershipCost(o) {
  const mode = o.mode || 'lease';
  const months = o.years * 12;
  let emi, capital, taxSaved, residual = 0, downPayment = 0;
  if (mode === 'loan') {
    downPayment = o.downPayment || 0;
    const principal = Math.max(0, o.price - downPayment);
    emi = calcEMI(principal, o.annualRate, o.years, 0);
    capital = downPayment + emi * months;
    taxSaved = 0;
  } else if (mode === 'cash') {
    emi = 0;
    capital = o.price;
    taxSaved = 0;
  } else { // lease
    residual = o.price * o.residualPct;
    emi = calcEMI(o.price, o.annualRate, o.years, residual);
    capital = emi * months + residual;
    const perq = calcPerquisite(o.bigEngine, o.hasDriver);
    taxSaved = o.marginalRate * (emi - perq) * months;
  }
  const { annual: runAnnual } = calcRunningCost(o.type, o.efficiency, {
    cityKm: o.cityKm, hwyKm: o.hwyKm, petrolPrice: o.petrolPrice,
    iceHwyMult: o.iceHwyMult, homeRate: o.homeRate, publicRate: o.publicRate,
    evHwyMult: o.evHwyMult,
  });
  const runningTotal = runAnnual * o.years;
  const maintTotal = o.maintAnnual * o.years;
  const insTotal = calcInsuranceTotal(o.price, o.insRate, o.depRate, o.years);
  const rawOutflow = capital + runningTotal + maintTotal + insTotal;
  const netCost = rawOutflow - taxSaved;
  const resaleValue = calcCarDepreciation(o.price, o.years);
  const netCostAfterResale = netCost - resaleValue;
  const totalKm = (o.cityKm + o.hwyKm) * o.years;
  const costPerKm = totalKm > 0 ? netCost / totalKm : 0;
  return {
    mode, emi, months, capital, residual, downPayment,
    runningTotal, maintTotal, insTotal, taxSaved,
    rawOutflow, netCost, resaleValue, netCostAfterResale, costPerKm,
  };
}

// A lease carve-out's tax shield, and the exact marginal rate that produces
// it — R76 (Phase 22), answering D17's "the marginal rate is entered twice"
// finding. Three call sites in index.html (the "why a lease?" glance, Compare
// Cars' ccOwnershipInput(), and the cross-mode card) each used to run this
// same emi→perquisite→shield→rate sequence inline; factored here into one
// pure function, all three read it from calc.js instead of three
// independently-maintained copies (code review, Phase 22 — the original
// three copies were a real risk: a future fix to this formula applied to
// only one or two of them would have silently reintroduced the exact
// two-different-costs-for-one-lease bug this phase exists to fix).
//
// The marginal rate is the EXACT incremental tax rate over the specific
// rupee band the shield removes from taxable income — (tax on full income −
// tax on shielded income) / shield — not a flat slab-rate lookup. That's
// what reproduces the new regime's §87A marginal-relief dip (D17) instead
// of smoothing over it. `epfAnnual` only matters for the old regime's 80C
// cap (mirrors calcIncomeTax's own callers elsewhere in this file); pass 0
// for a caller with no EPF figure of its own (the glance, deliberately —
// see its own comment in index.html for why it doesn't collect one).
//
// Bounded at 150% (`MAX_MARGINAL_RATE`): the old regime's ₹5,00,000
// exemption is a hard cliff, not a smooth taper (CLAUDE.md's own note on
// why that cliff must stay one) — if the shield happens to straddle it
// while being very small, (tax jump)/(tiny shield) is unbounded as the
// shield shrinks toward zero, which would print a nonsensical rate (and,
// fed back into `calcOwnershipCost`'s `marginalRate * (emi - perq) *
// months`, a wildly wrong net cost) for what is a real but numerically
// unstable edge of the law, not a meaningfully different tax outcome. The
// new regime's own legitimate peak (the §87A relief band, where the
// marginal rate is a flat, exact 104% including cess) sits well under this
// cap and is never touched by it.
// Standard deduction (FY2025-26 — ₹75,000 new regime / ₹50,000 old regime)
// and the old regime's ₹1,50,000 80C cap on EPF, applied to gross pay plus
// any extra taxable amount (a lease carve-out's perquisite, e.g.) landing
// before the floor at 0. Shared by calcLeaseMarginalRate() below and
// index.html's renderCarCalc()/scenarioCalc() (code review, Phase 22 third
// pass — these used to be two independently-maintained copies of the same
// formula; a future Finance Act change to either figure applied to only one
// would silently reintroduce the exact two-different-costs-for-one-lease
// bug R76 was filed to eliminate). Statutory figures — date them, per
// CLAUDE.md's "Statutory constants rot silently" rule.
function calcTaxableIncome(grossAnnual, regime, epfAnnual = 0, extraIncome = 0) {
  const stdDed = regime === 'new' ? 75000 : 50000;
  const deduction80C = regime === 'old' ? Math.min(epfAnnual, 150000) : 0;
  return Math.max(0, grossAnnual - stdDed - deduction80C + extraIncome);
}

const MAX_MARGINAL_RATE = 1.5;
// New regime's §87A marginal-relief ceiling — the point where slab tax falls
// back below (taxable − 12L), so relief stops binding. Same value calcIncomeTax's
// own comment derives (60000/0.85 above ₹12L). Shared here so rebateBoost below
// and a future caller can't hand-copy a slightly different constant.
const RELIEF_CEILING = 1200000 + 60000 / 0.85; // ≈ 12,70,588.24
function calcLeaseMarginalRate(price, annualRate, residualPct, years, bigEngine, hasDriver, grossAnnual, regime, epfAnnual = 0) {
  const residual = price * residualPct;
  const leaseEmi = calcEMI(price, annualRate, years, residual);
  const perq = calcPerquisite(bigEngine, hasDriver);
  const shieldAnnual = (leaseEmi - perq) * 12; // signed — never clamped (R75)
  const taxableFull = calcTaxableIncome(grossAnnual, regime, epfAnnual);
  const taxableShielded = Math.max(0, taxableFull - shieldAnnual);
  // zeroTax is the genuine "you pay no tax at this income" fact — tax on
  // taxableFull alone, independent of the shield. `marginalRate` can't carry
  // this: it's 0 whenever shieldAnnual happens to be exactly 0 (leaseEmi ===
  // perq, a coincidence of price/rate/residual with nothing to do with the
  // user's tax bracket), which a caller must not read as "pays no tax" (code
  // review, Phase 22, second pass) — that 0/0 case gets its own message.
  const zeroTax = calcIncomeTax(taxableFull, regime) === 0;
  const marginalRate = shieldAnnual
    ? Math.min((calcIncomeTax(taxableFull, regime) - calcIncomeTax(taxableShielded, regime)) / shieldAnnual, MAX_MARGINAL_RATE)
    : 0;
  // The lease's shield can pull taxable income down into the §87A relief
  // band — that boosts the saving, not shrinks it (it tapers off again just
  // above the ceiling). Additive on the return value, not a replacement for
  // marginalRate: a caller states this as its own sentence, only when true.
  const rebateBoost = regime === 'new' && taxableFull > 1200000 && taxableShielded <= RELIEF_CEILING;
  return { leaseEmi, perq, shieldAnnual, marginalRate, zeroTax, rebateBoost };
}

// Lumpsum growth at a flat CAGR — P*(1+cagr/100)^years. Extracted for
// Compare Cars' cash-mode opportunity-cost reveal (B13, Phase 14/R58): what
// the cash tied up in the car would have been worth if invested instead.
// The Grow hub's lumpsum tab (updateLumpsum) computes this same formula
// inline today; it is NOT refactored to call this (out of scope for R55) —
// this is one implementation for Compare Cars' new use, not yet the only one
// in the codebase.
function calcLumpsumGrowth(P, annualCagr, years) {
  return P * Math.pow(1 + annualCagr / 100, years);
}

// Annual km at which an EV's net cost drops below a reference ICE car's,
// given each car's already-computed km-independent "fixed" cost (from
// calcLeaseNetCost — netCost minus its own runningTotal) and its running
// cost per km (from calcRunningCost). Three distinct outcomes, since a
// single number can't represent "never" or "already":
//   denom <= 0 (EV costs more per km, so it never catches up) → null
//   result <= 0 (EV's fixed cost is already lower)             → that value (<=0)
//   otherwise                                                  → the breakeven km/yr
function calcBreakevenKm(evFixed, evPerKm, iceFixed, icePerKm, years) {
  const denom = years * (icePerKm - evPerKm);
  if (denom <= 0) return null;
  return (evFixed - iceFixed) / denom;
}

// Cumulative-cost-vs-car-value curve for one car over its full term (Phase 13,
// R49; generalised to loan/cash in Phase 14, R55). Two series on a shared
// rupee scale: cumulativeCost rises (money spent so far), carValue falls
// (what the car is worth so far) — the gap between them at year N is exactly
// `netCostAfterResale`, and cumulativeCost's own endpoint is exactly
// `netCost`. That's not a coincidence to maintain by hand: both are derived
// from the same capital/running/maintenance/insurance/tax-saved terms
// `calcOwnershipCost` already uses, just accumulated year by year instead of
// summed once at the full term.
//
// The EMI is computed ONCE at the full term (`o.years`), not re-derived per
// year by calling calcOwnershipCost with a shorter `years` — that would price
// a *different* loan/lease at each point (a 2-year term's EMI differs from
// being 2 years into a 4-year one) and the curve would silently stop
// agreeing with the card's headline number. Only the accumulation (× y)
// varies by year.
//
// Per-mode capital accumulation at year y (mirrors calcOwnershipCost):
//   lease: emi*12*y, plus the residual buyout landing entirely in the final year
//   loan:  downPayment (paid at t=0, so present in full from year 1) + emi*12*y
//   cash:  price (fully spent at t=0, so a flat term at every year — no EMI)
// taxSaved only exists in lease mode (o.mode !== 'lease' => 0 throughout).
//
// o = { mode ('lease'|'loan'|'cash', defaults 'lease'), price, annualRate,
//       years (N), residualPct (lease), downPayment (loan), type, efficiency,
//       cityKm, hwyKm, petrolPrice, iceHwyMult, homeRate, publicRate,
//       evHwyMult, maintAnnual, insRate, depRate, marginalRate (lease),
//       bigEngine, hasDriver }
function calcOwnershipCurve(o) {
  const N = o.years;
  const mode = o.mode || 'lease';
  let emi = 0, residual = 0, downPayment = 0, perq = 0;
  if (mode === 'loan') {
    downPayment = o.downPayment || 0;
    const principal = Math.max(0, o.price - downPayment);
    emi = calcEMI(principal, o.annualRate, N, 0); // fixed at full term
  } else if (mode === 'cash') {
    emi = 0; // no financing — the whole price is capital, spent at t=0
  } else { // lease
    residual = o.price * o.residualPct;
    emi = calcEMI(o.price, o.annualRate, N, residual); // fixed at full term
    perq = calcPerquisite(o.bigEngine, o.hasDriver);
  }
  const { annual: runAnnual } = calcRunningCost(o.type, o.efficiency, {
    cityKm: o.cityKm, hwyKm: o.hwyKm, petrolPrice: o.petrolPrice,
    iceHwyMult: o.iceHwyMult, homeRate: o.homeRate, publicRate: o.publicRate,
    evHwyMult: o.evHwyMult,
  });
  const years = [], cumulativeCost = [], carValue = [];
  for (let y = 1; y <= N; y++) {
    years.push(y);
    let capitalAtY;
    if (mode === 'loan') capitalAtY = downPayment + emi * 12 * y;
    else if (mode === 'cash') capitalAtY = o.price;
    else capitalAtY = emi * 12 * y + (y === N ? residual : 0);
    const taxSavedAtY = mode === 'lease' ? o.marginalRate * (emi - perq) * 12 * y : 0;
    cumulativeCost.push(
      capitalAtY
      + runAnnual * y
      + o.maintAnnual * y
      + calcInsuranceTotal(o.price, o.insRate, o.depRate, y)
      - taxSavedAtY
    );
    carValue.push(calcCarDepreciation(o.price, y));
  }
  return { years, cumulativeCost, carValue };
}

// ── DHANAM CAR — BUY A CAR / ON-ROAD COST (Wave 0, CR1, 2026-09-29) ───
// Tier-2 statutory/indicative constants for "what will this car really
// cost me at the dealer" — road tax (state motor vehicle tax), one-time
// registration/other charges, and TCS on high-value vehicles. Same posture
// as PROPERTY_STATES (index.html, R21): dated, editable, non-exhaustive,
// re-read from here every render, never persisted (CLAUDE.md's tier-2
// rule). Every figure not marked 'confirmed' below is a defensible
// indicative value, not a verified statutory one — see
// TASK-CAR-REDESIGN.md's "CR1 research notes" section for sources.
//
// A single % of ex-showroom price is an acknowledged simplification: most
// states actually compute lifetime/road tax on the ex-showroom price
// *including* GST, a few (West Bengal) use flat fee tables keyed by engine
// cc rather than a price %, and some layer a further cess on top of the
// base tax (Karnataka's 11% Section-3 cess — modeled below via
// `taxCessMultiplier`, not skipped). This app models one flat, editable %
// — the same indicative posture as the stamp-duty table, stated as a
// caveat, not computed to false precision.
//
// Slab boundary convention (applies to every `slabs`/`fuelSlabs` table
// below): each `[upToExShowroom, pct]` entry's `upToExShowroom` is an
// EXCLUSIVE upper bound — a price standing exactly AT that boundary
// belongs to the NEXT (higher) slab, not this one (`resolveSlabPct` tests
// `exShowroom < upTo`). Chosen because every state whose source explicitly
// phrases the boundary (Delhi: "below ₹6L" / "at ₹10L and above";
// Maharashtra: ">=₹10L"; Tamil Nadu: "at/above ₹10L") puts the exact
// boundary price in the HIGHER band — applied uniformly here even for
// states whose own source phrasing didn't resolve the boundary explicitly
// (Telangana, Karnataka, Andhra Pradesh, Uttar Pradesh), rather than
// mixing conventions table to table. Pinned in tests.js at an exact
// boundary.
//
// Per-state shape:
//   slabs: [[upToExShowroom, pct], ...] ascending, last entry Infinity —
//     used when the state taxes every fuel type alike (fuelUniform: true)
//     or as the petrol/base figure that dieselSurchargePct / dieselMultiplier
//     / cngAdjPct / taxCessMultiplier adjust.
//   fuelSlabs: { petrol, diesel, cng } — for a state whose published rates
//     are entirely separate slab tables per fuel (none currently use this;
//     kept for a future state where `slabs` + a surcharge/multiplier isn't
//     an honest fit).
//   dieselSurchargePct — added (percentage points) to the base pct for
//     diesel. dieselMultiplier — base pct MULTIPLIED for diesel (Delhi:
//     a confirmed flat 25% extra, i.e. ×1.25 — not the same shape as an
//     additive surcharge, so a separate field rather than overloading one).
//   cngAdjPct — added (usually negative) to the base pct for CNG.
//   taxCessMultiplier — a state-level cess applied on top of the tax
//     amount itself (Karnataka's 11% Section-3 cess), multiplied in last,
//     after any fuel-specific adjustment; applies to the ICE slab path
//     only, never to a state's own separate EV slab table (unconfirmed
//     whether Karnataka's cess reaches its 2026 EV slabs — modeled as "no"
//     rather than compounding two unconfirmed assumptions).
//   ev: { exempt, pctOverride, slabs?, reason, until } — `exempt: true`
//     zeroes (or floors, via pctOverride) the road tax and states why in
//     words (CR1's "TCS creditable" posture — R32 "state, don't model").
//     `slabs` (Karnataka) means the EV isn't exempt but has its own price
//     slabs distinct from ICE. `until` is the exemption's own end date
//     where the state has published one — several have already lapsed or
//     will lapse; that's exactly why this needs a comment date, not just
//     a value.
const CAR_STATE_CHARGES = Object.freeze({
  // Telangana — as of 2026-09-29, source: transport.telangana.gov.in
  // "Life Time Tax" schedule (revised 2022-05-09; unchanged since) — one
  // slab table applies to petrol/diesel/CNG private cars alike.
  TG: Object.freeze({
    name: 'Telangana', fuelUniform: true,
    slabs: [[500000, 13], [1000000, 14], [2000000, 17], [Infinity, 18]],
    ev: Object.freeze({ exempt: true, pctOverride: 0,
      reason: 'Telangana exempts EVs from road tax and registration fee for vehicles registered by 31 Dec 2026',
      until: '2026-12-31' }),
    confidence: 'confirmed',
  }),
  // Andhra Pradesh — as of 2026-09-29, source: aptransport.org "Life Time
  // Tax" page. Only a two-band split (below/above ₹10L) was confirmed;
  // marked indicative pending the full published slab table.
  AP: Object.freeze({
    name: 'Andhra Pradesh', fuelUniform: true,
    slabs: [[1000000, 12], [Infinity, 14]],
    ev: Object.freeze({ exempt: false, pctOverride: null, reason: null, until: null }),
    confidence: 'indicative',
  }),
  // Karnataka — as of 2026-09-29, source: Karnataka Motor Vehicles
  // Taxation (Amendment) Act, 2026 (in force 2026-04-01), reported slabs
  // (₹8L petrol -> 14% band, ₹15L petrol -> 17% band). Same 4-band shape
  // as Telangana. Two things are NOT both solid here, so the state as a
  // whole is downgraded to 'indicative-partial' even though the base
  // slabs are confirmed:
  //   - dieselSurchargePct: 2 is a commonly-cited figure, not itself
  //     independently confirmed for Karnataka specifically.
  //   - taxCessMultiplier: 1.11 models the "11% cess on the tax paid under
  //     Section 3" that multiple secondary sources describe consistently
  //     (cess of the tax amount, not of the vehicle price) — modeled
  //     rather than silently dropped, but not verified against the
  //     amendment act's own text, and it's unconfirmed whether it also
  //     reaches the 2026 EV slab table below (assumed not, see the field's
  //     own comment above).
  // The 2026-04-01 amendment also *ended* Karnataka's EV exemption and
  // replaced it with its own price-slab lifetime tax — modeled via
  // `ev.slabs`, not `ev.exempt`.
  KA: Object.freeze({
    name: 'Karnataka', fuelUniform: true, dieselSurchargePct: 2, taxCessMultiplier: 1.11,
    slabs: [[500000, 13], [1000000, 14], [2000000, 17], [Infinity, 18]],
    ev: Object.freeze({ exempt: false, pctOverride: null,
      slabs: [[1000000, 5], [2500000, 8], [Infinity, 10]],
      reason: 'Karnataka replaced its EV road-tax exemption with a price-slab lifetime tax from 1 Apr 2026',
      until: null }),
    confidence: 'indicative-partial',
  }),
  // Maharashtra — as of 2026-09-29, source: Maharashtra Motor Vehicles Tax
  // (Amendment) Act, 2025 press coverage — petrol/diesel private cars
  // below ₹10L confirmed at 11%/13%; the >=₹10L band is extrapolated
  // (+1pp), not independently confirmed. CNG confirmed at 8% (<₹10L),
  // modeled as -3pp off the petrol slab. EV exemption's own end date
  // (Maharashtra's EV policy runs in phases) was not confirmed — `until`
  // left null rather than guessed.
  MH: Object.freeze({
    name: 'Maharashtra', dieselSurchargePct: 2, cngAdjPct: -3,
    slabs: [[1000000, 11], [Infinity, 12]],
    ev: Object.freeze({ exempt: true, pctOverride: 0,
      reason: 'Maharashtra exempts registered EVs from motor vehicle tax and registration fee under its EV policy',
      until: null }),
    confidence: 'indicative-partial',
  }),
  // Delhi (NCT) — as of 2026-09-29, source: transport.delhi.gov.in tax-rate
  // schedule as reported (private, individual-owned; company-registered
  // vehicles pay 25% more, not modeled here). Petrol slabs 4%/7%/10% at
  // ₹6L/₹10L confirmed directly. Diesel is confirmed as a flat 25% EXTRA
  // on the applicable (petrol-equivalent) tax — NOT a separately-shifted
  // slab table (an earlier version of this entry wrongly modeled diesel
  // with its own 400000/600000-boundary table, which doesn't match any
  // primary description of Delhi's schedule); the commonly-quoted
  // "5% / 8.75% / 12.5%" diesel figures are exactly 4/7/10 x 1.25, which
  // is what `dieselMultiplier` reproduces at the same ₹6L/₹10L boundaries
  // as petrol. CNG has no confirmed slab of its own and is modeled same
  // as petrol. EV exemption (cap ₹30L ex-showroom, until 2030-03-31) is
  // corroborated by several independent 2026-07 reports of the Delhi EV
  // Policy 2026's official notification (effective 2026-07-01) agreeing on
  // both figures — not the gazette text itself, so treat the exact date
  // and cap as well-sourced-secondary rather than primary-verified.
  DL: Object.freeze({
    name: 'Delhi (NCT)',
    slabs: [[600000, 4], [1000000, 7], [Infinity, 10]],
    dieselMultiplier: 1.25,
    ev: Object.freeze({ exempt: true, pctOverride: 0,
      reason: 'Delhi exempts EVs priced up to ₹30L ex-showroom from road tax and registration under the Delhi EV Policy 2026',
      evPriceCapExShowroom: 3000000, until: '2030-03-31' }),
    confidence: 'confirmed',
  }),
  // Tamil Nadu — as of 2026-09-29, source: reported TN motor vehicle tax
  // schedule (10% below ₹10L, 15% at/above — a ₹12L petrol car cited at
  // 15%/₹1.8L). Diesel/CNG have no confirmed distinct slab and are modeled
  // same as petrol (fuelUniform).
  TN: Object.freeze({
    name: 'Tamil Nadu', fuelUniform: true,
    slabs: [[1000000, 10], [Infinity, 15]],
    ev: Object.freeze({ exempt: true, pctOverride: 0,
      reason: 'Tamil Nadu exempts all EVs from motor vehicle tax through 31 Dec 2027',
      until: '2027-12-31' }),
    confidence: 'confirmed',
  }),
  // Uttar Pradesh — as of 2026-09-29, source: reported UP one-time-tax
  // range "7% to 11% based on vehicle type and cost" — collapsed here to
  // an indicative two-band 8%/10% split at ₹10L; the real published slab
  // table was not confirmed. EV exemption runs 2022-10-14 to 2027-10-13,
  // but since 2025-10-14 is restricted to EVs manufactured/assembled in UP
  // — stated in the reason string, not modeled as a further condition.
  UP: Object.freeze({
    name: 'Uttar Pradesh', fuelUniform: true,
    slabs: [[1000000, 8], [Infinity, 10]],
    ev: Object.freeze({ exempt: true, pctOverride: 0,
      reason: 'Uttar Pradesh exempts EVs registered 14 Oct 2022 - 13 Oct 2027 from road tax (state-manufactured EVs only since 14 Oct 2025)',
      until: '2027-10-13' }),
    confidence: 'indicative',
  }),
  // Gujarat — as of 2026-09-29, source: reported Gujarat motor vehicle tax
  // (6% standard for private vehicles). Gujarat's concessional 1% EV rate
  // expired 2026-03-31 and had not been renewed as of this research date
  // — modeled as NOT exempt (standard 6%), not the lapsed 1%. Revisit this
  // entry if a new EV policy is notified.
  GJ: Object.freeze({
    name: 'Gujarat', fuelUniform: true,
    slabs: [[Infinity, 6]],
    ev: Object.freeze({ exempt: false, pctOverride: null,
      reason: "Gujarat's 1% concessional EV tax rate expired 31 Mar 2026 and was not renewed as of this research date",
      until: null }),
    confidence: 'indicative',
  }),
  // West Bengal — as of 2026-09-29, source: reported WB one-time tax
  // (statutorily a flat-fee table keyed by engine cc, not an ex-showroom
  // %). Collapsed here to one indicative flat % (~5.5%, a rough
  // fee/typical-price ratio) — explicitly NOT the statutory formula; if
  // WB's cc-based table is ever wired in properly this entry should be
  // replaced, not extended.
  WB: Object.freeze({
    name: 'West Bengal', fuelUniform: true,
    slabs: [[Infinity, 5.5]],
    ev: Object.freeze({ exempt: true, pctOverride: 0,
      reason: 'West Bengal exempts private EVs from road tax and registration fee',
      until: null }),
    confidence: 'indicative',
  }),
  // "Other — enter %" (CD-8) — a generic indicative default for any state
  // not in this table; every figure stays user-editable regardless.
  OT: Object.freeze({
    name: 'Other — enter %', fuelUniform: true,
    slabs: [[Infinity, 10]],
    ev: Object.freeze({ exempt: false, pctOverride: null, reason: null, until: null }),
    confidence: 'indicative',
  }),
});

// One-time registration + other charges (HSRP plate, FASTag, smart card,
// hypothecation endorsement, etc.) as a single indicative, editable rupee
// figure — as of 2026-09-29, source: aggregator-reported ranges (~₹10,000
// to ₹15,000 for a private car, varying by state); not a statutory figure,
// deliberately not split into a table (CLAUDE.md's "one indicative
// figure" instruction).
const CAR_REG_CHARGES_DEFAULT = 12000;

// TCS on motor vehicles — as of 2026-09-29, source: Income-tax Act, 2025,
// s.394(1) Table Sl. No. 6 (in force from 2026-04-01), successor to the
// Income-tax Act 1961's s.206C(1F). 1% of the sale/invoice value, collected
// by the seller, when that value EXCEEDS ₹10,00,000 — strictly greater
// than, not at-or-above (mirrored in calcOnRoadCost's tcsApplies check and
// pinned in tests.js). TCS is creditable against the buyer's income tax —
// it's upfront cash at the dealer, not a net cost — a UI showing it must
// say so in words (R32 "state, don't model").
const CAR_TCS_THRESHOLD = 1000000;
const CAR_TCS_RATE_PCT = 1;

// Resolves a price into a % from an ascending [[upToExShowroom, pct], ...]
// slab table (last entry's upTo is Infinity, so this always resolves).
// `upToExShowroom` is an EXCLUSIVE upper bound (see the boundary-convention
// comment above CAR_STATE_CHARGES) — a price sitting exactly at the
// boundary resolves to the NEXT slab, hence `<`, not `<=`.
function resolveSlabPct(slabs, exShowroom) {
  for (const [upTo, pct] of slabs) {
    if (exShowroom < upTo) return pct;
  }
  return slabs[slabs.length - 1][1]; // unreachable given an Infinity slab, kept as a safe fallback
}

// Resolves { pct, reason } for one state + fuel + price, before any
// user override. `fuel` is 'petrol' | 'diesel' | 'cng' | 'ev'; anything
// else falls back to 'petrol' (the most common case) rather than NaN.
function resolveRoadTax(stateCode, fuel, exShowroom) {
  const state = CAR_STATE_CHARGES[stateCode] || CAR_STATE_CHARGES.OT;
  const f = ['petrol', 'diesel', 'cng', 'ev'].includes(fuel) ? fuel : 'petrol';

  if (f === 'ev') {
    if (state.ev.exempt) {
      const cap = state.ev.evPriceCapExShowroom;
      if (cap == null || exShowroom <= cap) {
        return { pct: state.ev.pctOverride, reason: state.ev.reason };
      }
      // Over the exemption's own price cap (Delhi): falls back to the
      // state's normal ICE-style slabs rather than staying exempt.
    } else if (state.ev.slabs) {
      return { pct: resolveSlabPct(state.ev.slabs, exShowroom), reason: state.ev.reason };
    }
  }

  let pct;
  if (state.fuelSlabs) {
    pct = resolveSlabPct(state.fuelSlabs[f] || state.fuelSlabs.petrol, exShowroom);
  } else {
    pct = resolveSlabPct(state.slabs, exShowroom);
    if (f === 'diesel') {
      if (state.dieselMultiplier) pct *= state.dieselMultiplier;
      else if (state.dieselSurchargePct) pct += state.dieselSurchargePct;
    } else if (f === 'cng' && state.cngAdjPct) {
      pct = Math.max(0, pct + state.cngAdjPct);
    }
  }
  // A state-level cess on top of the ICE tax amount (Karnataka) —
  // deliberately not applied to the EV-exempt/EV-slabs return paths above
  // (see the field's own comment above CAR_STATE_CHARGES).
  if (state.taxCessMultiplier) pct *= state.taxCessMultiplier;

  return { pct, reason: null };
}

// The on-road-cost engine for "Buy a car" (CR4): one car, one state, one
// fuel type -> every line a buyer sees at the dealer. Pure and
// override-friendly — every resolved figure (roadTaxPct, regCharges,
// insurance) can be overridden by the caller, same as Home's q-state
// pattern (state sets defaults, every field stays editable).
//
// TCS is included in `onRoad` (it's real cash handed over at the dealer)
// but broken out separately as `onRoadExTcs` + `tcs` + `tcsApplies` so a
// caller can show it as its own creditable-against-income-tax line rather
// than silently folding it into "what this car costs you" — a deliberate
// choice, not an oversight (CR1's brief).
//
// Invalid/non-finite/zero/negative exShowroom, or a missing/unknown fuel,
// degrades to an all-zero result — never NaN — so a blank "Buy a car" tile
// on first render (or a user mid-edit) never prints garbage. Called with no
// argument at all (`o` undefined) degrades the same way rather than
// throwing — `o = o || {}` first.
function calcOnRoadCost(o) {
  o = o || {};
  const exShowroom = Number.isFinite(o.exShowroom) && o.exShowroom > 0 ? o.exShowroom : 0;
  if (exShowroom === 0) {
    return {
      exShowroom: 0, roadTax: 0, roadTaxPct: 0, roadTaxReason: null,
      regCharges: 0, insurance: 0, tcs: 0, tcsApplies: false,
      onRoadExTcs: 0, onRoad: 0,
    };
  }
  const fuel = (o.fuel || '').toLowerCase();
  const resolved = resolveRoadTax(o.stateCode, fuel, exShowroom);

  const roadTaxPct = Number.isFinite(o.roadTaxPct) ? o.roadTaxPct : resolved.pct;
  // An explicit override replaces the number AND the "why" — a caller who
  // typed their own % is no longer describing the state's stated reason.
  const roadTaxReason = Number.isFinite(o.roadTaxPct) ? null : resolved.reason;
  const roadTax = exShowroom * roadTaxPct / 100;

  const regCharges = Number.isFinite(o.regCharges) ? o.regCharges : CAR_REG_CHARGES_DEFAULT;

  const insRate = fuel === 'ev' ? CAR_RUNNING_DEFAULTS.evIns : CAR_RUNNING_DEFAULTS.iceIns;
  const insurance = Number.isFinite(o.insurance) ? o.insurance : exShowroom * insRate;

  const tcsApplies = exShowroom > CAR_TCS_THRESHOLD;
  const tcs = tcsApplies ? exShowroom * CAR_TCS_RATE_PCT / 100 : 0;

  const onRoadExTcs = exShowroom + roadTax + regCharges + insurance;
  const onRoad = onRoadExTcs + tcs;

  return { exShowroom, roadTax, roadTaxPct, roadTaxReason, regCharges, insurance, tcs, tcsApplies, onRoadExTcs, onRoad };
}

// ── DHANAM WORTH ──────────────────────────────────────────────────
// Extracted from index.html's renderWorthProjection() (Phase 16/R65) so that
// function and the loan panel's "reverse Worth bridge" disclosure
// (worthSnapshot() + this function, both in index.html) can never
// independently drift into two different net-worth projections — they call
// this exact same formula with the exact same arguments, not two hand-copied
// versions of it. investable/propertyVal/liabilities are today's balance-
// sheet figures; property is deliberately held flat (this app has no basis
// to assume an appreciation rate for it) and debt amortizes generically via
// loanAtYear at a single blended rate/tenure, same as before extraction —
// this is a pure refactor, not a new model, and produces bit-identical
// output to the pre-R65 inline version for the same inputs.
function calcNetWorthProjection(investable, propertyVal, liabilities, cagr, debtRate, debtYears, monthlySip, years) {
  const grownInvestable = investable * Math.pow(1 + cagr / 100, years) + calcSIP(monthlySip, cagr, years);
  const remainingDebt = loanAtYear(liabilities, debtRate, debtYears, years).balance;
  return grownInvestable + propertyVal - remainingDebt;
}

// Zero-dependency bridge: browsers see plain globals via <script src="calc.js">;
// Node (tests.js) gets the same file via require('./calc.js'). No bundler either way.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcEMI, loanAtYear, simulateLoan,
    calcSIP, calcStepupSIP,
    calcIncomeTax, calcPerquisite, calcCarDepreciation,
    calcRunningCost, calcInsuranceTotal, calcOwnershipCost, calcBreakevenKm,
    calcOwnershipCurve, calcLumpsumGrowth, calcTaxableIncome, calcLeaseMarginalRate,
    calcNetWorthProjection, CAR_RUNNING_DEFAULTS, splitAnnualKm, evEfficiencyFromRange,
    CAR_STATE_CHARGES, CAR_REG_CHARGES_DEFAULT, CAR_TCS_THRESHOLD, CAR_TCS_RATE_PCT,
    calcOnRoadCost,
  };
}
