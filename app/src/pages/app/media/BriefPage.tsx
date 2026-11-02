// إنشاء الموجز وعرضه. ثلاث خطوات: النطاق والقالب، والمراجعة والتحرير، والمعاينة والاعتماد.
// المسودة تقرأ حياً من الفعاليات ولا تنسخها، والاعتماد يجمّد لقطة بإصدار.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fmtDate, fmtDateTime, todayISO } from '@/domain/dates';
import {
  freezeBrief, hasMediaPerm, hasUnpublishedEdits, latestSnapshot, linkState, mediaEvents, pendingChanges, publicContent, refKey, weekEvents, weekStartOf,
} from '@/domain/media';
import type { BriefContent, EventRef, MediaBrief } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, MoreMenu, Notice, PageHeader, Select, Steps, Tabs, askConfirm, cx } from '@/ui';
import { BriefDocument } from './BriefDocument';
import { BriefEditor } from './BriefEditor';
import { ShareModal } from './ShareModal';

// ───────────── الخطوة 1: النطاق والقالب ─────────────
export function NewBrief() {
  const db = useDB();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const today = todayISO();
  const events = mediaEvents(db);
  const sorted = [...events.filter((e) => (e.endDate ?? e.date) >= today), ...events.filter((e) => (e.endDate ?? e.date) < today).reverse()];
  const pre = params.get('ref');
  const [kind, setKind] = useState<'event' | 'week'>('event');
  const [ref, setRef] = useState<EventRef | undefined>(sorted.find((e) => refKey(e.ref) === pre)?.ref ?? sorted[0]?.ref);
  const [weekStart, setWeekStart] = useState(weekStartOf(today, db.settings.media.weekStartDay));
  const inWeek = weekEvents(db, weekStart);
  const [off, setOff] = useState<string[]>([]);
  const chosen = inWeek.filter((e) => !off.includes(refKey(e.ref)));
  const [templateId, setTemplateId] = useState(db.mediaTemplates[0]?.id ?? '');
  const valid = !!templateId && (kind === 'event' ? !!ref : chosen.length > 0);
  const create = () => {
    try {
      const id = repos.media.createBrief({ templateId, scope: kind === 'event' ? { kind, ref: ref! } : { kind, weekStart, refs: chosen.map((e) => e.ref) } });
      nav(`/app/media/briefs/${id}?step=2`);
    } catch (e) { act(() => { throw e; }); }
  };
  return (
    <div>
      <PageHeader back="/app/media/briefs" title="موجز جديد" subtitle="الخطوة 1 من 3: النطاق والقالب" />
      <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-3 shadow-card"><Steps steps={[{ label: 'النطاق والقالب', state: 'current' }, { label: 'المراجعة والتحرير', state: 'todo' }, { label: 'المعاينة والاعتماد', state: 'todo' }]} /></div>
      <div className="space-y-6">
        <Card title="النطاق">
          <Tabs value={kind} onChange={setKind} tabs={[{ key: 'event', label: 'موجز لقاء' }, { key: 'week', label: 'موجز أسبوع' }]} />
          {kind === 'event' ? (
            <Field label="الفعالية"><Select value={ref ? refKey(ref) : ''} onChange={(e) => setRef(sorted.find((x) => refKey(x.ref) === e.target.value)?.ref)} options={sorted.map((e) => ({ value: refKey(e.ref), label: `${fmtDate(e.date)} · ${e.title}` }))} /></Field>
          ) : (
            <div className="space-y-3">
              <Field label="بداية الأسبوع" hint="يبدأ الأسبوع بيوم يحدده القائد العام في الإعدادات (السبت افتراضياً)"><Input type="date" className="max-w-[220px]" value={weekStart} onChange={(e) => setWeekStart(weekStartOf(e.target.value || today, db.settings.media.weekStartDay))} /></Field>
              {inWeek.length === 0 ? <Notice tone="orange">لا فعاليات في هذا الأسبوع.</Notice> : (
                <div>
                  <span className="label">الفعاليات المضمّنة</span>
                  <ul className="space-y-2">
                    {inWeek.map((e) => {
                      const on = !off.includes(refKey(e.ref));
                      return (
                        <li key={refKey(e.ref)}>
                          <button type="button" onClick={() => setOff(on ? [...off, refKey(e.ref)] : off.filter((x) => x !== refKey(e.ref)))} aria-pressed={on} className={cx('flex min-h-[44px] w-full items-center gap-2 rounded-xl border px-3 text-start', on ? 'border-brand-600 bg-brand-50' : 'border-ink-100 bg-white')}>
                            {on ? <Icons.CheckSquare className="h-5 w-5 text-brand-600" /> : <Icons.Square className="h-5 w-5 text-ink-300" />}
                            <span className="flex-1">{e.title}</span><span className="text-xs text-ink-500">{fmtDate(e.date)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
        <Card title="القالب" subtitle="تُنسخ أقسامه ولقطاته ومقابلاته ومخرجاته إلى الموجز، وتعديل القالب لاحقاً لا يغيّر هذا الموجز">
          {db.mediaTemplates.length === 0 ? <Empty title="لا قوالب" text="أنشئ قالباً من شاشة «القوالب»." /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {db.mediaTemplates.map((t) => (
                <button key={t.id} type="button" onClick={() => setTemplateId(t.id)} aria-pressed={templateId === t.id} className={cx('rounded-2xl border p-4 text-start transition', templateId === t.id ? 'border-brand-600 bg-brand-50 shadow-card' : 'border-ink-100 bg-white hover:border-brand-200')}>
                  <div className="font-bold text-ink-900">{t.name}</div>
                  <p className="mt-1 text-xs text-ink-500">{t.description}</p>
                  <div className="mt-2 text-xs text-ink-600">{t.shots.length} لقطات · {t.interviews.length} مقابلات · {t.deliverables.length} مخرجات</div>
                </button>
              ))}
            </div>
          )}
        </Card>
        <div className="flex justify-end"><Button disabled={!valid} onClick={create} icon={<Icons.ArrowLeft className="h-4 w-4" />}>التالي</Button></div>
      </div>
    </div>
  );
}

// ───────────── الخطوتان 2 و3 ─────────────
function Wizard({ brief, onDone }: { brief: MediaBrief; onDone: (share?: boolean) => void }) {
  const db = useDB();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const step = params.get('step') === '3' ? 3 : 2;
  const [content, setContent] = useState<BriefContent>(() => structuredClone(brief.content));
  const [notes, setNotes] = useState(brief.internalNotes);
  const canApprove = hasMediaPerm(db, me.person.id, 'approve');
  const latest = useRef({ content, notes });
  latest.current = { content, notes };
  const dirty = () => JSON.stringify(latest.current.content) !== JSON.stringify(brief.content) || latest.current.notes !== brief.internalNotes;
  const save = () => {
    if (!dirty() || !latest.current.content.title.trim()) return;
    try { repos.media.updateBrief(brief.id, { content: latest.current.content, internalNotes: latest.current.notes }); } catch (e) { act(() => { throw e; }); }
  };
  // حفظ تلقائي بعد توقف الكتابة
  useEffect(() => { const t = setTimeout(save, 700); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [content, notes]);
  const go = (n: 2 | 3) => { save(); setParams({ step: String(n) }); window.scrollTo({ top: 0 }); };

  const preview = publicContent(freezeBrief(db, { kind: brief.kind, content }));
  const version = brief.snapshots.length + 1;
  const approve = () => {
    save();
    act(() => {
      const r = repos.media.approve(brief.id);
      if (r === 'requested') { note('أُرسل الموجز لاعتماد القائد العام'); return; }
      onDone(true);
    });
  };
  return (
    <div>
      <PageHeader back="/app/media/briefs" title={brief.content.title || 'موجز'} subtitle={`الخطوة ${step} من 3: ${step === 2 ? 'المراجعة والتحرير' : 'المعاينة والاعتماد'}`} actions={<Badge tone={brief.status === 'approved' ? 'green' : 'orange'}>{brief.status === 'approved' ? `معتمد · الإصدار ${brief.snapshots.length}` : 'مسودة'}</Badge>} />
      <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-3 shadow-card"><Steps steps={[{ label: 'النطاق والقالب', state: 'done' }, { label: 'المراجعة والتحرير', state: step === 2 ? 'current' : 'done' }, { label: 'المعاينة والاعتماد', state: step === 3 ? 'current' : 'todo' }]} /></div>
      {step === 2 ? (
        <>
          <BriefEditor kind={brief.kind} content={content} setContent={setContent} internalNotes={notes} setInternalNotes={setNotes} />
          <div className="mt-6 flex justify-end"><Button onClick={() => go(3)} disabled={!content.title.trim()} icon={<Icons.ArrowLeft className="h-4 w-4" />}>التالي</Button></div>
        </>
      ) : (
        <div className="space-y-6">
          <Notice>هذه معاينة كما سيراها الفريق: الأقسام الظاهرة فقط، والجهات المصرّح بمشاركتها فقط، بلا ملاحظاتك الداخلية.</Notice>
          <Card title={content.title}><BriefDocument data={preview} /></Card>
          {!canApprove && <Notice tone="orange">لا تملك صلاحية الاعتماد والمشاركة. المسودة محفوظة، ويعتمدها من يملك الصلاحية.</Notice>}
          {db.settings.media.requireLeaderApproval && !me.isLeader && canApprove && <Notice tone="orange">الاعتماد يتطلب موافقة القائد العام: سيُرسل الطلب له.</Notice>}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="secondary" onClick={() => go(2)} icon={<Icons.ArrowRight className="h-4 w-4" />}>السابق</Button>
            {canApprove && <Button onClick={approve} icon={<Icons.Send className="h-4 w-4" />}>{brief.snapshots.length ? `اعتمد وشارك (الإصدار ${version})` : 'اعتمد وشارك'}</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
const note = (t: string) => act(() => {}, t);

// ───────────── الموجز المعتمد ─────────────
function ApprovedView({ brief, onEdit, initialShare }: { brief: MediaBrief; onEdit: () => void; initialShare?: boolean }) {
  const db = useDB();
  const me = useMe();
  const nav = useNavigate();
  const [share, setShare] = useState(!!initialShare);
  const snap = latestSnapshot(brief)!;
  const changes = pendingChanges(db, brief);
  const canApprove = hasMediaPerm(db, me.person.id, 'approve');
  const canEdit = hasMediaPerm(db, me.person.id, 'edit');
  const links = db.mediaLinks.filter((l) => l.briefId === brief.id);
  const confirm = () => act(() => {
    const r = repos.media.approve(brief.id);
    note(r === 'requested' ? 'أُرسل للقائد العام للاعتماد' : 'صدر إصدار جديد');
  });
  return (
    <div>
      <PageHeader back="/app/media/briefs" title={brief.content.title}
        subtitle={<span>الإصدار {snap.version} · آخر تحديث {fmtDateTime(snap.at)} · اعتمده {db.persons.find((p) => p.id === snap.by)?.name}</span>}
        actions={<>
          {canApprove && <Button onClick={() => setShare(true)} icon={<Icons.Share2 className="h-4 w-4" />}>شارك</Button>}
          {canEdit && <Button variant="secondary" onClick={onEdit} icon={<Icons.Pencil className="h-4 w-4" />}>عدّل</Button>}
          <MoreMenu items={[
            { label: 'متابعة التنفيذ', onClick: () => nav(`/app/media/follow?brief=${brief.id}`) },
            { label: 'أرشف الموجز', danger: true, hidden: !canEdit, onClick: () => askConfirm({ title: 'أرشفة الموجز', body: 'تُلغى كل روابطه فوراً.', cta: 'أرشف', danger: true, run: () => act(() => repos.media.archive(brief.id), 'أُرشف الموجز') }) },
          ]} />
        </>} />
      {brief.approvalRequest && <div className="mb-4"><Notice tone="orange">طلب اعتماد بانتظار القائد العام.</Notice></div>}
      {changes.length > 0 && (
        <div className="mb-6 rounded-2xl border border-accent-300 bg-accent-50 p-4" role="status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-accent-700">تغييرات بانتظار التأكيد ({changes.length})</b>
            {canApprove && <Button size="sm" variant="accent" onClick={confirm}>راجع وأكّد</Button>}
          </div>
          <p className="mt-1 text-xs text-ink-600">الرابط والـPDF ما زالا على الإصدار {snap.version} حتى تؤكد.</p>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">{changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
      {hasUnpublishedEdits(brief) && <div className="mb-4"><Notice tone="orange">لديك تعديلات على المحتوى لم تُعتمد بعد: الفريق يرى الإصدار {snap.version}. افتح «عدّل» ثم «اعتمد وشارك» لإصدار نسخة جديدة.</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card title="ما يراه الفريق" subtitle="النسخة المعتمدة وأقسامها الظاهرة"><BriefDocument data={publicContent(snap.data)} /></Card>
        <div className="space-y-6">
          <Card title="الإصدارات">
            <ul className="space-y-2 text-sm">
              {[...brief.snapshots].reverse().map((s) => (
                <li key={s.version} className="flex items-center justify-between gap-2"><span><b>الإصدار {s.version}</b> <span className="text-xs text-ink-500">{fmtDateTime(s.at)}</span></span><Badge tone={s.reason === 'first' ? 'green' : 'blue'}>{{ first: 'اعتماد', schedule_change: 'تأكيد تغيير الجدول', content_edit: 'تعديل المحتوى' }[s.reason]}</Badge></li>
              ))}
            </ul>
          </Card>
          <Card title="الروابط" action={<Link to="/app/media/links" className="text-xs text-brand-700">كل الروابط</Link>}>
            {links.length === 0 ? <p className="text-sm text-ink-500">لا روابط بعد.</p> : (
              <ul className="space-y-2 text-sm">{links.map((l) => <li key={l.id} className="flex items-center justify-between gap-2"><span>{l.kind === 'track' ? 'متابعة' : 'قراءة'}{l.expiresAt && <span className="text-xs text-ink-500"> · حتى {fmtDate(l.expiresAt)}</span>}</span><Badge tone={{ active: 'green', expired: 'gray', revoked: 'red' }[linkState(l)] as 'green'}>{{ active: 'نشط', expired: 'منتهٍ', revoked: 'ملغى' }[linkState(l)]}</Badge></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
      {share && <ShareModal brief={brief} onClose={() => setShare(false)} />}
    </div>
  );
}

export default function BriefPage() {
  const { id } = useParams();
  const db = useDB();
  const [editing, setEditing] = useState(false);
  const [autoShare, setAutoShare] = useState(false);
  const me = useMe();
  const brief = db.mediaBriefs.find((b) => b.id === id);
  if (!brief) return <Empty title="الموجز غير موجود" />;
  if (brief.status === 'archived') return (
    <div><PageHeader back="/app/media/briefs" title={brief.content.title} subtitle="موجز مؤرشف" actions={hasMediaPerm(db, me.person.id, 'edit') && <Button variant="secondary" onClick={() => act(() => repos.media.archive(brief.id, false), 'أُعيد الموجز')}>أعد الموجز</Button>} /><Empty title="مؤرشف" text="أُلغيت روابطه عند الأرشفة." /></div>
  );
  if (brief.status === 'approved' && !editing) return <ApprovedView brief={brief} initialShare={autoShare} onEdit={() => { setAutoShare(false); setEditing(true); }} />;
  return <Wizard key={brief.id + String(editing)} brief={brief} onDone={(share) => { setEditing(false); setAutoShare(!!share); }} />;
}
