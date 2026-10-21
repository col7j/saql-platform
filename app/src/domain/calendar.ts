// بناء أحداث التقويم حسب الشخص (قسم 5)
import { getCapabilities, isTripTeam } from './permissions';
import { isPlanUnlocked, tripDeadlines } from './workflow';
import type { DB, ID } from './types';

export interface CalEvent {
  id: string;
  date: string;
  endDate?: string;
  start?: string;
  end?: string;
  title: string;
  kind: 'trip' | 'staff_trip' | 'focus' | 'umrah' | 'individual' | 'step' | 'deadline';
  scope: 'general' | 'group' | 'personal';
  link: string;
}

export const calKindLabel: Record<CalEvent['kind'], string> = {
  trip: 'رحلة',
  staff_trip: 'لقاء تطويري / رحلة فريق العمل',
  focus: 'لقاء تركيز',
  umrah: 'لقاء العمرة',
  individual: 'لقاء فردي',
  step: 'خطوة في الخطة',
  deadline: 'موعد نهائي',
};
export const calKindColor: Record<CalEvent['kind'], string> = {
  trip: '#00708c',
  staff_trip: '#00b9d1',
  focus: '#f79845',
  umrah: '#2fa37b',
  individual: '#6b6fc9',
  step: '#fbb42b',
  deadline: '#dc2626',
};

export function eventsFor(db: DB, personId: ID): CalEvent[] {
  const c = getCapabilities(db, personId);
  const out: CalEvent[] = [];
  // عام: كل الرحلات واللقاءات التطويرية منذ إدراجها
  db.trips.forEach((t) =>
    out.push({ id: `trip_${t.id}`, date: t.startDate, endDate: t.endDate, title: t.title, kind: t.executor.kind === 'staff' ? 'staff_trip' : 'trip', scope: 'general', link: `/app/trips/${t.id}` }),
  );
  // خاص بالمجموعة: لقاءات التركيز
  db.focusMeetings.forEach((f) => {
    if (!f.date) return;
    const mine = c.group?.id === f.groupId && f.status !== 'draft';
    const fac = c.facilitatorOf.some((g) => g.id === f.groupId);
    const presenter = f.presenterIds.includes(personId);
    if (mine || fac || presenter || c.isLeader)
      out.push({ id: `f_${f.id}`, date: f.date, start: f.start, end: f.end, title: f.title, kind: f.isUmrah ? 'umrah' : 'focus', scope: 'group', link: `/app/focus/${f.id}` });
  });
  // خاص بالفرد: اللقاءات الفردية
  db.individualMeetings.forEach((m) => {
    if (m.status === 'cancelled' || m.status === 'requested') return;
    if (m.participantId === personId || m.facilitatorId === personId) {
      const other = db.persons.find((p) => p.id === (m.participantId === personId ? m.facilitatorId : m.participantId))?.name;
      out.push({ id: `im_${m.id}`, date: m.date, start: m.start, end: m.end, title: `لقاء فردي مع ${other}`, kind: 'individual', scope: 'personal', link: '/app/individual' });
    }
  });
  // مواعيد خطوات الخطة الشخصية
  if (c.isParticipant && isPlanUnlocked(db, personId)) {
    db.personalPlans.find((p) => p.participantId === personId)?.aspects.forEach((a) =>
      a.steps.forEach((s) => out.push({ id: `st_${s.id}`, date: s.startDate, title: `بدء خطوة: ${s.title}`, kind: 'step', scope: 'personal', link: '/app/plan' })),
    );
  }
  // المواعيد النهائية للفريق المنفذ والإدارة
  db.trips.forEach((t) => {
    if (!(isTripTeam(db, personId, t) || c.isStaff)) return;
    tripDeadlines(db, t).filter((d) => !d.done && d.kind !== 'budget').forEach((d) =>
      out.push({ id: `dl_${t.id}_${d.kind}`, date: d.date, title: `${d.label}: ${t.title}`, kind: 'deadline', scope: c.isStaff && !isTripTeam(db, personId, t) ? 'general' : 'group', link: `/app/trips/${t.id}` }),
    );
  });
  return out.sort((a, b) => (a.date + (a.start ?? '')).localeCompare(b.date + (b.start ?? '')));
}
