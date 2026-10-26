// منطق الصلاحيات (قسم 3). دوال نقية تأخذ قاعدة البيانات ومعرّف الشخص، ولا تعتمد على الواجهة.
import { now } from './dates';
import { hasTempGrant } from './grants';
import { canOpenFinance, canViewBudget, financePermsOf, isFinanceMember, isFinanceOwner } from './finance';
import type { Committee, DB, FocusMeeting, Group, ID, Material, Person, Trip, TripDoc } from './types';

export interface Capabilities {
  person: Person;
  isLeader: boolean; // القائد العام
  isStaff: boolean; // عضو إدارة (يشمل القائد العام)
  isParticipant: boolean;
  facilitatorOf: Group[]; // المجموعات التي يُيسّرها
  leaderOf?: Group; // قائد مجموعة
  group?: Group; // مجموعة المشارك
  committees: { committee: Committee; role: 'leader' | 'member'; canSeeFinance: boolean }[];
  isFinance: boolean; // عضو اللجنة المالية
  isFinanceLead: boolean;
  isMedia: boolean;
  isTechLead: boolean; // مسؤول اللجنة التقنية: المستخدمون وكلمات المرور وفتح قفل الإعدادات
  isTracker: boolean; // متابع الرحلات الثابت
  isSiteEditor: boolean; // القائد العام أو من يفوّضه بصلاحية مؤقتة
  canRegisterParticipants: boolean;
  canManageScheduleCategories: boolean;
  staffTripsLed: Trip[]; // قائد فريق رحلة لفريق العمل
  staffTripsMember: Trip[];
  presenterIn: FocusMeeting[];
  /** وصف مقروء للصفات المجتمعة */
  labels: string[];
}

export function groupOf(db: DB, personId: ID): Group | undefined {
  return db.groups.find((g) => g.memberIds.includes(personId));
}

export function groupsPublished(db: DB): boolean {
  const f = db.formation;
  if (f.status === 'published') return true;
  if (f.status === 'scheduled' && f.publishAt && new Date(f.publishAt) <= now()) return true;
  return false;
}

export function getCapabilities(db: DB, personId: ID): Capabilities {
  const person = db.persons.find((p) => p.id === personId) ?? db.persons[0];
  const isLeader = !!person.isGeneralLeader;
  const isStaff = person.kind === 'staff';
  const isParticipant = person.kind === 'participant';
  const facilitatorOf = db.groups.filter((g) => g.facilitatorId === person.id);
  const published = groupsPublished(db);
  // قبل نشر التشكيل لا يرى المشاركون أي صفة مرتبطة بالمجموعات
  const leaderOf = isParticipant && !published ? undefined : db.groups.find((g) => g.leaderId === person.id);
  const group = isParticipant && !published ? undefined : groupOf(db, person.id);
  const committees = db.memberships
    .filter((m) => m.personId === person.id)
    .map((m) => ({ committee: db.committees.find((c) => c.id === m.committeeId)!, role: m.role, canSeeFinance: m.canSeeFinance }))
    .filter((c) => c.committee);
  const isFinance = isFinanceMember(db, person.id);
  const isFinanceLead = isFinanceOwner(db, person.id);
  const isMedia = committees.some((c) => c.committee.kind === 'media');
  const isTechLead = committees.some((c) => c.committee.kind === 'tech' && c.role === 'leader');
  const isTracker = db.settings.trackerId === person.id;
  const isSiteEditor = hasTempGrant(db, person.id, 'edit_site');
  const canRegisterParticipants = hasTempGrant(db, person.id, 'register_participants');
  const canManageScheduleCategories = hasTempGrant(db, person.id, 'manage_schedule_categories');
  const staffTripsLed = db.trips.filter((t) => t.executor.kind === 'staff' && t.executor.leaderId === person.id);
  const staffTripsMember = db.trips.filter((t) => t.executor.kind === 'staff' && t.executor.memberIds.includes(person.id));
  const presenterIn = db.focusMeetings.filter((f) => f.presenterIds.includes(person.id));

  const labels: string[] = [];
  if (isLeader) labels.push('القائد العام');
  else if (isStaff) labels.push('عضو إدارة');
  else labels.push('مشارك');
  facilitatorOf.forEach((g) => labels.push(`ميسّر ${g.name}`));
  if (leaderOf) labels.push(`قائد ${leaderOf.name}`);
  committees
    .filter((c) => c.committee.kind !== 'general')
    .forEach((c) => labels.push(c.committee.kind === 'finance' && c.role === 'leader' ? 'مسؤول المالية' : `${c.role === 'leader' ? 'مسؤول' : 'عضو'} ${c.committee.name}`));
  if (isTracker) labels.push('متابع الرحلات');
  if (isSiteEditor && !isLeader) labels.push('محرّر الموقع (مؤقت)');
  if (canRegisterParticipants && !isLeader) labels.push('تسجيل المشاركين (مؤقت)');
  if (staffTripsLed.length) labels.push('قائد فريق رحلة');
  if (presenterIn.length && isParticipant) labels.push('مقدّم');

  return {
    person, isLeader, isStaff, isParticipant, facilitatorOf, leaderOf, group, committees,
    isFinance, isFinanceLead, isMedia, isTechLead, isTracker, isSiteEditor, canRegisterParticipants, canManageScheduleCategories, staffTripsLed, staffTripsMember, presenterIn, labels,
  };
}

