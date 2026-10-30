// الجولة التلقائية في صفحة من المنصة: الصفحة كاملة أولاً، ثم كل بطاقة بترتيب القراءة،
// والبطاقة التي لا تتسع بحجم مقروء تُستعرض أجزاءً (زواياها) من أعلى اليمين.
// البطاقات تُقرأ من الصفحة نفسها (data-demo-card على مكوّن Card)، فأي شاشة جديدة تدخل الجولة بلا كود.
import { PAGE_W, READABLE, focus, type Cam, type Rect, type View } from './camera';

export interface DemoCard {
  key: string;
  label: string;
  rect: Rect;
}

export interface Shot {
  kind: 'overview' | 'card' | 'part';
  /** مفتاح ثابت للخطوة (لمددها الخاصة في المحرّر): صفحة|بطاقة|جزء */
  key: string;
  label: string;
  /** المنطقة المقرّبة (لا شيء للصفحة كاملة) */
  rect: Rect | null;
}

/** أقصى عدد أجزاء للبطاقة الواحدة: بعده تُعرض أجزاؤها الأولى فقط (الأعلى أهم) */
export const MAX_PARTS = 6;
const ROW_TOLERANCE = 24;

function rectOf(el: Element): Rect | null {
  const r = el.getBoundingClientRect();
  return r.width > 40 && r.height > 40 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
}

/** اسم بطاقة بلا عنوان نصي: أول عنوان فيها، وإلا أول سطر من نصها */
function headingOf(el: Element) {
  const h = el.querySelector('h1, h2, h3, h4, [role="heading"]')?.textContent?.trim();
  const line = h || (el as HTMLElement).innerText?.split('\n').map((x) => x.trim()).find((x) => x.length > 1);
  return line ? (line.length > 36 ? line.slice(0, 34) + '…' : line) : '';
}

/**
 * بطاقات الصفحة من DOM: كل عنصر بـ data-demo-card داخل main، والبطاقة التي تحوي بطاقات أخرى
 * تُستبدل بها (الأدق أوضح)، ورأس الصفحة (h1 خارج البطاقات) بطاقةً أولى.
 */
export function detectCards(doc: Document): DemoCard[] {
  const main = doc.querySelector('main');
  if (!main) return [];
  const all = [...main.querySelectorAll<HTMLElement>('[data-demo-card]')];
  let leaves: HTMLElement[] = all.filter((el) => !el.querySelector('[data-demo-card]') && !el.closest('[data-demo-skip]'));
  // صفحة بلا بطاقات معلَّمة (قائمة بمكوّن خاص): عناصر شبكتها الرئيسية بطاقاتٍ
  if (!leaves.length) leaves = [...main.querySelectorAll<HTMLElement>('.grid > *')].filter((el) => !el.closest('[data-demo-skip]'));
  const out: DemoCard[] = [];
  const h1 = main.querySelector('h1');
  if (h1 && !h1.closest('[data-demo-card]')) {
    // رأس الصفحة: أوسع كتلة حول العنوان لا تضم بطاقات ولا تتجاوز ثلث الشاشة طولاً
    let head: Element = h1;
    for (let p = h1.parentElement; p && p !== main && !p.querySelector('[data-demo-card]'); p = p.parentElement) {
      if (p.getBoundingClientRect().height > 320) break;
      head = p;
    }
    const r = rectOf(head);
    if (r) out.push({ key: 'رأس الصفحة', label: 'رأس الصفحة', rect: r });
  }
  const seen = new Map<string, number>();
  leaves.forEach((el, i) => {
    const r = rectOf(el);
    if (!r) return;
    const name = el.dataset.demoCard || headingOf(el) || `بطاقة ${i + 1}`;
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    out.push({ key: n > 1 ? `${name} ${n}` : name, label: n > 1 ? `${name} (${n})` : name, rect: r });
  });
  return out;
}

/** مواضع المحتوى المرئي في الصفحة (نصوص وصور ورسوم وحقول): لتخطّي أجزاء البطاقة الفارغة */
export function contentRects(doc: Document): Rect[] {
  const main = doc.querySelector('main');
  if (!main) return [];
  const out: Rect[] = [];
  const walker = doc.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width > 2 && r.height > 2) out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
  }
  for (const el of main.querySelectorAll('img, svg, input, textarea, select, canvas')) {
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4) out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return out;
}

const clip = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
};

/** مساحة المحتوى داخل منطقة */
export const contentArea = (part: Rect, content: Rect[]) => content.reduce((a, c) => {
  const k = clip(c, part);
  return a + (k ? k.w * k.h : 0);
}, 0);

/** جزء محتواه أقل من هذه النسبة من أغنى أجزاء البطاقة يُهمل (شارة أو زر وحيد على الطرف) */
export const MINOR_PART = 0.15;

