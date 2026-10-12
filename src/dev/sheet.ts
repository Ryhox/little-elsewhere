import { buildAtlas } from '@/art';

/**
 * Dev-only sprite viewer. Open the game with `?sheet` to inspect every sprite,
 * or `?sheet=oak` to filter by name. `&zoom=6` changes the magnification.
 */
export function mountSpriteSheet(root: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const filter = params.get('sheet') ?? '';
  const zoom = Number(params.get('zoom') ?? 4);
  const atlas = buildAtlas();

  root.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;padding:12px;background:#57a94a;min-height:100vh;align-items:flex-end;font:10px monospace;color:#12331c';
  for (const name of atlas.names().sort()) {
    if (filter && !name.includes(filter)) continue;
    const sprite = atlas.get(name);
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px';
    const canvas = document.createElement('canvas');
    canvas.width = sprite.w * zoom;
    canvas.height = sprite.h * zoom;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas.canvas, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, canvas.width, canvas.height);
    cell.append(canvas, name);
    root.append(cell);
  }
}
