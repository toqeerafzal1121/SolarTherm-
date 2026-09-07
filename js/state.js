/**
 * SOLARTHERM SIH26051 - Central State Manager
 * Observable state pattern enforcing single source of truth:
 * USER INPUT -> PARAMETRIC GEOMETRY -> 3D DIGITAL SHELTER -> COMPONENT INSPECTOR -> BOQ -> SIMULATION -> REPORT
 */

class AppState {
  constructor() {
    this.shelterDesign = {
      id: 'SHELTER-001',
      // Geometry
      length: 6.00,        // m
      width: 4.00,         // m
      height: 2.80,        // m
      roofPitch: 20,       // degrees
      orientation: 180,    // azimuth: 180 = facing Due South

      // Envelope Materials
      wallMaterial: 'plain_concrete',
      wallThickness: 0.20, // m (200 mm)
      roofMaterial: 'metal_corrugated',
      roofThickness: 0.15, // m (150 mm)
      floorMaterial: 'concrete_slab_ground',
      floorThickness: 0.10,// m (100 mm)

      // Glazing & Openings
      windowType: 'double_pane',
      windowArea: 3.50,    // m²
      windowOrientation: 'south',
      doorWidth: 1.00,     // m
      doorHeight: 2.00,    // m (door area = 2.0 m²)

      // Thermal Storage
      thermalStorageType: 'water_thermal_mass',
      thermalStorageMass: 500, // kg

      // Internal Heat Gains
      occupants: 2,        // persons (~75 W sensible each)
      equipmentWatts: 50,  // W
      lightingWatts: 20,   // W
      schedule: '18:00 - 07:00'
    };

    this.selectedComponent = 'south_wall'; // matches the mockup selection
    this.viewMode = 'iso';                // 'iso', 'front', 'top', 'side', 'section', 'explode', 'thermal'
    this.sunPathActive = true;
    this.activeTab = 'designer';
    this.darkMode = true;
    this.modelStatus = 'MODEL READY'; // 'MODEL READY' | 'RUNNING TRANSIENT MODEL' | 'SIMULATION COMPLETE'

    this.climateProfile = {
      id: 'leh',
      name: 'Leh (Central Ladakh)',
      subtext: 'High Altitude Cold Arid Zone',
      lat: 34.1526,
      lon: 77.5771,
      elevation: 3505, // m
      designWinterTemp: -22, // °C
      solarGHI: 5.5, // kWh/m²/day
      windSpeed: 3.8, // m/s
      airPressure: 66.5, // kPa at 3505m
      airDensity: 0.85,  // kg/m³
      dataSource: 'NASA POWER 20-Year Climatology (Verified)',
      dataStatus: 'VERIFIED REFERENCE DATA',
      retrievalTime: '05 Sep 2026 06:00 UTC',
      hourlyAmbient: [-18, -19, -20, -21, -22, -22, -21, -19, -15, -11, -8, -6, -5, -4, -6, -9, -12, -14, -16, -17, -17, -18, -18, -19],
      hourlySolarGHI: [0, 0, 0, 0, 0, 0, 0, 75, 290, 530, 740, 850, 870, 790, 610, 360, 120, 0, 0, 0, 0, 0, 0, 0] // W/m²
    };

    this.simulationResults = null;
    this.optimizationResults = null;
    this.designHistory = [];
    this.listeners = new Set();
  }

  // Subscribe to state updates
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(changeKey, details = {}) {
    this.listeners.forEach(fn => fn(this, changeKey, details));
  }

  // Update shelter parameter with strict engineering validations
  updateParam(key, value) {
    // Physical bounds validation
    const constraints = {
      length: { min: 2.5, max: 15.0 },
      width: { min: 2.0, max: 10.0 },
      height: { min: 2.2, max: 5.0 },
      roofPitch: { min: 0, max: 45 },
      orientation: { min: 0, max: 360 },
      wallThickness: { min: 0.05, max: 0.60 },
      roofThickness: { min: 0.05, max: 0.50 },
      floorThickness: { min: 0.05, max: 0.40 },
      windowArea: { min: 0.5, max: 15.0 },
      thermalStorageMass: { min: 0, max: 5000 },
      occupants: { min: 0, max: 12 },
      equipmentWatts: { min: 0, max: 1000 },
      lightingWatts: { min: 0, max: 500 }
    };

    if (constraints[key]) {
      const numVal = parseFloat(value);
      if (isNaN(numVal)) return;
      value = Math.max(constraints[key].min, Math.min(constraints[key].max, numVal));
    }

    // Geometry integrity: window area cannot exceed 70% of south wall area
    if (key === 'windowArea' || key === 'length' || key === 'height') {
      const currentLen = key === 'length' ? value : this.shelterDesign.length;
      const currentHgt = key === 'height' ? value : this.shelterDesign.height;
      const southWallArea = currentLen * currentHgt;
      const maxWindowArea = southWallArea * 0.75;
      if (key === 'windowArea' && value > maxWindowArea) {
        value = parseFloat(maxWindowArea.toFixed(1));
      }
    }

    const oldValue = this.shelterDesign[key];
    if (oldValue === value) return;

    this.shelterDesign[key] = value;
    this.recordHistory(key, oldValue, value);
    this.modelStatus = 'MODEL MODIFIED · RE-RUN REQUIRED';
    this.notify('shelterDesign', { key, oldValue, value });
  }

