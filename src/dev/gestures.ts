import { PICTURE_FRAME, pictureFrame } from '@/art/teacherPicture';
import { PICTURE_ANIMS, TEACHER_PICTURE, type TeacherAnimName } from '@/config/teacher';

/**
 * Dev-only viewer for the teacher's gestures. Open the game with `?teacher` to watch every one of
 * them playing at once, or `?teacher=wave` for just one. `&zoom=5` changes the size and `&talk`
 * makes her speak. Click a gesture to start it again from its first frame.
 */
export function mountTeacherGestures(root: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const only = params.get('teacher');
  const zoom = Number(params.get('zoom') ?? 3);
  const talking = params.has('talk');

  root.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;padding:14px;background:#4e2c20;min-height:100vh;box-sizing:border-box;overflow:auto;height:100%;align-content:flex-start;font:14px/1.2 monospace;color:#fff7e2';
  for (const name of Object.keys(PICTURE_ANIMS) as TeacherAnimName[]) {
    if (only && name !== only) continue;
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer';
    const canvas = document.createElement('canvas');
    canvas.width = PICTURE_FRAME.w;
    canvas.height = PICTURE_FRAME.h;
    canvas.style.cssText = `width:${PICTURE_FRAME.w * zoom}px;height:${PICTURE_FRAME.h * zoom}px;image-rendering:pixelated;background:linear-gradient(#bfe0ff,#fff7e2);border:3px solid #d0b481`;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;
    const draw = () => ctx.putImageData(pictureFrame(name, frame++, talking).toImageData(), 0, 0);
    draw();
    setInterval(draw, 1000 / TEACHER_PICTURE.fps);
    cell.onclick = () => (frame = 0);
    cell.append(canvas, name);
    root.append(cell);
  }
}
