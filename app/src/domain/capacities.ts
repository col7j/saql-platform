// الصفات وقواعد التعارض (وثيقة القرارات: الصفات بلا تعارض).
// الصفات تُشتق من البيانات، والقواعد نفسها مخزّنة في db.capacityRules لا في الكود.
import type { CapacityKey, CapacityRule, CommitteeKind, DB, ID, Trip } from './types';

export const capacityKeyLabel: Record<string, string> = {
  facilitator: 'ميسّر',
  group_leader: 'قائد مجموعة',
  tracker: 'متابع الرحلات الدائم',
  committee_head: 'مسؤول لجنة',
  committee_member: 'عضو لجنة',
  'head:finance': 'مسؤول المالية',
  'head:media': 'مسؤول اللجنة الإعلامية',
  'head:tech': 'مسؤول اللجنة التقنية',
  'head:other': 'مسؤول لجنة أخرى',
  'member:finance': 'عضو اللجنة المالية',
  'member:media': 'عضو اللجنة الإعلامية',
  'member:tech': 'عضو اللجنة التقنية',
  'member:other': 'عضو لجنة أخرى',
  staff_trip_team: 'عضو فريق رحلة لفريق العمل',
  trip_substitute: 'متابع بديل لرحلة',
  trip_facilitator: 'ميسّر المجموعة المنفِّذة للرحلة',
  any: 'أي صفة أخرى',
};

/** صفات لجنة الإدارة العامة لا تُحسب: هي عضوية فريق العمل نفسها */
const IGNORED_COMMITTEES: CommitteeKind[] = ['general'];

/** الصفات الدائمة للشخص كما في البيانات الحالية */
export function capacityKeysOf(db: DB, personId: ID): Set<CapacityKey> {
  const keys = new Set<CapacityKey>();
  if (db.groups.some((g) => g.facilitatorId === personId)) keys.add('facilitator');
  if (db.groups.some((g) => g.leaderId === personId)) keys.add('group_leader');
  if (db.settings.trackerId === personId) keys.add('tracker');
  for (const m of db.memberships.filter((x) => x.personId === personId)) {
    const kind = db.committees.find((c) => c.id === m.committeeId)?.kind;
    if (!kind || IGNORED_COMMITTEES.includes(kind)) continue;
    if (m.role === 'leader') keys.add('committee_head').add(`head:${kind}`);
    else keys.add('committee_member').add(`member:${kind}`);
  }
  if (db.trips.some((t) => t.executor.kind === 'staff' && (t.executor.leaderId === personId || t.executor.memberIds.includes(personId)))) keys.add('staff_trip_team');
  return keys;
}

/** المفاتيح العامة التي يتضمنها المفتاح (head:finance يتضمن committee_head) ولا تُعدّ صفة ثانية */
function impliedBy(key: CapacityKey): CapacityKey[] {
  if (key.startsWith('head:')) return ['committee_head'];
  if (key.startsWith('member:')) return ['committee_member'];
  return [];
}

/** أول قاعدة تخالفها مجموعة الصفات (null = لا تعارض) */
export function violatedRule(rules: CapacityRule[], keys: Set<CapacityKey>): CapacityRule | null {
  for (const r of rules) {
    if (!keys.has(r.a)) continue;
    if (r.b === 'any') {
      const allowed = new Set<CapacityKey>([r.a, ...impliedBy(r.a)]);
      if ([...keys].some((k) => !allowed.has(k))) return r;
    } else if (keys.has(r.b)) return r;
  }
  return null;
}

function isExempt(db: DB, personId: ID) {
  // القائد العام مشرف عام بلا قاعدة جمع صفات
  return !!db.persons.find((p) => p.id === personId)?.isGeneralLeader;
}

/** رسالة التعارض للشخص في البيانات كما هي (تُستدعى بعد تطبيق التغيير على المسودة) */
export function capacityConflict(db: DB, personId: ID): string | null {
  if (isExempt(db, personId)) return null;
  return violatedRule(db.capacityRules, capacityKeysOf(db, personId))?.message ?? null;
}

export function assertNoCapacityConflict(db: DB, personIds: (ID | undefined)[]) {
  for (const id of personIds) {
    if (!id) continue;
    const msg = capacityConflict(db, id);
    if (msg) throw new Error(`${db.persons.find((p) => p.id === id)?.name ?? ''}: ${msg}`);
  }
}

/** هل يصلح الشخص متابعاً بديلاً لهذه الرحلة؟ (يُضاف له مؤقتاً trip_substitute وما يربطه بالرحلة) */
export function substituteConflict(db: DB, candidateId: ID, trip: Trip): string | null {
  if (isExempt(db, candidateId)) return null;
  const keys = capacityKeysOf(db, candidateId);
  keys.add('trip_substitute');
  if (trip.executor.kind === 'group') {
    const groupId = trip.executor.groupId;
    if (db.groups.find((g) => g.id === groupId)?.facilitatorId === candidateId) keys.add('trip_facilitator');
  }
  return violatedRule(db.capacityRules, keys)?.message ?? null;
}