// ───────────── الرحلات ─────────────

/** الميسّر المسؤول عن مراجعة خطط الرحلة. في رحلات فريق العمل القائد العام هو الميسّر */
export function tripFacilitatorId(db: DB, trip: Trip): ID | undefined {
  if (trip.executor.kind === 'staff') return db.persons.find((p) => p.isGeneralLeader)?.id;
  const groupId = trip.executor.groupId;
  return db.groups.find((g) => g.id === groupId)?.facilitatorId;
}

/** قائد فريق الرحلة: قائد المجموعة المنفذة، أو قائد فريق العمل الذي عيّنه القائد العام */
export function tripTeamLeaderId(db: DB, trip: Trip): ID | undefined {
  if (trip.executor.kind === 'staff') return trip.executor.leaderId;
  const groupId = trip.executor.groupId;
  return db.groups.find((g) => g.id === groupId)?.leaderId;
}

export function tripTeamIds(db: DB, trip: Trip): ID[] {
  if (trip.executor.kind === 'staff') return [trip.executor.leaderId, ...trip.executor.memberIds];
  const groupId = trip.executor.groupId;
  return db.groups.find((g) => g.id === groupId)?.memberIds ?? [];
}

export function isTripTeam(db: DB, personId: ID, trip: Trip): boolean {
  return tripTeamIds(db, trip).includes(personId);
}

/** المتابع الفعلي للرحلة: البديل المعتمد إن وُجد، وإلا المتابع الثابت */
export function effectiveTrackerId(db: DB, trip: Trip): ID | undefined {
  if (trip.trackerSubstitute?.status === 'approved') return trip.trackerSubstitute.candidateId;
  return db.settings.trackerId;
}

/** شروط تعيين المتابع: ليس ميسّر الرحلة، وليس القائد العام في رحلات فريق العمل */
export function trackerConflict(db: DB, trackerId: ID, trip: Trip): string | null {
  if (tripFacilitatorId(db, trip) === trackerId) {
    return trip.executor.kind === 'staff' ? 'القائد العام لا يكون متابعاً لرحلات فريق العمل' : 'المتابع لا يجوز أن يكون ميسّر المجموعة المنفذة';
  }
  return null;
}

export function canViewTripPlans(db: DB, personId: ID, trip: Trip): boolean {
  const c = getCapabilities(db, personId);
  if (c.isStaff) return true; // كل الإدارة ترى الخطط والجداول
  return isTripTeam(db, personId, trip); // أعضاء المجموعة المنفذة فقط، ولا تراها المجموعات الأخرى أبداً
}

export function canEditTripDoc(db: DB, personId: ID, trip: Trip, doc: TripDoc): boolean {
  if (tripTeamLeaderId(db, trip) !== personId) return false; // قائد المجموعة وحده يعدّل
  return ['draft', 'returned_by_facilitator', 'returned_by_leader'].includes(doc.status);
}

export function canFacilitatorReview(db: DB, personId: ID, trip: Trip, doc: TripDoc): boolean {
  return doc.status === 'submitted' && tripFacilitatorId(db, trip) === personId && trip.executor.kind === 'group';
}

