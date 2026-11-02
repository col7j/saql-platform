// المركز الإعلامي (منطق نقي، بلا واجهة):
// - الصلاحيات: القائد العام ورئيس اللجنة الإعلامية يملكان كل شيء، والعضو يملك ما منحه له القائد العام.
// - الفعاليات والجداول تُقرأ حياً من الرحلات ولقاءات التركيز واللقاءين الافتتاحي والختامي ولا تُنسخ.
// - الاعتماد يجمّد لقطة بإصدار، وأي تغيير في الجدول بعده يظهر «تغييراً معلّقاً» ولا يمس الرابط حتى يؤكده المسؤول.
// - المؤشرات تُحسب من اللقطة المعتمدة وحالات التنفيذ، وتفرّق بين «لم تُنفَّذ» و«نُفّذت بلا إثبات».
import { sha256Hex } from './crypto';
import { addDays, fmtDate, now, parseDate, todayISO } from './dates';
import { uid } from './id';
import { isTaskLate } from './workflow';
import type {
  BriefContent, BriefEvent, BriefFrozen, BriefItemExec, BriefSection, BriefSectionKey, DB, EventRef, ID, ISODate, MediaBrief, MediaItemStatus,
  MediaLink, MediaPermission, MediaPriority, MediaTemplate, ResolvedBriefEvent,
} from './types';

// ───────────── الصلاحيات ─────────────
export const MEDIA_PERMS: { key: MediaPermission; label: string; hint: string }[] = [
  { key: 'edit', label: 'إنشاء وتحرير الموجزات', hint: 'ينشئ الموجزات والقوالب ويحررها' },
  { key: 'approve', label: 'الاعتماد والمشاركة', hint: 'يعتمد الموجز ويصدر الروابط والـPDF ويلغي الروابط' },
  { key: 'metrics', label: 'عرض المؤشرات', hint: 'يرى مؤشرات اكتمال التوثيق والتسليم' },
];

export function mediaCommitteeId(db: DB): ID | undefined {
  return db.committees.find((c) => c.kind === 'media')?.id;
}
/** رئيس اللجنة الإعلامية */
export function isMediaHead(db: DB, pid: ID): boolean {
  const cid = mediaCommitteeId(db);
  return db.memberships.some((m) => m.committeeId === cid && m.personId === pid && m.role === 'leader');
}
function isLeaderId(db: DB, pid: ID) {
  return !!db.persons.find((p) => p.id === pid)?.isGeneralLeader;
}
export function mediaPermsOf(db: DB, pid: ID): MediaPermission[] {
  if (isLeaderId(db, pid) || isMediaHead(db, pid)) return MEDIA_PERMS.map((p) => p.key);
  const cid = mediaCommitteeId(db);
  return db.memberships.find((m) => m.committeeId === cid && m.personId === pid)?.mediaPerms ?? [];
}
export function hasMediaPerm(db: DB, pid: ID, perm: MediaPermission): boolean {
  return mediaPermsOf(db, pid).includes(perm);
}
/** المركز كله ضمن صلاحيات اللجنة الإعلامية: القائد العام، ورئيسها، وعضو منحه القائد العام صلاحية واحدة على الأقل */
export function canOpenMedia(db: DB, pid: ID): boolean {
  return mediaPermsOf(db, pid).length > 0;
}

// ───────────── الفعاليات (حية، بلا نسخ) ─────────────
export interface MediaEvent {
  ref: EventRef;
  title: string;
  kindLabel: string;
  date: ISODate;
  endDate?: ISODate;
  start?: string;
  end?: string;
  location?: string;
  schedule: { id: ID; date: ISODate; start: string; end: string; detail: string }[];
}
export const refKey = (r: EventRef) => `${r.kind}:${r.id}`;

