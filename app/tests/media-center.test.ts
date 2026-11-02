// سيناريوهات القبول: المركز الإعلامي (1 إلى 11) والفواتير الإضافية
import { describe, expect, it } from 'vitest';
import { ACCESS_DENIED, navFor, routeAccess } from '@/domain/access';
import { custodyCloseChecks, custodyFigures, analysisLines, spentLines } from '@/domain/ledger';
import {
  briefMetrics, findLinkByToken, freezeBrief, latestSnapshot, linkState, mediaTodos, pendingChanges, publicContent, shortContent, visibleExtraInvoices,
} from '@/domain/media';
import { MEDIA_DEMO_TOKENS } from '@/data/seed-media';
import type { Attachment, BriefContent } from '@/domain/types';
import { sha256Hex } from '@/domain/crypto';
import { harness } from './helpers/harness';

const att = (n: string): Attachment => ({ name: n, type: 'image/jpeg', size: 9, hash: sha256Hex(n) });
const newEventBrief = (h: ReturnType<typeof harness>, ref = { kind: 'trip' as const, id: 't4' }, templateId = 'mt_internal_trip') =>
  h.repos.media.createBrief({ templateId, scope: { kind: 'event', ref } });
const brief = (h: ReturnType<typeof harness>, id: string) => h.db.mediaBriefs.find((b) => b.id === id)!;

describe('1. الصلاحيات', () => {
  it('عضو من خارج اللجنة الإعلامية لا يرى المركز: لا قائمة ولا عنوان ولا بيانات', () => {
    const h = harness('s1');
    expect(routeAccess(h.db, 's1', '/app/media')).toBe(false);
    expect(routeAccess(h.db, 's1', '/app/media/briefs/mb_t3')).toBe(false);
    expect(navFor(h.db, 's1').all.some((i) => i.key === 'media')).toBe(false);
    expect(() => newEventBrief(h)).toThrow(ACCESS_DENIED);
    expect(() => h.repos.media.createLink('mb_t3', 'read')).toThrow(ACCESS_DENIED);
    ['s5', 'u2'].forEach((id) => expect(routeAccess(h.db, id, '/app/media'), id).toBe(false));
  });
  it('رئيس اللجنة والقائد العام يدخلان، وعضو بصلاحية واحدة يرى ما منحه فقط', () => {
    const h = harness('s6');
    expect(routeAccess(h.db, 's6', '/app/media/links')).toBe(true);
    expect(routeAccess(h.db, 'p_lead', '/app/media/metrics')).toBe(true);
    // u9 عضو بصلاحية «تحرير» فقط
    expect(routeAccess(h.db, 'u9', '/app/media/templates')).toBe(true);
    expect(routeAccess(h.db, 'u9', '/app/media/links')).toBe(false);
    expect(routeAccess(h.db, 'u9', '/app/media/metrics')).toBe(false);
    h.as('u9');
    expect(() => h.repos.media.createLink('mb_t3', 'read')).toThrow(/الاعتماد والمشاركة/);
  });
  it('القائد العام يمنح الصلاحيات ويسحبها، وعضو بلا صلاحية يخرج من المركز', () => {
    const h = harness('p_lead');
    h.repos.media.setPermission('u9', 'edit', false);
    expect(routeAccess(h.db, 'u9', '/app/media')).toBe(false);
    h.repos.media.setPermission('u9', 'metrics', true);
    expect(routeAccess(h.db, 'u9', '/app/media/metrics')).toBe(true);
    h.as('s6');
    expect(() => h.repos.media.setPermission('u9', 'edit', true)).toThrow(/القائد العام/);
  });
});

