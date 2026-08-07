# ICE vs EV Company Lease Comparison — Build Documentation

This documents how the `ICE vs EV Lease Comparison.xlsx` workbook was built: its structure, every
formula, the modeling assumptions baked in, and one real bug that was found and fixed. It's written
so the logic can be reimplemented in another context (app, script, different tool) without having to
reverse-engineer the spreadsheet.

## 1. Purpose

Compare ICE and EV cars under a company car-lease policy (India), where the employee leases through
a CTC carve-out, pays EMI + a residual "balloon" buyout at lease end, and gets an income-tax benefit
because a flat, price-independent perquisite value is taxed instead of the actual EMI. The workbook
answers: for a given car and lease tenure, what's the true net cost after tax, and how does that
compare across a shortlist of cars?

## 2. Workbook structure

Five sheets, in this order:

1. **README** — human-readable orientation (what's in the file, what was added beyond the original ask).
2. **Assumptions** — every editable input. Nothing is hardcoded elsewhere; every formula traces back here.
3. **Cars** — master vehicle list: prefilled cars + blank rows for manual entry.
4. **Lease Comparison** — the calculation engine. One row per car, repeated metrics for 3/4/5-year tenures.
5. **Sensitivity** — breakeven annual-km calculator (at what usage level does an EV overtake a reference ICE car).
6. **Summary** — condensed view of net cost + rank per car, for scanning.

Color convention used throughout (standard financial-model convention):
- **Blue** = hardcoded input, safe to edit
- **Black** = formula referencing cells on the same sheet
- **Green** = formula referencing another sheet (a "link")

## 3. Assumptions sheet — every input

| Input | Default | Notes |
|---|---|---|
| Lease interest rate (p.a.) | 10% | |
| Residual value / buyout (%) | 10% | Paid at lease end to own the car |
| Income tax slab rate | 30% | New regime |
| Health & education cess | 4% | |
| Combined marginal rate | `=slab*(1+cess)` | 31.2% at defaults |
| Motor car perquisite value | ₹5,000/month | Flat regardless of car price — this is why the tax benefit scales with EMI size, not the car chosen |
| Company EMI cap | ₹60,000/month | |
| Petrol price | ₹117/litre | Hyderabad, Aug 2026 |
| Home charging cost | ₹8/unit | Blended slab rate |
| Public fast-charging cost | ₹20/unit | |
| Annual city driving | 8,000 km | |
| Annual highway driving | 4,000 km | 2:1 city:highway split |
| Total annual km | `=city+highway` | 12,000 km |
| ICE highway mileage multiplier | 1.35× | Highway kmpl assumed 35% better than city |
| EV highway efficiency multiplier | 1.15× | Highway kWh/100km assumed 15% worse than city (aero drag) |
| EV annual mileage multiplier | 1.00× | Models driving an EV more than an ICE (e.g. because running cost feels negligible — a real, commonly observed "rebound effect"). Applies to EV rows only. |
| ICE annual maintenance | ₹9,000/yr | Flat |
| EV annual maintenance | ₹4,500/yr | Flat |
| ICE insurance rate | 3.0% of on-road price, yr 1 | Declines with IDV depreciation |
| EV insurance rate | 3.8% of on-road price, yr 1 | Higher — battery cover |
| Annual IDV depreciation rate | 15%/yr | Used to decay the insurance base year over year |

## 4. Cars sheet — vehicle master list

Columns: `Type (ICE/EV) | Make & Model | Trim | On-road Price (₹) | Mileage(kmpl)/Efficiency(kWh per 100km) | 360° Camera | Notes/Source`.

- 14 prefilled rows: 5 ICE, 9 EV (6 originally requested + 3 added for continuity/comparison value, each flagged "ADDED" in the trim text).
- Mileage/efficiency figures are **real-world estimates**, not brochure numbers — sourced per-row from
  owner reports where available, otherwise ARAI/claimed figures derated using an empirically observed
  ratio (real-world city mileage ≈ 57% of ARAI, from the user's own ownership data point).
- **10 blank rows follow the prefilled data**, formatted identically, with a data-validation dropdown
  (ICE/EV) on the Type column. Filling Type + Price + Mileage/Efficiency in a blank row is enough —
  every downstream sheet picks it up automatically because all formulas reference the Cars sheet by
  fixed row range, not by a named table that would need updating.

## 5. Lease Comparison sheet — the engine

One row per car (mirroring the Cars sheet row-for-row), with a repeated 7-metric block for each of
3/4/5-year tenures:

`Monthly EMI | Total Running Cost | Total Maintenance+Insurance | Total Tax Saved | Raw Cash Outflow | Net Cost After Tax | Effective Cost/km`

Plus three rank columns (one per tenure) at the end: `RANK(net_cost, all_net_costs_for_that_tenure, ascending)`, so 1 = cheapest.

### 5.1 Monthly EMI (balloon-payment lease)

This is **not** a plain amortizing loan — the residual value is a balloon still owed at the end, so
the EMI only needs to amortize `price − PV(residual)`, not the full price. In Excel this is exactly
what the `PMT` function does when given a future value:

```
EMI = PMT(monthly_rate, n_months, -on_road_price, residual_value)
```

In closed form:

```
monthly_rate = annual_rate / 12
n            = tenure_years * 12
residual     = on_road_price * residual_pct

EMI = (on_road_price - residual / (1+monthly_rate)^n) * [monthly_rate*(1+monthly_rate)^n / ((1+monthly_rate)^n - 1)]
```

### 5.2 Running cost (fuel or energy), annualized then × tenure

City and highway km are modeled separately because ICE mileage improves on the highway while EV
efficiency worsens on the highway (aero drag dominates at speed):

```
ICE annual cost = city_km/mileage * petrol_price
                + highway_km/(mileage*ice_highway_mult) * petrol_price

EV annual cost  = city_km * ev_mult * (efficiency/100) * home_rate
                + highway_km * ev_mult * (efficiency*ev_highway_mult/100) * public_rate

total_running_cost = annual_cost * tenure_years
```

`ev_mult` is the EV annual mileage multiplier (§3) — it's 1.0 by default and only affects EV rows.

### 5.3 Maintenance + Insurance

Maintenance is a flat annual rate by type. Insurance is modeled as a percentage of on-road price that
decays with the vehicle's assumed IDV depreciation — summed as a geometric series in closed form
rather than looping year by year:

```
maintenance_total = (ice_maint_or_ev_maint) * tenure_years

insurance_total = on_road_price * (ice_ins_rate_or_ev_ins_rate) * (1 - (1-dep_rate)^tenure_years) / dep_rate
```

### 5.4 Tax saved (the CTC carve-out mechanism)

The employee's taxable income is reduced by the EMI (paid pre-tax via the carve-out) but increased by
a flat perquisite value that gets added back and taxed. Net monthly benefit is the marginal rate
applied to the difference:

```
tax_saved_total = marginal_rate * (monthly_EMI - monthly_perquisite) * n_months
```

This is why a pricier lease shelters more income — the benefit scales with EMI size, not with any
per-car tax treatment (the perquisite value itself is identical regardless of which car is chosen).

### 5.5 Raw cash outflow vs. net cost after tax

Two totals are shown side by side deliberately, so it's clear what physically leaves your account
versus what the tax adjustment implies:

```
raw_cash_outflow   = EMI*n_months + residual_value + running_cost_total + maintenance_total + insurance_total
net_cost_after_tax = raw_cash_outflow - tax_saved_total
```

### 5.6 Effective cost per km

```
annual_km_for_this_car = total_annual_km * (ev_mult if type == "EV" else 1)
cost_per_km = net_cost_after_tax / (annual_km_for_this_car * tenure_years)
```

Because purchase price (via EMI) dominates raw cash outflow at typical annual mileage, this number is
a **blended capital + running cost figure**, not a pure fuel/energy efficiency comparison — it will
favor a cheaper car with worse running costs unless annual mileage is high enough for the running-cost
gap to outweigh the capital-cost gap. That crossover point is exactly what the Sensitivity sheet solves for.

### 5.7 Conditional formatting

- EMI cell turns red if it exceeds the Assumptions EMI cap.
- Rank = 1 is highlighted green.

## 6. Sensitivity sheet — breakeven annual km

For a chosen reference ICE car (a row number typed into one cell — defaults to the first ICE row),
this finds the annual km at which each EV's net cost drops below the reference car's, **assuming both
are driven the same annual km** (this is a different, simpler question than the EV mileage multiplier
scenario in §3 — see the note on the sheet itself).

Derivation: net cost is linear in annual km for a fixed tenure, because every non-running-cost
component (EMI, residual, maintenance, insurance, tax saved) is independent of km, and running cost is
directly proportional to km. So for any car:

```
net_cost(km) = fixed_cost + rate_per_km * km * tenure_years

where:
fixed_cost   = EMI*n_months + residual + maintenance_total + insurance_total - tax_saved_total
rate_per_km  = blended ₹/km at the current city:highway split (see §5.2, divided through by annual km)
```

Setting `net_cost_EV(km) = net_cost_ICE(km)` and solving for km:

```
breakeven_km = (fixed_cost_EV - fixed_cost_ICE) / (tenure_years * (rate_ICE - rate_EV))
```

`fixed_cost` for each car is pulled directly from the already-computed EMI/maintenance+insurance/tax
cells on the Lease Comparison sheet (not recomputed) so there's a single source of truth.
`rate_per_km` is computed independently from Assumptions + Cars (mileage/efficiency), **not** derived
from the Lease Comparison running-cost total, so this calculation stays correct regardless of what the
EV mileage multiplier is set to.

A status column flags "Already cheaper today" (green) when breakeven km is below the current 12,000
km/year baseline, versus "Needs N more km/yr" otherwise.

## 7. Summary sheet

Pure presentation layer — pulls car name, type, price, net cost (3/4/5yr), and rank from Lease
Comparison via cross-sheet links, with a color scale (green=cheap → red=expensive) on the net-cost
columns. No independent calculation happens here.

## 8. A bug that was found and fixed (important gotcha for reimplementation)

**Symptom:** changing an Assumptions value (residual %) caused the blank manual-entry rows to produce
spurious small net-cost numbers, which then ranked as artificially "cheapest" and corrupted the
RANK() ordering.

**Root cause:** every formula guarded against blank manual-entry rows with a pattern like
`IF($E5="", "", ...)`, where `$E5` was itself a formula (`=Cars!E21`) pointing at the true blank cell
— not the blank cell itself. In Excel, **a formula that references an empty cell evaluates to numeric
0, not blank**, and `0 = ""` is `FALSE`. So the guard silently failed: blank rows fell through to the
real calculation, and because a truly-blank Type cell also evaluates to `0` (which doesn't equal the
text `"ICE"`), it defaulted into the EV branch of every `IF(type="ICE", ..., ...)` formula. That branch
applies a flat annual EV maintenance charge and doesn't divide by mileage (avoiding a `#DIV/0!`), but
still produces a small non-zero net cost — mostly driven by `-tax_saved` going *positive* because EMI
(0) is less than the flat perquisite (₹5,000), which is nonsensical but numerically valid, and small
enough to rank as "cheapest."

This didn't surface during initial testing because the verification tool (LibreOffice, used
programmatically to recalculate formulas) happens to treat that specific blank-reference comparison
more leniently than Excel does — a gap in the testing method, not a coincidence of which input was edited.

**Fix:** every blank-row guard now checks `ISBLANK()` directly on the source cell in the Cars sheet
(`ISBLANK(Cars!$E21)`), not on a derived reference. This is unambiguous in any spreadsheet engine,
because it inspects the actual cell rather than a formula result.

**Takeaway for reimplementation:** if this logic is ported to code (e.g. a web app), the equivalent
guard is simply "does this row have a price entered" checked against the *raw input state*, not
against a value that has already passed through a calculation — the same class of bug (falsy-but-not-
absent values slipping through a truthiness check) is easy to reintroduce in JS/Python if a "0 or
empty" price is treated as a legitimate car rather than an unfilled row.

## 9. Data sourcing methodology (for the prefilled cars)

- On-road prices for cars beyond the user's own two dealer-quoted cars are estimated as
  `ex-showroom price × typical state markup` (~17% for ICE in Telangana, ~5.5-10% for EVs, which often
  get reduced road-tax markups) — each row's Notes column documents the specific source and math.
- Mileage/efficiency values prioritize real owner-reported figures over brochure/ARAI numbers where
  available; otherwise ARAI figures are derated using the ratio observed from the user's own ICE
  ownership experience (~57% of ARAI in city driving).
- These are **starting estimates**, explicitly flagged as needing dealer-quote verification before
  being used for a final decision.

## 10. Known limitations

- On-road price estimates for 12 of 14 cars are not dealer-verified.
- Insurance modeling uses a single flat rate per vehicle type (ICE vs EV), not per-model quotes.
- The city:highway split (2:1) and its multipliers are global assumptions applied to every car
  uniformly — no per-car driving-pattern override.
- Breakeven calculations on the Sensitivity sheet compare only against a single reference ICE car at a
  time (selected by row number), not an aggregate/average ICE cost.