/** كل ما يُغطّى إعلامياً: الرحلات، ولقاءات التركيز المحدّدة التاريخ، واللقاءان الافتتاحي والختامي */
export function mediaEvents(db: DB): MediaEvent[] {
  const trips: MediaEvent[] = db.trips.map((t) => {
    const items = [...(t.schedule.plans[0]?.items ?? [])].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    return {
      ref: { kind: 'trip', id: t.id }, title: t.title, kindLabel: t.type === 'internal' ? 'رحلة داخلية' : 'رحلة خارجية', date: t.startDate, endDate: t.endDate !== t.startDate ? t.endDate : undefined,
      start: items[0]?.start, end: items[items.length - 1]?.end, location: t.location,
      schedule: items.map((i) => ({ id: i.id, date: i.date, start: i.start, end: i.end, detail: i.detail })),
    };
  });
  const focus: MediaEvent[] = db.focusMeetings.filter((f) => f.date).map((f) => ({
    ref: { kind: 'focus', id: f.id }, title: f.title, kindLabel: f.isUmrah ? 'لقاء العمرة' : 'لقاء تركيز', date: f.date!, start: f.start, end: f.end, location: f.location, schedule: [],
  }));
  const events: MediaEvent[] = db.events.map((e) => ({
    ref: { kind: 'event', id: e.id }, title: e.title, kindLabel: e.kind === 'opening' ? 'اللقاء الافتتاحي' : 'اللقاء الختامي', date: e.date, location: e.location, schedule: [],
  }));
  return [...trips, ...focus, ...events].sort((a, b) => a.date.localeCompare(b.date));
}
export function resolveEvent(db: DB, ref: EventRef): MediaEvent | undefined {
  return mediaEvents(db).find((e) => refKey(e.ref) === refKey(ref));
}
export const eventEnd = (e: { date: ISODate; endDate?: ISODate }) => e.endDate ?? e.date;

/** بداية الأسبوع الذي يقع فيه التاريخ، حسب يوم البداية في الإعدادات (السبت افتراضياً) */
export function weekStartOf(date: ISODate, startDay: number): ISODate {
  const wd = parseDate(date).getDay();
  return addDays(date, -((wd - startDay + 7) % 7));
}
export function weekEvents(db: DB, weekStart: ISODate): MediaEvent[] {
  const end = addDays(weekStart, 6);
  return mediaEvents(db).filter((e) => e.date >= weekStart && e.date <= end);
}

// ───────────── الأقسام والقوالب ─────────────
export const SECTION_TITLES: Record<string, string> = {
  info: 'معلومات الفعالية', goals: 'أهداف التغطية', schedule: 'جدول البرنامج التفصيلي', shots: 'قائمة اللقطات المطلوبة', interviews: 'المقابلات المطلوبة والأسئلة المقترحة',
  visual: 'التوجيهات البصرية والفنية', onsite: 'المحتوى المطلوب أثناء الفعالية', deliverables: 'المخرجات النهائية', partners: 'متطلبات ظهور الشركاء', contacts: 'جهات التواصل',
  notes: 'تعليمات وملاحظات', responsibilities: 'المسؤوليات', deadlines: 'مواعيد التسليم',
};
/** الأقسام التي تُسحب من الفعالية تلقائياً (تظهر بعلامة «من الجدول») */
export const AUTO_SECTIONS: BriefSectionKey[] = ['info', 'schedule'];
/** الأقسام المشتركة في الموجز الأسبوعي فقط */
export const WEEK_ONLY_SECTIONS: BriefSectionKey[] = ['responsibilities', 'deadlines'];
const ORDER: BriefSectionKey[] = ['info', 'goals', 'schedule', 'shots', 'interviews', 'visual', 'onsite', 'deliverables', 'partners', 'contacts', 'notes', 'responsibilities', 'deadlines'];

