'use strict';

class LightingSystem {
  constructor() {
    this.nightAlpha = 0;
    this.fadeSpeed = 0.9; // alpha per second

    this.lightRadius = 260; // pixels on screen
    this.lightSoftness = 180;
  }

  setNight(isNight) {
    this.targetAlpha = isNight ? 0.88 : 0;
  }

  update(dt) {
    if (this.targetAlpha === undefined) this.targetAlpha = 0;
    const diff = this.targetAlpha - this.nightAlpha;
    const step = Math.sign(diff) * this.fadeSpeed * dt;
    if (Math.abs(step) >= Math.abs(diff)) this.nightAlpha = this.targetAlpha;
    else this.nightAlpha += step;
  }

  draw(ctx, player, forest, canvasW, canvasH) {
    if (this.nightAlpha <= 0.001) return;

    const { sx, sy } = forest.toScreen(player.x, player.y);

    ctx.save();

    // Night darkness overlay (radial gradient): inside the light circle stays clear
    // so it remains as visible as daytime, while the outside darkens.
    ctx.globalCompositeOperation = 'source-over';
    const r0 = Math.max(20, this.lightRadius - this.lightSoftness);
    const grad = ctx.createRadialGradient(sx, sy, r0, sx, sy, this.lightRadius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${this.nightAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const dusk = Math.max(0, Math.min(1, 1 - (this.nightAlpha / 0.7)));
    if (dusk > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      const glowR = this.lightRadius + 6;
      const ring = ctx.createRadialGradient(sx, sy, glowR - 50, sx, sy, glowR + 80);
      ring.addColorStop(0, `rgba(255, 220, 140, ${0.10 * dusk})`);
      ring.addColorStop(0.45, `rgba(255, 200, 120, ${0.22 * dusk})`);
      ring.addColorStop(1, 'rgba(255, 200, 120, 0)');
      ctx.strokeStyle = ring;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
}
