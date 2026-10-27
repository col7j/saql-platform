// ملكية الإعدادات وقفل التقييم (وثيقة القرارات: قفل الإعدادات + إجابة س4).
// القفل لإعدادات التقييم فقط، وبقية القوالب يعدّلها صاحبها.
import { canManageAccounts } from './accounts';
import { hasTempGrant } from './grants';
import type { DB, ID, Settings } from './types';

/** إعدادات التقييم: الأوزان والبنود وشروط المواعيد وأوزان الحضور ونصاب تقييم الرحلة. يملكها القائد العام وتُقفل بعد الحفظ */
export const EVALUATION_KEYS = [
  'split', 'groupTripSplit', 'evaluationItems', 'presentationCriteria', 'presentingExtraBonus', 'presentingRevealAfterEnd', 'leaderEvalItems',
  'deadlineFinalCredit', 'enrichmentPointsPerMaterial', 'deadlineDefaults', 'attendanceWeights', 'attendanceLateCredit', 'tripRatingQuorum',
] as const satisfies readonly (keyof Settings)[];
export type EvaluationKey = (typeof EVALUATION_KEYS)[number];
export type EvaluationSettings = Pick<Settings, EvaluationKey>;

export const evaluationKeyLabel: Record<EvaluationKey, string> = {
  split: 'التوزيع الفردي والجماعي', groupTripSplit: 'نصيب الرحلات الداخلية والخارجية', evaluationItems: 'البنود والأوزان',
  presentationCriteria: 'معايير تقييم المقدّم', presentingExtraBonus: 'تميّز التقديم المتكرر', presentingRevealAfterEnd: 'إظهار تقييم المقدّمين', leaderEvalItems: 'بنود تقييم القائد العام',
  deadlineFinalCredit: 'ما يُكسب في الموعد النهائي', enrichmentPointsPerMaterial: 'نقاط المادة الإثرائية', deadlineDefaults: 'شروط المواعيد',
  attendanceWeights: 'أوزان الحضور', attendanceLateCredit: 'درجة المتأخر', tripRatingQuorum: 'نصاب تقييم الرحلة',
};

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
  if (key === 'ui') return canManageAccounts(db, pid) ? null : 'قوائم الأدوار ورئيسياتها لمسؤول اللجنة التقنية';
  if (key === 'importantNotifications') return canManageAccounts(db, pid) ? null : 'إعدادات الإشعارات لمسؤول اللجنة التقنية';
  return isLeader(db, pid) ? null : 'هذا الإعداد للقائد العام';
}

/** تحقق قيم التقييم قبل الحفظ: موعد التبكير أسبق من النهائي، والنسب بين 0 و1 */
export function evaluationSettingsError(s: Settings): string | null {
  const dd = s.deadlineDefaults;
  const pairs: [string, number, number][] = [['وثيقة الرحلة', dd.documentEarlyDaysBefore, dd.documentDaysBefore], ['الجدول الزمني', dd.scheduleEarlyDaysBefore, dd.scheduleDaysBefore], ['الميزانية', dd.budgetEarlyDaysBefore, dd.budgetDaysBefore]];
  const bad = pairs.find(([, early, final]) => early < final);
  if (bad) return `موعد التبكير في «${bad[0]}» يجب أن يسبق الموعد النهائي (أيام أكثر قبل الرحلة)`;
  if (!(s.deadlineFinalCredit >= 0 && s.deadlineFinalCredit <= 1)) return 'ما يُكسب في الموعد النهائي بين 0 و1';
  if (!(s.attendanceLateCredit >= 0 && s.attendanceLateCredit <= 1)) return 'درجة المتأخر بين 0 و1';
  if (!(s.tripRatingQuorum > 0 && s.tripRatingQuorum <= 1)) return 'نصاب تقييم الرحلة أكبر من 0 وحتى 1';
  if (!(s.presentingExtraBonus >= 0)) return 'نقاط التميّز لا تكون سالبة';
  return null;
}
