/**
 * SOLARTHERM SIH26051 - Simulation UI Controller
 * Manages simulation lifecycle, Chart.js multi-variable plots,
 * physical metrics, and thermal energy balance readouts.
 */

class SimulationUI {
  constructor() {
    this.tempChart = null;
    this.energyChart = null;
    this.storageChart = null;
    this.isRunning = false;

    this.initEventListeners();
  }

  initEventListeners() {
    const runBtns = [document.getElementById('btnRunSimHeader'), document.getElementById('btnRunSimMain')];
    runBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => this.runSimulation());
      }
    });

    // Auto-run simulation when switching to Simulation tab if no results exist
    window.state.subscribe((st, key) => {
      if (key === 'activeTab' && st.activeTab === 'simulation' && !st.simulationResults) {
        this.runSimulation();
      }
    });
  }

  runSimulation() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Update status badge
    window.state.modelStatus = 'RUNNING TRANSIENT MODEL';
    const statusEl = document.getElementById('globalModelStatusBadge');
    if (statusEl) {
      statusEl.className = 'status-badge status-running';
      statusEl.textContent = 'RUNNING TRANSIENT MODEL...';
    }

    const runBtn = document.getElementById('btnRunSimMain');
    if (runBtn) {
      runBtn.innerHTML = '<span class="spinner"></span> Solving Transient ODEs...';
      runBtn.disabled = true;
    }

    // Simulate transient computation delay (400ms) for realistic UX
    setTimeout(() => {
      const results = window.thermalEngine.run24HourTransient(
        window.state.shelterDesign,
        window.state.climateProfile
      );

      window.state.simulationResults = results;
      window.state.modelStatus = 'SIMULATION COMPLETE';

      if (statusEl) {
        statusEl.className = 'status-badge status-complete';
        statusEl.textContent = 'SIMULATION COMPLETE';
      }

      if (runBtn) {
        runBtn.innerHTML = '▶ Re-run Simulation';
        runBtn.disabled = false;
      }

      this.isRunning = false;
      this.renderResults(results);

      // ── AD Recommendations: analyse design & render ──
      try {
        if (!window._adRec) window._adRec = new window.ADRecommendations();
        const rec = window._adRec.analyse(
          window.state.shelterDesign,
          window.state.climateProfile,
          results
        );
        window._adRec.render(rec);
        const badge = document.getElementById('recAIBadge');
        if (badge) {
          badge.textContent = window._adRec.aiAgentAvailable ? 'AI Agent' : 'Rule Engine';
          badge.className = 'rec-ai-badge ' + (window._adRec.aiAgentAvailable ? 'ai-active' : '');
        }
      } catch (e) {
        console.warn('[AD-REC] Recommendation error:', e);
      }
    }, 450);
  }

  renderResults(results) {
    const s = results.summary;
    const ts = results.timeSeries;

    // 1. Key Metrics Cards
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('simMinTemp', `${s.minIndoor > 0 ? '+' : ''}${s.minIndoor}°C`);
    setTxt('simMaxTemp', `+${s.maxIndoor}°C`);
    setTxt('simSolarGain', `${s.totalSolarKWh} kWh/day`);
    setTxt('simHeatLoss', `${s.totalEnvLossKWh} kWh/day`);
    setTxt('simAuxEnergy', `${s.totalAuxHeatingKWh} kWh/day`);
    setTxt('simKeroseneSaved', `${s.keroseneSavedLiters} L/day`);
    setTxt('simComfortHours', `${s.comfortHours} / 24 hrs`);

    // 2. Render Charts using Chart.js
    this.renderTemperatureChart(ts);
    this.renderEnergyFluxChart(ts);
    this.renderStorageChart(ts);
  }

  renderTemperatureChart(ts) {
    const ctx = document.getElementById('chartTempProfile');
    if (!ctx) return;

    if (this.tempChart) {
      this.tempChart.destroy();
    }

    this.tempChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ts.hours,
        datasets: [
          {
            label: 'Indoor Shelter Temp (°C)',
            data: ts.tIndoor,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointRadius: 2
          },
          {
            label: 'Ambient Ladakh Temp (°C)',
            data: ts.tAmbient,
            borderColor: '#38bdf8',
            borderDash: [5, 5],
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0
          },
          {
            label: 'Thermal Storage Temp (°C)',
            data: ts.tStorage,
            borderColor: '#10b981',
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Inter', size: 12 } }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            grid: { color: '#1e293b' },
            ticks: {
              color: '#94a3b8',
              callback: val => `${val}°C`
            },
            title: {
              display: true,
              text: 'Temperature (°C)',
              color: '#94a3b8'
            }
          }
        }
      }
    });
  }

  renderEnergyFluxChart(ts) {
    const ctx = document.getElementById('chartEnergyFlux');
    if (!ctx) return;

    if (this.energyChart) {
      this.energyChart.destroy();
    }

    this.energyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ts.hours,
        datasets: [
          {
            label: 'Solar Heat Captured (W)',
            data: ts.qSolarGain,
            backgroundColor: '#f59e0b',
            borderRadius: 4
          },
          {
            label: 'Envelope Conductive Loss (W)',
            data: ts.qEnvelopeLoss,
            backgroundColor: 'rgba(239, 68, 68, 0.75)',
            borderRadius: 4
          },
          {
            label: 'Infiltration Loss (W)',
            data: ts.qInfiltrationLoss,
            backgroundColor: 'rgba(56, 189, 248, 0.65)',
            borderRadius: 4
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
          x: {
            stacked: false,
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            grid: { color: '#1e293b' },
            ticks: { color: '#94a3b8', callback: val => `${val} W` },
            title: { display: true, text: 'Instantaneous Thermal Rate (Watts)', color: '#94a3b8' }
          }
        }
      }
    });
  }

  renderStorageChart(ts) {
    const ctx = document.getElementById('chartStorageState');
    if (!ctx) return;

    if (this.storageChart) {
      this.storageChart.destroy();
    }

    this.storageChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ts.hours,
        datasets: [
          {
            label: 'Heat Flux To/From Storage (W)',
            data: ts.qStorageHeatFlow,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.35
          },
          {
            label: 'Auxiliary Heating Demand (W)',
            data: ts.qAuxiliaryHeating,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            fill: true,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { family: 'Inter', size: 12 } } }
        },
        scales: {
          x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }
}

// Global initialization
window.SimulationUI = SimulationUI;