describe('2. إنشاء موجز لقاء', () => {
  it('القالب يملأ الأقسام ويُنسخ، وجدول الفعالية يُسحب حياً دون نسخ', () => {
    const h = harness('s6');
    const id = newEventBrief(h);
    const b = brief(h, id);
    expect(b.status).toBe('draft');
    expect(b.templateName).toBe('رحلة داخلية');
    expect(b.content.sections.find((s) => s.key === 'goals')!.body).toContain('التجربة القيادية');
    expect(b.content.events[0].shots.length).toBeGreaterThan(3);
    expect(b.content.deliverables.length).toBe(3);
    // الجدول لا يُخزَّن في المسودة، يُقرأ من الرحلة
    expect(JSON.stringify(b.content)).not.toContain('schedule":[{');
    const frozen = freezeBrief(h.db, b);
    expect(frozen.events[0].schedule.length).toBe(h.db.trips.find((t) => t.id === 't4')!.schedule.plans[0].items.length);
    expect(frozen.events[0].schedule.length).toBeGreaterThan(0);
  });
  it('اللقطات: الضرورية والمهمة مطلوبة والإضافية اختيارية افتراضياً', () => {
    const h = harness('s6');
    const b = brief(h, newEventBrief(h));
    b.content.events[0].shots.forEach((s) => expect(s.required).toBe(s.priority !== 'extra'));
  });
});

describe('3 و4. الإخفاء والقسم المخصص والاعتماد والرابط', () => {
  const setup = () => {
    const h = harness('s6');
    const id = newEventBrief(h);
    const c: BriefContent = structuredClone(brief(h, id).content);
    c.sections = c.sections.map((s) => (s.key === 'visual' ? { ...s, visible: false } : s));
    c.sections.push({ key: 'custom_x', title: 'تعليمات السكن', visible: true, body: 'الفريق يسكن في فندق قريب', custom: true });
    c.contacts = [{ id: 'c1', name: 'مصرّح به', role: 'منسق', phone: '0555000001', authorized: true }, { id: 'c2', name: 'جهة داخلية سرية', role: 'داخلي', phone: '0555000002', authorized: false }];
    h.repos.media.updateBrief(id, { content: c, internalNotes: 'ملاحظة داخلية لا تخرج' });
    return { h, id };
  };
  it('الإخفاء والقسم المخصص ينعكسان في المعاينة والـPDF (النسختين)', () => {
    const { h, id } = setup();
    const preview = publicContent(freezeBrief(h.db, brief(h, id)));
    expect(preview.sections.some((s) => s.key === 'visual')).toBe(false);
    expect(preview.sections.some((s) => s.key === 'custom_x')).toBe(true);
    const short = shortContent(freezeBrief(h.db, brief(h, id)));
    expect(short.sections.map((s) => s.key).sort()).toEqual(['contacts', 'deliverables', 'shots']);
    short.events.forEach((e) => e.shots.forEach((s) => expect(s.priority).toBe('must')));
  });
  it('الاعتماد يصدر الإصدار 1، والرابط لا يعرض المخفي ولا الجهات غير المصرّح بها ولا الملاحظات الداخلية', () => {
    const { h, id } = setup();
    expect(h.repos.media.approve(id)).toBe('approved');
    const b = brief(h, id);
    expect(b.status).toBe('approved');
    expect(latestSnapshot(b).version).toBe(1);
    const { token } = h.repos.media.createLink(id, 'read');
    const link = findLinkByToken(h.db, token)!;
    expect(link.tokenHash).not.toContain(token);
    expect(JSON.stringify(h.db.mediaLinks)).not.toContain(token); // الرمز لا يُخزَّن
    const shown = JSON.stringify(publicContent(latestSnapshot(b).data));
    expect(shown).toContain('تعليمات السكن');
    expect(shown).toContain('مصرّح به');
    expect(shown).not.toContain('جهة داخلية سرية');
    expect(shown).not.toContain('ملاحظة داخلية');
    expect(shown).not.toContain('التوجيهات البصرية');
  });
  it('لا رابط لموجز غير معتمد', () => {
    const { h, id } = setup();
    expect(() => h.repos.media.createLink(id, 'read')).toThrow(/اعتمد الموجز/);
  });
});

