// الصلاحيات المؤقتة: يمنحها القائد العام لأشخاص يحددهم حتى تاريخ، وله سحبها في أي وقت.
import { todayISO } from './dates';
import type { DB, ID, TempGrant, TempPermission } from './types';

export const tempPermissionLabel: Record<TempPermission, string> = {
  register_participants: 'تسجيل المشاركين',
  edit_site: 'تحرير الموقع العام',
  manage_schedule_categories: 'تصنيفات الجدول الزمني',
};

export function isGrantActive(g: TempGrant, today = todayISO()): boolean {
  return !g.revokedAt && today <= g.expiresAt;
}

/** القائد العام يملك كل الصلاحيات المؤقتة أصلاً */
export function hasTempGrant(db: DB, personId: ID, perm: TempPermission): boolean {
  if (db.persons.find((p) => p.id === personId)?.isGeneralLeader) return true;
  return db.tempGrants.some((g) => g.personId === personId && g.permission === perm && isGrantActive(g));
}
