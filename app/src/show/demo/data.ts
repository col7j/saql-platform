// بيانات الديمو: لقطة ثابتة من البيانات التجريبية، والمتجر في وضع القراءة فقط داخل إطار الديمو.
import { buildSeed } from '@/data/seed';
import { todayISO } from '@/domain/dates';
import type { DB, Trip } from '@/domain/types';
import { useStore } from '@/state/store';

let snapshot: DB | null = null;
/** لقطة واحدة تُبنى مرة في الذاكرة ولا تُحفظ في أي مخزن */
export function demoSnapshot(): DB {
  return (snapshot ??= buildSeed());
}

export const demoUserId = (db: DB) => (db.persons.find((p) => p.isGeneralLeader) ?? db.persons[0]).id;

const filled = (db: DB, t: Trip) =>
  (t.schedule.plans[0]?.items.length ?? 0) > 0 &&
  (t.schedule.plans[1]?.items.length ?? 0) > 0 &&
  db.docs.some((d) => d.tripId === t.id && d.kind === 'document') &&
  db.budgetRequests.some((r) => r.ownerKind === 'trip' && r.ownerId === t.id);

/** الرحلة المعروضة: المحددة إن وُجدت، وإلا أول رحلة مكتملة (وثيقة وخطتان وميزانية).
 *  القادمة أولى لأنها تظهر في تبويب «القادمة والجارية» الافتراضي في قائمة الرحلات، ثم الخارجية */
export function pickDemoTrip(db: DB, preferred?: string): Trip | undefined {
  const byId = db.trips.find((t) => t.id === preferred);
  if (byId) return byId;
  const today = todayISO();
  const ok = db.trips.filter((t) => filled(db, t)).sort((a, b) => Number(b.endDate >= today) - Number(a.endDate >= today) || Number(b.type === 'external') - Number(a.type === 'external'));
  return ok[0] ?? db.trips[0];
}

/** الشاشات التي يعرضها إطار الديمو، ورسالة جاهزيته للنافذة الأم */
export type DemoViewKey = 'list' | 'trip' | 'docs' | 'schedule' | 'budget' | 'plans';
export const DEMO_READY = 'saql-demo-ready';

const noop = () => undefined;
let readOnly = false;

/** يحوّل متجر المنصة في هذه النافذة إلى قراءة فقط فوق اللقطة الثابتة: أي تعديل من الشاشات يُهمل */
export function enterReadOnly() {
  if (readOnly) return;
  readOnly = true;
  const db = demoSnapshot();
  useStore.setState({ db, userId: demoUserId(db), commit: noop, setUser: noop, reset: noop, toast: noop });
}
