// منطق نقي لفقرات الحفل: خطوات «من أنا؟» وشبكة الأسماء والاتفاقيات والتدشين، وجدول الحفل بالمدد.
// لا يعرف الواجهة ولا التخزين، وتختبره tests/show-ceremony.test.ts.
import type { AgreementsSettings, RosterPerson, RosterSettings, Section, Segment, WhoAmISettings, WhoEntry } from '../model';

// ───────────── «من أنا؟» ─────────────
// الخطوة 0 شاشة البداية، ثم لكل مشارك: المعلومة (0 تلميح)، ثم تلميح تلميح، ثم الكشف.

export const activeEntries = (s: WhoAmISettings) => s.entries.filter((e) => !e.skip && (e.fact.trim() || e.name.trim()));

interface Block {
  entry: WhoEntry;
  index: number;
  /** أول خطوة للمشارك (المعلومة) */
  start: number;
  hints: number;
}

export function whoBlocks(s: WhoAmISettings): Block[] {
  let at = 1;
  return activeEntries(s).map((entry, index) => {
    const hints = entry.hints.filter((h) => h.trim()).length;
    const b = { entry, index, start: at, hints };
    at += hints + 2;
    return b;
  });
}

export const whoStepCount = (s: WhoAmISettings) => 1 + whoBlocks(s).reduce((n, b) => n + b.hints + 2, 0);

export type WhoAt =
  | { kind: 'intro'; total: number }
  | { kind: 'fact'; entry: WhoEntry; index: number; total: number; hintsShown: number; hints: string[] }
  | { kind: 'reveal'; entry: WhoEntry; index: number; total: number };

/** ما يظهر في الخطوة */
export function whoAt(s: WhoAmISettings, step: number): WhoAt {
  const blocks = whoBlocks(s);
  const total = blocks.length;
  const b = [...blocks].reverse().find((x) => step >= x.start);
  if (!b || step <= 0) return { kind: 'intro', total };
  const k = step - b.start;
  const hints = b.entry.hints.filter((h) => h.trim());
  if (k > b.hints) return { kind: 'reveal', entry: b.entry, index: b.index, total };
  return { kind: 'fact', entry: b.entry, index: b.index, total, hintsShown: k, hints };
}

/** «التالي»: من البداية لأول معلومة، ومن المعلومة (أو تلميحها) إلى الكشف، ومن الكشف إلى المشارك التالي. null = نهاية الفقرة */
export function whoNext(s: WhoAmISettings, step: number): number | null {
  const blocks = whoBlocks(s);
  const at = whoAt(s, step);
  if (at.kind === 'intro') return blocks.length ? blocks[0].start : null;
  const b = blocks[at.index];
  if (at.kind === 'fact') return b.start + b.hints + 1;
  return blocks[at.index + 1]?.start ?? null;
}

/** «تلميح»: التلميح التالي قبل الكشف، أو لا شيء */
export function whoHint(s: WhoAmISettings, step: number): number | null {
  const at = whoAt(s, step);
  return at.kind === 'fact' && at.hintsShown < at.hints.length ? step + 1 : null;
}

/** «كشف» مباشرة */
export function whoReveal(s: WhoAmISettings, step: number): number | null {
  const at = whoAt(s, step);
  if (at.kind !== 'fact') return null;
  const b = whoBlocks(s)[at.index];
  return b.start + b.hints + 1;
}

/** «تخطي» المشارك الحالي بلا كشف */
export function whoSkip(s: WhoAmISettings, step: number): number | null {
  const at = whoAt(s, step);
  const blocks = whoBlocks(s);
  if (at.kind === 'intro') return blocks[1]?.start ?? null;
  return blocks[at.index + 1]?.start ?? null;
}

/** خلط ترتيب المشاركين (Fisher–Yates) */
export function shuffled<T>(list: T[], rnd = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** يدمج مشاركي اللقطة مع القائمة: يبقي معلومات الموجودين، ويضيف الجدد، ولا يحذف من أُضيف يدوياً */
export function mergeEntries(current: WhoEntry[], people: { personId: string; name: string; group?: string }[], newId: () => string): WhoEntry[] {
  const byPerson = new Map(current.filter((e) => e.personId).map((e) => [e.personId!, e]));
  const out = current.map((e) => {
    const p = e.personId ? people.find((x) => x.personId === e.personId) : undefined;
    return p ? { ...e, name: p.name, group: p.group } : e;
  });
  for (const p of people) if (!byPerson.has(p.personId)) out.push({ id: newId(), personId: p.personId, name: p.name, group: p.group, fact: '', hints: [] });
  return out;
}

/** لصق قائمة: سطر لكل مشارك «الاسم - المعلومة» (أو «الاسم: المعلومة»)، والتلميحات بعد | */
export function parsePasted(text: string, newId: () => string): WhoEntry[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [main, ...hints] = line.split('|').map((x) => x.trim());
      const m = main.match(/^(.+?)\s*[-–—:،,]\s*(.+)$/);
      return { id: newId(), name: m ? m[1].trim() : '', fact: m ? m[2].trim() : main, hints: hints.filter(Boolean) };
    });
}

