/* =====================================================
   arrow.js — Arrow Projectile System
   Handles: arrow creation, movement, collision
====================================================== */

'use strict';

// ── Arrow configuration ──────────────────────────────
const ARROW_BASE_SPEED   = 540;  // px / second (base)
const ARROW_LENGTH       = 22;   // visual length of the arrow shaft
const ARROW_LIFETIME     = 2.2;  // seconds before arrow disappears

class Arrow {
  /**
   * @param {number} x      - World X origin
   * @param {number} y      - World Y origin
   * @param {number} angle  - Direction in radians
   * @param {number} speed  - Pixels per second
   */
  constructor(x, y, angle, speed) {
    this.startX = x;
    this.startY = y;
    this.x      = x;
    this.y      = y;
    this.angle  = angle;
    this.speed  = speed;
    this.vx     = Math.cos(angle) * speed;
    this.vy     = Math.sin(angle) * speed;
    this.alive  = true;
    this.age    = 0;           // seconds since creation
    this.stuck  = false;       // true when embedded in a tree
    this.stuckTimer = 0;       // how long it's been stuck
  }

  // ── Update position ──────────────────────────────
  update(dt, forest) {
    if (this.stuck) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.5) this.alive = false;
      return;
    }

    this.age += dt;
    if (this.age > ARROW_LIFETIME) {
      this.alive = false;
      return;
    }

    // Move
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    // Check travel distance limit: 250px
    const dx = nx - this.startX;
    const dy = ny - this.startY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 250) {
      this.alive = false;
      return;
    }

    // Check world bounds
    if (nx < 0 || nx > WORLD_W || ny < 0 || ny > WORLD_H) {
      this.alive = false;
      return;
    }

    // Check tree collision
    if (forest.isInsideTree(nx, ny)) {
      this.stuck = true;
      return;
    }

    this.x = nx;
    this.y = ny;
  }

  // ── Draw ──────────────────────────────────────────
  draw(ctx, forest) {
    if (!this.alive) return;
    const { sx, sy } = forest.toScreen(this.x, this.y);

    // Fade out when stuck or near end of life
    let alpha = 1;
    if (this.stuck) {
      alpha = Math.max(0, 1 - this.stuckTimer / 1.5);
    } else if (this.age > ARROW_LIFETIME - 0.4) {
      alpha = (ARROW_LIFETIME - this.age) / 0.4;
    }
    ctx.globalAlpha = Math.max(0, alpha);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-ARROW_LENGTH/2 + 2, 2, ARROW_LENGTH, 2);

    // Shaft
    ctx.fillStyle = '#c8a265';
    ctx.fillRect(-ARROW_LENGTH/2, -1, ARROW_LENGTH, 2);

    // Arrowhead
    ctx.fillStyle = '#9a9a9a';
    ctx.beginPath();
    ctx.moveTo(ARROW_LENGTH/2, 0);
    ctx.lineTo(ARROW_LENGTH/2 - 7, -3);
    ctx.lineTo(ARROW_LENGTH/2 - 7,  3);
    ctx.closePath();
    ctx.fill();

    // Fletching (feathers at the tail)
    ctx.fillStyle = '#e8d5a3';
    ctx.beginPath();
    ctx.moveTo(-ARROW_LENGTH/2, 0);
    ctx.lineTo(-ARROW_LENGTH/2 + 6, -4);
    ctx.lineTo(-ARROW_LENGTH/2 + 3, 0);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-ARROW_LENGTH/2, 0);
    ctx.lineTo(-ARROW_LENGTH/2 + 6,  4);
    ctx.lineTo(-ARROW_LENGTH/2 + 3, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ── Collision check with an animal ───────────────
  // Returns true if this arrow hits the given animal
  hits(animal) {
    if (!this.alive || this.stuck) return false;
    const dx = this.x - animal.x;
    const dy = this.y - animal.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    return dist < animal.hitRadius;
  }
}

// ── Arrow Manager ────────────────────────────────────
// Owns the pool of live arrows and handles bulk updates
class ArrowManager {
  constructor() {
    this.arrows = [];
  }

  // Spawn a new arrow from the player
  shoot(player) {
    const speed = ARROW_BASE_SPEED * (player.upgrades.bow + 1) * 0.7;
    const a = new Arrow(player.x, player.y, player.aimAngle, speed);
    this.arrows.push(a);
    player.arrows--;
    return a;
  }

  // Update all arrows; return list of arrows that hit an animal
  update(dt, forest, animals) {
    const hits = []; // { arrow, animal }

    for (const arrow of this.arrows) {
      arrow.update(dt, forest);

      if (!arrow.stuck && arrow.alive) {
        for (const animal of animals) {
          if (!animal.alive) continue;
          if (arrow.hits(animal)) {
            hits.push({ arrow, animal });
            arrow.alive = false; // arrow is consumed on hit
            break;
          }
        }
      }
    }

    // Remove dead arrows
    this.arrows = this.arrows.filter(a => a.alive);

    return hits;
  }

  draw(ctx, forest) {
    for (const arrow of this.arrows) {
      arrow.draw(ctx, forest);
    }
  }

  clear() {
    this.arrows = [];
  }
}
