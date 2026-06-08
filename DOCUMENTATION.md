# Solar + Battery Discovery → Design Tool — Build Documentation

Complete technical documentation for the tool in `index.html`. Aimed at Ireland, 2026.

> **Audience:** anyone maintaining, extending, or recalibrating the tool. For a quick user-facing
> overview see [`README.md`](README.md); this file documents the whole build in depth.

---

## Table of contents

1. [What it is](#1-what-it-is)
2. [Running it](#2-running-it)
3. [Architecture & data flow](#3-architecture--data-flow)
4. [The questionnaire (form)](#4-the-questionnaire-form)
5. [The engine](#5-the-engine)
6. [The pricing model (`PRICING`)](#6-the-pricing-model-pricing)
7. [The quoted range: keen → installer](#7-the-quoted-range-keen--installer)
8. [Grants, VAT & Irish reference](#8-grants-vat--irish-reference)
9. [The output report](#9-the-output-report)
10. [The animated system diagram](#10-the-animated-system-diagram)
11. [UI, theme & accessibility](#11-ui-theme--accessibility)
12. [Recalibrating the pricing](#12-recalibrating-the-pricing)
13. [Deployment](#13-deployment)
14. [Assumptions & limitations](#14-assumptions--limitations)
15. [Function reference](#15-function-reference)

---

## 1. What it is

A single self-contained HTML page. A homeowner answers a 10-section discovery questionnaire, clicks
**Generate**, and gets an **indicative** design: PV array sizing, inverter & topology, battery
sizing, a product shortlist, an itemised costing (with SEAI grants + 0 % VAT), an economics/payback
estimate, an animated system diagram, an installation plan with risk flags, and a printable record
of their answers.

Everything — HTML, CSS, JavaScript, the SVG diagram — lives in **one file**, `index.html`. No build
step, no dependencies, no backend, works offline. The only network request is a Google Fonts
stylesheet (Plus Jakarta Sans); the tool functions without it.

**Pricing is calibrated to typical 2026 Irish installed prices** and is fully editable in one place
(the `PRICING` object). It is an indicative planning aid, **not a quote** — final design and price
must come from an SEAI-registered installer's site survey.

---

## 2. Running it

- **Locally:** double-click `index.html`. That's it.
- **Dev preview:** a static server config lives in `.claude/launch.json`
  (`python -m http.server 8777`).
- **Live:** published via GitHub Pages — see [Deployment](#13-deployment).
- **Print / PDF:** the **Print / save PDF** buttons (top of the form and foot of the results) call
  `window.print()`. Print CSS hides the form and renders the report cleanly across pages.

---

## 3. Architecture & data flow

```
 ┌────────────┐   collect()    ┌──────────────────────────────────────────┐
 │   FORM      │ ─────────────▶ │  a  (answers object)                      │
 │ (10 sections)│               └──────────────────────────────────────────┘
 └────────────┘                        │
        ▲                              ▼   generate()
        │ syncConditionals()    ┌──────────────────────────────────────────┐
        │ (grey/hide fields)    │ sizePV → sizeBattery → pickProduct →       │
        │                       │ costSystem → economics → classify          │
        │                       └──────────────────────────────────────────┘
        │                              │
        │                              ▼   render()
        │                       ┌──────────────────────────────────────────┐
        └───────────────────────│  #out  (report cards + systemDiagram SVG) │
                                └──────────────────────────────────────────┘
```

**Pure function pipeline.** `generate()` ([index.html](index.html)) reads the form into a plain
`a` object via `collect()`, validates that annual kWh is present, then runs six pure functions and
hands their results to `render()`. None of the engine functions touch the DOM — they take `a`
(+ prior results) and return data. `render()` is the only place that builds HTML.

The result objects:

| Object | From | Key fields |
|---|---|---|
| `a` | `collect()` | every answer (see §4) |
| `pv` | `sizePV(a)` | `kwp, panels, acCap, annualGen, yieldPerKwp, reasons[]` |
| `battery` | `sizeBattery(a, pv)` | `kwh, existingKwh, addOnly, reasons[]` |
| `product` | `pickProduct(a, battery)` | `primary{key,p,score,reasons[]}, alts[]` |
| `cost` | `costSystem(a, pv, battery, product)` | `rows[], subtotal, grant, evGrant, net` |
| `econ` | `economics(a, pv, battery, product, cost)` | savings, `payback`, rates |
| `led` | `classify(a)` | `type, wantsBackup` (battery-led vs PV-led) |

---

## 4. The questionnaire (form)

Ten `<fieldset>` sections. Each field has a `<label for>`, most have a `.hint`. The only **required**
field is **annual kWh** (§4) — blank shows an inline error (`#annualKwhErr`, `aria-invalid`) and
focuses the field.

| # | Section | Notable fields (ids) |
|---|---|---|
| 1 | What matters most | objective ranks `obj_bill, obj_backup, obj_export, obj_selfsuff, obj_evsolar, obj_future, obj_carbon` (1–5) |
| 2 | Power cuts | `outageFreq, outageDur, ruralFeeder, backupScope (none/essential/whole), mustStayOn, generator` |
| 3 | Connection | `phase (1/3), mic, mainFuse, earthing (pme/tt/unknown), spareWays, smartMeter, cableRun` |
| 4 | Consumption | `annualKwh*, dynamicTariff, importRate, peakRate, nightRate, dayOccupancy, heating`, + nine `load*` checkboxes |
| 5 | Roof | `mount (roof/ground/both), orientation (yield value), panelCap, pitch, cover, roofAge, shading` |
| 6 | Existing solar | `existingPV, existingKwp, existingBattery, existingBatteryKwh, existingPlan (ac/dc)` |
| 7 | Battery prefs | `targetBattery, brandLean (open/powerwall/sigenergy/value/victron), appControl, openEco` |
| 8 | EV & future | `ev, evCharger (none/want/have), v2g, heatpumpPlan, loadShift` |
| 9 | Budget & grant | `budget, grantEligible, cegRate, funding` |
| 10 | Practical | `planning, approach (turnkey/diy)` |

**Orientation `<option>` values are the yield in kWh/kWp/yr** (used directly by `sizePV`):
South 950 · SE/SW 860 · E/W 750 · **E+W split 760** · Flat/other 800 · North 550. (The E+W split
value `760` is also the trigger for the mixed-aspect optimiser cost & flag.)

**Conditional UI** — `syncConditionals()` runs on load and on change of
`existingPV, existingBattery, dynamicTariff, ev, phase`:
- §6 existing-solar detail fields are **greyed/disabled** unless `existingPV = yes`
  (and `existingBatteryKwh` also needs `existingBattery = yes`).
- §4 `nightRateField` is **hidden** on a flat tariff; `peakRateField` only shows for the
  three-rate (`peakDayNight`) plan.
- §8 `v2g` is disabled when there's no EV.
- **MIC** defaults to 12 (single-phase) / 29 (three-phase) via `applyMicDefault()`, but honours a
  manual edit (`data-auto` flag).

The "Your answers" appendix card is generated by `answersSummary()`, which walks the **live form**,
skips disabled/hidden fields, collapses ticked load checkboxes into one row, and prints a labelled
table per section — so the record always matches what was actually entered.

---

## 5. The engine

### `classify(a)` — design philosophy
Decides the framing shown as a pill:
- **Battery-led (resilience)** if backup is wanted *and* (outages ≥ a few hours, or rural feeder, or
  backup ranked #1/#2).
- **PV-led (export/generation)** if export ranked #1/#2.
- **Balanced (bill reduction)** otherwise.

### `sizePV(a)` — array sizing
```
target   = annualKwh / yieldPerKwp            (orientation yield)
roofCap  = panelCap × panelKwp                (if panel count given)
acCap    = 3-phase ? mic×0.9 (or 15) : 5.75   (NC6 single-phase export limit)
dcCap    = acCap × 2.0                         (Irish hybrid installs oversize DC ~2× & export-limit)
budgetCap= (budget × {0.92 no-backup | 0.55 backup}) / 850
kWp      = max(1.5, min(target, roofCap, dcCap, budgetCap))
panels   = max(3, round(kWp / panelKwp));  kWp = panels × panelKwp
```
`panelKwp = PRICING.panelW/1000` (currently **500 W** → 0.5 kWp/panel). Generation = `kWp × yield`.
`reasons[]` explains which constraint bound the result.

### `sizeBattery(a, pv)` — storage sizing
Takes the **largest** applicable driver (all as a fraction of `daily = annualKwh/365`):
- Whole-home backup → `0.6 × daily`; essential → `min(0.3 × daily, 8)`.
- Smart tariff or load-shifting → arbitrage `0.5 × daily`.
- Otherwise self-consumption → `0.45 × daily` (out by day) or `0.3 × daily`.
- `+2 kWh` if EV present and solar-EV is a top-2 objective.
- Clamped to **[5, 30] kWh**, then to budget (`budget×0.5 / 500`).

**Existing battery:** if the user keeps existing panels (`existingPlan ≠ dc`) and already has storage,
the tool recommends only the **additional** capacity (or `kwh: 0` and an "integrate existing" note if
the current battery already covers the need). `targetBattery` overrides everything.

### `pickProduct(a, battery)` — brand selection
A **hard phase filter** then a **weighted score**; top-3 become primary + two alternatives.

| Signal | Points → |
|---|---|
| Native 3-phase (when supply is 3-ph) | +3 → sigenergy / solis / victron |
| Flexible modular (battery > 13.5 kWh) | +1 → modular brands |
| Whole-home backup wanted (eps `whole`) | +2 → sigenergy / powerwall / victron |
| EV **+ V2G** wanted (evReady) | +3 → sigenergy |
| App/automation wanted | +1 → sigenergy / anker |
| Financed or budget-capped | +1 → solis / anker |
| **Victron off-grid:** generator +3, DIY +2, off-grid #1 objective +2, open-eco +1 | → victron |
| Named brand leaning | +4 → that brand |
| "Value" brand leaning | +3 → solis / anker |

Victron only becomes *primary* on a **concrete** off-grid signal (generator / DIY) or off-grid as
the explicit #1 objective — a mere self-sufficiency *leaning* leaves it as an alternative. Powerwall
gets a 3-phase caveat note (it's single-phase per unit).

### `costSystem(a, pv, battery, product)` — itemised cost
Line items (each `[label, detail, €]`):
1. **PV array** = `kWp × pvRate(kWp)` (+ `groundMountExtra` if ground/both). *Excludes the inverter.*
2. **Optimisers** — all panels if heavy shading; ~11 panels if E+W split — `× optimiserPerPanel`.
3. **Battery + hybrid inverter** = `batteryCost()` (the inverter is carried here, not in the PV
   line). If keeping an existing battery: an "integrate existing" line (€900) instead.
4. **EV charger** — €600 if integrated (Sigenergy V2G) else €1,100 (and sets the €300 EV grant).
5. **TT earthing** (€300) if TT supply + backup; **whole-home backup board work** (€700);
   **extended cable run** (`(m−15) × €22`) beyond 15 m.

`subtotal − grant − evGrant = net`. `grant` = SEAI PV grant if `grantEligible = yes`.

### `economics(a, …)` — savings & payback
- Rates: `importR` (day, default 35c), `nightR` (default 13c / 10c dynamic), `peakR`
  (`peakRate` or `importR×1.2`), `cegR` (export, default 20c). On a three-rate plan, stored energy
  displaces the **peak** rate (`displacedR`).
- **Self-consumption fraction** = 0.30 + 0.25 (≥5 kWh) + 0.10 (≥10 kWh) + 0.05 (home by day),
  capped 0.75.
- **Savings** = self-use × importR **+** export × cegR **+** arbitrage
  (`0.9×kWh × 250 cycles × max(0, displacedR − nightR)`, only on a smart tariff with ≥5 kWh).
- **Payback** = `net / annual`. Displayed as a **range** (× the quote band — see §7), nearest 0.1 yr.

---

## 6. The pricing model (`PRICING`)

All pricing is one editable object near the top of the `<script>`. The model **splits PV from the
inverter**: `pvRate` is panels + mounting + install **excluding** the inverter, and each battery
product's `base` carries the single hybrid inverter + install. This matches how Irish quotes break
down and keeps totals accurate.

```js
PRICING = {
  panelW: 500,                       // W per panel (→ 0.5 kWp each)
  pvRate: kWp => 1100 / 850 / 780 / 720   // €/kWp by band ≤3 / ≤6 / ≤10 / >10
  groundMountExtra: 2250,            // ground vs roof premium
  optimiserPerPanel: 50,             // panel-level optimiser
  evCharger: 1100,                   // installed 7 kW smart charger
  evChargerGrant: 300,               // SEAI/ZEVI EV home-charger grant
  ttEarthingExtra: 300,              // EPS earth works on a TT supply
  consumerUnitWork: 700,             // whole-home backup board/changeover work
  grant: kWp => …,                   // SEAI PV grant, capped €1,800
  quoteBand: { low: 1.00, high: 1.15 },   // keen → typical-installer (see §7)
  batteries: { … }                   // see below
}
```

**Battery products** — `base` = hybrid inverter + install + gateway (fixed); `perKwh` = storage
modules. All-in €/kWh = `(base + kWh×perKwh)/kWh`.

| key | name | base | perKwh | phase | EPS | notes |
|---|---|---|---|---|---|---|
| `sigenergy` | Sigenergy SigenStor | 2200 | 330 | 1,3 | whole | premium all-in-one, V2G-ready, auto-gateway |
| `powerwall` | Tesla Powerwall 3 | `perUnit 8000` + `addUnit 6500` (13.5 kWh units) | | 1 | whole | built-in inverter; less common in IE |
| `solis` | Solis + Dyness | 1900 | 340 | 1,3 | essential | value mainstream, manual changeover |
| `anker` | Anker SOLIX | 1900 | 350 | 1 | essential | budget all-in-one, good app |
| `victron` | Victron MultiPlus-II + Pylontech | 3200 | 340 | 1,3 | whole | off-grid/prosumer, generator integration |

`BRAND_COLORS` (inverter colour in the diagram): victron `#1f6fb2` (blue), powerwall `#e3242b`
(red), sigenergy `#ff7a1a` (orange), solis `#00a3a3` (teal), anker `#00b3c4` (cyan).

---

## 7. The quoted range: keen → installer

Costs and payback are shown as a **range**, not a single figure, to reflect the real spread between
installers and avoid false precision.

- The `PRICING` constants are deliberately set to the **keen / best-value** price → the **low** end
  of the range (`quoteBand.low = 1.00`, i.e. the model's computed net).
- The **high** end is `net × quoteBand.high` (currently **× 1.15**) → what a **typical installer**
  charges for the same spec.

Helpers: `bandLo/bandHi(n)`, `eurR(n)` (rounds to nearest €50 so a range reads as guidance), and
`eurBand(n)` → `"€X – €Y"`. The costing card shows both labelled rows ("best-value (keen)" /
"typical installer"); the headline and payback show the band.

To widen/narrow the spread, edit `quoteBand.high`. The explanatory note's percentage updates
automatically from the band.

---

## 8. Grants, VAT & Irish reference

- **SEAI solar PV grant (2026):** €700/kWp first 2 kWp + €200/kWp next 2 kWp, **cap €1,800** (≥4 kWp).
  Applied to the PV portion only (not the battery). Generally needs the home connected before
  end-2020 and an SEAI-registered installer.
- **SEAI / ZEVI EV Home Charger Grant (2026): €300**, a **separate** scheme (homeowner, off-street
  parking, charger on the SEAI Smart Charger Register, Safe Electric installer; apply before buying).
  Applied to a standalone 7 kW charger only — not the integrated Sigenergy V2G unit.
- **0 % VAT** when PV + battery are supplied on one contract.
- **CEG** (Clean Export Guarantee): suppliers pay for exported energy (~18–24c); first €400/yr of
  export income is tax-free (disregard to end-2028).
- **NC6 / NC7:** a single-phase grid-tied inverter is export-capped at **25 A (~5.75 kW)** under the
  NC6 notification; larger needs an NC7 DSO application. Irish hybrid installs commonly fit a much
  larger DC array on a 5 kW inverter and **export-limit** it (the model's `dcCap = 2× acCap`).
- **MIC** = Maximum Import Capacity (on the ESB Networks letter). **TT earthing** (earth rod) needs
  extra earthing work for backup vs PME/TN-C-S.

---

## 9. The output report

`render()` assembles cards in this order, then `decorateHeadings()` swaps each leading emoji for a
crisp inline SVG icon tile (`ICONS` map, via `pickIcon()`):

1. **Report header** — title + generated timestamp (top of the printed PDF).
2. **Headline** — `kWp · battery · brand`, design-philosophy pill, key tags (panels, generation,
   phase, net-cost range, payback range).
3. **⚡ Your system** — the animated diagram (§10).
4. **📦 Recommended products** — primary + reasons + up to two alternatives.
5. **💶 Indicative costing** — line items, subtotal, grants, keen/installer net rows, notes.
6. **📈 Economics** — generation, self-use %, savings breakdown, total benefit, payback range.
7. **☀️ Solar array**, **🔌 Inverter & topology**, **🔋 Battery** — supporting detail + rationale.
8. **🛠️ Installation plan** — 4 steps + **⚠️ flags** (or a green "no major flags").
9. **Disclaimer**, **📝 Your answers** (appendix), and a no-print Print button.

**Flags** (`render()`): TT+backup earthing; Powerwall on 3-phase; full fuse board; poor roof; heavy
shading or E+W split optimisers; >22 panels exceeding a 2-string inverter; ground mount on a
planning-sensitive site; no smart meter; low MIC; heat-pump winter load; electric shower exceeding
battery backup output.

---

## 10. The animated system diagram

`systemDiagram(a, pv, battery, product)` returns a `<div class="card">` wrapping a responsive inline
`<svg viewBox="0 0 900 460">`. Pure SVG + CSS — no libraries.

**Layout (left → right):** ☀️ sun (pulsing glow + rotating rays) → yellow **sunbeams** onto the
panels → **panels** → **inverter** (hub) → fan of wires to the **right-column nodes**.

**Components, drawn conditionally:**
- **Panels:** a **house** with panels on the pitched roof for roof-mount; a **tilted frame on a grass
  strip** for ground-mount. Labelled `panels × W` + mount type.
- **Inverter:** a brand-coloured wall device (colour from `BRAND_COLORS`) with a screen, status LEDs
  and the product short-name.
- **Battery** (always; or "existing"), **Home**, **EV charger** (only if added), **Grid** — stacked
  on the right, spacing computed from how many are present.
- **Changeover / auto-gateway switch** on the inverter→home wire, only if backup is chosen ("Auto
  gateway" for sigenergy/powerwall/victron, else "Changeover").

**Power flow:** the **green** animated dashes (`.flow`, `@keyframes flow`) start at the **panels**
(not the sun — sunlight is the yellow beams) and run **directionally** to the inverter then out to
battery / home / EV / grid, with arrowheads (`marker #ah`). `prefers-reduced-motion` freezes all
animation; the diagram stays fully readable and prints as a static frame.

---

## 11. UI, theme & accessibility

- **Theme:** warm light palette (CSS custom properties in `:root`), **Plus Jakarta Sans**, soft
  shadows, rounded cards, an amber accent. A custom sun logo and numbered section badges (`.legnum`,
  applied by a small init script).
- **Accessibility:** every input has an associated `<label for>`; `aria-required`/`aria-invalid` +
  `role="alert"` on the required field; `aria-live="polite"` on the results region;
  `:focus-visible` outlines; the SVG carries a descriptive `aria-label`; `prefers-reduced-motion`
  honoured. `answersSummary()` and the disabled/hidden-field skipping keep the printed record honest.
- **Responsive:** two-column grid collapses to one below 720 px; the SVG scales with its viewBox.

> Note: `loadDemo()` (an example-filler) still exists and is callable from the console, but its
> button was removed from the form during the redesign.

---

## 12. Recalibrating the pricing

The model is meant to be tuned against fresh real quotes. To do it well:

1. For each quote, note **kWp** (panel count × wattage), **battery kWh + brand**, **total price**,
   **before/after the €1,800 grant**, and **mount type**.
2. Run that spec through the model and compare.
3. Adjust the right knob:
   - **PV too low/high** → `pvRate` band(s).
   - **Battery off** → that brand's `base` / `perKwh`. Given two quotes at different sizes:
     `perKwh = (priceBig − priceSmall) / (kWhBig − kWhSmall)`, then
     `base = priceSmall − perKwh × kWhSmall`.
   - **Whole range shifted** → re-anchor constants to the **keenest** quotes (low end); set
     `quoteBand.high` to (typical installer ÷ keen).
4. Re-check the **whole** benchmark set so one fix doesn't break the others; verify in the preview;
   commit + push.

Keep pricing attributed to **"typical 2026 Irish market"** data in any committed file, comment, or
commit message.

---

## 13. Deployment

- **Repo:** `github.com/dmigsy/solarbuild`, branch `main`.
- **Host:** GitHub Pages → **https://dmigsy.github.io/solarbuild/**. Pages rebuilds ~1 min after a
  push.
- **Update flow:** edit `index.html` → verify in the preview → `git commit` → `git push origin main`.
  If the repo was edited directly on GitHub between sessions, `git pull` (or fetch + check) first to
  avoid a divergence.

---

## 14. Assumptions & limitations

- **Indicative only — not a quote and not engineering sign-off.** Final loads, structural/electrical
  compliance and the real price require an SEAI-registered installer's site survey.
- Yields are orientation-based annual averages (no per-site shading model beyond the optimiser
  trigger). Self-consumption fractions are heuristic.
- Simple payback (no finance cost, no electricity-price inflation — real savings rise as prices do).
- The diagram shows a steady-state **daytime "generating"** scene (not a real-time day/night sim).
- Product selection is a transparent heuristic, not an exhaustive market comparison.

---

## 15. Function reference

| Function | Role |
|---|---|
| `generate()` | orchestrator: validate → engine pipeline → `render()` |
| `collect()` | read the form into the `a` answers object |
| `classify(a)` | battery-led vs PV-led vs balanced |
| `sizePV(a)` | array kWp & panel count under all constraints |
| `sizeBattery(a, pv)` | usable kWh (incl. existing-battery handling) |
| `pickProduct(a, battery)` | weighted brand score → primary + alternatives |
| `batteryCost(p, kwh)` / `costSystem(…)` | per-line costing & net |
| `economics(…)` | savings, arbitrage, payback |
| `systemDiagram(…)` | the animated SVG card |
| `render(…)` | assemble all output cards |
| `answersSummary()` | "Your answers" appendix from the live form |
| `decorateHeadings()` / `pickIcon()` / `ICONS` | emoji → SVG icon tiles |
| `syncConditionals()` / `setEnabled()` / `setVisible()` / `applyMicDefault()` | conditional-field UX |
| helpers | `$ num val chk eur eurR bandLo bandHi eurBand round1` |
| constants | `PRICING`, `BRAND_COLORS`, `OBJ` |

---

*This document describes the build as committed. When the tool changes materially (new fields,
engine logic, or pricing structure), update the relevant section here too.*