export function emptySections(): BriefSection[] {
  return ORDER.map((key) => ({ key, title: SECTION_TITLES[key], visible: !WEEK_ONLY_SECTIONS.includes(key), body: '' }));
}
/** الأقسام التي يعرضها الموجز بحسب نوعه: المشتركة الأسبوعية لا تظهر في موجز اللقاء */
export const sectionsFor = (kind: MediaBrief['kind'], sections: BriefSection[]) => sections.filter((s) => kind === 'week' || !WEEK_ONLY_SECTIONS.includes(s.key));

export const priorityLabel: Record<MediaPriority, string> = { must: 'ضرورية', important: 'مهمة', extra: 'إضافية' };
/** افتراضي «مطلوبة»: الضرورية والمهمة مطلوبة، والإضافية اختيارية */
export const defaultRequired = (p: MediaPriority) => p !== 'extra';

/** موجز جديد من قالب: نسخة من القالب، فتعديل القالب لاحقاً لا يؤثر عليه */
export function newBriefFromTemplate(db: DB, tpl: MediaTemplate, scope: { kind: 'event'; ref: EventRef } | { kind: 'week'; weekStart: ISODate; refs: EventRef[] }): { content: BriefContent; kind: MediaBrief['kind'] } {
  const refs = scope.kind === 'event' ? [scope.ref] : scope.refs;
  const evs = refs.map((r) => resolveEvent(db, r)).filter((e): e is MediaEvent => !!e);
  const anchor = evs.length ? evs.map(eventEnd).sort().pop()! : scope.kind === 'week' ? addDays(scope.weekStart, 6) : todayISO();
  const events: BriefEvent[] = refs.map((ref) => ({
    id: uid('be'), ref,
    shots: tpl.shots.map((s) => ({ id: uid('sh'), title: s.title, priority: s.priority, required: s.required })),
    interviews: tpl.interviews.map((i) => ({ id: uid('iv'), who: i.who, questions: [...i.questions], required: i.required })),
    notes: '',
  }));
  const title = scope.kind === 'event' ? `موجز تغطية: ${evs[0]?.title ?? 'فعالية'}` : `موجز أسبوع ${fmtDate(scope.weekStart)}`;
  return {
    kind: scope.kind,
    content: {
      title, weekStart: scope.kind === 'week' ? scope.weekStart : undefined, events,
      sections: tpl.sections.map((s) => ({ ...s })),
      deliverables: tpl.deliverables.map((d) => ({ id: uid('dv'), title: d.title, type: d.type, spec: d.spec, dueDate: addDays(anchor, d.dueOffsetDays), required: d.required })),
      contacts: [], responsibilities: [], deadlines: [],
    },
  };
}

// ───────────── التجميد والإصدارات ─────────────
export const contentHash = (c: BriefContent) => sha256Hex(JSON.stringify(c));

function resolveBriefEvent(db: DB, e: BriefEvent): ResolvedBriefEvent {
  const live = resolveEvent(db, e.ref);
  return {
    id: e.id, ref: e.ref, title: live?.title ?? 'فعالية محذوفة', kindLabel: live?.kindLabel ?? '', date: live?.date ?? todayISO(), endDate: live?.endDate, start: live?.start, end: live?.end,
    location: live?.location, schedule: live?.schedule ?? [], shots: structuredClone(e.shots), interviews: structuredClone(e.interviews), notes: e.notes,
  };
}
/** يقرأ الفعاليات حياً ويجمّد كل ما يخص الموجز. المسودة تعرضه مباشرة، والاعتماد يحفظه لقطةً */
export function freezeBrief(db: DB, brief: Pick<MediaBrief, 'kind' | 'content'>): BriefFrozen {
  const c = structuredClone(brief.content);
  return { ...c, kind: brief.kind, events: c.events.map((e) => resolveBriefEvent(db, e)) };
}
export const latestSnapshot = (b: MediaBrief) => b.snapshots[b.snapshots.length - 1];
export const hasUnpublishedEdits = (b: MediaBrief) => !!latestSnapshot(b) && latestSnapshot(b).contentHash !== contentHash(b.content);

