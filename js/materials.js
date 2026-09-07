/**
 * SOLARTHERM SIH26051 - Materials Database
 * Verified physical engineering properties for high-altitude cold climate shelter design.
 * Units:
 *  - Thermal Conductivity (k): W/m·K
 *  - Density (rho): kg/m³
 *  - Specific Heat (Cp): J/kg·K
 *  - Latent Heat: J/kg
 *  - U-value: W/m²·K
 *  - R-value: m²·K/W
 */

const MATERIALS_DB = {
  wall: {
    plain_concrete: {
      id: 'plain_concrete',
      name: 'Plain Concrete (PBC)',
      subtitle: 'Structural wall with internal finish',
      k: 1.70,
      density: 2400,
      cp: 880,
      defaultThickness: 0.20,
      color: '#64748b',
      textureStyle: 'concrete',
      embodiedCarbon: 320, // kg CO2e/m³
      costPerM3: 4500, // INR/m³
      provenance: 'IS 456 / ASHRAE Handbook of Fundamentals',
      warning: 'High conductive loss (U > 5 W/m²K). Recommend continuous external insulation.'
    },
    rammed_earth: {
      id: 'rammed_earth',
      name: 'Rammed Earth / Adobe Block',
      subtitle: 'Traditional Ladakhi vernacular earth composite',
      k: 0.85,
      density: 1950,
      cp: 980,
      defaultThickness: 0.35,
      color: '#a37152',
      textureStyle: 'earth',
      embodiedCarbon: 45,
      costPerM3: 2200,
      provenance: 'Ladakh Ecological Development Group (LEDeG) Field Data',
      warning: 'Moderate thermal mass, requires exterior moisture protection and perimeter insulation.'
    },
    puf_composite: {
      id: 'puf_composite',
      name: 'PUF Insulated Composite Panel',
      subtitle: 'Rigid Polyurethane core between structural skins',
      k: 0.024,
      density: 45,
      cp: 1450,
      defaultThickness: 0.15,
      color: '#38bdf8',
      textureStyle: 'composite',
      embodiedCarbon: 180,
      costPerM3: 9800,
      provenance: 'ISO 10456 / Indian Bureau of Energy Efficiency (BEE)',
      warning: null
    },
    stone_masonry_xps: {
      id: 'stone_masonry_xps',
      name: 'Granite Stone + 100mm XPS',
      subtitle: 'Heavy local stone with exterior thermal envelope',
      k: 0.038, // effective composite
      density: 2150,
      cp: 920,
      defaultThickness: 0.30,
      color: '#94a3b8',
      textureStyle: 'stone',
      embodiedCarbon: 120,
      costPerM3: 5600,
      provenance: 'CPWD High Altitude Building Standards',
      warning: null
    },
    aac_block: {
      id: 'aac_block',
      name: 'Autoclaved Aerated Concrete (AAC)',
      subtitle: 'Lightweight cellular concrete masonry',
      k: 0.16,
      density: 650,
      cp: 1050,
      defaultThickness: 0.20,
      color: '#cbd5e1',
      textureStyle: 'aac',
      embodiedCarbon: 110,
      costPerM3: 3800,
      provenance: 'IS 2185 Part 3',
      warning: 'Moderate thermal resistance; requires supplementary insulation at -20°C ambient.'
    },
    sip_timber: {
      id: 'sip_timber',
      name: 'Timber Frame + 150mm Rockwool',
      subtitle: 'Engineered wood cassette with high vapor permeability',
      k: 0.038,
      density: 160,
      cp: 1550,
      defaultThickness: 0.18,
      color: '#b45309',
      textureStyle: 'timber',
      embodiedCarbon: 65,
      costPerM3: 8200,
      provenance: 'DIN 4108-4 / Passive House High Altitude Database',
      warning: null
    }
  },

  roof: {
    metal_corrugated: {
      id: 'metal_corrugated',
      name: 'Metal Corrugated Sheet + 150mm PUF',
      subtitle: 'Pre-insulated sandwich roofing panels',
      k: 0.025,
      density: 50,
      cp: 1300,
      defaultThickness: 0.15,
      color: '#475569',
      provenance: 'Standard High-Altitude Prefab Specification',
      warning: null
    },
    timber_deck_rockwool: {
      id: 'timber_deck_rockwool',
      name: 'Timber Deck + 200mm Rockwool',
      subtitle: 'Vented cold roof assembly with breathable membrane',
      k: 0.036,
      density: 120,
      cp: 1400,
      defaultThickness: 0.20,
      color: '#78350f',
      provenance: 'LEDeG Solar Architecture Guidelines',
      warning: null
    },
    insulated_soil_turf: {
      id: 'insulated_soil_turf',
      name: 'Earth Turf + 120mm Aerogel/XPS',
      subtitle: 'Vernacular Ladakhi inverted protected membrane roof',
      k: 0.045,
      density: 1350,
      cp: 1250,
      defaultThickness: 0.28,
      color: '#713f12',
      provenance: 'Ladakh High-Altitude Research Station',
      warning: null
    }
  },

  floor: {
    concrete_slab_ground: {
      id: 'concrete_slab_ground',
      name: 'Concrete Slab on Ground (Uninsulated)',
      subtitle: 'Standard 100mm reinforced slab directly over subgrade',
      k: 1.40,
      density: 2300,
      cp: 900,
      defaultThickness: 0.10,
      color: '#334155',
      provenance: 'IS 456 Specification',
      warning: 'Permafrost coupling risk: Severe conductive floor cooling (-15°C perimeter sink).'
    },
    insulated_aerogel_floor: {
      id: 'insulated_aerogel_floor',
      name: 'Concrete Slab + 100mm XPS Thermal Break',
      subtitle: 'Suspended perimeter slab insulated from frozen sub-base',
      k: 0.034,
      density: 520,
      cp: 1100,
      defaultThickness: 0.14,
      color: '#0284c7',
      provenance: 'Passive House Institute Cold Climate Standard',
      warning: null
    }
  },

  glazing: {
    single_clear: {
      id: 'single_clear',
      name: 'Single Pane Float Glass (4mm)',
      uValue: 5.80,
      shgc: 0.82,
      vt: 0.88,
      provenance: 'ASHRAE 90.1 Table A8.1',
      warning: 'Severe night-time radiant & conductive loss. Condensation and interior frost guaranteed.'
    },
    double_pane: {
      id: 'double_pane',
      name: 'Double Pane Clear (4-12-4 Air)',
      uValue: 2.80,
      shgc: 0.72,
      vt: 0.78,
      provenance: 'IS 16231 Indian Glass Standard',
      warning: 'Sub-optimal for Ladakh winters. Night-time U-value allows major heat loss.'
    },
    double_low_e: {
      id: 'double_low_e',
      name: 'Double Low-E Argon (4-16-4 Argon)',
      uValue: 1.35,
      shgc: 0.62,
      vt: 0.72,
      provenance: 'NFRC 100-2020 Certified',
      warning: null
    },
    triple_low_e: {
      id: 'triple_low_e',
      name: 'Triple Low-E Krypton (4-14-4-14-4)',
      uValue: 0.75,
      shgc: 0.52,
      vt: 0.64,
      provenance: 'Passivhaus Arctic Database',
      warning: null
    },
    vacuum_insulated: {
      id: 'vacuum_insulated',
      name: 'Vacuum Insulated Glazing (VIG 8.3mm)',
      uValue: 0.55,
      shgc: 0.58,
      vt: 0.70,
      provenance: 'Fineo / Pilkington High-Performance Glazing Specs',
      warning: null
    }
  },

  thermalStorage: {
    none: {
      id: 'none',
      type: 'None',
      name: 'None (Direct Air Heating Only)',
      description: 'Air temperature fluctuates rapidly with solar cycles; poor overnight retention.',
      cp: 1005, // air J/kgK
      density: 0.85,
      latentHeat: 0,
      phaseTemp: null
    },
    water_thermal_mass: {
      id: 'water_thermal_mass',
      type: 'Water Thermal Mass',
      name: 'Water Thermal Storage Drums',
      description: 'Direct solar-absorbing black water cylinders behind south glazing.',
      cp: 4184, // J/kg·K
      density: 1000,
      latentHeat: 0,
      phaseTemp: null,
      provenance: 'Steve Baer Drum Wall Benchmark'
    },
    concrete_trombe: {
      id: 'concrete_trombe',
      type: 'Concrete Trombe Mass',
      name: 'High-Density Concrete Trombe Mass',
      description: 'Solid 200mm high-absorptivity wall storing sensible solar heat.',
      cp: 920,
      density: 2400,
      latentHeat: 0,
      phaseTemp: null,
      provenance: 'Felix Trombe Passive Solar Principles'
    },
    bio_pcm_21: {
      id: 'bio_pcm_21',
      type: 'Bio-Based PCM (21°C)',
      name: 'Bio-Based Phase Change Material (Bio-PCM)',
      description: 'Plant-derived organic ester with isothermal phase transition at 21°C.',
      cp: 2200, // average sensible
      density: 860,
      latentHeat: 185000, // 185 kJ/kg
      phaseTemp: 21.0,
      provenance: 'Phase Change Energy Solutions Technical Datasheet'
    },
    inorganic_salt_23: {
      id: 'inorganic_salt_23',
      type: 'Salt Hydrate PCM (23°C)',
      name: 'Inorganic Salt Hydrate Latent Storage',
      description: 'Eutectic salt solution: high latent heat density, non-combustible.',
      cp: 1950,
      density: 1480,
      latentHeat: 215000, // 215 kJ/kg
      phaseTemp: 23.0,
      provenance: 'Rubitherm SP23 Technical Data'
    }
  }
};

// Export to global scope
window.MATERIALS_DB = MATERIALS_DB;