export function canLeaderDecide(db: DB, personId: ID, trip: Trip, doc: TripDoc): boolean {
  const c = getCapabilities(db, personId);
  if (!c.isLeader) return false;
  if (trip.executor.kind === 'staff') return doc.status === 'submitted' || doc.status === 'facilitator_approved';
  return doc.status === 'facilitator_approved';
}

export function canCommentOnTripDoc(db: DB, personId: ID, trip: Trip): boolean {
  return canViewTripPlans(db, personId, trip);
}

/** أرقام موازنة الرحلة: اللجنة المالية (بصلاحية العرض) والقائد العام، وقائد الفريق يرى ميزانية رحلته فقط */
export function canSeeEstimatedBudget(db: DB, personId: ID, trip?: Trip): boolean {
  if (canViewBudget(db, personId)) return true;
  return !!trip && tripTeamLeaderId(db, trip) === personId;
}

/** دخول القسم المالي: أعضاء اللجنة المالية والقائد العام فقط */
export function canSeeFinance(db: DB, personId: ID): boolean {
  return canOpenFinance(db, personId);
}

/** أي صلاحية تنفيذية مالية مفوّضة */
export function canManageFinance(db: DB, personId: ID): boolean {
  return financePermsOf(db, personId).some((p) => p !== 'view_budget');
}

export function canTrackTrip(db: DB, personId: ID, trip: Trip): boolean {
  return effectiveTrackerId(db, trip) === personId;
}

export function canTakeTripAttendance(db: DB, personId: ID, trip: Trip): boolean {
  return trip.attendanceTakerId === personId || tripTeamLeaderId(db, trip) === personId;
}

// ───────────── لقاءات التركيز ─────────────
export function canManageFocus(db: DB, personId: ID, fm: FocusMeeting): boolean {
  const g = db.groups.find((x) => x.id === fm.groupId);
  return g?.facilitatorId === personId;
}
export function canTakeFocusAttendance(db: DB, personId: ID, fm: FocusMeeting): boolean {
  const g = db.groups.find((x) => x.id === fm.groupId);
  if (!g) return false;
  if (fm.attendanceTakerId) return fm.attendanceTakerId === personId || g.facilitatorId === personId;
  return g.leaderId === personId || g.facilitatorId === personId;
}
export function canViewFocus(db: DB, personId: ID, fm: FocusMeeting): boolean {
  const c = getCapabilities(db, personId);
  if (c.isStaff) return true;
  return c.group?.id === fm.groupId && fm.status !== 'draft' ? true : fm.presenterIds.includes(personId);
}

// ───────────── الخطة الشخصية وسجل الملاحظات ─────────────
export function canSeePersonalPlan(db: DB, viewerId: ID, participantId: ID): boolean {
  if (viewerId === participantId) return true;
  const c = getCapabilities(db, viewerId);
  if (c.isLeader) return true;
  const g = groupOf(db, participantId);
  return !!g && g.facilitatorId === viewerId; // الميسّر يرى مجموعته فقط
}

/** سجل الملاحظات: يراه الإدارة فقط ولا يراه المشارك */
export function canSeeFacilitatorNotes(db: DB, viewerId: ID): boolean {
  return getCapabilities(db, viewerId).isStaff;
}
export function canWriteFacilitatorNote(db: DB, viewerId: ID, participantId: ID): boolean {
  const c = getCapabilities(db, viewerId);
  const g = groupOf(db, participantId);
  return c.isLeader || (!!g && g.facilitatorId === viewerId);
}

// ───────────── اللجان ─────────────
export function canSeeCommittee(db: DB, personId: ID, committeeId: ID): boolean {
  const c = getCapabilities(db, personId);
  return c.isLeader || c.committees.some((m) => m.committee.id === committeeId);
}
export function canManageCommittee(db: DB, personId: ID, committeeId: ID): boolean {
  const c = getCapabilities(db, personId);
  return c.isLeader || c.committees.some((m) => m.committee.id === committeeId && m.role === 'leader');
}

