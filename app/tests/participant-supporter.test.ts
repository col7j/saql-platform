// المرحلة 4: المشارك (أول دخول، الاستبيانات العامة، الملف الختامي، فتح الخطة)، ورابط الداعم والموقع العام
import { describe, expect, it } from 'vitest';
import { addDays, nowISO } from '@/domain/dates';
import { sha256Hex } from '@/domain/crypto';
import { publicTripState, rankingPublic } from '@/domain/supporter';
import { isPlanUnlocked } from '@/domain/workflow';
import type { Attachment, Survey } from '@/domain/types';
import { harness } from './helpers/harness';

const att = (n: string): Attachment => ({ name: n, type: 'image/jpeg', size: 10, hash: sha256Hex(n) });

describe('أول دخول للمشارك', () => {
  it('لا يكتمل الملف بلا صورة وآيبان صحيح', () => {
    const h = harness('u24');
    expect(h.db.persons.find((p) => p.id === 'u24')!.profileCompletedAt).toBeUndefined();
    expect(() => h.repos.profile.saveOwn({ bank: { iban: 'SA12' } }, true)).toThrow(/آيبان/);
    expect(() => h.repos.profile.saveOwn({ bank: { iban: 'SA0380000000608010167519' } }, true)).toThrow(/صورتك/);
    h.repos.profile.saveOwn({ photo: att('me'), bank: { iban: 'SA03 8000 0000 6080 1016 7519' } }, true);
    expect(h.db.persons.find((p) => p.id === 'u24')).toMatchObject({ bank: { iban: 'SA0380000000608010167519' } });
    expect(h.db.persons.find((p) => p.id === 'u24')!.profileCompletedAt).toBeTruthy();
  });
});

describe('الاستبيانات العامة', () => {
  it('العام البعدي لا يُنشأ قبل تسجيل استبيان آخر رحلة خارجية', () => {
    const h = harness('p_lead');
    const post: Survey = { id: 'sv_post', title: 'العام البعدي', context: { kind: 'program' }, phase: 'post', mandatory: true, questions: [], opensAt: nowISO(), responses: [], createdBy: 'p_lead' };
    expect(() => h.repos.surveys.save(post)).toThrow(/آخر رحلة خارجية/);
    const last = [...h.db.trips].filter((t) => t.type === 'external').sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    h.repos.surveys.save({ ...post, id: 'sv_last', title: 'استبيان الرحلة', context: { kind: 'trip', id: last.id }, phase: 'pre' });
    h.repos.surveys.save(post);
    expect(h.db.surveys.some((s) => s.id === 'sv_post')).toBe(true);
  });
});

describe('الملف الختامي وفتح الخطة', () => {
  it('يرفعه ميسّر المجموعة فقط', () => {
    const h = harness('s2');
    expect(() => h.repos.finalFiles.upload('u2', 'نصيحة', att('f'))).toThrow(/ميسّر المجموعة/);
    h.as('s1');
    h.repos.finalFiles.upload('u2', 'استمر في القراءة', att('f'));
    expect(h.db.finalFiles.find((f) => f.participantId === 'u2')?.advice).toBe('استمر في القراءة');
  });
  it('تُفتح الخطة ببند الجدول أو التوقيت الذي يحدده مخطط الرحلة', () => {
    const h = harness('s3'); // قائد فريق لقاء الخطة الشخصية
    expect(isPlanUnlocked(h.db, 'u6')).toBe(true); // البند في الماضي
    h.repos.trips.setPlanUnlock('t2', { mode: 'time', at: addDays(nowISO().slice(0, 10), 5) + 'T10:00:00.000Z' });
    expect(isPlanUnlocked(h.db, 'u6')).toBe(false);
    h.as('s2');
    expect(() => h.repos.trips.setPlanUnlock('t2', undefined)).toThrow(/يخطط الرحلة/);
  });
});

describe('رابط الداعم', () => {
  it('كلمة مرور لكل جهة، والمعطّلة لا تدخل، وحد للمحاولات ثم قفل', () => {
    const h = harness('p_lead');
    expect(h.repos.supporters.login('albir2026')).toBe('sp1');
    expect(h.repos.supporters.login('athar2026')).toBeNull(); // جهة معطّلة (تُحسب محاولة خاطئة)
    const max = h.db.settings.supporterLink.maxAttempts;
    for (let i = 2; i < max; i++) h.repos.supporters.login('خطأ');
    expect(h.db.supporterAccess.lockedUntil).toBeUndefined();
    h.repos.supporters.login('خطأ');
    expect(h.db.supporterAccess.lockedUntil).toBeTruthy();
    expect(() => h.repos.supporters.login('albir2026')).toThrow(/محاولات كثيرة/);
  });
  it('الكلمات مخزّنة مشفّرة، والقائد العام وحده يديرها', () => {
    const h = harness('s6');
    expect(h.db.supporters.every((s) => !JSON.stringify(s).includes('albir2026'))).toBe(true);
    expect(() => h.repos.supporters.setPassword('sp1', 'x')).toThrow(/للقائد العام/);
  });
  it('التعليق لا يظهر إلا بعد الموافقة', () => {
    const h = harness('p_lead');
    h.repos.supporters.comment('sp1', '', 'بارك الله فيكم');
    const c = h.db.trackingComments[h.db.trackingComments.length - 1];
    expect(c.status).toBe('pending');
    h.repos.settings.moderateTrackingComment(c.id, 'visible');
    expect(h.db.trackingComments.find((x) => x.id === c.id)!.status).toBe('visible');
  });
  it('حالات الرحلة: قبل، يوم الرحلة، وبعد الإغلاق الكامل واعتماد التقرير', () => {
    const h = harness('p_lead');
    const t = (id: string) => h.db.trips.find((x) => x.id === id)!;
    expect(publicTripState(h.db, t('t5'))).toBe('before');
    expect(publicTripState(h.db, t('t4'))).toBe('live');
    expect(['after', 'awaiting_close']).toContain(publicTripState(h.db, t('t3')));
    expect(publicTripState(h.db, t('t2'))).toBe('awaiting_close'); // التقرير لم يُعتمد بعد
  });
  it('الترتيب العام بعد نشر التشكيل فقط', () => {
    const h = harness('p_lead');
    expect(rankingPublic(h.db)).toBe(true);
    h.db.formation = { status: 'draft' };
    expect(rankingPublic(h.db)).toBe(false);
  });
});

describe('الموقع العام', () => {
  it('أقسام بقوالب يعدّلها القائد العام أو المفوَّض فقط', () => {
    const h = harness('s2');
    const site = h.db.settings.site;
    expect(() => h.repos.settings.update({ site: { ...site, sections: [] } })).toThrow(/يفوّضه/);
    h.as('s6'); // مفوّض مؤقتاً في البيانات التجريبية
    h.repos.settings.update({ site: { ...site, sections: site.sections.map((s) => (s.id === 'sec_faq' ? { ...s, hidden: true } : s)) } });
    expect(h.db.settings.site.sections.find((s) => s.id === 'sec_faq')!.hidden).toBe(true);
    expect(h.db.settings.site.sections.map((s) => s.type)).toEqual(expect.arrayContaining(['text', 'table', 'people']));
  });
});
