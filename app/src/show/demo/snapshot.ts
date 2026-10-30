// لقطة بيانات الديمو: نسخة من بيانات المنصة الفعلية في هذا المتصفح، تُلتقط من المحرّر للقراءة فقط
// وتُحفظ بمفتاح مستقل (show-demo-snapshot) بجانب show-config لا بداخله. تنتقل مع ملف العرض الكامل،
// ولا تدخل أبداً في show.json ولا في تصدير JSON ولا في Firebase (المستودع علني).
import { buildSeed, DB_VERSION } from '@/data/seed';
import type { DB } from '@/domain/types';

export const SNAPSHOT_KEY = 'show-demo-snapshot';
export const SNAPSHOT_FORMAT = 'saql-demo-snapshot';
/** مفتاح بيانات المنصة نفسه في src/data/db.ts: يُقرأ فقط */
export const PLATFORM_DB_KEY = 'saql.db.v' + DB_VERSION;

export interface DemoSnapshot {
  format: typeof SNAPSHOT_FORMAT;
  /** نسخة بيانات المنصة وقت الالتقاط: إن تغيّرت النسخة لا تُستخدم اللقطة */
  dbVersion: number;
  capturedAt: string;
  /** platform: من بيانات المنصة المحفوظة في المتصفح، default: المتصفح لم يحفظ بيانات فالتُقطت البيانات الافتراضية */
  origin: 'platform' | 'default';
  /** المشارك الذي يُعرض الديمو بمنظوره */
  participantId: string;
  db: DB;
}

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const local = (): KV | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * يحذف ما لا تعرضه شاشات الديمو الأربع بصفة مشارك: وسائل التواصل والبيانات البنكية وحسابات الدخول،
 * والمالية والسجلات والملاحظات الخاصة والرسائل. ملف العرض يتنقّل بين الأجهزة، فلا يحمل إلا ما يُعرض.
 */
export function sanitizeForDemo(src: DB): DB {
  const db: DB = JSON.parse(JSON.stringify(src));
  db.persons = db.persons.map(({ phone: _p, bank: _b, ...p }) => ({ ...p, email: '' }));
  db.accounts = [];
  db.tempGrants = [];
  db.audit = [];
  db.notifications = [];
  db.adminMessages = [];
  db.facilitatorNotes = [];
  db.leaderEvaluations = [];
  db.editRequests = [];
  db.memberRequests = [];
  db.wallet = [];
  db.custodies = [];
  db.spendForms = [];
  db.directSpends = [];
  db.contracts = [];
  db.fees = [];
  db.budgetRequests = [];
  db.supporters = [];
  db.supporterAccess = { failed: 0 };
  return db;
}

/** بيانات المنصة كما تعرضها في هذا المتصفح، بلا أي كتابة (loadDB في المنصة يحفظ البيانات الافتراضية، وهنا لا) */
export function readPlatformDB(store: KV | null = local()): { db: DB; origin: DemoSnapshot['origin'] } {
  try {
    const raw = store?.getItem(PLATFORM_DB_KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db?.version === DB_VERSION && Array.isArray(db.persons)) return { db, origin: 'platform' };
    }
  } catch {
    /* تالفة: كما تفعل المنصة، تُعرض البيانات الافتراضية */
  }
  return { db: buildSeed(), origin: 'default' };
}

export const participantsOf = (db: DB) => db.persons.filter((p) => p.kind === 'participant' && db.groups.some((g) => g.memberIds?.includes(p.id)));

export function summarize(db: DB) {
  return { participants: db.persons.filter((p) => p.kind === 'participant').length, groups: db.groups.length, trips: db.trips.length };
}

/** يلتقط اللقطة. preferred: المشارك المختار سابقاً، يبقى إن كان ما زال موجوداً */
export function captureSnapshot(preferred?: string, store: KV | null = local(), now = new Date()): DemoSnapshot {
  const { db, origin } = readPlatformDB(store);
  const clean = sanitizeForDemo(db);
  const people = participantsOf(clean);
  if (!people.length) throw new Error('لا يوجد في بيانات المنصة مشارك ضمن مجموعة');
  const participantId = people.some((p) => p.id === preferred) ? preferred! : people[0].id;
  return { format: SNAPSHOT_FORMAT, dbVersion: DB_VERSION, capturedAt: now.toISOString(), origin, participantId, db: clean };
}

/** يتحقق من لقطة (مخزّنة أو مستوردة). null إن لم تكن لقطة صالحة لهذه النسخة من المنصة */
export function parseSnapshot(raw: unknown): DemoSnapshot | null {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!isObj(v) || v.format !== SNAPSHOT_FORMAT || !isObj(v.db) || !Array.isArray(v.db.persons)) return null;
    if (v.dbVersion !== DB_VERSION || v.db.version !== DB_VERSION) return null;
    if (typeof v.participantId !== 'string' || !participantsOf(v.db as DB).some((p) => p.id === v.participantId)) return null;
    return { format: SNAPSHOT_FORMAT, dbVersion: v.dbVersion, capturedAt: String(v.capturedAt ?? ''), origin: v.origin === 'platform' ? 'platform' : 'default', participantId: v.participantId, db: v.db as DB };
  } catch {
    return null;
  }
}

export type SnapshotStatus = { state: 'ok'; snapshot: DemoSnapshot } | { state: 'none' } | { state: 'stale'; capturedAt: string };

/** حالة اللقطة المحفوظة: موجودة، أو غير موجودة، أو من نسخة بيانات أقدم (تحتاج إعادة التقاط) */
export function loadSnapshotStatus(store: KV | null = local()): SnapshotStatus {
  let raw: string | null = null;
  try {
    raw = store?.getItem(SNAPSHOT_KEY) ?? null;
  } catch {
    /* التخزين غير متاح */
  }
  if (!raw) return { state: 'none' };
  const s = parseSnapshot(raw);
  if (s) return { state: 'ok', snapshot: s };
  let capturedAt = '';
  try {
    capturedAt = String(JSON.parse(raw)?.capturedAt ?? '');
  } catch {
    /* تالفة */
  }
  return { state: 'stale', capturedAt };
}

export const loadSnapshot = (store: KV | null = local()) => {
  const s = loadSnapshotStatus(store);
  return s.state === 'ok' ? s.snapshot : null;
};

export function saveSnapshot(s: DemoSnapshot, store: KV | null = local()) {
  // يرمي إن امتلأت المساحة: المحرّر يعرض الخطأ بدل أن يظن المستخدم أنها حُفظت
  store?.setItem(SNAPSHOT_KEY, JSON.stringify(s));
}

export function clearSnapshot(store: KV | null = local()) {
  try {
    store?.removeItem(SNAPSHOT_KEY);
  } catch {
    /* تجاهل */
  }
}

/** حدث في نفس النافذة بعد حفظ اللقطة أو حذفها (حدث storage يصل النوافذ الأخرى فقط) */
export const SNAPSHOT_EVENT = 'show-demo-snapshot-changed';
export const notifySnapshotChanged = () => typeof window !== 'undefined' && window.dispatchEvent(new Event(SNAPSHOT_EVENT));