// ───────────── المكتبة ─────────────
export function canUploadMaterial(db: DB, personId: ID): boolean {
  const c = getCapabilities(db, personId);
  if (c.isStaff) return true;
  // أعضاء فريق إعداد رحلة (المجموعة المنفذة لرحلة غير مغلقة)
  return db.trips.some((t) => isTripTeam(db, personId, t));
}

export function materialAudienceIncludes(db: DB, m: Material, personId: ID): boolean {
  const a = m.audience;
  if (a.kind === 'all') return true;
  if (a.kind === 'person') return a.personId === personId;
  const g = db.groups.find((x) => x.id === a.groupId);
  return !!g && (g.memberIds.includes(personId) || g.facilitatorId === personId);
}

export function isMaterialRevealed(m: Material): boolean {
  if (m.revealMode === 'manual') return m.revealed;
  if (!m.revealAt) return true;
  return new Date(m.revealAt) <= now();
}

export function canSeeMaterial(db: DB, personId: ID, m: Material): boolean {
  const c = getCapabilities(db, personId);
  if (m.uploaderId === personId) return true;
  if (c.isLeader) return true;
  if (!materialAudienceIncludes(db, m, personId) && !c.isStaff) return false;
  if (c.isStaff && m.audience.kind !== 'person') return true;
  if (m.audience.kind === 'person' && m.audience.personId !== personId) {
    // مواد اللقاء الفردي يراها الميسّر والقائد العام فقط
    const g = groupOf(db, m.audience.personId);
    return g?.facilitatorId === personId;
  }
  return isMaterialRevealed(m);
}

// ───────────── الموقع العام ورابط المتابعة ─────────────
export function canEditSite(db: DB, personId: ID): boolean {
  return getCapabilities(db, personId).isSiteEditor;
}
export function canManageTrackingLink(db: DB, personId: ID): boolean {
  return getCapabilities(db, personId).isStaff;
}

// ───────────── المهام ─────────────
export function canCreateTaskFor(db: DB, creatorId: ID, assigneeId: ID): boolean {
  const c = getCapabilities(db, creatorId);
  if (c.isLeader) return true;
  if (c.committees.some((m) => m.role === 'leader') && db.memberships.some((m) => m.personId === assigneeId)) return true;
  if (c.isStaff) return true; // لوحة الإدارة العامة يكلّف فيها القائد العام أو غيره
  // مشارك لمشارك آخر في مجموعته
  return !!c.group && c.group.memberIds.includes(assigneeId);
}

// ───────────── التنقل ─────────────
export interface NavItem {
  to: string;
  label: string;
  icon: string;
  priority: number;
}

