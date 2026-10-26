// مكونات الواجهة العامة بهوية صقل
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as L from 'lucide-react';
import type { Tone } from '@/domain/labels';
import { useStore } from '@/state/store';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

const iconMap: Record<string, L.LucideIcon> = {
  home: L.Home, calendar: L.CalendarDays, bell: L.Bell, map: L.MapPinned, target: L.Target, users: L.UsersRound, compass: L.Compass,
  clipboard: L.ClipboardList, book: L.LibraryBig, grid: L.LayoutGrid, trophy: L.Trophy, radar: L.Radar, message: L.MessagesSquare,
  check: L.ListChecks, layers: L.Layers, contact: L.Contact, wallet: L.Wallet, receipt: L.Receipt, link: L.Link2, globe: L.Globe,
  settings: L.Settings2, key: L.KeyRound, meeting: L.Presentation, chart: L.ChartNoAxesColumn, more: L.LayoutGrid,
};
export function NavIcon({ name, className }: { name: string; className?: string }) {
  const I = iconMap[name] ?? L.Circle;
  return <I className={className ?? 'h-5 w-5'} strokeWidth={1.8} />;
}
export { L as Icons };

// ───────────── أزرار ─────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'success';
// زر رئيسي واحد في كل شاشة: primary (أو accent للتأكيد). البقية ثانوية. الرفض/الحذف بإطار أحمر لا بتعبئة.
const btnBase = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap';
const btnVar: Record<BtnVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-ink-700 border border-ink-200 hover:border-brand-300 hover:text-brand-700',
  ghost: 'text-ink-600 hover:bg-ink-100',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
  accent: 'bg-accent-grad text-white hover:brightness-105 shadow-sm',
  success: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
};
// أهداف لمس لا تقل عن 44px على الجوال
const btnSize = { sm: 'px-3 min-h-[40px] sm:min-h-[32px] text-xs', md: 'px-4 min-h-[44px] sm:min-h-[40px] text-sm' };
export function Button({
  children, variant = 'primary', size = 'md', className, icon, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button {...rest} className={cx(btnBase, btnVar[variant], btnSize[size], className)}>
      {icon}
      {children}
    </button>
  );
}
export function LinkButton({ to, children, variant = 'secondary', size = 'md', className, icon }: { to: string; children: ReactNode; variant?: BtnVariant; size?: 'sm' | 'md'; className?: string; icon?: ReactNode }) {
  return (
    <Link to={to} className={cx(btnBase, btnVar[variant], btnSize[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

// ───────────── بطاقات وعناوين ─────────────
export function Card({ children, className, title, action, subtitle, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx('rounded-2xl border border-ink-100 bg-white shadow-card', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-100 bg-gradient-to-l from-brand-50/60 to-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={pad ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-1 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-brand-600">
            <L.ArrowRight className="h-3.5 w-3.5" /> رجوع
          </Link>
        )}
        <h1 className="flex items-center gap-2.5 text-xl font-black text-ink-900 sm:text-2xl"><span className="h-7 w-1.5 shrink-0 rounded-full bg-accent-grad" />{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const toneCls: Record<Tone, string> = {
  gray: 'bg-ink-100 text-ink-600',
  blue: 'bg-brand-50 text-brand-700',
  brand: 'bg-brand-600 text-white',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  orange: 'bg-accent-50 text-accent-700',
  purple: 'bg-indigo-50 text-indigo-700',
};
export function Badge({ children, tone = 'gray', className, icon }: { children: ReactNode; tone?: Tone; className?: string; icon?: ReactNode }) {
  return <span className={cx('chip', toneCls[tone], className)}>{icon}{children}</span>;
}

export function Stat({ label, value, hint, icon, tone = 'brand', to }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'brand' | 'accent' | 'red' | 'green'; to?: string }) {
  const ring = { brand: 'bg-brand-50 text-brand-600', accent: 'bg-accent-50 text-accent-600', red: 'bg-red-50 text-red-600', green: 'bg-emerald-50 text-emerald-600' }[tone];
  const body = (
    <div className="flex h-full items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card transition hover:border-brand-200">
      {icon && <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ring)}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs text-ink-500">{label}</div>
        <div className="num mt-0.5 text-xl font-bold text-ink-900">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-ink-400">{hint}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export function Progress({ value, tone = 'brand', className, label }: { value: number; tone?: 'brand' | 'accent' | 'green' | 'red'; className?: string; label?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  const bar = { brand: 'bg-brand-grad', accent: 'bg-accent-grad', green: 'bg-emerald-500', red: 'bg-red-500' }[tone];
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
        <div className={cx('h-full rounded-full transition-all', bar)} style={{ width: `${v}%` }} />
      </div>
      {label && <span className="num w-9 text-end text-xs text-ink-500">{Math.round(v)}%</span>}
    </div>
  );
}

export function Avatar({ name, size = 32, color }: { name: string; size?: number; color?: string }) {
  const parts = name.split(' ');
  const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? 'linear-gradient(135deg,#00708c,#00b9d1)' }}>
      {initials}
    </span>
  );
}

export function Empty({ title, text, icon, action }: { title: string; text?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-10 text-center">
      <div className="text-ink-300">{icon ?? <L.Inbox className="h-8 w-8" />}</div>
      <div className="font-medium text-ink-700">{title}</div>
      {text && <p className="max-w-md text-sm text-ink-500">{text}</p>}
      {action}
    </div>
  );
}

// ───────────── نماذج ─────────────
export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx('input', p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx('input', p.className)} />;
export function Select({ options, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...p} className={cx('input pe-8', p.className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-ink-700 disabled:opacity-50">
      <span className={cx('relative h-5 w-9 rounded-full transition', checked ? 'bg-brand-600' : 'bg-ink-200')}>
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'start-[18px]' : 'start-0.5')} />
      </span>
      {label}
    </button>
  );
}
export function Stars({ value, onChange, max = 5 }: { value?: number; onChange?: (v: number) => void; max?: number }) {
  return (
    <div className="inline-flex gap-0.5" dir="ltr">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className="disabled:cursor-default">
          <L.Star className={cx('h-5 w-5', (value ?? 0) >= n ? 'fill-accent-400 text-accent-400' : 'text-ink-200')} />
        </button>
      ))}
    </div>
  );
}

