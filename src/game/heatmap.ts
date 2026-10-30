import { DeathRecord } from './telemetry.js';

export class HeatmapRenderer {
  public enabled: boolean = false;

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  render(ctx: CanvasRenderingContext2D, deaths: DeathRecord[], cameraX: number, viewWidth: number) {
    if (!this.enabled || deaths.length === 0) return;

    ctx.save();

    deaths.forEach((d) => {
      const px = d.x - cameraX;
      const py = d.y;

      if (px < -50 || px > viewWidth + 50) return;

      // Radial glow around death point
      const grad = ctx.createRadialGradient(px, py, 4, px, py, 28);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.7)');
      grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, 28, 0, Math.PI * 2);
      ctx.fill();

      // Skull or 'X' marker
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('☠', px, py + 4);
    });

    ctx.restore();
  }

  generateSnapshot(canvas: HTMLCanvasElement): string {
    // Generate low-res base64 image for multimodal analysis
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 320;
    thumbCanvas.height = 180;
    const tCtx = thumbCanvas.getContext('2d');
    if (tCtx) {
      tCtx.drawImage(canvas, 0, 0, 320, 180);
      return thumbCanvas.toDataURL('image/jpeg', 0.6);
    }
    return '';
  }
}
