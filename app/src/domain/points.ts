// محرك النقاط (قسم 13). دالة نقية: تأخذ قاعدة البيانات وتعيد الدرجات وسجل النقاط.
// القواعد: النقاط كسب فقط (لا خصم)، والأوزان والبنود كلها من الإعدادات.
import { tripHasStarted, docFor, docOnTime, isApproved, scheduleAdherence, focusDone, planProgress } from './workflow';
import { isTripTeam } from './permissions';
import { requestFor } from './finance';

function budgetOnTime(db: DB, trip: Trip): boolean | null {
  const r = requestFor(db, 'trip', trip.id);
  return r?.submittedAt ? r.submittedAt.slice(0, 10) <= trip.deadlines.detailed : null;
}
import type { DB, EvaluationItem, ID, PointsEntry, Trip, TripType } from './types';

export interface ItemScore {
  key: string;
  name: string;
  maxPoints: number;
  ratio: number; // 0..(قد يتجاوز 1 في بند التقديم كتميّز)
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

function subWeighted(item: EvaluationItem, values: Record<string, number | null>, skipNull = false): number {
  const subs = item.subItems ?? [];
  let sum = 0;
  let wsum = 0;
  for (const s of subs) {
    const v = values[s.key];
    if (v == null && skipNull) continue;
    sum += s.weight * clamp01(v ?? 0);
    wsum += s.weight;
  }
  return wsum ? sum / wsum : 0;
}

/** قيمة الالتزام بموعد: في الوقت = 1، متأخر = معامل التأخر، لم يُرفع = 0 */
function onTimeValue(v: boolean | null, lateFactor: number) {
  if (v === null) return 0;
  return v ? 1 : lateFactor;
}

// ───────────── الفردي ─────────────
function attendanceRatio(db: DB, personId: ID, item: EvaluationItem): { ratio: number; detail: string } {
  const groupId = db.groups.find((g) => g.memberIds.includes(personId))?.id;
  const present = (kind: 'trip' | 'focus', id: ID) =>
    db.attendance.some((a) => a.eventKind === kind && a.eventId === id && a.personId === personId && a.present);

  const heldFocus = db.focusMeetings.filter((f) => f.groupId === groupId && focusDone(f));
  const heldTrips = (type: TripType) => db.trips.filter((t) => t.type === type && t.published && tripHasStarted(t));
  const parts: Record<string, { held: number; att: number }> = {
    focus: { held: heldFocus.length, att: heldFocus.filter((f) => present('focus', f.id)).length },
    internal: { held: heldTrips('internal').length, att: heldTrips('internal').filter((t) => present('trip', t.id)).length },
    external: { held: heldTrips('external').length, att: heldTrips('external').filter((t) => present('trip', t.id)).length },
  };
  const values: Record<string, number | null> = {};
  for (const k of Object.keys(parts)) values[k] = parts[k].held ? parts[k].att / parts[k].held : null;
  const ratio = subWeighted(item, values, true);
  const detail = `التركيز ${parts.focus.att}/${parts.focus.held} · الداخلية ${parts.internal.att}/${parts.internal.held} · الخارجية ${parts.external.att}/${parts.external.held}`;
  return { ratio, detail };
}

function punctualityRatio(db: DB, personId: ID) {
  const vals = db.trips.map((t) => t.punctuality[personId]).filter((v): v is number => typeof v === 'number');
  if (!vals.length) return { ratio: 0, detail: 'لم يُرصد بعد' };
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return { ratio: avg / 5, detail: `متوسط ${r2(avg)} من 5 في ${vals.length} رحلة` };
}

function personalPlanRatio(db: DB, personId: ID, item: EvaluationItem) {
  const target = db.settings.targets.individualMeetingsPerParticipant || 1;
  const done = db.individualMeetings.filter((m) => m.participantId === personId && m.status === 'done').length;
  const plan = db.personalPlans.find((p) => p.participantId === personId);
  const prog = planProgress(plan);
  const ratio = subWeighted(item, { meetings: Math.min(1, done / target), steps: prog.ratio });
  return { ratio, detail: `لقاءات فردية ${done}/${target} · خطوات منجزة ${prog.done}/${prog.total}` };
}

function presentingRatio(db: DB, personId: ID) {
  const crit = db.settings.presentationCriteria;
  const evals = db.focusMeetings
    .filter((f) => f.presenterIds.includes(personId) && f.presenterEvaluations[personId])
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map((f) => {
      const e = f.presenterEvaluations[personId];
      const vals = crit.map((c) => e[c.key] ?? 0);
      return vals.reduce((s, v) => s + v, 0) / (crit.length * 5);
    });
  if (!evals.length) return { ratio: 0, detail: 'لم يقدّم بعد (لا خصم)' };
  // المرة الأولى كاملة، وكل مرة إضافية بمعامل التميّز (قسم 7.2 و20.2)
  const total = evals[0] + evals.slice(1).reduce((s, v) => s + v * db.settings.repeatPresentationFactor, 0);
  const ratio = Math.min(db.settings.presentingMaxMultiplier, total);
  return { ratio, detail: `قدّم ${evals.length} مرة` };
}

// ───────────── الجماعي ─────────────
function groupTripItem(db: DB, trip: Trip, item: EvaluationItem): { ratio: number; detail: string } {
  const lf = db.settings.lateFactor;
  const ev = trip.evaluation;
  const manual = (k: string) => (ev.manual[k] != null ? ev.manual[k] / 5 : null);
  switch (item.key) {
    case 'exec_plan': {
      const adh = scheduleAdherence(db, trip);
      const vals = {
        schedule: adh,
        schedule_on_time: onTimeValue(docOnTime(docFor(db, trip.id, 'detailed'), trip.deadlines.detailed), lf),
        budget_on_time: onTimeValue(budgetOnTime(db, trip), lf),
        location_early: onTimeValue(docOnTime(docFor(db, trip.id, 'initial'), trip.deadlines.initial), lf),
      };
      return { ratio: subWeighted(item, vals), detail: adh == null ? 'الالتزام بالجدول لم يُوثّق بعد' : `الالتزام بالجدول ${Math.round(adh * 100)}%` };
    }
    case 'coordination': {
      const vals: Record<string, number | null> = {};
      (item.subItems ?? []).forEach((s) => (vals[s.key] = manual(`coordination.${s.key}`)));
      const rated = Object.values(vals).filter((v) => v != null).length;
      return { ratio: subWeighted(item, vals, true), detail: rated ? `قُيّم ${rated} بنود` : 'لم يُقيّم بعد' };
    }
    case 'program_mgmt': {
      const g = trip.executor.kind === 'group' ? db.groups.find((x) => x.id === (trip.executor as { groupId: ID }).groupId) : undefined;
      const presented = g
        ? g.memberIds.filter((m) => db.focusMeetings.some((f) => f.presenterIds.includes(m) && f.presenterEvaluations[m])).length / (g.memberIds.length || 1)
        : null;
      const vals: Record<string, number | null> = {};
      (item.subItems ?? []).forEach((s) => (vals[s.key] = s.key === 'all_presented' ? presented : manual(`program_mgmt.${s.key}`)));
      return { ratio: subWeighted(item, vals, true), detail: presented != null ? `قدّم ${Math.round(presented * 100)}% من الأعضاء` : '' };
    }
    case 'completeness': {
      const sessionsWithFiles = trip.sessions.length
        ? trip.sessions.filter((s) => db.materials.some((m) => m.tripId === trip.id && m.sessionId === s.id)).length / trip.sessions.length
        : 0;
      const custody = db.custodies.find((c) => c.ownerKind === 'trip' && c.ownerId === trip.id);
      const media = db.tasks.filter((t) => t.tripId === trip.id && db.committees.find((c) => c.id === t.committeeId)?.kind === 'media');
      const vals = {
        session_files: sessionsWithFiles,
        invoices_closed: custody?.status === 'closed' ? 1 : 0,
        media: media.length ? media.filter((t) => t.status === 'done').length / media.length : 0,
        final_report: isApproved(db, trip.id, 'final_report') ? 1 : 0,
      };
      return { ratio: subWeighted(item, vals), detail: `ملفات اللقاءات ${Math.round(sessionsWithFiles * 100)}%` };
    }
    case 'trip_eval': {
      const s = [ev.trackerScore, ev.leaderScore].filter((v): v is number => typeof v === 'number');
      if (!s.length) return { ratio: 0, detail: 'لم تُقيّم بعد' };
      const avg = s.reduce((a, b) => a + b, 0) / s.length;
      return { ratio: avg / 10, detail: `المتابع ${ev.trackerScore ?? '—'} · القائد العام ${ev.leaderScore ?? '—'} (من 10)` };
    }
    case 'deadlines': {
      const a = onTimeValue(docOnTime(docFor(db, trip.id, 'initial'), trip.deadlines.initial), lf);
      const b = onTimeValue(docOnTime(docFor(db, trip.id, 'detailed'), trip.deadlines.detailed), lf);
      return { ratio: (a + b) / 2, detail: `المبسطة ${a === 1 ? 'في وقتها' : a ? 'متأخرة' : 'لم تُرفع'} · التفصيلية ${b === 1 ? 'في وقتها' : b ? 'متأخرة' : 'لم تُرفع'}` };
    }
    default: {
      const v = manual(item.key);
      return { ratio: v ?? 0, detail: v == null ? 'لم يُقيّم بعد' : '' };
    }
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
          if (i.points > 0)
            log.push({ id: `pg_${g.id}_${t.id}_${i.key}`, groupId: g.id, itemKey: i.key, points: i.points, source: `${i.name} — ${t.title}`, auto: i.mode === 'auto', at, scope: 'group', tripType: type });
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
  const participants = db.persons.filter((p) => p.kind === 'participant');
  const persons: PersonScore[] = participants.map((p) => {
    const group = db.groups.find((g) => g.memberIds.includes(p.id));
    const individual: ItemScore[] = indivItems.map(({ item, share }) => {
      const maxPoints = s.split.individual * share;
      let res = { ratio: 0, detail: '' };
      if (item.key === 'attendance') res = attendanceRatio(db, p.id, item);
      else if (item.key === 'punctuality') res = punctualityRatio(db, p.id);
      else if (item.key === 'personal_plan') res = personalPlanRatio(db, p.id, item);
      else if (item.key === 'presenting') res = presentingRatio(db, p.id);
      const ratio = Math.max(0, res.ratio); // كسب فقط
      const points = r2(maxPoints * ratio);
      if (points > 0)
        log.push({ id: `pi_${p.id}_${item.key}`, personId: p.id, itemKey: item.key, points, source: item.name, auto: item.mode === 'auto', at, scope: 'individual' });
      return { key: item.key, name: item.name, maxPoints: r2(maxPoints), ratio: r2(ratio), points, mode: item.mode, detail: res.detail };
    });
    const individualTotal = r2(individual.reduce((a, i) => a + i.points, 0));
    const groupShare = group ? groups.find((x) => x.groupId === group.id)!.total : 0; // يُوزَّع بالتساوي
    const manualBonus = r2(db.manualPoints.filter((m) => m.personId === p.id).reduce((a, m) => a + Math.max(0, m.points), 0));
    return { personId: p.id, groupId: group?.id, individual, individualTotal, groupShare, manualBonus, total: r2(individualTotal + groupShare + manualBonus), rank: 0 };
  });
  [...persons].sort((a, b) => b.total - a.total).forEach((p, i) => (p.rank = i + 1));
  db.manualPoints.forEach((m) => log.push(m));

  // ── نقاط المواد الإثرائية لأعضاء الإدارة (قسم 10.4) ──
  const enrichmentEnabled = s.evaluationItems.find((i) => i.key === 'enrichment')?.enabled ?? false;
  const staff: StaffScore[] = db.persons
    .filter((p) => p.kind === 'staff')
    .map((p) => {
      const approved = db.materials.filter((m) => m.uploaderId === p.id && m.audience.kind === 'all' && m.pointsRequested && m.pointsStatus === 'approved');
      const enrichment = enrichmentEnabled ? approved.length * s.enrichmentPointsPerMaterial : 0;
      if (enrichment > 0)
        log.push({ id: `ps_${p.id}`, personId: p.id, itemKey: 'enrichment', points: enrichment, source: `مواد إثرائية معتمدة (${approved.length})`, auto: true, at, scope: 'individual' });
      return { personId: p.id, enrichment, approvedMaterials: approved.length };
    });

  return { persons, groups, staff, log };
}

/** هل الشخص ضمن فريق رحلة؟ (يُستخدم لاستبعاد الفريق المنفذ من بعض البنود مستقبلاً) */
export { isTripTeam };