/** القائمة الجانبية: كل الأقسام ظاهرة، مقسّمة إلى مجموعات، ومرتبة داخل كل مجموعة حسب أهميتها للدور */
const SECTION_OF: Record<string, string> = {
  '/app': 'الأساسية', '/app/calendar': 'الأساسية', '/app/notifications': 'الأساسية',
  '/app/finance': 'الإدارة', '/app/tasks': 'الإدارة', '/app/committees': 'الإدارة', '/app/people': 'الإدارة', '/app/insights': 'الإدارة',
  '/app/inbox': 'الإدارة', '/app/users': 'الإدارة', '/app/tracking-link': 'الإدارة', '/app/site-editor': 'الإدارة', '/app/settings': 'الإدارة',
};
export const NAV_SECTIONS = ['الأساسية', 'البرنامج', 'الإدارة'];
export function navFor(db: DB, personId: ID): { sections: { title: string; items: NavItem[] }[]; all: NavItem[] } {
  const c = getCapabilities(db, personId);
  const published = groupsPublished(db);
  const map = new Map<string, NavItem>();
  const add = (to: string, label: string, icon: string, priority: number) => {
    const ex = map.get(to);
    if (!ex || ex.priority > priority) map.set(to, { to, label: ex && ex.priority <= priority ? ex.label : label, icon, priority });
  };
  const hasRequests = c.leaderOf || c.facilitatorOf.length || c.staffTripsLed.length || db.budgetRequests.some((r) => r.requestedBy === personId) || db.custodies.some((x) => x.recipientId === personId);

  add('/app', 'الرئيسية', 'home', 0);
  add('/app/calendar', 'التقويم', 'calendar', 1);
  add('/app/notifications', 'الإشعارات', 'bell', 2);
  add('/app/trips', 'الرحلات', 'map', 40);
  add('/app/library', 'المكتبة', 'book', 60);
  add('/app/surveys', 'الاستبيانات', 'clipboard', 75);
  add('/app/groups', 'المجموعات', 'grid', 80);
  add('/app/leaderboard', 'الترتيب', 'trophy', 85);
  if (c.isStaff || published) add('/app/focus', 'لقاءات التركيز', 'target', 50);
  if (c.isStaff || c.leaderOf) add('/app/meetings', 'الاجتماعات', 'meeting', 55);

  if (c.isParticipant) {
    add('/app/trips', 'الرحلات', 'map', 10);
    add('/app/focus', 'لقاءات التركيز', 'target', 20);
    add('/app/plan', 'خطتي', 'compass', 30);
    add('/app/library', 'المكتبة', 'book', 40);
    if (c.group) add('/app/individual', 'لقائي مع الميسّر', 'users', 50);
    add('/app/tasks', 'مهامي', 'check', 65);
    if (!published) add('/app/contact', 'راسل الإدارة', 'message', 15);
  }
  if (c.leaderOf) {
    add('/app/trips', 'رحلتي', 'map', 5);
    add('/app/requests', 'طلباتي', 'receipt', 15);
  }
  if (c.facilitatorOf.length) {
    add('/app/focus', 'اللقاءات', 'target', 5);
    add('/app/groups', 'مجموعتي', 'grid', 10);
    add('/app/individual', 'اللقاءات الفردية', 'users', 15);
    add('/app/requests', 'طلباتي', 'receipt', 20);
    add('/app/plans', 'الخطط الشخصية', 'compass', 35);
  }
  if (hasRequests) add('/app/requests', 'طلباتي', 'receipt', 45);
  if (c.isTracker) add('/app/tracker', 'متابعة الرحلات', 'radar', 3);
  if (db.trips.some((t) => t.trackerSubstitute?.status === 'approved' && t.trackerSubstitute.candidateId === personId)) add('/app/tracker', 'متابعة الرحلات', 'radar', 8);
  if (c.isStaff) {
    add('/app/tasks', 'المهام', 'check', 30);
    add('/app/committees', 'اللجان', 'layers', 45);
    add('/app/people', 'الأشخاص', 'contact', 65);
    add('/app/tracking-link', 'رابط المتابعة', 'link', 90);
  } else if (c.committees.length) add('/app/committees', 'لجنتي', 'layers', 35);
  if (c.isMedia) add('/app/committees', 'لجنتي', 'layers', 6);
  if (canSeeFinance(db, personId)) add('/app/finance', 'المالية', 'wallet', c.isFinance ? 1 : 12);
  if (c.isLeader) {
    add('/app/trips', 'الرحلات', 'map', 5);
    add('/app/groups', 'المجموعات', 'grid', 15);
    add('/app/meetings', 'الاجتماعات', 'meeting', 20);
    add('/app/plans', 'الخطط الشخصية', 'compass', 50);
    add('/app/insights', 'المؤشرات', 'chart', 25);
    add('/app/inbox', 'رسائل المشاركين', 'message', 88);
    add('/app/settings', 'الإعدادات', 'settings', 60);
  } else if (c.isStaff) add('/app/insights', 'المؤشرات', 'chart', 70);
  if (c.isTechLead) add('/app/users', 'المستخدمون', 'key', 7);
  if (c.isTechLead || c.canManageScheduleCategories) add('/app/settings', 'الإعدادات', 'settings', 60);
  if (c.isSiteEditor) add('/app/site-editor', 'تحرير الموقع', 'globe', 92);

  const all = [...map.values()].sort((a, b) => a.priority - b.priority);
  const sectionOf = (to: string) => SECTION_OF[to] ?? (c.isParticipant && to === '/app/tasks' ? 'البرنامج' : 'البرنامج');
  const sections = NAV_SECTIONS.map((title) => ({ title, items: all.filter((i) => (i.to === '/app/tasks' && c.isParticipant ? 'البرنامج' : sectionOf(i.to)) === title) })).filter((x) => x.items.length);
  return { sections, all };
}
