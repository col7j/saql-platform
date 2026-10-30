// إعدادات فقرة ديمو المنصة: المشاهد الأربعة بصفة مشارك، والتشغيل التلقائي، ومدة كل خطوة.
// خطوات كل صفحة تُقرأ من الصفحة نفسها (نفس قراءة الجولة في العرض) في إطار مخفي، فتُعدَّل مدة أي بطاقة أو جزء.
import { useEffect, useRef, useState } from 'react';
import { Button, Icons, Toggle, cx } from '@/ui';
import { DEMO_PAGE_LABELS, DEMO_SCENES, DEMO_SCENE_LABELS, DEMO_SCENE_PAGES, demoSteps, type DemoPage, type DemoSegment, type DemoSettings } from '../model';
import { DEMO_READY, demoSnapshot, demoTargets } from '../demo/data';
import { PAGE_ID, frameUrl } from '../demo/DemoView';
import { contentRects, detectCards, planTour, type Shot } from '../demo/tour';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** يقرأ خطوات كل صفحة كما ستراها الجولة على شاشة 1920×1080 */
async function scanPages(frame: HTMLIFrameElement, pages: DemoPage[], onPage: (p: DemoPage, shots: Shot[]) => void) {
  const targets = demoTargets(demoSnapshot());
  let seq = 1000;
  for (const page of pages) {
    const s = ++seq;
    const ready = new Promise<boolean>((resolve) => {
      const t = setTimeout(() => (window.removeEventListener('message', on), resolve(false)), 8000);
      function on(e: MessageEvent) {
        if (e.source !== frame.contentWindow || e.data?.type !== DEMO_READY || Number(e.data.seq) !== s) return;
        clearTimeout(t);
        window.removeEventListener('message', on);
        resolve(true);
      }
      window.addEventListener('message', on);
    });
    frame.src = frameUrl(page, PAGE_ID[page] ? targets[PAGE_ID[page]!] : '', s);
    if (!(await ready)) continue;
    const doc = frame.contentDocument;
    if (!doc) continue;
    let last = '';
    for (let i = 0; i < 12; i++) {
      const now = JSON.stringify(detectCards(doc).map((c) => c.rect));
      if (now === last) break;
      last = now;
      await wait(150);
    }
    onPage(page, planTour(page, detectCards(doc), { w: 1920, h: 1080 * 0.88 }, { content: contentRects(doc) }));
  }
}

