import type { ISODate, ISODateTime } from './types';

let nowOverride: number | null = null;
/** يسمح للاختبارات (ولأداة المحاكاة) بتثبيت الوقت */
export function setNow(ts: number | null) {
  nowOverride = ts;
}
export function now(): Date {
  return nowOverride !== null ? new Date(nowOverride) : new Date();
}
export function nowISO(): ISODateTime {
  return now().toISOString();
}

const pad = (n: number) => String(n).padStart(2, '0');
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO(): ISODate {
  return toISODate(now());
}
export function addDays(date: ISODate, days: number): ISODate {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
export function parseDate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function dateTime(date: ISODate, time = '00:00'): Date {
  const d = parseDate(date);
  const [h, mi] = time.split(':').map(Number);
  d.setHours(h || 0, mi || 0, 0, 0);
  return d;
}
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);
}
export function minutesOf(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function timeOf(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const LOC = 'ar-SA-u-ca-gregory-nu-latn';
const HIJRI = 'ar-SA-u-ca-islamic-umalqura-nu-latn';

export function fmtDate(date?: ISODate | ISODateTime, opts: { hijri?: boolean; weekday?: boolean } = {}): string {
  if (!date) return '—';
  const d = date.length <= 10 ? parseDate(date) : new Date(date);
  const g = d.toLocaleDateString(LOC, { day: 'numeric', month: 'long', year: 'numeric', ...(opts.weekday ? { weekday: 'long' } : {}) });
  if (!opts.hijri) return g;
  const h = d.toLocaleDateString(HIJRI, { day: 'numeric', month: 'long', year: 'numeric' });
  return `${g} · ${h}`;
}
export function fmtShort(date?: ISODate | ISODateTime): string {
  if (!date) return '—';
  const d = date.length <= 10 ? parseDate(date) : new Date(date);
  return d.toLocaleDateString(LOC, { day: 'numeric', month: 'short' });
}
export function fmtDateTime(dt?: ISODateTime): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return `${d.toLocaleDateString(LOC, { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(LOC, { hour: 'numeric', minute: '2-digit' })}`;
}
export function fmtTime(t?: string): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'ص' : 'م';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${suffix}`;
}
export function fmtHijri(date: ISODate): string {
  return parseDate(date).toLocaleDateString(HIJRI, { day: 'numeric', month: 'long' });
}
export function relativeDays(date: ISODate): string {
  const n = diffDays(date, todayISO());
  if (n === 0) return 'اليوم';
  if (n === 1) return 'غداً';
  if (n === -1) return 'أمس';
  if (n > 1) return n <= 10 ? `بعد ${n} أيام` : `بعد ${n} يوماً`;
  return -n <= 10 ? `قبل ${-n} أيام` : `قبل ${-n} يوماً`;
}
export function timeAgo(dt: ISODateTime): string {
  const mins = Math.round((now().getTime() - new Date(dt).getTime()) / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${mins} د`;
  const h = Math.round(mins / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.round(h / 24);
  return `قبل ${d} يوم`;
}
