/**
 * SOLARTHERM SIH26051 — Global Simulation Clock
 *
 * Singleton controller managing the shared 24-hour timeline state.
 * Connects 3D sun position, chart cursors, forecast card highlighting,
 * and inspector panels through a single source of truth.
 *
 * Features:
 *  - seek(hour), play(), pause(), reset(), setSpeed(x)
 *  - Broadcasts 'clockTick' to all subscribers
 *  - Renders the Global Timeline Bar in the nav strip
 *  - Supports playback speeds: 1×, 5×, 30×, 60×
 */

class SimulationClock {
  constructor() {
    this.currentHour     = 6.0;    // Start at 06:00
    this.isPlaying       = false;
    this.speed           = 1.0;    // hours per second
    this._rafId          = null;
    this._lastTimestamp  = null;
    this._subscribers    = new Set();
    this._sunriseHour    = 6.5;
    this._sunsetHour     = 17.5;

    this._initTimelineBar();
  }

  // -------------------------------------------------------
  // Subscriber API
  // -------------------------------------------------------
  subscribe(fn) {
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  _broadcast() {
    this._subscribers.forEach(fn => {
      try { fn(this.currentHour, this); }
      catch(e) { /* isolate subscriber errors */ }
    });
    this._updateTimelineUI();
  }

  // -------------------------------------------------------
  // Playback Controls
  // -------------------------------------------------------
  seek(hour) {
    this.currentHour = Math.max(0, Math.min(23.99, parseFloat(hour)));
    this._broadcast();
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this._lastTimestamp = null;
    this._rafId = requestAnimationFrame(this._tick.bind(this));
    this._updateButtons();
  }

  pause() {
    this.isPlaying = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
    this._updateButtons();
  }

  toggle() {
    this.isPlaying ? this.pause() : this.play();
  }

  reset() {
    this.pause();
    this.seek(6.0);
  }

  setSpeed(multiplier) {
    this.speed = parseFloat(multiplier);
    const btns = document.querySelectorAll('.timeline-speed-btn');
    btns.forEach(b => b.classList.toggle('active', parseFloat(b.dataset.speed) === this.speed));
  }

  // Animation frame ticker
  _tick(timestamp) {
    if (!this._lastTimestamp) this._lastTimestamp = timestamp;
    const dt = (timestamp - this._lastTimestamp) / 1000; // seconds
    this._lastTimestamp = timestamp;

    this.currentHour += dt * this.speed;
    if (this.currentHour >= 24) {
      this.currentHour = 0;
    }

    this._broadcast();
    if (this.isPlaying) {
      this._rafId = requestAnimationFrame(this._tick.bind(this));
    }
  }

  // -------------------------------------------------------
  // Set sunrise/sunset from solar engine data
  // -------------------------------------------------------
  setSunriseSunset(sunriseHour, sunsetHour) {
    this._sunriseHour = sunriseHour;
    this._sunsetHour  = sunsetHour;
    this._updateTimelineUI();
  }

  // -------------------------------------------------------
  // Formatted time string
  // -------------------------------------------------------
  getFormattedTime() {
    const h = Math.floor(this.currentHour);
    const m = Math.floor((this.currentHour - h) * 60);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }

  isDaytime() {
    return this.currentHour >= this._sunriseHour && this.currentHour <= this._sunsetHour;
  }

  // -------------------------------------------------------
  // Timeline Bar UI
  // -------------------------------------------------------
  _initTimelineBar() {
    const bar = document.getElementById('globalTimelineBar');
    if (!bar) return;

    bar.innerHTML = `
      <div class="timeline-left">
        <button class="timeline-btn" id="tlBtnReset" data-tooltip="Reset to 06:00" title="Reset">⏮</button>
        <button class="timeline-btn timeline-play-btn" id="tlBtnPlay" data-tooltip="Play timeline" title="Play/Pause">▶</button>
        <div class="timeline-clock" id="tlClock">
          <span class="tl-clock-icon" id="tlDayNightIcon">☀️</span>
          <span class="tl-time-display" id="tlTimeDisplay">06:00</span>
        </div>
      </div>

      <div class="timeline-center">
        <div class="timeline-track-wrap">
          <div class="tl-track-bg" id="tlTrackBg">
            <!-- Night segments -->
            <div class="tl-night-left"  id="tlNightLeft"></div>
            <div class="tl-day-band"    id="tlDayBand"></div>
            <div class="tl-night-right" id="tlNightRight"></div>
            <!-- Sunrise / Sunset markers -->
            <div class="tl-sun-marker tl-sunrise" id="tlSunriseMarker" title="Sunrise">↑☀</div>
            <div class="tl-sun-marker tl-sunset"  id="tlSunsetMarker"  title="Sunset">☀↓</div>
          </div>
          <input type="range" class="timeline-scrubber" id="tlScrubber"
                 min="0" max="2399" step="1" value="600" />
          <div class="tl-thumb-sun" id="tlThumbSun">☀️</div>
        </div>
      </div>

      <div class="timeline-right">
        <div class="tl-speed-group">
          <span class="tl-speed-label">Speed</span>
          <button class="timeline-speed-btn active" data-speed="1">1×</button>
          <button class="timeline-speed-btn" data-speed="5">5×</button>
          <button class="timeline-speed-btn" data-speed="30">30×</button>
          <button class="timeline-speed-btn" data-speed="60">60×</button>
        </div>
        <div class="tl-sim-status" id="tlSimStatus">
          <span class="tl-sim-ver" id="tlDesignVer">DV-001</span>
          <span class="tl-sim-sep">·</span>
          <span class="tl-sim-id"  id="tlSimId">No Simulation</span>
        </div>
      </div>
    `;

    // Bind events
    document.getElementById('tlBtnReset')?.addEventListener('click', () => this.reset());
    document.getElementById('tlBtnPlay')?.addEventListener('click', () => this.toggle());

    const scrubber = document.getElementById('tlScrubber');
    if (scrubber) {
      scrubber.addEventListener('input', (e) => {
        this.pause();
        this.seek(parseInt(e.target.value) / 100);
      });
    }

    document.querySelectorAll('.timeline-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setSpeed(btn.dataset.speed);
        if (!this.isPlaying) this.play();
      });
    });

    this._updateTimelineUI();
  }

  _updateButtons() {
    const btn = document.getElementById('tlBtnPlay');
    if (btn) btn.textContent = this.isPlaying ? '⏸' : '▶';
  }

  _updateTimelineUI() {
    const timeEl   = document.getElementById('tlTimeDisplay');
    const iconEl   = document.getElementById('tlDayNightIcon');
    const scrubber = document.getElementById('tlScrubber');
    const thumbSun = document.getElementById('tlThumbSun');

    if (timeEl) timeEl.textContent = this.getFormattedTime();
    if (iconEl) iconEl.textContent = this.isDaytime() ? '☀️' : '🌙';
    if (scrubber) scrubber.value = Math.round(this.currentHour * 100);

    // Animate sun thumb position along track
    if (thumbSun) {
      const pct = (this.currentHour / 24) * 100;
      thumbSun.style.left = `calc(${pct}% - 10px)`;
      thumbSun.style.opacity = this.isDaytime() ? '1' : '0.35';
    }

    // Day/night bands
    const sr = this._sunriseHour / 24 * 100;
    const ss = this._sunsetHour  / 24 * 100;
    const nightLeft  = document.getElementById('tlNightLeft');
    const dayBand    = document.getElementById('tlDayBand');
    const nightRight = document.getElementById('tlNightRight');
    const srMarker   = document.getElementById('tlSunriseMarker');
    const ssMarker   = document.getElementById('tlSunsetMarker');

    if (nightLeft)  nightLeft.style.width  = `${sr}%`;
    if (dayBand)    { dayBand.style.left = `${sr}%`; dayBand.style.width = `${ss - sr}%`; }
    if (nightRight) { nightRight.style.left = `${ss}%`; nightRight.style.width = `${100-ss}%`; }
    if (srMarker)   srMarker.style.left = `${sr}%`;
    if (ssMarker)   ssMarker.style.left = `${ss}%`;

    // Update version/sim ID from state
    const dvEl = document.getElementById('tlDesignVer');
    const simEl = document.getElementById('tlSimId');
    if (dvEl && window.state) dvEl.textContent = window.state.designVersion || 'DV-001';
    if (simEl && window.state) {
      const res = window.state.simulationResults;
      simEl.textContent = res ? `SIM-${(window.state.simulationIdCounter||1).toString().padStart(3,'0')}` : 'No Simulation';
      simEl.style.color = window.state.simulationOutdated ? 'var(--color-warning)' : 'var(--color-teal-light)';
    }
  }

  /**
   * Must be called after simulation completes to attach forecast data
   */
  attachSimulationResults(results) {
    if (!results) return;
    // Update sunrise/sunset from solar geometry if available
    const sg = window.state?.solarGeometry;
    if (sg) {
      const sr = sg.sunPosition.findIndex(p => p.sunIsUp);
      const ss = sg.sunPosition.map((p,i) => ({ i, up: p.sunIsUp })).filter(x => x.up).pop()?.i;
      if (sr >= 0) this.setSunriseSunset(sr + 0.5, (ss || 17) + 0.5);
    }
    this._broadcast();
  }
}

// Global singleton
window.simulationClock = new SimulationClock();
console.log('[SimulationClock] Initialized — global 24h timeline ready.');
