import { paintTeacherLooks } from '@/art/teacher';
import { TEACHER, TEACHER_LOOKS, TEACHER_PICTURE } from '@/config/teacher';
import { Atlas } from '@/engine/atlas';

/**
 * Dev-only chooser for the teacher's look. Open the game with `?looks` to see every look in
 * config/teacher.ts side by side (`&zoom=5` changes the size). To use one, set `TEACHER.look`
 * to its letter.
 */
export function mountTeacherLooks(root: HTMLElement): void {
  const zoom = Number(new URLSearchParams(location.search).get('zoom') ?? 4);
  const atlas = new Atlas();
  paintTeacherLooks(atlas);
  atlas.pack();

  root.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;padding:16px;background:#bfe0ff;min-height:100vh;box-sizing:border-box;overflow:auto;height:100%;font:13px/1.25 monospace;color:#23285a;user-select:text';
  for (const look of [{ id: 'picture', label: TEACHER_PICTURE.label }, ...TEACHER_LOOKS]) {
    const sprite = atlas.get(`teacher_look_${look.id}`);
    const cell = document.createElement('div');
    cell.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px;background:#fff7e2;border:3px solid ${look.id === TEACHER.look ? '#f2bc36' : '#d0b481'}`;
    const canvas = document.createElement('canvas');
    canvas.width = sprite.w * zoom;
    canvas.height = sprite.h * zoom;
    canvas.style.imageRendering = 'pixelated';
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas.canvas, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, canvas.width, canvas.height);
    const title = document.createElement('b');
    title.style.fontSize = '22px';
    title.textContent = look.id + (look.id === TEACHER.look ? ' (in the game now)' : '');
    const label = document.createElement('div');
    label.style.textAlign = 'center';
    label.textContent = look.label;
    cell.append(title, canvas, label);
    root.append(cell);
  }
}
