/**
 * SOLARTHERM SIH26051 — High-Altitude AD Recommendations Engine
 * ──────────────────────────────────────────────────────────────────
 * After a simulation run this module analyses the design parameters,
 * climate profile and simulation results to produce actionable
 * engineering recommendations for high-altitude cold-climate shelters.
 *
 * Outputs:
 *  - Material recommendations (wall block, insulation, glazing)
 *  - Optimal wall thickness, thermal-storage mass, solar PV sizing
 *  - A radar-chart comparison (current vs recommended)
 *  - A set of detail cards
 *
 * Also exposes a hook for a local AI agent (Adarsh Drive) to
 * enrich/override the rule-based suggestions.
 */

class ADRecommendations {
  constructor() {
    this.recChart = null;            // Chart.js radar instance
    this.currentRec = null;          // Last recommendation object
    this.aiAgentAvailable = false;   // Will be true if AI module loads
    this._checkAIAgent();
  }

  /* ──────────────────────────────────────────────────────────────
     AI AGENT DISCOVERY
     Try to load the Adarsh-drive AI helper; gracefully degrade.
     ────────────────────────────────────────────────────────────── */
  _checkAIAgent() {
    if (window.AdarshAI && typeof window.AdarshAI.getRecommendations === 'function') {
      this.aiAgentAvailable = true;
      console.log('[AD-REC] ✓ Adarsh AI agent detected');
    } else {
      this.aiAgentAvailable = false;
      console.log('[AD-REC] ⓘ Using built-in rule engine (AI agent not found)');
    }
  }

  /* ──────────────────────────────────────────────────────────────
     CORE ANALYSIS — rule-based recommendation engine
     ────────────────────────────────────────────────────────────── */
  analyse(design, climate, simResults) {
    const alt  = climate?.altitude ?? 3500;       // metres
    const tMin = simResults?.summary?.minIndoor ?? -5;
    const tAmb = climate?.ambientDesignTemp ?? -22;
    const ghi  = climate?.solarGHI ?? 5.5;        // kWh/m²/day
    const hdd  = climate?.heatingDegreeDays ?? 6800;

    const rec = {
      wallBlock:       this._recommendWallBlock(alt, tAmb, hdd),
      wallThickness:   this._recommendWallThickness(tAmb, hdd),
      insulation:      this._recommendInsulation(alt, hdd),
      glazing:         this._recommendGlazing(tAmb),
      thermalStorage:  this._recommendStorage(design, tAmb, ghi),
      solarPV:         this._recommendSolarPV(design, ghi, simResults),
      roofDesign:      this._recommendRoof(alt, tAmb),
      ventilation:     this._recommendVentilation(alt),
      scores:          {},  // populated below
      summary:         ''
    };

    // Compute comparison scores (0-100) for radar chart
    rec.scores = this._scoreDesign(design, rec, simResults);
    rec.summary = this._generateSummary(rec, tMin);

    this.currentRec = rec;
    return rec;
  }

  // ─── Wall block ─────────────────────────────────────────────
  _recommendWallBlock(alt, tAmb, hdd) {
    if (hdd > 6000) {
      return {
        id: 'stone_masonry_xps',
        name: 'Granite Stone + 100 mm XPS Insulation',
        reason: `At ${alt} m altitude with ${hdd} HDD, local granite stone with continuous exterior XPS provides both structural mass and insulation envelope.`,
        uValue: 0.28,
        icon: '🧱'
      };
    }
    if (alt > 4000) {
      return {
        id: 'puf_composite',
        name: 'PUF Insulated Composite Panel',
        reason: 'Above 4 000 m, airlift weight constraints favour lightweight PUF panels with excellent R-value.',
        uValue: 0.16,
        icon: '🏗️'
      };
    }
    return {
      id: 'aac_block',
      name: 'AAC Block + External EPS',
      reason: 'Moderate altitude: lightweight AAC blocks with 75 mm EPS cladding strike the best cost/thermal balance.',
      uValue: 0.32,
      icon: '🧱'
    };
  }

  // ─── Wall thickness ─────────────────────────────────────────
  _recommendWallThickness(tAmb, hdd) {
    let mm;
    if (hdd > 7000)      mm = 450;
    else if (hdd > 5500) mm = 350;
    else if (hdd > 4000) mm = 300;
    else                 mm = 250;
    return {
      value_mm: mm,
      display: `${mm} mm`,
      reason: `Design ambient of ${tAmb} °C requires minimum ${mm} mm composite wall thickness to maintain U ≤ 0.35 W/m²K.`,
      icon: '📐'
    };
  }

