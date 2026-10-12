/**
 * Makes everything the web page needs around the game and writes it to public/:
 *
 *   - the icon in the browser tab, the icons for a phone's home screen, and the preview shown when
 *     the game's address is shared: drawn by the game's own sprite painters, so they follow the art;
 *   - the small files browsers and search engines ask for (site.webmanifest, robots.txt, and
 *     sitemap.xml once the game has an address);
 *   - the privacy page.
 *
 *   npm run site
 *
 * Run it again after changing config/site.ts, the dewdrop, Claudia or the palette.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { paintBuildings } from '../src/art/buildings';
import { paintCreatures } from '../src/art/creatures';
import { paintIcons } from '../src/art/icons';
import { paintLandmarks } from '../src/art/landmarks';
import { paintNature } from '../src/art/nature';
import { pictureFrame } from '../src/art/teacherPicture';
import { PAL } from '../src/config/palette';
import { SITE } from '../src/config/site';
import type { Atlas } from '../src/engine/atlas';
import { FONT_HEIGHT, GLYPHS } from '../src/engine/font';
import { Pix } from '../src/engine/pix';

/** Every sprite the painters make, by name, each trimmed to what is drawn. */
const sprites = new Map<string, Pix>();
const collect = {
  add: (name: string, pix: Pix) => {
    const [x, y, w, h] = pix.bounds();
    sprites.set(name, pix.crop(x, y, w, h));
  },
  useSnow: () => {},
} as unknown as Atlas;
for (const paint of [paintNature, paintBuildings, paintLandmarks, paintCreatures, paintIcons]) paint(collect);
const sprite = (name: string) => {
  const found = sprites.get(name);
  if (!found) throw new Error(`No sprite called "${name}"`);
  return found;
};

/** Copy a sprite onto a picture, every pixel enlarged `zoom` times, with its top-left at (x, y). */
function stamp(onto: Pix, from: Pix, x: number, y: number, zoom: number): void {
  for (let j = 0; j < from.h; j++) {
    for (let i = 0; i < from.w; i++) {
      const raw = from.d[j * from.w + i];
      if (raw >>> 24 < 128) continue;
      for (let dy = 0; dy < zoom; dy++) {
        for (let dx = 0; dx < zoom; dx++) {
          const tx = x + i * zoom + dx;
          const ty = y + j * zoom + dy;
          if (tx >= 0 && ty >= 0 && tx < onto.w && ty < onto.h) onto.d[ty * onto.w + tx] = raw;
        }
      }
    }
  }
}

/** At this size the font's three-pixel W and M read as an H, so they get five pixels here. */
const WIDE: Record<string, string> = { W: '10001/10001/10101/10101/01010', M: '10001/11011/10101/10001/10001' };

/** Write a line of text in the game's own small letters, enlarged `zoom` times. */
function write(onto: Pix, text: string, x: number, y: number, zoom: number, color: number): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const rows = (WIDE[ch] ?? GLYPHS[ch] ?? GLYPHS['?']).split('/');
    rows.forEach((row, j) => [...row].forEach((bit, i) => bit === '1' && onto.rect(cx + i * zoom, y + j * zoom, zoom, zoom, color)));
    cx += (rows[0].length + 1) * zoom;
  }
}

function save(name: string, picture: Pix): void {
  const { w, h } = picture;
  const bytes = Buffer.from(picture.d.buffer);
  const rows = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) bytes.copy(rows, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (kind: string, body: Buffer) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(kind, 4, 'ascii');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)) >>> 0, 8 + body.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const file = new URL(`../public/${name}`, import.meta.url);
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
  console.log(`Wrote public/${name} (${w}×${h})`);
}

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });

/* ───────────────────────────── Icons: a dewdrop ───────────────────────────── */

const SEA = PAL.water[1];
const drop = sprite('res_dew');

/** The dewdrop in the middle of a square: see-through around it for a browser tab, on the sea's blue for a home screen. */
function icon(size: number, zoom: number, backdrop?: number): Pix {
  const picture = new Pix(size, size);
  if (backdrop !== undefined) picture.rect(0, 0, size, size, backdrop);
  stamp(picture, drop, Math.round((size - drop.w * zoom) / 2), Math.round((size - drop.h * zoom) / 2), zoom);
  return picture;
}

save('favicon.png', icon(64, 4));
save('apple-touch-icon.png', icon(180, 9, SEA));
save('icon-192.png', icon(192, 10, SEA));
save('icon-512.png', icon(512, 26, SEA));

/* ───────────────────────────── The preview for shared links ───────────────────────────── */

const [W, H] = [1200, 630];
const GROUND = 548;
const card = new Pix(W, H);

