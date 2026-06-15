/* =====================================================
   forest.js — Forest / World Generation
   Handles: tile map, trees, camp area, camera
====================================================== */

'use strict';

// ── World constants ──────────────────────────────────
const WORLD_W = 3200;  // total world width  (px)
const WORLD_H = 3200;  // total world height (px)
const TILE    = 64;    // base tile size for layout

// Camp is placed near the center of the world
const CAMP_X  = WORLD_W / 2;
const CAMP_Y  = WORLD_H / 2;
const CAMP_RADIUS = 140; // safe zone radius around camp

// ── Color palette for the forest floor ──────────────
const GRASS_COLORS = [
  '#2d5a27', '#336b2d', '#2a5224',
  '#305c29', '#3a6e34', '#284e22'
];

// ── Forest class ─────────────────────────────────────
class Forest {
  constructor() {
    // Camera offset (world coordinates of top-left corner of viewport)
    this.camX = 0;
    this.camY = 0;

    // Arrays of decoration objects
    this.trees    = [];   // { x, y, r, color, trunkH, trunkW }
    this.bushes   = [];   // { x, y, r }
    this.flowers  = [];   // { x, y, color }
    this.rocks    = [];   // { x, y, r }
    this.patches  = [];   // { x, y, w, h, color }  — grass color variation

    this._generateWorld();
  }

  // ── World generation ─────────────────────────────
  _generateWorld() {
    const rng = seededRng(42); // deterministic world

    // — Grass patches (color variation on the floor)
    for (let i = 0; i < 200; i++) {
      this.patches.push({
        x: rng() * WORLD_W,
        y: rng() * WORLD_H,
        w: 80 + rng() * 160,
        h: 60 + rng() * 120,
        color: GRASS_COLORS[Math.floor(rng() * GRASS_COLORS.length)]
      });
    }

    // — Trees
    const treeCount = 600;
    for (let i = 0; i < treeCount; i++) {
      const x = rng() * WORLD_W;
      const y = rng() * WORLD_H;

      // Keep trees away from camp center
      const dx = x - CAMP_X, dy = y - CAMP_Y;
      if (Math.sqrt(dx*dx + dy*dy) < CAMP_RADIUS + 80) continue;

      const r = 14 + rng() * 18;         // canopy radius
      const green = Math.floor(rng() * 3);
      const treeGreens = ['#1d5c1d', '#256025', '#2d742d'];
      this.trees.push({
        x, y, r,
        color: treeGreens[green],
        shadow: '#122012',
        trunkH: r * 0.6,
        trunkW: r * 0.22
      });
    }

    // — Rocks
    for (let i = 0; i < 120; i++) {
      const x = rng() * WORLD_W;
      const y = rng() * WORLD_H;
      const dx = x - CAMP_X, dy = y - CAMP_Y;
      if (Math.sqrt(dx*dx + dy*dy) < CAMP_RADIUS + 30) continue;
      this.rocks.push({ x, y, r: 5 + rng() * 14 });
    }

    // — Bushes
    for (let i = 0; i < 250; i++) {
      const x = rng() * WORLD_W;
      const y = rng() * WORLD_H;
      const dx = x - CAMP_X, dy = y - CAMP_Y;
      if (Math.sqrt(dx*dx + dy*dy) < CAMP_RADIUS + 20) continue;
      this.bushes.push({ x, y, r: 8 + rng() * 10 });
    }

    // — Flowers (small colour dots)
    for (let i = 0; i < 300; i++) {
      this.flowers.push({
        x: rng() * WORLD_W,
        y: rng() * WORLD_H,
        color: ['#f7d794','#f8a5c2','#778ca3','#e77f67'][Math.floor(rng()*4)]
      });
    }
  }

  // ── Camera update ─────────────────────────────────
  // Centers the camera on (targetX, targetY), clamped to world bounds
  updateCamera(targetX, targetY, canvasW, canvasH) {
    this.camX = targetX - canvasW / 2;
    this.camY = targetY - canvasH / 2;

    // Clamp so the view doesn't go outside the world
    this.camX = Math.max(0, Math.min(WORLD_W - canvasW, this.camX));
    this.camY = Math.max(0, Math.min(WORLD_H - canvasH, this.camY));
  }

  // ── Convert world → screen ────────────────────────
  toScreen(wx, wy) {
    return { sx: wx - this.camX, sy: wy - this.camY };
  }

  // ── Convert screen → world ────────────────────────
  toWorld(sx, sy) {
    return { wx: sx + this.camX, wy: sy + this.camY };
  }

