import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite';
import { SITE } from './src/config/site';

/**
 * Writes the page's title, its icons and its notes for search engines and link previews into
 * index.html, all from config/site.ts. The pictures and files they point at are in public/
 * (made by `npm run site`).
 */
function siteHead(): Plugin {
  const meta = (name: string, content: string): HtmlTagDescriptor => ({ tag: 'meta', attrs: { name, content }, injectTo: 'head' });
  const graph = (property: string, content: string): HtmlTagDescriptor => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' });
  const link = (rel: string, href: string, more: Record<string, string> = {}): HtmlTagDescriptor => ({ tag: 'link', attrs: { rel, href, ...more }, injectTo: 'head' });
  // Link previews only load a picture from a full address.
  const preview = `${SITE.url}og.png`;
  const game = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: SITE.name,
    description: SITE.description,
    ...(SITE.url ? { url: SITE.url, image: preview } : {}),
    genre: ['Idle game', 'Incremental game', 'Simulation'],
    gamePlatform: 'Web browser',
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    playMode: 'SinglePlayer',
    inLanguage: 'en',
    author: { '@type': 'Person', name: SITE.author, url: SITE.github },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  };
  return {
    name: 'site-head',
    transformIndexHtml: () => [
      { tag: 'title', children: SITE.title, injectTo: 'head' },
      meta('description', SITE.description),
      meta('author', SITE.author),
      meta('theme-color', SITE.color),
      // Added to a phone's home screen, the game opens like an app: no browser bars, the sea right up to the edges.
      meta('mobile-web-app-capable', 'yes'),
      meta('apple-mobile-web-app-capable', 'yes'),
      meta('apple-mobile-web-app-status-bar-style', 'black-translucent'),
      meta('apple-mobile-web-app-title', SITE.name),
      meta('format-detection', 'telephone=no'),
      link('icon', 'favicon.png', { type: 'image/png' }),
      link('apple-touch-icon', 'apple-touch-icon.png'),
      link('manifest', 'site.webmanifest'),
      ...(SITE.url ? [link('canonical', SITE.url), graph('og:url', SITE.url)] : []),
      graph('og:type', 'website'),
      graph('og:site_name', SITE.name),
      graph('og:title', SITE.title),
      graph('og:description', SITE.description),
      graph('og:locale', 'en_US'),
      graph('og:image', preview),
      graph('og:image:width', '1200'),
      graph('og:image:height', '630'),
      graph('og:image:alt', 'Claudia, the teacher of Little Elsewhere, waving beside a tree, a cottage and the spring'),
      meta('twitter:card', 'summary_large_image'),
      meta('twitter:title', SITE.title),
      meta('twitter:description', SITE.description),
      meta('twitter:image', preview),
      { tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(game), injectTo: 'head' },
    ],
  };
}

export default defineConfig({
  // Every address in the built game is relative, so it works from any folder of a website.
  base: './',
  plugins: [react(), tailwindcss(), siteHead()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5183 },
});
