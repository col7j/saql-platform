// مكوّنات التحكم المشتركة بين «التشغيل» في المحرّر وريموت الجوال: زر الضغط المطوّل للتدشين، وجدول الحفل بساعته.
// لا يُستخدم شيء منها على شاشة العرض: المدد داخلية للمنظمين فقط.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LiveInfo } from '../sync';
import { fmtClock, totalMinutes } from './logic';

/** زر يعمل بالضغط المطوّل (ثانيتان افتراضياً) مع حلقة تقدّم، ويُلغى إن رُفع الإصبع قبل الاكتمال، واهتزاز خفيف عند الاكتمال */
export function LongPress({ onDone, ms = 2000, disabled, className, children, label }: { onDone: () => void; ms?: number; disabled?: boolean; className?: string; children: ReactNode; label: string }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const start = useRef(0);
  const done = useRef(false);
  const stop = () => {
    cancelAnimationFrame(raf.current);
    if (!done.current) setP(0);
  };
  const begin = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    done.current = false;
    start.current = performance.now();
    const loop = () => {
      const k = Math.min(1, (performance.now() - start.current) / ms);
      setP(k);
      if (k >= 1) {
        done.current = true;
        navigator.vibrate?.([30, 40, 60]);
        onDone();
        setTimeout(() => ((done.current = false), setP(0)), 600);
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const C = 2 * Math.PI * 22;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={className}
      data-progress={p > 0 ? Math.round(p * 100) : undefined}
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.preventDefault()}
    >
      <svg viewBox="0 0 50 50" width="34" height="34" aria-hidden style={{ flex: 'none' }}>
        <circle cx="25" cy="25" r="22" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="5" />
        <circle cx="25" cy="25" r="22" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 25 25)" />
      </svg>
      <span>{p >= 1 ? 'تم' : children}</span>
    </button>
  );
}

/** الزمن الفعلي لكل فقرة حتى هذه اللحظة (الساعة تتقدم محلياً بين رسائل الحالة) */
export function useAgenda(live?: LiveInfo) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const items = live?.agenda ?? [];
  const extra = live?.clock?.running ? Math.max(0, now - live.clock.at) : 0;
  const rows = items.map((a, i) => ({ ...a, spent: a.spent + (i === live?.agendaAt ? extra : 0) }));
  const planned = totalMinutes(items) * 60000;
  const spent = rows.reduce((n, r) => n + r.spent, 0);
  return { rows, at: live?.agendaAt ?? 0, planned, spent, running: !!live?.clock?.running, started: !!live?.clock?.startedAt };
}

/** جدول الحفل: الفقرات بمددها المخططة والفعلية، ومؤشر الإجمالي */
export function Schedule({ live, onToggle, onReset, classes }: { live?: LiveInfo; onToggle?: () => void; onReset?: () => void; classes: Record<'root' | 'head' | 'bar' | 'fill' | 'list' | 'row' | 'now' | 'over' | 'btn', string> }) {
  const a = useAgenda(live);
  if (!a.rows.length) return null;
  const left = a.planned - a.spent;
  return (
    <section className={classes.root} data-schedule>
      <div className={classes.head}>
        <b>جدول الحفل</b>
        <span className="num">{fmtClock(a.spent)} من {Math.round(a.planned / 60000)} د</span>
        <span className={`num ${left < 0 ? classes.over : ''}`}>{left >= 0 ? `متبقٍ ${fmtClock(left)}` : `تجاوز ${fmtClock(-left)}`}</span>
        {onToggle && <button className={classes.btn} onClick={onToggle}>{a.running ? 'إيقاف الساعة' : a.started ? 'استئناف' : 'تبدأ مع العرض'}</button>}
        {onReset && <button className={classes.btn} onClick={onReset}>تصفير</button>}
      </div>
      <div className={classes.bar}><div className={classes.fill} style={{ width: `${Math.min(100, (a.spent / Math.max(1, a.planned)) * 100)}%` }} /></div>
      <ol className={classes.list}>
        {a.rows.map((r, i) => {
          const over = r.minutes > 0 && r.spent > r.minutes * 60000;
          return (
            <li key={i} className={`${classes.row} ${i === a.at ? classes.now : ''}`}>
              <span className="num">{i + 1}</span>
              <span>{r.title}</span>
              <span className="num">{r.minutes} د</span>
              <span className={`num ${over ? classes.over : ''}`}>{r.spent ? fmtClock(r.spent) : '—'}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
