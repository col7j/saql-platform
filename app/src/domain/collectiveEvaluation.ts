// التقييم الجماعي (الرئيسي 2): لكل رحلة، ومعزول عن بقية محرك النقاط.
// - تُقيَّم كل رحلة بالبنود الجماعية الحالية، ودرجة بند التقييم = متوسط تقييم المقيّمين المحددين (المتابع والقائد العام افتراضياً).
// - كل أعضاء فريق الرحلة (أعضاء المجموعة المنفذة والموزَّعون عليها من مجموعات أخرى) يأخذون نقاط الرحلة نفسها.
// - التقييم الجماعي للمشارك = مساهمة رحلته الداخلية + مساهمة رحلته الخارجية بأوزان الإعدادات. رحلات فريق العمل لا تدخل.
// - ترتيب المجموعة = متوسط مجموع نقاط أعضائها (الفردي + الجماعي).
import type { DB, EvaluationItem, ID, Trip, TripType } from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** مقيّمو الرحلة: الإعداد إن حُدد، وإلا القائد العام ومساعده (المتابع) */
export function tripEvaluatorIds(db: DB): ID[] {
  const set = db.settings.tripEvaluatorIds;
  if (set?.length) return set;
  return db.persons.filter((p) => p.isGeneralLeader || p.isAssistant).map((p) => p.id);
}

/** درجة الرحلة من 10 = متوسط تقييمات المقيّمين الذين قيّموها. null إن لم يقيّم أحد */
export function tripEvaluatorAverage(db: DB, trip: Trip): { avg: number | null; scores: { personId: ID; score: number }[] } {
  const ev = new Set(tripEvaluatorIds(db));
  const scores = Object.entries(trip.evaluation.staffRatings).filter(([id]) => ev.has(id)).map(([personId, r]) => ({ personId, score: r.score }));
  return { avg: scores.length ? scores.reduce((s, x) => s + x.score, 0) / scores.length : null, scores };
}

/** هل الرحلة من رحلات المشاركين (لا رحلات فريق العمل) */
export const isParticipantTrip = (t: Trip) => t.executor.kind === 'group';

/** أعضاء فريق رحلة مجموعة: أعضاء المجموعة المنفذة + الموزَّعون عليها */
export function collectiveTeamIds(db: DB, trip: Trip): ID[] {
  if (trip.executor.kind !== 'group') return [];
  const groupId = trip.executor.groupId;
  const own = db.groups.find((g) => g.id === groupId)?.memberIds ?? [];
  return [...new Set([...own, ...(trip.extraMemberIds ?? [])])];
}

/** نسبة الرحلة 0..1 = مجموع (نصيب البند × نسبته). itemRatio يُمرَّر من محرك النقاط حتى لا تتشابك الوحدات */
export function tripRatio(items: { item: EvaluationItem; share: number }[], trip: Trip, itemRatio: (trip: Trip, item: EvaluationItem) => number): number {
  return clamp01(items.reduce((s, { item, share }) => s + share * clamp01(itemRatio(trip, item)), 0));
}

export interface PersonTripShare {
  tripId: ID;
  type: TripType;
  ratio: number;
  /** نقاط الرحلة لهذا الشخص: سقف النوع × نسبة الرحلة ÷ عدد رحلاته من النوع */
  points: number;
  viaDistribution: boolean;
}
export interface PersonCollective {
  internal: number;
  external: number;
  total: number;
  trips: PersonTripShare[];
}

/** التقييم الجماعي لكل مشارك. maxFor(type) سقف نوع الرحلة من نصيب الجماعي */
export function collectiveByPerson(
  db: DB,
  ratioOf: (trip: Trip) => number,
  maxFor: (type: TripType) => number,
): Map<ID, PersonCollective> {
  const out = new Map<ID, PersonCollective>();
  const trips = db.trips.filter(isParticipantTrip);
  for (const p of db.persons.filter((x) => x.kind === 'participant')) {
    const mine = trips.filter((t) => collectiveTeamIds(db, t).includes(p.id));
    const shares: PersonTripShare[] = [];
    for (const type of ['internal', 'external'] as TripType[]) {
      const ts = mine.filter((t) => t.type === type);
      ts.forEach((t) => {
        const ratio = ratioOf(t);
        shares.push({
          tripId: t.id, type, ratio: r2(ratio), points: r2((maxFor(type) * ratio) / ts.length),
          viaDistribution: !db.groups.find((g) => g.id === (t.executor.kind === 'group' ? t.executor.groupId : ''))?.memberIds.includes(p.id),
        });
      });
    }
    const sum = (type: TripType) => r2(shares.filter((s) => s.type === type).reduce((a, s) => a + s.points, 0));
    out.set(p.id, { internal: sum('internal'), external: sum('external'), total: r2(sum('internal') + sum('external')), trips: shares });
  }
  return out;
}

/** درجة المجموعة = متوسط مجموع نقاط أعضائها */
export function groupAverage(memberTotals: number[]): number {
  return memberTotals.length ? r2(memberTotals.reduce((a, b) => a + b, 0) / memberTotals.length) : 0;
}