  // ─── Insulation ─────────────────────────────────────────────
  _recommendInsulation(alt, hdd) {
    const options = [];
    if (hdd > 5000) {
      options.push({
        name: '100 mm XPS (Extruded Polystyrene)',
        rValue: 3.45,
        reason: 'Closed-cell XPS resists freeze-thaw moisture cycling at high altitude.',
        preferred: true,
        icon: '🛡️'
      });
    }
    options.push({
      name: '75 mm PUF Rigid Board',
      rValue: 3.13,
      reason: 'Highest R/mm ratio; ideal when wall cavity depth is limited.',
      preferred: hdd <= 5000,
      icon: '🧊'
    });
    options.push({
      name: '150 mm Mineral Wool',
      rValue: 3.75,
      reason: 'Fire-safe and breathable; needs vapour barrier at cold side.',
      preferred: false,
      icon: '🔥'
    });
    return options;
  }

  // ─── Glazing ────────────────────────────────────────────────
  _recommendGlazing(tAmb) {
    if (tAmb < -25) {
      return {
        name: 'Triple-pane Low-E Krypton-filled',
        uValue: 0.75,
        shgc: 0.50,
        reason: 'Extreme cold demands triple-pane with krypton fill for U ≤ 0.8 W/m²K while maintaining solar gain.',
        icon: '🪟'
      };
    }
    return {
      name: 'Double-pane Low-E Argon-filled',
      uValue: 1.4,
      shgc: 0.55,
      reason: 'Balanced SHGC and U-value for moderate-cold sites.',
      icon: '🪟'
    };
  }

  // ─── Thermal storage ───────────────────────────────────────
  _recommendStorage(design, tAmb, ghi) {
    const floorArea = (design?.length ?? 6) * (design?.width ?? 4);
    // Rule-of-thumb: 150–250 kg mass per m² floor for diurnal storage
    const massPerM2 = tAmb < -20 ? 220 : 160;
    const totalKg   = Math.round(floorArea * massPerM2 / 50) * 50;

    const options = [
      {
        name: 'Water Drums (200 L barrels)',
        mass_kg: totalKg,
        capacity_kWh: +(totalKg * 4186 * 15 / 3.6e6).toFixed(1),
        reason: `${Math.ceil(totalKg / 200)} × 200 L drums behind south wall absorb ${ghi.toFixed(1)} kWh/m²/day solar insolation.`,
        preferred: true,
        icon: '🛢️'
      },
      {
        name: 'Phase-Change Material (PCM-21)',
        mass_kg: Math.round(totalKg * 0.35),
        capacity_kWh: +(totalKg * 0.35 * 200000 / 3.6e6).toFixed(1),
        reason: 'PCM packs store 4× energy per kg around 21 °C melt point; reduces mass for airlift.',
        preferred: false,
        icon: '🔋'
      },
      {
        name: 'Crushed Rock Bed (Trombe)',
        mass_kg: Math.round(totalKg * 1.4),
        capacity_kWh: +(totalKg * 1.4 * 840 * 15 / 3.6e6).toFixed(1),
        reason: 'Locally available crushed granite in trombe wall cavity; zero-cost material.',
        preferred: false,
        icon: '🪨'
      }
    ];
    return { floorArea, massPerM2, totalKg, options };
  }

  // ─── Solar PV sizing ───────────────────────────────────────
  _recommendSolarPV(design, ghi, simResults) {
    const auxKWh  = simResults?.summary?.totalAuxHeatingKWh ?? 20;
    const peakSun = ghi * 0.85;   // de-rate for altitude dust/snow
    const panelWp = 440;          // Watt-peak per panel (latest mono-PERC)
    const nPanels = Math.ceil((auxKWh * 1000) / (peakSun * panelWp * 0.18));
    const totalWp = nPanels * panelWp;

    return {
      auxKWh: +auxKWh.toFixed(1),
      panelsNeeded: nPanels,
      totalWp,
      display: `${nPanels} × ${panelWp} Wp Mono-PERC = ${(totalWp / 1000).toFixed(1)} kWp`,
      tiltAngle: 60,   // steep for snow shedding + winter sun in Ladakh
      reason: `To offset ${auxKWh.toFixed(1)} kWh/day auxiliary heating at ${ghi} kWh/m²/day GHI with 60° tilt.`,
      icon: '☀️'
    };
  }

