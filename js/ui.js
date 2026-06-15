/* =====================================================
   ui.js — User Interface Manager
   Handles: HUD updates, screens, shop, floating text,
            kill feed, crosshair, notifications
====================================================== */

'use strict';

// ── Shop upgrade definitions ─────────────────────────
const UPGRADES = [
  {
    key:   'bow',
    icon:  '🏹',
    name:  'Bow Upgrade',
    desc:  'Faster arrows & quicker reload',
    costs: [60, 150, 300]     // cost per level
  },
  {
    key:   'quiver',
    icon:  '📦',
    name:  'Quiver Upgrade',
    desc:  '+5 max arrows per level',
    costs: [40, 100, 200]
  },
  {
    key:   'boots',
    icon:  '👢',
    name:  'Boot Upgrade',
    desc:  '+20% movement speed per level',
    costs: [80, 180, 350]
  },
  {
    key:   'backpack',
    icon:  '🎒',
    name:  'Backpack Upgrade',
    desc:  '+2 bag slots per level',
    costs: [50, 120, 250]
  }
];
const MAX_UPGRADE_LEVEL = 3;

// ── Floating Text (damage / pickup numbers) ──────────
class FloatingText {
  constructor(x, y, text, color = '#ffffff', size = 16) {
    this.x     = x;
    this.y     = y;
    this.text  = text;
    this.color = color;
    this.size  = size;
    this.life  = 1.2;
    this.vy    = -55;    // float upward
  }

  update(dt) {
    this.life -= dt;
    this.y    += this.vy * dt;
    this.vy   *= 0.94;
  }

