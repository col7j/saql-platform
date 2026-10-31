// «التشغيل» في المحرّر: الآن على الشاشة (نفس مكوّن العرض بنسبة 16:9 يتبع الحالة) والتالي بجانبه،
// وشريط الفيديو ورقم الخطوة والاتصال، وأوامر الفقرة الحالية، وجدول الحفل بساعته. لا بث صور: المعاينة تُرسم هنا من الإعدادات.
import { useEffect, useRef, useState } from 'react';
import { Button, Icons, cx } from '@/ui';
import type { Segment, ShowConfig } from '../model';
import { next as nextPos, sortSegments, stepCount, type Pos } from '../nav';
import type { Cue, LiveInfo, ShowMessage } from '../sync';
import { stepSub } from '../stepLabel';
import { LongPress, Schedule } from '../ceremony/controls';
import { fmtClock } from '../ceremony/logic';

const showUrl = (hash: string) => `${window.location.pathname}${window.location.search}${hash}`;

/** معاينة شاشة العرض الحقيقية مصغّرة، تتبع الفقرة والخطوة */
function Mirror({ seg, step, label }: { seg?: Segment; step: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(el.getBoundingClientRect().width / 1280);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const hash = seg ? `#/show?preview=${encodeURIComponent(seg.id)}&step=${step}` : '';
  const [initial] = useState(() => showUrl(hash || '#/show?preview=none'));
  useEffect(() => {
    const w = frame.current?.contentWindow;
    if (w && hash && w.location.hash !== hash) w.location.hash = hash;
  }, [hash]);
  return (
    <figure className="min-w-0">
      <div ref={box} className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lift">
        {seg ? <iframe ref={frame} src={initial} title={label} className="pointer-events-none absolute left-0 top-0 origin-top-left border-0" style={{ width: 1280, height: 720, transform: `scale(${scale})` }} /> : <p className="grid h-full place-items-center text-sm text-white/70">النهاية</p>}
      </div>
      <figcaption className="mt-1.5 text-xs text-ink-500">{label}{seg ? `: ${seg.title}` : ''}</figcaption>
    </figure>
  );
}

export interface ConsoleLive {
  pos: Pos;
  started: boolean;
  paused?: boolean;
  blackout?: boolean;
  live?: LiveInfo;
}

export function Console({ cfg, live, connected, send, onClose }: { cfg: ShowConfig; live: ConsoleLive | null; connected: boolean; send: (m: ShowMessage) => void; onClose: () => void }) {
  const list = sortSegments(cfg.segments);
  const pos = live?.pos ?? { seg: 0, step: 0 };
  const cur = list[pos.seg];
  const n = nextPos(cfg, pos);
  const isEnd = n.seg === pos.seg && n.step === pos.step;
  const nextSeg = isEnd ? undefined : list[n.seg];
  const cue = (c: Cue) => send({ type: 'cue', cue: c });
  const v = live?.live?.video;
  const steps = cur ? stepCount(cur) : 1;

  // مفاتيح الكليكر داخل «التشغيل» أيضاً
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageDown') (e.preventDefault(), send({ type: 'nav', dir: 'next' }));
      if (e.key === 'ArrowRight' || e.key === 'PageUp') (e.preventDefault(), send({ type: 'nav', dir: 'prev' }));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [send, onClose]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink-50" data-console>
      <header className="flex shrink-0 items-center gap-3 border-b border-ink-100 bg-white px-4 py-2">
        <Icons.Radio className="h-5 w-5 text-brand-700" />
        <h2 className="text-base font-semibold text-ink-900">التشغيل</h2>
        <span className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs', connected ? 'bg-ok-50 text-ok-800' : 'bg-ink-100 text-ink-600')}>
          <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-ok-500' : 'bg-ink-300')} />
          {connected ? (live?.started ? 'شاشة العرض متصلة' : 'شاشة العرض على شاشة البداية') : 'شاشة العرض غير مفتوحة'}
        </span>
        {live?.blackout && <span className="rounded-full bg-ink-900 px-2.5 py-1 text-xs text-white">شاشة سوداء</span>}
        <div className="flex-1" />
        <Button size="sm" variant="secondary" onClick={onClose} icon={<Icons.X className="h-4 w-4" />}>إغلاق (Esc)</Button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4 overflow-hidden p-4">
        <div className="min-h-0 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-4">
            <Mirror seg={cur} step={pos.step} label="الآن على الشاشة" />
            <Mirror seg={nextSeg} step={n.step} label="التالي" />
          </div>
          <div className="rounded-xl bg-white p-3 shadow-soft">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-700">
              <b className="text-ink-900">{cur?.title ?? '—'}</b>
              <span className="num">فقرة {pos.seg + 1} من {list.length}</span>
              {steps > 1 && <span className="num">خطوة {pos.step + 1} من {steps}</span>}
              {cur && live?.live?.sub && <span className="text-ink-500">{live.live.sub ?? stepSub(cur, pos.step)}</span>}
            </div>
            {v && (
              <div className="mt-2 flex items-center gap-2 text-xs text-ink-500" data-video-progress>
                <Icons.Film className="h-4 w-4" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100"><div className="h-full bg-brand-600" style={{ width: `${(v.t / Math.max(1, v.d)) * 100}%` }} /></div>
                <span className="num">{fmtClock(v.t * 1000)} / {fmtClock(v.d * 1000)}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!connected} onClick={() => send({ type: 'nav', dir: 'prev' })} icon={<Icons.ChevronRight className="h-5 w-5" />} variant="secondary">السابق</Button>
            <Button disabled={!connected} onClick={() => send({ type: 'nav', dir: 'next' })} className="min-w-40">التالي <Icons.ChevronLeft className="h-5 w-5" /></Button>
            <Button disabled={!connected} variant="secondary" onClick={() => send({ type: 'blackout' })} icon={<Icons.MonitorOff className="h-4 w-4" />}>{live?.blackout ? 'أعد الشاشة' : 'شاشة سوداء'}</Button>
            {cur?.type === 'demo' && <Button disabled={!connected} variant="secondary" onClick={() => send({ type: 'tour', action: 'toggle' })} icon={live?.paused ? <Icons.Play className="h-4 w-4" /> : <Icons.Pause className="h-4 w-4" />}>{live?.paused ? 'شغّل الجولة' : 'أوقف الجولة'}</Button>}
            {cur?.type === 'whoami' && (
              <>
                <Button disabled={!connected} variant="secondary" onClick={() => cue('hint')} icon={<Icons.Lightbulb className="h-4 w-4" />}>تلميح</Button>
                <Button disabled={!connected} variant="secondary" onClick={() => cue('reveal')} icon={<Icons.Eye className="h-4 w-4" />}>كشف</Button>
                <Button disabled={!connected} variant="secondary" onClick={() => cue('skip')} icon={<Icons.SkipForward className="h-4 w-4" />}>تخطي</Button>
              </>
            )}
            {cur?.type === 'photo' && <Button disabled={!connected} variant="secondary" onClick={() => cue('photo')} icon={<Icons.Timer className="h-4 w-4" />}>مؤقت الصورة</Button>}
            {v && <Button disabled={!connected} variant="secondary" onClick={() => cue('skipVideo')} icon={<Icons.SkipForward className="h-4 w-4" />}>تخطي الفيديو</Button>}
            {list.some((s) => s.type === 'launch') && (
              <LongPress label="تدشين: اضغط مطوّلاً ثانيتين" disabled={!connected || (cur?.type === 'launch' && pos.step > 0)} onDone={() => cue('launch')} className="inline-flex min-h-[44px] select-none items-center gap-2 rounded-full bg-accent-500 px-5 text-sm font-semibold text-ink-900 shadow-sm hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40">
                تدشين (اضغط مطوّلاً)
              </LongPress>
            )}
          </div>
          <details className="rounded-xl bg-white p-3 shadow-soft">
            <summary className="cursor-pointer text-sm font-medium text-ink-800">انتقل إلى شريحة</summary>
            <ol className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
              {list.map((s, i) => (
                <li key={s.id}>
                  <button disabled={!connected} onClick={() => send({ type: 'goto', pos: { seg: i, step: 0 } })} className={cx('w-full truncate rounded-lg px-2 py-1 text-start text-xs', i === pos.seg ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-ink-50')}>
                    <span className="num">{i + 1}</span> {s.title}
                  </button>
                </li>
              ))}
            </ol>
          </details>
        </div>
        <aside className="min-h-0 overflow-y-auto rounded-xl bg-white p-3 shadow-soft">
          <Schedule
            live={live?.live}
            onToggle={() => send({ type: 'timing', action: 'toggle' })}
            onReset={() => send({ type: 'timing', action: 'reset' })}
            classes={{
              root: 'space-y-2',
              head: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-800 [&>b]:me-auto',
              bar: 'h-2 overflow-hidden rounded-full bg-ink-100',
              fill: 'h-full bg-brand-600 transition-all',
              list: 'space-y-0.5',
              row: 'grid grid-cols-[22px_minmax(0,1fr)_44px_56px] items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink-700',
              now: 'bg-brand-50 font-semibold text-brand-800',
              over: 'text-bad-700',
              btn: 'rounded-lg border border-ink-200 px-2 py-0.5 text-xs text-ink-700 hover:bg-ink-50',
            }}
          />
          {!live?.live?.agenda?.length && <p className="text-sm text-ink-500">يظهر جدول الحفل حين تُفتح شاشة العرض. حدّد بداية كل فقرة ومدتها من «تبدأ فقرة في جدول الحفل» في خصائص الشريحة.</p>}
          <p className="mt-3 text-[11px] text-ink-500">المدد للمنظمين فقط ولا تظهر على شاشة العرض. الساعة تبدأ مع «ابدأ العرض» وتحسب زمن كل فقرة فعلياً.</p>
        </aside>
      </div>
    </div>
  );
}
