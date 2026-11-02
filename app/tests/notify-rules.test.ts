// قواعد الإشعارات للتقنية وحدها: تعطيل حدث، نافذة إرسال، سقف يومي (تأجيل وتخطٍّ)
import { describe, expect, it } from 'vitest';
import { queueEmail } from '@/domain/notifyRules';
import { pushNotification } from '@/data/repositories';
import { harness } from './helpers/harness';
import type { Notification } from '@/domain/types';

const note = (toId: string, type: Notification['type'] = 'approval_approved'): Notification => ({ id: `n_${Math.random()}`, toId, type, title: 'اختبار', at: '', read: false });
const at = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); while (d.getDay() === 5) d.setDate(d.getDate() + 1); return d; }; // ليس الجمعة (خارج النافذة الافتراضية)

describe('إعدادات الإشعارات', () => {
  it('لمسؤول التقنية وحده، ولا يراها القائد ولا المساعد ولا المشرف', () => {
    for (const id of ['p_lead', 's7', 's8', 's1']) expect(() => harness(id).repos.settings.update({ notifyRules: [] }), id).toThrow();
    const h = harness('s6');
    h.repos.settings.update({ notifyRules: h.db.settings.notifyRules.map((r) => (r.type === 'approval_approved' ? { ...r, enabled: false } : r)) });
    expect(h.db.settings.notifyRules.find((r) => r.type === 'approval_approved')!.enabled).toBe(false);
  });
  it('حدث معطّل لا يُنشأ، وداخل النافذة يُرسل، وخارجها يؤجَّل', () => {
    const h = harness('s6');
    const d = structuredClone(h.db);
    pushNotification(d, ['u1'], 'approval_approved', 'x');
    expect(d.emailLog[0]?.status === 'sent' || d.emailLog[0]?.status === 'deferred').toBe(true); // بحسب ساعة التشغيل
    d.emailLog = [];
    expect(queueEmail(d, note('u1'), at(10))).toBe(true);
    expect(d.emailLog[0].status).toBe('sent');
    expect(queueEmail(d, note('u1'), at(3))).toBe(true);
    expect(d.emailLog[0]).toMatchObject({ status: 'deferred', reason: expect.stringMatching(/نافذة/) });
    d.settings.notifyRules = d.settings.notifyRules.map((r) => (r.type === 'approval_approved' ? { ...r, enabled: false } : r));
    expect(queueEmail(d, note('u1'), at(10))).toBe(false);
  });
  it('السقف اليومي: تأجيل (افتراضي) أو تخطٍّ، ومفتاح إيقاف كل البريد', () => {
    const h = harness('s6');
    const d = structuredClone(h.db);
    d.settings.email.perUserCap = 1;
    queueEmail(d, note('u1'), at(10));
    queueEmail(d, note('u1'), at(10));
    expect(d.emailLog[0].status).toBe('deferred');
    d.settings.email.onCap = 'skip';
    queueEmail(d, note('u1'), at(10));
    expect(d.emailLog[0].status).toBe('skipped');
    d.settings.email.masterOff = true;
    queueEmail(d, note('u2'), at(10));
    expect(d.emailLog[0].status).toBe('disabled');
  });
});
