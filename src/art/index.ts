import { Atlas } from '@/engine/atlas';
import { paintBuildings } from './buildings';
import { paintCreatures } from './creatures';
import { paintFx } from './fx';
import { paintIcons } from './icons';
import { snowify } from './kit';
import { paintLandmarks } from './landmarks';
import { paintNature } from './nature';
import { paintSea } from './sea';
import { paintTeacher } from './teacher';

/** Every sprite generator, in paint order. Add a new module here to extend the game's art. */
const GENERATORS: ((atlas: Atlas) => void)[] = [paintNature, paintBuildings, paintLandmarks, paintCreatures, paintSea, paintTeacher, paintFx, paintIcons];

let atlas: Atlas | null = null;

/** Paint and pack the whole game's art. Cheap enough to run once at boot. */
export function buildAtlas(): Atlas {
  if (atlas) return atlas;
  const next = new Atlas();
  next.useSnow(snowify);
  for (const generate of GENERATORS) generate(next);
  next.pack();
  atlas = next;
  return next;
}
