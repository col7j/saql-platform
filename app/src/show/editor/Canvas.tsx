// لوحة التحرير: نفس عرض الشريحة، وفوقه طبقة التحديد: سحب وتغيير حجم ودوران وتحديد بالمستطيل وخطوط إرشاد.
// التعديل أثناء السحب مسودة محلية، ويُحفظ مرة واحدة عند إفلات المؤشر (خطوة واحدة في التراجع).
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { LOGOS } from '../brand/brand';
import { CANVAS, type SlideElement, type SlideSettings } from '../slides/model';
import { SlideCanvas } from '../slides/SlideView';
import { HANDLES, bounds, resizeElement, rotation, round, snapMove, snapResize, snapTargets, unionRect, type Guide, type Handle, type Rect } from './geometry';

interface Props {
  settings: SlideSettings;
  step: number;
  selection: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onChange: (elements: SlideElement[]) => void;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onTextCommit: (id: string, text: string) => void;
}

type Drag =
  | { mode: 'move'; x: number; y: number; orig: SlideElement[]; moved: boolean }
  | { mode: 'resize'; x: number; y: number; orig: SlideElement; handle: Handle; moved: boolean }
  | { mode: 'rotate'; orig: SlideElement; moved: boolean }
  | { mode: 'marquee'; x: number; y: number; additive: Set<string>; moved: boolean };

const CURSOR: Record<Handle, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };
const HANDLE_POS: Record<Handle, [number, number]> = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };

