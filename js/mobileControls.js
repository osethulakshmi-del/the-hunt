'use strict';

class MobileControls {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;

    this.enabled = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

    this._moveTouchId = null;
    this._moveStart = { x: 0, y: 0 };
    this._moveVec = { x: 0, y: 0 };

    this._aimTouchId = null;

    this._shootHeld = false;
    this._sprintHeld = false;

    this._ui = null;
    this._knob = null;

    this._btnCamp = null;

    if (this.enabled) this._init();
  }

  _init() {
    this._ensureUI();
    this._bindTouch();
  }

  _ensureUI() {
    let root = document.getElementById('mobile-ui');
    if (!root) {
      root = document.createElement('div');
      root.id = 'mobile-ui';
      document.body.appendChild(root);
    }

    root.innerHTML = `
      <div class="m-joy" id="m-joy">
        <div class="m-joy-base"></div>
        <div class="m-joy-knob" id="m-joy-knob"></div>
      </div>
      <div class="m-actions">
        <button class="m-btn" id="m-btn-shoot" aria-label="Shoot">🏹</button>
        <button class="m-btn" id="m-btn-sprint" aria-label="Sprint">🏃</button>
        <button class="m-btn" id="m-btn-camp" aria-label="Camp">⛺</button>
        <button class="m-btn" id="m-btn-pause" aria-label="Pause">⏸</button>
      </div>
    `;

    this._ui = root;
    this._knob = document.getElementById('m-joy-knob');

    const shoot = document.getElementById('m-btn-shoot');
    const sprint = document.getElementById('m-btn-sprint');
    const camp = document.getElementById('m-btn-camp');
    const pause = document.getElementById('m-btn-pause');

    this._btnCamp = camp;

    const press = (el, onDown, onUp) => {
      el.addEventListener('touchstart', e => {
        e.preventDefault();
        onDown();
      }, { passive: false });
      el.addEventListener('touchend', e => {
        e.preventDefault();
        onUp();
      }, { passive: false });
      el.addEventListener('touchcancel', e => {
        e.preventDefault();
        onUp();
      }, { passive: false });
    };

    press(shoot,
      () => { this._shootHeld = true; this.game.mouseDown = true; },
      () => { this._shootHeld = false; this.game.mouseDown = false; }
    );

    press(sprint,
      () => { this._sprintHeld = true; },
      () => { this._sprintHeld = false; }
    );

    camp.addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.game.state === GSTATE.FOREST) this.game._tryReturnToCamp();
    }, { passive: false });

    pause.addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.game.state === GSTATE.FOREST) this.game._pause();
      else if (this.game.state === GSTATE.PAUSED) this.game._resume();
    }, { passive: false });
  }

  _bindTouch() {
    const el = this.canvas;

    el.style.touchAction = 'none';

    el.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
    el.addEventListener('touchmove', e => this._onTouchMove(e), { passive: false });
    el.addEventListener('touchend', e => this._onTouchEnd(e), { passive: false });
    el.addEventListener('touchcancel', e => this._onTouchEnd(e), { passive: false });
  }

  _onTouchStart(e) {
    e.preventDefault();

    for (const t of e.changedTouches) {
      const isLeft = t.clientX < window.innerWidth * 0.5;

      if (isLeft && this._moveTouchId === null) {
        this._moveTouchId = t.identifier;
        this._moveStart.x = t.clientX;
        this._moveStart.y = t.clientY;
        this._moveVec.x = 0;
        this._moveVec.y = 0;
        this._updateKnob();
        continue;
      }

      if (!isLeft && this._aimTouchId === null) {
        this._aimTouchId = t.identifier;
        this.game.mouse.x = t.clientX;
        this.game.mouse.y = t.clientY;
      }
    }
  }

  _onTouchMove(e) {
    e.preventDefault();

    for (const t of e.changedTouches) {
      if (t.identifier === this._moveTouchId) {
        const dx = t.clientX - this._moveStart.x;
        const dy = t.clientY - this._moveStart.y;
        const max = 42;
        const len = Math.hypot(dx, dy) || 1;
        const cl = Math.min(max, len);
        this._moveVec.x = (dx / len) * (cl / max);
        this._moveVec.y = (dy / len) * (cl / max);
        this._updateKnob();
      }
      if (t.identifier === this._aimTouchId) {
        this.game.mouse.x = t.clientX;
        this.game.mouse.y = t.clientY;
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();

    for (const t of e.changedTouches) {
      if (t.identifier === this._moveTouchId) {
        this._moveTouchId = null;
        this._moveVec.x = 0;
        this._moveVec.y = 0;
        this._updateKnob();
      }
      if (t.identifier === this._aimTouchId) {
        this._aimTouchId = null;
      }
    }
  }

  _updateKnob() {
    if (!this._knob) return;
    const x = this._moveVec.x * 28;
    const y = this._moveVec.y * 28;
    this._knob.style.transform = `translate(${x}px, ${y}px)`;
  }

  update() {
    if (!this.enabled) return;

    if (this._ui) {
      this._ui.style.display = (this.game.state === GSTATE.FOREST) ? 'block' : 'none';
    }

    const p = this.game.player;
    const mv = this._moveVec;

    if (this._btnCamp) {
      const showCamp = this.game.state === GSTATE.FOREST && this.game.forest && this.game.forest.isInCamp(p.x, p.y);
      this._btnCamp.style.display = showCamp ? 'inline-flex' : 'none';
    }

    p.keys.left = mv.x < -0.18;
    p.keys.right = mv.x > 0.18;
    p.keys.up = mv.y < -0.18;
    p.keys.down = mv.y > 0.18;

    p.keys.sprint = this._sprintHeld;

    if (!this._shootHeld) {
      this.game.mouseDown = false;
    }
  }
}
