'use strict';

class OrientationGuard {
  constructor() {
    this.enabled = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    this.el = null;

    if (!this.enabled) return;

    this._ensureUI();
    this._bind();
    this.update();
  }

  _ensureUI() {
    let el = document.getElementById('orientation-guard');
    if (!el) {
      el = document.createElement('div');
      el.id = 'orientation-guard';
      el.innerHTML = `
        <div class="og-box">
          <div class="og-title">Rotate your device</div>
          <div class="og-desc">Please hold your phone in landscape to play.</div>
          <div class="og-hint">(This game is designed for wide view)</div>
        </div>
      `;
      document.body.appendChild(el);
    }
    this.el = el;
  }

  _bind() {
    window.addEventListener('resize', () => this.update());
    window.addEventListener('orientationchange', () => this.update());
  }

  update() {
    if (!this.el) return;
    const isPortrait = window.innerHeight > window.innerWidth;
    this.el.classList.toggle('hidden', !isPortrait);
  }
}