  draw(ctx, forest) {
    const { sx, sy } = forest.toScreen(this.x, this.y);
    const alpha = Math.min(1, this.life / 0.4);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = `bold ${this.size}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = this.color;
    // Outline for readability
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, sx, sy);
    ctx.fillText(this.text, sx, sy);
    ctx.globalAlpha = 1;
  }

  get isDone() { return this.life <= 0; }
}

// ── Kill Feed entry ───────────────────────────────────
class KillFeedEntry {
  constructor(text) {
    this.text = text;
    this.life = 3.5;
  }
  update(dt) { this.life -= dt; }
  get isDone() { return this.life <= 0; }
}

// ── UI Manager ────────────────────────────────────────
class UIManager {
  constructor() {
    // DOM references
    this.hud         = document.getElementById('hud');
    this.dayVal      = document.getElementById('day-val');
    this.moneyVal    = document.getElementById('money-val');
    this.arrowsVal   = document.getElementById('arrows-val');
    this.bagVal      = document.getElementById('bag-val');
    this.bagMax      = document.getElementById('bag-max');
    this.healthBar   = document.getElementById('health-bar');
    this.staminaBar  = document.getElementById('stamina-bar');

    this.questPanel  = document.getElementById('hud-quest');
    this.questToggle = document.getElementById('quest-toggle');

    this.screenTitle    = document.getElementById('screen-title');
    this.screenCamp     = document.getElementById('screen-camp');
    this.screenPause    = document.getElementById('screen-pause');
    this.screenGameover = document.getElementById('screen-gameover');
    this.campMsg        = document.getElementById('camp-msg');
    this.shopGrid       = document.getElementById('shop-grid');
    this.goStats        = document.getElementById('go-stats');

    // Canvas elements
    this.floatingTexts = [];
    this.killFeed      = [];

    // Mouse position on screen
    this.mouse = { x: 0, y: 0 };

    // Notification queue
    this.notifications = [];

    // Track last arrow count for pickup events
    this._lastArrows = 0;
    this.flashRedAlpha = 0;

    if (this.questToggle && this.questPanel) {
      this.questToggle.addEventListener('click', () => {
        this.questPanel.classList.toggle('hidden');
      });
    }
  }

  // ── Show / hide screens ───────────────────────────
  showTitle()    { this._show('title'); }
  showCamp(player, msg) {
    this._show('camp');
    this.campMsg.textContent = msg || '';
    this._renderShop(player);
  }
  showPause()    { this._show('pause'); }
  showGameover(player) {
    this._show('gameover');
    this._renderGameoverStats(player);
  }
  showHUD() {
    this.hud.classList.remove('hidden');
    if (this.questToggle) this.questToggle.classList.remove('hidden');
    if (this.questPanel) this.questPanel.classList.add('hidden');
  }
  hideHUD() {
    this.hud.classList.add('hidden');
    if (this.questToggle) this.questToggle.classList.add('hidden');
    if (this.questPanel) this.questPanel.classList.add('hidden');
  }

  _show(name) {
    const ids = ['title','camp','pause','gameover'];
    for (const id of ids) {
      document.getElementById(`screen-${id}`).classList.add('hidden');
    }
    document.getElementById(`screen-${name}`).classList.remove('hidden');
  }

  hideAll() {
    const ids = ['title','camp','pause','gameover'];
    for (const id of ids) {
      document.getElementById(`screen-${id}`).classList.add('hidden');
    }
  }

  // ── Update HUD elements ───────────────────────────
  updateHUD(player) {
    this.dayVal.textContent    = player.day;
    this.moneyVal.textContent  = `$${player.money}`;
    this.arrowsVal.textContent = player.arrows;
    this.bagVal.textContent    = player.bag.length;
    this.bagMax.textContent    = player.bagMax + player.upgrades.backpack * 2;

    const hPct = Math.max(0, player.health / player.maxHealth * 100);
    const sPct = Math.max(0, player.stamina / PLAYER_STAMINA_MAX * 100);
    this.healthBar.style.width  = hPct + '%';
    this.staminaBar.style.width = sPct + '%';

    // Health color
    this.healthBar.style.background = hPct > 50
      ? 'linear-gradient(90deg,#27ae60,#2ecc71)'
      : hPct > 25
        ? 'linear-gradient(90deg,#d4a017,#f0c040)'
        : 'linear-gradient(90deg,#c0392b,#e74c3c)';
  }

  updateQuestHUD(quest, progress) {
    const qDesc = document.getElementById('quest-desc');
    const qProg = document.getElementById('quest-progress');
    if (qDesc && qProg) {
      if (quest) {
        qDesc.textContent = quest.desc;
        qProg.textContent = `${progress} / ${quest.targetCount}`;
        if (this.questToggle) {
          this.questToggle.textContent = '!';
          this.questToggle.classList.add('active');
        }
      } else {
        qDesc.textContent = 'None';
        qProg.textContent = '0 / 0';
        if (this.questToggle) {
          this.questToggle.textContent = '?';
          this.questToggle.classList.remove('active');
        }
      }
    }
  }

  flashRed() {
    this.flashRedAlpha = 0.65;
  }

  // ── Floating text ─────────────────────────────────
  spawnFloatingText(wx, wy, text, color, size) {
    this.floatingTexts.push(new FloatingText(wx, wy, text, color, size));
  }

  // ── Kill feed ─────────────────────────────────────
  addKill(animal) {
    const icons = { rabbit:'🐇', fox:'🦊', deer:'🦌', bear:'🐻', stag:'✨', wolf:'🐺', boar:'🐗', owl:'🦉', moose:'🫎', cougar:'🐆' };
    const text  = `${icons[animal.type]||'?'} ${animal.name} — $${animal.value}`;
    this.killFeed.push(new KillFeedEntry(text));
    if (this.killFeed.length > 5) this.killFeed.shift();
  }

  // ── Notification banner ───────────────────────────
  addNotification(text, color = '#f0c040') {
    this.notifications.push({ text, color, life: 2.5 });
  }

  // ── Update everything ─────────────────────────────
  update(dt) {
    this.floatingTexts = this.floatingTexts.filter(f => { f.update(dt); return !f.isDone; });
    this.killFeed      = this.killFeed.filter(k => { k.update(dt); return !k.isDone; });
    this.notifications = this.notifications.filter(n => { n.life -= dt; return n.life > 0; });
    
    if (this.flashRedAlpha > 0) {
      this.flashRedAlpha -= dt * 2.0;
      if (this.flashRedAlpha < 0) this.flashRedAlpha = 0;
    }
  }

  // ── Canvas draw calls ─────────────────────────────
  draw(ctx, forest, player, canvasW, canvasH) {
    // Floating texts
    for (const ft of this.floatingTexts) ft.draw(ctx, forest);

    // Kill feed (top-left, below HUD)
    this._drawKillFeed(ctx, canvasW);

    // Notifications (centre-top)
    this._drawNotifications(ctx, canvasW, canvasH);

    // In-camp indicator
    if (forest.isInCamp(player.x, player.y)) {
      this._drawCampHint(ctx, canvasW, canvasH);
    }

    // Bag full warning
    const bagFull = player.bag.length >= player.bagMax + player.upgrades.backpack * 2;
    if (bagFull) {
      this._drawBagFull(ctx, canvasW, canvasH);
    }

    // Crosshair at aim target
    this._drawCrosshair(ctx, player, forest);

    // Low health vignette
    if (player.health < 30) {
      this._drawDangerVignette(ctx, player, canvasW, canvasH);
    }

    // Aim line (faint dotted line from player to crosshair)
    this._drawAimLine(ctx, player, forest);

    // Brief red screen flash when hit
    if (this.flashRedAlpha > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${this.flashRedAlpha})`;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
  }

