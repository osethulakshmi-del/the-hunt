/* =====================================================
   animal.js — Animal Definitions and AI
   Handles: animal types, movement, pathfinding, behavior
====================================================== */

'use strict';

// ── Animal type definitions ──────────────────────────
// Each entry describes the base stats for one species.
const ANIMAL_TYPES = {
  rabbit: {
    name:       'Rabbit',
    emoji:      '🐇',
    color:      '#d4a5a5',    // pinkish-grey
    bodyColor:  '#e8c8c8',
    speed:      70,            // px / second (wander)
    fleeSpeed:  160,           // px / second (when spooked)
    fleeRadius: 140,           // distance at which it notices the player
    health:     1,
    value:      10,
    hitRadius:  14,
    bodyR:      10,            // body circle radius
    aggro:      false,
    rarity:     1.0            // spawn weight
  },
  fox: {
    name:       'Fox',
    emoji:      '🦊',
    color:      '#c0622a',
    bodyColor:  '#e07830',
    speed:      100,
    fleeSpeed:  220,
    fleeRadius: 170,
    health:     2,
    value:      25,
    hitRadius:  16,
    bodyR:      12,
    aggro:      false,
    rarity:     0.6
  },
  deer: {
    name:       'Deer',
    emoji:      '🦌',
    color:      '#a07040',
    bodyColor:  '#c89060',
    speed:      120,
    fleeSpeed:  280,
    fleeRadius: 210,
    health:     3,
    value:      50,
    hitRadius:  18,
    bodyR:      15,
    aggro:      false,
    rarity:     0.4
  },
  bear: {
    name:       'Bear',
    emoji:      '🐻',
    color:      '#5a3c22',
    bodyColor:  '#7a5a3a',
    speed:      62,
    fleeSpeed:  0,
    fleeRadius: 0,
    health:     6,
    value:      100,
    hitRadius:  22,
    bodyR:      20,
    aggro:      true,
    aggroRadius: 250,
    chargeSpeed: 150,
    attackRadius: 25,
    damage:     20,
    rarity:     0.15
  },
  wolf: {
    name:       'Wolf',
    emoji:      '🐺',
    color:      '#7f8c8d',
    bodyColor:  '#95a5a6',
    speed:      90,
    fleeSpeed:  0,
    fleeRadius: 0,
    health:     3,
    value:      40,
    hitRadius:  16,
    bodyR:      13,
    aggro:      true,
    aggroRadius: 200,
    chargeSpeed: 195,
    attackRadius: 20,
    damage:     10,
    rarity:     0.3
  },
  stag: {
    name:       'White Stag',
    emoji:      '🦌',
    color:      '#f0f8ff',
    bodyColor:  '#ffffff',
    speed:      150,
    fleeSpeed:  340,
    fleeRadius: 260,
    health:     4,
    value:      500,
    hitRadius:  18,
    bodyR:      15,
    aggro:      false,
    rarity:     0.04           // very rare
  },
  boar: {
    name:       'Boar',
    emoji:      '🐗',
    color:      '#3a2a1e',
    bodyColor:  '#4a3524',
    speed:      72,
    fleeSpeed:  0,
    fleeRadius: 0,
    health:     4,
    value:      65,
    hitRadius:  18,
    bodyR:      16,
    aggro:      true,
    aggroRadius: 220,
    chargeSpeed: 210,
    attackRadius: 22,
    damage:     14,
    rarity:     0.25
  },
  owl: {
    name:       'Owl',
    emoji:      '🦉',
    color:      '#bfb6a6',
    bodyColor:  '#d6cdbc',
    speed:      110,
    fleeSpeed:  320,
    fleeRadius: 220,
    health:     1,
    value:      40,
    hitRadius:  14,
    bodyR:      12,
    aggro:      false,
    rarity:     0.12
  },
  moose: {
    name:       'Moose',
    emoji:      '🫎',
    color:      '#8b6a44',
    bodyColor:  '#a47c52',
    speed:      85,
    fleeSpeed:  240,
    fleeRadius: 240,
    health:     4,
    value:      90,
    hitRadius:  20,
    bodyR:      18,
    aggro:      false,
    rarity:     0.18
  },
  cougar: {
    name:       'Cougar',
    emoji:      '🐆',
    color:      '#caa45f',
    bodyColor:  '#ddb870',
    speed:      108,
    fleeSpeed:  0,
    fleeRadius: 0,
    health:     4,
    value:      85,
    hitRadius:  16,
    bodyR:      14,
    aggro:      true,
    aggroRadius: 260,
    chargeSpeed: 245,
    attackRadius: 22,
    damage:     16,
    rarity:     0.18
  }
};