// ───────────── تبويبات ─────────────
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: ReactNode; badge?: ReactNode }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cx('inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition sm:min-h-[40px]', value === t.key ? 'bg-brand-grad text-white shadow-md shadow-brand-600/20' : 'border border-ink-100 bg-white text-ink-600 hover:border-brand-200 hover:bg-brand-50')}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  );
}

// ───────────── نافذة منبثقة ─────────────
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={cx('flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100"><L.X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** نافذة لإدخال سبب (للرفض مثلاً) */
export function ReasonModal({ open, onClose, onSubmit, title, label = 'السبب', cta = 'إرسال', danger = true }: { open: boolean; onClose: () => void; onSubmit: (reason: string) => void; title: string; label?: string; cta?: string; danger?: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={!reason.trim()} onClick={() => { onSubmit(reason); setReason(''); onClose(); }}>{cta}</Button>
        </>
      }
    >
      <Field label={label}>
        <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="اكتب السبب بوضوح ليتمكن الفريق من التعديل" />
      </Field>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => dismiss(t.id)} className={cx('pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white shadow-lg', t.tone === 'ok' ? 'bg-ink-900' : 'bg-red-600')}>
          {t.tone === 'ok' ? <L.CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <L.AlertTriangle className="h-4 w-4" />}
          {t.text}
        </button>
      ))}
    </div>
  );
}

/** مراحل أفقية (للدورة والمسار) */
export function Steps({ steps }: { steps: { label: string; state: 'done' | 'current' | 'todo' }[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center">
          <span className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', s.state === 'done' ? 'bg-emerald-50 text-emerald-700' : s.state === 'current' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-400')}>
            {s.state === 'done' ? <L.Check className="h-3.5 w-3.5" /> : <span className="num">{i + 1}</span>}
            {s.label}
          </span>
          {i < steps.length - 1 && <L.ChevronLeft className="mx-0.5 h-4 w-4 text-ink-300" />}
        </li>
      ))}
    </ol>
  );
}

