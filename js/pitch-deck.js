/**
 * SOLARTHERM SIH26051 - SIH Pitch Presentation Mode
 * Interactive hackathon presentation deck designed specifically for Smart India Hackathon judges.
 */

class PitchDeckUI {
  constructor() {
    this.currentSlide = 1;
    this.totalSlides = 5;
    this.overlay = document.getElementById('pitchDeckModal');

    this.initEventListeners();
  }

  initEventListeners() {
    const pitchBtn = document.getElementById('btnOpenPitchMode');
    if (pitchBtn) {
      pitchBtn.addEventListener('click', () => this.openPitchMode());
    }

    const closeBtn = document.getElementById('btnClosePitchMode');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePitchMode());
    }

    const nextBtn = document.getElementById('btnPitchNext');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextSlide());
    }

    const prevBtn = document.getElementById('btnPitchPrev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevSlide());
    }

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.overlay || this.overlay.style.display !== 'flex') return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        this.nextSlide();
      } else if (e.key === 'ArrowLeft') {
        this.prevSlide();
      } else if (e.key === 'Escape') {
        this.closePitchMode();
      }
    });

    // Jump to live feature buttons in slides
    document.querySelectorAll('.pitch-jump-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.targetTab;
        this.closePitchMode();
        const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
        if (tabBtn) tabBtn.click();
      });
    });
  }

  openPitchMode() {
    if (!this.overlay) return;
    this.overlay.style.display = 'flex';
    this.currentSlide = 1;
    this.renderSlide();
  }

  closePitchMode() {
    if (!this.overlay) return;
    this.overlay.style.display = 'none';
  }

  nextSlide() {
    if (this.currentSlide < this.totalSlides) {
      this.currentSlide++;
      this.renderSlide();
    }
  }

  prevSlide() {
    if (this.currentSlide > 1) {
      this.currentSlide--;
      this.renderSlide();
    }
  }

  renderSlide() {
    document.querySelectorAll('.pitch-slide').forEach(slide => {
      slide.classList.remove('active');
    });

    const activeEl = document.getElementById(`pitchSlide${this.currentSlide}`);
    if (activeEl) {
      activeEl.classList.add('active');
    }

    const counter = document.getElementById('pitchSlideCounter');
    if (counter) {
      counter.textContent = `${this.currentSlide} / ${this.totalSlides}`;
    }

    const prevBtn = document.getElementById('btnPitchPrev');
    const nextBtn = document.getElementById('btnPitchNext');
    if (prevBtn) prevBtn.disabled = this.currentSlide === 1;
    if (nextBtn) {
      nextBtn.textContent = this.currentSlide === this.totalSlides ? 'Finish Presentation' : 'Next Slide →';
      if (this.currentSlide === this.totalSlides) {
        nextBtn.onclick = () => this.closePitchMode();
      } else {
        nextBtn.onclick = () => this.nextSlide();
      }
    }
  }
}

// Global initialization
window.PitchDeckUI = PitchDeckUI;
