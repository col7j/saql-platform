// لقطة بيانات الديمو: تُلتقط من بيانات المنصة للقراءة فقط، وتُنقّى، وتنتقل مع ملف العرض الكامل وحده
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import { buildSeed, DB_VERSION } from '@/data/seed';
import { DEFAULT_CONFIG } from '@/show/model';
import { exportConfig } from '@/show/storage';
import { demoData, demoGaps, invalidateDemoData } from '@/show/demo/data';
import { captureSnapshot, loadSnapshotStatus, parseSnapshot, participantsOf, PLATFORM_DB_KEY, sanitizeForDemo, saveSnapshot, SNAPSHOT_KEY, summarize } from '@/show/demo/snapshot';
import { buildBundle, readBundle } from '@/show/transfer/bundle';

/** مخزن يسجّل كل كتابة */
function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  const writes: string[] = [];
  return {
    writes,
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => (writes.push(k), m.set(k, v)),
    removeItem: (k: string) => (writes.push(k), m.delete(k)),
  };
}

/** بيانات منصة «حقيقية»: البيانات التجريبية بعد تعديل اسم وإضافة بيانات خاصة */
function platformDB() {
  const db = buildSeed();
  const p = participantsOf(db)[3];
  p.name = 'اسم معدّل في المنصة';
  p.phone = '0500000000';
  p.bank = { iban: 'SA0000000000000000000000' };
  return { db, renamed: p.id };
}

describe('الالتقاط', () => {
  it('يقرأ بيانات المنصة المحفوظة دون أي كتابة، ويحمل التعديلات', () => {
    const { db, renamed } = platformDB();
    const store = memStore({ [PLATFORM_DB_KEY]: JSON.stringify(db) });
    const s = captureSnapshot(renamed, store);
    expect(store.writes).toEqual([]);
    expect(s.origin).toBe('platform');
    expect(s.dbVersion).toBe(DB_VERSION);
    expect(s.participantId).toBe(renamed);
    expect(s.db.persons.find((p) => p.id === renamed)!.name).toBe('اسم معدّل في المنصة');
    expect(summarize(s.db)).toEqual(summarize(db));
  });

  it('بلا بيانات محفوظة: البيانات الافتراضية كما تعرضها المنصة، ولا يُحفظ شيء في saql.*', () => {
    const store = memStore();
    const s = captureSnapshot(undefined, store);
    expect(s.origin).toBe('default');
    expect(store.writes).toEqual([]);
  });

  it('المشارك المختار يبقى عند إعادة الالتقاط، وإن حُذف من المنصة يُختار أول مشارك', () => {
    const { db } = platformDB();
    const store = memStore({ [PLATFORM_DB_KEY]: JSON.stringify(db) });
    const second = participantsOf(db)[1].id;
    expect(captureSnapshot(second, store).participantId).toBe(second);
    expect(captureSnapshot('محذوف', store).participantId).toBe(participantsOf(db)[0].id);
  });

  it('التنقية: لا جوالات ولا إيميلات ولا بيانات بنكية ولا حسابات ولا مالية ولا سجلات', () => {
    const { db } = platformDB();
    const clean = sanitizeForDemo(db);
    const json = JSON.stringify(clean);
    expect(json).not.toContain('0500000000');
    expect(json).not.toContain('SA0000000000000000000000');
    expect(clean.persons.every((p) => !p.phone && !p.bank && p.email === '')).toBe(true);
    for (const k of ['accounts', 'audit', 'notifications', 'wallet', 'custodies', 'spendForms', 'directSpends', 'contracts', 'fees', 'budgetRequests', 'facilitatorNotes', 'adminMessages'] as const) expect(clean[k]).toEqual([]);
    // الأصل لم يتغير
    expect(db.persons.some((p) => p.phone === '0500000000')).toBe(true);
    // ما تعرضه الشاشات باقٍ
    expect(clean.trips.length).toBe(db.trips.length);
    expect(clean.focusMeetings.length).toBe(db.focusMeetings.length);
    expect(clean.personalPlans.length).toBe(db.personalPlans.length);
  });

  it('لقطة من نسخة بيانات أخرى لا تُستخدم وتُعرض كـ«تحتاج إعادة التقاط»', () => {
    const store = memStore();
    const s = captureSnapshot(undefined, memStore());
    saveSnapshot({ ...s, dbVersion: DB_VERSION - 1 }, store);
    expect(loadSnapshotStatus(store).state).toBe('stale');
    expect(parseSnapshot({ ...s, participantId: 'غير موجود' })).toBeNull();
    saveSnapshot(s, store);
    expect(loadSnapshotStatus(store).state).toBe('ok');
  });
});

