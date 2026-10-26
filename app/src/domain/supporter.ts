// رابط الداعم والموقع العام (وثيقة القرارات: الداعم والموقع العام).
// رابط واحد ثابت يفتح بكلمة مرور لكل جهة، مع حد للمحاولات الخاطئة، وحالات الرحلة الثلاث.
import { hashPassword } from './crypto';
import { now } from './dates';
import { groupsPublished } from './permissions';
import { actualItems, docFor, isTripClosed, tripHasEnded, tripHasStarted } from './workflow';
import type { DB, ID, SupporterEntity, Trip } from './types';

export type SupporterAuth = { entity: SupporterEntity } | { error: string; locked?: boolean };

export function supporterLocked(db: DB): string | null {
  const until = db.supporterAccess.lockedUntil;
  if (until && new Date(until) > now()) return `محاولات كثيرة خاطئة. أعد المحاولة بعد ${Math.ceil((new Date(until).getTime() - now().getTime()) / 60000)} دقيقة`;
  return null;
}

/** كلمة المرور تحدد الجهة. الجهة المعطّلة لا تدخل دون المساس بغيرها */
export function findSupporterByPassword(db: DB, password: string): SupporterEntity | undefined {
  return db.supporters.find((s) => hashPassword(password, s.salt) === s.passwordHash);
}

/** حالة الرحلة في رابط الداعم: قبل (ضبابية مع قفل)، يوم الرحلة (الجدول الفعلي حياً)، بعد (بعد الإغلاق الكامل واعتماد التقرير) */
export type PublicTripState = 'before' | 'live' | 'awaiting_close' | 'after';
export function publicTripState(db: DB, t: Trip): PublicTripState {
  if (!t.published || !tripHasStarted(t)) return 'before';
  if (!tripHasEnded(t)) return 'live';
  return isTripClosed(db, t) ? 'after' : 'awaiting_close';
}

export function publicTripView(db: DB, t: Trip) {
  const state = publicTripState(db, t);
  const doc = docFor(db, t.id, 'document');
  const brief = doc?.submittedAt ? doc.fields.titles || doc.fields.outline : undefined; // نبذة من الوثيقة بعد الرفع
  const attended = db.attendance.filter((a) => a.eventKind === 'trip' && a.eventId === t.id && a.present).length;
  const executor = t.executor.kind === 'group' ? (groupsPublished(db) ? db.groups.find((g) => g.id === (t.executor as { groupId: ID }).groupId)?.name : undefined) : 'فريق العمل';
  return {
    state, brief, attended, executor,
    actual: state === 'live' ? actualItems(db, t).filter((r) => r.actual) : [],
    report: state === 'after' ? t.closure.publicReport : undefined,
    photos: state === 'after' ? t.closure.photos : [],
    driveLink: state === 'after' ? t.closure.driveLink : undefined,
    tweets: state === 'after' ? t.closure.tweets ?? [] : [],
  };
}

/** الترتيب العام يظهر بعد نشر التشكيل (في المنصة والموقع العام ورابط الداعم) */
export function rankingPublic(db: DB) {
  return groupsPublished(db);
}