  // ─── Roof ──────────────────────────────────────────────────
  _recommendRoof(alt, tAmb) {
    return {
      name: tAmb < -20 ? 'Insulated Metal Deck (150 mm PUF core)' : 'RCC Slab + 100 mm XPS',
      pitch: alt > 4000 ? '30° (snow shedding)' : '20° (standard)',
      uValue: tAmb < -20 ? 0.15 : 0.25,
      reason: tAmb < -20
        ? 'Extreme cold requires metal deck with 150 mm PUF core for U ≤ 0.15 W/m²K.'
        : 'RCC slab with external XPS adequate for moderate cold.',
      icon: '🏠'
    };
  }

  // ─── Ventilation ───────────────────────────────────────────
  _recommendVentilation(alt) {
    const airDensity = (1.225 * Math.exp(-alt / 8500)).toFixed(2);
    return {
      type: 'ERV (Enthalpy Recovery Ventilation)',
      efficiency: '82%',
      airDensity: `${airDensity} kg/m³`,
      reason: `At ${alt} m, air density is only ${airDensity} kg/m³; ERV recovers 82 % sensible + latent heat from exhaust.`,
      icon: '💨'
    };
  }

  /* ──────────────────────────────────────────────────────────────
     SCORING  —  current design vs recommendations (0-100)
     ────────────────────────────────────────────────────────────── */
  _scoreDesign(design, rec, simResults) {
    const s = simResults?.summary ?? {};
    const wallThickCurr = (design?.wallThickness ?? 0.20) * 1000;
    const wallThickRec  = rec.wallThickness.value_mm;

    return {
      wallInsulation:   Math.min(100, Math.round((wallThickCurr / wallThickRec) * 100)),
      glazingQuality:   s.minIndoor > 5 ? 85 : (s.minIndoor > 0 ? 60 : 35),
      thermalStorage:   Math.min(100, Math.round(((design?.storageMass ?? 500) / rec.thermalStorage.totalKg) * 100)),
      solarCapture:     Math.min(100, Math.round(((s.totalSolarKWh ?? 15) / (s.totalEnvLossKWh ?? 35)) * 100)),
      envelopeTight:    s.minIndoor > 10 ? 90 : (s.minIndoor > 0 ? 65 : 40),
      ventRecovery:     50,  // default; upgraded if ERV is modelled
      overallComfort:   Math.min(100, Math.round(((s.comfortHours ?? 12) / 24) * 100)),
      pvCoverage:       Math.min(100, Math.round(((s.totalSolarKWh ?? 15) / (s.totalAuxHeatingKWh ?? 20)) * 100))
    };
  }

  /* ──────────────────────────────────────────────────────────────
     TEXT SUMMARY
     ────────────────────────────────────────────────────────────── */
  _generateSummary(rec, tMin) {
    const lines = [];
    if (tMin < 0) {
      lines.push(`⚠️ Indoor temperature drops to ${tMin} °C — urgent insulation upgrade required.`);
    } else if (tMin < 10) {
      lines.push(`ℹ️ Indoor minimum of ${tMin} °C is below thermal comfort (18 °C). Consider wall + storage upgrade.`);
    } else {
      lines.push(`✅ Indoor minimum of ${tMin} °C is above comfort threshold. Design is adequate.`);
    }
    lines.push(`Recommended wall: ${rec.wallBlock.name} at ${rec.wallThickness.display}.`);
    lines.push(`Thermal storage: ${rec.thermalStorage.totalKg} kg for ${rec.thermalStorage.floorArea} m² floor.`);
    lines.push(`Solar PV: ${rec.solarPV.display} at ${rec.solarPV.tiltAngle}° tilt.`);
    return lines.join('\n');
  }

  /* ──────────────────────────────────────────────────────────────
     RENDER UI
     ────────────────────────────────────────────────────────────── */
  render(rec) {
    this._renderRadarChart(rec.scores);
    this._renderDetailCards(rec);
    this._renderSummaryBanner(rec);
  }

