// محرك النقاط (وثيقة القرارات: التقييم). دالة نقية: تأخذ قاعدة البيانات وتعيد الدرجات وسجل النقاط.
// - نصف فردي ونصف جماعي، والنقاط كسب فقط بلا خصم، وكل البنود والأوزان والشروط من الإعدادات (مقفلة بعد الحفظ).
// - الجماعي: الرحلات فقط، كل رحلة وحدة تذهب نقاطها للمجموعة المنفِّذة. الحضور يؤثر على الفردي فقط.
// - الضيوف (المقدّمون من الخارج) لا يدخلون في التقييم ولا الترتيب.
import { todayISO } from './dates';
import { requestFor } from './finance';
import { isTripTeam } from './permissions';
import { docFor, docOnTime, focusDone, isApproved, planProgress, scheduleAdherence, tripEndDT, tripHasStarted } from './workflow';
import type { DB, EvaluationItem, ID, PointsEntry, Trip, TripType } from './types';

export interface ItemScore {
  key: string;
  name: string;
  maxPoints: number;
  ratio: number; // 0..1 (التقديم قد يتجاوز 1 بنقاط التميّز)
  points: number;
  mode: EvaluationItem['mode'];
  detail: string;
}
export interface PersonScore {
  personId: ID;
  groupId?: ID;
  individual: ItemScore[];
  individualTotal: number;
  groupShare: number;
  manualBonus: number;
  total: number;
  rank: number;
}
export interface GroupTripScore {
  tripId: ID;
  title: string;
  items: ItemScore[];
  ratio: number;
}
export interface GroupScore {
  groupId: ID;
  internal: { trips: GroupTripScore[]; points: number; max: number };
  external: { trips: GroupTripScore[]; points: number; max: number };
  total: number;
  rank: number;
}
export interface StaffScore {
  personId: ID;
  enrichment: number;
  approvedMaterials: number;
}
export interface ScoresResult {
  persons: PersonScore[];
  groups: GroupScore[];
  staff: StaffScore[];
  log: PointsEntry[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function normalized(items: EvaluationItem[]) {
  const enabled = items.filter((i) => i.enabled && i.weight > 0);
  const sum = enabled.reduce((s, i) => s + i.weight, 0) || 1;
  return enabled.map((i) => ({ item: i, share: i.weight / sum }));
}

/** متوسط موزون للبنود الفرعية. القيم الفارغة (null) لا تُحسب حين skipNull */
function weighted(parts: { weight: number; value: number | null }[], skipNull = true): number {
  let sum = 0;
  let wsum = 0;
  for (const p of parts) {
    if (p.value == null && skipNull) continue;
    sum += p.weight * clamp01(p.value ?? 0);
    wsum += p.weight;
  }
  return wsum ? sum / wsum : 0;
}
function subWeighted(item: EvaluationItem, values: Record<string, number | null>, skipNull = true) {
  return weighted((item.subItems ?? []).map((s) => ({ weight: s.weight, value: values[s.key] ?? null })), skipNull);
}

/** في الوقت = 1، متأخر = معامل التأخر، لم يُرفع = 0 */
function onTimeValue(v: boolean | null, lateFactor: number) {
  if (v === null) return 0;
  return v ? 1 : lateFactor;
}

// ───────────── الفردي ─────────────
/** الحضور بأوزان كل نوع (القائد العام) وقيمة كل حالة لحضور الرحلة */
function attendanceRatio(db: DB, personId: ID): { ratio: number; detail: string } {
  const s = db.settings;
  const groupId = db.groups.find((g) => g.memberIds.includes(personId))?.id;
  const rec = (kind: 'trip' | 'focus', id: ID) => db.attendance.find((a) => a.eventKind === kind && a.eventId === id && a.personId === personId);
  const heldFocus = db.focusMeetings.filter((f) => f.groupId === groupId && focusDone(f));
  const focusAtt = heldFocus.filter((f) => rec('focus', f.id)?.present).length;
  const heldTrips = db.trips.filter((t) => t.published && tripHasStarted(t));
  const stateValue = (t: Trip) => {
    const a = rec('trip', t.id);
    if (!a || !a.present) return 0;
    if (a.status === 'early') return s.tripAttendanceStates.early;
    if (a.status === 'late') return s.tripAttendanceStates.late;
    return s.tripAttendanceStates.on_time;
  };
  const tripValue = heldTrips.reduce((sum, t) => sum + stateValue(t), 0);
  // لقاءات الرحلة: بنود التصنيفات التي يلزمها تحضير
  const prepCats = new Set(s.scheduleCategories.filter((c) => c.requiresPrep).map((c) => c.id));
  const sessions = heldTrips.flatMap((t) => (t.schedule.plans[0]?.items ?? []).filter((i) => i.sessionId && prepCats.has(i.categoryId)).map((i) => ({ tripId: t.id, sessionId: i.sessionId! })))
    .filter((x) => db.attendance.some((a) => a.eventKind === 'trip_session' && a.eventId === x.tripId && a.sessionId === x.sessionId));
  const sessAtt = sessions.filter((x) => db.attendance.some((a) => a.eventKind === 'trip_session' && a.eventId === x.tripId && a.sessionId === x.sessionId && a.personId === personId && a.present)).length;
  const w = s.attendanceWeights;
  const ratio = weighted([
    { weight: w.focus, value: heldFocus.length ? focusAtt / heldFocus.length : null },
    { weight: w.trip, value: heldTrips.length ? tripValue / heldTrips.length : null },
    { weight: w.tripSession, value: sessions.length ? sessAtt / sessions.length : null },
  ]);
  return { ratio, detail: `التركيز ${focusAtt}/${heldFocus.length} · الرحلات ${r2(tripValue)}/${heldTrips.length} · لقاءات الرحلة ${sessAtt}/${sessions.length}` };
}

/** الالتزام (س9): الحضور في الوقت + تسليم المهام في موعدها، بأوزان فرعية يضبطها القائد العام */
function commitmentRatio(db: DB, personId: ID, item: EvaluationItem): { ratio: number; detail: string } {
  const attended = db.attendance.filter((a) => a.eventKind === 'trip' && a.personId === personId && a.present);
  const onTime = attended.filter((a) => a.status === 'early' || a.status === 'on_time').length;
  const today = todayISO();
  const due = db.tasks.filter((t) => t.assigneeId === personId && t.dueDate < today);
  const tasksOnTime = due.filter((t) => t.status === 'done' && (t.doneAt ?? '').slice(0, 10) <= t.dueDate).length;
  const ratio = subWeighted(item, { on_time_attendance: attended.length ? onTime / attended.length : null, tasks_on_time: due.length ? tasksOnTime / due.length : null });
  return { ratio, detail: `في الوقت ${onTime}/${attended.length} رحلة · مهام في موعدها ${tasksOnTime}/${due.length}` };
}

function personalPlanRatio(db: DB, personId: ID, item: EvaluationItem) {
  const target = db.settings.targets.individualMeetingsPerParticipant || 1;
  const done = db.individualMeetings.filter((m) => m.participantId === personId && m.status === 'done').length;
  const prog = planProgress(db.personalPlans.find((p) => p.participantId === personId));
  const ratio = subWeighted(item, { meetings: Math.min(1, done / target), steps: prog.ratio }, false);
  return { ratio, detail: `لقاءات فردية ${done}/${target} · خطوات منجزة ${prog.done}/${prog.total}` };
}

export function presentingRevealed(db: DB) {
  return !db.settings.presentingRevealAfterEnd || todayISO() > db.settings.program.endDate;
}

/** التقديم (س10): متوسط تقييمات مرات التقديم لا مجموعها، ونقاط تميّز عن كل مرة بعد الأولى. يظهر بعد نهاية البرنامج */
function presentingRatio(db: DB, personId: ID): { ratio: number; detail: string; hidden?: boolean } {
  const crit = db.settings.presentationCriteria;
  const evals = db.focusMeetings
    .filter((f) => f.presenterIds.includes(personId) && f.presenterEvaluations[personId])
    .map((f) => {
      const e = f.presenterEvaluations[personId];
      return crit.reduce((s, c) => s + (e[c.key] ?? 0), 0) / (crit.length * 5);
    });
  if (!evals.length) return { ratio: 0, detail: 'لم يقدّم بعد (لا خصم)' };
  if (!presentingRevealed(db)) return { ratio: 0, detail: `قدّم ${evals.length} مرة · تظهر النتيجة بعد نهاية البرنامج`, hidden: true };
  const avg = evals.reduce((s, v) => s + v, 0) / evals.length;
  const bonus = (evals.length - 1) * db.settings.presentingExtraBonus;
  return { ratio: avg + bonus, detail: `قدّم ${evals.length} مرة · المتوسط ${Math.round(avg * 100)}%${bonus ? ` + تميّز ${Math.round(bonus * 100)}%` : ''}` };
}

/** تقييم القائد العام: مرة واحدة ببنود مجموع أقصاها 100 */
function leaderEvalRatio(db: DB, personId: ID) {
  const ev = db.leaderEvaluations.find((e) => e.participantId === personId);
  const items = db.settings.leaderEvalItems;
  const max = items.reduce((s, i) => s + i.max, 0) || 1;
  if (!ev) return { ratio: 0, detail: 'لم يقيّمه القائد العام بعد' };
  const got = items.reduce((s, i) => s + Math.min(i.max, ev.scores[i.key] ?? 0), 0);
  return { ratio: got / max, detail: `${r2(got)} من ${max}` };
}

// ───────────── الجماعي (الرحلات فقط) ─────────────
function financeClosedOnTime(db: DB, trip: Trip): number | null {
  const custodies = db.custodies.filter((c) => c.ownerKind === 'trip' && c.ownerId === trip.id);
  if (!custodies.length) return null;
  const deadline = new Date(tripEndDT(trip).getTime() + db.settings.deadlineDefaults.financeCloseDaysAfter * 86400000).toISOString();
  if (custodies.some((c) => c.status !== 'closed')) return new Date().toISOString() > deadline ? 0 : null;
  return custodies.every((c) => (c.closedAt ?? '') <= deadline) ? 1 : db.settings.lateFactor;
}

function groupTripItem(db: DB, trip: Trip, item: EvaluationItem): { ratio: number; detail: string } {
  const lf = db.settings.lateFactor;
  switch (item.key) {
    case 'trip_auto': {
      const budget = requestFor(db, 'trip', trip.id);
      const adh = scheduleAdherence(db, trip);
      const report = docFor(db, trip.id, 'final_report');
      const reportDeadline = new Date(tripEndDT(trip).getTime() + db.settings.deadlineDefaults.finalReportDaysAfter * 86400000).toISOString().slice(0, 10);
      const vals: Record<string, number | null> = {
        document_on_time: onTimeValue(docOnTime(docFor(db, trip.id, 'document'), trip.deadlines.document), lf),
        schedule_on_time: onTimeValue(docOnTime(docFor(db, trip.id, 'schedule'), trip.deadlines.schedule), lf),
        budget_on_time: onTimeValue(budget?.submittedAt ? budget.submittedAt.slice(0, 10) <= trip.deadlines.budget : null, lf),
        finance_closed: financeClosedOnTime(db, trip),
        report_on_time: report?.submittedAt ? onTimeValue(docOnTime(report, reportDeadline), lf) : null,
        schedule_adherence: adh,
      };
      const done = Object.values(vals).filter((v) => v != null).length;
      return { ratio: subWeighted(item, vals, false), detail: `${done} من ${(item.subItems ?? []).length} بنود محسوبة${adh != null ? ` · الالتزام بالجدول ${Math.round(adh * 100)}%` : ''}` };
    }
    case 'finance_manual': {
      const fin = db.settings.finance.evalItems;
      const vals = fin.map((i) => trip.evaluation.finance[i.key]).filter((v): v is number => typeof v === 'number');
      if (!fin.length || !vals.length) return { ratio: 0, detail: 'لم يقيّم مسؤول المالية بعد' };
      return { ratio: vals.reduce((s, v) => s + v, 0) / (fin.length * 5), detail: `قيّم ${vals.length} من ${fin.length} بنود المالية` };
    }
    case 'staff_rating': {
      const vals = Object.values(trip.evaluation.staffRatings).map((r) => r.score);
      if (!vals.length) return { ratio: 0, detail: 'لم يقيّمها فريق العمل بعد' };
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      return { ratio: avg / 10, detail: `متوسط ${r2(avg)} من 10 (${vals.length} من فريق العمل)` };
    }
    default:
      return { ratio: 0, detail: '' };
  }
}

export function computeScores(db: DB): ScoresResult {
  const s = db.settings;
  const log: PointsEntry[] = [];
  const at = db.seededAt;

  // ── المجموعات ──
  const groupItems = normalized(s.evaluationItems.filter((i) => i.scope === 'group'));
  const totalSplit = s.groupTripSplit.internal + s.groupTripSplit.external || 1;
  const groups: GroupScore[] = db.groups.map((g) => {
    const part = (type: TripType) => {
      const max = s.split.group * (type === 'internal' ? s.groupTripSplit.internal : s.groupTripSplit.external) / totalSplit;
      const trips = db.trips.filter((t) => t.type === type && t.executor.kind === 'group' && t.executor.groupId === g.id);
      const tripScores: GroupTripScore[] = trips.map((t) => {
        const items = groupItems.map(({ item, share }) => {
          const { ratio, detail } = groupTripItem(db, t, item);
          const maxPoints = (max * share) / (trips.length || 1);
          return { key: item.key, name: item.name, maxPoints: r2(maxPoints), ratio: r2(ratio), points: r2(maxPoints * clamp01(ratio)), mode: item.mode, detail };
        });
        items.forEach((i) => {
          if (i.points > 0) log.push({ id: `pg_${g.id}_${t.id}_${i.key}`, groupId: g.id, itemKey: i.key, points: i.points, source: `${i.name} — ${t.title}`, auto: i.mode === 'auto', at, scope: 'group', tripType: type });
        });
        return { tripId: t.id, title: t.title, items, ratio: items.reduce((sum, i) => sum + i.points, 0) / (max / (trips.length || 1) || 1) };
      });
      const points = r2(tripScores.reduce((sum, ts) => sum + ts.items.reduce((a, i) => a + i.points, 0), 0));
      return { trips: tripScores, points, max: r2(max) };
    };
    const internal = part('internal');
    const external = part('external');
    return { groupId: g.id, internal, external, total: r2(internal.points + external.points), rank: 0 };
  });
  [...groups].sort((a, b) => b.total - a.total).forEach((g, i) => (g.rank = i + 1));

  // ── الأفراد ──
  const indivItems = normalized(s.evaluationItems.filter((i) => i.scope === 'individual' && i.key !== 'enrichment'));
  const persons: PersonScore[] = db.persons.filter((p) => p.kind === 'participant').map((p) => {
    const group = db.groups.find((g) => g.memberIds.includes(p.id));
    const individual: ItemScore[] = indivItems.map(({ item, share }) => {
      const maxPoints = s.split.individual * share;
      let res: { ratio: number; detail: string } = { ratio: 0, detail: '' };
      if (item.key === 'attendance') res = attendanceRatio(db, p.id);
      else if (item.key === 'commitment') res = commitmentRatio(db, p.id, item);
      else if (item.key === 'personal_plan') res = personalPlanRatio(db, p.id, item);
      else if (item.key === 'presenting') res = presentingRatio(db, p.id);
      else if (item.key === 'leader_eval') res = leaderEvalRatio(db, p.id);
      const ratio = Math.max(0, res.ratio); // كسب فقط
      const points = r2(maxPoints * ratio);
      if (points > 0) log.push({ id: `pi_${p.id}_${item.key}`, personId: p.id, itemKey: item.key, points, source: item.name, auto: item.mode === 'auto', at, scope: 'individual' });
      return { key: item.key, name: item.name, maxPoints: r2(maxPoints), ratio: r2(ratio), points, mode: item.mode, detail: res.detail };
    });
    const individualTotal = r2(individual.reduce((a, i) => a + i.points, 0));
    const groupShare = group ? groups.find((x) => x.groupId === group.id)!.total : 0; // يُوزَّع بالتساوي
    const manualBonus = r2(db.manualPoints.filter((m) => m.personId === p.id).reduce((a, m) => a + Math.max(0, m.points), 0));
    return { personId: p.id, groupId: group?.id, individual, individualTotal, groupShare, manualBonus, total: r2(individualTotal + groupShare + manualBonus), rank: 0 };
  });
  [...persons].sort((a, b) => b.total - a.total).forEach((p, i) => (p.rank = i + 1));
  db.manualPoints.forEach((m) => log.push(m));

  // ── نقاط المواد الإثرائية لأعضاء الإدارة (خارج ترتيب المشاركين) ──
  const enrichmentEnabled = s.evaluationItems.find((i) => i.key === 'enrichment')?.enabled ?? false;
  const staff: StaffScore[] = db.persons.filter((p) => p.kind === 'staff').map((p) => {
    const approved = db.materials.filter((m) => m.uploaderId === p.id && m.audience.kind === 'all' && m.pointsRequested && m.pointsStatus === 'approved');
    const enrichment = enrichmentEnabled ? approved.length * s.enrichmentPointsPerMaterial : 0;
    if (enrichment > 0) log.push({ id: `ps_${p.id}`, personId: p.id, itemKey: 'enrichment', points: enrichment, source: `مواد إثرائية معتمدة (${approved.length})`, auto: true, at, scope: 'individual' });
    return { personId: p.id, enrichment, approvedMaterials: approved.length };
  });

  return { persons, groups, staff, log };
}

export { isTripTeam, isApproved };
