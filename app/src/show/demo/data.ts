// بيانات الديمو: لقطة ثابتة من البيانات التجريبية بصفة مشارك، مُثراة في الذاكرة فقط،
// والمتجر في وضع القراءة فقط داخل إطار الديمو.
import type { DemoPage } from '../model';
import { buildSeed } from '@/data/seed';
import { eventsFor } from '@/domain/calendar';
import { todayISO } from '@/domain/dates';
import { canViewTripPlans, getCapabilities } from '@/domain/permissions';
import type { DB } from '@/domain/types';
import { useStore } from '@/state/store';

/** المشارك الذي يُعرض الديمو بصفته: يوسف الرحيلي من مجموعة أُحُد (ليس قائد المجموعة) */
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

export function demoTargets(db: DB): DemoTargets {
  const personId = db.persons.some((p) => p.id === DEMO_PARTICIPANT && p.kind === 'participant') ? DEMO_PARTICIPANT : db.persons.find((p) => p.kind === 'participant')!.id;
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

/** إثراء اللقطة (لا يمس بيانات المنصة): كل شاشة يمر بها الديمو فيها ما يُعرض */
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

let snapshot: DB | null = null;
/** لقطة واحدة تُبنى مرة في الذاكرة ولا تُحفظ في أي مخزن */
export function demoSnapshot(): DB {
  return (snapshot ??= enrichDemo(buildSeed()));
}

export const demoUserId = (db: DB) => demoTargets(db).personId;

/** الشاشات التي يعرضها إطار الديمو، ورسالة جاهزيته للنافذة الأم */
export type DemoViewKey = DemoPage;
export const DEMO_READY = 'saql-demo-ready';

const noop = () => undefined;
let readOnly = false;

/** يحوّل متجر المنصة في هذه النافذة إلى قراءة فقط فوق اللقطة الثابتة: أي تعديل من الشاشات يُهمل */
export function enterReadOnly() {
  if (readOnly) return;
  readOnly = true;
  const db = demoSnapshot();
  useStore.setState({ db, userId: demoUserId(db), commit: noop, setUser: noop, reset: noop, toast: noop });
}
