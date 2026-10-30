// خريطة المفاتيح لشاشة العرض. الكليكر يرسل غالباً PageDown/PageUp أو الأسهم، وزر «الشاشة السوداء» فيه يرسل B أو النقطة.
export type KeyAction = 'next' | 'prev' | 'first' | 'last' | 'fullscreen' | 'blackout';

export function keyAction(e: { key: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): KeyAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': case 'N': case 'n':
      return 'next';
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': case 'P': case 'p':
      return 'prev';
    case 'Home': return 'first';
    case 'End': return 'last';
    case '.': return 'blackout';
  }
  // بالحرف الفعلي على لوحة المفاتيح، فيعمل F وB مع اللوحة العربية أيضاً
  if (e.code === 'KeyF') return 'fullscreen';
  if (e.code === 'KeyB') return 'blackout';
  return null;
}

/** السحب أو اللمس: في الاتجاه من اليمين لليسار التالي يكون جهة اليسار، كصفحات الكتاب العربي */
export function touchAction(dx: number, dy: number, x: number, width: number): 'next' | 'prev' | null {
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'next' : 'prev';
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return x < width / 2 ? 'next' : 'prev';
  return null;
}

/** الأرقام 1–4 (العلوية أو لوحة الأرقام، وبالأرقام العربية) تقفز إلى مشهد في الديمو. يعيد ترتيب المشهد من 0 */
export function sceneKey(e: { key: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): number | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code ?? '');
  if (m) return Number(m[1]) - 1;
  const i = ['1', '2', '3', '4'].indexOf(e.key);
  if (i >= 0) return i;
  const a = ['١', '٢', '٣', '٤'].indexOf(e.key);
  return a >= 0 ? a : null;
}