/** الجزء مضيّقاً على ما فيه من محتوى، أو لا شيء إن كان فارغاً */
export function fitToContent(part: Rect, content: Rect[]): Rect | null {
  const inside = content.map((c) => clip(c, part)).filter((c): c is Rect => !!c && c.w * c.h > 16);
  if (!inside.length) return null;
  const x = Math.min(...inside.map((c) => c.x));
  const y = Math.min(...inside.map((c) => c.y));
  return { x, y, w: Math.max(...inside.map((c) => c.x + c.w)) - x, h: Math.max(...inside.map((c) => c.y + c.h)) - y };
}

/** ترتيب القراءة بالعربية: صفوفاً من الأعلى، وفي الصف من اليمين */
export function readingOrder(cards: DemoCard[]): DemoCard[] {
  const sorted = [...cards].sort((a, b) => a.rect.y - b.rect.y);
  const rows: DemoCard[][] = [];
  for (const c of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].rect.y - c.rect.y) <= ROW_TOLERANCE) row.push(c);
    else rows.push([c]);
  }
  return rows.flatMap((r) => r.sort((a, b) => b.rect.x + b.rect.w - (a.rect.x + a.rect.w)));
}

export interface TourOpts {
  /** التكبير المقروء بوحدة شاشة 1920 */
  readable?: number;
  pad?: number;
  /** مواضع المحتوى: الأجزاء الفارغة تُتخطّى والممتلئة تُضيَّق على محتواها */
  content?: Rect[];
}

/** أجزاء بطاقة كبيرة: شبكة متساوية كل خانة فيها تتسع على الشاشة بالتكبير المقروء، من أعلى اليمين */
export function partsOf(r: Rect, view: View, opts: TourOpts = {}): Rect[] {
  const s = (opts.readable ?? READABLE) * (view.w / 1920);
  const pad = opts.pad ?? 32;
  const visW = view.w / s - pad * 2;
  const visH = view.h / s - pad * 2;
  if (r.w <= visW && r.h <= visH) return [r];
  const cols = Math.ceil(r.w / visW);
  const rows = Math.ceil(r.h / visH);
  const w = r.w / cols;
  const h = r.h / rows;
  const out: Rect[] = [];
  for (let row = 0; row < rows; row++) for (let c = 0; c < cols; c++) out.push({ x: r.x + r.w - (c + 1) * w, y: r.y + row * h, w, h });
  return out.slice(0, MAX_PARTS);
}

/** خطوات الجولة في صفحة */
export function planTour(page: string, cards: DemoCard[], view: View, opts: TourOpts = {}): Shot[] {
  const shots: Shot[] = [{ kind: 'overview', key: `${page}|الصفحة`, label: 'الصفحة كاملة', rect: null }];
  for (const c of readingOrder(cards)) {
    let parts = partsOf(c.rect, view, opts);
    if (parts.length > 1 && opts.content) {
      const areas = parts.map((p) => contentArea(p, opts.content!));
      const most = Math.max(...areas);
      parts = parts.filter((_, i) => areas[i] >= most * MINOR_PART).map((p) => fitToContent(p, opts.content!)).filter((p): p is Rect => !!p);
    }
    // بعد التضييق قد يتسع المحتوى كله في لقطة واحدة
    if (parts.length > 1 && opts.content) {
      const all = fitToContent(c.rect, opts.content);
      if (all && partsOf(all, view, opts).length === 1) parts = [all];
    }
    if (parts.length <= 1) shots.push({ kind: 'card', key: `${page}|${c.key}`, label: c.label, rect: parts[0] ?? c.rect });
    else parts.forEach((p, i) => shots.push({ kind: 'part', key: `${page}|${c.key}|${i + 1}`, label: `${c.label} · الجزء ${i + 1} من ${parts.length}`, rect: p }));
  }
  return shots;
}

/** الكاميرا لخطوة: الصفحة كاملة بعرض الشاشة من أعلاها، أو تقريب مقروء على المنطقة */
export function shotCam(shot: Shot, view: View, pageH: number, end = 0, opts: TourOpts = {}): Cam {
  if (!shot.rect) return { s: view.w / PAGE_W, tx: 0, ty: 0 };
  const min = opts.readable ?? READABLE;
  return focus(shot.rect, view, pageH, { pad: opts.pad ?? 32, min, max: Math.max(min, 2.6), end });
}

/** الخطوات المعروضة: مدة 0 في المحرّر تعني تخطّي الخطوة */
export const visibleShots = (shots: Shot[], durations: Record<string, number>) => shots.filter((s) => durations[s.key] !== 0);

/** مدة الخطوة بالملّي ثانية: الخاصة إن وُجدت، وإلا العامة */
export const shotDuration = (shot: Shot, dwell: number, durations: Record<string, number>) => Math.round((durations[shot.key] ?? dwell) * 1000);