export default function EditorCanvas({ settings, step, selection, onSelect, onChange, editingId, onEdit, onTextCommit }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draft, setDraft] = useState<SlideElement[] | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const drag = useRef<Drag | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const s = size.w && size.h ? Math.min((size.w - 32) / CANVAS.w, (size.h - 32) / CANVAS.h) : 0;
  const elements = draft ?? settings.elements;
  const shown = { ...settings, elements };
  const selected = elements.filter((e) => selection.has(e.id));
  const single = selected.length === 1 ? selected[0] : null;

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  };
  const threshold = 8 / Math.max(s, 0.01);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !s) return;
    const target = e.target as HTMLElement;
    if (target.closest('[contenteditable="true"]')) return;
    const p = toCanvas(e);
    const handle = target.dataset.handle as Handle | 'rot' | undefined;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (handle && single && !single.locked) {
      drag.current = handle === 'rot' ? { mode: 'rotate', orig: single, moved: false } : { mode: 'resize', x: p.x, y: p.y, orig: single, handle, moved: false };
      return;
    }
    const hit = target.closest<HTMLElement>('[data-el]')?.dataset.el;
    if (editingId && hit !== editingId) onEdit(null);
    if (!hit) {
      drag.current = { mode: 'marquee', x: p.x, y: p.y, additive: e.shiftKey ? new Set(selection) : new Set(), moved: false };
      if (!e.shiftKey) onSelect(new Set());
      return;
    }
    let next = selection;
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      next = new Set(selection);
      next.has(hit) ? next.delete(hit) : next.add(hit);
      onSelect(next);
    } else if (!selection.has(hit)) {
      next = new Set([hit]);
      onSelect(next);
    }
    const movable = settings.elements.filter((x) => next.has(x.id) && !x.locked);
    drag.current = movable.length ? { mode: 'move', x: p.x, y: p.y, orig: movable, moved: false } : null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toCanvas(e);
    const others = () => settings.elements.filter((x) => !selection.has(x.id)).map(bounds);
    if (d.mode === 'move') {
      let dx = p.x - d.x;
      let dy = p.y - d.y;
      if (!d.moved && Math.hypot(dx, dy) * s < 3) return;
      d.moved = true;
      if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
      const u = unionRect(d.orig.map(bounds));
      let g: Guide[] = [];
      if (!e.altKey) {
        const snap = snapMove({ ...u, x: u.x + dx, y: u.y + dy }, snapTargets(others()), threshold);
        dx += snap.dx;
        dy += snap.dy;
        g = snap.guides;
      }
      const moved = new Map(d.orig.map((o) => [o.id, { ...o, x: round(o.x + dx), y: round(o.y + dy) }]));
      setDraft(settings.elements.map((x) => moved.get(x.id) ?? x));
      setGuides(g);
    } else if (d.mode === 'resize') {
      d.moved = true;
      const o = d.orig;
      const minW = o.type === 'logo' ? LOGOS[o.props.kind].minWidth : 0;
      let r = resizeElement(o, d.handle, p.x - d.x, p.y - d.y, e.shiftKey, minW);
      let g: Guide[] = [];
      if (!o.rot && !e.altKey && !(o.type === 'logo' || e.shiftKey)) {
        const snap = snapResize(r, d.handle, snapTargets(others()), threshold);
        r = snap.rect;
        g = snap.guides;
      }
      setDraft(settings.elements.map((x) => (x.id === o.id ? ({ ...x, ...r } as SlideElement) : x)));
      setGuides(g);
    } else if (d.mode === 'rotate') {
      d.moved = true;
      const rot = rotation(d.orig, p.x, p.y, e.shiftKey);
      setDraft(settings.elements.map((x) => (x.id === d.orig.id ? { ...x, rot } : x)));
    } else {
      const r = { x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) };
      if (!d.moved && r.w * s < 4 && r.h * s < 4) return;
      d.moved = true;
      setMarquee(r);
      const hit = settings.elements.filter((x) => {
        const b = bounds(x);
        return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
      });
      onSelect(new Set([...d.additive, ...hit.map((x) => x.id)]));
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && d.mode !== 'marquee' && d.moved && draft) onChange(draft);
    setDraft(null);
    setGuides([]);
    setMarquee(null);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-el]')?.dataset.el;
    const el = settings.elements.find((x) => x.id === id);
    if (el?.type === 'text' && !el.locked) (onSelect(new Set([el.id])), onEdit(el.id));
  };

  const line = 2 / Math.max(s, 0.01);
  const hs = 12 / Math.max(s, 0.01);
  return (
    <div ref={box} className="relative h-full w-full select-none overflow-hidden">
      {s > 0 && (
        <div
          ref={stage}
          className="absolute overflow-hidden rounded-lg shadow-lift"
          style={{ left: (size.w - CANVAS.w * s) / 2, top: (size.h - CANVAS.h * s) / 2, width: CANVAS.w * s, height: CANVAS.h * s, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <SlideCanvas settings={shown} step={step} mode="edit" scale={s} dimHidden editingId={editingId} onTextCommit={onTextCommit}>
            {/* الطبقة فوق العناصر بإحداثيات اللوحة */}
            <div className="pointer-events-none absolute inset-0" style={{ zIndex: 10000 }}>
              {selected.map((el) => (
                <div
                  key={el.id}
                  className="absolute"
                  style={{ left: el.x, top: el.y, width: el.w, height: el.h, transform: el.rot ? `rotate(${el.rot}deg)` : undefined, outline: `${line}px solid rgb(var(--b-sky))`, outlineOffset: line / 2 }}
                >
                  {single?.id === el.id && !el.locked && !editingId && (
                    <>
                      {HANDLES.filter((h) => el.type !== 'logo' || h.length === 2).map((h) => (
                        <span
                          key={h}
                          data-handle={h}
                          className="pointer-events-auto absolute rounded-full"
                          style={{ width: hs, height: hs, left: HANDLE_POS[h][0] * el.w - hs / 2, top: HANDLE_POS[h][1] * el.h - hs / 2, background: 'rgb(var(--b-white))', boxShadow: `0 0 0 ${line}px rgb(var(--b-sky))`, cursor: CURSOR[h] } as CSSProperties}
                        />
                      ))}
                      {el.type !== 'logo' && (
                        <>
                          <span className="absolute" style={{ left: el.w / 2 - line / 2, top: -hs * 3, width: line, height: hs * 3, background: 'rgb(var(--b-sky))' }} />
                          <span data-handle="rot" title="تدوير (Shift: كل 15°)" className="pointer-events-auto absolute rounded-full" style={{ width: hs * 1.3, height: hs * 1.3, left: el.w / 2 - hs * 0.65, top: -hs * 3.6, background: 'rgb(var(--b-sky))', cursor: 'grab' }} />
                        </>
                      )}
                    </>
                  )}
                  {el.locked && <span className="absolute -top-1 right-0 -translate-y-full rounded bg-[rgb(var(--b-ink))] px-2 text-white" style={{ fontSize: 14 / s }}>مقفل</span>}
                </div>
              ))}
              {guides.map((g, i) => (
                <div key={i} className="absolute" style={g.axis === 'x' ? { left: g.at - line / 2, top: 0, bottom: 0, width: line, background: 'rgb(var(--b-orange))' } : { top: g.at - line / 2, left: 0, right: 0, height: line, background: 'rgb(var(--b-orange))' }} />
              ))}
              {marquee && <div className="absolute" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, border: `${line}px dashed rgb(var(--b-sky))`, background: 'rgb(var(--b-sky) / .08)' }} />}
            </div>
          </SlideCanvas>
        </div>
      )}
    </div>
  );
}
