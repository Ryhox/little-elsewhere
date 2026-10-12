const root = document.getElementById('root')!;

const params = new URLSearchParams(location.search);
if (params.has('sheet')) {
  void import('./dev/sheet').then((m) => m.mountSpriteSheet(root));
} else if (params.has('looks')) {
  void import('./dev/looks').then((m) => m.mountTeacherLooks(root));
} else if (params.has('teacher')) {
  void import('./dev/gestures').then((m) => m.mountTeacherGestures(root));
} else {
  void import('./boot').then((m) => m.boot(root));
}
