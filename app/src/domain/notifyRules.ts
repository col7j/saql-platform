// قواعد الإشعارات والبريد المحاكى: لا يُرسل بريد فعلي في النموذج، بل يُسجَّل في «مركز البريد» بحالته (أُرسل، مؤجّل، مُخطّى، معطّل).
// المنصة الحقيقية تحتاج: مزوّد بريد (SMTP/API)، وطابور رسائل، ومجدوِل للتذكيرات والنوافذ، وإعادة محاولة وسجل تسليم.
import { dateTime } from './dates';
import type { DB, EmailLogEntry, EmailSettings, ID, Notification, NotificationRule, NotificationType, RecipientRole, SendWindow } from './types';

const ALL_ROLES: RecipientRole[] = ['participant', 'group_leader', 'facilitator', 'staff', 'leader', 'finance', 'media'];

export const defaultEmailSettings = (): EmailSettings => ({
  masterOff: false, dailyCap: 100, perUserCap: 5, onCap: 'defer',
  windows: [{ days: [0, 1, 2, 3, 4, 6], from: '08:00', to: '22:00' }],
  exceptions: [],
  templates: {
    focus_created_presenter: { subject: 'تكليف بتقديم لقاء: {اسم_اللقاء}', body: 'كُلّفت بتقديم «{اسم_اللقاء}» بتاريخ {الموعد}. التفاصيل: {الرابط}' },
    individual_booked: { subject: 'حجز لقاء فردي', body: 'حُجز لقاء فردي بتاريخ {الموعد}. {الرابط}' },
    approval_submitted: { subject: 'خطة بانتظار المراجعة', body: 'رُفعت خطة: {اسم_اللقاء}. {الرابط}' },
    approval_approved: { subject: 'قرار على خطة', body: 'صدر قرار على {اسم_اللقاء}. {الرابط}' },
    deadline_near: { subject: 'اقترب الموعد النهائي', body: 'يقترب موعد رفع {اسم_اللقاء}: {الموعد}. {الرابط}' },
  },
});

const rule = (type: NotificationType, p: Partial<NotificationRule> = {}): NotificationRule => ({ type, enabled: true, email: false, reminders: [], recipients: [], ...p });
/** الأحداث المبدئية بقيم افتراضية معقولة */
export const defaultNotifyRules = (): NotificationRule[] => [
  rule('focus_created_presenter', { email: true, recipients: ['participant', 'group_leader'] }),
  rule('focus_published', { email: true, reminders: [24, 1] }),
  rule('individual_booked', { email: true, reminders: [24], recipients: ['facilitator', 'participant'] }),
  rule('approval_submitted', { email: true, recipients: ['facilitator', 'leader'] }),
  rule('approval_approved', { email: true }),
  rule('approval_rejected', { email: true }),
  rule('deadline_near', { email: true, reminders: [72, 24] }),
  rule('task_assigned', { email: false }),
  rule('custody_issued', { email: true, recipients: ['group_leader', 'facilitator', 'staff'] }),
  rule('budget_request', { email: true, recipients: ['finance', 'leader'] }),
  rule('groups_published', { email: true }),
];

export function ruleFor(db: DB, type: NotificationType): NotificationRule | undefined {
  return db.settings.notifyRules?.find((r) => r.type === type);
}

/** أدوار المستلم: لتصفية من يصله بالبريد */
export function recipientRoles(db: DB, pid: ID): RecipientRole[] {
  const p = db.persons.find((x) => x.id === pid);
  const out: RecipientRole[] = [];
  if (p?.kind === 'participant') out.push('participant');
  if (db.groups.some((g) => g.leaderId === pid)) out.push('group_leader');
  if (db.groups.some((g) => g.facilitatorId === pid)) out.push('facilitator');
  if (p?.kind === 'staff') out.push('staff');
  if (p?.isGeneralLeader || p?.isAssistant) out.push('leader');
  const kinds = db.memberships.filter((m) => m.personId === pid).map((m) => db.committees.find((c) => c.id === m.committeeId)?.kind);
  if (kinds.includes('finance')) out.push('finance');
  if (kinds.includes('media')) out.push('media');
  return out;
}

const dayKey = (iso: string) => iso.slice(0, 10);
function windowAllows(e: EmailSettings, when: Date): boolean {
  const date = when.toISOString().slice(0, 10);
  const ex = e.exceptions.find((x) => x.date === date);
  if (ex) return !ex.closed;
  const hm = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  return e.windows.some((w: SendWindow) => w.days.includes(when.getDay()) && hm >= w.from && hm <= w.to);
}

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([^}]+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** يُستدعى لكل إشعار داخلي جديد: يقرر حالة بريده ويسجّله. يعيد false إن كان الحدث معطّلاً كلياً */
export function queueEmail(d: DB, n: Notification, now: Date = new Date()): boolean {
  const r = ruleFor(d, n.type);
  if (!r) return true; // حدث بلا قاعدة: إشعار داخلي فقط
  if (!r.enabled) return false;
  if (!r.email) return true;
  const tpl = d.settings.email.templates[n.type];
  const subject = tpl ? fillTemplate(tpl.subject, { اسم_اللقاء: n.title, الموعد: '', الرابط: n.link ?? '' }) : n.title;
  const entry = (status: EmailLogEntry['status'], reason?: string): EmailLogEntry => ({ id: `em_${n.id}`, at: now.toISOString(), toId: n.toId, type: n.type, subject, status, reason });
  const e = d.settings.email;
  const roles = recipientRoles(d, n.toId);
  if (r.recipients.length && !r.recipients.some((x) => roles.includes(x))) { d.emailLog.unshift(entry('disabled', 'دوره ليس ضمن مستلمي هذا الحدث')); return true; }
  if (e.masterOff) { d.emailLog.unshift(entry('disabled', 'إيقاف كل البريد')); return true; }
  const today = dayKey(now.toISOString());
  const sent = d.emailLog.filter((x) => x.status === 'sent' && !x.test && dayKey(x.at) === today);
  if (sent.length >= e.dailyCap || sent.filter((x) => x.toId === n.toId).length >= e.perUserCap) {
    d.emailLog.unshift(e.onCap === 'defer' ? entry('deferred', 'بلغ سقف اليوم: يُؤجَّل للنافذة التالية') : entry('skipped', 'بلغ سقف اليوم'));
    return true;
  }
  if (!windowAllows(e, now)) { d.emailLog.unshift(entry('deferred', 'خارج نافذة الإرسال')); return true; }
  d.emailLog.unshift(entry('sent'));
  return true;
}
export { ALL_ROLES, dateTime };