export function DemoEditor({ seg, patch }: { seg: DemoSegment; patch: (s: Partial<DemoSettings>) => void }) {
  const st = seg.settings;
  const on = new Set(st.scenes);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scan, setScan] = useState<{ busy: boolean; pages: Partial<Record<DemoPage, Shot[]>> }>({ busy: false, pages: {} });
  const scenesKey = st.scenes.join(',');
  useEffect(() => setScan({ busy: false, pages: {} }), [seg.id]);

  const runScan = async () => {
    if (!frame.current) return;
    setScan({ busy: true, pages: {} });
    await scanPages(frame.current, demoSteps(st).map((p) => p.page), (p, shots) => setScan((x) => ({ ...x, pages: { ...x.pages, [p]: shots } })));
    setScan((x) => ({ ...x, busy: false }));
  };

  const setDuration = (key: string, v: number | null) => {
    const durations = { ...st.durations };
    if (v === null || v === st.dwell) delete durations[key];
    else durations[key] = Math.min(120, Math.max(0, v));
    patch({ durations });
  };
  const custom = Object.keys(st.durations).length;

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-ink-500">
        الديمو بصفة مشارك من البيانات التجريبية الثابتة، للقراءة فقط ولا يكتب في بيانات المنصة. الجولة تفتح كل صفحة كاملة ثم تقرّب على كل بطاقة بترتيب القراءة بحجم مقروء، والبطاقة الكبيرة تُعرض أجزاءً. في العرض: K تشغيل/إيقاف، والأسهم للتقدّم والرجوع، و1–4 للمشاهد.
      </p>

      <div className="space-y-2">
        {DEMO_SCENES.map((k, i) => (
          <button
            key={k}
            onClick={() => {
              const scenes = DEMO_SCENES.filter((x) => (x === k ? !on.has(k) : on.has(x)));
              if (scenes.length) patch({ scenes });
            }}
            className={cx('flex w-full items-start gap-3 rounded-xl border p-3 text-start transition', on.has(k) ? 'border-brand-600/40 bg-brand-50' : 'border-ink-100 opacity-60 hover:opacity-100')}
          >
            <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold num', on.has(k) ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500')}>{i + 1}</span>
            <span>
              <span className="block text-sm font-medium text-ink-900">{DEMO_SCENE_LABELS[k]}</span>
              <span className="block text-xs text-ink-500">{DEMO_SCENE_PAGES[k].map((p) => DEMO_PAGE_LABELS[p]).join(' ← ')}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-ink-100 p-3">
        <Toggle checked={st.autoplay} onChange={(v) => patch({ autoplay: v })} label="تبدأ الجولة وحدها" />
        <label className="flex items-center gap-2 text-sm text-ink-700">
          مدة كل خطوة
          <input type="number" dir="ltr" min={1} max={120} className="input !min-h-0 w-20 !py-1 text-left num" value={st.dwell} onChange={(e) => +e.target.value >= 1 && patch({ dwell: Math.min(120, +e.target.value) })} />
          ثانية
        </label>
        {custom > 0 && (
          <button className="text-xs text-brand-700 underline-offset-2 hover:underline" onClick={() => patch({ durations: {} })}>
            إعادة {custom} مدة خاصة إلى {st.dwell} ث
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="flex-1 text-xs font-semibold text-ink-500">خطوات الصفحات ومددها</h4>
          <Button size="sm" variant="secondary" disabled={scan.busy} icon={<Icons.ScanSearch className="h-4 w-4" />} onClick={runScan}>
            {scan.busy ? 'جارٍ القراءة…' : Object.keys(scan.pages).length ? 'أعد القراءة' : 'اقرأ خطوات الصفحات'}
          </Button>
        </div>
        {/* إطار مخفي بعرض المنصة يقرأ فيه المحرّر الصفحات كما تراها الجولة */}
        <iframe ref={frame} key={scenesKey} title="قراءة الصفحات" tabIndex={-1} aria-hidden className="pointer-events-none fixed -left-[2000px] top-0 h-[900px] w-[1280px] opacity-0" />
        {demoSteps(st).map(({ page }) => {
          const shots = scan.pages[page];
          if (!shots) return null;
          return (
            <div key={page} className="rounded-xl border border-ink-100">
              <p className="border-b border-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-800">{DEMO_PAGE_LABELS[page]} · {shots.length} خطوات</p>
              <ul className="divide-y divide-ink-50">
                {shots.map((s) => (
                  <li key={s.key} className="flex items-center gap-2 px-3 py-1">
                    <span className={cx('min-w-0 flex-1 truncate text-xs', st.durations[s.key] === 0 ? 'text-ink-400 line-through' : 'text-ink-700')} title={s.label}>{s.label}</span>
                    <input
                      type="number"
                      dir="ltr"
                      min={0}
                      max={120}
                      placeholder={String(st.dwell)}
                      title="بالثواني، و0 لتخطّي الخطوة"
                      className={cx('input !min-h-0 w-16 !px-2 !py-0.5 text-left text-xs num', st.durations[s.key] !== undefined && 'border-brand-600')}
                      value={st.durations[s.key] ?? ''}
                      onChange={(e) => setDuration(s.key, e.target.value === '' ? null : +e.target.value)}
                      aria-label={`مدة ${s.label}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {Object.keys(scan.pages).length > 0 && <p className="text-[11px] text-ink-500">المدة بالثواني، والفارغ يأخذ المدة العامة، و0 يتخطّى الخطوة.</p>}
        {!scan.busy && !Object.keys(scan.pages).length && <p className="text-[11px] text-ink-500">تُقرأ البطاقات من صفحات المنصة نفسها، فأي صفحة أو بطاقة جديدة تظهر هنا وفي الجولة تلقائياً.</p>}
      </div>
    </div>
  );
}
