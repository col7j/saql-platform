// أول تشغيل (الرئيسي 1.5): أول حساب في المنصة هو مسؤول اللجنة التقنية، وهو الذي ينشئ بعدها القائد العام وبقية الحسابات.
import { hashPassword } from './crypto';
import { passwordError } from './accounts';
import type { DB } from './types';

export const isFirstRun = (db: DB) => db.accounts.length === 0;

export interface SetupInput { programName: string; name: string; email: string; password: string }

/** يُرجع رسالة الخطأ أو null */
export function setupError(db: DB, i: SetupInput): string | null {
  if (!isFirstRun(db)) return 'المنصة معدّة بالفعل';
  if (!i.programName.trim()) return 'اكتب اسم البرنامج';
  if (!i.name.trim()) return 'اكتب اسم مسؤول اللجنة التقنية';
  if (!/^\S+@\S+\.\S+$/.test(i.email.trim())) return 'البريد غير صحيح';
  return passwordError(i.password);
}

/** ينشئ مسؤول اللجنة التقنية كأول حساب، ويعيّن الاسم. يعدّل المسودة الممرَّرة ويعيد معرّف الشخص */
export function applyFirstRun(d: DB, i: SetupInput, at: string): string {
  const err = setupError(d, i);
  if (err) throw new Error(err);
  const id = 's_tech';
  d.settings.program.name = i.programName.trim();
  d.persons.push({ id, kind: 'staff', name: i.name.trim(), email: i.email.trim(), title: 'مسؤول اللجنة التقنية' });
  const tech = d.committees.find((c) => c.kind === 'tech');
  if (tech) d.memberships.push({ id: 'cm_first_tech', committeeId: tech.id, personId: id, role: 'leader', canSeeFinance: false });
  d.accounts.push({ personId: id, username: i.email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'tech', salt: id, passwordHash: hashPassword(i.password, id), mustChangePassword: false, disabled: false, updatedAt: at, updatedBy: id });
  d.audit.unshift({ id: 'au_first', at, byId: id, action: 'إعداد أول مرة', detail: `${i.programName.trim()} — أُنشئ حساب مسؤول اللجنة التقنية`, area: 'accounts' });
  return id;
}
