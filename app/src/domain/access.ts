// الوصول وتجربة الواجهة (وثيقة القرارات): كل شخص لا يصل إلا لما يملك صلاحيته.
// - ما يملكه الشخص يُحسب هنا من صفاته (منطق)، وترتيب القائمة والرئيسية لكل دور يُقرأ من settings.ui (بيانات).
// - routeAccess يفحص أي عنوان يُكتب يدوياً، ويُستخدم في التوجيه وفي طبقة البيانات معاً.
import { canOpenFinance, canViewBudget, hasFinancePerm, isFinanceOwner } from './finance';
import { seesAsLeader, can, isReadOnly } from './roles';
import { canOpenMedia, hasMediaPerm, latestSnapshot } from './media';
import {
  canSeeCommittee, canSeePersonalPlan, canViewTripPlans, canViewFocus, getCapabilities, groupsPublished, type Capabilities,
} from './permissions';
import type { DB, HomeWidget, ID, LayoutRole } from './types';

/** أقسام المالية الثمانية: كل قسم عنصر مستقل في قائمة مسؤول المالية، ولغيره تُفتح من «نظرة عامة» */
export const FINANCE_SECTIONS = ['overview', 'requests', 'invoices', 'direct', 'wallet', 'fees', 'reports', 'settings'] as const;
export type FinanceSection = (typeof FINANCE_SECTIONS)[number];
/** العناوين القديمة (?tab=custody ...) تُحوَّل لقسمها الجديد حتى لا تنكسر الروابط والإشعارات السابقة */
export const FINANCE_TAB_ALIAS: Record<string, FinanceSection> = {
  custody: 'requests', needs: 'direct', budget: 'wallet', edits: 'settings', categories: 'settings', team: 'settings', audit: 'reports', analysis: 'reports',
};
export const financeSectionOf = (tab: string | null | undefined): FinanceSection | null =>
  !tab ? null : (FINANCE_SECTIONS as readonly string[]).includes(tab) ? (tab as FinanceSection) : FINANCE_TAB_ALIAS[tab] ?? null;

/** أقسام المالية التي يراها الشخص (الصلاحيات نفسها، مجمّعة في الأقسام الجديدة) */
export function financeTabsFor(db: DB, pid: ID): FinanceSection[] {
  if (!canOpenFinance(db, pid)) return [];
  const view = canViewBudget(db, pid);
  const p = (k: Parameters<typeof hasFinancePerm>[2]) => hasFinancePerm(db, pid, k);
  const leader = seesAsLeader(db, pid);
  const owner = isFinanceOwner(db, pid);
  const tabs: [FinanceSection, boolean][] = [
    ['overview', true],
    ['requests', true],
    ['invoices', p('review_invoices') || view],
    ['direct', view || p('disburse')],
    ['wallet', view || p('disburse')],
    ['fees', view],
    ['reports', view || owner || leader],
    ['settings', owner || view || p('manage_categories')],
  ];
  return tabs.filter(([, ok]) => ok).map(([t]) => t);
}

function hasRequests(db: DB, pid: ID, c: Capabilities) {
  return !!(c.leaderOf || c.facilitatorOf.length || c.staffTripsLed.length || db.budgetRequests.some((r) => r.requestedBy === pid) || db.custodies.some((x) => x.recipientId === pid));
}
function isTrackerOrSubstitute(db: DB, pid: ID, c: Capabilities) {
  return c.isTracker || db.trips.some((t) => t.trackerSubstitute?.status === 'approved' && t.trackerSubstitute.candidateId === pid);
}

/** مفاتيح عناصر القائمة التي يملك الشخص صلاحيتها */
export function accessibleKeys(db: DB, pid: ID): Set<string> {
  const c = getCapabilities(db, pid);
  const published = groupsPublished(db);
  const keys = new Set<string>(['home', 'calendar', 'notifications', 'profile', 'trips', 'library', 'surveys', 'groups', 'leaderboard', 'tasks']);
  const add = (k: string, ok: unknown) => ok && keys.add(k);
  add('focus', c.isStaff || published);
  add('meetings', c.isStaff || c.leaderOf);
  add('plan', c.isParticipant);
  add('individual', (c.isParticipant && c.group) || c.facilitatorOf.length);
  add('plans', c.isLeader || c.facilitatorOf.length);
  add('requests', hasRequests(db, pid, c));
  add('contact', c.isParticipant && !published);
  add('tracker', isTrackerOrSubstitute(db, pid, c));
  add('committees', c.isLeader || c.committees.some((m) => m.committee.kind !== 'general') || c.isStaff);
  add('my_committee', c.committees.some((m) => m.committee.kind !== 'general'));
  add('people', c.isStaff);
  add('insights', c.isStaff);
  add('inbox', c.isLeader);
  add('approvals', c.isLeader);
  add('tracking_link', c.isStaff);
  add('site_editor', c.isSiteEditor);
  add('audit', c.isTechLead || c.isLeader);
  add('settings', c.isLeader || c.isTechLead || c.canManageScheduleCategories);
  add('finance', canOpenFinance(db, pid));
  add('media', canOpenMedia(db, pid));
  add('letters', c.isDelegate || c.isLeader);
  add('opening', c.isLeader);
  add('closing', c.isLeader);
  financeTabsFor(db, pid).forEach((t) => keys.add(`finance_${t}`));
  return keys;
}