describe('الديمو يقرأ اللقطة', () => {
  beforeEach(() => {
    const m = memStore();
    (globalThis as any).localStorage = m;
    invalidateDemoData();
  });

  it('بلا لقطة: البيانات التجريبية (مع الإثراء)', () => {
    const d = demoData();
    expect(d.source).toBe('seed');
    expect(d.db.individualMeetings.some((m) => m.id === 'im_demo')).toBe(true);
  });

  it('مع لقطة: بمنظور المشارك المختار، ولا بيانات مخترعة على الأشخاص الحقيقيين', () => {
    const { db, renamed } = platformDB();
    const s = captureSnapshot(renamed, memStore({ [PLATFORM_DB_KEY]: JSON.stringify(db) }));
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
    invalidateDemoData();
    const d = demoData();
    expect(d.source).toBe('snapshot');
    expect(d.targets.personId).toBe(renamed);
    expect(d.db.individualMeetings.some((m) => m.id === 'im_demo')).toBe(false);
    const f = d.db.focusMeetings.find((x) => x.id === d.targets.focusId);
    const orig = db.focusMeetings.find((x) => x.id === d.targets.focusId);
    expect(f?.presenterEvaluations).toEqual(orig?.presenterEvaluations);
    expect(Array.isArray(demoGaps(d))).toBe(true);
  });

  it('التحذيرات تصف ما سيظهر ناقصاً', () => {
    const db = sanitizeForDemo(buildSeed());
    const pid = participantsOf(db)[0].id;
    db.personalPlans = db.personalPlans.filter((p) => p.participantId !== pid);
    db.focusMeetings = [];
    const gaps = demoGaps({ db, targets: { personId: pid, tripId: 'x', focusId: 'x', day: '' } });
    expect(gaps.join('\n')).toMatch(/لا توجد رحلة/);
    expect(gaps.join('\n')).toMatch(/لقاء تركيز/);
    expect(gaps.join('\n')).toMatch(/الخطة الشخصية/);
  });
});

describe('النقل والمستودع', () => {
  const snap = () => captureSnapshot(undefined, memStore());

  it('ملف العرض الكامل يحمل اللقطة ويعيدها كما هي', async () => {
    const s = snap();
    const back = await readBundle(await buildBundle(DEFAULT_CONFIG, [], [], undefined, s));
    expect(back.snapshot).toEqual(s);
    expect(back.manifest.snapshot?.capturedAt).toBe(s.capturedAt);
    // بلا لقطة: لا ملف ولا وصف
    const none = await readBundle(await buildBundle(DEFAULT_CONFIG, []));
    expect(none.snapshot).toBeNull();
    expect(none.manifest.snapshot).toBeUndefined();
  });

  it('لقطة تالفة في الحزمة تُرفض قبل أي كتابة', async () => {
    const entries = unzipSync(await buildBundle(DEFAULT_CONFIG, [], [], undefined, snap()));
    const broken = entries['demo-snapshot.json'].slice();
    broken[10] ^= 0xff;
    await expect(readBundle(zipSync({ ...entries, 'demo-snapshot.json': broken }))).rejects.toThrow(/تالف في الحزمة: بيانات الديمو/);
  });

  it('لقطة من نسخة بيانات أخرى: يُستورد العرض وتُهمل اللقطة', async () => {
    const back = await readBundle(await buildBundle(DEFAULT_CONFIG, [], [], undefined, { ...snap(), dbVersion: DB_VERSION + 1 }));
    expect(back.snapshot).toBeNull();
    expect(back.manifest.snapshot).toBeTruthy();
  });

  it('تصدير JSON وshow.json في المستودع لا يحملان بيانات المنصة أبداً', () => {
    const s = snap();
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
    const json = exportConfig(DEFAULT_CONFIG);
    for (const out of [json, readFileSync('public/show.json', 'utf8')]) {
      expect(out).not.toContain('"persons"');
      expect(out).not.toContain('saql-demo-snapshot');
      expect(out).not.toContain(s.db.persons[0].name);
    }
  });
});
