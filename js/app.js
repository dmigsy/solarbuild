/* =========================================================================
   PRICING & ASSUMPTIONS  —  Ireland, 2026.
   Modelled on typical 2026 Irish installed prices. Model split: PV €/kWp
   (panels+mounting+install, no inverter) + a battery line that carries the
   single hybrid inverter (base) plus the storage modules (perKwh). Totals
   reproduce typical before/after-grant system prices. Edit freely.
   ========================================================================= */
const PRICING = {
  panelW: 500,                 // W per panel (2026 typical)
  // PV cost = a FIXED install/overhead (scaffold, DC wiring, commissioning, BER,
  // overhead/margin — the inverter is priced once in the battery line) + a per-panel
  // marginal (panel + rail + labour). This fixed+marginal shape matches the group
  // "should cost" heuristic (~€200/panel marginal, high fixed base) far better than a
  // flat €/kWp, which over-priced big arrays and under-priced small ones.
  // These are the KEEN / best-value figures — the LOW end of the quoted range; the
  // typical-installer HIGH end is this × quoteBand.high below.
  pvFixed: 2000,               // fixed scaffold + install + DC + commissioning + BER
  pvPerPanel: 260,             // marginal per panel (panel + mounting + labour)
  groundMountExtra: 1800,      // frames/trenching premium over roof (~€1.5–3k; lower end on bigger arrays)
  optimiserPerPanel: 50,       // panel-level optimiser (per panel) for shaded / mixed-aspect strings
  evCharger: 1100,             // installed 7 kW smart charger
  evChargerGrant: 300,         // SEAI/ZEVI EV Home Charger Grant 2026 (standalone registered charger)
  hotWaterDiverter: 700,       // myenergi eddi-type solar hot-water diverter, installed
  ttEarthingExtra: 300,        // EPS earth rod / RCD work on TT supplies (earth rod ~€250)
  consumerUnitWork: 700,       // whole-home backup: manual changeover ~€450, Sig auto-gateway ~€1,650
  // Battery products. base = hybrid inverter + install + gateway; perKwh = storage
  // module. all-in €/kWh = (base + kwh*perKwh)/kwh. Commodity modules (Dyness/Solis/
  // Pylontech/Anker) run ~€250/kWh; Sigenergy's proprietary modules carry a premium
  // (~€340/kWh) so its lead over the value combo widens with battery size.
  batteries: {
    sigenergy: { name:"Sigenergy SigenStor", tier:"premium", base:2100, perKwh:340, min:5, step:5, max:48,
        phase:[1,3], hybrid:true, eps:"whole", evReady:true, premium:true, appGood:true,
        note:"Premium all-in-one, modular 5–48 kWh, 1- & 3-phase, AI tariff control, auto-gateway backup, optional DC EV charger with V2G/V2H. Proprietary (more expensive) battery modules." },
    powerwall: { name:"Tesla Powerwall 3", tier:"premium", unit:13.5, perUnit:8000, addUnit:6500,
        phase:[1], hybrid:true, eps:"whole", maxKwh:40.5,
        note:"13.5 kWh LFP with built-in 11.5 kW solar inverter; whole-home backup; Storm Watch. Less common in IE quotes." },
    solis:     { name:"Solis hybrid + Dyness/Soluna battery", tier:"value", base:2100, perKwh:250, min:5, step:5, max:30,
        phase:[1,3], hybrid:true, eps:"essential",
        note:"Most-quoted value combo in IE: Solis hybrid inverter + commodity modules (Dyness or Soluna), manual changeover switch, mix-and-match batteries." },
    anker:     { name:"Anker SOLIX all-in-one", tier:"value", base:2100, perKwh:250, min:5, step:5, max:30,
        phase:[1], hybrid:true, eps:"essential", appGood:true,
        note:"Tidy budget all-in-one, single-phase, well-regarded app; EPS on essential circuits." },
    goodwe:    { name:"Goodwe hybrid + battery", tier:"mid", base:2200, perKwh:300, min:5, step:5, max:40,
        phase:[1,3], hybrid:true, eps:"essential", appGood:true,
        note:"Established mid-tier hybrid inverter (1- & 3-phase) with stackable modules; widely installed, solid app, sits between the value combos and the premium all-in-ones." },
    ecoflow:   { name:"EcoFlow PowerOcean", tier:"premium", base:2600, perKwh:320, min:5, step:5, max:40,
        phase:[1], hybrid:true, eps:"whole", appGood:true,
        note:"Newer premium all-in-one with whole-home backup and a strong consumer app; stackable 5 kWh modules, single-phase." },
    saj:       { name:"SAJ hybrid + battery", tier:"value", base:1900, perKwh:220, min:5, step:5, max:30,
        phase:[1,3], hybrid:true, eps:"essential",
        note:"Budget end of the market — keenly priced, often with a long (15-yr) warranty. App/software is basic but the hardware is well proven." },
    victron:   { name:"Victron (MultiPlus-II + Pylontech)", tier:"premium", base:3200, perKwh:250, min:5, step:5, max:60,
        phase:[1,3], hybrid:true, eps:"whole", offgrid:true,
        note:"Off-grid / prosumer ecosystem: bulletproof, endlessly configurable, best-in-class generator + multi-source integration and true island-mode. Needs expertise to commission; engineer-facing VRM app. Overkill (and pricier) for a standard grid-tie install." },
  },
  // SEAI grant (2026): €700/kWp first 2 kWp, €200/kWp next 2 kWp, cap €1,800.
  grant: kwp => Math.min(1800, Math.min(kwp,2)*700 + Math.max(0,Math.min(kwp,4)-2)*200),
  // The quoted range. low = 1.0 anchors the LOW end to the keen constants above (a
  // best-value / sharp quote). high = installer premium → the typical-installer top
  // end. Tune `high` if local installers run dearer/keener than ~15% over best value.
  quoteBand: { low: 1.00, high: 1.15 },
};

/* Inverter colours for the system diagram (Victron blue requested). */
const BRAND_COLORS = {
  victron:   '#1f6fb2',  // blue
  powerwall: '#e3242b',  // Tesla red
  sigenergy: '#ff7a1a',  // Sigen orange
  solis:     '#00a3a3',  // teal
  anker:     '#00b3c4',  // cyan
  goodwe:    '#d81e3f',  // Goodwe red
  ecoflow:   '#1aa34a',  // EcoFlow green
  saj:       '#6d4fc0',  // purple
};

/* ---------------- objectives table ---------------- */
const OBJ = [
  ["bill","Cut electricity bill"],
  ["backup","Backup during power cuts (resilience)"],
  ["export","Maximise export income"],
  ["selfsuff","Self-sufficiency / off-grid leanings"],
  ["evsolar","EV charging from solar"],
  ["future","Future-proofing (heat pump, EV later)"],
  ["carbon","Environmental / carbon"],
];
const objDiv = document.getElementById('objectives');
OBJ.forEach(([id,label])=>{
  const row=document.createElement('div'); row.className='rank';
  row.innerHTML=`<span id="objlbl_${id}">${label}</span>
    <select id="obj_${id}" aria-label="Rank: ${label}">
      <option value="">Not ranked</option><option>1</option><option>2</option>
      <option>3</option><option>4</option><option>5</option></select>`;
  objDiv.appendChild(row);
});