  // ── Draw floor (background + decorations) ────────
  drawFloor(ctx, canvasW, canvasH) {
    // Base grass fill
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw grass patches
    for (const p of this.patches) {
      const { sx, sy } = this.toScreen(p.x, p.y);
      if (sx + p.w < 0 || sy + p.h < 0 || sx > canvasW || sy > canvasH) continue;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(sx, sy, p.w/2, p.h/2, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // Draw flowers
    for (const f of this.flowers) {
      const { sx, sy } = this.toScreen(f.x, f.y);
      if (sx < -4 || sy < -4 || sx > canvasW+4 || sy > canvasH+4) continue;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI*2);
      ctx.fill();
    }

    // Draw rocks
    for (const r of this.rocks) {
      const { sx, sy } = this.toScreen(r.x, r.y);
      if (sx < -r.r || sy < -r.r || sx > canvasW+r.r || sy > canvasH+r.r) continue;
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.ellipse(sx, sy, r.r, r.r*0.65, 0.3, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#777';
      ctx.beginPath();
      ctx.ellipse(sx - r.r*0.15, sy - r.r*0.2, r.r*0.5, r.r*0.3, 0.3, 0, Math.PI*2);
      ctx.fill();
    }

    // Draw bushes
    for (const b of this.bushes) {
      const { sx, sy } = this.toScreen(b.x, b.y);
      if (sx < -b.r || sy < -b.r || sx > canvasW+b.r || sy > canvasH+b.r) continue;
      ctx.fillStyle = '#1a4a1a';
      ctx.beginPath();
      ctx.arc(sx, sy, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#246024';
      ctx.beginPath();
      ctx.arc(sx - b.r*0.25, sy - b.r*0.2, b.r*0.65, 0, Math.PI*2);
      ctx.fill();
    }

    // Draw world border (fog of edges)
    this._drawBorder(ctx, canvasW, canvasH);
  }

  // ── Draw trees (above everything else) ───────────
  drawTrees(ctx, canvasW, canvasH) {
    for (const t of this.trees) {
      const { sx, sy } = this.toScreen(t.x, t.y);
      if (sx < -t.r*2 || sy < -t.r*2 || sx > canvasW+t.r*2 || sy > canvasH+t.r*2) continue;
      this._drawTree(ctx, sx, sy, t);
    }
  }

  _drawTree(ctx, sx, sy, t) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(sx + t.r*0.3, sy + t.r*0.4, t.r*0.9, t.r*0.4, 0, 0, Math.PI*2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5c3d1e';
    ctx.fillRect(sx - t.trunkW/2, sy - t.trunkH*0.3, t.trunkW, t.trunkH);

    // Canopy layers
    ctx.fillStyle = t.shadow;
    ctx.beginPath();
    ctx.arc(sx, sy - t.r*0.1, t.r, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(sx - t.r*0.1, sy - t.r*0.3, t.r*0.85, 0, Math.PI*2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(sx - t.r*0.25, sy - t.r*0.45, t.r*0.45, 0, Math.PI*2);
    ctx.fill();
  }

  // ── Camp drawing ──────────────────────────────────
  drawCamp(ctx) {
    const { sx, sy } = this.toScreen(CAMP_X, CAMP_Y);

    // Camp clearing
    const grad = ctx.createRadialGradient(sx, sy, 20, sx, sy, CAMP_RADIUS);
    grad.addColorStop(0, 'rgba(180,140,80,0.25)');
    grad.addColorStop(1, 'rgba(180,140,80,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, CAMP_RADIUS, 0, Math.PI*2);
    ctx.fill();

    // Ground under camp (packed dirt)
    ctx.fillStyle = '#8B6914';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 10, 90, 55, 0, 0, Math.PI*2);
    ctx.fill();

    // Campfire glow (animated pulsing in game.js via time)
    const glowSize = 30 + Math.sin(Date.now() * 0.004) * 8;
    const glow = ctx.createRadialGradient(sx, sy - 20, 2, sx, sy - 20, glowSize);
    glow.addColorStop(0, 'rgba(255,160,40,0.6)');
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy - 20, glowSize, 0, Math.PI*2);
    ctx.fill();

    // Fire logs
    ctx.fillStyle = '#5c3d1e';
    ctx.fillRect(sx - 16, sy - 16, 32, 8);
    ctx.fillRect(sx - 10, sy - 22, 20, 8);

    // Fire flames
    this._drawFlame(ctx, sx, sy - 22, 14);

    // Tent
    this._drawTent(ctx, sx - 50, sy - 10);

    // Camp label
    ctx.fillStyle = 'rgba(240,192,64,0.85)';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛺ CAMP', sx, sy - 80);

    // Enter-zone ring
    ctx.strokeStyle = 'rgba(240,192,64,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(sx, sy, CAMP_RADIUS, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawFlame(ctx, x, y, size) {
    const t = Date.now() * 0.006;
    // Three layered flame tongues
    const layers = [
      { color: '#ff8c00', sx: -3, sy: 0,  s: 1.0 },
      { color: '#ff4500', sx:  2, sy: 2,  s: 0.75 },
      { color: '#ffdd00', sx: -1, sy: 4,  s: 0.5 }
    ];
    for (const l of layers) {
      const flicker = Math.sin(t + l.sx) * 3;
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.moveTo(x + l.sx + flicker, y + l.sy);
      ctx.bezierCurveTo(
        x + l.sx + size*l.s*0.4 + flicker, y + l.sy - size*l.s*0.5,
        x + l.sx + size*l.s*0.2 + flicker, y + l.sy - size*l.s,
        x + l.sx + flicker, y + l.sy - size*l.s * 1.4
      );
      ctx.bezierCurveTo(
        x + l.sx - size*l.s*0.2 + flicker, y + l.sy - size*l.s,
        x + l.sx - size*l.s*0.4 + flicker, y + l.sy - size*l.s*0.5,
        x + l.sx + flicker, y + l.sy
      );
      ctx.fill();
    }
  }

  _drawTent(ctx, x, y) {
    // Tent body
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(x, y - 30);
    ctx.lineTo(x + 50, y + 10);
    ctx.lineTo(x - 10, y + 10);
    ctx.closePath();
    ctx.fill();

    // Tent shading
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 30);
    ctx.lineTo(x + 50, y + 10);
    ctx.lineTo(x + 10, y + 10);
    ctx.closePath();
    ctx.fill();

    // Door
    ctx.fillStyle = '#3d1a00';
    ctx.beginPath();
    ctx.ellipse(x + 18, y + 10, 9, 12, 0, Math.PI, 0);
    ctx.fill();
  }

  // ── World edge darkening ───────────────────────────
  _drawBorder(ctx, canvasW, canvasH) {
    const margin = 80;

    // Left
    const lg = ctx.createLinearGradient(0, 0, margin, 0);
    lg.addColorStop(0, 'rgba(0,0,0,0.6)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, margin, canvasH);

    // Right
    const rg = ctx.createLinearGradient(canvasW, 0, canvasW - margin, 0);
    rg.addColorStop(0, 'rgba(0,0,0,0.6)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(canvasW - margin, 0, margin, canvasH);

    // Top
    const tg = ctx.createLinearGradient(0, 0, 0, margin);
    tg.addColorStop(0, 'rgba(0,0,0,0.6)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, canvasW, margin);

    // Bottom
    const bg = ctx.createLinearGradient(0, canvasH, 0, canvasH - margin);
    bg.addColorStop(0, 'rgba(0,0,0,0.6)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, canvasH - margin, canvasW, margin);
  }

  // ── Collision: is point inside a tree? ────────────
  isInsideTree(wx, wy) {
    for (const t of this.trees) {
      const dx = wx - t.x, dy = wy - t.y;
      if (dx*dx + dy*dy < (t.r * 0.6) * (t.r * 0.6)) return true;
    }
    return false;
  }

  // ── Check if within camp radius ───────────────────
  isInCamp(wx, wy) {
    const dx = wx - CAMP_X, dy = wy - CAMP_Y;
    return Math.sqrt(dx*dx + dy*dy) < CAMP_RADIUS;
  }

  // ── Random world position (not inside tree or camp) ──
  randomForestPos(rng) {
    let x, y, tries = 0;
    do {
      x = 100 + rng() * (WORLD_W - 200);
      y = 100 + rng() * (WORLD_H - 200);
      tries++;
    } while ((this.isInsideTree(x, y) || this.isInCamp(x, y)) && tries < 50);
    return { x, y };
  }

  // ── Mini-map (small overview in corner) ───────────
  drawMinimap(ctx, player, animals, canvasW, canvasH) {
    const mapW = 140, mapH = 140;
    const mx = canvasW - mapW - 16;
    const my = 60;
    const scaleX = mapW / WORLD_W;
    const scaleY = mapH / WORLD_H;

    // Background
    ctx.fillStyle = 'rgba(5,12,5,0.82)';
    roundRect(ctx, mx, my, mapW, mapH, 6);
    ctx.fill();
    ctx.strokeStyle = '#2a3d2a';
    ctx.lineWidth = 1;
    roundRect(ctx, mx, my, mapW, mapH, 6);
    ctx.stroke();

    // Trees (dots)
    ctx.fillStyle = '#1a4a1a';
    for (const t of this.trees) {
      ctx.fillRect(mx + t.x * scaleX, my + t.y * scaleY, 1, 1);
    }

    // Camp
    ctx.fillStyle = '#f0c040';
    ctx.beginPath();
    ctx.arc(mx + CAMP_X * scaleX, my + CAMP_Y * scaleY, 3, 0, Math.PI*2);
    ctx.fill();

    // Animals
    for (const a of animals) {
      if (!a.alive) continue;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(mx + a.x * scaleX, my + a.y * scaleY, 1.5, 0, Math.PI*2);
      ctx.fill();
    }

    // Player
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + player.x * scaleX, my + player.y * scaleY, 2.5, 0, Math.PI*2);
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(170,200,170,0.6)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MAP', mx + mapW/2, my + mapH + 12);
  }
}

// ── Utility: seeded random number generator ──────────
// Mulberry32 — fast, simple, deterministic
function seededRng(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Utility: rounded rectangle path ─────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