/** تغييرات جدول الفعاليات بعد الاعتماد: تُعرض بانتظار التأكيد ولا تغيّر الرابط */
export function pendingChanges(db: DB, brief: MediaBrief): string[] {
  const snap = latestSnapshot(brief);
  if (!snap) return [];
  const out: string[] = [];
  const fmt = (d?: string) => (d ? fmtDate(d) : '—');
  for (const old of snap.data.events) {
    const live = resolveEvent(db, old.ref);
    const name = old.title;
    if (!live) { out.push(`حُذفت الفعالية «${name}»`); continue; }
    if (live.title !== old.title) out.push(`تغيّر اسم «${name}» إلى «${live.title}»`);
    if (live.date !== old.date || (live.endDate ?? '') !== (old.endDate ?? '')) out.push(`تغيّر موعد «${name}»: من ${fmt(old.date)}${old.endDate ? ` إلى ${fmt(old.endDate)}` : ''} إلى ${fmt(live.date)}${live.endDate ? ` إلى ${fmt(live.endDate)}` : ''}`);
    if ((live.start ?? '') !== (old.start ?? '') || (live.end ?? '') !== (old.end ?? '')) out.push(`تغيّر وقت «${name}»: من ${old.start ?? '—'}–${old.end ?? '—'} إلى ${live.start ?? '—'}–${live.end ?? '—'}`);
    if ((live.location ?? '') !== (old.location ?? '')) out.push(`تغيّر مكان «${name}»: من ${old.location || '—'} إلى ${live.location || '—'}`);
    const oldIds = new Map(old.schedule.map((i) => [i.id, i]));
    const liveIds = new Map(live.schedule.map((i) => [i.id, i]));
    for (const i of live.schedule) {
      const o = oldIds.get(i.id);
      if (!o) out.push(`أُضيف بند لجدول «${name}»: ${i.start} ${i.detail}`);
      else if (o.start !== i.start || o.end !== i.end || o.date !== i.date) out.push(`تغيّر وقت بند «${i.detail}» في «${name}»: من ${o.start}–${o.end} إلى ${i.start}–${i.end}`);
      else if (o.detail !== i.detail) out.push(`تغيّر وصف بند في «${name}»: من «${o.detail}» إلى «${i.detail}»`);
    }
    for (const o of old.schedule) if (!liveIds.has(o.id)) out.push(`حُذف بند من جدول «${name}»: ${o.start} ${o.detail}`);
  }
  return out;
}

// ───────────── ما يراه الفريق خارج المنصة ─────────────
/**
 * العرض الخارجي (الرابط والمعاينة والـPDF): الأقسام الظاهرة فقط، والجهات المصرّح بمشاركتها فقط.
 * الملاحظات الداخلية لا تدخل اللقطة أصلاً، ولا بيانات مالية في الموجز.
 */
export function publicContent(d: BriefFrozen): BriefFrozen {
  const keep = new Set(sectionsFor(d.kind, d.sections).filter((s) => s.visible).map((s) => s.key));
  return { ...structuredClone(d), sections: sectionsFor(d.kind, d.sections).filter((s) => s.visible), contacts: d.contacts.filter((c) => c.authorized), ...(keep.has('responsibilities') ? {} : { responsibilities: [] }), ...(keep.has('deadlines') ? {} : { deadlines: [] }) };
}

/** النسخة المختصرة من الـPDF: اللقطات الضرورية، والمخرجات ومواعيدها، والتواصل */
export function shortContent(d: BriefFrozen): BriefFrozen {
  const keys = new Set<BriefSectionKey>(['shots', 'deliverables', 'contacts']);
  const p = publicContent(d);
  return { ...p, sections: p.sections.filter((s) => keys.has(s.key)), events: p.events.map((e) => ({ ...e, shots: e.shots.filter((s) => s.priority === 'must'), interviews: [] })) };
}