/* ---------------- helpers ---------------- */
const $ = id => document.getElementById(id);
const num = id => parseFloat($(id).value)||0;
const val = id => $(id).value;
const chk = id => $(id).checked;
const eur = n => "€"+Math.round(n).toLocaleString('en-IE');
// round to the nearest €50 so a range reads as guidance, not false precision
const eurR = n => "€"+(Math.round(n/50)*50).toLocaleString('en-IE');
const bandLo = n => n*PRICING.quoteBand.low, bandHi = n => n*PRICING.quoteBand.high;
const eurBand = n => `${eurR(bandLo(n))} – ${eurR(bandHi(n))}`;
const round1 = n => Math.round(n*10)/10;

/* ============================ ENGINE ============================ */
function generate(){
  const a = collect();
  const akWh=$('annualKwh'), akErr=$('annualKwhErr');
  if(!a.annualKwh){
    akWh.setAttribute('aria-invalid','true');
    akErr.classList.add('show');
    akWh.focus();
    akWh.scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }
  akWh.removeAttribute('aria-invalid'); akErr.classList.remove('show');

  const pv      = sizePV(a);
  const battery = sizeBattery(a, pv);
  const product = pickProduct(a, battery);
  const cost    = costSystem(a, pv, battery, product);
  const econ    = economics(a, pv, battery, product, cost);
  const led     = classify(a);

  render(a, pv, battery, product, cost, econ, led);
  const out=$('out');
  out.style.display='block';
  out.focus({preventScroll:true});
  out.scrollIntoView({behavior:'smooth'});
}

/* design philosophy: battery-led vs PV-led */
function classify(a){
  const backupRank = a.obj.backup, exportRank = a.obj.export;
  const wantsBackup = a.backupScope!=="none" && (a.outageDur>=4 || a.ruralFeeder==="yes" || backupRank===1 || backupRank===2);
  if(wantsBackup) return {type:"Battery-led (resilience priority)", wantsBackup:true};
  if(exportRank===1 || exportRank===2) return {type:"PV-led (export/generation priority)", wantsBackup:false};
  return {type:"Balanced (bill reduction priority)", wantsBackup:false};
}

/* ---- PV sizing ---- */
function sizePV(a){
  const yieldPerKwp = a.orientation;                 // kWh per kWp per yr
  const panelKwp = PRICING.panelW/1000;
  // target to offset most consumption; battery raises self-use so allow full offset
  let target = a.annualKwh / yieldPerKwp;
  // constraints
  const roofCap = a.panelCap>0 ? a.panelCap*panelKwp : 99;
  // inverter / grid export cap. 1-ph NC6 export ≤ 25 A (~5.75 kW) without DSO consent.
  // Irish hybrid installs deliberately oversize the DC array ~2x the inverter and
  // export-limit it, since battery + self-use soak the midday peak (10–11 kWp DC
  // on a 5 kW single-phase inverter is common). 3-ph scales with MIC.
  const acCap = a.phase===3 ? (a.mic>0? a.mic*0.9 : 15) : 5.75;
  const dcCap = acCap*2.0;
  // budget cap (rough: leave ~45% of budget for battery if backup wanted)
  let budgetCap = 99;
  if(a.budget>0){
    const pvBudget = a.budget * (a.backupScope==="none"?0.92:0.55);
    budgetCap = pvBudget / 850;
  }
  let kwp = Math.min(target, roofCap, dcCap, budgetCap);
  kwp = Math.max(kwp, 1.5);
  let panels = Math.max(3, Math.round(kwp/panelKwp));
  kwp = round1(panels*panelKwp);

  const reasons=[];
  reasons.push(`Consumption ${a.annualKwh.toLocaleString()} kWh ÷ ${yieldPerKwp} kWh/kWp yield ⇒ ~${round1(target)} kWp to offset usage.`);
  if(a.panelCap>0 && Math.abs(roofCap-kwp)<0.3) reasons.push(`Capped by roof space (${a.panelCap} panels).`);
  if(Math.abs(dcCap-kwp)<0.3) reasons.push(`Capped at ~${round1(dcCap)} kWp by the ${a.phase===3?'3-phase':'single-phase'} inverter (${acCap} kW AC, export-limited, ~2× DC oversize).`);
  if(a.budget>0 && Math.abs(budgetCap-kwp)<0.4) reasons.push(`Trimmed to fit budget.`);
  if(a.shading==="heavy") reasons.push(`Heavy shading — recommend panel-level optimisers / micro-inverters.`);
  if(a.existingPV==="yes") reasons.push(`Existing ${a.existingKwp} kWp array noted — see retrofit flags.`);

  const annualGen = Math.round(kwp*yieldPerKwp);
  return {kwp, panels, panelKwp, acCap, annualGen, yieldPerKwp, reasons};
}

/* ---- battery sizing ---- */
function sizeBattery(a, pv){
  if(a.targetBattery>0){
    return {kwh:a.targetBattery, reasons:[`Using your specified target of ${a.targetBattery} kWh usable.`]};
  }
  const daily = a.annualKwh/365;
  const reasons=[];
  let need = 0;

  // resilience component
  if(a.backupScope==="whole"){ need = Math.max(need, daily*0.6); reasons.push(`Whole-home backup: ~${round1(daily*0.6)} kWh covers an evening + overnight at ~60% of daily use.`);}
  else if(a.backupScope==="essential"){ need = Math.max(need, Math.min(daily*0.3, 8)); reasons.push(`Essential-circuit backup: ~${round1(Math.min(daily*0.3,8))} kWh for fridge/freezer, broadband, lights, heating pump.`);}

  // arbitrage / self-consumption component
  if(a.dynamicTariff!=="no" || a.loadShift==="yes"){
    const arb = daily*0.5;
    if(arb>need){ need=arb; reasons.push(`Smart-tariff arbitrage: ~${round1(arb)} kWh to shift cheap night charge into day/peak use.`);}
    else reasons.push(`Smart-tariff arbitrage also supported by this size.`);
  } else {
    const sc = a.dayOccupancy==="out" ? daily*0.45 : daily*0.3;
    if(sc>need){ need=sc; reasons.push(`Self-consumption: ~${round1(sc)} kWh to store daytime solar for the evening peak.`);}
  }

  // EV nudge
  if(a.ev==="yes" && a.obj.evsolar && a.obj.evsolar<=2){ need+=2; reasons.push(`+2 kWh headroom for solar EV top-ups.`); }

  // sanity clamp
  need = Math.max(5, Math.min(need, 30));

  // existing battery: if keeping it, recommend only the ADDITIONAL capacity
  let addOnly=false;
  if(a.existingBattery==="yes" && a.existingBatteryKwh>0 && a.existingPlan!=="dc"){
    const extra = Math.max(0, need - a.existingBatteryKwh);
    if(extra < 2){
      reasons.unshift(`You already have ~${a.existingBatteryKwh} kWh of storage, which broadly covers the need above — likely no extra battery required. Worth confirming it can take on the new panels/backup.`);
      return {kwh:0, existingKwh:a.existingBatteryKwh, addOnly:true, reasons};
    }
    reasons.unshift(`You already have ~${a.existingBatteryKwh} kWh — figures below are the ADDITIONAL capacity to add (total ≈ ${Math.round(need)} kWh).`);
    need = extra; addOnly=true;
  }

  // budget clamp
  if(a.budget>0){
    const batBudget = a.budget*0.5;
    const maxKwh = batBudget/500;
    if(maxKwh<need){ need=Math.max(5,maxKwh); reasons.push(`Trimmed to fit budget.`); }
  }
  return {kwh:Math.round(need), existingKwh:(a.existingBattery==="yes"?a.existingBatteryKwh:0), addOnly, reasons};
}

