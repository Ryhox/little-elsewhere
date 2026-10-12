import { RENDER } from '@/config/render';
import type { Camera } from '@/engine/camera';
import { FONT_HEIGHT, type PixelFont } from '@/engine/font';

interface Floater {
  text: string;
  x: number;
  y: number;
  age: number;
  color: string;
  big: boolean;
}

/** Numbers and short messages that drift up from where something happened. Drawn in screen space so they stay readable at any zoom. */
export class Floaters {
  private items: Floater[] = [];

  add(text: string, worldX: number, worldY: number, color: string, big = false): void {
    if (this.items.length >= RENDER.floaters.max) this.items.shift();
    this.items.push({ text, x: worldX + (Math.random() - 0.5) * 8, y: worldY, age: 0, color, big });
  }

  clear(): void {
    this.items.length = 0;
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.age += dt;
      if (f.age >= RENDER.floaters.seconds * (f.big ? 1.8 : 1)) this.items.splice(i, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, font: PixelFont, scale: number): void {
    const { rise, seconds } = RENDER.floaters;
    for (const f of this.items) {
      const life = seconds * (f.big ? 1.8 : 1);
      const t = f.age / life;
      // Ease out: quick at first, then hanging in the air.
      const lift = (1 - (1 - t) ** 2) * rise * (f.big ? 1.4 : 1);
      const size = scale * (f.big ? 2 : 1);
      // A little pop on arrival.
      const pop = t < 0.12 ? 1 + (0.12 - t) * 3 : 1;
      ctx.globalAlpha = t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1;
      font.draw(ctx, f.text, camera.toScreenX(f.x), camera.toScreenY(f.y - lift) - FONT_HEIGHT * size * pop, f.color, Math.max(1, Math.round(size * pop)), 0.5);
    }
    ctx.globalAlpha = 1;
  }
}
