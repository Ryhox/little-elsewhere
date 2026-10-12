const root = document.getElementById('root')!;

if (new URLSearchParams(location.search).has('sheet')) {
  void import('./dev/sheet').then((m) => m.mountSpriteSheet(root));
} else {
  void import('./boot').then((m) => m.boot(root));
}