describe('5 و6. رابط المتابعة', () => {
  const setup = () => {
    const h = harness('s6');
    const id = newEventBrief(h);
    h.repos.media.approve(id);
    const { token } = h.repos.media.createLink(id, 'track');
    const shot = latestSnapshot(brief(h, id)).data.events[0].shots[0];
    return { h, id, token, shot };
  };
  it('الزائر يؤشّر لقطة «مكتملة» برابط فتظهر في لوحة المسؤول باسمه فوراً', () => {
    const { h, id, token, shot } = setup();
    h.repos.media.publicAct(token, 'سامر المصوّر', shot.id, { status: 'done', addProof: 'https://drive.google.com/drive/folders/abc' });
    const ex = brief(h, id).execution[shot.id];
    expect(ex.status).toBe('done');
    expect(ex.proofs).toEqual(['https://drive.google.com/drive/folders/abc']);
    expect(ex.updatedBy).toBe('سامر المصوّر');
    expect(h.db.mediaActivity[0]).toMatchObject({ actor: 'سامر المصوّر', briefId: id, itemId: shot.id });
    expect(findLinkByToken(h.db, token)!.lastVisitor).toBe('سامر المصوّر');
  });
  it('«متعذرة» لا تُقبل بلا سبب، والرابط غير http/https يُرفض، والاسم إلزامي', () => {
    const { h, token, shot } = setup();
    expect(() => h.repos.media.publicAct(token, 'ريان', shot.id, { status: 'failed' })).toThrow(/سبب/);
    h.repos.media.publicAct(token, 'ريان', shot.id, { status: 'failed', reason: 'الإضاءة لم تسمح' });
    ['javascript:alert(1)', 'ftp://x.com/a', 'drive.google.com/x', 'file:///etc/passwd'].forEach((u) =>
      expect(() => h.repos.media.publicAct(token, 'ريان', shot.id, { addProof: u }), u).toThrow(/http/));
    expect(() => h.repos.media.publicAct(token, '  ', shot.id, { status: 'done' })).toThrow(/اسمك/);
  });
  it('رابط القراءة لا يسمح بأي تحديث، وبند غير موجود في الموجز يُرفض', () => {
    const { h, id, shot } = setup();
    const { token: readTok } = h.repos.media.createLink(id, 'read');
    expect(() => h.repos.media.publicAct(readTok, 'ريان', shot.id, { status: 'done' })).toThrow(/للقراءة فقط/);
    const trackTok = h.repos.media.createLink(id, 'track').token;
    expect(() => h.repos.media.publicAct(trackTok, 'ريان', 'x_غريب', { status: 'done' })).toThrow(/غير موجود/);
  });
});

describe('7. تغيّر جدول الفعالية بعد الاعتماد', () => {
  it('يظهر «تغييرات بانتظار التأكيد» ولا يتغير الرابط، ثم يصدر التأكيد الإصدار 2', () => {
    const h = harness('s6');
    const id = h.repos.media.createBrief({ templateId: 'mt_weekly', scope: { kind: 'event', ref: { kind: 'focus', id: 'f_g1_7' } } });
    h.repos.media.approve(id);
    const { token } = h.repos.media.createLink(id, 'read');
    expect(pendingChanges(h.db, brief(h, id))).toEqual([]);
    const before = JSON.stringify(latestSnapshot(brief(h, id)).data);
    h.as('s1'); // ميسّر المجموعة يغيّر موعد اللقاء
    h.repos.focus.update('f_g1_7', { start: '19:00', end: '20:00', location: 'قاعة جديدة' });
    h.as('s6');
    const ch = pendingChanges(h.db, brief(h, id));
    expect(ch.length).toBeGreaterThanOrEqual(2);
    expect(ch.join(' ')).toContain('قاعة جديدة');
    expect(JSON.stringify(latestSnapshot(brief(h, id)).data)).toBe(before); // ما يراه الفريق لم يتغير
    expect(linkState(findLinkByToken(h.db, token)!)).toBe('active');
    expect(mediaTodos(h.db).some((t) => t.id === `pc_${id}`)).toBe(true);
    h.repos.media.approve(id);
    expect(latestSnapshot(brief(h, id)).version).toBe(2);
    expect(latestSnapshot(brief(h, id)).reason).toBe('schedule_change');
    expect(pendingChanges(h.db, brief(h, id))).toEqual([]);
    expect(latestSnapshot(brief(h, id)).data.events[0].location).toBe('قاعة جديدة');
  });
  it('البيانات التجريبية: الموجز الأسبوعي فيه تغيير معلّق', () => {
    const h = harness('s6');
    expect(pendingChanges(h.db, brief(h, 'mb_week')).length).toBeGreaterThan(0);
  });
});

