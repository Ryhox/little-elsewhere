/**
 * A tiny built-in bitmap font for text drawn inside the world (floating numbers, labels).
 * Glyphs are 5 pixels tall; rows are separated by "/".
 */
export const GLYPHS: Record<string, string> = {
  '0': '111/101/101/101/111', '1': '010/110/010/010/111', '2': '111/001/111/100/111', '3': '111/001/111/001/111', '4': '101/101/111/001/001',
  '5': '111/100/111/001/111', '6': '111/100/111/101/111', '7': '111/001/010/010/010', '8': '111/101/111/101/111', '9': '111/101/111/001/111',
  A: '010/101/111/101/101', B: '110/101/110/101/110', C: '011/100/100/100/011', D: '110/101/101/101/110', E: '111/100/110/100/111',
  F: '111/100/110/100/100', G: '011/100/101/101/011', H: '101/101/111/101/101', I: '111/010/010/010/111', J: '001/001/001/101/010',
  K: '101/101/110/101/101', L: '100/100/100/100/111', M: '101/111/111/101/101', N: '110/101/101/101/101', O: '010/101/101/101/010',
  P: '110/101/110/100/100', Q: '010/101/101/110/011', R: '110/101/110/101/101', S: '011/100/010/001/110', T: '111/010/010/010/010',
  U: '101/101/101/101/111', V: '101/101/101/101/010', W: '101/101/111/111/101', X: '101/101/010/101/101', Y: '101/101/010/010/010',
  Z: '111/001/010/100/111', '+': '000/010/111/010/000', '-': '000/000/111/000/000', '.': '0/0/0/0/1', ',': '0/0/0/1/1',
  '%': '101/001/010/100/101', '/': '001/001/010/100/100', '!': '1/1/1/0/1', '?': '111/001/010/000/010', ':': '0/1/0/1/0',
  '×': '000/101/010/101/000', "'": '1/1/0/0/0', ' ': '00/00/00/00/00',
};

export const FONT_HEIGHT = 5;
const OUTLINE = 1;

interface Glyph {
  x: number;
  w: number;
}

/**
 * Bakes the font once per colour (with a dark outline for legibility over any background)
 * and draws strings by blitting glyphs.
 */
export class PixelFont {
  private sheets = new Map<string, HTMLCanvasElement>();
  private layout = new Map<string, Glyph>();
  private width = 0;

  constructor(private readonly outline: string) {
    let x = 0;
    for (const ch of Object.keys(GLYPHS)) {
      const w = GLYPHS[ch].split('/')[0].length;
      this.layout.set(ch, { x, w });
      x += w + OUTLINE * 2 + 1;
    }
    this.width = x;
  }

  private sheet(color: string): HTMLCanvasElement {
    let sheet = this.sheets.get(color);
    if (sheet) return sheet;
    sheet = document.createElement('canvas');
    sheet.width = this.width;
    sheet.height = FONT_HEIGHT + OUTLINE * 2;
    const ctx = sheet.getContext('2d')!;
    const paint = (dx: number, dy: number, fill: string) => {
      ctx.fillStyle = fill;
      for (const [ch, glyph] of this.layout) {
        GLYPHS[ch].split('/').forEach((row, y) => {
          for (let i = 0; i < row.length; i++) if (row[i] === '1') ctx.fillRect(glyph.x + OUTLINE + i + dx, OUTLINE + y + dy, 1, 1);
        });
      }
    };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) paint(dx, dy, this.outline);
    paint(0, 0, color);
    this.sheets.set(color, sheet);
    return sheet;
  }

  /** Width of a string in font pixels (before scaling). */
  measure(text: string): number {
    let w = 0;
    for (const ch of text.toUpperCase()) w += (this.layout.get(ch)?.w ?? 3) + 1;
    return Math.max(0, w - 1);
  }

  /** Draw text with its top-left at (x, y); `align` 0.5 centres it on x. */
  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1, align = 0): void {
    const sheet = this.sheet(color);
    const upper = text.toUpperCase();
    let cx = Math.round(x - this.measure(upper) * scale * align) - OUTLINE * scale;
    const top = Math.round(y) - OUTLINE * scale;
    for (const ch of upper) {
      const glyph = this.layout.get(ch) ?? this.layout.get('?')!;
      const w = glyph.w + OUTLINE * 2;
      ctx.drawImage(sheet, glyph.x, 0, w, FONT_HEIGHT + OUTLINE * 2, cx, top, w * scale, (FONT_HEIGHT + OUTLINE * 2) * scale);
      cx += (glyph.w + 1) * scale;
    }
  }
}
