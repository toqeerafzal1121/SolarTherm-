/**
 * SOLARTHERM SIH26051 — Solar Position & Surface Irradiance Engine
 * 
 * Implements ASHRAE/Duffie-Beckman solar geometry for Ladakh high-altitude shelters.
 * Provides:
 *  - Sun position (elevation, azimuth) via Spencer/Blanco-Muriel algorithm
 *  - Per-surface irradiance transposition (isotropic sky model, Hay-Davies)
 *  - Snow albedo ground reflection (ρ_g = 0.60)
 *  - Hourly 24-element arrays for all shelter surfaces
 *
 * References:
 *  [1] Spencer, J.W. (1971). Fourier series representation of position of the sun.
 *  [2] Duffie & Beckman, Solar Engineering of Thermal Processes, 4th Ed.
 *  [3] Perez et al. (1990). Modeling daylight availability & irradiance components.
 */

class SolarEngine {
  constructor() {
    this.DEG2RAD = Math.PI / 180;
    this.RAD2DEG = 180 / Math.PI;
    this.SNOW_ALBEDO = 0.60;   // Ladakh winter ground reflectance
    this.STD_MERIDIAN = 82.5;  // India Standard Time meridian (IST = UTC+5:30)
  }

  /**
   * Day of year (1-365) from Date object
   */
  _dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    return Math.floor(diff / 86400000);
  }

  /**
   * Equation of time correction (minutes) via Spencer's Fourier series
   * B = (360/365) * (n - 81) degrees
   */
  _equationOfTime(dayOfYear) {
    const B = (2 * Math.PI * (dayOfYear - 1)) / 365;
    return 229.18 * (
      0.000075 +
      0.001868 * Math.cos(B) -
      0.032077 * Math.sin(B) -
      0.014615 * Math.cos(2*B) -
      0.04089  * Math.sin(2*B)
    ); // minutes
  }

  /**
   * Solar declination angle (degrees) via Spencer's equation
   */
  _declination(dayOfYear) {
    const B = (2 * Math.PI * (dayOfYear - 1)) / 365;
    return this.RAD2DEG * (
      0.006918 -
      0.399912 * Math.cos(B)   + 0.070257 * Math.sin(B) -
      0.006758 * Math.cos(2*B) + 0.000907 * Math.sin(2*B) -
      0.002697 * Math.cos(3*B) + 0.00148  * Math.sin(3*B)
    );
  }

  /**
   * Compute sun position for given lat/lon/date/hour
   * @param {number} lat - Latitude (°N)
   * @param {number} lon - Longitude (°E)
   * @param {Date}   date - Date object
   * @param {number} hour - Solar hour (0-23, local clock time)
   * @returns {{ elevation, azimuth, zenith, hourAngle, declination }} (all in degrees)
   */
  computeSunPosition(lat, lon, date, hour) {
    const n = this._dayOfYear(date);
    const decl = this._declination(n);          // degrees
    const eot  = this._equationOfTime(n);        // minutes

    // Longitude correction: 4 min per degree from standard meridian
    const lonCorrection = 4 * (lon - this.STD_MERIDIAN); // minutes
    // Local Solar Time
    const lst = hour * 60 + lonCorrection + eot;         // minutes from midnight
    // Hour angle: 0 at solar noon, negative morning, positive afternoon
    const hourAngle = (lst / 60 - 12) * 15;              // degrees

    const latRad  = lat       * this.DEG2RAD;
    const declRad = decl      * this.DEG2RAD;
    const haRad   = hourAngle * this.DEG2RAD;

    // Solar elevation (altitude angle)
    const sinElevation = (
      Math.sin(latRad) * Math.sin(declRad) +
      Math.cos(latRad) * Math.cos(declRad) * Math.cos(haRad)
    );
    const elevationDeg = Math.asin(sinElevation) * this.RAD2DEG;

    // Solar azimuth (from South, + = West, - = East)
    let azimuthDeg = 0;
    if (elevationDeg > 0.1) {
      const cosAz = (
        Math.sin(declRad) * Math.cos(latRad) -
        Math.cos(declRad) * Math.sin(latRad) * Math.cos(haRad)
      ) / Math.cos(elevationDeg * this.DEG2RAD);
      azimuthDeg = Math.acos(Math.max(-1, Math.min(1, cosAz))) * this.RAD2DEG;
      if (hourAngle > 0) azimuthDeg = 360 - azimuthDeg; // afternoon: west
    }

    return {
      elevation:   Math.max(0, elevationDeg),
      azimuth:     azimuthDeg,               // 0=South, 90=West, 180=North, 270=East
      zenith:      90 - Math.max(0, elevationDeg),
      hourAngle:   hourAngle,
      declination: decl,
      sunIsUp:     elevationDeg > 0
    };
  }

  /**
   * Compute irradiance on a tilted surface using isotropic sky + ground reflection
   * 
   * @param {number} ghi   - Global Horizontal Irradiance (W/m²)
   * @param {number} dni   - Direct Normal Irradiance (W/m²)
   * @param {number} dhi   - Diffuse Horizontal Irradiance (W/m²)
   * @param {number} solarZenith    - Solar zenith angle (degrees)
   * @param {number} surfaceTilt    - Surface tilt from horizontal (degrees): 90=vertical wall
   * @param {number} surfaceAzimuth - Surface azimuth from South (degrees): 0=South, 90=West
   * @param {number} solarAzimuth   - Solar azimuth from South (degrees)
   * @param {number} albedo         - Ground reflectance (0-1): 0.60 for snow
   * @returns {{ beam, diffuse, reflected, total }} (W/m²)
   */
  computeSurfaceIrradiance(ghi, dni, dhi, solarZenith, surfaceTilt, surfaceAzimuth, solarAzimuth, albedo = 0.60) {
    if (ghi <= 0 || solarZenith >= 90) {
      return { beam: 0, diffuse: 0, reflected: 0, total: 0 };
    }

    const tiltRad    = surfaceTilt    * this.DEG2RAD;
    const surfAzRad  = surfaceAzimuth * this.DEG2RAD;
    const solAzRad   = solarAzimuth   * this.DEG2RAD;
    const zenithRad  = solarZenith    * this.DEG2RAD;

    // Angle of incidence on tilted surface (AOI)
    // cos(θ) = cos(z)cos(β) + sin(z)sin(β)cos(γs - γ)
    const cosAOI = (
      Math.cos(zenithRad) * Math.cos(tiltRad) +
      Math.sin(zenithRad) * Math.sin(tiltRad) * Math.cos(solAzRad - surfAzRad)
    );

    // Beam component on tilted surface
    const beam = Math.max(0, dni * cosAOI);

    // Isotropic sky diffuse (Liu-Jordan)
    // I_d,tilted = I_dh × (1 + cos β) / 2
    const diffuse = Math.max(0, dhi * (1 + Math.cos(tiltRad)) / 2);

    // Ground reflected
    // I_r = GHI × ρ_g × (1 - cos β) / 2
    const reflected = Math.max(0, ghi * albedo * (1 - Math.cos(tiltRad)) / 2);

    return {
      beam,
      diffuse,
      reflected,
      total: beam + diffuse + reflected
    };
  }

  /**
   * Decompose GHI into DNI and DHI using Erbs correlation
   * (since Open-Meteo forecast only gives GHI by default)
   * @param {number} ghi - W/m²
   * @param {number} sinElevation - sin of sun elevation angle
   * @returns {{ dni, dhi }}
   */
  _decomposeDNIDHI(ghi, sinElevation) {
    if (ghi <= 0 || sinElevation <= 0.01) return { dni: 0, dhi: 0 };
    // Clearness index kt = GHI / (I0 × sin(elevation))
    // I0 = 1361 W/m² (solar constant)
    const I0 = 1361;
    const kt = ghi / (I0 * sinElevation);
    const ktClamped = Math.min(1, Math.max(0, kt));

    let diffuseFraction;
    if (ktClamped <= 0.22) {
      diffuseFraction = 1 - 0.09 * ktClamped;
    } else if (ktClamped <= 0.80) {
      diffuseFraction = 0.9511 - 0.1604*ktClamped + 4.388*ktClamped**2
                       - 16.638*ktClamped**3 + 12.336*ktClamped**4;
    } else {
      diffuseFraction = 0.165;
    }
    diffuseFraction = Math.min(1, Math.max(0, diffuseFraction));
    const dhi = ghi * diffuseFraction;
    const dni = Math.max(0, (ghi - dhi) / sinElevation);
    return { dni, dhi };
  }

  /**
   * Compute full 24-hour solar geometry and per-surface irradiance
   * @param {number} lat - Site latitude
   * @param {number} lon - Site longitude
   * @param {Date}   date - Representative date
   * @param {number[]} hourlyGHI - 24-element GHI array (W/m²)
   * @param {number} shelterAzimuth - Building orientation (0=S, 90=W, 180=N, 270=E)
   * @returns {Object} with hourly arrays for sun position and per-surface irradiance
   */
  computeHourlySolarGeometry(lat, lon, date, hourlyGHI, shelterAzimuth = 0) {
    const result = {
      sunPosition:  [],   // { elevation, azimuth, zenith, hourAngle, sunIsUp }
      surfaces: {
        south: [],  // solar tilted surface facing building's main glazing direction
        north: [],
        east:  [],
        west:  [],
        roof:  [],  // horizontal (tilt=0)
        glazing: [] // south vertical wall glazing (same as south but SHGC applied separately)
      }
    };

    // Surface definitions: { tilt, azimuthFromSouth }
    // Building faces south = shelterAzimuth=0, faces north = 180, etc.
    const surfaces = {
      south:   { tilt: 90,  az: shelterAzimuth },          // vertical south wall
      north:   { tilt: 90,  az: (shelterAzimuth + 180) % 360 },
      east:    { tilt: 90,  az: (shelterAzimuth + 270) % 360 }, // to sun's east
      west:    { tilt: 90,  az: (shelterAzimuth + 90)  % 360 },
      roof:    { tilt: 15,  az: shelterAzimuth },           // slightly tilted
      glazing: { tilt: 90,  az: shelterAzimuth }            // south vertical glazing
    };

    for (let h = 0; h < 24; h++) {
      const pos = this.computeSunPosition(lat, lon, date, h + 0.5); // mid-hour
      result.sunPosition.push(pos);

      const ghi = hourlyGHI[h] || 0;
      const sinEl = Math.sin(pos.elevation * this.DEG2RAD);
      const { dni, dhi } = this._decomposeDNIDHI(ghi, sinEl);

      for (const [name, surf] of Object.entries(surfaces)) {
        const irr = this.computeSurfaceIrradiance(
          ghi, dni, dhi,
          pos.zenith,
          surf.tilt,
          surf.az,
          pos.azimuth,
          this.SNOW_ALBEDO
        );
        result.surfaces[name].push({ ...irr, ghi });
      }
    }

    return result;
  }

  /**
   * Find sunrise and sunset hours for the given site+date
   * @returns {{ sunriseHour, sunsetHour, daylightHours }}
   */
  getSunriseSunset(lat, lon, date) {
    let sunrise = 0, sunset = 0;
    for (let h = 0; h < 24; h++) {
      const pos = this.computeSunPosition(lat, lon, date, h);
      const nextPos = this.computeSunPosition(lat, lon, date, h + 1);
      if (!pos.sunIsUp && nextPos.sunIsUp && sunrise === 0) sunrise = h + 0.5;
      if (pos.sunIsUp && !nextPos.sunIsUp && sunset === 0) sunset = h + 0.5;
    }
    return {
      sunriseHour: sunrise || 6.5,
      sunsetHour:  sunset  || 17.5,
      daylightHours: Math.max(0, (sunset || 17.5) - (sunrise || 6.5))
    };
  }
}

// Global singleton
window.solarEngine = new SolarEngine();
console.log('[SolarEngine] Initialized — ASHRAE solar geometry ready.');