describe('8. الإلغاء والانتهاء', () => {
  it('الإلغاء يمنع الدخول فوراً، والمنتهي يعرض حالة انتهاء، والمحاولة بعدهما لا تحصى', () => {
    const h = harness('s6');
    const id = newEventBrief(h);
    h.repos.media.approve(id);
    const { id: lid, token } = h.repos.media.createLink(id, 'track', new Date(Date.now() + 86400000).toISOString());
    h.repos.media.publicVisit(token, 'زائر');
    expect(findLinkByToken(h.db, token)!.accessCount).toBe(1);
    const l = findLinkByToken(h.db, token)!;
    expect(linkState(l, new Date(Date.now() + 3 * 86400000))).toBe('expired');
    h.repos.media.revokeLink(lid);
    expect(linkState(findLinkByToken(h.db, token)!)).toBe('revoked');
    h.repos.media.publicVisit(token, 'زائر');
    expect(findLinkByToken(h.db, token)!.accessCount).toBe(1);
    const shot = latestSnapshot(brief(h, id)).data.events[0].shots[0];
    expect(() => h.repos.media.publicAct(token, 'زائر', shot.id, { status: 'done' })).toThrow(/غير صالح/);
  });
  it('رمز مجهول لا يفتح شيئاً', () => {
    const h = harness('s6');
    expect(findLinkByToken(h.db, 'x'.repeat(40))).toBeUndefined();
    expect(findLinkByToken(h.db, MEDIA_DEMO_TOKENS.track)).toBeDefined();
  });
});

describe('9. الموجز الأسبوعي', () => {
  it('فعاليتان بمتطلبات خاصة بكل واحدة، وأقسام مشتركة ومسؤوليات ومواعيد', () => {
    const h = harness('s6');
    const b = brief(h, 'mb_week');
    expect(b.kind).toBe('week');
    expect(b.content.events).toHaveLength(2);
    expect(b.content.events[0].shots.map((s) => s.id)).not.toEqual(b.content.events[1].shots.map((s) => s.id));
    expect(b.content.events[0].notes).not.toBe(b.content.events[1].notes);
    expect(b.content.responsibilities.length).toBeGreaterThan(0);
    expect(b.content.deadlines.length).toBeGreaterThan(0);
    const frozen = latestSnapshot(b).data;
    expect(frozen.events).toHaveLength(2);
    expect(frozen.sections.find((s) => s.key === 'responsibilities')!.visible).toBe(true);
  });
  it('إنشاء أسبوعي جديد من الخطوات: الفعاليات المختارة فقط', () => {
    const h = harness('s6');
    const id = h.repos.media.createBrief({ templateId: 'mt_weekly', scope: { kind: 'week', weekStart: brief(h, 'mb_week').content.weekStart!, refs: [{ kind: 'trip', id: 't5' }] } });
    expect(brief(h, id).content.events).toHaveLength(1);
    expect(() => h.repos.media.createBrief({ templateId: 'mt_weekly', scope: { kind: 'week', weekStart: '2026-01-03', refs: [] } })).toThrow(/فعالية/);
  });
});

