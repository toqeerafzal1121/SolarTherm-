/**
 * SOLARTHERM SIH26051 - Transient Thermal Modeling Engine
 * Physics-based reduced-order lumped capacitance nodal solver for high-altitude cold climate shelters.
 * 
 * Mathematical Framework:
 * C_eff * d(T_in)/dt = Q_solar + Q_internal - sum(U_i * A_i)*(T_in - T_amb) - Q_infilt - Q_storage
 *
 * Accounts for:
 * - High altitude barometric pressure & air density derating (3505m: P=66.5 kPa, rho=0.85 kg/m³)
 * - Vertical south aperture solar geometry with ground snow reflection (albedo = 0.60)
 * - Apparent heat capacity phase change material (PCM) latent energy storage
 * - Hourly 24-hour transient integration (dt = 300s)
 */

class ThermalEngine {
  constructor() {
    this.timeStepSeconds = 300; // 5 minute numerical time step
  }

  run24HourTransient(shelterDesign, climateProfile) {
    const d = shelterDesign;
    const c = climateProfile;
    const eng = window.state.getComputedEngineering();

    // Altitude air properties
    const elevation = c.elevation || 3505;
    const P_atm = 101.325 * Math.pow(1 - (0.0065 * elevation) / 288.15, 5.255); // kPa
    const rho_air = (P_atm * 1000) / (287.05 * (273.15 + c.designWinterTemp)); // kg/m³ (~0.85 kg/m³)
    const cp_air = 1005; // J/kg·K

    // Air volume & effective thermal capacitance of room air
    const roomVolume = d.length * d.width * d.height;
    const airCapacitance = roomVolume * rho_air * cp_air; // J/K

    // Structural effective capacitance (interior 50mm participation of envelope)
    const structCapacitance = eng.netAreas.totalWalls * 0.05 * eng.materials.wall.density * eng.materials.wall.cp * 0.4;
    const C_room_effective = airCapacitance + structCapacitance;

    // Thermal Storage Medium Capacitance
    const storageMat = eng.materials.storage;
    const m_storage = d.thermalStorageMass; // kg
    let C_storage_sensible = m_storage * (storageMat.cp || 1000); // J/K
    const isPCM = storageMat.latentHeat && storageMat.latentHeat > 0;
    const Tm_pcm = storageMat.phaseTemp || 21.0;
    const dTm = 3.0; // melting window +/- 1.5°C

    // Envelope conductance UA (W/K)
    const UA_envelope = eng.conductances.uaEnvelope;

    // Infiltration conductance UA_inf (W/K)
    const ach = 0.8; // air changes per hour
    const UA_infiltration = (roomVolume * ach * rho_air * cp_air) / 3600;
    const UA_total = UA_envelope + UA_infiltration;

    // Glazing optical properties
    const glassSHGC = eng.materials.glass.shgc || 0.70;
    const southGlassArea = d.windowArea;

    // Internal gains schedule (W)
    const occupantW = d.occupants * 75;
    const baseEquipLightingW = d.equipmentWatts + d.lightingWatts;

    // Simulation arrays
    const hours = Array.from({ length: 25 }, (_, i) => i);
    const timeSeries = {
      hours: [],
      tAmbient: [],
      tIndoor: [],
      tStorage: [],
      qSolarGain: [],
      qEnvelopeLoss: [],
      qInfiltrationLoss: [],
      qStorageHeatFlow: [],
      qAuxiliaryHeating: []
    };

    // Initial boundary conditions
    let T_in = -5.0; // °C starting room temp
    let T_storage = -2.0; // °C storage temp

    // Run 2 warm-up diurnal cycles to achieve steady-periodic condition
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let h = 0; h < 24; h++) {
        const t_amb_hour = c.hourlyAmbient[h];
        const ghi_hour = c.hourlySolarGHI[h];

        // 12 time-steps per hour (dt = 300s)
        for (let step = 0; step < 12; step++) {
          // Solar irradiance on South vertical facade accounting for snow albedo
          // In winter Ladakh (lat 34°N), low sun altitude (~32° noon) gives vertical south surface ~1.35x GHI!
          const verticalFactor = ghi_hour > 0 ? 1.35 : 0;
          const snowReflectionFactor = 0.25; // ground reflection boost
          const I_vertical_south = ghi_hour * (verticalFactor + snowReflectionFactor);

          // Solar heat gain entering shelter (W)
          const Q_solar = southGlassArea * glassSHGC * I_vertical_south;

          // Internal heat gains (W) active primarily 18:00 - 07:00
          const isEveningMorning = h >= 18 || h <= 7;
          const Q_internal = isEveningMorning ? (occupantW + baseEquipLightingW) : (occupantW * 0.3 + 20);

          // Envelope and infiltration heat loss (W)
          const Q_env_loss = UA_envelope * (T_in - t_amb_hour);
          const Q_inf_loss = UA_infiltration * (T_in - t_amb_hour);

          // Thermal Storage Heat Exchange
          // Heat transfer coefficient between room air and storage medium: hA ~ 12 W/K per 100kg
          const hA_storage = Math.max(10, (m_storage / 100) * 14);
          const Q_to_storage = hA_storage * (T_in - T_storage);

          // PCM Apparent Heat Capacity
          let C_storage_eff = C_storage_sensible;
          if (isPCM && Math.abs(T_storage - Tm_pcm) <= dTm / 2) {
            // Apparent heat capacity peak in melting interval
            const C_latent = (m_storage * storageMat.latentHeat) / dTm;
            C_storage_eff += C_latent;
          }

          // Update storage temperature
          const dT_storage = (Q_to_storage * this.timeStepSeconds) / Math.max(1000, C_storage_eff);
          T_storage += dT_storage;

          // Room energy balance: C_eff * dT_in = dt * (Q_solar + Q_int - Q_env - Q_inf - Q_to_storage)
          const netHeatRate = Q_solar + Q_internal - Q_env_loss - Q_inf_loss - Q_to_storage;
          const dT_in = (netHeatRate * this.timeStepSeconds) / C_room_effective;
          T_in += dT_in;

          // Auxiliary heating demand to maintain 18°C comfort threshold (W)
          const T_comfort_set = 18.0;
          let Q_aux = 0;
          if (T_in < T_comfort_set) {
            // Needed heat flux to hold setpoint
            Q_aux = Math.max(0, UA_total * (T_comfort_set - t_amb_hour) - Q_solar - Q_internal);
          }

          // In final cycle, record hourly snapshots at step 0
          if (cycle === 2 && step === 0) {
            timeSeries.hours.push(`${h.toString().padStart(2, '0')}:00`);
            timeSeries.tAmbient.push(parseFloat(t_amb_hour.toFixed(1)));
            timeSeries.tIndoor.push(parseFloat(T_in.toFixed(1)));
            timeSeries.tStorage.push(parseFloat(T_storage.toFixed(1)));
            timeSeries.qSolarGain.push(Math.round(Q_solar));
            timeSeries.qEnvelopeLoss.push(Math.round(Math.max(0, Q_env_loss)));
            timeSeries.qInfiltrationLoss.push(Math.round(Math.max(0, Q_inf_loss)));
            timeSeries.qStorageHeatFlow.push(Math.round(Q_to_storage));
            timeSeries.qAuxiliaryHeating.push(Math.round(Q_aux));
          }
        }
      }
    }

    // Add 24:00 point for complete loop
    timeSeries.hours.push('24:00');
    timeSeries.tAmbient.push(timeSeries.tAmbient[0]);
    timeSeries.tIndoor.push(timeSeries.tIndoor[0]);
    timeSeries.tStorage.push(timeSeries.tStorage[0]);
    timeSeries.qSolarGain.push(0);
    timeSeries.qEnvelopeLoss.push(timeSeries.qEnvelopeLoss[0]);
    timeSeries.qInfiltrationLoss.push(timeSeries.qInfiltrationLoss[0]);
    timeSeries.qStorageHeatFlow.push(timeSeries.qStorageHeatFlow[0]);
    timeSeries.qAuxiliaryHeating.push(timeSeries.qAuxiliaryHeating[0]);

    // Aggregate summary metrics
    const minIndoor = Math.min(...timeSeries.tIndoor);
    const maxIndoor = Math.max(...timeSeries.tIndoor);
    const avgIndoor = parseFloat((timeSeries.tIndoor.reduce((a, b) => a + b, 0) / timeSeries.tIndoor.length).toFixed(1));

    // Daily energy sums (kWh/day)
    const totalSolarKWh = parseFloat((timeSeries.qSolarGain.reduce((a, b) => a + b, 0) / 1000).toFixed(1));
    const totalEnvLossKWh = parseFloat((timeSeries.qEnvelopeLoss.reduce((a, b) => a + b, 0) / 1000).toFixed(1));
    const totalInfLossKWh = parseFloat((timeSeries.qInfiltrationLoss.reduce((a, b) => a + b, 0) / 1000).toFixed(1));
    const totalAuxHeatingKWh = parseFloat((timeSeries.qAuxiliaryHeating.reduce((a, b) => a + b, 0) / 1000).toFixed(1));

    // Conventional uninsulated shelter baseline comparison
    // Standard uninsulated GI tin shed (U~6.5 W/m²K) in Leh requires ~145 kWh/day heating
    const baselineAuxKWh = 142.0;
    const energySavingsPct = Math.max(0, Math.round(((baselineAuxKWh - totalAuxHeatingKWh) / baselineAuxKWh) * 100));
    // Kerosene equivalent: 1 Liter kerosene = ~9.8 kWh thermal
    const keroseneSavedLiters = parseFloat(((baselineAuxKWh - totalAuxHeatingKWh) / 9.8).toFixed(1));

    return {
      timeSeries,
      summary: {
        minIndoor,
        maxIndoor,
        avgIndoor,
        ambientMin: Math.min(...c.hourlyAmbient),
        ambientMax: Math.max(...c.hourlyAmbient),
        totalSolarKWh,
        totalEnvLossKWh,
        totalInfLossKWh,
        totalAuxHeatingKWh,
        energySavingsPct,
        keroseneSavedLiters,
        uaTotal: parseFloat(UA_total.toFixed(1)),
        comfortHours: timeSeries.tIndoor.filter(t => t >= 15.0).length
      }
    };
  }
}

// Global instance
window.thermalEngine = new ThermalEngine();