  // ─── Radar chart ────────────────────────────────────────────
  _renderRadarChart(scores) {
    const ctx = document.getElementById('recRadarChart');
    if (!ctx) return;

    if (this.recChart) this.recChart.destroy();

    const labels = [
      'Wall Insulation', 'Glazing Quality', 'Thermal Storage',
      'Solar Capture', 'Envelope Tight.', 'Vent Recovery',
      'Comfort Hours', 'PV Coverage'
    ];
    const current = [
      scores.wallInsulation, scores.glazingQuality, scores.thermalStorage,
      scores.solarCapture, scores.envelopeTight, scores.ventRecovery,
      scores.overallComfort, scores.pvCoverage
    ];
    const target = [90, 85, 90, 80, 90, 82, 95, 75];

    this.recChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'Current Design',
            data: current,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderWidth: 2.5,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 4
          },
          {
            label: 'Recommended Target',
            data: target,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.10)',
            borderWidth: 2,
            borderDash: [6, 4],
            pointBackgroundColor: '#10b981',
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Inter', size: 12 } }
          }
        },
        scales: {
          r: {
            min: 0, max: 100,
            grid: { color: 'rgba(148,163,184,0.15)' },
            angleLines: { color: 'rgba(148,163,184,0.15)' },
            pointLabels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
            ticks: { display: false }
          }
        }
      }
    });
  }

  // ─── Detail cards ───────────────────────────────────────────
  _renderDetailCards(rec) {
    const container = document.getElementById('recDetailsGrid');
    if (!container) return;

    const cards = [
      {
        icon: rec.wallBlock.icon,
        title: 'Recommended Wall Block',
        value: rec.wallBlock.name,
        detail: rec.wallBlock.reason,
        metric: `U-value: ${rec.wallBlock.uValue} W/m²K`
      },
      {
        icon: rec.wallThickness.icon,
        title: 'Wall Thickness',
        value: rec.wallThickness.display,
        detail: rec.wallThickness.reason,
        metric: ''
      },
      {
        icon: rec.insulation[0].icon,
        title: 'Primary Insulation',
        value: rec.insulation.find(i => i.preferred)?.name ?? rec.insulation[0].name,
        detail: rec.insulation.find(i => i.preferred)?.reason ?? rec.insulation[0].reason,
        metric: `R-value: ${rec.insulation.find(i => i.preferred)?.rValue ?? rec.insulation[0].rValue} m²K/W`
      },
      {
        icon: rec.glazing.icon,
        title: 'Glazing System',
        value: rec.glazing.name,
        detail: rec.glazing.reason,
        metric: `U: ${rec.glazing.uValue} | SHGC: ${rec.glazing.shgc}`
      },
      {
        icon: rec.thermalStorage.options[0].icon,
        title: 'Thermal Storage',
        value: `${rec.thermalStorage.totalKg} kg total`,
        detail: rec.thermalStorage.options[0].reason,
        metric: `Capacity: ${rec.thermalStorage.options[0].capacity_kWh} kWh`
      },
      {
        icon: rec.solarPV.icon,
        title: 'Solar PV Array',
        value: rec.solarPV.display,
        detail: rec.solarPV.reason,
        metric: `Tilt: ${rec.solarPV.tiltAngle}°`
      },
      {
        icon: rec.roofDesign.icon,
        title: 'Roof Design',
        value: rec.roofDesign.name,
        detail: rec.roofDesign.reason,
        metric: `U: ${rec.roofDesign.uValue} W/m²K | Pitch: ${rec.roofDesign.pitch}`
      },
      {
        icon: rec.ventilation.icon,
        title: 'Ventilation Strategy',
        value: rec.ventilation.type,
        detail: rec.ventilation.reason,
        metric: `Recovery: ${rec.ventilation.efficiency} | ρ_air: ${rec.ventilation.airDensity}`
      }
    ];

    container.innerHTML = cards.map(c => `
      <div class="rec-card">
        <div class="rec-card-icon">${c.icon}</div>
        <div class="rec-card-body">
          <div class="rec-card-title">${c.title}</div>
          <div class="rec-card-value">${c.value}</div>
          <div class="rec-card-detail">${c.detail}</div>
          ${c.metric ? `<div class="rec-card-metric">${c.metric}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  // ─── Summary banner ────────────────────────────────────────
  _renderSummaryBanner(rec) {
    const el = document.getElementById('recSummaryBanner');
    if (!el) return;

    const lines = rec.summary.split('\n');
    const cls = lines[0].startsWith('✅') ? 'rec-status-good'
              : lines[0].startsWith('ℹ️') ? 'rec-status-info'
              : 'rec-status-warn';

    el.className = `rec-summary-banner ${cls}`;
    el.innerHTML = lines.map(l => `<div>${l}</div>`).join('');
  }
}

// Expose globally
window.ADRecommendations = ADRecommendations;
