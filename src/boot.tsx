import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { buildAtlas } from './art';
import { buildCursors } from './art/cursors';
import { buildUiSkin } from './art/ui';
import './index.css';
import { App } from './ui/App';

/** Paint the art, skin the interface and the mouse pointers, then hand over to React. */
export function boot(root: HTMLElement): void {
  buildAtlas();
  for (const [name, value] of Object.entries({ ...buildUiSkin(), ...buildCursors() })) document.documentElement.style.setProperty(name, value);
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