/** أدوار فريق العمل المحددة: من يحمل واحداً منها يأخذ قائمته هو لا قائمة «عضو فريق العمل» العامة */
const SPECIFIC_STAFF: LayoutRole[] = ['finance_head', 'tech_head', 'media_head', 'leader', 'facilitator', 'tracker'];

/** الأدوار التي تنطبق على الشخص لاختيار واجهته (من الأعلى أولوية) */
export function layoutRolesOf(db: DB, pid: ID): LayoutRole[] {
  const c = getCapabilities(db, pid);
  const head = (kind: string) => c.committees.some((m) => m.committee.kind === kind && m.role === 'leader');
  const roles: [LayoutRole, unknown][] = [
    ['finance_head', c.isFinanceLead],
    ['tech_head', c.isTechLead],
    ['media_head', head('media')],
    ['leader', c.isLeader],
    ['facilitator', c.facilitatorOf.length],
    ['tracker', c.isTracker && !c.isLeader],
    ['group_leader', c.leaderOf],
    ['staff', c.isStaff],
    ['participant', c.isParticipant],
  ];
  const out = roles.filter(([, ok]) => ok).map(([r]) => r);
  // البديل المؤقت لمتابع الرحلات بلا دور آخر يأخذ قائمة المتابع
  if (!out.some((r) => SPECIFIC_STAFF.includes(r)) && isTrackerOrSubstitute(db, pid, c)) out.splice(out.indexOf('staff'), 0, 'tracker');
  // القائمة العامة لفريق العمل وللمشارك لا تُدمج مع قائمة أدق منها
  const specific = out.some((r) => SPECIFIC_STAFF.includes(r));
  return out.filter((r) => !(r === 'staff' && specific) && !(r === 'participant' && out.includes('group_leader')));
}

export interface NavItem {
  key: string;
  to: string;
  label: string;
  icon: string;
}

/**
 * القائمة الجانبية: مجموعات أدوار الشخص (بيانات) مدموجة بالأولوية، ولا يظهر فيها إلا ما ذكره ترتيب دوره ويملك صلاحيته،
 * ثم «الإضافات» (عناصر مؤقتة كمتابعة رحلة لبديل المتابع)، ثم العناصر النازلة لآخر القائمة
 */
export function navFor(db: DB, pid: ID): { sections: { title: string; items: NavItem[] }[]; all: NavItem[] } {
  const ui = db.settings.ui;
  const allowed = accessibleKeys(db, pid);
  const roles = layoutRolesOf(db, pid);
  const layouts = ui.layouts.filter((l) => roles.includes(l.role)).sort((a, b) => a.priority - b.priority);
  const tail = new Set(layouts.flatMap((l) => l.tail ?? []));
  const catalog = new Map(ui.navCatalog.map((i) => [i.key, i]));
  const placed = new Set<string>();
  const sections: { title: string; items: NavItem[] }[] = [];
  const push = (title: string, key: string, label?: string) => {
    if (key === 'notifications' || key === 'profile') return; // تُفتح من قائمة الحساب
    const cat = catalog.get(key);
    if (!cat || placed.has(key) || !allowed.has(key)) return;
    // عنصران لنفس الشاشة (مثل «اللجان» و«لجنتي») لا يظهران معاً
    if ([...placed].some((k) => catalog.get(k)?.to === cat.to)) return;
    placed.add(key);
    let sec = sections.find((s) => s.title === title);
    if (!sec) sections.push((sec = { title, items: [] }));
    // الرحلات قسمان منفصلان في القائمة: الداخلية والخارجية، لكل منهما أيقونة وهوية
    if (key === 'trips') {
      sec.items.push({ key: 'trips_internal', to: '/app/trips?type=internal', label: 'الرحلات الداخلية', icon: 'building' }, { key: 'trips_external', to: '/app/trips?type=external', label: 'الرحلات الخارجية', icon: 'route' });
      return;
    }
    sec.items.push({ key, to: cat.to, label: label ?? cat.label, icon: cat.icon });
  };
  for (const l of layouts) for (const s of l.sections) for (const i of s.items) if (!tail.has(i.key)) push(s.title, i.key, i.label);
  for (const x of ui.extras ?? []) if (x.key !== 'letters' || getCapabilities(db, pid).isDelegate) push(x.section, x.key);
  for (const key of tail) push(sections[sections.length - 1]?.title ?? 'أخرى', key);
  return { sections: sections.filter((s) => s.items.length), all: sections.flatMap((s) => s.items) };
}

/** محتوى الرئيسية: من ترتيب أعلى أدوار الشخص أولوية (بيانات) */
export function homeFor(db: DB, pid: ID): HomeWidget[] {
  const roles = layoutRolesOf(db, pid);
  const l = db.settings.ui.layouts.filter((x) => roles.includes(x.role)).sort((a, b) => a.priority - b.priority)[0];
  return l?.home ?? ['actions', 'upcoming'];
}

