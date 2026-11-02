// طبقة بيانات المركز الإعلامي والفواتير الإضافية. تُركَّب في createLocalRepositories.
// الدوال العامة (public*) تعمل بلا حساب: يدخل الفريق المتعاقد بالرابط فقط، وفي المنصة الحقيقية يتحقق منها الخادم
// (تجزئة حقيقية، تحديد معدل الطلبات، وفحص الصلاحية على الخادم).
import { canManageAccounts } from '@/domain/accounts';
import { hasLeaderPowers } from '@/domain/roles';
import { ACCESS_DENIED } from '@/domain/access';
import { nowISO } from '@/domain/dates';
import { uid } from '@/domain/id';
import {
  applyExec, canOpenMedia, contentHash, findLinkByToken, freezeBrief, frozenItems, hasMediaPerm, isHttpUrl, latestSnapshot, linkState, MEDIA_PERMS, newBriefFromTemplate, newToken,
  pendingChanges, resolveEvent, tokenHash,
} from '@/domain/media';
import { attachmentError } from '@/domain/ledger';
import { hasFinancePerm } from '@/domain/finance';
import type {
  Attachment, AuditEntry, BriefContent, DB, EventRef, ID, ISODate, MediaBrief, MediaItemStatus, MediaLink, MediaLinkKind, MediaPermission, MediaSettings, MediaTemplate,
} from '@/domain/types';
import { pushNotification, type Mutate } from './repositories';

const audit = (d: DB, byId: ID, action: string, detail: string, area: AuditEntry['area']) => d.audit.unshift({ id: uid('au'), at: nowISO(), byId, action, detail, area });
const nameOf = (d: DB, id: ID) => d.persons.find((p) => p.id === id)?.name ?? '—';
const leaderOf = (d: DB) => d.persons.find((p) => p.isGeneralLeader)!.id;
const isLeader = (d: DB, id: ID) => hasLeaderPowers(d, id);
const mediaIds = (d: DB, perm: MediaPermission) => d.persons.filter((p) => hasMediaPerm(d, p.id, perm)).map((p) => p.id);