// ── Animal behavioral states ─────────────────────────
const STATE = {
  WANDER:  'wander',
  FLEE:    'flee',
  GRAZE:   'graze',
  CHARGE:  'charge',   // bear only
  DEAD:    'dead'
};

// ── Animal class ─────────────────────────────────────
class Animal {
  constructor(type, x, y) {
    const def = ANIMAL_TYPES[type];
    if (!def) throw new Error(`Unknown animal type: ${type}`);

    this.type       = type;
    this.x          = x;
    this.y          = y;
    this.name       = def.name;
    this.emoji      = def.emoji;
    this.color      = def.color;
    this.bodyColor  = def.bodyColor;
    this.speed      = def.speed;
    this.fleeSpeed  = def.fleeSpeed;
    this.fleeRadius = def.fleeRadius;
    this.maxHealth  = def.health;
    this.health     = def.health;
    this.value      = def.value;
    this.hitRadius  = def.hitRadius;
    this.bodyR      = def.bodyR;
    this.aggro      = def.aggro;
    this.aggroRadius = def.aggroRadius || 0;
    this.chargeSpeed = def.chargeSpeed || 0;
    this.attackRadius = def.attackRadius || 0;
    this.damage      = def.damage || 0;
    this.attackTimer = 0;

    // Movement
    this.vx         = 0;
    this.vy         = 0;
    this.angle      = Math.random() * Math.PI * 2;  // facing direction
    this.state      = STATE.GRAZE;
    this.alive      = true;

    // Wander timer: choose new direction every few seconds
    this.wanderTimer   = Math.random() * 3;
    this.grazeTimer    = 1 + Math.random() * 2;    // time spent grazing
    this.targetX       = x;
    this.targetY       = y;

    // Hit flash effect
    this.hitFlash      = 0;   // > 0 → show red flash
    this.deathTimer    = 0;   // for death animation
    this.deathAlpha    = 1;

    // Trail / footstep particles (small circles)
    this.footParticles = [];

    // Flee behavior helpers (for passive animals)
    this.fleeHeading = Math.random() * Math.PI * 2;
    this.fleeJitterTimer = 0;
  }

  // ── Main update ───────────────────────────────────
  update(dt, player, forest) {
    if (!this.alive) {
      this._updateDeath(dt);
      return;
    }

    // Decrease hit flash
    if (this.hitFlash > 0) this.hitFlash -= dt * 4;

    // Foot particle spawn
    if (Math.abs(this.vx) + Math.abs(this.vy) > 10) {
      if (Math.random() < 0.15) {
        this.footParticles.push({ x: this.x, y: this.y, life: 0.4, r: 3 });
      }
    }
    this.footParticles = this.footParticles.filter(p => {
      p.life -= dt; return p.life > 0;
    });

    // Distance to player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // ── State machine ─────────────────────────────
    if (this.aggro) {
      this._updatePredator(dt, dist, dx, dy, player, forest);
    } else {
      this._updatePassive(dt, dist, dx, dy, forest);
    }

    // Move
    let nextX = this.x + this.vx * dt;
    let nextY = this.y + this.vy * dt;

    if (this.aggro) {
      const dxCamp = nextX - CAMP_X;
      const dyCamp = nextY - CAMP_Y;
      const distCamp = Math.sqrt(dxCamp*dxCamp + dyCamp*dyCamp);
      if (distCamp < CAMP_RADIUS) {
        // Push out of camp
        const ang = Math.atan2(dyCamp, dxCamp);
        nextX = CAMP_X + Math.cos(ang) * CAMP_RADIUS;
        nextY = CAMP_Y + Math.sin(ang) * CAMP_RADIUS;
        this.vx = 0;
        this.vy = 0;
      }
    }

    // World bounds clamp
    this.x = Math.max(this.bodyR, Math.min(WORLD_W - this.bodyR, nextX));
    this.y = Math.max(this.bodyR, Math.min(WORLD_H - this.bodyR, nextY));

    // Smooth facing angle toward velocity
    if (Math.abs(this.vx) + Math.abs(this.vy) > 5) {
      const targetAngle = Math.atan2(this.vy, this.vx);
      this.angle = lerpAngle(this.angle, targetAngle, dt * 6);
    }
  }

