/* =====================================================
   game.js — Main Game Orchestrator
   Handles: game loop, state machine, input, collisions,
            day progression, all high-level logic
====================================================== */

'use strict';

// ── Game states ──────────────────────────────────────
const GSTATE = {
  TITLE:    'title',
  CAMP:     'camp',
  FOREST:   'forest',
  PAUSED:   'paused',
  GAMEOVER: 'gameover'
};

// ── Game class ────────────────────────────────────────
// ── SoundSystem (synthesized retro audio using Web Audio API) ──
class SoundSystem {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCoin() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08); // A5
    
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  playHit() {
    this.init();
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.15);
  }

  playDeath() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playAlert() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(220, this.ctx.currentTime + 0.1);
    osc.frequency.linearRampToValueAtTime(140, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playFanfare() {
    this.init();
    if (!this.ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const now = this.ctx.currentTime;
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);
      
      gain.gain.setValueAtTime(0.06, now + idx * 0.1);
      gain.gain.setValueAtTime(0.06, now + idx * 0.1 + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.22);
      
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.22);
    });
  }
}

// ── Game class ────────────────────────────────────────
class Game {
  constructor() {
    // Canvas setup
    this.canvas  = document.getElementById('gameCanvas');
    this.ctx     = this.canvas.getContext('2d');
    this.resize();

    // Core systems
    this.forest  = new Forest();
    this.player  = new Player();
    this.spawner = new AnimalSpawner();
    this.arrows  = new ArrowManager();
    this.ui      = new UIManager();
    this.sounds  = new SoundSystem();

    // Game state
    this.state   = GSTATE.TITLE;
    this.lastTime = 0;

    // Input state
    this.mouse   = { x: 0, y: 0 };
    this.mouseDown = false;

    // Day tracking
    this.dayTimer = 0;   // time spent in forest today (informational)

    // Collection radius (how close player must be to pick up)
    this.collectRadius = 40;

    // Particle systems (general purpose)
    this.bloodParticles = [];

    this._bindEvents();
    this._start();
  }