  _drawKillFeed(ctx, canvasW) {
    let y = 110;
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    for (const k of this.killFeed) {
      const alpha = Math.min(1, k.life / 0.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const w = ctx.measureText(k.text).width + 16;
      roundRect(ctx, 14, y - 14, w, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#f0e8c8';
      ctx.fillText(k.text, 22, y);
      y += 24;
    }
    ctx.globalAlpha = 1;
  }

  _drawNotifications(ctx, canvasW, canvasH) {
    let y = canvasH * 0.22;
    for (const n of this.notifications) {
      const alpha = Math.min(1, n.life / 0.4);
      ctx.globalAlpha = alpha * 0.95;
      ctx.font = 'bold 18px Cinzel, serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(n.text).width + 32;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      roundRect(ctx, canvasW/2 - w/2, y - 22, w, 32, 8);
      ctx.fill();
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, canvasW/2, y);
      y += 44;
    }
    ctx.globalAlpha = 1;
  }

  _drawCampHint(ctx, canvasW, canvasH) {
    ctx.globalAlpha = 0.85;
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const text = 'Press  E  to return to camp';
    const w = ctx.measureText(text).width + 24;
    roundRect(ctx, canvasW/2 - w/2, canvasH - 70, w, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#f0c040';
    ctx.fillText(text, canvasW/2, canvasH - 52);
    ctx.globalAlpha = 1;
  }

  _drawBagFull(ctx, canvasW, canvasH) {
    const pulse = 0.5 + Math.sin(Date.now() * 0.006) * 0.5;
    ctx.globalAlpha = 0.6 + pulse * 0.35;
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('🎒 Bag Full! Return to camp.', canvasW - 20, 90);
    ctx.globalAlpha = 1;
  }

  _drawCrosshair(ctx, player, forest) {
    // Crosshair at aim point (150px from player in aim direction)
    const dist = 150;
    const wx = player.x + Math.cos(player.aimAngle) * dist;
    const wy = player.y + Math.sin(player.aimAngle) * dist;
    const { sx, sy } = forest.toScreen(wx, wy);

    const r = 10;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;

    // Cross lines
    ctx.beginPath();
    ctx.moveTo(sx - r, sy); ctx.lineTo(sx - 3, sy);
    ctx.moveTo(sx + 3, sy); ctx.lineTo(sx + r, sy);
    ctx.moveTo(sx, sy - r); ctx.lineTo(sx, sy - 3);
    ctx.moveTo(sx, sy + 3); ctx.lineTo(sx, sy + r);
    ctx.stroke();

    // Circle
    ctx.beginPath();
    ctx.arc(sx, sy, 5, 0, Math.PI*2);
    ctx.stroke();

    // Cooldown indicator
    if (player.shootTimer > 0) {
      const pct = 1 - player.shootTimer / player.shootSpeed;
      ctx.strokeStyle = 'rgba(255,200,60,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 8, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
      ctx.stroke();
    }
  }

  _drawAimLine(ctx, player, forest) {
    const { sx: px, sy: py } = forest.toScreen(player.x, player.y);
    const dist = 120;
    const ex = px + Math.cos(player.aimAngle) * dist;
    const ey = py + Math.sin(player.aimAngle) * dist;

    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  _drawDangerVignette(ctx, player, canvasW, canvasH) {
    const intensity = (1 - player.health / 30) * 0.5;
    const pulse = Math.sin(Date.now() * 0.004) * 0.15;
    const alpha = intensity + pulse;

    const grad = ctx.createRadialGradient(canvasW/2, canvasH/2, canvasH*0.2, canvasW/2, canvasH/2, canvasH*0.8);
    grad.addColorStop(0, 'rgba(150,0,0,0)');
    grad.addColorStop(1, `rgba(150,0,0,${Math.min(0.7, alpha)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // ── Shop rendering ────────────────────────────────
  _renderShop(player) {
    this.shopGrid.innerHTML = '';
    for (const upg of UPGRADES) {
      const level = player.upgrades[upg.key] || 0;
      const maxed = level >= MAX_UPGRADE_LEVEL;
      const cost  = maxed ? null : upg.costs[level];
      const canAfford = !maxed && player.money >= cost;

      const div = document.createElement('div');
      div.className = 'shop-item' + (!canAfford && !maxed ? ' disabled' : '');

      div.innerHTML = `
        <div class="shop-icon">${upg.icon}</div>
        <div class="shop-name">${upg.name}</div>
        <div class="shop-desc">${upg.desc}</div>
        <div class="shop-cost">
          ${maxed
            ? '<span style="color:#5aab5a">✔ MAX</span>'
            : canAfford
              ? `$${cost}`
              : `<span style="color:#888">$${cost}</span>`
          }
        </div>
        <div style="margin-top:6px;font-size:0.72rem;color:#556;">
          ${'★'.repeat(level)}${'☆'.repeat(MAX_UPGRADE_LEVEL - level)}
        </div>
      `;

      if (!maxed && canAfford) {
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => {
          if (player.money >= cost) {
            player.money  -= cost;
            player.upgrades[upg.key]++;
            this.addNotification(`${upg.icon} ${upg.name} upgraded!`, '#f0c040');
            // Re-render shop
            this._renderShop(player);
          }
        });
      }

      this.shopGrid.appendChild(div);
    }

    // Buy arrows item
    const arrowCost = 20;
    const canBuyArrows = player.money >= arrowCost;
    const atMax = player.arrows >= player.maxArrows;
    const arrowDiv = document.createElement('div');
    arrowDiv.className = 'shop-item' + (!canBuyArrows || atMax ? ' disabled' : '');
    arrowDiv.innerHTML = `
      <div class="shop-icon">🪶</div>
      <div class="shop-name">Arrows</div>
      <div class="shop-desc">Buy 5 arrows</div>
      <div class="shop-cost">${atMax ? '<span style="color:#5aab5a">Max</span>' : canBuyArrows ? `$${arrowCost}` : `<span style="color:#888">$${arrowCost}</span>`}</div>
    `;
    if (canBuyArrows && !atMax) {
      arrowDiv.addEventListener('click', () => {
        if (player.money >= arrowCost && player.arrows < player.maxArrows) {
          player.money -= arrowCost;
          player.arrows = Math.min(player.maxArrows, player.arrows + 5);
          this.addNotification('🪶 Bought 5 arrows!', '#aad4ff');
          this._renderShop(player);
        }
      });
    }
    this.shopGrid.appendChild(arrowDiv);
  }

  // ── Game over stats ───────────────────────────────
  _renderGameoverStats(player) {
    const icons = { rabbit:'🐇', fox:'🦊', deer:'🦌', bear:'🐻', stag:'✨' };
    let html = `
      <p>📅 Days survived: <strong>${player.day}</strong></p>
      <p>💰 Total earned: <strong>$${player.totalMoney}</strong></p>
      <p>Animals hunted:</p>
      <ul style="list-style:none;padding:6px 0 0 10px;">
    `;
    for (const [type, count] of Object.entries(player.totalKills)) {
      if (count > 0) {
        html += `<li>${icons[type]||'?'} ${type}: <strong>${count}</strong></li>`;
      }
    }
    html += '</ul>';
    this.goStats.innerHTML = html;
  }
}
