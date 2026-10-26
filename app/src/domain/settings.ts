// ملكية الإعدادات وقفل التقييم (وثيقة القرارات: قفل الإعدادات + إجابة س4).
// القفل لإعدادات التقييم فقط، وبقية القوالب يعدّلها صاحبها.
import { canManageAccounts } from './accounts';
import { hasTempGrant } from './grants';
import type { DB, ID, Settings } from './types';

/** إعدادات التقييم: الأوزان والبنود وشروط المواعيد وأوزان الحضور. تُقفل بعد الحفظ */
export const EVALUATION_KEYS = [
  'split', 'groupTripSplit', 'evaluationItems', 'presentationCriteria', 'repeatPresentationFactor', 'presentingMaxMultiplier',
  'lateFactor', 'enrichmentPointsPerMaterial', 'deadlineDefaults', 'attendanceWeights', 'tripAttendanceStates',
] as const satisfies readonly (keyof Settings)[];
export type EvaluationKey = (typeof EVALUATION_KEYS)[number];
export type EvaluationSettings = Pick<Settings, EvaluationKey>;

export function isEvaluationKey(k: string): k is EvaluationKey {
  return (EVALUATION_KEYS as readonly string[]).includes(k);
}

const isLeader = (db: DB, pid: ID) => !!db.persons.find((p) => p.id === pid)?.isGeneralLeader;

/** تعديل التقييم: القائد العام (أو مسؤول التقنية) ما دام غير مقفل */
export function canEditEvaluation(db: DB, pid: ID): boolean {
  return !db.settings.evaluationLock.locked && (isLeader(db, pid) || canManageAccounts(db, pid));
}
/** فتح القفل: حساب واحد فقط هو مسؤول اللجنة التقنية */
export function canUnlockEvaluation(db: DB, pid: ID): boolean {
  return canManageAccounts(db, pid);
}

/** صاحب كل إعداد غير التقييم. null = مسموح */
export function settingsKeyBlockReason(db: DB, pid: ID, key: keyof Settings): string | null {
  if (isEvaluationKey(key)) return 'إعدادات التقييم تُحفظ من تبويبها وتُقفل بعد الحفظ';
  if (key === 'scheduleCategories') return hasTempGrant(db, pid, 'manage_schedule_categories') ? null : 'تصنيفات الجدول للقائد العام أو من يفوّضه';
  if (key === 'site') return hasTempGrant(db, pid, 'edit_site') ? null : 'الموقع العام للقائد العام أو من يفوّضه';
  if (key === 'importantNotifications') return canManageAccounts(db, pid) ? null : 'إعدادات الإشعارات لمسؤول اللجنة التقنية';
  return isLeader(db, pid) ? null : 'هذا الإعداد للقائد العام';
}