// A soft sky, the same one Claudia stands in front of in the game.
const [top, bottom] = [0xbfe0ff, 0xfff7e2];
for (let y = 0; y < GROUND; y++) {
  const t = y / (GROUND - 1);
  const channel = (shift: number) => Math.round(((top >> shift) & 0xff) + (((bottom >> shift) & 0xff) - ((top >> shift) & 0xff)) * t) << shift;
  card.rect(0, y, W, 1, channel(16) | channel(8) | channel(0));
}
// Grass along the bottom, with a darker line where it begins.
card.rect(0, GROUND, W, H - GROUND, PAL.grass[3]);
card.rect(0, GROUND, W, 6, PAL.grass[2]);
card.rect(0, GROUND + 6, W, 6, PAL.grass[4]);

// A few things from the world, standing in the grass: [sprite, left edge, how far its foot sinks below the grass line].
const ZOOM = 4;
for (const [name, x, sink] of [['oak_big', 592, 20], ['cottage_0', 738, 26], ['spring_0_0', 892, 46], ['shroomtree_1', 1064, 22], ['sproutling_0', 864, 62], ['fern_1', 704, 50], ['flower_tulip_red', 1040, 60], ['flower_daisy', 566, 46]] as const) {
  const s = sprite(name);
  stamp(card, s, x, GROUND + sink - s.h * ZOOM, ZOOM);
}

// Claudia, waving.
const claudia = pictureFrame('wave', 9);
stamp(card, claudia, 26, H - claudia.h * 7, 7);

write(card, 'Little', 600, 64, 14, PAL.night[1]);
write(card, 'Elsewhere', 600, 64 + (FONT_HEIGHT + 2) * 14, 14, PAL.night[1]);
write(card, 'Grow a tiny world', 602, 262, 5, PAL.wood[1]);
write(card, 'from a single spring', 602, 262 + (FONT_HEIGHT + 3) * 5, 5, PAL.wood[1]);

save('og.png', card);

/* ───────────────────────────── Files for browsers and search engines ───────────────────────────── */

function saveText(name: string, text: string): void {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), text);
  console.log(`Wrote public/${name}`);
}

saveText(
  'site.webmanifest',
  JSON.stringify(
    {
      name: SITE.name,
      short_name: SITE.name,
      description: SITE.description,
      start_url: '.',
      display: 'standalone',
      orientation: 'any',
      background_color: SITE.color,
      theme_color: SITE.color,
      icons: [192, 512].map((size) => ({ src: `icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any maskable' })),
    },
    null,
    2,
  ) + '\n',
);

saveText('robots.txt', `User-agent: *\nAllow: /\n${SITE.url ? `\nSitemap: ${SITE.url}sitemap.xml\n` : ''}`);
if (SITE.url) {
  const pages = ['', 'privacy.html'].map((page) => `  <url><loc>${SITE.url}${page}</loc></url>`).join('\n');
  saveText('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages}\n</urlset>\n`);
} else console.log('No sitemap.xml: SITE.url in src/config/site.ts is still empty.');

/* ───────────────────────────── The privacy page ───────────────────────────── */

/** When the words of the privacy page were last changed. */
const PRIVACY_DATE = '12 October 2026';

saveText(
  'privacy.html',
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacy - ${SITE.name}</title>
    <meta name="description" content="What ${SITE.name} saves and where: nothing leaves your device." />
    <meta name="theme-color" content="${SITE.color}" />
    <link rel="icon" type="image/png" href="favicon.png" />
    <style>
      body { margin: 0; background: #fff7e2; color: #3a2636; font: 17px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif; }
      main { max-width: 38rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
      h1 { font-size: 1.9rem; line-height: 1.2; margin: 1rem 0 0.25rem; }
      h2 { font-size: 1.15rem; margin: 2rem 0 0.25rem; }
      p { margin: 0.5rem 0; }
      a { color: #2e5bb5; }
      img { image-rendering: pixelated; }
      .small { color: #7a5a4a; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <main>
      <a href="./"><img src="favicon.png" width="48" height="48" alt="" /></a>
      <h1>Privacy</h1>
      <p class="small">${SITE.name} · last changed ${PRIVACY_DATE}</p>

      <p>${SITE.name} is a free hobby game made by <a href="${SITE.github}">${SITE.author}</a>. It has no accounts, no advertising and no analytics, and it does not use cookies.</p>

      <h2>What is saved, and where</h2>
      <p>Your progress and your settings are saved in your browser's local storage, on your own device. They are not sent to me or to anyone else.</p>
      <p>You can copy your save out and bring it back with a save code (Options, then Export or Import). You can erase it with Options, then Start over, or by clearing this site's data in your browser.</p>

      <h2>What the web host receives</h2>
      <p>The game is a set of plain files. To send them to you, the company that hosts this page receives your IP address and the usual technical details of your browser, as with any website, and may keep them in its logs for a while. I do not receive, look at or use that data.</p>
      <p>Once it has loaded, the game makes no connections to any other service.</p>

      <h2>Questions</h2>
      <p>You can reach me through <a href="${SITE.github}">GitHub</a>, or open an issue on <a href="${SITE.repo}">the game's page there</a>.</p>

      <p style="margin-top: 2.5rem"><a href="./">Back to the game</a></p>
    </main>
  </body>
</html>
`,
);
