'use strict';

class HudTime {
  constructor() {
    this.el = document.getElementById('hud-time');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'hud-time';
      this.el.className = 'hud-stat';
      const hudTop = document.getElementById('hud-top');
      if (hudTop) hudTop.appendChild(this.el);
    }
  }

  setText(text) {
    if (this.el) this.el.textContent = text;
  }
}