  // ── Canvas resize ─────────────────────────────────
  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // ── Input binding ─────────────────────────────────
  _bindEvents() {
    // Keyboard
    window.addEventListener('keydown', e => this._onKey(e, true));
    window.addEventListener('keyup',   e => this._onKey(e, false));

    // Mouse
    this.canvas.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
    this.canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.mouseDown = true;
    });
    this.canvas.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseDown = false;
    });

    // Prevent context menu on right click
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Resize
    window.addEventListener('resize', () => this.resize());

    // UI buttons
    document.getElementById('btn-start').addEventListener('click', () => this._startGame());
    document.getElementById('btn-enter-forest').addEventListener('click', () => this._enterForest());
    document.getElementById('btn-next-day').addEventListener('click', () => this._nextDay());
    document.getElementById('btn-resume').addEventListener('click', () => this._resume());
    document.getElementById('btn-quit-pause').addEventListener('click', () => this._quitToTitle());
    document.getElementById('btn-restart').addEventListener('click', () => this._startGame());
  }

  _onKey(e, down) {
    const p = this.player;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    p.keys.up    = down; break;
      case 'KeyS': case 'ArrowDown':  p.keys.down  = down; break;
      case 'KeyA': case 'ArrowLeft':  p.keys.left  = down; break;
      case 'KeyD': case 'ArrowRight': p.keys.right = down; break;
      case 'ShiftLeft': case 'ShiftRight': p.keys.sprint = down; break;

      case 'KeyE':
        if (down && this.state === GSTATE.FOREST) this._tryReturnToCamp();
        break;

      case 'Escape':
        if (down) {
          if (this.state === GSTATE.FOREST) this._pause();
          else if (this.state === GSTATE.PAUSED) this._resume();
        }
        break;
    }
  }

  // ── State transitions ─────────────────────────────
  _startGame() {
    if (this.sounds) this.sounds.init();
    // Reset everything
    this.player  = new Player();
    this.spawner = new AnimalSpawner();
    this.arrows  = new ArrowManager();
    this.bloodParticles = [];
    this._initQuest();

    this.ui.hideAll();
    this.ui.showCamp(this.player, '🏹 Welcome, hunter! Buy upgrades, then enter the forest.');
    this.state = GSTATE.CAMP;
    this.ui.hideHUD();
  }

  _enterForest() {
    if (this.sounds) this.sounds.init();
    this.ui.hideAll();
    this.ui.showHUD();
    this.player.enterForest();
    this.spawner.spawnDay(this.player.day, this.forest);
    this.arrows.clear();
    this.dayTimer = 0;
    this.state = GSTATE.FOREST;
    this.ui.addNotification(`🌲 Day ${this.player.day} — Hunt begins!`, '#5aab5a');
  }

  _nextDay() {
    // Advance day and re-enter forest
    this.player.day++;
    this._enterForest();
  }

  _tryReturnToCamp() {
    if (this.forest.isInCamp(this.player.x, this.player.y)) {
      this._returnToCamp();
    } else {
      this.ui.addNotification('⚠️ Walk to camp first!', '#e74c3c');
    }
  }

  _returnToCamp() {
    const result = this.player.returnToCamp();
    this.arrows.clear();
    this.state = GSTATE.CAMP;
    this.ui.hideHUD();

    let msg = '';
    if (result.sold > 0) {
      msg = `Sold ${result.sold} animals for $${result.earned}! 💰 You now have $${this.player.money}.`;
    } else {
      msg = 'You returned empty-handed. Head out again!';
    }
    this.ui.showCamp(this.player, msg);
  }

  _pause() {
    this.state = GSTATE.PAUSED;
    this.ui.showPause();
  }

  _resume() {
    this.ui.hideAll();
    this.state = GSTATE.FOREST;
    this.lastTime = performance.now(); // reset dt to avoid jump
  }

  _quitToTitle() {
    this.ui.hideAll();
    this.ui.hideHUD();
    this.ui.showTitle();
    this.state = GSTATE.TITLE;
  }

  _gameOver() {
    this.state = GSTATE.GAMEOVER;
    this.ui.hideHUD();
    this.ui.showGameover(this.player);
  }

  _initQuest() {
    const quests = [
      { id: 'rabbit', targetType: 'rabbit', targetCount: 3, reward: 50, desc: 'Hunt 3 Rabbits' },
      { id: 'deer',   targetType: 'deer',   targetCount: 2, reward: 75, desc: 'Hunt 2 Deer' },
      { id: 'wolf',   targetType: 'wolf',   targetCount: 1, reward: 100, desc: 'Kill 1 Wolf' },
      { id: 'fox',    targetType: 'fox',    targetCount: 2, reward: 60, desc: 'Hunt 2 Foxes' },
      { id: 'bear',   targetType: 'bear',   targetCount: 1, reward: 120, desc: 'Hunt 1 Bear' }
    ];
    const idx = Math.floor(Math.random() * quests.length);
    this.currentQuest = quests[idx];
    this.questProgress = 0;
  }

  _completeQuest() {
    if (!this.currentQuest) return;
    const reward = this.currentQuest.reward;
    this.player.money += reward;
    this.player.totalMoney += reward;
    this.ui.addNotification('🏆 MISSION COMPLETE!', '#f0c040');
    this.ui.addNotification(`Rewarded +$${reward}!`, '#5aab5a');
    this.ui.spawnFloatingText(this.player.x, this.player.y - 40, `+$${reward}`, '#f0c040', 22);
    if (this.sounds) this.sounds.playFanfare();
    this._initQuest();
  }

  // ── Game loop ─────────────────────────────────────
  _start() {
    this.ui.showTitle();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // cap at 50ms
    this.lastTime = timestamp;

    this._update(dt);
    this._draw();

    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Update ────────────────────────────────────────
  _update(dt) {
    if (this.state !== GSTATE.FOREST) return;

    // Player
    this.player.update(dt, this.forest, this.mouse);

    // Camera
    this.forest.updateCamera(this.player.x, this.player.y, this.canvas.width, this.canvas.height);

    // Continuous shooting (hold mouse button)
    if (this.mouseDown && this.player.canShoot) {
      this._shoot();
    }

    // Arrow updates + hit detection
    const hits = this.arrows.update(dt, this.forest, this.spawner.animals);
    for (const { arrow, animal } of hits) {
      this._handleArrowHit(animal);
    }

    // Animal update
    this.spawner.update(dt, this.player, this.forest);

    // Auto-collect dead animals in range
    this._checkCollection();

    // Blood particles
    this._updateBlood(dt);

    // UI
    this.ui.update(dt);
    this.ui.updateHUD(this.player);
    this.ui.updateQuestHUD(this.currentQuest, this.questProgress);

    // Passive healing inside camp (+5 HP/sec)
    if (this.forest.isInCamp(this.player.x, this.player.y)) {
      if (this.player.health < this.player.maxHealth) {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 5 * dt);
      }
    }

    // Day timer
    this.dayTimer += dt;

    // Death check
    if (this.player.isDead) {
      this._gameOver();
    }

    // Auto-return if no arrows and bag full (quality of life)
    // (optional — player can still roam)
  }

  // ── Handle arrow hitting animal ───────────────────
  _handleArrowHit(animal) {
    animal.hit(1);

    // Blood splat
    this._spawnBlood(animal.x, animal.y, animal.color);

    if (!animal.alive) {
      // Animal died
      this.ui.addKill(animal);
      if (this.sounds) this.sounds.playDeath();

      if (animal.type === 'stag') {
        this.ui.addNotification('✨ LEGENDARY! White Stag!', '#f0c040');
      } else if (animal.type === 'bear') {
        this.ui.addNotification('🐻 Bear taken down!', '#ff8844');
      } else if (animal.type === 'wolf') {
        this.ui.addNotification('🐺 Wolf taken down!', '#7f8c8d');
      }
    } else {
      // Hit but alive — show health remaining
      this.ui.spawnFloatingText(animal.x, animal.y - 20, `-1 HP`, '#ff6666', 13);
    }
  }

  // ── Shoot arrow ───────────────────────────────────
  _shoot() {
    if (this.player.arrows <= 0) {
      this.ui.addNotification('🪶 No arrows! Buy more at camp.', '#e74c3c');
      return;
    }
    this.player.shoot(this.arrows);
  }

  // ── Auto-collect dead animals ─────────────────────
  _checkCollection() {
    for (const animal of this.spawner.animals) {
      if (!animal.alive && !animal._collected) {
        const dx = this.player.x - animal.x;
        const dy = this.player.y - animal.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 40) {
          const success = this.player.collect(animal);
          if (success) {
            animal._collected = true;
            this.ui.spawnFloatingText(
              animal.x, animal.y,
              `Collected! ${animal.emoji}`,
              '#aaff88', 13
            );
            this.ui.spawnFloatingText(
              this.player.x, this.player.y - 20,
              `+$${animal.value}`,
              '#2ecc71',
              16
            );
            if (this.sounds) this.sounds.playCoin();

            // Track quest progress
            if (this.currentQuest && animal.type === this.currentQuest.targetType) {
              this.questProgress++;
              if (this.questProgress >= this.currentQuest.targetCount) {
                this._completeQuest();
              }
            }
          } else {
            const now = Date.now();
            if (!this.lastBagFullNotify || now - this.lastBagFullNotify > 2000) {
              this.ui.addNotification('🎒 Bag full! Return to camp.', '#e74c3c');
              this.lastBagFullNotify = now;
            }
          }
        }
      }
    }
  }

  // ── Blood particles ───────────────────────────────
  _spawnBlood(x, y, color) {
    const count = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.bloodParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        r: 2 + Math.random() * 4,
        color
      });
    }
  }

  _updateBlood(dt) {
    this.bloodParticles = this.bloodParticles.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.88;
      p.vy *= 0.88;
      p.r  *= 0.97;
      return p.life > 0;
    });
  }

  _drawBlood(ctx, forest) {
    for (const p of this.bloodParticles) {
      const { sx, sy } = forest.toScreen(p.x, p.y);
      ctx.globalAlpha = (p.life / 0.8) * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Draw ─────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;

    // Clear
    ctx.clearRect(0, 0, W, H);

    if (this.state === GSTATE.TITLE ||
        this.state === GSTATE.GAMEOVER) {
      // Draw forest background even on title/gameover
      this._drawBackground(ctx, W, H);
      return;
    }

    if (this.state === GSTATE.CAMP) {
      // Cozy camp background
      this._drawCampBackground(ctx, W, H);
      return;
    }

    // Forest / Paused — full scene
    this._drawScene(ctx, W, H);
  }

  _drawScene(ctx, W, H) {
    // Floor
    this.forest.drawFloor(ctx, W, H);

    // Camp
    this.forest.drawCamp(ctx);

    // Blood
    this._drawBlood(ctx, this.forest);

    // Animals (below trees)
    this.spawner.draw(ctx, this.forest);

    // Player
    this.player.draw(ctx, this.forest);

    // Arrows
    this.arrows.draw(ctx, this.forest);

    // Trees (above everything to give depth illusion)
    this.forest.drawTrees(ctx, W, H);

    // Minimap
    this.forest.drawMinimap(ctx, this.player, this.spawner.animals, W, H);

    // UI canvas elements (floating text, crosshair, etc.)
    this.ui.draw(ctx, this.forest, this.player, W, H);

    // Pause overlay
    if (this.state === GSTATE.PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  _drawBackground(ctx, W, H) {
    // Atmospheric forest background for title / gameover screens
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a120a');
    grad.addColorStop(1, '#1a2d1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Silhouette trees
    ctx.fillStyle = '#0d1f0d';
    const treePositions = [0.05, 0.15, 0.25, 0.35, 0.55, 0.65, 0.75, 0.85, 0.95];
    for (const xPct of treePositions) {
      const tx = xPct * W;
      const th = 100 + Math.random() * 120;
      ctx.beginPath();
      ctx.moveTo(tx, H);
      ctx.lineTo(tx - 35, H - th);
      ctx.lineTo(tx + 35, H - th);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tx, H);
      ctx.lineTo(tx - 20, H - th * 1.3);
      ctx.lineTo(tx + 20, H - th * 1.3);
      ctx.closePath();
      ctx.fill();
    }

    // Moon
    ctx.fillStyle = 'rgba(220,230,255,0.8)';
    ctx.beginPath();
    ctx.arc(W * 0.75, H * 0.18, 42, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,18,10,0.5)';
    ctx.beginPath();
    ctx.arc(W * 0.77, H * 0.16, 38, 0, Math.PI*2);
    ctx.fill();
  }

  _drawCampBackground(ctx, W, H) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0d1a0d');
    grad.addColorStop(1, '#1e2e10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Firelight glow
    const fireGlow = ctx.createRadialGradient(W/2, H*0.6, 20, W/2, H*0.6, 280);
    fireGlow.addColorStop(0, 'rgba(255,120,20,0.15)');
    fireGlow.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = fireGlow;
    ctx.fillRect(0, 0, W, H);
  }
}

// ── Bootstrap ─────────────────────────────────────────
// Wait for DOM to be fully ready before creating the game
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
