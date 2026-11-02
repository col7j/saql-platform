// رابط الموجز للفريق المتعاقد: /brief/:token بلا تسجيل دخول. يرى النسخة المعتمدة وأقسامها الظاهرة فقط،
// ولا يصل لأي مسار من المنصة. في رابط المتابعة يكتب اسمه مرة، فيُسجَّل في كل إجراء.
// في المنصة الحقيقية: التحقق من الرمز على الخادم (بصمة حقيقية) مع تحديد معدل الطلبات.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fmtDate, fmtDateTime } from '@/domain/dates';
import { execOf, findLinkByToken, itemKindLabel, itemStatusLabel, latestSnapshot, linkState, publicContent, type ItemKind } from '@/domain/media';
import { repos, useDB } from '@/state/store';
import { Badge, Button, Card, Field, Icons, Input, Toasts } from '@/ui';
import { BriefDocument } from '@/pages/app/media/BriefDocument';
import { ItemPanel, statusTone } from '@/pages/app/media/ItemPanel';

const NAME_KEY = 'saql.brief.visitor';
const readName = () => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white bg-glow">
      <header className="container-x flex items-center justify-between py-4"><img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" /></header>
      <main className="container-x max-w-4xl pb-16">{children}</main>
      <Toasts />
    </div>
  );
}
const Notice = ({ title, text }: { title: string; text: string }) => (
  <Shell><div className="mx-auto mt-16 max-w-md rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-card" role="alert"><Icons.LinkIcon className="mx-auto mb-3 h-8 w-8 text-ink-300" /><h1 className="text-xl font-bold">{title}</h1><p className="mt-2 text-sm text-ink-500">{text}</p></div></Shell>
);

export default function PublicBrief() {
  const { token = '' } = useParams();
  const db = useDB();
  const link = findLinkByToken(db, token);
  const state = link ? linkState(link) : 'invalid';
  const brief = link && db.mediaBriefs.find((b) => b.id === link.briefId);
  const snap = brief && brief.status === 'approved' ? latestSnapshot(brief) : undefined;
  const [name, setName] = useState(readName);
  const [draftName, setDraftName] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const counted = useRef('');

  // لا يظهر في محركات البحث
  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex, nofollow';
    document.head.appendChild(m);
    const prev = document.title;
    document.title = 'موجز تغطية · صقل';
    return () => { m.remove(); document.title = prev; };
  }, []);
  // عدّاد الدخول مرة لكل فتح
  useEffect(() => {
    if (state === 'active' && counted.current !== token) { counted.current = token; repos.media.publicVisit(token, name || undefined); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, token]);

  if (state === 'invalid' || !brief || !snap) return <Notice title="الرابط غير صالح" text="تأكد من الرابط الذي وصلك." />;
  if (state === 'revoked') return <Notice title="أُلغي هذا الرابط" text="تواصل مع المسؤول الإعلامي للحصول على رابط جديد." />;
  if (state === 'expired') return <Notice title="انتهت صلاحية هذا الرابط" text={`انتهت الصلاحية ${fmtDate(link!.expiresAt)}. تواصل مع المسؤول الإعلامي لتجديده.`} />;

  const track = link!.kind === 'track';
  const data = publicContent(snap.data);
  const saveName = () => { const n = draftName.trim(); if (!n) return; try { localStorage.setItem(NAME_KEY, n); } catch { /* تجاهل */ } setName(n); };
  const slot = (id: string, kind: ItemKind, title: string) => {
    if (!track) return null;
    const e = execOf(brief, id);
    const open = openId === id;
    return (
      <div className="mt-2 border-t border-ink-100 pt-2 no-print">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1"><Badge tone={statusTone[e.status]}>{itemStatusLabel[e.status]}</Badge>{e.proofs.length > 0 && <span className="text-xs text-ink-500">{e.proofs.length} إثبات</span>}</span>
          <button type="button" aria-label={`${open ? 'أغلق' : 'حدّث'} ${itemKindLabel[kind]}: ${title}`} aria-expanded={open} onClick={() => setOpenId(open ? null : id)} className="inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">{open ? 'أغلق' : 'حدّث'}</button>
        </div>
        {open && <div className="mt-2"><ItemPanel exec={e} onPatch={(p) => repos.media.publicAct(token, name, id, p)} /></div>}
      </div>
    );
  };
  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-[28px] font-bold leading-[1.3] text-ink-900 lg:text-3xl">{data.title}</h1>
        <p className="mt-1 text-sm text-ink-500">الإصدار {snap.version} · آخر تحديث {fmtDateTime(snap.at)}{track ? ' · رابط متابعة تنفيذ' : ' · قراءة فقط'}</p>
      </div>
      {track && !name ? (
        <Card title="اكتب اسمك" subtitle="يُسجَّل اسمك مع كل تحديث تجريه على الموجز">
          <div className="flex gap-2"><Field label="الاسم" className="flex-1"><Input value={draftName} onChange={(e) => setDraftName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} /></Field></div>
          <Button className="mt-3" disabled={!draftName.trim()} onClick={saveName}>ابدأ</Button>
        </Card>
      ) : (
        <>
          {track && <p className="mb-4 text-sm text-ink-600">تتابع باسم <b>{name}</b> · <button className="text-brand-700 underline" onClick={() => { try { localStorage.removeItem(NAME_KEY); } catch { /* تجاهل */ } setName(''); }}>تغيير</button></p>}
          <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card sm:p-6"><BriefDocument data={data} item={track ? slot : undefined} /></div>
          <p className="mt-4 no-print"><Button variant="text" onClick={() => window.print()}>طباعة / حفظ PDF</Button></p>
        </>
      )}
    </Shell>
  );
}
