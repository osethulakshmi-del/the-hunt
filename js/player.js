/* =====================================================
   player.js — Player Entity
   Handles: movement, aiming, stamina, health, inventory
====================================================== */

'use strict';

// ── Player constants ─────────────────────────────────
const PLAYER_BASE_SPEED     = 180;   // px / second
const PLAYER_SPRINT_MULT    = 1.7;
const PLAYER_STAMINA_MAX    = 100;
const PLAYER_STAMINA_DRAIN  = 35;    // per second while sprinting
const PLAYER_STAMINA_REGEN  = 22;    // per second while not sprinting
const PLAYER_HEALTH_MAX     = 100;
const PLAYER_RADIUS         = 14;
const PLAYER_SHOOT_COOLDOWN = 0.45;  // seconds between shots (base)
const IFRAMES_DURATION      = 0.6;   // seconds of invincibility after being hit

class Player {
  constructor() {
    // Position (world coordinates)
    this.x = CAMP_X;
    this.y = CAMP_Y;

    this.vx = 0;
    this.vy = 0;
    this.angle = 0;      // facing direction (radians)
    this.aimAngle = 0;   // toward mouse cursor

    this.radius = PLAYER_RADIUS;

    // Stats
    this.health  = PLAYER_HEALTH_MAX;
    this.maxHealth = PLAYER_HEALTH_MAX;
    this.stamina = PLAYER_STAMINA_MAX;
    this.money   = 0;
    this.arrows  = 10;   // starting arrows

    // Inventory: collected animal rewards
    this.bag     = [];   // array of { type, value, name }
    this.bagMax  = 5;    // upgradeable

    // Day counter
    this.day     = 1;
    this.totalMoney  = 0;   // cumulative (for stats)
    this.totalKills  = { rabbit:0, fox:0, deer:0, bear:0, stag:0 };

    // Shoot cooldown
    this.shootTimer = 0;

    // Iframes (invincibility after damage)
    this.iframeTimer = 0;
    this.iframeFlash = 0;

    // Upgrades (levels, 0-based)
    this.upgrades = {
      bow:     0,   // faster arrows / shoot speed
      quiver:  0,   // more max arrows
      boots:   0,   // faster movement
      backpack:0    // bigger bag
    };

    // Visual
    this.walkCycle = 0;   // oscillation for walk animation
    this.particles = [];  // footstep dust

    // Input state (managed by game.js)
    this.keys = { up:false, down:false, left:false, right:false, sprint:false };
  }

  // ── Upgrade stat helpers ─────────────────────────
  get maxArrows()  { return 10 + this.upgrades.quiver  * 5; }
  get moveSpeed()  { return PLAYER_BASE_SPEED * (1 + this.upgrades.boots * 0.2); }
  get shootSpeed() { return PLAYER_SHOOT_COOLDOWN * (1 - this.upgrades.bow * 0.15); }

  // ── Reset for new forest run ─────────────────────
  enterForest() {
    this.x = CAMP_X;
    this.y = CAMP_Y;
    this.vx = 0; this.vy = 0;
    this.shootTimer = 0;
    this.iframeTimer = 0;
    this.arrows = Math.min(this.arrows, this.maxArrows);
    // Restore arrows to max
    this.arrows = this.maxArrows;
  }

  // ── Return to camp: auto-sell bag ────────────────
  returnToCamp() {
    let earned = 0;
    for (const item of this.bag) earned += item.value;
    //this.money += earned;
    //this.totalMoney += earned;
    const sold = this.bag.length;
    this.bag = [];
    this.health = Math.min(this.maxHealth, this.health + 30); // rest heals
    this.stamina = PLAYER_STAMINA_MAX;
    return { earned, sold };
  }

  // ── Collect animal reward ─────────────────────────
  // Returns true if collected, false if bag full
  collect(animal) {
    if (this.bag.length >= this.bagMax + this.upgrades.backpack * 2) return false;
    this.bag.push({ type: animal.type, value: animal.value, name: animal.name });
    this.money += animal.value;
    this.totalMoney += animal.value;
    this.totalKills[animal.type] = (this.totalKills[animal.type] || 0) + 1;
    return true;
  }