export function createMediaRepos(mutate: Mutate, me: () => ID) {
  /** القسم كله ضمن صلاحيات اللجنة الإعلامية. من لا يملك الصلاحية يُرفض كغير الموجود */
  const need = (d: DB, perm?: MediaPermission) => {
    if (!canOpenMedia(d, me())) throw new Error(ACCESS_DENIED);
    if (perm && !hasMediaPerm(d, me(), perm)) throw new Error(`لا تملك صلاحية «${MEDIA_PERMS.find((p) => p.key === perm)!.label}». يمنحها القائد العام.`);
  };
  const brief = (d: DB, id: ID) => {
    const b = d.mediaBriefs.find((x) => x.id === id);
    if (!b) throw new Error('الموجز غير موجود');
    return b;
  };
  const checkContent = (d: DB, c: BriefContent, kind: MediaBrief['kind']) => {
    if (!c.title.trim()) throw new Error('اكتب عنوان الموجز');
    if (!c.events.length) throw new Error(kind === 'week' ? 'اختر فعالية واحدة على الأقل للأسبوع' : 'اختر الفعالية');
    if (kind === 'event' && c.events.length !== 1) throw new Error('موجز اللقاء لفعالية واحدة');
    c.events.forEach((e) => { if (!resolveEvent(d, e.ref)) throw new Error('إحدى الفعاليات لم تعد موجودة'); });
  };
  /** يجمّد لقطة جديدة بإصدار */
  const snapshot = (d: DB, b: MediaBrief, by: ID) => {
    const pending = pendingChanges(d, b);
    const reason = !latestSnapshot(b) ? 'first' : pending.length ? 'schedule_change' : 'content_edit';
    const version = b.snapshots.length + 1;
    b.snapshots.push({ version, at: nowISO(), by, reason, contentHash: contentHash(b.content), data: freezeBrief(d, b) });
    b.status = 'approved';
    b.approvalRequest = undefined;
    b.updatedAt = nowISO();
    audit(d, by, version === 1 ? 'اعتماد موجز إعلامي' : `إصدار جديد لموجز إعلامي (${version})`, b.content.title, 'roles');
    return version;
  };
  /** حالة رابط بالرمز: لا تكشف إلا ما يلزم الزائر */
  const openLink = (d: DB, token: string) => {
    const l = token ? findLinkByToken(d, token) : undefined;
    if (!l) return null;
    const state = linkState(l);
    return { l, state, b: d.mediaBriefs.find((x) => x.id === l.briefId) };
  };

  return {
    // ───────────── القوالب ─────────────
    saveTemplate(t: Omit<MediaTemplate, 'updatedAt' | 'id'> & { id?: ID }): ID {
      let id = t.id ?? '';
      mutate((d) => {
        need(d, 'edit');
        if (!t.name.trim()) throw new Error('اكتب اسم القالب');
        const full: MediaTemplate = { ...t, id: t.id ?? uid('mt'), name: t.name.trim(), updatedAt: nowISO() };
        id = full.id;
        const i = d.mediaTemplates.findIndex((x) => x.id === full.id);
        if (i >= 0) d.mediaTemplates[i] = full;
        else d.mediaTemplates.push(full);
      });
      return id;
    },
    duplicateTemplate(id: ID): ID {
      const nid = uid('mt');
      mutate((d) => {
        need(d, 'edit');
        const t = d.mediaTemplates.find((x) => x.id === id);
        if (!t) throw new Error('القالب غير موجود');
        d.mediaTemplates.push({ ...structuredClone(t), id: nid, name: `نسخة من ${t.name}`, updatedAt: nowISO() });
      });
      return nid;
    },
    removeTemplate(id: ID) {
      mutate((d) => {
        need(d, 'edit');
        d.mediaTemplates = d.mediaTemplates.filter((x) => x.id !== id);
      });
    },

    // ───────────── الموجزات ─────────────
    /** الخطوة الأولى: النطاق والقالب. يُنشأ موجز مسودة من نسخة القالب */
    createBrief(input: { templateId: ID; scope: { kind: 'event'; ref: EventRef } | { kind: 'week'; weekStart: ISODate; refs: EventRef[] } }): ID {
      const id = uid('mb');
      mutate((d) => {
        need(d, 'edit');
        const tpl = d.mediaTemplates.find((t) => t.id === input.templateId);
        if (!tpl) throw new Error('اختر القالب');
        const { content, kind } = newBriefFromTemplate(d, tpl, input.scope);
        checkContent(d, content, kind);
        d.mediaBriefs.unshift({
          id, kind, status: 'draft', templateId: tpl.id, templateName: tpl.name, content, internalNotes: '', snapshots: [], execution: {}, createdBy: me(), createdAt: nowISO(), updatedAt: nowISO(),
        });
      });
      return id;
    },
    updateBrief(id: ID, patch: { content?: BriefContent; internalNotes?: string }) {
      mutate((d) => {
        need(d, 'edit');
        const b = brief(d, id);
        if (b.status === 'archived') throw new Error('الموجز مؤرشف');
        if (patch.content) { checkContent(d, patch.content, b.kind); b.content = patch.content; }
        if (patch.internalNotes !== undefined) b.internalNotes = patch.internalNotes;
        b.updatedAt = nowISO();
      });
    },
    deleteBrief(id: ID) {
      mutate((d) => {
        need(d, 'edit');
        const b = brief(d, id);
        if (b.snapshots.length) throw new Error('الموجز المعتمد يُؤرشف ولا يُحذف');
        d.mediaBriefs = d.mediaBriefs.filter((x) => x.id !== id);
      });
    },
    archive(id: ID, on = true) {
      mutate((d) => {
        need(d, 'edit');
        const b = brief(d, id);
        b.status = on ? 'archived' : latestSnapshot(b) ? 'approved' : 'draft';
        if (on) d.mediaLinks.filter((l) => l.briefId === id && !l.revokedAt).forEach((l) => { l.revokedAt = nowISO(); l.revokedBy = me(); });
        b.updatedAt = nowISO();
      });
    },
    /**
     * الاعتماد: يجمّد لقطة بإصدار جديد. عند تفعيل «يتطلب موافقة القائد العام» يتحول غير القائد العام إلى طلب اعتماد.
     * يعيد 'approved' أو 'requested'. وهو نفسه «راجع وأكّد» عند وجود تغييرات جدول معلّقة.
     */
    approve(id: ID): 'approved' | 'requested' {
      let result: 'approved' | 'requested' = 'approved';
      mutate((d) => {
        need(d, 'approve');
        const b = brief(d, id);
        if (b.status === 'archived') throw new Error('الموجز مؤرشف');
        checkContent(d, b.content, b.kind);
        if (!b.content.sections.some((s) => s.visible)) throw new Error('أظهر قسماً واحداً على الأقل');
        if (d.settings.media.requireLeaderApproval && !isLeader(d, me())) {
          b.approvalRequest = { by: me(), at: nowISO() };
          pushNotification(d, [leaderOf(d)], 'approval_submitted', `موجز إعلامي بانتظار اعتمادك: ${b.content.title}`, '/app/approvals');
          result = 'requested';
          return;
        }
        snapshot(d, b, me());
      });
      return result;
    },
    /** القائد العام: يرفض طلب اعتماد بسبب */
    rejectApproval(id: ID, reason: string) {
      mutate((d) => {
        if (!isLeader(d, me())) throw new Error('للقائد العام');
        const b = brief(d, id);
        if (!b.approvalRequest) throw new Error('لا طلب اعتماد على هذا الموجز');
        if (!reason.trim()) throw new Error('اكتب سبب الرفض');
        pushNotification(d, [b.approvalRequest.by], 'approval_rejected', `أعاد القائد العام الموجز «${b.content.title}»: ${reason.trim()}`, `/app/media/briefs/${id}`);
        b.approvalRequest = undefined;
      });
    },

    // ───────────── متابعة التنفيذ (لوحة المسؤول) ─────────────
    setItem(briefId: ID, itemId: ID, patch: { status?: MediaItemStatus; reason?: string; addProof?: string; note?: string }) {
      mutate((d) => {
        need(d, 'edit');
        const b = brief(d, briefId);
        const snap = latestSnapshot(b);
        if (!snap || !frozenItems(snap.data).some((i) => i.id === itemId)) throw new Error('البند غير موجود في الإصدار المعتمد');
        applyExec(b, itemId, nameOf(d, me()), patch, nowISO());
      });
    },

    // ───────────── روابط المشاركة ─────────────
    /** يعيد الرمز مرة واحدة فقط: لا يُخزَّن، تُخزَّن بصمته */
    createLink(briefId: ID, kind: MediaLinkKind, expiresAt?: string): { id: ID; token: string } {
      const token = newToken();
      const id = uid('ml');
      mutate((d) => {
        need(d, 'approve');
        const b = brief(d, briefId);
        if (!latestSnapshot(b) || b.status !== 'approved') throw new Error('اعتمد الموجز أولاً ثم أصدر الرابط');
        if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) throw new Error('تاريخ الانتهاء يجب أن يكون في المستقبل');
        d.mediaLinks.unshift({ id, briefId, kind, tokenHash: tokenHash(token), tokenTail: token.slice(-6), createdBy: me(), createdAt: nowISO(), expiresAt, accessCount: 0 });
        audit(d, me(), 'إصدار رابط موجز إعلامي', `${kind === 'track' ? 'متابعة تنفيذ' : 'قراءة فقط'}: ${b.content.title}`, 'roles');
      });
      return { id, token };
    },
    revokeLink(id: ID) {
      mutate((d) => {
        need(d, 'approve');
        const l = d.mediaLinks.find((x) => x.id === id);
        if (!l) throw new Error('الرابط غير موجود');
        if (l.revokedAt) return false;
        l.revokedAt = nowISO();
        l.revokedBy = me();
        audit(d, me(), 'إلغاء رابط موجز إعلامي', d.mediaBriefs.find((b) => b.id === l.briefId)?.content.title ?? '', 'roles');
      });
    },

    // ───────────── الزائر (بلا حساب) ─────────────
    /** دخول الرابط: يحصي الدخول ويسجّل آخر دخول. الرابط المنتهي أو الملغى لا يُحصى */
    publicVisit(token: string, visitor?: string) {
      mutate((d) => {
        const o = openLink(d, token);
        if (!o || o.state !== 'active') return false;
        o.l.accessCount += 1;
        o.l.lastAccessAt = nowISO();
        if (visitor?.trim()) o.l.lastVisitor = visitor.trim();
      });
    },
    /** إجراء الزائر على رابط المتابعة: حالة بند، أو ملاحظة، أو رابط إثبات. يُسجَّل باسمه */
    publicAct(token: string, visitor: string, itemId: ID, patch: { status?: MediaItemStatus; reason?: string; addProof?: string; note?: string }) {
      mutate((d) => {
        const o = openLink(d, token);
        if (!o || o.state !== 'active' || !o.b) throw new Error('الرابط غير صالح');
        if (o.l.kind !== 'track') throw new Error('هذا الرابط للقراءة فقط');
        if (!visitor.trim()) throw new Error('اكتب اسمك أولاً');
        if (o.b.status !== 'approved') throw new Error('الموجز غير معتمد');
        const snap = latestSnapshot(o.b)!;
        const item = frozenItems(snap.data).find((i) => i.id === itemId);
        if (!item) throw new Error('البند غير موجود');
        const name = visitor.trim();
        applyExec(o.b, itemId, name, patch, nowISO());
        const what = patch.status ? `غيّر الحالة إلى «${{ not_started: 'لم تبدأ', in_progress: 'قيد التنفيذ', done: 'مكتملة', failed: 'متعذرة' }[patch.status]}»${patch.status === 'failed' ? ` (${patch.reason})` : ''}` : patch.addProof ? 'أضاف رابط إثبات' : 'أضاف ملاحظة';
        d.mediaActivity.unshift({ id: uid('ma'), briefId: o.b.id, linkId: o.l.id, itemId, itemTitle: item.title, actor: name, action: what, at: nowISO() });
        o.l.lastVisitor = name;
        o.l.lastAccessAt = nowISO();
      });
    },

    // ───────────── إعدادات المركز وصلاحياته (للقائد العام) ─────────────
    saveSettings(patch: Partial<MediaSettings>) {
      mutate((d) => {
        if (!isLeader(d, me())) throw new Error('إعدادات المركز الإعلامي للقائد العام');
        const next = { ...d.settings.media, ...patch };
        const int = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;
        if (!int(next.weekStartDay, 0, 6)) throw new Error('يوم بداية الأسبوع بين الأحد والسبت');
        if (!int(next.upcomingDays, 1, 60)) throw new Error('أيام «فعاليات قادمة» بين 1 و60');
        if (!int(next.linkExpiryWarnDays, 0, 60)) throw new Error('أيام تنبيه الروابط بين 0 و60');
        if (!int(next.defaultLinkDays, 0, 365)) throw new Error('صلاحية الرابط الافتراضية بين 0 و365 يوماً');
        d.settings.media = next;
        audit(d, me(), 'تعديل إعدادات المركز الإعلامي', Object.keys(patch).join('، '), 'settings');
      });
    },
    setPermission(personId: ID, perm: MediaPermission, on: boolean) {
      mutate((d) => {
        if (!canManageAccounts(d, me())) throw new Error('يمنح صلاحيات المركز الإعلامي مسؤول اللجنة التقنية');
        const cid = d.committees.find((c) => c.kind === 'media')?.id;
        const m = d.memberships.find((x) => x.committeeId === cid && x.personId === personId);
        if (!m) throw new Error('الشخص ليس عضواً في اللجنة الإعلامية');
        if (m.role === 'leader') throw new Error('رئيس اللجنة يملك كل الصلاحيات');
        const ceiling = d.committees.find((c) => c.id === cid)?.grantedPerms;
        if (on && ceiling && !ceiling.includes(perm)) throw new Error('هذه الصلاحية خارج سقف اللجنة الإعلامية');
        const cur = new Set(m.mediaPerms ?? []);
        if (on) cur.add(perm); else cur.delete(perm);
        m.mediaPerms = [...cur];
        const label = MEDIA_PERMS.find((p) => p.key === perm)!.label;
        audit(d, me(), on ? 'منح صلاحية إعلامية' : 'سحب صلاحية إعلامية', `${label} — ${nameOf(d, personId)}`, 'roles');
        pushNotification(d, [personId], 'general', `${on ? 'مُنحت' : 'سُحبت'} صلاحية «${label}» في المركز الإعلامي`, '/app/media');
      });
    },

    // ───────────── فواتير إضافية (لا علاقة لها بحساب العهدة) ─────────────
    addExtraInvoice(custodyId: ID, input: { attachment: Attachment; amount: number; date: ISODate; categoryId?: ID; description: string }): ID {
      const id = uid('xi');
      mutate((d) => {
        const c = d.custodies.find((x) => x.id === custodyId);
        if (!c) throw new Error('العهدة غير موجودة');
        if (c.recipientId !== me()) throw new Error('الفواتير الإضافية يضيفها صاحب العهدة');
        const err = attachmentError(input.attachment, 'صورة الفاتورة');
        if (err) throw new Error(err);
        if (!(input.amount > 0)) throw new Error('اكتب مبلغ الفاتورة');
        if (!input.date) throw new Error('حدد تاريخ الفاتورة');
        if (input.categoryId && !d.budgetCategories.some((x) => x.id === input.categoryId)) throw new Error('التصنيف غير موجود');
        d.extraInvoices.push({ id, custodyId, ownerKind: c.ownerKind, ownerId: c.ownerId, addedBy: me(), at: nowISO(), attachment: input.attachment, amount: Math.round(input.amount * 100) / 100, date: input.date, categoryId: input.categoryId || undefined, description: input.description.trim() });
        audit(d, me(), 'إضافة فاتورة إضافية', `${input.amount} ر.س — ${input.description.trim() || 'بلا وصف'}`, 'finance');
        const reviewers = d.persons.filter((p) => hasFinancePerm(d, p.id, 'review_invoices') && p.id !== me()).map((p) => p.id);
        pushNotification(d, reviewers, 'general', `فاتورة إضافية جديدة من ${nameOf(d, me())} (${input.amount} ر.س)`, '/app/finance?tab=invoices');
      });
      return id;
    },
    /** التعديل والحذف لصاحبها قبل المراجعة فقط */
    updateExtraInvoice(id: ID, patch: Partial<{ attachment: Attachment; amount: number; date: ISODate; categoryId: ID | undefined; description: string }>) {
      mutate((d) => {
        const x = d.extraInvoices.find((v) => v.id === id);
        if (!x) throw new Error('الفاتورة غير موجودة');
        if (x.addedBy !== me()) throw new Error('تعدّل الفاتورة صاحبتها');
        if (x.review) throw new Error('تمت مراجعة الفاتورة: لا تُعدَّل');
        if (patch.attachment) { const err = attachmentError(patch.attachment, 'صورة الفاتورة'); if (err) throw new Error(err); x.attachment = patch.attachment; }
        if (patch.amount !== undefined) { if (!(patch.amount > 0)) throw new Error('اكتب مبلغ الفاتورة'); x.amount = Math.round(patch.amount * 100) / 100; }
        if (patch.date !== undefined) { if (!patch.date) throw new Error('حدد تاريخ الفاتورة'); x.date = patch.date; }
        if ('categoryId' in patch) x.categoryId = patch.categoryId || undefined;
        if (patch.description !== undefined) x.description = patch.description.trim();
        audit(d, me(), 'تعديل فاتورة إضافية', `${x.amount} ر.س`, 'finance');
      });
    },
    removeExtraInvoice(id: ID) {
      mutate((d) => {
        const x = d.extraInvoices.find((v) => v.id === id);
        if (!x) throw new Error('الفاتورة غير موجودة');
        if (x.addedBy !== me()) throw new Error('تحذف الفاتورة صاحبتها');
        if (x.review) throw new Error('تمت مراجعة الفاتورة: لا تُحذف');
        d.extraInvoices = d.extraInvoices.filter((v) => v.id !== id);
        audit(d, me(), 'حذف فاتورة إضافية', `${x.amount} ر.س`, 'finance');
      });
    },
    /** علامة «تمت مراجعتها» وملاحظة اختيارية: لا رفض ولا اعتماد كصرف */
    reviewExtraInvoice(id: ID, note?: string) {
      mutate((d) => {
        if (!hasFinancePerm(d, me(), 'review_invoices')) throw new Error('المراجعة لمسؤول المالية ومن فُوّض بمراجعة الفواتير');
        const x = d.extraInvoices.find((v) => v.id === id);
        if (!x) throw new Error('الفاتورة غير موجودة');
        if (x.addedBy === me() || d.custodies.find((c) => c.id === x.custodyId)?.recipientId === me()) throw new Error('لا يراجع صاحب العهدة فاتورته بنفسه');
        if (x.review) throw new Error('روجعت من قبل');
        x.review = { by: me(), at: nowISO(), note: note?.trim() || undefined };
        audit(d, me(), 'مراجعة فاتورة إضافية', `${x.amount} ر.س — ${nameOf(d, x.addedBy)}`, 'finance');
        pushNotification(d, [x.addedBy], 'general', 'تمت مراجعة فاتورتك الإضافية', '/app/requests');
      });
    },
  };
}