/* ---- product selection ---- */
function pickProduct(a, battery){
  const B=PRICING.batteries;
  const cand=[];
  const phaseOK = p => p.phase.includes(a.phase);
  const score=(key,p)=>{
    let s=0; const r=[];
    if(!phaseOK(p)){ return null; }
    if(a.phase===3 && p.phase.includes(3)){ s+=3; r.push("native 3-phase"); }
    if(battery.kwh>13.5 && p.perKwh){ s+=1; r.push("flexible modular sizing"); }
    if(a.backupScope==="whole" && p.eps==="whole"){ s+=2; r.push("whole-home backup"); }
    if((a.ev==="yes"||a.ev==="planned") && a.v2g==="yes" && p.evReady){ s+=3; r.push("integrated EV charger + V2G/V2H"); }
    if(a.appControl==="app" && (key==="sigenergy"||p.appGood)){ s+=1; r.push("strong app/automation"); }
    if(a.funding!=="cash" || a.budget>0){ if(p.tier==="value"){ s+=1; r.push("better value"); } }
    // Victron / off-grid signals. Concrete drivers (a generator to integrate, DIY
    // appetite) carry the weight; a mere self-sufficiency *leaning* (#2) is left to
    // Sigenergy's big modular battery. Victron only wins on a generator/DIY signal
    // or when off-grid is the explicit #1 objective — otherwise it stays an alt.
    if(p.offgrid){
      let off=0;
      if(a.generator==="yes"){ off+=3; r.push("integrates an existing generator"); }
      if(a.approach==="diy"){ off+=2; r.push("DIY / configurability appetite"); }
      if(a.obj.selfsuff===1){ off+=2; r.push("off-grid is the #1 objective"); }
      if(off>=2 && a.openEco==="yes"){ off+=1; r.push("open ecosystem"); }
      s+=off;
    }
    if(a.brandLean===key){ s+=4; r.push("matches your brand leaning"); }
    if(a.brandLean==="value" && p.tier==="value"){ s+=3; r.push("value brand"); }
    return {key,p,score:s,reasons:r};
  };
  for(const k in B){ const c=score(k,B[k]); if(c) cand.push(c); }
  cand.sort((x,y)=>y.score-x.score);

  // hard guard: Powerwall is single-phase per unit
  if(a.phase===3){
    const pw=cand.find(c=>c.key==="powerwall");
    if(pw) pw.reasons.push("note: 1-ph per unit — needs 3 for balanced 3-ph backup");
  }
  return {primary:cand[0], alts:cand.slice(1,3)};
}

/* ---- costing ---- */
function batteryCost(p, kwh){
  if(p.perUnit!=null){
    const units=Math.max(1,Math.ceil(kwh/p.unit));
    return {price:p.perUnit + (units-1)*p.addUnit, detail:`${units}× unit, ${round1(units*p.unit)} kWh incl. inverter`};
  }
  const price = (p.base||0) + kwh*p.perKwh;
  return {price, detail:`${kwh} kWh + hybrid inverter (${eur(price/kwh)}/kWh all-in)`};
}
function costSystem(a, pv, battery, product){
  const rows=[];
  // PV = fixed install/overhead + per-panel marginal (inverter is in the battery line)
  let pvCost = PRICING.pvFixed + pv.panels * PRICING.pvPerPanel;
  const p = product.primary.p;
  if(a.mount==="ground"||a.mount==="both") pvCost += PRICING.groundMountExtra;
  rows.push(["PV array (panels + mounting + install)",`${pv.panels}× ${PRICING.panelW}W = ${pv.kwp} kWp — inverter in battery line`,pvCost]);

  // panel-level optimisers: heavy shading optimises the whole array; an East+West
  // split mixes aspects on a string, so that string's panels (~11) need optimisers.
  let optPanels = 0;
  if(a.shading==="heavy") optPanels = pv.panels;
  else if(a.orientation===760) optPanels = Math.min(pv.panels, 11);
  if(optPanels>0) rows.push(["Panel optimisers",`${optPanels}× optimiser — shaded / mixed-aspect string(s)`,optPanels*PRICING.optimiserPerPanel]);

  if(battery.kwh>0){
    const bc = batteryCost(p, battery.kwh);
    rows.push([battery.addOnly?"Additional battery + integration":"Battery + hybrid inverter",`${p.name} — ${bc.detail}`,bc.price]);
  } else {
    rows.push(["Integrate existing battery","AC-couple / gateway to keep your current storage",900]);
  }

  let evGrant = 0;
  if(a.evCharger==="want"){
    if(p.evReady && (a.v2g==="yes")) rows.push(["EV charger","Integrated in Sigenergy (V2G)",600]);
    else { rows.push(["EV charger","7 kW smart wall charger, installed",PRICING.evCharger]); evGrant = PRICING.evChargerGrant; }
  }
  if(a.hotWaterDiverter==="yes") rows.push(["Hot-water diverter","myenergi eddi (or similar), installed — surplus solar to the immersion",PRICING.hotWaterDiverter]);
  if(a.earthing==="tt" && a.backupScope!=="none") rows.push(["TT earthing / EPS works","Earth rod + RCD arrangement for backup",PRICING.ttEarthingExtra]);
  if(a.backupScope==="whole") rows.push(["Backup change-over / board work","Whole-home EPS integration",PRICING.consumerUnitWork]);
  if(a.cableRun>15) rows.push(["Extended cable run",`${a.cableRun} m meter→inverter`,Math.round((a.cableRun-15)*22)]);

  const subtotal = rows.reduce((s,r)=>s+r[2],0);
  const grant = a.grantEligible==="yes" ? PRICING.grant(pv.kwp) : 0;
  const net = subtotal - grant - evGrant;
  return {rows, subtotal, grant, evGrant, net};
}

/* ---- economics ---- */
function economics(a, pv, battery, product, cost){
  const importR = (num('importRate')||35)/100;
  const nightR  = (num('nightRate')|| (a.dynamicTariff==="dynamic"?10:13))/100;
  const peakR   = (a.peakRate>0 ? a.peakRate/100 : importR*1.2);
  const cegR    = (num('cegRate')||20)/100;
  // a stored unit is discharged into the evening peak where a peak rate exists
  const displacedR = a.dynamicTariff==="peakDayNight" ? peakR : importR;
  const gen = pv.annualGen;

  // self-consumption fraction: battery + occupancy dependent
  let scFrac = 0.30;
  if(battery.kwh>=5) scFrac += 0.25;
  if(battery.kwh>=10) scFrac += 0.10;
  if(a.dayOccupancy==="home") scFrac += 0.05;
  scFrac = Math.min(scFrac, 0.75);

  const selfUsed = gen*scFrac;
  const exported = gen-selfUsed;
  const selfSaving = selfUsed*importR;
  let exportIncome = exported*cegR;
  // €400/yr tax disregard — income above is fine; just note it
  // arbitrage: night-charge battery, displace peak import (only if smart tariff)
  let arbSaving = 0;
  if(a.dynamicTariff!=="no" && battery.kwh>=5){
    const usable = battery.kwh*0.9, cyclesPerYr = 250; // conservative blended night-cycles
    arbSaving = usable*cyclesPerYr*Math.max(0, displacedR-nightR);
  }
  const annual = selfSaving+exportIncome+arbSaving;
  const payback = annual>0 ? cost.net/annual : null;
  return {selfUsed:Math.round(selfUsed), exported:Math.round(exported), scFrac,
    selfSaving, exportIncome, arbSaving, annual, payback, importR, nightR, peakR, displacedR, cegR};
}