describe('10. المؤشرات', () => {
  it('تفرّق بين «لم تُنفَّذ» و«نُفّذت بلا إثبات»، ولا تحتسب الاختيارية', () => {
    const h = harness('s6');
    const b = brief(h, 'mb_t3');
    const m = briefMetrics([b]);
    const shots = latestSnapshot(b).data.events[0].shots;
    expect(shots.some((s) => !s.required)).toBe(true);
    expect(m.shotsRequired).toBe(shots.filter((s) => s.required).length);
    expect(m.shotsDone).toBe(2); // لقطة بإثبات ولقطة بلا إثبات
    expect(m.shotsDocumented).toBe(1);
    expect(m.completionPct).toBe(Math.round((1 / m.shotsRequired) * 100));
    const noProof = m.noProof.map((x) => x.item.id);
    const notExec = m.notExecuted.map((x) => x.item.id);
    expect(noProof).toContain(shots[1].id); // مكتملة بلا رابط
    expect(notExec).toContain(shots[2].id); // متعذرة
    expect(notExec).toContain(shots[3].id); // قيد التنفيذ
    expect(notExec).not.toContain(shots[1].id);
    expect(noProof).not.toContain(shots[0].id);
    // الاختيارية خارج القائمتين
    shots.filter((s) => !s.required).forEach((s) => { expect(notExec).not.toContain(s.id); expect(noProof).not.toContain(s.id); });
    expect(new Set([...noProof, ...notExec]).size).toBe(noProof.length + notExec.length);
  });
  it('الالتزام بالمواعيد والتسليم', () => {
    const h = harness('s6');
    const m = briefMetrics(h.db.mediaBriefs);
    expect(m.deliverablesDelivered).toBeGreaterThanOrEqual(1);
    expect(m.onTimePct).toBeGreaterThan(0);
    expect(m.interviewsDone).toBeGreaterThanOrEqual(1);
  });
});

describe('11. تعديل القالب', () => {
  it('يؤثر على الموجزات الجديدة فقط', () => {
    const h = harness('s6');
    const old = structuredClone(brief(h, 'mb_week').content);
    const tpl = h.db.mediaTemplates.find((t) => t.id === 'mt_weekly')!;
    h.repos.media.saveTemplate({ ...tpl, shots: [{ title: 'لقطة جديدة تماماً', priority: 'must', required: true }] });
    expect(brief(h, 'mb_week').content).toEqual(old);
    const id = h.repos.media.createBrief({ templateId: 'mt_weekly', scope: { kind: 'event', ref: { kind: 'focus', id: 'f_g2_4' } } });
    expect(brief(h, id).content.events[0].shots.map((s) => s.title)).toEqual(['لقطة جديدة تماماً']);
  });
  it('الستة قوالب مزروعة، ولا حذف يمس الموجزات', () => {
    const h = harness('s6');
    expect(h.db.mediaTemplates.map((t) => t.name)).toEqual(['لقاء أسبوعي', 'رحلة داخلية', 'رحلة خارجية', 'حفل', 'ورشة', 'قالب مخصص (فارغ)']);
    h.repos.media.removeTemplate('mt_weekly');
    expect(brief(h, 'mb_week').templateName).toBe('لقاء أسبوعي');
  });
});

describe('الاعتماد بموافقة القائد العام (إعداد معطّل افتراضياً)', () => {
  it('معطّل افتراضياً، وعند تفعيله يتحول اعتماد غير القائد العام لطلب', () => {
    const h = harness('p_lead');
    expect(h.db.settings.media.requireLeaderApproval).toBe(false);
    h.repos.media.saveSettings({ requireLeaderApproval: true });
    h.as('s6');
    const id = newEventBrief(h);
    expect(h.repos.media.approve(id)).toBe('requested');
    expect(brief(h, id).status).toBe('draft');
    expect(brief(h, id).approvalRequest).toBeTruthy();
    expect(h.db.notifications.some((n) => n.toId === 'p_lead' && n.link === '/app/approvals')).toBe(true);
    h.as('p_lead');
    expect(h.repos.media.approve(id)).toBe('approved');
    expect(brief(h, id).approvalRequest).toBeUndefined();
  });
  it('إعدادات المركز للقائد العام وحده وبقيم صالحة', () => {
    const h = harness('s6');
    expect(() => h.repos.media.saveSettings({ weekStartDay: 1 })).toThrow(/للقائد العام/);
    h.as('p_lead');
    expect(() => h.repos.media.saveSettings({ weekStartDay: 9 })).toThrow();
    h.repos.media.saveSettings({ weekStartDay: 0 });
    expect(h.db.settings.media.weekStartDay).toBe(0);
  });
});

