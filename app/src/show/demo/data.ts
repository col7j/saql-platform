// بيانات الديمو: اللقطة الملتقطة من بيانات المنصة الفعلية (snapshot.ts) بمنظور المشارك المختار،
// وإن لم توجد لقطة فالبيانات التجريبية مُثراة في الذاكرة فقط. والمتجر للقراءة فقط داخل إطار الديمو.
import type { DemoPage } from '../model';
import { buildSeed } from '@/data/seed';
import { eventsFor } from '@/domain/calendar';
import { todayISO } from '@/domain/dates';
import { canTakeTripAttendance, canViewTripPlans, getCapabilities } from '@/domain/permissions';
import type { DB } from '@/domain/types';
import { useStore } from '@/state/store';
import { loadSnapshot } from './snapshot';

/** مشارك البيانات التجريبية (بلا لقطة): أصيل نايف الجهني من مجموعة أُحُد (ليس قائد المجموعة) */
export const DEMO_PARTICIPANT = 'u2';

/** المعرّفات التي تقف عندها الكاميرا */
export interface DemoTargets {
  personId: string;
  tripId: string;
  focusId: string;
  /** أكثر يوم أنشطةً في الشهر الحالي (يظهر في التقويم) */
  day: string;
}

const busiestDay = (db: DB, pid: string) => {
  const month = todayISO().slice(0, 7);
  const count = new Map<string, number>();
  for (const e of eventsFor(db, pid)) if (e.date.startsWith(month) && !e.endDate) count.set(e.date, (count.get(e.date) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
};

export function demoTargets(db: DB, preferred = DEMO_PARTICIPANT): DemoTargets {
  const isP = (id: string) => db.persons.some((p) => p.id === id && p.kind === 'participant');
  const personId = isP(preferred) ? preferred : isP(DEMO_PARTICIPANT) ? DEMO_PARTICIPANT : db.persons.find((p) => p.kind === 'participant')!.id;
  const visible = db.trips.filter((t) => canViewTripPlans(db, personId, t));
  // رحلة المجموعة المكتملة: لها خطتان بجدول وإغلاق، والمنتهية أولى لأن فيها الحضور والتقييم
  const trip =
    visible.find((t) => t.closure.publicReport && (t.schedule.plans[1]?.items.length ?? 0) > 0) ??
    visible.find((t) => (t.schedule.plans[1]?.items.length ?? 0) > 0) ??
    visible[0] ?? db.trips[0];
  const group = getCapabilities(db, personId).group?.id;
  const focus =
    db.focusMeetings.find((f) => f.groupId === group && f.status === 'closed' && f.presenterIds.includes(personId)) ??
    db.focusMeetings.find((f) => f.groupId === group && f.status === 'closed') ??
    db.focusMeetings[0];
  return { personId, tripId: trip.id, focusId: focus.id, day: busiestDay(db, personId) ?? todayISO() };
}

/** إثراء البيانات التجريبية وحدها (لا يمس بيانات المنصة): كل شاشة يمر بها الديمو فيها ما يُعرض.
 *  اللقطة الحقيقية لا تُثرى: لا تقييمات ولا لقاءات مخترعة على أشخاص حقيقيين */
export function enrichDemo(db: DB): DB {
  const { personId, tripId, focusId } = demoTargets(db);
  const me = db.persons.find((p) => p.id === personId)!;
  me.profileCompletedAt ??= `${todayISO()}T08:00:00.000Z`;

  // الرحلة: المشارك محضّر الحضور فيها، فيرى تبويب الحضور كما يراه المحضّر فعلاً
  const trip = db.trips.find((t) => t.id === tripId)!;
  trip.attendanceTakerId ??= personId;

  // لقاء التركيز: المشارك مقدّمه، وتقييم الميسّر له مكتمل
  const f = db.focusMeetings.find((x) => x.id === focusId)!;
  if (!f.presenterIds.includes(personId)) f.presenterIds = [...f.presenterIds, personId];
  f.presenterAxes[personId] ??= 'إدارة الوقت للطالب الجامعي';
  const scores = [5, 4, 5, 5, 4, 5];
  f.presenterEvaluations[personId] ??= Object.fromEntries(db.settings.presentationCriteria.map((c, i) => [c.key, scores[i % scores.length]]));

  // التقويم: لقاء فردي مع الميسّر في أكثر الأيام أنشطة، فيجتمع فيه العام والمجموعة والخاص
  const day = busiestDay(db, personId);
  const g = db.groups.find((x) => x.id === getCapabilities(db, personId).group?.id);
  if (day && g?.facilitatorId && !db.individualMeetings.some((m) => m.participantId === personId && m.date === day && m.status !== 'cancelled')) {
    // اليوم الماضي يظهر لقاءً منجزاً بملاحظاته، والقادم محجوزاً
    const past = day < todayISO();
    db.individualMeetings.push({
      id: 'im_demo', facilitatorId: g.facilitatorId, participantId: personId, date: day, start: '19:30', end: '20:15', origin: 'personal_invite',
      status: past ? 'done' : 'booked',
      notesOnPlan: 'خطوات الجانب المهاري واضحة ومجدولة، والجانب الصحي يحتاج هدفاً قابلاً للقياس.',
      notesOnMeeting: past ? 'لقاء مركّز، واتفقنا على مراجعة الخطة بعد الرحلة القادمة.' : undefined,
    });
  }
  return db;
}

/** تجاوز شاشة إكمال الملف الشخصي (بوابة دخول، لا محتوى): بدونها تفتح المنصة نموذج الإكمال بدل الصفحة */
function passProfileGate(db: DB, personId: string) {
  const me = db.persons.find((p) => p.id === personId);
  if (me) me.profileCompletedAt ??= `${todayISO()}T08:00:00.000Z`;
  return db;
}

export interface DemoData {
  db: DB;
  targets: DemoTargets;
  /** snapshot: لقطة ملتقطة، seed: البيانات التجريبية (لا لقطة صالحة) */
  source: 'snapshot' | 'seed';
}

let cached: DemoData | null = null;
/** بيانات الديمو في هذه النافذة: تُقرأ مرة في الذاكرة ولا تُحفظ في أي مخزن */
export function demoData(): DemoData {
  if (cached) return cached;
  const snap = loadSnapshot();
  if (snap) {
    const db = passProfileGate(JSON.parse(JSON.stringify(snap.db)), snap.participantId);
    return (cached = { db, targets: demoTargets(db, snap.participantId), source: 'snapshot' });
  }
  const db = enrichDemo(buildSeed());
  return (cached = { db, targets: demoTargets(db), source: 'seed' });
}

/** بعد التقاط لقطة أو تغيير المشارك أو استيراد عرض: تُقرأ البيانات من جديد */
export function invalidateDemoData() {
  cached = null;
}

export const demoSnapshot = (): DB => demoData().db;

/** ما سيظهر ناقصاً أو فارغاً في جولة الديمو بمنظور المشارك، لتنبيه المحرّر (لا يظهر على شاشة العرض) */
export function demoGaps({ db, targets: t }: Pick<DemoData, 'db' | 'targets'>): string[] {
  const out: string[] = [];
  const caps = getCapabilities(db, t.personId);
  if (!caps.group) out.push('المشارك ليس في مجموعة منشورة: صفحات المجموعة ستظهر فارغة');
  const trip = db.trips.find((x) => x.id === t.tripId);
  if (!trip || !canViewTripPlans(db, t.personId, trip)) out.push('لا توجد رحلة يراها المشارك: مشهد الرحلات سيظهر فارغاً');
  else {
    if (!(trip.schedule.plans[1]?.items.length ?? 0)) out.push(`رحلة «${trip.title}» بلا خطة ب: صفحة الخطتين ستعرض خطة واحدة`);
    if (!canTakeTripAttendance(db, t.personId, trip)) out.push(`المشارك ليس محضّر الحضور في «${trip.title}»: تبويب الحضور يظهر كما يراه المشارك العادي`);
  }
  const f = db.focusMeetings.find((x) => x.id === t.focusId);
  if (!f) out.push('لا يوجد لقاء تركيز: مشهد لقاءات التركيز سيظهر فارغاً');
  else if (!f.presenterIds.includes(t.personId)) out.push('المشارك لم يقدّم في لقاء تركيز: صفحة اللقاء تظهر بلا تقييم له');
  if (!eventsFor(db, t.personId).some((e) => e.date.startsWith(todayISO().slice(0, 7)))) out.push('لا أحداث للمشارك هذا الشهر: التقويم سيظهر فارغاً');
  const plan = db.personalPlans.find((p) => p.participantId === t.personId);
  if (!plan?.aspects.some((a) => a.steps.length > 0)) out.push('الخطة الشخصية للمشارك بلا خطوات');
  return out;
}
export const demoUserId = (db: DB) => (cached?.db === db ? cached.targets.personId : demoTargets(db).personId);

/** الشاشات التي يعرضها إطار الديمو، ورسالة جاهزيته للنافذة الأم */
export type DemoViewKey = DemoPage;
export const DEMO_READY = 'saql-demo-ready';

const noop = () => undefined;
let readOnly = false;

/** يحوّل متجر المنصة في هذه النافذة إلى قراءة فقط فوق اللقطة الثابتة: أي تعديل من الشاشات يُهمل */
export function enterReadOnly() {
  if (readOnly) return;
  readOnly = true;
  const { db, targets } = demoData();
  useStore.setState({ db, userId: targets.personId, commit: noop, setUser: noop, reset: noop, toast: noop });
}
