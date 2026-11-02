// مصفوفة الأدوار والصلاحيات كبيانات (الرئيسي 1.6): role → permissions.
// الواجهة وطبقة البيانات تسألان can() ولا تكتبان شروطاً مبعثرة. الصلاحيات الدقيقة داخل المالية والإعلام تبقى في finance.ts وmedia.ts.
import { canManageAccounts } from './accounts';
import type { DB, ID, Person } from './types';

export type RoleKey = 'tech_head' | 'general_leader' | 'assistant' | 'supervisor' | 'society_delegate';

export type Permission =
  | 'accounts.manage' // إنشاء الحسابات وإيقافها وإعادة تعيين كلمات المرور
  | 'settings.technical' // الإشعارات والنوافذ والسقوف وقوالب وسجل البريد
  | 'approve' // اعتماد الخطط والطلبات (القائد العام أو مساعده)
  | 'evaluate' // تقييم الرحلات والمشاركين
  | 'trips.manage' // إنشاء الرحلات والمجموعات وتوزيع الأعضاء
  | 'targets.set' // مستهدفات كل اللجان
  | 'budget.reveal' // إظهار الموازنة
  | 'roles.assign' // تعيين الصفات (ميسّر، قائد، عضو لجنة، مندوب الجمعية)
  | 'templates.edit' // قالب وثيقة الرحلة وقوالب الخطابات
  | 'letters.manage' // إصدار الخطابات
  | 'view.all'; // رؤية كل الشاشات عدا التقنية

/** تعريف البيانات: لكل دور ما يملكه. القائد العام والمساعد بلا الحسابات والإعدادات التقنية، والمشرف بلا أي كتابة */
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  tech_head: ['accounts.manage', 'settings.technical'],
  general_leader: ['approve', 'evaluate', 'trips.manage', 'targets.set', 'budget.reveal', 'roles.assign', 'templates.edit', 'view.all'],
  assistant: ['approve', 'evaluate', 'trips.manage', 'targets.set', 'budget.reveal', 'roles.assign', 'templates.edit', 'view.all'],
  supervisor: ['view.all'],
  society_delegate: ['letters.manage'],
};

export const ROLE_LABEL: Record<RoleKey, string> = {
  tech_head: 'مسؤول اللجنة التقنية',
  general_leader: 'القائد العام',
  assistant: 'مساعد القائد العام',
  supervisor: 'المشرف العام (قراءة فقط)',
  society_delegate: 'مندوب الجمعية',
};

const person = (db: DB, pid: ID): Person | undefined => db.persons.find((p) => p.id === pid);

export function roleKeysOf(db: DB, pid: ID): RoleKey[] {
  const p = person(db, pid);
  const roles: [RoleKey, unknown][] = [
    ['tech_head', canManageAccounts(db, pid)],
    ['general_leader', p?.isGeneralLeader],
    ['assistant', p?.isAssistant],
    ['supervisor', p?.isSupervisor],
    ['society_delegate', db.settings.societyDelegateId === pid],
  ];
  return roles.filter(([, ok]) => ok).map(([r]) => r);
}

export function can(db: DB, pid: ID, perm: Permission): boolean {
  return roleKeysOf(db, pid).some((r) => ROLE_PERMISSIONS[r].includes(perm));
}

/** المشرف العام: لا يكتب أبداً. يُفحص في طبقة البيانات قبل كل تعديل */
export function isReadOnly(db: DB, pid: ID): boolean {
  return !!person(db, pid)?.isSupervisor;
}
export const READ_ONLY_MESSAGE = 'وضع القراءة فقط: المشرف العام لا يستطيع التعديل أو الاعتماد أو التعليق أو الإرسال';

/** من يملك صلاحيات القيادة الكتابية: القائد العام ومساعده */
export function hasLeaderPowers(db: DB, pid: ID): boolean {
  const p = person(db, pid);
  return !!p && !!(p.isGeneralLeader || p.isAssistant);
}
/** من يرى ما يراه القائد العام: القائد ومساعده والمشرف (والكتابة للمشرف مرفوضة في الطبقة) */
export function seesAsLeader(db: DB, pid: ID): boolean {
  return hasLeaderPowers(db, pid) || isReadOnly(db, pid);
}

/** معرّفا القائد العام ومساعده: من يصله إشعار الاعتماد */
export function leaderIds(db: DB): ID[] {
  return db.persons.filter((p) => p.isGeneralLeader || p.isAssistant).map((p) => p.id);
}
/** الحسابان الخاصان يُنشآن من شاشة الحسابات وحدها */
export function isSpecialAccount(p: Person): boolean {
  return !!(p.isSupervisor || p.isAssistant);
}