  // ── Passive animal AI (rabbit, fox, deer, stag) ──
  _updatePassive(dt, dist, dx, dy, forest) {
    if (dist < this.fleeRadius) {
      // Player too close → flee
      this.state = STATE.FLEE;

      // Base direction away from player
      const awayAngle = Math.atan2(-dy, -dx);

      // Update jitter timer: occasionally pick a new heading offset
      this.fleeJitterTimer -= dt;
      if (this.fleeJitterTimer <= 0) {
        this.fleeJitterTimer = 0.12 + Math.random() * 0.22;

        // Add a small random turn (bigger when closer to player)
        const danger = 1 - Math.min(1, dist / Math.max(1, this.fleeRadius));
        const turnAmp = 0.25 + danger * 0.55;
        this.fleeHeading += (Math.random() - 0.5) * turnAmp;
      }

      // Steer flee heading toward the away angle (so it still escapes)
      this.fleeHeading = lerpAngle(this.fleeHeading, awayAngle, dt * 4.5);

      // Apply movement along the (jittery) flee heading
      this.vx = Math.cos(this.fleeHeading) * this.fleeSpeed;
      this.vy = Math.sin(this.fleeHeading) * this.fleeSpeed;
    } else {
      if (this.state === STATE.FLEE) {
        // Just escaped; slow down
        this.state = STATE.WANDER;
        this.vx *= 0.3; this.vy *= 0.3;
      }

      this._updateWander(dt, forest);
    }
  }

  // ── Wander / graze logic ──────────────────────────
  _updateWander(dt, forest) {
    if (this.state === STATE.GRAZE) {
      this.vx = lerp(this.vx, 0, dt * 4);
      this.vy = lerp(this.vy, 0, dt * 4);
      this.grazeTimer -= dt;
      if (this.grazeTimer <= 0) {
        this.state = STATE.WANDER;
        this.wanderTimer = 0; // choose new target immediately
      }
      return;
    }

    // WANDER
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      // Pick a new random wander target
      const range = 200;
      this.targetX = this.x + (Math.random()-0.5) * range;
      this.targetY = this.y + (Math.random()-0.5) * range;
      this.targetX = Math.max(50, Math.min(WORLD_W-50, this.targetX));
      this.targetY = Math.max(50, Math.min(WORLD_H-50, this.targetY));
      this.wanderTimer = 1.5 + Math.random() * 2.5;

      // Occasionally stop to graze
      if (Math.random() < 0.3) {
        this.state = STATE.GRAZE;
        this.grazeTimer = 1 + Math.random() * 2;
        return;
      }
    }