export function Checklist({ items }: { items: { label: string; ok: boolean }[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((c) => (
        <li key={c.label} className="flex items-center gap-2 text-sm">
          {c.ok ? <L.CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <L.Circle className="h-4 w-4 shrink-0 text-ink-300" />}
          <span className={c.ok ? 'text-ink-700' : 'text-ink-500'}>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="table-base min-w-[560px]">{children}</table>
    </div>
  );
}

export function KeyVal({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-ink-500">{k}</span>
      <span className="text-end font-medium text-ink-800">{v}</span>
    </div>
  );
}

export function Notice({ tone = 'blue', children, icon }: { tone?: 'blue' | 'orange' | 'red' | 'green'; children: ReactNode; icon?: ReactNode }) {
  const cls = { blue: 'bg-brand-50 text-brand-800 border-brand-100', orange: 'bg-accent-50 text-accent-700 border-accent-100', red: 'bg-red-50 text-red-700 border-red-100', green: 'bg-emerald-50 text-emerald-800 border-emerald-100' }[tone];
  return (
    <div className={cx('flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm', cls)}>
      <span className="mt-0.5 shrink-0">{icon ?? <L.Info className="h-4 w-4" />}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ───────────── حالة + الخطوة التالية ─────────────
/** شارة حالة بنص (لا تعتمد على اللون وحده) وبجانبها الخطوة التالية ومن ينتظره */
export function StatusPill({ label, tone, next, waitingOn, compact }: { label: string; tone: Tone; next?: string; waitingOn?: string; compact?: boolean }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-2 gap-y-1', compact ? 'text-xs' : 'text-sm')}>
      <Badge tone={tone} icon={<L.CircleDot className="h-3 w-3" />}>{label}</Badge>
      {next && next !== 'لا إجراء' && (
        <span className="inline-flex items-center gap-1 text-xs text-ink-500">
          <L.ArrowLeft className="h-3 w-3" />
          التالي: {next}{waitingOn && waitingOn !== '—' ? ` (${waitingOn})` : ''}
        </span>
      )}
    </div>
  );
}

// ───────────── نموذج على خطوات ─────────────
export interface WizardStep {
  title: string;
  content: ReactNode;
  valid?: boolean;
  hint?: string;
}
/** نموذج على خطوات مع شريط تقدم وحقول قليلة في كل خطوة */
export function StepWizard({ steps, onFinish, finishLabel = 'احفظ', onCancel }: { steps: WizardStep[]; onFinish: () => void; finishLabel?: string; onCancel?: () => void }) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  return (
    <div>
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-500">
          <span className="font-medium text-ink-800">{step.title}</span>
          <span className="num">الخطوة {i + 1} من {steps.length}</span>
        </div>
        <div className="flex gap-1">
          {steps.map((_, k) => <span key={k} className={cx('h-1.5 flex-1 rounded-full', k <= i ? 'bg-brand-500' : 'bg-ink-100')} />)}
        </div>
      </div>
      <div className="min-h-[160px]">{step.content}</div>
      {step.hint && step.valid === false && <p className="mt-3 text-xs text-red-600">{step.hint}</p>}
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-ink-100 pt-4">
        <div>
          {i > 0 ? <Button variant="ghost" onClick={() => setI(i - 1)} icon={<L.ArrowRight className="h-4 w-4" />}>السابق</Button> : onCancel ? <Button variant="ghost" onClick={onCancel}>إلغاء</Button> : <span />}
        </div>
        <Button disabled={step.valid === false} onClick={() => (last ? onFinish() : setI(i + 1))} icon={last ? <L.Check className="h-4 w-4" /> : undefined}>
          {last ? finishLabel : 'التالي'}
          {!last && <L.ArrowLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ───────────── تأكيد الإجراءات التي لا رجعة فيها ─────────────
interface ConfirmReq { title: string; body?: string; cta: string; danger?: boolean; run: () => void }
let confirmSetter: ((r: ConfirmReq | null) => void) | null = null;
/** تأكيد للإجراءات التي لا رجعة فيها فقط (صرف، إغلاق، رفض) */
export function askConfirm(r: ConfirmReq) {
  if (confirmSetter) confirmSetter(r);
  else r.run();
}
export function ConfirmHost() {
  const [r, setR] = useState<ConfirmReq | null>(null);
  useEffect(() => {
    confirmSetter = setR;
    return () => { confirmSetter = null; };
  }, []);
  if (!r) return null;
  return (
    <Modal open onClose={() => setR(null)} title={r.title}
      footer={<><Button variant="secondary" onClick={() => setR(null)}>تراجع</Button><Button variant={r.danger ? 'danger' : 'primary'} onClick={() => { const run = r.run; setR(null); run(); }}>{r.cta}</Button></>}>
      <p className="text-sm text-ink-600">{r.body ?? 'هذا الإجراء لا يمكن التراجع عنه.'}</p>
    </Modal>
  );
}

// ───────────── قائمة "المزيد" للإجراءات الثانوية ─────────────
export function MoreMenu({ items, label = 'المزيد' }: { items: { label: string; onClick: () => void; danger?: boolean; hidden?: boolean }[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;
  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen(!open)} icon={<L.Ellipsis className="h-4 w-4" />}>{label}</Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-40 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-lg">
            {visible.map((i) => (
              <button key={i.label} onClick={() => { setOpen(false); i.onClick(); }} className={cx('block min-h-[44px] w-full px-4 py-2 text-start text-sm hover:bg-ink-50', i.danger && 'text-red-700')}>{i.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