describe('الفواتير الإضافية', () => {
  const add = (h: ReturnType<typeof harness>, custodyId = 'cu_t3') => h.repos.media.addExtraInvoice(custodyId, { attachment: att('x.jpg'), amount: 40, date: '2026-10-20', description: 'ماء' });
  it('1. تُضاف لعهدة مغلقة فلا يتغير رصيد العهدة ولا حالتها ولا إغلاقها', () => {
    const h = harness('u1');
    const c0 = h.db.custodies.find((c) => c.id === 'cu_t3')!;
    const figs = JSON.stringify(custodyFigures(h.db, c0));
    const checks = JSON.stringify(custodyCloseChecks(h.db, c0));
    const id = add(h);
    const c1 = h.db.custodies.find((c) => c.id === 'cu_t3')!;
    expect(c1.status).toBe('closed');
    expect(JSON.stringify(custodyFigures(h.db, c1))).toBe(figs);
    expect(JSON.stringify(custodyCloseChecks(h.db, c1))).toBe(checks);
    expect(h.db.extraInvoices.find((x) => x.id === id)).toMatchObject({ ownerKind: 'trip', ownerId: 't3', addedBy: 'u1' });
    expect(h.db.audit[0].action).toBe('إضافة فاتورة إضافية');
  });
  it('الصورة إلزامية، وصاحب العهدة وحده يضيف', () => {
    const h = harness('u1');
    expect(() => h.repos.media.addExtraInvoice('cu_t3', { attachment: undefined as unknown as Attachment, amount: 5, date: '2026-10-20', description: '' })).toThrow(/إلزامي/);
    h.as('s5');
    expect(() => add(h)).toThrow(/صاحب العهدة/);
  });
  it('2. المراجعة بعلامة وملاحظة، وبعدها لا تُعدَّل ولا تُحذف', () => {
    const h = harness('u1');
    const id = add(h);
    h.repos.media.updateExtraInvoice(id, { amount: 45 });
    h.as('s5');
    h.repos.media.reviewExtraInvoice(id, 'تُحفظ');
    expect(h.db.extraInvoices.find((x) => x.id === id)!.review).toMatchObject({ by: 's5', note: 'تُحفظ' });
    h.as('u1');
    expect(() => h.repos.media.removeExtraInvoice(id)).toThrow(/روجعت|مراجعة/);
    expect(() => h.repos.media.updateExtraInvoice(id, { amount: 1 })).toThrow(/مراجعة/);
  });
  it('من لا يملك صلاحية المراجعة، أو صاحب العهدة نفسه، لا يضع علامة', () => {
    const h = harness('u1');
    const id = add(h);
    expect(() => h.repos.media.reviewExtraInvoice(id)).toThrow();
    h.as('s2');
    expect(() => h.repos.media.reviewExtraInvoice(id)).toThrow();
  });
  it('3. في التحليل لا تدخل المصروف إلا إذا فُعّل المفتاح', () => {
    const h = harness('u1');
    add(h);
    const sum = (ls: { amount: number }[]) => Math.round(ls.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const base = sum(spentLines(h.db));
    expect(sum(analysisLines(h.db))).toBe(base);
    expect(sum(analysisLines(h.db, true))).toBeCloseTo(base + h.db.extraInvoices.reduce((s, x) => s + x.amount, 0), 2);
  });
  it('4. لا يراها غير صاحب العهدة واللجنة المالية والقائد العام', () => {
    const h = harness('u1');
    const id = add(h);
    const sees = (pid: string) => visibleExtraInvoices(h.db, pid).some((x) => x.id === id);
    expect(sees('u1')).toBe(true);
    expect(sees('s5')).toBe(true);
    expect(sees('p_lead')).toBe(true);
    expect(sees('s2')).toBe(false); // ميسّر لمجموعة أخرى
    expect(sees('s1')).toBe(false);
    expect(sees('u2')).toBe(false);
  });
});