// ───────────── فحص العنوان المكتوب يدوياً ─────────────
const STATIC_ROUTES: Record<string, string> = {
  '': 'home', calendar: 'calendar', notifications: 'notifications', trips: 'trips', focus: 'focus', meetings: 'meetings', plan: 'plan',
  individual: 'individual', plans: 'plans', library: 'library', surveys: 'surveys', groups: 'groups', leaderboard: 'leaderboard', tasks: 'tasks',
  requests: 'requests', profile: 'profile', contact: 'contact', tracker: 'tracker', committees: 'committees', people: 'people', insights: 'insights', inbox: 'inbox',
  'tracking-link': 'tracking_link', 'site-editor': 'site_editor', users: 'people', settings: 'settings', finance: 'finance', custody: 'requests',
  approvals: 'approvals', audit: 'audit', messages: 'messages', media: 'media', letters: 'letters', 'finance-print': 'finance', opening: 'opening', closing: 'closing', 'trip-print': 'trips',
};

export function meetingVisibleTo(db: DB, pid: ID, meetingId: ID): boolean {
  const m = db.meetings.find((x) => x.id === meetingId);
  if (!m) return false;
  const c = getCapabilities(db, pid);
  return c.isLeader || c.isFinanceLead || m.ownerId === pid || m.createdBy === pid || m.inviteeIds.includes(pid);
}

/**
 * هل يفتح الشخص هذا العنوان؟ العنوان غير الموجود والعنصر غير الموجود يُعاملان كالممنوع تماماً،
 * فلا يُعرف من الرفض هل الصفحة موجودة.
 */
export function routeAccess(db: DB, pid: ID, pathname: string, search = ''): boolean {
  if (!db.persons.some((p) => p.id === pid)) return false;
  const parts = pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean);
  const [section = '', id, ...rest] = parts;
  if (section === 'media') return mediaRouteAccess(db, pid, parts.slice(1));
  if (rest.length) return false;
  if (section === 'more' && !id) return true;
  const key = STATIC_ROUTES[section];
  if (key === undefined) return false;
  if (section === 'people' && id === pid) return true; // ملفه الشخصي
  const allowed = accessibleKeys(db, pid);
  // شاشات مدموجة: الرسائل (طرفا القناة)، والخطط الشخصية (خطتي وخطط المشاركين)
  const ok = key === 'messages' ? allowed.has('inbox') || allowed.has('contact') : key === 'plans' ? allowed.has('plans') || allowed.has('plan') : allowed.has(key);
  if (!ok) return false;
  if (section === 'finance') {
    const tab = new URLSearchParams(search).get('tab');
    const sec = financeSectionOf(tab);
    return !tab || (!!sec && financeTabsFor(db, pid).includes(sec));
  }
  if (!id) return true;
  switch (section) {
    case 'trips':
      return db.trips.some((t) => t.id === id);
    case 'trip-print': {
      const tr = db.trips.find((t) => t.id === id);
      return !!tr && canViewTripPlans(db, pid, tr);
    }
    case 'focus': {
      const fm = db.focusMeetings.find((f) => f.id === id);
      return !!fm && canViewFocus(db, pid, fm);
    }
    case 'meetings':
      return meetingVisibleTo(db, pid, id);
    case 'committees':
      return db.committees.some((c) => c.id === id) && canSeeCommittee(db, pid, id);
    case 'people': {
      const p = db.persons.find((x) => x.id === id);
      return !!p && (getCapabilities(db, pid).isStaff || id === pid);
    }
    case 'plans':
      return db.persons.some((x) => x.id === id && x.kind === 'participant') && (id === pid || (allowed.has('plans') && canSeePersonalPlan(db, pid, id)));
    default:
      return false;
  }
}

/** مسارات المركز الإعلامي: كلها لمن يملك المركز، وشاشات القوالب والروابط والمؤشرات بصلاحياتها */
function mediaRouteAccess(db: DB, pid: ID, rest: string[]): boolean {
  if (!canOpenMedia(db, pid)) return false;
  const [page, id, ...more] = rest;
  switch (page) {
    case undefined:
    case 'follow':
      return !id;
    case 'briefs':
      if (more.length) return false;
      if (!id) return true;
      if (id === 'new') return hasMediaPerm(db, pid, 'edit');
      return db.mediaBriefs.some((b) => b.id === id);
    case 'print':
      return !more.length && !!id && db.mediaBriefs.some((b) => b.id === id && (b.status === 'approved' ? !!latestSnapshot(b) : true));
    case 'templates':
      return !id && hasMediaPerm(db, pid, 'edit');
    case 'links':
      return !id && hasMediaPerm(db, pid, 'approve');
    case 'metrics':
      return !id && hasMediaPerm(db, pid, 'metrics');
    default:
      return false;
  }
}

export const ACCESS_DENIED = 'لا تملك صلاحية الوصول';