    // Move toward wander target
    const tdx = this.targetX - this.x;
    const tdy = this.targetY - this.y;
    const tdist = Math.sqrt(tdx*tdx + tdy*tdy);
    if (tdist < 10) {
      this.vx = lerp(this.vx, 0, dt*5);
      this.vy = lerp(this.vy, 0, dt*5);
    } else {
      const tvx = (tdx/tdist) * this.speed;
      const tvy = (tdy/tdist) * this.speed;
      this.vx = lerp(this.vx, tvx, dt * 3);
      this.vy = lerp(this.vy, tvy, dt * 3);
    }
  }

  // ── Predator aggro AI (wolf, bear) ────────────────
  _updatePredator(dt, dist, dx, dy, player, forest) {
    // Attack timer cooldown
    if (this.attackTimer > 0) this.attackTimer -= dt;

    const playerInCamp = forest.isInCamp(player.x, player.y);
    const selfInCamp = forest.isInCamp(this.x, this.y);

    // Only chase if player and predator are both outside the camp
    if (dist < this.aggroRadius && !playerInCamp && !selfInCamp) {
      if (this.state !== STATE.CHARGE) {
        this.state = STATE.CHARGE;
        // Detection warning
        if (window.game && window.game.ui) {
          window.game.ui.addNotification(`⚠️ ${this.name} detected!`, '#e74c3c');
          if (window.game.sounds) {
            window.game.sounds.playAlert();
          }
        }
      }

      // Charge toward player
      const len = dist || 1;
      const spd = this.chargeSpeed;
      this.vx = lerp(this.vx, (dx/len)*spd, dt*4);
      this.vy = lerp(this.vy, (dy/len)*spd, dt*4);

      // Attack player on contact / within attack radius
      if (dist < this.attackRadius) {
        if (this.attackTimer <= 0) {
          const hitSuccess = player.takeDamageOnce(this.damage);
          if (hitSuccess) {
            this.attackTimer = 1.0; // 1 second cooldown
            if (window.game && window.game.ui) {
              window.game.ui.spawnFloatingText(player.x, player.y - 30, `-${this.damage} HP`, '#ff3333', 18);
              window.game.ui.flashRed();
            }
            if (window.game && window.game.sounds) {
              window.game.sounds.playHit();
            }
          }
        }
      }
    } else {
      if (this.state === STATE.CHARGE) {
        this.state = STATE.WANDER;
      }
      this._updateWander(dt, forest);
    }
  }

  // ── Receive arrow hit ─────────────────────────────
  hit(damage) {
    this.health -= damage;
    this.hitFlash = 1;
    if (this.health <= 0) {
      this.alive = false;
      this.deathAlpha = 1;
    }
  }

  // ── Death animation update ────────────────────────
  _updateDeath(dt) {
    this.deathTimer += dt;
    if (this.deathTimer < 8.5) {
      this.deathAlpha = 1.0;
    } else {
      this.deathAlpha = Math.max(0, 1 - (this.deathTimer - 8.5) / 1.5);
    }
  }

  get isDoneAnimating() {
    return !this.alive && (this.deathTimer >= 10 || this._collected);
  }

  // ── Draw ──────────────────────────────────────────
  draw(ctx, forest) {
    const { sx, sy } = forest.toScreen(this.x, this.y);
    const r = this.bodyR;

    // Viewport cull
    if (sx < -60 || sy < -60 || sx > ctx.canvas.width+60 || sy > ctx.canvas.height+60) return;

    // Death fade
    if (!this.alive) {
      ctx.globalAlpha = this.deathAlpha;
    }

    // Loot indicator (dead but not collected)
    if (!this.alive && !this._collected) {
      const bob = Math.sin(Date.now() * 0.006 + this.x * 0.01) * 3;
      ctx.globalAlpha = Math.min(1, this.deathAlpha) * 0.95;
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      const text = `${this.emoji} +$${this.value}`;
      const w = ctx.measureText(text).width + 14;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, sx - w/2, sy - r - 36 + bob, w, 20, 6);
      ctx.fill();
      ctx.fillStyle = '#aaff88';
      ctx.fillText(text, sx, sy - r - 22 + bob);
      ctx.globalAlpha = this.alive ? 1 : this.deathAlpha;
    }

    // Foot particles
    for (const p of this.footParticles) {
      const { sx: px, sy: py } = forest.toScreen(p.x, p.y);
      ctx.globalAlpha = (p.life / 0.4) * 0.4;
      ctx.fillStyle = '#aaa';
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = this.alive ? 1 : this.deathAlpha;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx + 2, sy + r*0.4, r*0.8, r*0.3, 0, 0, Math.PI*2);
    ctx.fill();

    // Draw the specific animal shape
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle + Math.PI/2); // face direction of travel

    if (this.hitFlash > 0) {
      // Red tint on hit
      ctx.globalAlpha = Math.min(this.alive ? 1 : this.deathAlpha, 1);
    }

    switch (this.type) {
      case 'rabbit': this._drawRabbit(ctx, r); break;
      case 'fox':    this._drawFox(ctx, r);    break;
      case 'deer':   this._drawDeer(ctx, r);   break;
      case 'bear':   this._drawBear(ctx, r);   break;
      case 'stag':   this._drawStag(ctx, r);   break;
      case 'wolf':   this._drawWolf(ctx, r);   break;
      case 'boar':   this._drawBoar(ctx, r);   break;
      case 'owl':    this._drawOwl(ctx, r);    break;
      case 'moose':  this._drawMoose(ctx, r);  break;
      case 'cougar': this._drawCougar(ctx, r); break;
    }

    ctx.restore();

    // Hit flash overlay
    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash * 0.55;
      ctx.fillStyle = '#ff3333';
      ctx.beginPath();
      ctx.arc(sx, sy, r + 2, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // Health bar (only if hurt)
    if (this.alive && this.maxHealth > 1 && this.health < this.maxHealth) {
      this._drawHealthBar(ctx, sx, sy, r);
    }

    // Name tag
    if (this.alive) {
      ctx.fillStyle = this.type === 'stag' ? '#ffffffcc' : 'rgba(220,220,200,0.7)';
      ctx.font = `${this.type === 'stag' ? 'bold ' : ''}9px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.name, sx, sy - r - 6);
    }
  }

  _drawHealthBar(ctx, sx, sy, r) {
    const bw = r * 2.4, bh = 4;
    const bx = sx - bw/2;
    const by = sy - r - 18;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(bx, by, bw * (this.health / this.maxHealth), bh);
  }

  // ── Per-species drawing routines ──────────────────
  _drawRabbit(ctx, r) {
    const c = this.hitFlash > 0 ? '#ff9999' : this.bodyColor;
    // Body
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(0, 0, r*0.75, r, 0, 0, Math.PI*2); ctx.fill();
    // Head
    ctx.beginPath(); ctx.ellipse(0, -r*0.9, r*0.55, r*0.55, 0, 0, Math.PI*2); ctx.fill();
    // Ears
    ctx.fillRect(-r*0.3, -r*1.7, r*0.2, r*0.7);
    ctx.fillRect( r*0.1, -r*1.7, r*0.2, r*0.7);
    // Inner ear
    ctx.fillStyle = '#d46060';
    ctx.fillRect(-r*0.25, -r*1.65, r*0.1, r*0.55);
    ctx.fillRect( r*0.15, -r*1.65, r*0.1, r*0.55);
    // Eye
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(r*0.2, -r, 2, 0, Math.PI*2); ctx.fill();
  }

  _drawFox(ctx, r) {
    const c = this.hitFlash > 0 ? '#ff9999' : this.bodyColor;
    // Body
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(0, 0, r*0.7, r, 0, 0, Math.PI*2); ctx.fill();
    // Head
    ctx.beginPath(); ctx.ellipse(0, -r*0.9, r*0.6, r*0.55, 0, 0, Math.PI*2); ctx.fill();
    // Pointed ears
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-r*0.4, -r*1.25); ctx.lineTo(-r*0.05, -r*1.75); ctx.lineTo( r*0.2, -r*1.25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo( r*0.4, -r*1.25); ctx.lineTo( r*0.8, -r*1.75); ctx.lineTo( r*0.15, -r*1.25);
    ctx.fill();
    // Snout
    ctx.fillStyle = '#f0b090';
    ctx.beginPath(); ctx.ellipse(0, -r*0.85, r*0.3, r*0.2, 0, 0, Math.PI*2); ctx.fill();
    // White chest
    ctx.fillStyle = '#f5e6d0';
    ctx.beginPath(); ctx.ellipse(0, r*0.2, r*0.35, r*0.55, 0, 0, Math.PI*2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-r*0.2, -r, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.2, -r, 2, 0, Math.PI*2); ctx.fill();
    // Tail hint
    ctx.fillStyle = '#f0c080';
    ctx.beginPath(); ctx.arc(0, r*1.0, r*0.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, r*1.15, r*0.2, 0, Math.PI*2); ctx.fill();
  }

  _drawWolf(ctx, r) {
    const c = this.hitFlash > 0 ? '#ff9999' : this.bodyColor;
    // Legs
    ctx.fillStyle = '#555555';
    for (const [lx, ly] of [[-r*0.4, r*0.5],[r*0.4, r*0.5],[-r*0.2, r*0.6],[r*0.2, r*0.6]]) {
      ctx.fillRect(lx - 2, ly, 4, r*0.55);
    }
    // Body
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(0, 0, r*0.65, r, 0, 0, Math.PI*2); ctx.fill();
    // Head
    ctx.beginPath(); ctx.ellipse(0, -r*0.9, r*0.5, r*0.5, 0, 0, Math.PI*2); ctx.fill();
    // Ears
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-r*0.3, -r*1.2); ctx.lineTo(-r*0.15, -r*1.65); ctx.lineTo(r*0.05, -r*1.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r*0.3, -r*1.2); ctx.lineTo(r*0.15, -r*1.65); ctx.lineTo(-r*0.05, -r*1.2);
    ctx.fill();
    // Snout
    ctx.fillStyle = '#657475';
    ctx.beginPath(); ctx.ellipse(0, -r*1.1, r*0.22, r*0.18, 0, 0, Math.PI*2); ctx.fill();
    // Eyes (predator amber-yellow glow!)
    ctx.fillStyle = '#f39c12';
    ctx.beginPath(); ctx.arc(-r*0.16, -r*1.0, 1.8, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.16, -r*1.0, 1.8, 0, Math.PI*2); ctx.fill();
    // Tail
    ctx.fillStyle = '#555555';
    ctx.beginPath(); ctx.ellipse(0, r*0.9, r*0.25, r*0.5, 0, 0, Math.PI*2); ctx.fill();
  }

  _drawDeer(ctx, r) {
    const c = this.hitFlash > 0 ? '#ff9999' : this.bodyColor;
    // Legs
    ctx.fillStyle = '#8a6040';
    for (const [lx, ly] of [[-r*0.4, r*0.6],[r*0.4, r*0.6],[-r*0.2, r*0.7],[r*0.2, r*0.7]]) {
      ctx.fillRect(lx - 3, ly, 6, r*0.55);
    }
    // Body
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(0, 0, r*0.75, r, 0, 0, Math.PI*2); ctx.fill();
    // Neck
    ctx.fillRect(-r*0.25, -r*0.9, r*0.5, r*0.5);
    // Head
    ctx.beginPath(); ctx.ellipse(0, -r*1.1, r*0.45, r*0.45, 0, 0, Math.PI*2); ctx.fill();
    // Antlers
    ctx.strokeStyle = '#7a5030'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r*0.25, -r*1.4); ctx.lineTo(-r*0.55, -r*2.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r*0.4, -r*1.65); ctx.lineTo(-r*0.8, -r*1.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r*0.5, -r*1.85); ctx.lineTo(-r*0.15, -r*2.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( r*0.25, -r*1.4); ctx.lineTo( r*0.55, -r*2.0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( r*0.4, -r*1.65); ctx.lineTo( r*0.8, -r*1.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( r*0.5, -r*1.85); ctx.lineTo( r*0.15, -r*2.0); ctx.stroke();
    // White belly
    ctx.fillStyle = '#f0e0c0';
    ctx.beginPath(); ctx.ellipse(0, r*0.2, r*0.4, r*0.6, 0, 0, Math.PI*2); ctx.fill();
    // Eye
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-r*0.15, -r*1.15, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(-r*0.14, -r*1.16, 1, 0, Math.PI*2); ctx.fill();
  }

  _drawBear(ctx, r) {
    const c = this.hitFlash > 0 ? '#cc6666' : this.bodyColor;
    // Body
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(0, 0, r*0.85, r, 0, 0, Math.PI*2); ctx.fill();
    // Head
    ctx.beginPath(); ctx.ellipse(0, -r*0.9, r*0.75, r*0.7, 0, 0, Math.PI*2); ctx.fill();
    // Ears
    ctx.beginPath(); ctx.arc(-r*0.55, -r*1.45, r*0.28, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.55, -r*1.45, r*0.28, 0, Math.PI*2); ctx.fill();
    // Inner ears
    ctx.fillStyle = '#d06060';
    ctx.beginPath(); ctx.arc(-r*0.55, -r*1.45, r*0.15, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.55, -r*1.45, r*0.15, 0, Math.PI*2); ctx.fill();
    // Muzzle
    ctx.fillStyle = '#9a7a5a';
    ctx.beginPath(); ctx.ellipse(0, -r*0.8, r*0.4, r*0.3, 0, 0, Math.PI*2); ctx.fill();
    // Nose
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.ellipse(0, -r*0.9, r*0.15, r*0.1, 0, 0, Math.PI*2); ctx.fill();
    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-r*0.3, -r, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( r*0.3, -r, 3, 0, Math.PI*2); ctx.fill();
    // Claws
    ctx.strokeStyle = '#4a3020'; ctx.lineWidth = 2;
    for (const cx of [-r*0.7, -r*0.4, -r*0.1]) {
      ctx.beginPath(); ctx.moveTo(cx, r*1.0); ctx.lineTo(cx - 3, r*1.2); ctx.stroke();
    }
    for (const cx of [r*0.1, r*0.4, r*0.7]) {
      ctx.beginPath(); ctx.moveTo(cx, r*1.0); ctx.lineTo(cx + 3, r*1.2); ctx.stroke();
    }

    // Charge indicator
    if (this.state === STATE.CHARGE) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  _drawStag(ctx, r) {
    // Glowing white deer (legendary)
    const glow = ctx.createRadialGradient(0, 0, r*0.2, 0, 0, r*2);
    glow.addColorStop(0, 'rgba(200,230,255,0.4)');
    glow.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, r*2, 0, Math.PI*2); ctx.fill();

    // Same shape as deer but white/silver
    // Legs
    ctx.fillStyle = '#d0d8e0';
    for (const [lx, ly] of [[-r*0.4, r*0.6],[r*0.4, r*0.6],[-r*0.2, r*0.7],[r*0.2, r*0.7]]) {
      ctx.fillRect(lx - 3, ly, 6, r*0.55);
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 0, r*0.75, r, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillRect(-r*0.25, -r*0.9, r*0.5, r*0.5);
    ctx.beginPath(); ctx.ellipse(0, -r*1.1, r*0.45, r*0.45, 0, 0, Math.PI*2); ctx.fill();

    // Golden antlers
    ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r*0.25, -r*1.4); ctx.lineTo(-r*0.6, -r*2.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r*0.45, -r*1.7); ctx.lineTo(-r*0.9, -r*1.75); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r*0.55, -r*1.95); ctx.lineTo(-r*0.2, -r*2.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( r*0.25, -r*1.4); ctx.lineTo( r*0.6, -r*2.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( r*0.45, -r*1.7); ctx.lineTo( r*0.9, -r*1.75); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( r*0.55, -r*1.95); ctx.lineTo( r*0.2, -r*2.1); ctx.stroke();

    // Sparkle particles
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const ang = (Date.now() * 0.002 + i * Math.PI/2) % (Math.PI*2);
      const px = Math.cos(ang) * r * 1.4;
      const py = Math.sin(ang) * r * 1.4;
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill();
    }

    // Eye (blue)
    ctx.fillStyle = '#4499ff';
    ctx.beginPath(); ctx.arc(-r*0.15, -r*1.15, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-r*0.12, -r*1.17, 1, 0, Math.PI*2); ctx.fill();
  }

  _drawBoar(ctx, r) {
    const c = this.hitFlash > 0 ? '#cc6666' : this.bodyColor;

    // Body
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, 0, r*0.9, r*0.75, 0, 0, Math.PI*2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.ellipse(0, -r*0.75, r*0.55, r*0.5, 0, 0, Math.PI*2);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#7a5a44';
    ctx.beginPath();
    ctx.ellipse(0, -r*0.55, r*0.28, r*0.22, 0, 0, Math.PI*2);
    ctx.fill();

    // Tusks
    ctx.strokeStyle = '#e8e0d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-r*0.18, -r*0.5, r*0.18, Math.PI*0.2, Math.PI*0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r*0.18, -r*0.5, r*0.18, Math.PI*0.1, Math.PI*0.8);
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-r*0.18, -r*0.86, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.18, -r*0.86, 2, 0, Math.PI*2); ctx.fill();

    // Bristle ridge
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r*0.55, -r*0.05);
    ctx.lineTo(0, -r*0.25);
    ctx.lineTo(r*0.55, -r*0.05);
    ctx.stroke();

    // Charge indicator
    if (this.state === STATE.CHARGE) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.45, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  _drawOwl(ctx, r) {
    const c = this.hitFlash > 0 ? '#ff9999' : this.bodyColor;

    // Wings
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(-r*0.7, r*0.1, r*0.55, r*0.3, -0.3, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(r*0.7, r*0.1, r*0.55, r*0.3, 0.3, 0, Math.PI*2);
    ctx.fill();

    // Body
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, 0, r*0.65, r*0.95, 0, 0, Math.PI*2);
    ctx.fill();

    // Face disk
    ctx.fillStyle = '#f0eadf';
    ctx.beginPath();
    ctx.ellipse(0, -r*0.25, r*0.55, r*0.6, 0, 0, Math.PI*2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-r*0.2, -r*0.3, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.2, -r*0.3, 3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-r*0.16, -r*0.34, 1, 0, Math.PI*2); ctx.fill();

    // Beak
    ctx.fillStyle = '#d4a017';
    ctx.beginPath();
    ctx.moveTo(0, -r*0.18);
    ctx.lineTo(-r*0.08, 0);
    ctx.lineTo(r*0.08, 0);
    ctx.closePath();
    ctx.fill();
  }

  _drawMoose(ctx, r) {
    const c = this.hitFlash > 0 ? '#ff9999' : this.bodyColor;

    // Legs
    ctx.fillStyle = '#7a5030';
    for (const [lx, ly] of [[-r*0.45, r*0.55],[r*0.45, r*0.55],[-r*0.2, r*0.65],[r*0.2, r*0.65]]) {
      ctx.fillRect(lx - 3, ly, 6, r*0.6);
    }

    // Body
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, 0, r*0.9, r*0.75, 0, 0, Math.PI*2);
    ctx.fill();

    // Neck + head
    ctx.fillRect(-r*0.18, -r*0.95, r*0.36, r*0.55);
    ctx.beginPath();
    ctx.ellipse(0, -r*1.1, r*0.5, r*0.45, 0, 0, Math.PI*2);
    ctx.fill();

    // Antlers
    ctx.strokeStyle = '#f0c040';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r*0.25, -r*1.35);
    ctx.lineTo(-r*0.65, -r*1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r*0.25, -r*1.35);
    ctx.lineTo(r*0.65, -r*1.85);
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-r*0.12, -r*1.15, 2.5, 0, Math.PI*2);
    ctx.fill();
  }

  _drawCougar(ctx, r) {
    const c = this.hitFlash > 0 ? '#ff9999' : this.bodyColor;

    // Tail
    ctx.strokeStyle = '#a7834a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r*0.85);
    ctx.lineTo(0, r*1.35);
    ctx.stroke();

    // Body
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(0, 0, r*0.75, r, 0, 0, Math.PI*2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.ellipse(0, -r*0.9, r*0.55, r*0.55, 0, 0, Math.PI*2);
    ctx.fill();

    // Ears
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-r*0.35, -r*1.2); ctx.lineTo(-r*0.2, -r*1.6); ctx.lineTo(-r*0.05, -r*1.2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r*0.35, -r*1.2); ctx.lineTo(r*0.2, -r*1.6); ctx.lineTo(r*0.05, -r*1.2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-r*0.16, -r, 2.2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(r*0.16, -r, 2.2, 0, Math.PI*2); ctx.fill();

    // Charge indicator
    if (this.state === STATE.CHARGE) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, 0, Math.PI*2);
      ctx.stroke();
    }
  }
}

// ── Animal Spawner ────────────────────────────────────
class AnimalSpawner {
  constructor() {
    this.animals  = [];
    this.rng      = seededRng(Date.now());
  }

  // Spawn a wave of animals for the given day number
  spawnDay(day, forest) {
    this.animals = [];
    const base = 7 + day * 3.1;

    // Passives
    const rabbitsCount = Math.floor(base * 1.55);
    const foxesCount = Math.floor(base * 0.78);
    const deerCount = Math.floor(base * 0.55);

    this._spawnType('rabbit', rabbitsCount, forest);
    this._spawnType('fox',    foxesCount, forest);
    this._spawnType('deer',   deerCount, forest);

    if (day >= 2) {
      const mooseCount = Math.max(1, Math.floor((day - 1) * 0.55));
      this._spawnType('moose', mooseCount, forest);
    }

    // Owls: small rare ambient target (more likely later)
    const owlsCount = Math.max(0, Math.floor((day - 1) * 0.35));
    if (owlsCount > 0) this._spawnType('owl', owlsCount, forest);

    // Predators
    // Wolf starts at Day 1
    const wolvesCount = Math.max(1, Math.floor(day * 0.8));
    this._spawnType('wolf', wolvesCount, forest);

    // Boar starts at Day 2
    if (day >= 2) {
      const boarsCount = Math.max(1, Math.floor((day - 1) * 0.55));
      this._spawnType('boar', boarsCount, forest);
    }

    // Bear starts at Day 2
    if (day >= 2) {
      const bearsCount = Math.max(1, Math.floor((day - 1) * 0.6));
      this._spawnType('bear', bearsCount, forest);
    }

    if (day >= 3) {
      const cougarsCount = Math.max(1, Math.floor((day - 2) * 0.55));
      this._spawnType('cougar', cougarsCount, forest);
    }

    // Legendary White Stag (rare, chance scales with day)
    const stagChance = 0.08 + day * 0.02;
    if (Math.random() < Math.min(0.25, stagChance)) {
      this._spawnType('stag', 1, forest);
    }
  }

  spawnNightBoost(day, forest) {
    // Add extra predators at night (keeps existing animals)
    const wolves = Math.max(1, Math.floor(1 + day * 0.35));
    const boars  = day >= 2 ? Math.max(1, Math.floor(1 + (day - 1) * 0.25)) : 0;
    const bears  = day >= 2 ? Math.max(1, Math.floor(1 + (day - 1) * 0.18)) : 0;
    const cougars = day >= 3 ? Math.max(1, Math.floor(1 + (day - 2) * 0.25)) : 0;

    this._spawnType('wolf', wolves, forest);
    if (boars > 0) this._spawnType('boar', boars, forest);
    if (bears > 0) this._spawnType('bear', bears, forest);
    if (cougars > 0) this._spawnType('cougar', cougars, forest);
  }

  _spawnType(type, count, forest) {
    for (let i = 0; i < count; i++) {
      const pos = forest.randomForestPos(this.rng);
      this.animals.push(new Animal(type, pos.x, pos.y));
    }
  }

  // Remove animals that have fully faded
  cleanup() {
    this.animals = this.animals.filter(a => !a.isDoneAnimating);
  }

  update(dt, player, forest) {
    this.cleanup();
    for (const a of this.animals) {
      a.update(dt, player, forest);
    }
  }

  draw(ctx, forest) {
    for (const a of this.animals) {
      a.draw(ctx, forest);
    }
  }

  get aliveAnimals() {
    return this.animals.filter(a => a.alive);
  }
}

// ── Utility: lerp ────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * Math.min(1, t); }

// ── Utility: lerp angle (shortest path) ──────────────
function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff >  Math.PI) diff -= Math.PI*2;
  while (diff < -Math.PI) diff += Math.PI*2;
  return a + diff * Math.min(1, t);
}
