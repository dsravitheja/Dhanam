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

// The Compare Cars engine: one car, one tenure, full net-cost breakdown.
// taxSaved is deliberately signed — an EMI below the perquisite means the
// carve-out taxes you on more than it saves, and clamping that to 0 would
// hide a real negative rather than fix a bug (see R39's blank-row guard,
// which is the actual fix for the workbook's analogous symptom).
function calcLeaseNetCost(o) {
  const residual = o.price * o.residualPct;
  const months = o.years * 12;
  const emi = calcEMI(o.price, o.annualRate, o.years, residual);
  const { annual: runAnnual } = calcRunningCost(o.type, o.efficiency, {
    cityKm: o.cityKm, hwyKm: o.hwyKm, petrolPrice: o.petrolPrice,
    iceHwyMult: o.iceHwyMult, homeRate: o.homeRate, publicRate: o.publicRate,
    evHwyMult: o.evHwyMult,
  });
  const runningTotal = runAnnual * o.years;
  const maintTotal = o.maintAnnual * o.years;
  const insTotal = calcInsuranceTotal(o.price, o.insRate, o.depRate, o.years);
  const perq = calcPerquisite(o.bigEngine, o.hasDriver);
  const taxSaved = o.marginalRate * (emi - perq) * months;
  const rawOutflow = emi * months + residual + runningTotal + maintTotal + insTotal;
  const netCost = rawOutflow - taxSaved;
  const resaleValue = calcCarDepreciation(o.price, o.years);
  const netCostAfterResale = netCost - resaleValue;
  const totalKm = (o.cityKm + o.hwyKm) * o.years;
  const costPerKm = totalKm > 0 ? netCost / totalKm : 0;
  return {
    emi, months, residual, runningTotal, maintTotal, insTotal, taxSaved,
    rawOutflow, netCost, resaleValue, netCostAfterResale, costPerKm,
  };
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

// Zero-dependency bridge: browsers see plain globals via <script src="calc.js">;
// Node (tests.js) gets the same file via require('./calc.js'). No bundler either way.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcEMI, loanAtYear, simulateLoan,
    calcSIP, calcStepupSIP,
    calcIncomeTax, calcPerquisite, calcCarDepreciation,
    calcRunningCost, calcInsuranceTotal, calcLeaseNetCost, calcBreakevenKm
  };
}