export const isHttpUrl = (s: string): boolean => {
  try {
    const u = new URL(s.trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch {
    return false;
  }
};

// ───────────── البنود وحالات التنفيذ ─────────────
export type ItemKind = 'shot' | 'interview' | 'deliverable';
export interface FrozenItem { id: ID; kind: ItemKind; title: string; required: boolean; eventId?: ID; eventTitle?: string; dueDate?: ISODate; eventEnded: boolean }
export const itemKindLabel: Record<ItemKind, string> = { shot: 'لقطة', interview: 'مقابلة', deliverable: 'مخرج' };
export const itemStatusLabel: Record<MediaItemStatus, string> = { not_started: 'لم تبدأ', in_progress: 'قيد التنفيذ', done: 'مكتملة', failed: 'متعذرة' };

export function frozenItems(d: BriefFrozen, today = todayISO()): FrozenItem[] {
  const items: FrozenItem[] = [];
  const allEnded = d.events.length > 0 && d.events.every((e) => eventEnd(e) < today);
  for (const e of d.events) {
    const ended = eventEnd(e) < today;
    e.shots.forEach((s) => items.push({ id: s.id, kind: 'shot', title: s.title, required: s.required, eventId: e.id, eventTitle: e.title, eventEnded: ended }));
    e.interviews.forEach((i) => items.push({ id: i.id, kind: 'interview', title: i.who, required: i.required, eventId: e.id, eventTitle: e.title, eventEnded: ended }));
  }
  d.deliverables.forEach((v) => items.push({ id: v.id, kind: 'deliverable', title: v.title, required: v.required, dueDate: v.dueDate, eventEnded: v.dueDate ? v.dueDate < today : allEnded }));
  return items;
}
export const execOf = (b: MediaBrief, id: ID): BriefItemExec =>
  b.execution[id] ?? { status: 'not_started', proofs: [], notes: [], updatedBy: '', updatedAt: '' };

/** تعديل حالة بند. «متعذرة» لا تُقبل بلا سبب، والروابط http/https فقط. تُستخدم من لوحة المسؤول ومن رابط المتابعة */
export function applyExec(b: MediaBrief, itemId: ID, actor: string, patch: { status?: MediaItemStatus; reason?: string; addProof?: string; note?: string }, at: string): void {
  const cur = b.execution[itemId] ?? { status: 'not_started' as MediaItemStatus, proofs: [], notes: [], updatedBy: actor, updatedAt: at };
  if (patch.addProof !== undefined) {
    if (!isHttpUrl(patch.addProof)) throw new Error('رابط الإثبات يجب أن يبدأ بـ http أو https');
    if (!cur.proofs.includes(patch.addProof.trim())) cur.proofs.push(patch.addProof.trim());
  }
  if (patch.status) {
    if (patch.status === 'failed' && !(patch.reason ?? cur.reason)?.trim()) throw new Error('اكتب سبب التعذّر');
    cur.status = patch.status;
    cur.reason = patch.status === 'failed' ? (patch.reason ?? cur.reason)!.trim() : undefined;
    cur.doneAt = patch.status === 'done' ? at : undefined;
  }
  if (patch.note?.trim()) cur.notes.push({ id: uid('mn'), text: patch.note.trim(), by: actor, at });
  cur.updatedBy = actor;
  cur.updatedAt = at;
  b.execution[itemId] = cur;
}

// ───────────── المؤشرات ─────────────
export interface MissingItem { briefId: ID; briefTitle: string; item: FrozenItem; status: MediaItemStatus }
export interface MediaMetrics {
  /** اللقطات المطلوبة (الاختيارية خارج الحساب) */
  shotsRequired: number;
  shotsDone: number;
  shotsDocumented: number;
  /** نسبة اكتمال التوثيق = لقطات مطلوبة مكتملة بإثبات ÷ إجمالي المطلوبة (0..100) */
  completionPct: number;
  interviewsTotal: number;
  interviewsDone: number;
  deliverablesRequired: number;
  deliverablesDelivered: number;
  deliveryPct: number;
  /** الالتزام بالمواعيد: المسلَّم قبل الموعد ÷ المسلَّم الذي له موعد */
  onTimePct: number;
  /** لم تُنفَّذ: متعذرة أو لم تبدأ أو قيد التنفيذ بعد انتهاء الفعالية */
  notExecuted: MissingItem[];
  /** نُفّذت بلا إثبات: مكتملة بلا رابط */
  noProof: MissingItem[];
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function briefMetrics(briefs: MediaBrief[], today = todayISO()): MediaMetrics {
  const m: MediaMetrics = { shotsRequired: 0, shotsDone: 0, shotsDocumented: 0, completionPct: 0, interviewsTotal: 0, interviewsDone: 0, deliverablesRequired: 0, deliverablesDelivered: 0, deliveryPct: 0, onTimePct: 0, notExecuted: [], noProof: [] };
  let delivered = 0, onTime = 0;
  for (const b of briefs.filter((x) => x.status === 'approved' && latestSnapshot(x))) {
    const data = latestSnapshot(b).data;
    for (const item of frozenItems(data, today)) {
      const ex = execOf(b, item.id);
      const done = ex.status === 'done';
      if (item.kind === 'shot' && item.required) {
        m.shotsRequired++;
        if (done) m.shotsDone++;
        if (done && ex.proofs.length) m.shotsDocumented++;
      }
      if (item.kind === 'interview') { m.interviewsTotal++; if (done) m.interviewsDone++; }
      if (item.kind === 'deliverable') {
        if (item.required) { m.deliverablesRequired++; if (done) m.deliverablesDelivered++; }
        if (done && item.dueDate && ex.doneAt) { delivered++; if (ex.doneAt.slice(0, 10) <= item.dueDate) onTime++; }
      }
      if (item.required && item.eventEnded) {
        if (!done) m.notExecuted.push({ briefId: b.id, briefTitle: data.title, item, status: ex.status });
        else if (!ex.proofs.length) m.noProof.push({ briefId: b.id, briefTitle: data.title, item, status: ex.status });
      }
    }
  }
  m.completionPct = pct(m.shotsDocumented, m.shotsRequired);
  m.deliveryPct = pct(m.deliverablesDelivered, m.deliverablesRequired);
  m.onTimePct = pct(onTime, delivered);
  return m;
}

// ───────────── روابط المشاركة ─────────────
export type LinkState = 'active' | 'expired' | 'revoked';
export function linkState(l: MediaLink, at: Date = now()): LinkState {
  if (l.revokedAt) return 'revoked';
  if (l.expiresAt && new Date(l.expiresAt) <= at) return 'expired';
  return 'active';
}
export const tokenHash = (token: string) => sha256Hex(`media-link:${token}`);
/** رمز عشوائي طويل لا يُخمَّن (160 بتاً) */
export function newToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 40);
}
export const findLinkByToken = (db: DB, token: string) => {
  const h = tokenHash(token);
  return db.mediaLinks.find((l) => l.tokenHash === h);
};

// ───────────── «المطلوب الآن» في الرئيسية ─────────────
export interface MediaTodo { id: string; tone: 'red' | 'orange' | 'blue'; title: string; hint?: string; to: string; cta: string }
export function mediaTodos(db: DB, today = todayISO()): MediaTodo[] {
  const s = db.settings.media;
  const out: MediaTodo[] = [];
  const live = db.mediaBriefs.filter((b) => b.status !== 'archived');
  const covered = new Set(live.flatMap((b) => b.content.events.map((e) => refKey(e.ref))));
  // فعاليات قادمة بلا موجز
  mediaEvents(db).filter((e) => e.date >= today && e.date <= addDays(today, s.upcomingDays) && !covered.has(refKey(e.ref))).forEach((e) =>
    out.push({ id: `ev_${refKey(e.ref)}`, tone: 'red', title: `لا موجز لـ «${e.title}»`, hint: `${fmtDate(e.date)} · ${e.kindLabel}`, to: `/app/media/briefs/new?ref=${refKey(e.ref)}`, cta: 'أنشئ الموجز' }),
  );
  // مسودات
  live.filter((b) => b.status === 'draft').forEach((b) =>
    out.push({ id: `dr_${b.id}`, tone: 'orange', title: `مسودة: ${b.content.title}`, hint: b.approvalRequest ? 'بانتظار موافقة القائد العام' : 'لم تُعتمد بعد', to: `/app/media/briefs/${b.id}`, cta: 'أكمل' }),
  );
  // تغييرات جدول بانتظار التأكيد
  live.filter((b) => b.status === 'approved').forEach((b) => {
    const ch = pendingChanges(db, b);
    if (ch.length) out.push({ id: `pc_${b.id}`, tone: 'orange', title: `تغييرات بانتظار التأكيد: ${b.content.title}`, hint: `${ch.length} تغيير`, to: `/app/media/briefs/${b.id}`, cta: 'راجع وأكّد' });
  });
  // روابط ستنتهي قريباً
  db.mediaLinks.filter((l) => linkState(l) === 'active' && l.expiresAt && new Date(l.expiresAt) <= new Date(addDays(today, s.linkExpiryWarnDays) + 'T23:59:59')).forEach((l) => {
    const b = db.mediaBriefs.find((x) => x.id === l.briefId);
    out.push({ id: `lk_${l.id}`, tone: 'orange', title: `رابط ${l.kind === 'track' ? 'متابعة' : 'قراءة'} سينتهي ${fmtDate(l.expiresAt)}`, hint: b?.content.title, to: '/app/media/links', cta: 'الروابط' });
  });
  // لقطات ناقصة بعد فعالية انتهت
  const m = briefMetrics(db.mediaBriefs, today);
  const byBrief = new Map<ID, number>();
  m.notExecuted.filter((x) => x.item.kind === 'shot').forEach((x) => byBrief.set(x.briefId, (byBrief.get(x.briefId) ?? 0) + 1));
  byBrief.forEach((n, id) => out.push({ id: `ms_${id}`, tone: 'red', title: `${n} لقطات مطلوبة ناقصة بعد انتهاء الفعالية`, hint: db.mediaBriefs.find((b) => b.id === id)?.content.title, to: `/app/media/follow?brief=${id}`, cta: 'المتابعة' }));
  // مهام اللجنة الإعلامية المتأخرة (من قسم المهام)
  const cid = mediaCommitteeId(db);
  db.tasks.filter((t) => t.committeeId === cid && t.status !== 'done' && isTaskLate(t)).forEach((t) =>
    out.push({ id: `tk_${t.id}`, tone: 'red', title: `مهمة متأخرة: ${t.title}`, hint: `الموعد ${fmtDate(t.dueDate)}`, to: '/app/tasks', cta: 'المهام' }),
  );
  const rank = { red: 0, orange: 1, blue: 2 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

// ───────────── فواتير إضافية ─────────────
/** يراها صاحب العهدة واللجنة المالية والقائد العام فقط */
export function canSeeExtraInvoice(db: DB, pid: ID, inv: { custodyId: ID; addedBy: ID }): boolean {
  const c = db.custodies.find((x) => x.id === inv.custodyId);
  if (!c) return false;
  if (c.recipientId === pid || inv.addedBy === pid) return true;
  const fin = db.committees.find((x) => x.kind === 'finance')?.id;
  return isLeaderId(db, pid) || db.memberships.some((m) => m.committeeId === fin && m.personId === pid);
}
export const visibleExtraInvoices = (db: DB, pid: ID) => db.extraInvoices.filter((i) => canSeeExtraInvoice(db, pid, i));
