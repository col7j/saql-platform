// الخطابات (الرئيسي 5): أي عضو في فريق الرحلة يطلب، ومندوب الجمعية يصدر خارج المنصة ويرفع الملف برقمه وتاريخه.
import { hasLeaderPowers, isReadOnly } from './roles';
import { tripTeamIds, tripTeamLeaderId } from './permissions';
import type { DB, ID, Letter, LetterStatus, Trip } from './types';

export const letterStatusLabel: Record<LetterStatus, string> = {
  submitted: 'مرفوع', preparing: 'قيد الإعداد', issued: 'صدر', delivered: 'مُسلَّم', needs_edit: 'يحتاج تعديلاً',
};
export const letterNext: Record<LetterStatus, string> = {
  submitted: 'ينتظر المندوب', preparing: 'المندوب يعدّ الخطاب', issued: 'يُسلَّم للطالب', delivered: 'اكتمل', needs_edit: 'يعدّل مقدّم الطلب ويعيد الإرسال',
};

export const isDelegate = (db: DB, pid: ID) => db.settings.societyDelegateId === pid;

/** فريق الرحلة: أعضاء المجموعة المنفذة والموزَّعون أو فريق العمل المنفذ */
export function letterTeam(db: DB, trip: Trip): ID[] {
  const lead = tripTeamLeaderId(db, trip);
  return [...new Set([...(lead ? [lead] : []), ...tripTeamIds(db, trip)])];
}
export const canRequestLetter = (db: DB, pid: ID, trip: Trip) => !isReadOnly(db, pid) && letterTeam(db, trip).includes(pid);

/** يراها: مقدّم الطلب وفريق الرحلة والمندوب والقائد العام ومساعده، والمشرف للقراءة */
export function canSeeLetter(db: DB, pid: ID, l: Letter): boolean {
  const trip = db.trips.find((t) => t.id === l.tripId);
  if (!trip) return false;
  return l.requestedBy === pid || isDelegate(db, pid) || hasLeaderPowers(db, pid) || isReadOnly(db, pid) || letterTeam(db, trip).includes(pid);
}
export const lettersFor = (db: DB, pid: ID) => db.letters.filter((l) => canSeeLetter(db, pid, l));

export function lettersCsv(db: DB, list: Letter[]): string {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['الرحلة', 'النوع', 'الجهة', 'الغرض', 'الحاجة قبل', 'الحالة', 'الطالب', 'رقم الخطاب', 'تاريخه']];
  list.forEach((l) => rows.push([
    db.trips.find((t) => t.id === l.tripId)?.title ?? '', db.letterTypes.find((t) => t.id === l.typeId)?.name ?? '', l.addressee, l.purpose, l.neededBy,
    letterStatusLabel[l.status], db.persons.find((p) => p.id === l.requestedBy)?.name ?? '', l.issued?.number ?? '', l.issued?.date ?? '',
  ]));
  return '﻿' + rows.map((r) => r.map(q).join(',')).join('\n');
}

export const defaultLetterTypes = () => [
  ['lt1', 'تسهيل مهمة', 'تتشرف جمعية ... بالتعريف بفريق برنامج صقل المكلّف بـ ... ونأمل تسهيل مهمتهم وفق الأنظمة.'],
  ['lt2', 'حجز سكن', 'نأمل التكرم بالموافقة على حجز ... وحدة سكنية للفترة من ... إلى ... لصالح رحلة ...'],
  ['lt3', 'حجز مواصلات', 'نأمل التكرم بتوفير ... للفترة من ... إلى ... لنقل مشاركي رحلة ...'],
  ['lt4', 'طلب رعاية', 'يسرّنا دعوتكم لرعاية رحلة ... ضمن برنامج صقل، وفق ما يلي: ...'],
  ['lt5', 'شكر', 'تتقدم جمعية ... بخالص الشكر لكم على تعاونكم ودعمكم لرحلة ...'],
  ['lt6', 'خطاب لجهة حكومية', 'تتشرف جمعية ... بالتوجه لكم بطلب ... لأجل رحلة ... ضمن برنامج صقل.'],
  ['lt7', 'أخرى', ''],
].map(([id, name, suggestedText]) => ({ id, name, suggestedText }));