/* ============================ COLLECT ============================ */
function collect(){
  const obj={}; OBJ.forEach(([id])=> obj[id]=parseInt(val('obj_'+id))||null);
  return {
    obj,
    outageFreq:num('outageFreq'), outageDur:parseInt(val('outageDur')),
    ruralFeeder:val('ruralFeeder'), backupScope:val('backupScope'),
    mustStayOn:val('mustStayOn'), generator:val('generator'),
    phase:parseInt(val('phase')), mic:num('mic'), mainFuse:val('mainFuse'),
    earthing:val('earthing'), spareWays:val('spareWays'), smartMeter:val('smartMeter'), cableRun:num('cableRun'),
    annualKwh:num('annualKwh'), dynamicTariff:val('dynamicTariff'),
    peakRate:num('peakRate'),
    dayOccupancy:val('dayOccupancy'), heating:val('heating'), hotWaterDiverter:val('hotWaterDiverter'),
    loads:{ immersion:chk('loadImmersion'), shower:chk('loadShower'), dryer:chk('loadDryer'),
            dish:chk('loadDish'), oven:chk('loadOven'), ac:chk('loadAC'),
            hottub:chk('loadHotTub'), pool:chk('loadPool'), workshop:chk('loadWorkshop') },
    mount:val('mount'), orientation:parseInt(val('orientation')), panelCap:num('panelCap'),
    pitch:val('pitch'), cover:val('cover'), roofAge:val('roofAge'), shading:val('shading'),
    existingPV:val('existingPV'), existingKwp:num('existingKwp'), existingPlan:val('existingPlan'),
    existingBattery:val('existingBattery'), existingBatteryKwh:num('existingBatteryKwh'),
    targetBattery:num('targetBattery'), brandLean:val('brandLean'),
    appControl:val('appControl'), openEco:val('openEco'),
    ev:val('ev'), evCharger:val('evCharger'), v2g:val('v2g'),
    heatpumpPlan:val('heatpumpPlan'), loadShift:val('loadShift'),
    budget:num('budget'), grantEligible:val('grantEligible'), funding:val('funding'),
    planning:val('planning'), approach:val('approach'),
  };
}

