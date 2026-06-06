# Solar + Battery Discovery → Design Tool (Ireland 2026)

A single-file web tool. The user answers the **Solar + Battery Discovery Questionnaire**,
clicks **Generate**, and gets an indicative design: PV sizing, inverter/topology, battery
sizing, a product shortlist, an itemised costing (with SEAI grant + 0% VAT), an economics /
payback estimate, and a step-by-step installation plan with risk flags.

## Run it

Just open `index.html` in a browser — double-click it, no server or install needed.
It's fully self-contained (HTML + CSS + JS in one file) and works offline.

- **Fill with example** loads a worked Irish case so you can see the output instantly.
- **Print / save PDF** produces a clean, form-free copy of the plan to send to a client.

## How the design engine works

| Output | Driven by |
|---|---|
| **PV size (kWp)** | annual kWh ÷ orientation yield, then capped by roof panel count, the single/3-phase inverter & export limit, and budget |
| **Battery (kWh)** | the larger of: backup need (whole-home ≈ 60% of daily use, essential ≈ 30%), smart-tariff arbitrage (≈ 50% of daily), or self-consumption — capped by budget |
| **Product pick** | phase compatibility, backup scope, EV/V2G interest, app/automation need, budget and brand leaning. Returns a primary + two alternatives |
| **Cost** | PV €/kWp (scale-tiered) + battery product price + EV charger + earthing/board extras, less SEAI grant |
| **Payback** | self-consumption bill saving + CEG export income + night→peak arbitrage |

## About the cost data

The cost model is set to **typical 2026 Irish installed prices**. The figures below are
representative market benchmarks for common system sizes — the model reproduces them to within
a few percent, so its costings track real-world pricing rather than list prices.

Every price lives in one editable place — the `PRICING` object at the top of the `<script>`
block in `index.html`. Drop in your own quotes and every output recalculates.

### Representative 2026 system prices the model reproduces (grant = €1,800 flat ≥ 4 kWp)

| System | Battery | Market price | Model |
|---|---|---|---|
| 11.0 kWp (24×460) | Solis + 2×10 kWh | €14,550 after | €14,649 (+0.7%) |
| 10.8 kWp (24×450) | GoodWe 8 kWh | €12,400 pre | €12,316 (−0.7%) |
| 10.9 kWp (24×455) | Sigenergy 16 kWh | €17,080 pre | €16,422 (−3.9%) |
| 5.6 kWp (12×470) | Dyness 10 kWh | €10,485 pre | €9,994 (−4.7%) |
| 11.3 kWp (24×470) | Dyness 10 kWh | €11,270 pre | — |
| 6.6 kWp (14×470) | Solis 10 kWh + changeover | €8,470 after | — |
| 4.75 kWp (10×475) | none | €4,500 after | — |

Like-for-like cases land within ~5%. (Some market prices read higher because they bundle BER,
optimisers or auto-gateway backup — the tool adds those as separate lines when toggled on.)

### Typical 2026 component / add-on prices

| Item | Typical price | In model |
|---|---|---|
| Sigenergy 10 kWh module | €3,000 | `batteries.sigenergy` (€360/kWh + base) |
| Dyness 10 kWh add-on module | €1,800 | `batteries.solis` (€330/kWh + base) |
| Ground-mount premium | ~€1,500 | `groundMountExtra` |
| Whole-house manual changeover | €450 (Solis) / €1,650 (Sig gateway) | `consumerUnitWork` €700 |
| Earth rod (TT) | €250 | `ttEarthingExtra` €300 |
| Extra panel | €175 each | (add panels manually) |
| BER assessment | €400 | not modelled |
| Export limit (NC6) | 25 A ≈ **5.75 kW** single-phase | inverter cap in `sizePV` |

> Note the Irish hybrid-install convention the model bakes in: installers oversize the DC array
> ~2× the inverter and export-limit it (10–11 kWp DC on a 5 kW single-phase inverter is normal),
> because the battery + self-use absorb the midday peak the grid won't take.

### Key `PRICING` fields to tune

```js
PRICING.pvRate            // €/kWp (panels+mounting+install, no inverter), by size
PRICING.batteries.*       // per-product: base (hybrid inverter) + perKwh (modules)
PRICING.evCharger         // installed EV charger
PRICING.grant             // SEAI grant formula (2026 rules)
```

**Tuning the battery price** is the highest-leverage edit. Each brand is `base` (the hybrid
inverter + install + gateway, a fixed cost) plus `perKwh` (the storage modules). Given two real
quotes at different sizes: `perKwh = (priceBig − priceSmall) / (kWhBig − kWhSmall)`, then
`base = priceSmall − perKwh × kWhSmall`.

Brands map to the Irish market: **sigenergy** (premium all-in-one), **solis** (Solis + Dyness,
a popular value combo), **anker** (budget all-in-one), **powerwall** (premium backup,
less common in Ireland), **victron** (off-grid / prosumer — see below). SEAI grant 2026: €700/kWp
first 2 kWp, €200/kWp next 2 kWp, cap **€1,800**; battery not grant-eligible; PV + battery on
one contract = 0% VAT.

### How a brand gets picked (`pickProduct`)

A **hard filter on phase** (single vs three) eliminates incompatible kit, then everyone left is
**scored** and the top 3 become primary + two alternatives. The weights encode a priority order:

| Driver (from your answers) | Points → brand |
|---|---|
| Three-phase supply | +3 → Sigenergy / Solis / Victron (native 3-ph) |
| EV **+ want V2G/V2H** | +3 → Sigenergy (only one with built-in DC charger) |
| Whole-home backup wanted | +2 → Sigenergy / Powerwall / Victron |
| Generator to integrate (§2) | +3 → **Victron** |
| DIY / configurability appetite (§10) | +2 → **Victron** |
| Off-grid is your **#1** objective (§1) | +2 → **Victron** |
| Want app / automation | +1 → Sigenergy / Anker |
| Financed or budget-capped | +1 → Solis / Anker |
| You named a brand (§7) | +4 → that brand |

**Victron is the off-grid / prosumer pick** and deliberately stays out of normal grid-tie
results. It only becomes *primary* on a concrete signal — an existing **generator** to integrate,
a **DIY** appetite, or ranking **off-grid as your literal #1 objective**. A mere "self-sufficiency
leaning" (#2) is left to Sigenergy's big modular battery; Victron still appears as an *alternative*
there. This mirrors reality: Victron wins for boats/vans/remote sites, multi-source (solar +
generator + grid) setups, and people who'll tinker — but it's overkill and pricier for a standard
roof-plus-battery grid-tie install, which is why it's rarely seen in standard domestic installs.

## Limitations

Indicative planning aid, **not a quote and not engineering sign-off**. It assumes typical Irish
yields and self-consumption fractions, and simple payback (no finance cost or price inflation).
Final loads, structural/electrical compliance and the real price must come from an
SEAI-registered installer's site survey.
