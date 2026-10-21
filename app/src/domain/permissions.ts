// منطق الصلاحيات (قسم 3). دوال نقية تأخذ قاعدة البيانات ومعرّف الشخص، ولا تعتمد على الواجهة.
import { now } from './dates';
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
  isTracker: boolean; // متابع الرحلات الثابت
  isSiteEditor: boolean;
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
  const finance = committees.find((c) => c.committee.kind === 'finance');
  const isFinance = !!finance;
  const isFinanceLead = finance?.role === 'leader';
  const isMedia = committees.some((c) => c.committee.kind === 'media');
  const isTracker = db.settings.trackerId === person.id;
  const isSiteEditor = isLeader || db.capacities.some((c) => c.personId === person.id && c.kind === 'site_editor');
  const staffTripsLed = db.trips.filter((t) => t.executor.kind === 'staff' && t.executor.leaderId === person.id);
  const staffTripsMember = db.trips.filter((t) => t.executor.kind === 'staff' && t.executor.memberIds.includes(person.id));
  const presenterIn = db.focusMeetings.filter((f) => f.presenterIds.includes(person.id));

  const labels: string[] = [];
  if (isLeader) labels.push('القائد العام');
  else if (isStaff) labels.push('عضو إدارة');
  else labels.push('مشارك');
  facilitatorOf.forEach((g) => labels.push(`ميسّر ${g.name}`));
  if (leaderOf) labels.push(`قائد ${leaderOf.name}`);
  committees.forEach((c) => labels.push(`${c.role === 'leader' ? 'قائد' : 'عضو'} ${c.committee.name}`));
  if (isTracker) labels.push('متابع الرحلات');
  if (isSiteEditor && !isLeader) labels.push('محرّر الموقع');
  if (staffTripsLed.length) labels.push('قائد فريق رحلة');
  if (presenterIn.length && isParticipant) labels.push('مقدّم');

  return {
    person, isLeader, isStaff, isParticipant, facilitatorOf, leaderOf, group, committees,
    isFinance, isFinanceLead, isMedia, isTracker, isSiteEditor, staffTripsLed, staffTripsMember, presenterIn, labels,
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

/** هل يرى الشخص الموازنة التقديرية للرحلة؟ (قسم 11.4) */
export function canSeeEstimatedBudget(db: DB, personId: ID, trip?: Trip): boolean {
  const c = getCapabilities(db, personId);
  if (c.isLeader || c.isFinance) return true;
  if (trip && isTripTeam(db, personId, trip)) return true; // الفريق المنفذ يعدّ موازنته
  if (c.isStaff && db.settings.budgetVisibleToStaff) return true;
  return false;
}

/** المبالغ المصروفة والفواتير والتحليل: اللجنة المالية والقائد العام فقط */
export function canSeeFinance(db: DB, personId: ID): boolean {
  const c = getCapabilities(db, personId);
  return c.isLeader || c.isFinance || c.committees.some((m) => m.canSeeFinance);
}

export function canManageFinance(db: DB, personId: ID): boolean {
  const c = getCapabilities(db, personId);
  return c.isFinance;
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
  section: string;
}

export function navFor(db: DB, personId: ID): NavItem[] {
  const c = getCapabilities(db, personId);
  const items: NavItem[] = [];
  const add = (to: string, label: string, icon: string, section: string) => items.push({ to, label, icon, section });
  const published = groupsPublished(db);

  add('/app', 'الرئيسية', 'home', 'عام');
  add('/app/calendar', 'التقويم', 'calendar', 'عام');
  add('/app/notifications', 'الإشعارات', 'bell', 'عام');

  add('/app/trips', 'الرحلات', 'map', 'البرنامج');
  if (c.isStaff || published) add('/app/focus', 'لقاءات التركيز', 'target', 'البرنامج');
  if (c.isParticipant && c.group) add('/app/individual', 'اللقاءات الفردية', 'users', 'البرنامج');
  if (c.facilitatorOf.length) add('/app/individual', 'اللقاءات الفردية', 'users', 'البرنامج');
  if (c.isParticipant) add('/app/plan', 'خطتي الشخصية', 'compass', 'البرنامج');
  if (c.isLeader || c.facilitatorOf.length) add('/app/plans', 'الخطط الشخصية', 'compass', 'البرنامج');
  add('/app/surveys', 'الاستبيانات', 'clipboard', 'البرنامج');
  add('/app/library', 'المكتبة', 'book', 'البرنامج');
  add('/app/groups', 'المجموعات', 'grid', 'البرنامج');
  add('/app/leaderboard', 'الترتيب والتقييم', 'trophy', 'البرنامج');
  if (c.isTracker || db.trips.some((t) => t.trackerSubstitute?.status === 'approved' && t.trackerSubstitute.candidateId === personId))
    add('/app/tracker', 'متابعة الرحلات', 'radar', 'البرنامج');
  if (c.isParticipant && !published) add('/app/contact', 'تواصل مع الإدارة', 'message', 'البرنامج');

  if (c.isStaff) {
    add('/app/tasks', 'لوحة المهام', 'check', 'الإدارة');
    add('/app/committees', 'اللجان', 'layers', 'الإدارة');
    add('/app/people', 'الأشخاص', 'contact', 'الإدارة');
  } else if (c.committees.length) {
    add('/app/committees', 'لجاني', 'layers', 'الإدارة');
  }
  if (c.isParticipant) add('/app/tasks', 'مهامي', 'check', 'البرنامج');
  if (canSeeFinance(db, personId)) add('/app/finance', 'المالية', 'wallet', 'الإدارة');
  if (c.leaderOf || c.facilitatorOf.length || c.staffTripsLed.length || db.custodies.some((x) => x.recipientId === personId))
    add('/app/custody', 'عهدتي', 'receipt', 'البرنامج');
  if (c.isLeader) add('/app/inbox', 'رسائل المشاركين', 'message', 'الإدارة');
  if (c.isStaff) add('/app/tracking-link', 'رابط المتابعة', 'link', 'الإدارة');
  if (c.isSiteEditor) add('/app/site-editor', 'تحرير الموقع', 'globe', 'الإدارة');
  if (c.isLeader) add('/app/settings', 'الإعدادات', 'settings', 'الإدارة');

  // إزالة التكرار بحسب الرابط
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.to) ? false : (seen.add(i.to), true)));
}
