/**
 * The game as a web page: what it is called, who made it and where it lives. The page's title and
 * the notes it gives search engines and link previews (vite.config.ts), the files written by
 * `npm run site`, and the links at the bottom of Options all come from here.
 */
export const SITE = {
  name: 'Little Elsewhere',
  /** The browser tab's title, and the headline of a link preview. */
  title: 'Little Elsewhere: a cozy pixel-art idle game',
  /** One or two sentences for search results and link previews. */
  description: 'Grow a tiny magical world from a single spring. A cozy pixel-art idle game that runs in your browser: plant, build, befriend little creatures and turn the seasons. Free, with no account and no ads.',
  /**
   * The full address the game is published at, ending in a slash, for example
   * 'https://example.com/little-elsewhere/'. Leave it empty until the game is online: search
   * engines and link previews only accept full addresses, so without one those notes are left out.
   * Run `npm run site` again after changing it.
   */
  url: '',
  author: 'Ryhox',
  /** The author's GitHub page, and the game's repository there. */
  github: 'https://github.com/Ryhox',
  repo: 'https://github.com/Ryhox/little-elsewhere',
  /** The colour of the browser's bars around the game: the deep blue of its sea. */
  color: '#2a4fa0',
} as const;