/* ===================== SYSTEM DIAGRAM (animated SVG) ===================== */
function systemDiagram(a, pv, battery, product){
  const key = product.primary.key;
  const invColor = BRAND_COLORS[key] || '#f59e0b';
  const invName  = product.primary.p.name.replace(/\s*\(.*$/,'').split(' + ')[0]; // short name
  const hasEV = a.evCharger==='want' || a.evCharger==='have';
  const hasBackup = a.backupScope!=='none';
  const ground = a.mount==='ground';

  const Hx=505, Hy=235;                 // inverter hub (right edge) = flow origin to right column
  const Nx=700;                         // left edge of right-column nodes

  // present right-column nodes, evenly spaced
  const list=['battery','house']; if(hasEV) list.push('ev'); list.push('grid');
  const N=list.length, topY=78, botY=402;
  const cy={}; list.forEach((k,i)=> cy[k]= topY + (botY-topY)*((i+0.5)/N));

  const bez=(x2,y2)=>`M ${Hx} ${Hy} C ${Hx+85} ${Hy}, ${x2-85} ${y2}, ${x2} ${y2}`;

  /* --- wires from hub to each right node (flow = inverter → node) --- */
  let wires='', flows='';
  list.forEach(k=>{
    const d=bez(Nx, cy[k]);
    wires+=`<path class="wire" d="${d}"/>`;
    flows+=`<path class="flow" d="${d}" marker-end="url(#ah)"/>`;
  });
  // green power begins at the PANELS (not the sun). PA = panel output anchor.
  const PA = ground ? {x:240,y:200} : {x:234,y:243};
  const wPan=`M ${PA.x} ${PA.y} C ${PA.x+60} ${PA.y}, 330 235, 385 235`;
  wires=`<path class="wire" d="${wPan}"/>`+wires;
  flows=`<path class="flow" d="${wPan}" marker-end="url(#ah)"/>`+flows;
  // sunlight shown as faint yellow beams (light, not electrical power)
  const beams=`<g stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round" opacity=".6" stroke-dasharray="2 8"><line x1="116" y1="96" x2="146" y2="150"/><line x1="134" y1="90" x2="176" y2="150"/><line x1="98" y1="98" x2="118" y2="150"/></g>`;

  /* --- icons --- */
  const iconBattery=(cx,c)=>`<g stroke="#059669" fill="none" stroke-width="2"><rect x="${cx-13}" y="${c-9}" width="22" height="18" rx="2"/><rect x="${cx+9}" y="${c-4}" width="3" height="8" fill="#059669"/><rect x="${cx-10}" y="${c-6}" width="5" height="12" fill="#059669" stroke="none"/><rect x="${cx-3}" y="${c-6}" width="5" height="12" fill="#059669" stroke="none" opacity=".55"/></g>`;
  const iconHouse=(cx,c)=>`<g stroke="#78716c" fill="none" stroke-width="2" stroke-linejoin="round"><path d="M${cx-12} ${c+10} V${c-1} L${cx} ${c-12} L${cx+12} ${c-1} V${c+10} Z"/></g>`;
  const iconEV=(cx,c)=>`<g stroke="#78716c" fill="none" stroke-width="2" stroke-linejoin="round"><path d="M${cx-13} ${c+6} h26 v-7 l-4 -6 h-18 l-4 6 z"/><circle cx="${cx-7}" cy="${c+6}" r="2.4" fill="#78716c"/><circle cx="${cx+7}" cy="${c+6}" r="2.4" fill="#78716c"/><path d="M${cx+13} ${c-3} h5 v6" stroke="#059669"/></g>`;
  const iconGrid=(cx,c)=>`<g stroke="#78716c" fill="none" stroke-width="2"><path d="M${cx-9} ${c+11} L${cx-5} ${c-11} H${cx+5} L${cx+9} ${c+11}"/><path d="M${cx-7} ${c-2} H${cx+7}"/><path d="M${cx-8} ${c+4} H${cx+8}"/><path d="M${cx-5} ${c-8} H${cx+5}"/></g>`;
  const ICON={battery:iconBattery,house:iconHouse,ev:iconEV,grid:iconGrid};

  const META={
    battery:['Battery', battery.kwh>0 ? `${battery.kwh} kWh usable` : `${battery.existingKwh||0} kWh (existing)`],
    house:  ['Home', hasBackup ? (a.backupScope==='whole'?'whole-home loads':'essential loads') : 'household loads'],
    ev:     ['EV charger', (key==='sigenergy'&&a.v2g==='yes')?'built-in, V2G':'7 kW smart'],
    grid:   ['Grid', a.phase===3?'3-phase import/export':'import / export'],
  };
  let rnodes='';
  list.forEach(k=>{
    const y=cy[k]-30, x=Nx, w=150, h=60, cyc=cy[k];
    rnodes+=`<rect class="node" x="${x}" y="${y}" rx="13" width="${w}" height="${h}"/>`
      + ICON[k](x+27, cyc)
      + `<text class="val" x="${x+52}" y="${cyc-2}">${META[k][0]}</text>`
      + `<text class="lbl" x="${x+52}" y="${cyc+16}">${META[k][1]}</text>`;
  });

  /* --- changeover / gateway switch on the inverter→house wire --- */
  let switchSvg='';
  if(hasBackup){
    const mx=(Hx+Nx)/2, my=(Hy+cy.house)/2;
    const auto = (key==='sigenergy'||key==='powerwall'||key==='victron');
    switchSvg=`<g>
      <rect class="node" x="${mx-30}" y="${my-19}" width="60" height="38" rx="9"/>
      <circle cx="${mx-14}" cy="${my}" r="3.5" fill="#78716c"/><circle cx="${mx+14}" cy="${my}" r="3.5" fill="#78716c"/>
      <path d="M${mx-14} ${my} L${mx+11} ${my-9}" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
      <text class="lbl" x="${mx}" y="${my+33}" text-anchor="middle">${auto?'Auto gateway':'Changeover'}</text>
    </g>`;
  }

  /* --- panels: a house for roof-mount, a tilted frame for ground-mount --- */
  const panelGrid=(x,y,w,h)=>{
    const cols=Math.max(3,Math.round(w/20)), rows=Math.max(1,Math.round(h/16));
    let g='';
    for(let i=1;i<cols;i++){const lx=(x+w*i/cols).toFixed(1); g+=`<line x1="${lx}" y1="${y}" x2="${lx}" y2="${y+h}" stroke="#0284c7" stroke-width="1" opacity=".4"/>`;}
    for(let j=1;j<rows;j++){const ly=(y+h*j/rows).toFixed(1); g+=`<line x1="${x}" y1="${ly}" x2="${x+w}" y2="${ly}" stroke="#0284c7" stroke-width="1" opacity=".4"/>`;}
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#a8d8f5" stroke="#0369a1" stroke-width="1.6"/>`
      + g
      + `<path d="M${x+3} ${y+h-3} L${x+w*0.42} ${y+3}" stroke="#fff" stroke-width="2.4" opacity=".3" stroke-linecap="round"/>`;
  };
  let panels;
  if(ground){
    panels = panelGrid(58,150,178,86)
      + `<path d="M96 236 V300 M198 236 V300 M96 272 H198 M236 236 V300" stroke="#a8a29e" stroke-width="3" fill="none" stroke-linecap="round"/>`
      + `<rect x="40" y="300" width="220" height="13" rx="6" fill="#e7e5e4"/>`
      + `<text class="val" x="147" y="338" text-anchor="middle">${pv.panels} × ${PRICING.panelW}W</text>`
      + `<text class="lbl" x="147" y="356" text-anchor="middle">ground-mount</text>`;
  } else {
    panels =
        `<line x1="62" y1="330" x2="264" y2="330" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>`
      + `<rect x="100" y="252" width="124" height="78" rx="3" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>`
      + `<path d="M82 256 L162 192 L242 256 Z" fill="#dbe4ee" stroke="#94a3b8" stroke-width="2.4" stroke-linejoin="round"/>`
      + `<rect x="104" y="210" width="14" height="30" rx="1.5" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.6"/>`
      + `<rect x="114" y="290" width="26" height="40" rx="2" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.6"/>`
      + `<circle cx="134" cy="311" r="1.8" fill="#64748b"/>`
      + `<rect x="160" y="280" width="34" height="30" rx="2" fill="#bae6fd" stroke="#94a3b8" stroke-width="1.6"/>`
      + `<path d="M177 280 V310 M160 295 H194" stroke="#94a3b8" stroke-width="1.2"/>`
      + `<g transform="translate(172,196) rotate(33)">${panelGrid(0,0,80,16)}</g>`
      + `<text class="val" x="162" y="352" text-anchor="middle">${pv.panels} × ${PRICING.panelW}W</text>`
      + `<text class="lbl" x="162" y="370" text-anchor="middle">roof-mount</text>`;
  }

  /* --- sun --- */
  let rays=''; for(let i=0;i<8;i++){ const ang=i*45*Math.PI/180, x1=108+Math.cos(ang)*26,y1=70+Math.sin(ang)*26,x2=108+Math.cos(ang)*34,y2=70+Math.sin(ang)*34; rays+=`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>`; }
  const sun=`<circle class="sun-glow" cx="108" cy="70" r="40" fill="#f59e0b" opacity=".2"/>`
    + `<g class="sun-rays">${rays}</g><circle cx="108" cy="70" r="19" fill="#fbbf24"/>`;

  /* --- inverter (brand-coloured wall device) --- */
  const invX=385, invY=190, invW=120, invH=92;
  const cxI=invX+invW/2;
  const inverter=
      `<rect x="${invX+3}" y="${invY+6}" width="${invW}" height="${invH}" rx="16" fill="rgba(15,23,42,.12)"/>`
    + `<rect x="${invX}" y="${invY}" width="${invW}" height="${invH}" rx="16" fill="${invColor}" stroke="rgba(0,0,0,.14)" stroke-width="1.5"/>`
    + `<path d="M${invX} ${invY+30} V${invY+16} a16 16 0 0 1 16 -16 H${invX+invW-16} a16 16 0 0 1 16 16 V${invY+30} Z" fill="#fff" opacity=".14"/>`
    + `<rect x="${invX+20}" y="${invY+13}" width="${invW-40}" height="28" rx="6" fill="#0b1220" stroke="rgba(255,255,255,.22)" stroke-width="1"/>`
    + `<path d="M${invX+30} ${invY+27} q6 -10 12 0 q6 10 12 0 q6 -10 12 0" stroke="#34d399" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    + `<circle cx="${invX+invW-30}" cy="${invY+21}" r="2.2" fill="#34d399"/><circle cx="${invX+invW-30}" cy="${invY+30}" r="2.2" fill="#fbbf24"/>`
    + `<text x="${cxI}" y="${invY+57}" text-anchor="middle" fill="#fff" font-size="12.5" font-weight="700" font-family="'Plus Jakarta Sans',system-ui,sans-serif">${invName}</text>`
    + `<text x="${cxI}" y="${invY+71}" text-anchor="middle" fill="#ffffffcc" font-size="10.5" font-family="'Plus Jakarta Sans',system-ui,sans-serif">${product.primary.p.hybrid?'hybrid inverter':'inverter'}</text>`
    + `<g stroke="#fff" stroke-opacity=".38" stroke-width="2" stroke-linecap="round"><line x1="${cxI-16}" y1="${invY+83}" x2="${cxI+16}" y2="${invY+83}"/><line x1="${cxI-10}" y1="${invY+87}" x2="${cxI+10}" y2="${invY+87}"/></g>`;

  const svg=`<svg class="diagram" viewBox="0 0 900 460" width="100%" height="auto" role="img"
      aria-label="System diagram: ${pv.panels} panels, ${invName} inverter, ${battery.kwh} kWh battery${hasEV?', EV charger':''}${hasBackup?', backup switch':''}, grid connection, with power flowing from the sun through the system.">
    <defs><marker id="ah" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 Z" class="arrow"/></marker></defs>
    ${wires}${flows}
    ${sun}${beams}${panels}${inverter}${switchSvg}${rnodes}
  </svg>`;

  return `<div class="card"><h2>⚡ Your system</h2>
    ${svg}
    <p class="muted" style="margin-top:10px">Green shows electricity flowing on a sunny day: sun → panels → inverter, then out to your battery, home${hasEV?', EV charger':''} and the grid.</p>
  </div>`;
}

/* ============ heading icons (replace emoji with crisp SVG tiles) ============ */
const ICONS={
  zap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3 5 13h6l-1 8 9-11h-6l1-7z"/></svg>',
  box:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></svg>',
  plug:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8zM12 16v6"/></svg>',
  battery:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="15" height="9" rx="2"/><path d="M21 11v3M7 11v3M11 11v3"/></svg>',
  euro:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 7a6 6 0 1 0 0 10M4 11h9M4 14h8"/></svg>',
  chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  wrench:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.5-.5-.5-2.5 2.6-2.6z"/></svg>',
  alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>',
};
function pickIcon(t){
  if(/your system/i.test(t)) return 'zap';
  if(/product/i.test(t))     return 'box';
  if(/solar array/i.test(t)) return 'sun';
  if(/inverter/i.test(t))    return 'plug';
  if(/^battery/i.test(t))    return 'battery';
  if(/costing/i.test(t))     return 'euro';
  if(/economic/i.test(t))    return 'chart';
  if(/installation/i.test(t))return 'wrench';
  if(/flag/i.test(t))        return 'alert';
  return 'zap';
}
function decorateHeadings(root){
  root.querySelectorAll('h2,h3').forEach(el=>{
    const raw=(el.textContent||'').trim();
    if(/^[A-Za-z(]/.test(raw)) return;            // plain subhead (no leading emoji) — leave as-is
    const title=raw.replace(/^[^A-Za-z(]+/, '').trim();
    if(!title) return;
    const safe=title.replace(/&/g,'&amp;').replace(/</g,'&lt;');
    el.innerHTML='<span class="chico">'+ICONS[pickIcon(title)]+'</span><span>'+safe+'</span>';
  });
}

/* ---- build a readable "Your answers" summary straight from the live form ---- */
function answersSummary(){
  const esc=s=>(s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const skip=el=>{
    if(el.disabled) return true;                       // not-applicable / greyed field
    const fc=el.closest('.field,.rank');
    if(fc && getComputedStyle(fc).display==='none') return true;  // hidden by plan type
    return false;
  };
  let body='';
  document.querySelectorAll('#form > fieldset').forEach(fs=>{
    const legend=fs.querySelector(':scope > legend');
    let title='';
    if(legend){
      const ln=legend.querySelector('.legnum'), lt=legend.querySelector('.legttl');
      title = (ln&&lt) ? ln.textContent.trim()+' · '+lt.textContent.trim()
                       : legend.textContent.replace(/\s+/g,' ').trim();
    }
    const rows=[];

    // section 1 — objective ranks
    fs.querySelectorAll('.rank').forEach(r=>{
      const sel=r.querySelector('select'); if(!sel||skip(sel)||!sel.value) return;
      const lbl=(r.querySelector('span')||{}).textContent||sel.id;
      rows.push([lbl.trim(), 'Rank '+sel.value]);
    });

    // big electrical loads — collapse ticked checkboxes into one row
    const loads=[];
    fs.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
      if(cb.checked && !skip(cb)){ const wl=cb.closest('label'); loads.push((wl?wl.textContent:cb.id).trim()); }
    });
    if(loads.length) rows.push(['Big electrical loads', loads.join(', ')]);

    // remaining inputs / selects / textareas
    fs.querySelectorAll('input,select,textarea').forEach(el=>{
      if(el.type==='checkbox' || el.closest('.rank') || skip(el)) return;
      let lbl='';
      const lf=el.id?document.querySelector('label[for="'+(window.CSS&&CSS.escape?CSS.escape(el.id):el.id)+'"]'):null;
      if(lf){ lbl=lf.cloneNode(true); lbl.querySelectorAll('.req').forEach(n=>n.remove()); lbl=lbl.textContent; }
      else lbl=el.getAttribute('aria-label')||el.id;
      lbl=(lbl||'').replace(/\s+/g,' ').trim();
      let v = el.tagName==='SELECT' ? (el.options[el.selectedIndex]||{}).text||'' : el.value;
      v=(v||'').replace(/\s+/g,' ').trim();
      if(v==='') return;                                // skip unanswered/blank fields
      rows.push([lbl, v]);
    });

    if(rows.length){
      body+='<div class="anssub">'+esc(title)+'</div><table class="ans">'
        + rows.map(([l,v])=>'<tr><td>'+esc(l)+'</td><td>'+esc(v)+'</td></tr>').join('')
        + '</table>';
    }
  });
  return '<div class="card answers"><h2>📝 Your answers</h2>'
    + '<p class="muted">A record of what you entered, for reference and to share with installers.</p>'
    + body + '</div>';
}

/* ============================ RENDER ============================ */
function render(a, pv, battery, product, cost, econ, led){
  const p=product.primary;
  let h='';

  /* date/time stamp + report header (prints at the top of the PDF) */
  const stamp = new Date().toLocaleString('en-IE',
    {day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const reportHead = `<div class="card reportmeta">
    <b>Solar + Battery Discovery — indicative design</b>
    <span class="muted">Generated ${stamp}</span></div>`;

  /* battery label used in a couple of places */
  const batLabel = battery.kwh>0
    ? (battery.addOnly?`+${battery.kwh} kWh battery`:`${battery.kwh} kWh battery`)
    : `${battery.existingKwh||0} kWh battery (existing)`;

  /* headline */
  const headline=`<div class="card headline">
    <div class="big">${pv.kwp} kWp solar · ${batLabel} · ${p.p.name}</div>
    <div><span class="pill ${led.wantsBackup?'g':'b'}">${led.type}</span></div>
    <div style="margin-top:8px">
      <span class="tag">${pv.panels} × ${PRICING.panelW}W panels</span>
      <span class="tag">~${pv.annualGen.toLocaleString()} kWh/yr generated</span>
      <span class="tag">${a.phase===3?'3-phase':'single-phase'}</span>
      <span class="tag">Net cost ${eurBand(cost.net)}</span>
      ${econ.payback?`<span class="tag">~${round1(econ.payback*PRICING.quoteBand.low)}–${round1(econ.payback*PRICING.quoteBand.high)} yr payback</span>`:''}
    </div></div>`;

  /* animated system diagram (shown as the 2nd section) */
  const diagram=systemDiagram(a, pv, battery, product);

  /* products */
  let altHtml = product.alts.map(c=>`<div class="alt"><b>${c.p.name}</b> — ${c.reasons.length?c.reasons.join(', '):'viable alternative'}.<br><span class="muted">${c.p.note}</span></div>`).join('');
  const productsCard=`<div class="card"><h2>📦 Recommended products</h2>
    <h3>Primary: ${p.p.name}</h3>
    <p class="muted">${p.p.note}</p>
    <p>Why: ${p.reasons.length?p.reasons.join(', '):'best overall fit for your phase, backup and budget profile'}.</p>
    ${altHtml?`<h3>Alternatives</h3>${altHtml}`:''}</div>`;

  /* PV */
  const pvCard=`<div class="card"><h2>☀️ Solar array</h2>
    <table>
      <tr><td>Array size</td><td class="num">${pv.kwp} kWp (${pv.panels} panels)</td></tr>
      <tr><td>Inverter AC cap applied</td><td class="num">${pv.acCap} kW</td></tr>
      <tr><td>Yield assumption</td><td class="num">${pv.yieldPerKwp} kWh/kWp/yr</td></tr>
      <tr><td>Expected generation</td><td class="num">${pv.annualGen.toLocaleString()} kWh/yr</td></tr>
    </table>
    <h3>Sizing rationale</h3><ul>${pv.reasons.map(r=>`<li>${r}</li>`).join('')}</ul></div>`;

  /* inverter */
  const epsTxt = a.backupScope==="none" ? "No backup configured (grid-tie only)."
    : `EPS backup: ${p.p.eps==="whole"?"whole-home capable":"essential-circuits"}.`;
  const inverterCard=`<div class="card"><h2>🔌 Inverter &amp; topology</h2>
    <ul>
      <li><b>${p.p.hybrid?'Hybrid':'String'} inverter</b> — ${p.p.hybrid?'PV + battery managed in one unit (DC-coupled).':'separate PV inverter.'}</li>
      <li>Supply: <b>${a.phase===3?'three-phase':'single-phase'}</b>${a.mic?`, MIC ${a.mic} kVA`:''}. ${a.phase===1?'NC6 caps grid-tied inverters at 25 A (~5.75 kW) single-phase without a DSO (NC7) application; you can fit a larger inverter and export-limit it.':'3-phase allows larger inverter within MIC.'}</li>
      <li>${epsTxt}</li>
      ${a.existingPV==="yes"?`<li>Existing PV: ${a.existingPlan==="ac"?'AC-couple battery, keep current inverter.':'replace with hybrid (DC-couple) — current inverter retired.'}</li>`:''}
    </ul></div>`;

  /* battery */
  const batRowLabel = battery.addOnly ? (battery.kwh>0?'Additional capacity to add':'Existing storage — no addition needed') : 'Recommended usable capacity';
  const batRowVal = battery.kwh>0 ? `${battery.kwh} kWh` : `${battery.existingKwh||0} kWh`;
  const batteryCard=`<div class="card"><h2>🔋 Battery</h2>
    <table><tr><td>${batRowLabel}</td><td class="num">${batRowVal}</td></tr></table>
    <h3>Sizing rationale</h3><ul>${battery.reasons.map(r=>`<li>${r}</li>`).join('')}</ul></div>`;

  /* costing */
  let rows = cost.rows.map(r=>`<tr><td>${r[0]}<br><span class="muted">${r[1]}</span></td><td class="num">${eur(r[2])}</td></tr>`).join('');
  const costingCard=`<div class="card"><h2>💶 Indicative costing</h2>
    <table>
      <tr><th>Item</th><th style="text-align:right">Cost (0% VAT)</th></tr>
      ${rows}
      <tr class="total"><td>Subtotal</td><td class="num">${eur(cost.subtotal)}</td></tr>
      ${cost.grant?`<tr class="grant"><td>Less SEAI solar PV grant</td><td class="num">– ${eur(cost.grant)}</td></tr>`:''}
      ${cost.evGrant?`<tr class="grant"><td>Less SEAI EV home-charger grant</td><td class="num">– ${eur(cost.evGrant)}</td></tr>`:''}
      <tr class="total"><td>Net — best-value quote (keen)</td><td class="num">${eurR(bandLo(cost.net))}</td></tr>
      <tr class="total"><td>Net — typical installer</td><td class="num">${eurR(bandHi(cost.net))}</td></tr>
    </table>
    <p class="muted"><b>Expect a quote somewhere in this range.</b> The low figure is a keen / best-value quote — a sharp installer pricing it tightly. The high figure is what a typical installer charges for the same spec (about ${Math.round((PRICING.quoteBand.high/PRICING.quoteBand.low-1)*100)}% more), reflecting margin, region, panel/inverter tier, scaffolding and extras (BER, optimisers, bird mesh). Get 3 quotes and aim for the low end. Battery &amp; PV bought on one contract qualify for 0% VAT. Solar grant applies to PV only (max €1,800), not the battery. ${a.grantEligible!=="yes"?'<b>Solar grant not applied</b> — property must be connected before end-2020 &amp; installer SEAI-registered. ':''}${cost.evGrant?'The €300 EV home-charger grant is a separate ZEVI/SEAI scheme: homeowner with off-street parking, a charger on the SEAI Smart Charger Register, fitted by a Safe Electric contractor — apply before buying.':''}</p></div>`;

  /* economics */
  const econCard=`<div class="card"><h2>📈 Economics (indicative)</h2>
    <table>
      <tr><td>Generation</td><td class="num">${pv.annualGen.toLocaleString()} kWh/yr</td></tr>
      <tr><td>Self-consumed (${Math.round(econ.scFrac*100)}%)</td><td class="num">${econ.selfUsed.toLocaleString()} kWh</td></tr>
      <tr><td>Exported</td><td class="num">${econ.exported.toLocaleString()} kWh</td></tr>
      <tr><td>Bill saving (self-use @ ${Math.round(econ.importR*100)}c)</td><td class="num">${eur(econ.selfSaving)}/yr</td></tr>
      <tr><td>Export income (@ ${Math.round(econ.cegR*100)}c CEG)</td><td class="num">${eur(econ.exportIncome)}/yr</td></tr>
      ${econ.arbSaving>0?`<tr><td>Tariff arbitrage (night→peak)</td><td class="num">${eur(econ.arbSaving)}/yr</td></tr>`:''}
      <tr class="total"><td>Total annual benefit</td><td class="num">${eur(econ.annual)}/yr</td></tr>
      ${econ.payback?`<tr class="total"><td>Simple payback</td><td class="num">~${round1(econ.payback*PRICING.quoteBand.low)}–${round1(econ.payback*PRICING.quoteBand.high)} years</td></tr>`:''}
    </table>
    <p class="muted">First €400/yr of export income is tax-free (disregard to end-2028). Payback excludes finance costs &amp; future price inflation; real savings rise as electricity prices climb.</p></div>`;

  /* ---- assemble in the requested order:
     headline → system diagram → recommended products → indicative costing
     → then the supporting detail (array, inverter, battery, economics) ---- */
  h = reportHead + headline + diagram + productsCard + costingCard + econCard + pvCard + inverterCard + batteryCard + h;

  /* install plan + flags */
  h+=`<div class="card"><h2>🛠️ Installation plan</h2><ol>
    <li><b>Survey &amp; DSO paperwork</b> — confirm roof structure, MIC, earthing; submit NC6 (≤25 A / ~5.75 kW export) or NC7 connection notification.</li>
    <li><b>Scaffold &amp; mount</b> — ${pv.panels} panels on ${a.cover} roof${a.mount!=="roof"?` (+ ${a.mount} mount)`:''}.</li>
    <li><b>Electrical</b> — install ${p.p.hybrid?'hybrid':'string'} inverter + ${p.p.name}; ${a.backupScope!=="none"?'wire EPS/backup change-over':'grid-tie connection'}.</li>
    <li><b>Commission &amp; register</b> — supplier microgen (NC6 confirmation) for CEG export payments${a.grantEligible==="yes"?'; submit SEAI grant claim':''}.</li>
  </ol>`;

  /* flags */
  const flags=[];
  if(a.earthing==="tt" && a.backupScope!=="none") flags.push("TT earthing complicates EPS — dedicated backup earth rod &amp; RCD scheme needed (costed above).");
  if(a.phase===3 && p.key==="powerwall") flags.push("Powerwall 3 is single-phase per unit — 3-phase backup needs one per phase. Sigenergy/Solis handle 3-phase natively.");
  if(a.spareWays==="no") flags.push("Fuse board reported full — may need a sub-board or upgrade to add the backup circuits.");
  if(a.roofAge==="poor") flags.push("Poor roof condition — re-roof or repair before mounting; panels last 25+ yrs.");
  if(a.shading==="heavy") flags.push(`Significant shading — panel-level optimisers/micro-inverters (~€${PRICING.optimiserPerPanel}/panel, costed above) recommended or generation will disappoint.`);
  if(a.orientation===760) flags.push(`East + West split puts mixed aspects on one inverter string — those panels (~11) typically need optimisers (~€${PRICING.optimiserPerPanel} each, costed above).`);
  if(pv.panels>22 && p.key!=="powerwall") flags.push(`${pv.panels} panels exceeds a typical 2-string (2-MPPT) hybrid inverter (~11 panels per string). May need a larger inverter, a second unit, or a 3-MPPT model.`);
  if(a.mount!=="roof" && a.planning==="yes") flags.push("Ground mount on a sensitive/coastal/protected site — check planning exemption limits before proceeding.");
  if(a.smartMeter==="no") flags.push("No smart meter yet — needed for CEG export payments &amp; for dynamic-tariff arbitrage. Request one.");
  if(a.mic>0 && a.phase===1 && a.mic<12) flags.push(`Low MIC (${a.mic} kVA) on single-phase — heavy simultaneous loads (EV + immersion + heat pump) may trip; consider load management.`);
  if(!a.annualKwh) flags.push("Annual kWh estimated — pull real smart-meter HDF data to refine sizing.");
  if(a.heatpumpPlan==="yes") flags.push("Heat pump planned — future winter load is large &amp; solar-poor; size import &amp; consider a larger battery / time-of-use tariff.");
  if(a.loads && a.loads.shower && a.backupScope!=="none") flags.push("Electric/power shower (~9 kW) draws more than most batteries can deliver during a power cut, so it likely won&rsquo;t run on backup. Plan to leave it off the backup circuits — or choose a high-output unit (e.g. Powerwall 3).");

  if(flags.length){
    h+=`<h3>⚠️ Flags to resolve</h3>`+flags.map(f=>`<div class="flag"><b>!</b> ${f}</div>`).join('');
  } else {
    h+=`<div class="flag ok"><b>✓</b> No major red flags from the answers given.</div>`;
  }
  h+=`</div>`;

  /* disclaimer */
  h+=`<div class="card"><div class="disclaimer">
    <b>Indicative planning estimate only.</b> Pricing is modelled on public 2026 Irish market guides, not a quote.
    The figures live in the <code>PRICING</code> object at the top of this file's script — update them with real
    quotes/costs and every output recalculates. Final design, loads,
    structural and electrical compliance must come from an SEAI-registered installer's site survey.
  </div></div>`;

  /* full record of the user's answers (appendix — also included in the PDF) */
  h += answersSummary();

  /* print button at the foot of the results (excluded from the PDF itself) */
  h += `<div class="btnrow noprint" style="margin-top:4px">
    <button type="button" class="primary" onclick="window.print()">Print / save PDF</button>
  </div>`;

  $('out').innerHTML=h;
  decorateHeadings($('out'));
}

/* ============================ DEMO ============================ */
function loadDemo(){
  const set=(id,v)=>{ if($(id)) $(id).value=v; };
  set('obj_bill',1); set('obj_backup',2); set('obj_future',3); set('obj_export',4); set('obj_evsolar',5);
  set('outageFreq',4); set('outageDur',10); set('ruralFeeder','yes'); set('backupScope','whole'); set('generator','no');
  $('mustStayOn').value='Freezer, heating circ pump, broadband, lights';
  set('phase',1); set('mic',12); set('mainFuse','80'); set('earthing','tt'); set('spareWays','yes'); set('smartMeter','yes'); set('cableRun',8);
  set('annualKwh',6500); set('dynamicTariff','dayNight'); set('importRate',35); set('nightRate',13); set('dayOccupancy','out'); set('heating','oil');
  set('mount','roof'); set('orientation',950); set('panelCap',16); set('pitch','ok'); set('cover','tile'); set('roofAge','good'); set('shading','some');
  set('existingPV','no'); set('existingBattery','no'); set('brandLean','open'); set('appControl','app'); set('openEco','yes');
  set('ev','yes'); set('evCharger','want'); set('v2g','no'); set('heatpumpPlan','no'); set('loadShift','yes');
  set('budget',22000); set('grantEligible','yes'); set('cegRate',20); set('funding','cash');
  set('planning','no'); set('approach','turnkey');
  syncConditionals();
  alert('Example answers loaded. Click "Generate design & plan".');
}

/* ---- conditional fields: grey out questions that don't apply ---- */
function setEnabled(id, on){
  const el=$(id); if(!el) return;
  el.disabled = !on;
  const f = el.closest('.field'); if(f) f.style.opacity = on ? '1' : '0.45';
}
// hide a whole field (used for rate inputs that don't apply to the chosen plan)
function setVisible(fieldId, on){
  const f=$(fieldId); if(f) f.style.display = on ? '' : 'none';
}

/* ---- MIC: default to 12 (single-phase) / 29 (three-phase); honour user edits ---- */
function applyMicDefault(){
  const m=$('mic'); if(!m) return;
  const def = val('phase')==='3' ? 29 : 12;
  if(m.value==='' || m.dataset.auto==='1'){ m.value=def; m.dataset.auto='1'; }
}
(function(){
  const m=$('mic');
  if(m){ m.dataset.auto='1'; m.addEventListener('input',()=>{ m.dataset.auto='0'; }); }
})();

function syncConditionals(){
  applyMicDefault();
  const hasPV = val('existingPV')==='yes';      // §6 only relevant with existing solar
  setEnabled('existingKwp', hasPV);
  setEnabled('existingPlan', hasPV);
  setEnabled('existingBattery', hasPV);
  setEnabled('existingBatteryKwh', hasPV && val('existingBattery')==='yes');
  const tariff = val('dynamicTariff');          // §4 rate inputs depend on the plan type
  setVisible('nightRateField', tariff!=='no');
  setVisible('peakRateField', tariff==='peakDayNight');
  setEnabled('v2g', val('ev')!=='no');           // §8 V2G needs an EV
}
['existingPV','existingBattery','dynamicTariff','ev','phase'].forEach(id=>{
  const el=$(id); if(el) el.addEventListener('change', syncConditionals);
});
syncConditionals();

/* number-badge the ten section legends */
document.querySelectorAll('#form > fieldset > legend').forEach(lg=>{
  const m=lg.textContent.match(/^\s*(\d+)\s*·\s*([\s\S]+)$/);
  if(m){
    const ttl=m[2].trim().replace(/&/g,'&amp;').replace(/</g,'&lt;');
    lg.innerHTML='<span class="legnum">'+m[1]+'</span><span class="legttl">'+ttl+'</span>';
  }
});
