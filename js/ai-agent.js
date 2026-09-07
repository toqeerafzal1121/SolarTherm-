/**
 * SOLARTHERM SIH26051 — Thermal Intelligence AI Agent
 * Fully offline, no API key required.
 * Intent-based NLP + ADRecommendations engine.
 * Reads live window.state for shelter design, climate, simulation results.
 */

class SolarthermAI {
  constructor() {
    this.messageHistory = [];
    this._bindUI();
    this._subscribeToState();
    setTimeout(() => {
      this._generateInsightCards();
      this._addWelcomeMessage();
    }, 700);
  }

  /* ── STATE SUBSCRIPTION ─────────────────────────────────────── */
  _subscribeToState() {
    if (!window.state) return;
    window.state.subscribe((st, key) => {
      if (key === 'activeTab' && st.activeTab === 'ai-agent') {
        setTimeout(() => this._generateInsightCards(), 120);
      }
      if (key === 'simulationResults' && st.simulationResults) {
        this._generateInsightCards();
        if (st.activeTab === 'ai-agent') {
          this._addMessage('agent', '✅ **New simulation complete!** I\'ve refreshed all insight cards with the latest 24-hour transient results. Ask me anything about your shelter performance!');
        }
      }
    });
  }

  /* ── UI BINDING ─────────────────────────────────────────────── */
  _bindUI() {
    const sendBtn = document.getElementById('aiAgentSendBtn');
    const input = document.getElementById('aiAgentInput');
    if (sendBtn) sendBtn.addEventListener('click', () => this._handleSend());
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._handleSend(); }
      });
    }
    document.querySelectorAll('.ai-suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (input) input.value = chip.dataset.question || chip.textContent.trim();
        this._handleSend();
      });
    });
    const clearBtn = document.getElementById('aiAgentClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => this._clearChat());
  }

  _addWelcomeMessage() {
    const c = window.state && window.state.climateProfile;
    this._addMessage('agent',
      `👋 Hello! I'm **SOLARTHERM AI** — your offline thermal shelter intelligence assistant for **SIH26051**.\n\n` +
      `I'm analysing **${c ? c.name : 'your selected site'}** at ${c ? c.elevation.toLocaleString() : '3,505'}m altitude ` +
      `(design winter temp: **${c ? c.designWinterTemp : -22}°C**).\n\n` +
      `Ask me anything — wall materials, solar PV sizing, thermal mass, comfort analysis, or PDF export. ` +
      `Or click one of the **Quick Ask** chips below!`
    );
  }

  /* ── SEND HANDLER ───────────────────────────────────────────── */
  _handleSend() {
    const input = document.getElementById('aiAgentInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this._addMessage('user', text);
    this._showTyping();
    setTimeout(() => {
      this._hideTyping();
      this._addMessage('agent', this._generateResponse(text));
    }, 420 + Math.random() * 380);
  }

  /* ── INTENT ENGINE ──────────────────────────────────────────── */
  _generateResponse(query) {
    const q = query.toLowerCase();
    const d = window.state && window.state.shelterDesign;
    const c = window.state && window.state.climateProfile;
    const sim = window.state && window.state.simulationResults;
    const eng = window.state && window.state.getComputedEngineering ? window.state.getComputedEngineering() : null;

    if (/^(hi|hello|hey|namaste|helo|hii|howdy)/.test(q)) {
      return `👋 Hello! I'm **SOLARTHERM AI** — ready to help with your high-altitude shelter design.\n\nCurrent site: **${c ? c.name : 'not set'}** | Winter Low: **${c ? c.designWinterTemp : '?'}°C**\n\nAsk me about: wall materials, PV sizing, thermal mass, comfort analysis, or the engineering report.`;
    }

    if (/what can you|help|capabilities|features/.test(q)) {
      return `🤖 **What I can help with:**\n\n• **Material Selection** — wall block, insulation, glazing\n• **Thermal Comfort** — min indoor temp vs 15°C threshold\n• **Solar PV Sizing** — kWp & panel count for your load\n• **Thermal Mass** — is your storage sufficient?\n• **Validation** — explain MAE, RMSE, R² benchmarks\n• **Cost & Logistics** — deadweight, helicopter sorties\n• **Altitude Effects** — air density, solar irradiance corrections\n• **PDF Report** — how to export the engineering dossier\n\nJust type your question in plain English!`;
    }

    if (/wall material|block|masonry|brick|concrete|insulation|envelope|build/.test(q)) {
      if (!d || !c) return this._noDataMsg();
      const hdd = 6800, alt = c.elevation || 3500;
      const wallName = (eng && eng.materials && eng.materials.wall) ? eng.materials.wall.name : d.wallMaterial.replace(/_/g,' ');
      const thick = (d.wallThickness * 1000).toFixed(0);
      const wallR = (eng && eng.materials && eng.materials.wall) ? eng.materials.wall.R : null;
      let rec = alt > 3000 || hdd > 6000
        ? '**Granite Stone + 100 mm XPS** (U = 0.28 W/m²K) — local stone for thermal mass, XPS for insulation'
        : '**AAC Block + 75 mm PIR** (U = 0.32 W/m²K) — lightweight, helicopter-deployable';
      return `🧱 **Wall Material Analysis**\n\n**Current:** ${wallName} @ ${thick} mm${wallR ? ' | R = ' + wallR.toFixed(2) + ' m²K/W' : ''}\n**Recommended:** ${rec}\n\nAt ${alt.toLocaleString()} m altitude you need **R ≥ 3.5 m²K/W** minimum. Place the dense mass layer on the interior side to absorb daytime solar gain through south glazing.\n\n💡 *Avoid plain corrugated metal without insulation — it bleeds heat 8× faster than an insulated panel.*`;
    }

    if (/solar|pv|panel|photovoltaic|electricity|power|watt/.test(q)) {
      if (!d || !c) return this._noDataMsg();
      const ghi = c.solarGHI || 5.5;
      const dailyLoad = (((d.equipmentWatts || 50) + (d.lightingWatts || 20)) * 16 / 1000 + (d.occupants || 2) * 0.3).toFixed(1);
      const pvKwp = (parseFloat(dailyLoad) / (ghi * 0.80)).toFixed(2);
      const panels = Math.ceil(parseFloat(pvKwp) / 0.35);
      const battKwh = (parseFloat(dailyLoad) * 2).toFixed(1);
      return `☀️ **Solar PV Sizing — ${c.name}**\n\n| Parameter | Value |\n|---|---|\n| Site GHI | ${ghi} kWh/m²/day |\n| Daily Electrical Load | ${dailyLoad} kWh/day |\n| System Efficiency | 80% (altitude + soiling) |\n| **Required PV Capacity** | **${pvKwp} kWp** |\n| **Panel Count (350W)** | **${panels} panels** |\n| **Battery Reserve (2-day)** | **${battKwh} kWh LiFePO4** |\n\n💡 *At ${alt > 3000 ? (c.elevation.toLocaleString() + 'm') : 'high altitude'}, crystal-clear air boosts solar yield ~10% above standard calculations. South-facing fixed tilt at latitude angle gives the best annual output.*`;
    }

    if (/thermal mass|storage|water tank|pcm|phase change|latent|heat store|retain/.test(q)) {
      if (!d || !c) return this._noDataMsg();
      const mass = d.thermalStorageMass || 500;
      const ghi = c.solarGHI || 5.5;
      const solarKWh = (ghi * (d.windowArea || 3.5) * 0.6 * 0.75).toFixed(1);
      const reqMass = Math.round(parseFloat(solarKWh) * 3600000 / (4180 * 8));
      const ok = mass >= reqMass;
      return `🔋 **Thermal Mass Analysis**\n\n**Current:** ${mass} kg (${(d.thermalStorageType || '').replace(/_/g,' ')})\n**Recommended minimum:** ${reqMass} kg\n**Status:** ${ok ? '✅ Sufficient' : '⚠️ Undersized by ' + (reqMass - mass) + ' kg'}\n\n**Daytime solar gain available:** ${solarKWh} kWh/day\nThis can raise ${reqMass} kg of water by **8°C** — enough to bridge a ${Math.abs(c.designWinterTemp)}°C outdoor night over 8–10 hours.\n\n💡 *Dark-painted water containers against the south wall absorb 92% of direct radiation vs 40% for white. Simple and cheap.*`;
    }

    if (/warm|comfort|cold|temperature|indoor|min temp|minimum|freeze|habitable|liveable/.test(q)) {
      if (!sim || !sim.summary) {
        return `🌡️ **No simulation results yet.**\n\nGo to **Tab 3 → Simulation** and click **▶ Run Simulation**. I'll immediately update all comfort analysis once results are available!`;
      }
      const minT = sim.summary.minIndoor ? sim.summary.minIndoor.toFixed(1) : '--';
      const maxT = sim.summary.maxIndoor ? sim.summary.maxIndoor.toFixed(1) : '--';
      const auxKWh = sim.summary.totalAuxHeatingKWh ? sim.summary.totalAuxHeatingKWh.toFixed(1) : '--';
      const ok = parseFloat(minT) >= 15;
      const hab = parseFloat(minT) >= 5;
      const status = ok ? '✅ **Thermally Comfortable** (≥ 15°C)' : hab ? '⚠️ **Habitable but cool** (5–15°C)' : '❌ **Below habitability threshold** (< 5°C)';
      return `🏠 **Shelter Comfort Report — ${c ? c.name : 'site'}**\n\n| Metric | Value |\n|---|---|\n| Minimum Indoor Temp | **${minT}°C** |\n| Maximum Indoor Temp | ${maxT}°C |\n| Comfort Threshold | 15°C |\n| Aux Heating Required | ${auxKWh} kWh/day |\n\n${status}\n\n${ok ? '🎉 Excellent — passive design meets the comfort standard with zero auxiliary heating.' : '🔧 To reach 15°C: add 200–300 kg thermal mass, 25mm XPS to walls, or increase south glazing by 1.5 m².'}`;
    }

    if (/glazing|window|glass|south|solar gain|direct gain/.test(q)) {
      if (!d) return this._noDataMsg();
      const wa = d.windowArea || 3.5, fa = (d.length * d.width);
      const ratio = ((wa / fa) * 100).toFixed(0);
      const recType = (c && c.designWinterTemp < -30) ? 'Triple-pane argon (U ≤ 0.8 W/m²K)' : 'Double-pane low-e (U ≤ 1.2 W/m²K)';
      const ok = parseFloat(ratio) >= 15 && parseFloat(ratio) <= 25;
      return `🪟 **Glazing Analysis**\n\n**Current glazing:** ${wa} m² (${ratio}% of floor area)\n**Recommended WFR:** 15–25% = ${(fa*0.18).toFixed(1)}–${(fa*0.25).toFixed(1)} m²\n**Recommended type:** ${recType}\n**Status:** ${ok ? '✅ Within optimal range' : '⚠️ ' + (parseFloat(ratio) < 15 ? 'Increase glazing for more solar gain' : 'Reduce glazing to limit nighttime heat loss')}\n\n💡 *Snow albedo at Ladakh boosts south-wall solar gain by +25%. All glazing must face within ±20° of true south (azimuth 180°).*`;
    }

    if (/mae|rmse|r2|r²|validate|fea|ansys|benchmark|accuracy|error/.test(q)) {
      return `🔬 **Scientific Validation Glossary**\n\n**MAE (Mean Absolute Error):** Average difference between SOLARTHERM and ANSYS SOLID70 FEA curves. Target: **< 1.50°C**.\n\n**RMSE (Root Mean Square Error):** Like MAE but penalises large spikes more heavily. Target: **< 2.00°C**.\n\n**R² (Pearson Correlation):** How well SOLARTHERM tracks the ANSYS curve shape over 24 hours. Target: **> 0.950**. A value of 0.988 = 98.8% variance explained.\n\n**Why ANSYS?** ANSYS Mechanical SOLID70 8-node thermal elements with time-stepped solar flux is the industry gold standard. A reduced-order design tool must validate against it before field deployment.\n\nView the live benchmark → **Tab 6: Validation**`;
    }

    if (/report|pdf|print|dossier|export|download/.test(q)) {
      return `📄 **Engineering Dossier — PDF Export**\n\nThe Engineering Dossier (Tab 7) contains:\n• Executive Summary & Design Classification\n• Envelope Specifications (wall, roof, glazing, floor)\n• Thermal Mass & 24-hour Transient KPIs\n• Full Cost & Logistics Breakdown (₹ + deadweight kg)\n• ANSYS Validation Summary\n\n**To export PDF:** Click **🖨️ Print / Save as PDF** in Tab 7 → In the print dialog select **Save as PDF** as the destination printer.\n\n💡 *Use Chrome or Edge for the cleanest output — the print stylesheet hides all app chrome and renders a white-background engineering document.*`;
    }

    if (/roof|snow load|pitch|angle|slope/.test(q)) {
      const pitch = d ? d.roofPitch : 20;
      const alt = c ? c.elevation : 3505;
      const ok = pitch >= 25;
      return `🏠 **Roof Design Analysis**\n\n**Current pitch:** ${pitch}°\n**Recommended:** ${alt > 4000 ? '≥ 30°' : '25–30°'}\n**Status:** ${ok ? '✅ Adequate for snow shedding' : '⚠️ Increase pitch to ≥ 25° for better snow management'}\n\n**Recommended material:** Insulated metal sandwich panel with 75mm PIR core (R ≈ 3.5 m²K/W). Avoid uninsulated corrugated metal — it is the single largest heat loss surface in most forward-post shelters.`;
    }

    if (/cost|price|budget|rupee|₹|logistic|weight|ton|deadweight|freight|sortie/.test(q)) {
      if (!eng) return this._noDataMsg();
      const wallT = eng.masses ? (eng.masses.totalWallMass / 1000).toFixed(1) : '--';
      const storT = d ? (d.thermalStorageMass / 1000).toFixed(2) : '--';
      const total = eng.masses ? ((eng.masses.totalWallMass + (d.thermalStorageMass || 0)) / 1000).toFixed(1) : '--';
      const sorties = Math.ceil(parseFloat(total) / 3.5);
      return `💰 **Cost & Logistics Snapshot**\n\n| Item | Value |\n|---|---|\n| Wall Envelope Mass | ${wallT} tonnes |\n| Thermal Storage | ${storT} tonnes |\n| **Total Deadweight** | **${total} tonnes** |\n| Mi-17 Sling Capacity | ~4 tonnes |\n| **Estimated Sorties** | **${sorties}** |\n\nFull cost breakdown with unit rates, BOQ quantities, and logistics table is in **Tab 7: Engineering Dossier** → export as PDF for procurement teams.\n\n💡 *Target ≤ 3.5 tonnes total for single-sortie Mi-17V5 deployment. If overweight, switch from stone to AAC blocks.*`;
    }

    if (/altitude|elevation|high altitude|pressure|air density|oxygen|thin/.test(q)) {
      const alt = c ? c.elevation : 3505;
      const pressure = (101.325 * Math.pow(1 - 0.0000225577 * alt, 5.25588)).toFixed(1);
      const density = (1.225 * Math.pow(1 - 0.0000225577 * alt, 4.25588)).toFixed(3);
      return `🏔️ **High-Altitude Physics at ${alt.toLocaleString()} m**\n\n| Property | Sea Level | ${alt.toLocaleString()}m |\n|---|---|---|\n| Air Pressure | 101.3 kPa | **${pressure} kPa** |\n| Air Density | 1.225 kg/m³ | **${density} kg/m³** |\n| Solar Irradiance | Baseline | **+8–12% higher** |\n\n**Key design implications:**\n• Infiltration heat loss is lower (thinner air carries less heat)\n• Solar panels produce ~10% more energy per rated Wp\n• Diesel/combustion heaters lose efficiency above 4,500m — avoid\n• PCM phase transitions are unaffected by altitude — work normally`;
    }

    if (/summary|overview|status|brief|quick|tldr|tl.dr|report card/.test(q)) {
      if (!d || !c) return this._noDataMsg();
      const minT = sim && sim.summary ? sim.summary.minIndoor.toFixed(1) : 'Run simulation first';
      const aux = sim && sim.summary ? sim.summary.totalAuxHeatingKWh.toFixed(1) + ' kWh/day' : '—';
      const thick = (d.wallThickness * 1000).toFixed(0);
      const wallName = (eng && eng.materials && eng.materials.wall) ? eng.materials.wall.name : d.wallMaterial.replace(/_/g,' ');
      return `📊 **SOLARTHERM Design Summary**\n\n**Site:** ${c.name} | ${c.elevation.toLocaleString()}m | ${c.designWinterTemp}°C winter low\n\n| Parameter | Value |\n|---|---|\n| Footprint | ${d.length}×${d.width}m = ${(d.length*d.width).toFixed(1)} m² |\n| Wall | ${wallName} @ ${thick}mm |\n| Glazing | ${d.windowArea}m² ${d.windowOrientation}-facing |\n| Thermal Mass | ${d.thermalStorageMass} kg |\n| Occupants | ${d.occupants} persons |\n| Min Indoor | ${minT}${typeof minT === 'string' ? '' : '°C'} |\n| Aux Heating | ${aux} |\n\n${sim ? '✅ Simulation complete — all values are physics-based.' : '⚠️ Run simulation (Tab 3) for full thermal performance data.'}`;
    }

    if (/infiltration|air leak|ach|seal|draft/.test(q)) {
      return `💨 **Air Infiltration — Critical at High Altitude**\n\nAt 0.5 ACH (Air Changes/Hour) infiltration accounts for **15–25% of total shelter heat loss**. With Ladakh winds up to 15 m/s, small gaps dramatically increase heating demand.\n\n**Target:** ≤ 0.3 ACH (military tight standard)\n\n**How to achieve it:**\n• Thermal airlock vestibule at entry\n• Self-sealing magnetic door sweeps\n• Continuous vapour barrier with taped seams\n• Foam-sealed conduit penetrations\n\n💡 *Tight sealing reduces auxiliary heating demand by 20–30% for free — the highest ROI improvement available.*`;
    }

    return this._smartFallback(d, c, sim);
  }

  _smartFallback(d, c, sim) {
    const site = c ? c.name : 'your site';
    const temp = c ? c.designWinterTemp : -22;
    const opts = [
      `🤔 I couldn't find a specific match, but for **${site}** at ${temp}°C the highest-impact improvements are:\n1. Wall insulation R ≥ 3.5 m²K/W\n2. South glazing 15–20% of floor area\n3. Thermal mass ≥ 500 kg\n4. Roof pitch ≥ 25° for snow shedding\n\nAsk me specifically about any of these!`,
      `💡 For **${site}** conditions, try asking:\n• *"What wall material should I use?"*\n• *"Is my shelter warm enough?"*\n• *"How much solar panel do I need?"*\n• *"Analyse my glazing"*`,
      `🔬 I'm ready to analyse **${site}** (${temp}°C winter low). I can check thermal comfort, recommend materials, size your PV system, or explain any validation metric. What would you like to explore?`
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }

  _noDataMsg() {
    return `⚠️ No design data available yet. Select a site in **Tab 1** and configure your shelter in **Tab 2**, then come back — I'll have full analysis ready!`;
  }

  /* ── AUTO INSIGHT CARDS ─────────────────────────────────────── */
  _generateInsightCards() {
    const container = document.getElementById('aiInsightCardsContainer');
    if (!container) return;
    const d = window.state && window.state.shelterDesign;
    const c = window.state && window.state.climateProfile;
    const sim = window.state && window.state.simulationResults;
    const eng = window.state && window.state.getComputedEngineering ? window.state.getComputedEngineering() : null;
    if (!d || !c) {
      container.innerHTML = '<div class="ai-insight-placeholder">⚙️ Select a site and configure your shelter to generate AI insights.</div>';
      return;
    }

    const minT = sim && sim.summary ? sim.summary.minIndoor : null;
    const ghi = c.solarGHI || 5.5;
    const dailyLoad = (((d.equipmentWatts||50) + (d.lightingWatts||20)) * 16 / 1000 + (d.occupants||2) * 0.3).toFixed(1);
    const pvKwp = (parseFloat(dailyLoad) / (ghi * 0.80)).toFixed(2);
    const wallR = (eng && eng.materials && eng.materials.wall && eng.materials.wall.R) ? eng.materials.wall.R : null;
    const wallName = (eng && eng.materials && eng.materials.wall) ? eng.materials.wall.name : d.wallMaterial.replace(/_/g,' ');
    const floorArea = d.length * d.width;
    const wfr = ((d.windowArea / floorArea) * 100).toFixed(0);

    const cards = [
      {
        icon: '🌡️', title: 'Thermal Comfort',
        status: minT === null ? 'info' : (minT >= 15 ? 'pass' : minT >= 5 ? 'warn' : 'fail'),
        value: minT === null ? 'Run Simulation' : `${minT.toFixed(1)}°C min indoor`,
        detail: minT === null ? 'Click ▶ Run Simulation in Tab 3' : (minT >= 15 ? 'Meets 15°C comfort threshold ✓' : 'Below comfort threshold — increase mass or insulation'),
        action: 'Is my shelter warm enough?'
      },
      {
        icon: '🧱', title: 'Wall Envelope',
        status: wallR ? (wallR >= 3.5 ? 'pass' : 'warn') : 'info',
        value: wallName,
        detail: `${(d.wallThickness*1000).toFixed(0)} mm${wallR ? ' | R = '+wallR.toFixed(2)+' m²K/W' : ''} | ${wallR && wallR >= 3.5 ? 'Meets cold-climate standard' : 'Target R ≥ 3.5 m²K/W'}`,
        action: 'What wall material should I use?'
      },
      {
        icon: '☀️', title: 'Solar PV Sizing',
        status: 'info',
        value: `${pvKwp} kWp required`,
        detail: `${dailyLoad} kWh/day load | ~${Math.ceil(parseFloat(pvKwp)/0.35)} × 350W panels | ${ghi} kWh/m²/day GHI`,
        action: 'How much solar panel do I need?'
      },
      {
        icon: '🔋', title: 'Thermal Mass',
        status: d.thermalStorageMass >= 400 ? 'pass' : 'warn',
        value: `${d.thermalStorageMass} kg`,
        detail: `${(d.thermalStorageType||'').replace(/_/g,' ')} | ${d.thermalStorageMass >= 400 ? 'Good for overnight heat retention' : 'Increase to ≥ 500 kg recommended'}`,
        action: 'Is my thermal storage sufficient?'
      },
      {
        icon: '🪟', title: 'South Glazing',
        status: (parseFloat(wfr) >= 15 && parseFloat(wfr) <= 25) ? 'pass' : 'warn',
        value: `${d.windowArea} m² (${wfr}% WFR)`,
        detail: `${d.windowOrientation}-facing ${d.windowType.replace(/_/g,' ')} | Optimal: 15–25% WFR`,
        action: 'Analyse my glazing'
      },
      {
        icon: '🏔️', title: 'Altitude Factors',
        status: 'info',
        value: `${c.elevation.toLocaleString()} m ASL`,
        detail: `Air density ~${((1.225 * Math.pow(1 - 0.0000225577 * c.elevation, 4.25588))/1.225*100).toFixed(0)}% of sea level · Solar +10% · Wind ${c.windSpeed || 3.8} m/s`,
        action: 'How does altitude affect my design?'
      }
    ];

    container.innerHTML = cards.map(card => `
      <div class="ai-insight-card ai-card-${card.status}" data-action="${card.action}" role="button" tabindex="0">
        <div class="ai-card-icon">${card.icon}</div>
        <div class="ai-card-body">
          <div class="ai-card-title">${card.title}</div>
          <div class="ai-card-value">${card.value}</div>
          <div class="ai-card-detail">${card.detail}</div>
        </div>
        <div class="ai-card-status-dot"></div>
      </div>`).join('');

    container.querySelectorAll('.ai-insight-card').forEach(card => {
      card.addEventListener('click', () => {
        const inp = document.getElementById('aiAgentInput');
        if (inp) inp.value = card.dataset.action;
        this._handleSend();
      });
    });
  }

  /* ── CHAT DOM HELPERS ───────────────────────────────────────── */
  _addMessage(role, text) {
    const feed = document.getElementById('aiChatFeed');
    if (!feed) return;
    this.messageHistory.push({ role, text, ts: Date.now() });
    const bubble = document.createElement('div');
    bubble.className = `ai-bubble ai-bubble-${role}`;
    bubble.innerHTML = `<div class="ai-avatar">${role === 'agent' ? '▲' : '👤'}</div><div class="ai-bubble-content">${this._md(text)}</div>`;
    feed.appendChild(bubble);
    feed.scrollTop = feed.scrollHeight;
  }

  _md(text) {
    // Bold, italic, code
    let h = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
    // Markdown table
    h = h.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (_, hdr, rows) => {
      const ths = hdr.split('|').filter(x=>x.trim()).map(x=>`<th>${x.trim()}</th>`).join('');
      const trs = rows.trim().split('\n').map(r => {
        const tds = r.split('|').filter(x=>x.trim()).map(x=>`<td>${x.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<div class="ai-table-wrap"><table class="ai-md-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
    });
    // Bullet lists
    h = h.replace(/(?:^|\n)((?:• .+\n?)+)/gm, (_, list) => {
      const items = list.trim().split('\n').map(l=>`<li>${l.replace(/^•\s*/,'').trim()}</li>`).join('');
      return `<ul class="ai-md-ul">${items}</ul>`;
    });
    // Numbered lists
    h = h.replace(/(?:^|\n)((?:\d+\. .+\n?)+)/gm, (_, list) => {
      const items = list.trim().split('\n').map(l=>`<li>${l.replace(/^\d+\.\s*/,'').trim()}</li>`).join('');
      return `<ol class="ai-md-ol">${items}</ol>`;
    });
    // Paragraphs
    h = h.split('\n\n').map(p => `<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
    return h;
  }

  _showTyping() {
    const feed = document.getElementById('aiChatFeed');
    if (!feed || document.getElementById('aiTypingIndicator')) return;
    const el = document.createElement('div');
    el.className = 'ai-bubble ai-bubble-agent ai-typing-indicator';
    el.id = 'aiTypingIndicator';
    el.innerHTML = `<div class="ai-avatar">▲</div><div class="ai-bubble-content"><span></span><span></span><span></span></div>`;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
  }

  _hideTyping() {
    const el = document.getElementById('aiTypingIndicator');
    if (el) el.remove();
  }

  _clearChat() {
    const feed = document.getElementById('aiChatFeed');
    if (feed) feed.innerHTML = '';
    this.messageHistory = [];
    this._addWelcomeMessage();
  }
}

window.SolarthermAI = SolarthermAI;
