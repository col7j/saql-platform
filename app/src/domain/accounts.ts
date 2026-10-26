// حسابات الدخول: يديرها مسؤول اللجنة التقنية وحده (اسم الدخول، كلمة المرور، إعادة التعيين، التعطيل).
import { hashPassword } from './crypto';
import type { Account, DB, ID } from './types';

export function techLeadId(db: DB): ID | undefined {
  const cid = db.committees.find((c) => c.kind === 'tech')?.id;
  return db.memberships.find((m) => m.committeeId === cid && m.role === 'leader')?.personId;
}
export function canManageAccounts(db: DB, pid: ID): boolean {
  return techLeadId(db) === pid;
}
export function accountOf(db: DB, personId: ID): Account | undefined {
  return db.accounts.find((a) => a.personId === personId);
}

/** اسم دخول مقترح من البريد */
export function suggestUsername(db: DB, email: string): string {
  const base = (email.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'user';
  let name = base;
  for (let i = 2; db.accounts.some((a) => a.username === name); i++) name = `${base}${i}`;
  return name;
}

export function usernameError(db: DB, personId: ID, username: string): string | null {
  const u = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,32}$/.test(u)) return 'اسم الدخول من 2 إلى 32 حرفاً إنجليزياً أو رقماً (ويُسمح بـ . _ -)';
  if (db.accounts.some((a) => a.username === u && a.personId !== personId)) return 'اسم الدخول مستخدم لشخص آخر';
  return null;
}

export function passwordError(password: string): string | null {
  return password.length < 6 ? 'كلمة المرور 6 أحرف على الأقل' : null;
}

/** التحقق من الدخول: يعيد معرّف الشخص أو رسالة خطأ */
export function authenticate(db: DB, username: string, password: string): { personId: ID; mustChangePassword: boolean } | { error: string } {
  const acc = db.accounts.find((a) => a.username === username.trim().toLowerCase());
  if (!acc || !acc.passwordHash || !acc.salt || hashPassword(password, acc.salt) !== acc.passwordHash) return { error: 'اسم الدخول أو كلمة المرور غير صحيحة' };
  if (acc.disabled) return { error: 'الحساب معطّل. تواصل مع مسؤول اللجنة التقنية' };
  return { personId: acc.personId, mustChangePassword: acc.mustChangePassword };
}