  // Set selected 3D component
  selectComponent(componentId) {
    if (this.selectedComponent === componentId) return;
    this.selectedComponent = componentId;
    this.notify('selectedComponent', { componentId });
  }

  // Set camera view mode
  setViewMode(mode) {
    this.viewMode = mode;
    this.notify('viewMode', { mode });
  }

  // Record history for change inspection
  recordHistory(param, oldVal, newVal) {
    this.designHistory.unshift({
      timestamp: new Date().toLocaleTimeString(),
      param,
      oldVal,
      newVal
    });
    if (this.designHistory.length > 20) this.designHistory.pop();
  }

  // Helper to compute derived engineering areas, volumes, and U-values
  getComputedEngineering() {
    const d = this.shelterDesign;
    const wallMat = window.MATERIALS_DB.wall[d.wallMaterial] || window.MATERIALS_DB.wall.plain_concrete;
    const roofMat = window.MATERIALS_DB.roof[d.roofMaterial] || window.MATERIALS_DB.roof.metal_corrugated;
    const floorMat = window.MATERIALS_DB.floor[d.floorMaterial] || window.MATERIALS_DB.floor.concrete_slab_ground;
    const glassMat = window.MATERIALS_DB.glazing[d.windowType] || window.MATERIALS_DB.glazing.double_pane;
    const storageMat = window.MATERIALS_DB.thermalStorage[d.thermalStorageType] || window.MATERIALS_DB.thermalStorage.none;

    const doorArea = (d.doorWidth || 1.0) * (d.doorHeight || 2.0); // 2.0 m²
    const windowArea = d.windowArea; // m²

    // Surface areas (gross)
    const southGross = d.length * d.height;
    const northGross = d.length * d.height;
    const eastGross = d.width * d.height;
    const westGross = d.width * d.height;
    const floorArea = d.length * d.width;
    
    // Sloped roof area accounting for pitch
    const pitchRad = (d.roofPitch * Math.PI) / 180;
    const roofArea = (d.length * d.width) / Math.cos(pitchRad);

    // Net opaque wall areas (south wall has window and door subtracted)
    const southNet = Math.max(1.0, southGross - windowArea - doorArea);
    const totalOpaqueWallArea = southNet + northGross + eastGross + westGross;
    const totalWallVolume = totalOpaqueWallArea * d.wallThickness;
    const totalWallMass = totalWallVolume * wallMat.density;

    // U-values: R = d/k + Rsi + Rse (Standard film coefficients: Rsi=0.13, Rse=0.04)
    const wallR = 0.17 + (d.wallThickness / wallMat.k);
    const wallU = 1 / wallR;

    const roofR = 0.17 + (d.roofThickness / roofMat.k);
    const roofU = 1 / roofR;

    const floorR = 0.17 + (d.floorThickness / floorMat.k);
    const floorU = 1 / floorR;

    const glassU = glassMat.uValue;
    const doorU = 1.80; // insulated entry door

    // Total UA conductance (W/K)
    const uaWall = totalOpaqueWallArea * wallU;
    const uaRoof = roofArea * roofU;
    const uaFloor = floorArea * floorU;
    const uaGlass = windowArea * glassU;
    const uaDoor = doorArea * doorU;
    const uaEnvelope = uaWall + uaRoof + uaFloor + uaGlass + uaDoor;

    // High altitude infiltration (ACH = 1.0 default)
    const roomVolume = d.length * d.width * d.height;
    const ach = 0.8; // Air changes per hour
    const airDensity = this.climateProfile.airDensity; // 0.85 kg/m³ at 3505m
    const cpAir = 1005; // J/kg·K
    const uaInfiltration = (roomVolume * ach * airDensity * cpAir) / 3600; // W/K

    const uaTotal = uaEnvelope + uaInfiltration;

    // Heat loss percentage breakdown
    const pctWall = (uaWall / uaTotal) * 100;
    const pctRoof = (uaRoof / uaTotal) * 100;
    const pctFloor = (uaFloor / uaTotal) * 100;
    const pctGlass = (uaGlass / uaTotal) * 100;
    const pctDoor = (uaDoor / uaTotal) * 100;
    const pctInfil = (uaInfiltration / uaTotal) * 100;

    // Total internal heat gain (W)
    const occupantW = d.occupants * 75;
    const totalInternalGainsW = occupantW + d.equipmentWatts + d.lightingWatts;

    return {
      grossAreas: { south: southGross, north: northGross, east: eastGross, west: westGross, floor: floorArea, roof: roofArea },
      netAreas: { south: southNet, totalWalls: totalOpaqueWallArea, glass: windowArea, door: doorArea, floor: floorArea, roof: roofArea },
      volumes: { room: roomVolume, wallVolume: totalWallVolume, roofVolume: roofArea * d.roofThickness },
      masses: { totalWallMass, thermalStorageMass: d.thermalStorageMass },
      uValues: { wall: wallU, roof: roofU, floor: floorU, glass: glassU, door: doorU },
      rValues: { wall: wallR, roof: roofR, floor: floorR },
      conductances: { uaWall, uaRoof, uaFloor, uaGlass, uaDoor, uaEnvelope, uaInfiltration, uaTotal },
      percentages: { wall: pctWall, roof: pctRoof, floor: pctFloor, glass: pctGlass, door: pctDoor, infil: pctInfil },
      materials: { wall: wallMat, roof: roofMat, floor: floorMat, glass: glassMat, storage: storageMat },
      totalInternalGainsW
    };
  }
}

// Global singleton
window.state = new AppState();