  // ── Take damage ───────────────────────────────────
  takeDamage(amount, dt) {
    if (this.iframeTimer > 0) return;
    this.health -= amount * dt; // continuous damage from bear
    this.iframeFlash = 0.15;
    if (this.health <= 0) this.health = 0;
  }

  // ── One-shot damage (arrow-caused / predator hits) ───────────────
  takeDamageOnce(amount) {
    if (this.iframeTimer > 0) return false;
    this.health -= amount;
    this.iframeTimer = IFRAMES_DURATION;
    this.iframeFlash = 0.4;
    if (this.health <= 0) this.health = 0;
    return true;
  }

  get isDead() { return this.health <= 0; }

  // ── Main update ───────────────────────────────────
  update(dt, forest, mouse) {
    this._updateTimers(dt);
    this._updateMovement(dt, forest);
    this._updateAim(forest, mouse);
    this._updateWalkParticles(dt);
  }

  _updateTimers(dt) {
    if (this.shootTimer > 0)  this.shootTimer  -= dt;
    if (this.iframeTimer > 0) this.iframeTimer -= dt;
    if (this.iframeFlash > 0) this.iframeFlash -= dt * 3;
  }

  _updateMovement(dt, forest) {
    const k = this.keys;
    let dx = 0, dy = 0;
    if (k.up)    dy -= 1;
    if (k.down)  dy += 1;
    if (k.left)  dx -= 1;
    if (k.right) dx += 1;

    // Normalize diagonal
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const moving = dx !== 0 || dy !== 0;

    // Sprint logic (Shift or auto-sprint when not in camp)
    const canSprint = moving && this.stamina > 0;
    const sprinting = canSprint && k.sprint;

    const spd = this.moveSpeed * (sprinting ? PLAYER_SPRINT_MULT : 1);

    // Stamina management
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - PLAYER_STAMINA_DRAIN * dt);
    } else {
      this.stamina = Math.min(PLAYER_STAMINA_MAX, this.stamina + PLAYER_STAMINA_REGEN * dt);
    }

    // Target velocity
    const tvx = dx * spd;
    const tvy = dy * spd;

    // Smooth velocity
    const acc = 10;
    this.vx = lerp(this.vx, tvx, dt * acc);
    this.vy = lerp(this.vy, tvy, dt * acc);

    // Proposed new position
    let nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;

    // Tree collision
    if (forest.isInsideTree(nx, ny)) {
      if (!forest.isInsideTree(nx, this.y)) { ny = this.y; }
      else if (!forest.isInsideTree(this.x, ny)) { nx = this.x; }
      else { nx = this.x; ny = this.y; }
    }

    // World bounds
    nx = Math.max(this.radius, Math.min(WORLD_W - this.radius, nx));
    ny = Math.max(this.radius, Math.min(WORLD_H - this.radius, ny));

    this.x = nx;
    this.y = ny;

    // Walk cycle
    if (moving) {
      this.walkCycle += dt * spd * 0.04;
      this.angle = lerpAngle(this.angle, Math.atan2(this.vy, this.vx), dt * 8);
    }
  }

  _updateAim(forest, mouse) {
    if (!mouse) return;
    // Convert screen mouse to world coords
    const world = forest.toWorld(mouse.x, mouse.y);
    const dx = world.wx - this.x;
    const dy = world.wy - this.y;
    this.aimAngle = Math.atan2(dy, dx);
  }

  _updateWalkParticles(dt) {
    const moving = Math.abs(this.vx) + Math.abs(this.vy) > 20;
    if (moving && Math.random() < 0.2) {
      this.particles.push({
        x: this.x + (Math.random()-0.5)*8,
        y: this.y + (Math.random()-0.5)*8,
        life: 0.35,
        r: 2 + Math.random()*2
      });
    }
    this.particles = this.particles.filter(p => {
      p.life -= dt;
      p.r *= 0.95;
      return p.life > 0;
    });
  }

  // ── Can shoot? ────────────────────────────────────
  get canShoot() {
    return this.shootTimer <= 0 && this.arrows > 0;
  }

  shoot(arrowManager) {
    if (!this.canShoot) return null;
    this.shootTimer = this.shootSpeed;
    return arrowManager.shoot(this);
  }

  // ── Draw ──────────────────────────────────────────
  draw(ctx, forest) {
    const { sx, sy } = forest.toScreen(this.x, this.y);

    // Faint semi-transparent aiming range circle (250px)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(sx, sy, 250, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Footstep particles
    for (const p of this.particles) {
      const { sx: px, sy: py } = forest.toScreen(p.x, p.y);
      ctx.globalAlpha = (p.life / 0.35) * 0.35;
      ctx.fillStyle = '#8a7a6a';
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Iframe flash (damage indicator)
    if (this.iframeFlash > 0) {
      ctx.globalAlpha = this.iframeFlash;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(sx, sy, this.radius + 8, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx + 3, sy + 6, this.radius*0.85, this.radius*0.35, 0, 0, Math.PI*2);
    ctx.fill();

    // Body
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle + Math.PI/2);

    const bob = Math.sin(this.walkCycle) * 1.2;
    const hy = bob * 0.2;

    // Hat drop shadow (top-down)
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, hy + 2.0, this.radius*1.03, this.radius*0.64, 0, 0, Math.PI*2);
    ctx.fill();

    // Brim (ring)
    ctx.fillStyle = '#1f140c';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, hy, this.radius*1.03, this.radius*0.62, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Inner brim cutout to make it feel like a ring
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(0, hy, this.radius*0.72, this.radius*0.40, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Crown
    ctx.fillStyle = '#2a1b10';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;

    const cw = this.radius * 0.92;
    const ch = this.radius * 0.62;
    const y0 = hy - this.radius * 0.10;
    const pinch = this.radius * 0.16;

    // Fedora-like crown silhouette (top-down): rounded sides + pinched front/back
    ctx.beginPath();
    ctx.moveTo(-cw * 0.55, y0 - ch * 0.10);
    ctx.quadraticCurveTo(-cw, y0 - ch * 0.55, -cw * 0.55, y0 - ch);
    ctx.quadraticCurveTo(-pinch, y0 - ch * 1.10, 0, y0 - ch * 0.92);
    ctx.quadraticCurveTo(pinch, y0 - ch * 1.10, cw * 0.55, y0 - ch);
    ctx.quadraticCurveTo(cw, y0 - ch * 0.55, cw * 0.55, y0 - ch * 0.10);
    ctx.quadraticCurveTo(0, y0 + ch * 0.35, -cw * 0.55, y0 - ch * 0.10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Band highlight
    ctx.strokeStyle = 'rgba(240,192,64,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, y0 - ch * 0.25, this.radius*0.46, this.radius*0.26, 0, 0, Math.PI*2);
    ctx.stroke();

    // Bow (rotated to aim direction)
    ctx.restore();
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.aimAngle);

    // Bow body
    ctx.strokeStyle = '#7a5030';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(18, 0, 12, -Math.PI*0.55, Math.PI*0.55);
    ctx.stroke();

    // Bowstring
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, -12*Math.sin(0.55));
    ctx.lineTo(18 + 3, 0);  // drawn-back string
    ctx.lineTo(18, 12*Math.sin(0.55));
    ctx.stroke();

    ctx.restore();

    // Aim dot (crosshair reticle on the target)
    // (Drawn by ui.js on screen coordinates)
  }

  // ── Draw shooting cooldown indicator ─────────────
  drawShootCooldown(ctx, forest) {
    const { sx, sy } = forest.toScreen(this.x, this.y);
    const progress = 1 - (this.shootTimer / this.shootSpeed);
    if (progress < 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy - this.radius - 10, 5, -Math.PI/2, -Math.PI/2 + Math.PI*2*progress);
      ctx.stroke();
    }
  }
}
