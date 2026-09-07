/**
 * SOLARTHERM SIH26051 - Designer UI Controller
 * Synchronizes Model Tree, Component Inspector, Design Parameters,
 * Bill of Quantities (BoQ) and 2D Technical Drawing Canvas.
 */

class DesignerUI {
  constructor() {
    this.activeInspectorTab = 'properties';
    this.activeDrawingTab = 'plan';
    this.canvas = document.getElementById('cadCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.initEventListeners();
    this.updateAll();

    // Subscribe to state changes
    window.state.subscribe((st, key) => {
      this.updateAll();
    });
  }

  initEventListeners() {
    // Model Tree clicks
    document.querySelectorAll('.tree-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const compId = item.dataset.comp;
        if (compId) {
          window.state.selectComponent(compId);
        }
      });
    });

    // Inspector Tab clicks
    document.querySelectorAll('.inspector-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.inspector-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeInspectorTab = tab.dataset.tab;
        this.renderInspector();
      });
    });

    // Inspector Component Dropdown
    const compSelect = document.getElementById('inspectorCompSelect');
    if (compSelect) {
      compSelect.addEventListener('change', (e) => {
        window.state.selectComponent(e.target.value);
      });
    }

    // Drawing Tab clicks
    document.querySelectorAll('.cad-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.cad-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeDrawingTab = tab.dataset.view;
        this.renderTechnicalDrawing();
      });
    });

    // Download Drawing Button
    const dlBtn = document.getElementById('btnDownloadDrawing');
    if (dlBtn && this.canvas) {
      dlBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `SOLARTHERM-Drawing-${this.activeDrawingTab}-${Date.now()}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
      });
    }

    // Export STL Button
    const stlBtn = document.getElementById('btnExportSTL');
    if (stlBtn) {
      stlBtn.addEventListener('click', () => this.exportSTL());
    }

    // 3D Viewport Action buttons
    const btnMap = {
      'btnViewIso': 'iso',
      'btnViewFront': 'front',
      'btnViewTop': 'top',
      'btnViewSide': 'side',
      'btnViewSection': 'section',
      'btnViewExplode': 'explode',
      'btnViewReset': 'reset'
    };

    Object.keys(btnMap).forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.viewport-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          window.state.setViewMode(btnMap[id]);
        });
      }
    });

    // Sun Path Toggle
    const sunBtn = document.getElementById('btnSunPathToggle');
    if (sunBtn) {
      sunBtn.addEventListener('click', () => {
        if (window.shelter3DInstance) {
          window.shelter3DInstance.toggleSunPath();
          sunBtn.classList.toggle('active', window.shelter3DInstance.sunPathVisible);
        }
      });
    }

    // Update Design Button
    const updateBtn = document.getElementById('btnUpdateDesign');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => {
        window.state.notify('shelterDesign');
        updateBtn.innerHTML = '<span>✓</span> Updated';
        setTimeout(() => { updateBtn.innerHTML = 'Update Design'; }, 1200);
      });
    }

    // Reset Design Button
    const resetBtn = document.getElementById('btnResetDesign');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.state.shelterDesign = {
          id: 'SHELTER-001',
          length: 6.00,
          width: 4.00,
          height: 2.80,
          roofPitch: 20,
          orientation: 180,
          wallMaterial: 'plain_concrete',
          wallThickness: 0.20,
          roofMaterial: 'metal_corrugated',
          roofThickness: 0.15,
          floorMaterial: 'concrete_slab_ground',
          floorThickness: 0.10,
          windowType: 'double_pane',
          windowArea: 3.50,
          windowOrientation: 'south',
          doorWidth: 1.00,
          doorHeight: 2.00,
          thermalStorageType: 'water_thermal_mass',
          thermalStorageMass: 500,
          occupants: 2,
          equipmentWatts: 50,
          lightingWatts: 20,
          schedule: '18:00 - 07:00'
        };
        window.state.notify('shelterDesign');
        this.syncInputFields();
      });
    }

    // Parameter inputs bindings
    this.bindInputs();
  }

  bindInputs() {
    const bindSync = (sliderId, inputId, key) => {
      const slider = document.getElementById(sliderId);
      const input = document.getElementById(inputId);
      if (!slider || !input) return;

      slider.addEventListener('input', (e) => {
        input.value = e.target.value;
        window.state.updateParam(key, parseFloat(e.target.value));
      });

      input.addEventListener('change', (e) => {
        slider.value = e.target.value;
        window.state.updateParam(key, parseFloat(e.target.value));
      });
    };

    bindSync('paramLength', 'paramLengthNum', 'length');
    bindSync('paramWidth', 'paramWidthNum', 'width');
    bindSync('paramHeight', 'paramHeightNum', 'height');
    bindSync('paramPitch', 'paramPitchNum', 'roofPitch');
    bindSync('paramOrientation', 'paramOrientationNum', 'orientation');
    bindSync('paramWallThick', 'paramWallThickNum', 'wallThickness');
    bindSync('paramRoofThick', 'paramRoofThickNum', 'roofThickness');
    bindSync('paramFloorThick', 'paramFloorThickNum', 'floorThickness');
    bindSync('paramWinArea', 'paramWinAreaNum', 'windowArea');
    bindSync('paramStorageMass', 'paramStorageMassNum', 'thermalStorageMass');
    bindSync('paramOccupants', 'paramOccupantsNum', 'occupants');
    bindSync('paramEquip', 'paramEquipNum', 'equipmentWatts');
    bindSync('paramLighting', 'paramLightingNum', 'lightingWatts');

    // Dropdowns
    const bindSelect = (selectId, key) => {
      const el = document.getElementById(selectId);
      if (el) {
        el.addEventListener('change', (e) => {
          window.state.updateParam(key, e.target.value);
        });
      }
    };

    bindSelect('paramWallMat', 'wallMaterial');
    bindSelect('paramRoofMat', 'roofMaterial');
    bindSelect('paramFloorMat', 'floorMaterial');
    bindSelect('paramWinType', 'windowType');
    bindSelect('paramWinOrient', 'windowOrientation');
    bindSelect('paramStorageType', 'thermalStorageType');
  }

  syncInputFields() {
    const d = window.state.shelterDesign;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    setVal('paramLength', d.length);
    setVal('paramLengthNum', d.length);
    setVal('paramWidth', d.width);
    setVal('paramWidthNum', d.width);
    setVal('paramHeight', d.height);
    setVal('paramHeightNum', d.height);
    setVal('paramPitch', d.roofPitch);
    setVal('paramPitchNum', d.roofPitch);
    setVal('paramOrientation', d.orientation);
    setVal('paramOrientationNum', d.orientation);

    setVal('paramWallMat', d.wallMaterial);
    setVal('paramWallThick', d.wallThickness);
    setVal('paramWallThickNum', d.wallThickness);
    setVal('paramRoofMat', d.roofMaterial);
    setVal('paramRoofThick', d.roofThickness);
    setVal('paramRoofThickNum', d.roofThickness);
    setVal('paramFloorMat', d.floorMaterial);
    setVal('paramFloorThick', d.floorThickness);
    setVal('paramFloorThickNum', d.floorThickness);

    setVal('paramWinType', d.windowType);
    setVal('paramWinArea', d.windowArea);
    setVal('paramWinAreaNum', d.windowArea);
    setVal('paramWinOrient', d.windowOrientation);

    setVal('paramStorageType', d.thermalStorageType);
    setVal('paramStorageMass', d.thermalStorageMass);
    setVal('paramStorageMassNum', d.thermalStorageMass);

    setVal('paramOccupants', d.occupants);
    setVal('paramOccupantsNum', d.occupants);
    setVal('paramEquip', d.equipmentWatts);
    setVal('paramEquipNum', d.equipmentWatts);
    setVal('paramLighting', d.lightingWatts);
    setVal('paramLightingNum', d.lightingWatts);

    // Update total internal gain badge
    const totalW = (d.occupants * 75) + d.equipmentWatts + d.lightingWatts;
    const internalBadge = document.getElementById('totalInternalGainBadge');
    if (internalBadge) internalBadge.textContent = `${totalW} W`;
  }

  updateAll() {
    this.syncInputFields();
    this.updateModelTree();
    this.renderInspector();
    this.renderBoQ();
    this.renderTechnicalDrawing();
  }

  updateModelTree() {
    const sel = window.state.selectedComponent;
    document.querySelectorAll('.tree-item').forEach(item => {
      item.classList.toggle('active', item.dataset.comp === sel);
    });

    const compSelect = document.getElementById('inspectorCompSelect');
    if (compSelect && compSelect.value !== sel) {
      compSelect.value = sel;
    }
  }

  renderInspector() {
    const compId = window.state.selectedComponent;
    const d = window.state.shelterDesign;
    const eng = window.state.getComputedEngineering();
    const container = document.getElementById('inspectorContent');
    if (!container) return;

    // Component specific mapping
    let compData = {};

    switch (compId) {
      case 'south_wall':
        compData = {
          name: eng.materials.wall.name,
          subtitle: eng.materials.wall.subtitle,
          length: `${d.length.toFixed(2)} m`,
          height: `${d.height.toFixed(2)} m`,
          thickness: `${d.wallThickness.toFixed(2)} m (${(d.wallThickness * 1000).toFixed(0)} mm)`,
          area: `${eng.netAreas.south.toFixed(2)} m² (Net)`,
          volume: `${(eng.netAreas.south * d.wallThickness).toFixed(2)} m³`,
          mass: `${Math.round(eng.netAreas.south * d.wallThickness * eng.materials.wall.density).toLocaleString()} kg`,
          k: `${eng.materials.wall.k.toFixed(2)} W/m·K`,
          density: `${eng.materials.wall.density.toLocaleString()} kg/m³`,
          cp: `${eng.materials.wall.cp.toLocaleString()} J/kg·K`,
          rValue: `${eng.rValues.wall.toFixed(3)} m²·K/W`,
          uValue: `${eng.uValues.wall.toFixed(2)} W/m²·K`,
          heatLoss: `${eng.percentages.wall.toFixed(0)}%`,
          warning: eng.materials.wall.warning || (eng.uValues.wall > 2.0 ? 'High conductive loss. Consider using insulation or composite panel to reduce heat transfer.' : null)
        };
        break;

      case 'north_wall':
        compData = {
          name: eng.materials.wall.name,
          subtitle: 'North-facing cold thermal envelope barrier',
          length: `${d.length.toFixed(2)} m`,
          height: `${d.height.toFixed(2)} m`,
          thickness: `${d.wallThickness.toFixed(2)} m (${(d.wallThickness * 1000).toFixed(0)} mm)`,
          area: `${eng.grossAreas.north.toFixed(2)} m²`,
          volume: `${(eng.grossAreas.north * d.wallThickness).toFixed(2)} m³`,
          mass: `${Math.round(eng.grossAreas.north * d.wallThickness * eng.materials.wall.density).toLocaleString()} kg`,
          k: `${eng.materials.wall.k.toFixed(2)} W/m·K`,
          density: `${eng.materials.wall.density.toLocaleString()} kg/m³`,
          cp: `${eng.materials.wall.cp.toLocaleString()} J/kg·K`,
          rValue: `${eng.rValues.wall.toFixed(3)} m²·K/W`,
          uValue: `${eng.uValues.wall.toFixed(2)} W/m²·K`,
          heatLoss: `${((eng.grossAreas.north * eng.uValues.wall / eng.conductances.uaTotal) * 100).toFixed(0)}%`,
          warning: 'Continuous shadow facade in winter. Priority candidate for maximum insulation thickness.'
        };
        break;

      case 'roof':
        compData = {
          name: eng.materials.roof.name,
          subtitle: `${d.roofPitch}° pitched roof with integrated solar PV/thermal capture`,
          length: `${d.length.toFixed(2)} m`,
          height: `Pitch ${d.roofPitch}°`,
          thickness: `${d.roofThickness.toFixed(2)} m (${(d.roofThickness * 1000).toFixed(0)} mm)`,
          area: `${eng.grossAreas.roof.toFixed(2)} m²`,
          volume: `${eng.volumes.roofVolume.toFixed(2)} m³`,
          mass: `${Math.round(eng.volumes.roofVolume * eng.materials.roof.density).toLocaleString()} kg`,
          k: `${eng.materials.roof.k.toFixed(3)} W/m·K`,
          density: `${eng.materials.roof.density.toLocaleString()} kg/m³`,
          cp: `${eng.materials.roof.cp.toLocaleString()} J/kg·K`,
          rValue: `${eng.rValues.roof.toFixed(3)} m²·K/W`,
          uValue: `${eng.uValues.roof.toFixed(2)} W/m²·K`,
          heatLoss: `${eng.percentages.roof.toFixed(0)}%`,
          warning: d.roofPitch < 15 ? 'Low pitch angle in Ladakh. Recommend 20°-35° to shed heavy snow and optimize solar incidence.' : null
        };
        break;

      case 'window_s':
        compData = {
          name: eng.materials.glass.name,
          subtitle: 'High solar gain south-facing fenestration aperture',
          length: `Area ${d.windowArea.toFixed(2)} m²`,
          height: `SHGC: ${eng.materials.glass.shgc}`,
          thickness: `Visual Transmittance: ${eng.materials.glass.vt}`,
          area: `${d.windowArea.toFixed(2)} m²`,
          volume: `Cavity Argon/Air`,
          mass: `${Math.round(d.windowArea * 25)} kg`,
          k: `Gas Space Convection`,
          density: `2500 kg/m³ (Glass)`,
          cp: `840 J/kg·K`,
          rValue: `${(1 / eng.materials.glass.uValue).toFixed(3)} m²·K/W`,
          uValue: `${eng.materials.glass.uValue.toFixed(2)} W/m²·K`,
          heatLoss: `${eng.percentages.glass.toFixed(0)}%`,
          warning: eng.materials.glass.warning
        };
        break;

      case 'thermal_mass':
        compData = {
          name: eng.materials.storage.name,
          subtitle: eng.materials.storage.description,
          length: `Capacity: ${d.thermalStorageMass} kg`,
          height: `Type: ${eng.materials.storage.type}`,
          thickness: `Location: Behind South Glazing`,
          area: `Coupled to Solar Aperture`,
          volume: `${(d.thermalStorageMass / eng.materials.storage.density).toFixed(2)} m³`,
          mass: `${d.thermalStorageMass} kg`,
          k: `Internal Fluid/Solid Transfer`,
          density: `${eng.materials.storage.density} kg/m³`,
          cp: `${eng.materials.storage.cp.toLocaleString()} J/kg·K`,
          rValue: `Thermal Inertia (High)`,
          uValue: `Internal Heat Sink`,
          heatLoss: `0% (Heat Sink)`,
          warning: d.thermalStorageMass < 300 ? 'Low thermal mass volume. Room will cool down rapidly after sunset (17:00).' : null
        };
        break;

      default:
        // Foundation / Floor
        compData = {
          name: eng.materials.floor.name,
          subtitle: eng.materials.floor.subtitle,
          length: `${d.length.toFixed(2)} m`,
          height: `${d.width.toFixed(2)} m`,
          thickness: `${d.floorThickness.toFixed(2)} m`,
          area: `${eng.grossAreas.floor.toFixed(2)} m²`,
          volume: `${(eng.grossAreas.floor * d.floorThickness).toFixed(2)} m³`,
          mass: `${Math.round(eng.grossAreas.floor * d.floorThickness * eng.materials.floor.density).toLocaleString()} kg`,
          k: `${eng.materials.floor.k.toFixed(2)} W/m·K`,
          density: `${eng.materials.floor.density.toLocaleString()} kg/m³`,
          cp: `${eng.materials.floor.cp.toLocaleString()} J/kg·K`,
          rValue: `${eng.rValues.floor.toFixed(3)} m²·K/W`,
          uValue: `${eng.uValues.floor.toFixed(2)} W/m²·K`,
          heatLoss: `${eng.percentages.floor.toFixed(0)}%`,
          warning: eng.materials.floor.warning
        };
    }

    // Build HTML matching the screenshot design
    container.innerHTML = `
      <div class="inspector-card-header">
        <div class="material-preview-box" style="background-color: ${eng.materials.wall.color}">
          <div class="material-layer-strip"></div>
        </div>
        <div class="material-info-text">
          <div class="material-title">${compData.name}</div>
          <div class="material-sub">${compData.subtitle}</div>
        </div>
      </div>

      <div class="inspector-grid">
        <div class="prop-row"><span class="prop-lbl">Length</span><span class="prop-val">${compData.length}</span></div>
        <div class="prop-row"><span class="prop-lbl">Thermal Conductivity (k)</span><span class="prop-val highlight-k">${compData.k}</span></div>

        <div class="prop-row"><span class="prop-lbl">Height</span><span class="prop-val">${compData.height}</span></div>
        <div class="prop-row"><span class="prop-lbl">Density (ρ)</span><span class="prop-val">${compData.density}</span></div>

        <div class="prop-row"><span class="prop-lbl">Thickness</span><span class="prop-val">${compData.thickness}</span></div>
        <div class="prop-row"><span class="prop-lbl">Specific Heat (Cp)</span><span class="prop-val">${compData.cp}</span></div>

        <div class="prop-row"><span class="prop-lbl">Area</span><span class="prop-val">${compData.area}</span></div>
        <div class="prop-row"><span class="prop-lbl">R-value</span><span class="prop-val highlight-r">${compData.rValue}</span></div>

        <div class="prop-row"><span class="prop-lbl">Volume</span><span class="prop-val">${compData.volume}</span></div>
        <div class="prop-row"><span class="prop-lbl">U-value</span><span class="prop-val highlight-u">${compData.uValue}</span></div>

        <div class="prop-row"><span class="prop-lbl">Estimated Mass</span><span class="prop-val">${compData.mass}</span></div>
        <div class="prop-row"><span class="prop-lbl">Heat Loss Contribution</span><span class="prop-val highlight-loss">${compData.heatLoss}</span></div>
      </div>

      ${compData.warning ? `
        <div class="inspector-warning-banner">
          <span class="warning-icon">⚠️</span>
          <div class="warning-text">${compData.warning}</div>
        </div>
      ` : `
        <div class="inspector-success-banner">
          <span class="success-icon">✓</span>
          <div class="warning-text">Thermal envelope layer meets high-altitude design guidelines.</div>
        </div>
      `}
    `;
  }

  renderBoQ() {
    const eng = window.state.getComputedEngineering();
    const d = window.state.shelterDesign;
    const tbody = document.getElementById('boqTableBody');
    if (!tbody) return;

    const items = [
      {
        no: 1,
        comp: 'Foundation',
        spec: `${eng.materials.floor.name} (${(d.floorThickness * 1000).toFixed(0)} mm)`,
        qty: eng.grossAreas.floor.toFixed(2),
        unit: 'm²',
        mass: Math.round(eng.grossAreas.floor * d.floorThickness * eng.materials.floor.density)
      },
      {
        no: 2,
        comp: 'Walls (Total)',
        spec: `${eng.materials.wall.name} (${(d.wallThickness * 1000).toFixed(0)} mm)`,
        qty: eng.volumes.wallVolume.toFixed(2),
        unit: 'm³',
        mass: Math.round(eng.masses.totalWallMass)
      },
      {
        no: 3,
        comp: 'Roof',
        spec: `${eng.materials.roof.name} (${(d.roofThickness * 1000).toFixed(0)} mm)`,
        qty: eng.grossAreas.roof.toFixed(2),
        unit: 'm²',
        mass: Math.round(eng.volumes.roofVolume * eng.materials.roof.density)
      },
      {
        no: 4,
        comp: 'Windows',
        spec: eng.materials.glass.name,
        qty: d.windowArea.toFixed(2),
        unit: 'm²',
        mass: Math.round(d.windowArea * 25)
      },
      {
        no: 5,
        comp: 'Door',
        spec: 'Insulated Thermal Airlock Door',
        qty: (d.doorWidth * d.doorHeight).toFixed(2),
        unit: 'm²',
        mass: 65
      },
      {
        no: 6,
        comp: 'Thermal Storage',
        spec: eng.materials.storage.name,
        qty: d.thermalStorageMass,
        unit: 'kg',
        mass: d.thermalStorageMass
      }
    ];

    tbody.innerHTML = items.map(it => `
      <tr>
        <td class="td-num">${it.no}</td>
        <td class="td-comp">${it.comp}</td>
        <td class="td-spec">${it.spec}</td>
        <td class="td-qty">${it.qty}</td>
        <td class="td-unit">${it.unit}</td>
      </tr>
    `).join('');

    // Summary airlift logistics
    const totalMassKg = items.reduce((acc, it) => acc + it.mass, 0);
    const tonnes = (totalMassKg / 1000).toFixed(1);
    const mi17Sorties = Math.ceil(totalMassKg / 2500); // 2.5 tonnes payload derated at 3500m

    const logEl = document.getElementById('boqLogisticsSummary');
    if (logEl) {
      logEl.innerHTML = `
        <div class="logistics-pill">Deadweight: <strong>${tonnes} t</strong></div>
        <div class="logistics-pill">High-Altitude Airlift Sorties: <strong>${mi17Sorties} Sorties</strong> (Mi-17 @ 3,500m)</div>
      `;
    }
  }

  renderTechnicalDrawing() {
    if (!this.canvas || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width = 440;
    const h = this.canvas.height = 240;

    ctx.clearRect(0, 0, w, h);

    // Deep blueprint background
    ctx.fillStyle = '#0a1424';
    ctx.fillRect(0, 0, w, h);

    // Fine drafting grid
    ctx.strokeStyle = '#152642';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const d = window.state.shelterDesign;

    // View routing
    if (this.activeDrawingTab === 'plan') {
      this.drawPlanView(ctx, w, h, d);
    } else if (this.activeDrawingTab === 'front') {
      this.drawFrontElevation(ctx, w, h, d);
    } else if (this.activeDrawingTab === 'side') {
      this.drawSideElevation(ctx, w, h, d);
    } else {
      this.drawSectionView(ctx, w, h, d);
    }
  }

  drawPlanView(ctx, w, h, d) {
    const scale = Math.min(260 / d.length, 140 / d.width);
    const cx = w / 2 - 20;
    const cy = h / 2;

    const pw = d.length * scale;
    const ph = d.width * scale;
    const x0 = cx - pw / 2;
    const y0 = cy - ph / 2;

    // Outer perimeter walls
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x0, y0, pw, ph);

    // Inner wall offset (thickness)
    const tw = Math.max(4, d.wallThickness * scale);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x0 + tw, y0 + tw, pw - 2 * tw, ph - 2 * tw);

    // South Glazing opening (bottom edge)
    const winW = (d.windowArea / 2.0) * scale;
    const winX = x0 + 20;
    ctx.clearRect(winX, y0 + ph - tw, winW, tw);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(winX, y0 + ph - tw + 2, winW, tw - 4);
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(winX, y0 + ph - tw + 2, winW, tw - 4);

    // Door opening (bottom edge right)
    const doorW = (d.doorWidth || 1.0) * scale;
    const doorX = x0 + pw - doorW - 20;
    ctx.clearRect(doorX, y0 + ph - tw, doorW, tw);
    // Door swing arc
    ctx.beginPath();
    ctx.arc(doorX, y0 + ph - tw, doorW, 0, Math.PI / 2);
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    // Internal furniture / layout representation
    ctx.strokeStyle = '#1e3a5f';
    ctx.strokeRect(x0 + tw + 15, y0 + tw + 10, 45, 30); // bed
    ctx.strokeRect(x0 + pw - tw - 60, y0 + tw + 10, 45, 25); // desk

    // Water thermal storage drums
    if (d.thermalStorageType === 'water_thermal_mass') {
      ctx.fillStyle = '#0284c7';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(winX + 15 + i * 22, y0 + ph - tw - 12, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Dimension lines
    this.drawDimensionLine(ctx, x0, y0 - 15, x0 + pw, y0 - 15, `${d.length.toFixed(2)} m`);
    this.drawDimensionLine(ctx, x0 + pw + 18, y0, x0 + pw + 18, y0 + ph, `${d.width.toFixed(2)} m`);

    // North Orientation Arrow
    this.drawNorthArrow(ctx, w - 35, 40);
  }

  drawFrontElevation(ctx, w, h, d) {
    const scale = Math.min(260 / d.length, 130 / d.height);
    const cx = w / 2;
    const cy = h / 2 + 15;

    const pw = d.length * scale;
    const ph = d.height * scale;
    const x0 = cx - pw / 2;
    const y0 = cy - ph / 2;

    // Base Plinth
    ctx.fillStyle = '#334155';
    ctx.fillRect(x0 - 8, y0 + ph, pw + 16, 12);

    // Wall Facade
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x0, y0, pw, ph);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, pw, ph);

    // South Glazing
    const winW = (d.windowArea / 2.0) * scale;
    const winH = 1.8 * scale;
    const winX = x0 + 20;
    const winY = y0 + ph - winH;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(winX, winY, winW, winH);

    // Door
    const doorW = (d.doorWidth || 1.0) * scale;
    const doorH = (d.doorHeight || 2.0) * scale;
    const doorX = x0 + pw - doorW - 20;
    const doorY = y0 + ph - doorH;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(doorX, doorY, doorW, doorH);
    ctx.strokeStyle = '#f59e0b';
    ctx.strokeRect(doorX, doorY, doorW, doorH);

    // Roof slope
    const pitchRad = (d.roofPitch * Math.PI) / 180;
    const rSlope = Math.tan(pitchRad) * (pw * 0.4);
    ctx.beginPath();
    ctx.moveTo(x0 - 10, y0);
    ctx.lineTo(x0 + pw + 10, y0 - rSlope);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Dimensions
    this.drawDimensionLine(ctx, x0, y0 + ph + 24, x0 + pw, y0 + ph + 24, `${d.length.toFixed(2)} m`);
    this.drawDimensionLine(ctx, x0 - 20, y0, x0 - 20, y0 + ph, `${d.height.toFixed(2)} m`);
  }

  drawSideElevation(ctx, w, h, d) {
    const scale = Math.min(240 / d.width, 130 / d.height);
    const cx = w / 2;
    const cy = h / 2 + 15;

    const pw = d.width * scale;
    const ph = d.height * scale;
    const x0 = cx - pw / 2;
    const y0 = cy - ph / 2;
    const pitchRad = (d.roofPitch * Math.PI) / 180;
    const roofDelta = pw * Math.tan(pitchRad);

    // Mono-pitch side profile
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ph); // bottom left (North)
    ctx.lineTo(x0, y0);      // top left (North)
    ctx.lineTo(x0 + pw, y0 - roofDelta); // top right (South high)
    ctx.lineTo(x0 + pw, y0 + ph); // bottom right (South)
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ground line
    ctx.strokeStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(x0 - 25, y0 + ph);
    ctx.lineTo(x0 + pw + 25, y0 + ph);
    ctx.stroke();

    this.drawDimensionLine(ctx, x0, y0 + ph + 22, x0 + pw, y0 + ph + 22, `${d.width.toFixed(2)} m`);
  }

  drawSectionView(ctx, w, h, d) {
    const scale = Math.min(240 / d.width, 120 / d.height);
    const cx = w / 2;
    const cy = h / 2 + 15;

    const pw = d.width * scale;
    const ph = d.height * scale;
    const x0 = cx - pw / 2;
    const y0 = cy - ph / 2;

    // Cross Section Cut showing insulation layers
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, pw, ph);

    // Insulation hatching on North wall (left)
    ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.fillRect(x0, y0, 12, ph);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText('PUF/EPS', x0 + 16, y0 + ph / 2);

    // South Glazing (right)
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x0 + pw - 6, y0 + ph * 0.3, 6, ph * 0.7);

    // Internal Thermal Mass
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(x0 + pw - 35, y0 + ph * 0.45, 18, ph * 0.55);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('Thermal Mass', x0 + pw - 75, y0 + ph * 0.38);

    // Solar angle arrow entering south glazing
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + pw + 30, y0 - 15);
    ctx.lineTo(x0 + pw - 25, y0 + ph * 0.6);
    ctx.stroke();
  }

  drawDimensionLine(ctx, x1, y1, x2, y2, text) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrows
    const drawArrow = (x, y, dx, dy) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * 6 - dy * 3, y + dy * 6 + dx * 3);
      ctx.lineTo(x + dx * 6 + dy * 3, y + dy * 6 - dx * 3);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    };

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, midX, midY - 2);
  }

  drawNorthArrow(ctx, x, y) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 18);
    ctx.lineTo(x, y - 18);
    ctx.stroke();

    // Arrow tip
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x - 5, y - 8);
    ctx.lineTo(x + 5, y - 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText('N', x, y - 22);
  }

  exportSTL() {
    const d = window.state.shelterDesign;
    const L = d.length;
    const W = d.width;
    const H = d.height;

    // ASCII STL file generation for 3D printing / CAD import
    let stl = `solid SOLARTHERM_${d.id}\n`;

    const addFacet = (n, v1, v2, v3) => {
      stl += `  facet normal ${n[0]} ${n[1]} ${n[2]}\n`;
      stl += `    outer loop\n`;
      stl += `      vertex ${v1[0]} ${v1[1]} ${v1[2]}\n`;
      stl += `      vertex ${v2[0]} ${v2[1]} ${v2[2]}\n`;
      stl += `      vertex ${v3[0]} ${v3[1]} ${v3[2]}\n`;
      stl += `    endloop\n`;
      stl += `  endfacet\n`;
    };

    // Box facets
    const x0 = -L / 2, x1 = L / 2;
    const y0 = 0, y1 = H;
    const z0 = -W / 2, z1 = W / 2;

    // Bottom
    addFacet([0, -1, 0], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]);
    addFacet([0, -1, 0], [x0, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    // Top
    addFacet([0, 1, 0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]);
    addFacet([0, 1, 0], [x0, y1, z0], [x1, y1, z1], [x1, y1, z0]);
    // Front South
    addFacet([0, 0, 1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1]);
    addFacet([0, 0, 1], [x0, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    // Back North
    addFacet([0, 0, -1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    addFacet([0, 0, -1], [x0, y0, z0], [x1, y1, z0], [x1, y0, z0]);

    stl += `endsolid SOLARTHERM_${d.id}\n`;

    const blob = new Blob([stl], { type: 'application/sla' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SOLARTHERM_${d.id}_CAD.stl`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

// Global initialization helper
window.DesignerUI = DesignerUI;