/** CSV بعناوين (الاسم، المجموعة، المعلومة، تلميح…) بالعربية أو الإنجليزية، مع دعم علامات الاقتباس */
export function parseCsv(text: string, newId: () => string): WhoEntry[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === '\t' || c === '؛' || c === ';') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell), rows.push(row), (row = []), (cell = '');
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const clean = rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some(Boolean));
  if (!clean.length) return [];
  const head = clean[0].map((h) => h.toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const hasHead = col('اسم', 'name', 'معلوم', 'fact') >= 0;
  const iName = hasHead ? col('اسم', 'name') : 0;
  const iGroup = hasHead ? col('مجموع', 'group') : -1;
  const iFact = hasHead ? col('معلوم', 'fact', 'info') : 1;
  const iHints = hasHead ? head.map((h, i) => (/(تلميح|hint)/.test(h) ? i : -1)).filter((i) => i >= 0) : [2, 3, 4];
  return (hasHead ? clean.slice(1) : clean).map((r) => ({
    id: newId(),
    name: r[iName] ?? '',
    group: iGroup >= 0 ? r[iGroup] || undefined : undefined,
    fact: r[iFact] ?? '',
    hints: iHints.map((i) => r[i]).filter((x): x is string => !!x),
  }));
}

// ───────────── شبكة الأسماء ─────────────

export function rosterPages(s: RosterSettings): RosterPerson[][] {
  const per = Math.max(1, Math.min(60, Math.floor(s.perPage) || 35));
  const pages: RosterPerson[][] = [];
  for (let i = 0; i < s.people.length; i += per) pages.push(s.people.slice(i, i + per));
  return pages.length ? pages : [[]];
}

/** أعمدة وصفوف بنسبة الشاشة للأسماء العريضة: 35 اسماً → 7×5، و28 → 6×5، و12 → 4×3 */
export function rosterGrid(n: number): { cols: number; rows: number } {
  if (n <= 0) return { cols: 1, rows: 1 };
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * 1.4))));
  return { cols, rows: Math.ceil(n / cols) };
}

/** المجموعات بترتيب ظهورها، لكل مجموعة لون من ألوان الهوية */
export const ROSTER_TONES = ['sky', 'gold', 'orange', 'white', 'teal', 'grey'] as const;
export function rosterGroups(people: RosterPerson[]) {
  const groups: string[] = [];
  for (const p of people) if (p.group && !groups.includes(p.group)) groups.push(p.group);
  return groups.map((g, i) => ({ name: g, tone: ROSTER_TONES[i % ROSTER_TONES.length] }));
}

// ───────────── الاتفاقيات ─────────────
// الافتتاح، ثم شريحة لكل جهة، ثم شبكة الشعارات كلها

export const agreementSteps = (s: AgreementsSettings) => s.parties.length + 2;
export function agreementAt(s: AgreementsSettings, step: number) {
  if (step <= 0) return { kind: 'intro' as const };
  if (step > s.parties.length) return { kind: 'all' as const };
  return { kind: 'party' as const, party: s.parties[step - 1], index: step - 1 };
}

// ───────────── التدشين ─────────────
// 0 انتظار، 1 الحركة الانتقالية، 2 «تم التدشين»
export const LAUNCH_STEPS = 3;
/** مدة الحركة الانتقالية قبل ظهور «تم التدشين» */
export const LAUNCH_ANIM_MS = 3600;

// ───────────── جدول الحفل ─────────────

export interface AgendaItem {
  title: string;
  minutes: number;
  /** أول شريحة في الفقرة (بترتيب العرض) وآخرها */
  from: number;
  to: number;
}

/** الفقرات بمددها: كل شريحة تحمل section تبدأ فقرة، وما بعدها تابع لها. ما قبل أول فقرة يتبع الأولى */
export function agenda(list: Segment[]): AgendaItem[] {
  const out: AgendaItem[] = [];
  list.forEach((s, i) => {
    if (s.section || !out.length) out.push({ title: s.section?.title || s.title, minutes: s.section?.minutes ?? 0, from: i, to: i });
    else out[out.length - 1].to = i;
  });
  return out;
}

export const agendaIndex = (items: AgendaItem[], seg: number) => Math.max(0, items.findIndex((a) => seg >= a.from && seg <= a.to));
export const totalMinutes = (items: Pick<AgendaItem, 'minutes'>[]) => items.reduce((n, a) => n + (Number.isFinite(a.minutes) ? a.minutes : 0), 0);

/** ساعة الحفل: الزمن الفعلي لكل فقرة. يعمل بعد «ابدأ العرض» ويُحسب للفقرة المعروضة */
export interface Timing {
  /** الزمن المتراكم لكل فقرة (بالملّي ثانية)، بالمفتاح عنوان الفقرة ورقمها */
  spent: Record<string, number>;
  /** الفقرة الجارية وبداية احتسابها، أو null إن كانت الساعة متوقفة */
  current: string | null;
  since: number;
  startedAt: number | null;
}

export const agendaKey = (items: AgendaItem[], i: number) => `${i}:${items[i]?.title ?? ''}`;
export const emptyTiming = (): Timing => ({ spent: {}, current: null, since: 0, startedAt: null });

/** ينقل الساعة إلى فقرة (أو يوقفها بـ null) ويضيف الزمن المنقضي للفقرة السابقة */
export function tick(t: Timing, key: string | null, now: number): Timing {
  if (t.current === key) return t;
  const spent = { ...t.spent };
  if (t.current) spent[t.current] = (spent[t.current] ?? 0) + Math.max(0, now - t.since);
  return { spent, current: key, since: now, startedAt: t.startedAt ?? (key ? now : null) };
}

/** الزمن الفعلي لفقرة حتى الآن */
export const spentOf = (t: Timing, key: string, now: number) => (t.spent[key] ?? 0) + (t.current === key ? Math.max(0, now - t.since) : 0);
export const fmtClock = (ms: number) => {
  const s = Math.round(Math.abs(ms) / 1000);
  return `${ms < 0 ? '-' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export type { Section };
