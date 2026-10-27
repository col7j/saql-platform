// قفل إعدادات التقييم وملكية الإعدادات (وثيقة القرارات + إجابة س4)
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '@/domain/dates';
import { harness } from './helpers/harness';

describe('قفل إعدادات التقييم', () => {
  it('البيانات التجريبية مقفلة، ولا يعدّلها القائد العام وهي مقفلة', () => {
    const h = harness('p_lead');
    expect(h.db.settings.evaluationLock.locked).toBe(true);
    expect(() => h.repos.settings.saveEvaluation({ deadlineFinalCredit: 0.3 })).toThrow(/مقفلة/);
    expect(() => h.repos.settings.update({ deadlineFinalCredit: 0.3 })).toThrow(/تُقفل/);
  });
  it('مسؤول التقنية وحده يفتح القفل، والحفظ يعيد القفل', () => {
    const h = harness('p_lead');
    expect(() => h.repos.settings.unlockEvaluation('تصحيح')).toThrow(/مسؤول اللجنة التقنية/);
    h.as('s6');
    expect(() => h.repos.settings.unlockEvaluation(' ')).toThrow(/سبب/);
    h.repos.settings.unlockEvaluation('تصحيح وزن الحضور');
    expect(h.db.settings.evaluationLock.locked).toBe(false);
    h.as('p_lead');
    h.repos.settings.saveEvaluation({ attendanceWeights: { focus: 50, trip: 30, tripSession: 20 } });
    expect(h.db.settings.attendanceWeights.focus).toBe(50);
    expect(h.db.settings.evaluationLock).toMatchObject({ locked: true, by: 'p_lead' });
    expect(h.db.audit.filter((a) => a.area === 'settings').map((a) => a.action)).toEqual(['حفظ إعدادات التقييم وقفلها', 'فتح قفل إعدادات التقييم']);
  });
  it('غير القائد العام ومسؤول التقنية لا يحفظ التقييم ولو كان مفتوحاً', () => {
    const h = harness('s6');
    h.repos.settings.unlockEvaluation('اختبار');
    h.as('s1');
    expect(() => h.repos.settings.saveEvaluation({ deadlineFinalCredit: 0.2 })).toThrow(/القائد العام/);
  });
});

describe('ملكية بقية الإعدادات', () => {
  it('تصنيفات الجدول للقائد العام أو المفوَّض', () => {
    const h = harness('s2');
    const cats = h.db.settings.scheduleCategories;
    expect(() => h.repos.settings.update({ scheduleCategories: cats })).toThrow(/يفوّضه/);
    h.as('p_lead');
    h.repos.grants.grant('s2', 'manage_schedule_categories', addDays(todayISO(), 3));
    h.as('s2');
    h.repos.settings.update({ scheduleCategories: [...cats, { id: 'x', name: 'جديد', color: '#000000', requiresPrep: true }] });
    expect(h.db.settings.scheduleCategories.find((c) => c.id === 'x')?.requiresPrep).toBe(true);
  });
  it('إعدادات الإشعارات لمسؤول التقنية، والموقع لمن فُوّض', () => {
    const h = harness('p_lead');
    expect(() => h.repos.settings.update({ importantNotifications: [] })).toThrow(/مسؤول اللجنة التقنية/);
    h.as('s6');
    h.repos.settings.update({ importantNotifications: [] });
    h.repos.settings.update({ site: h.db.settings.site }); // مفوّض بالموقع في البيانات التجريبية
    expect(() => h.repos.settings.update({ showHijri: false })).toThrow(/للقائد العام/);
  });
});
