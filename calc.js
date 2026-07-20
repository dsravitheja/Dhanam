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
function calcEMI(P, annualRate, years) {
  const r = annualRate / 12 / 100;
  const n = years * 12;
  if (r === 0) return P / n;
  return P * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1);
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
    if (annualTaxable <= 1200000) tax = 0; // 87A rebate new regime
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

function calcPerquisite(bigEngine, hasDriver) {
  return (bigEngine ? 2400 : 1800) + (hasDriver ? 900 : 0);
}

function calcCarDepreciation(price, years) {
  let val = price * 0.80; // 20% drop year 1
  for (let y = 1; y < years; y++) val *= 0.85; // 15%/yr thereafter
  return val;
}

// Zero-dependency bridge: browsers see plain globals via <script src="calc.js">;
// Node (tests.js) gets the same file via require('./calc.js'). No bundler either way.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcEMI, loanAtYear, simulateLoan,
    calcSIP, calcStepupSIP,
    calcIncomeTax, calcPerquisite, calcCarDepreciation
  };
}
