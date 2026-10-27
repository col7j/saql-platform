// كتل الصفحات العامة (الموقع العام ورابط الداعم): فريق العمل، المتميزون، المجموعات، جدول المشاركين، الشعارات.
// تُقرأ من نفس بيانات المنصة، والترتيب يظهر بالأسماء بعد نشر التشكيل.
import { rankingPublic } from '@/domain/supporter';
import type { SiteSection, SupporterEntity } from '@/domain/types';
import { useDB, useScores } from '@/state/store';
import { Avatar, Table } from './index';

/** فريق العمل: الأسماء والصور والمناصب، والأرقام في رابط الداعم فقط */
export function StaffList({ withPhone }: { withPhone?: boolean }) {
  const db = useDB();
  const staff = db.persons.filter((p) => p.kind === 'staff').sort((a, b) => Number(!!b.isGeneralLeader) - Number(!!a.isGeneralLeader) || a.name.localeCompare(b.name, 'ar'));
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {staff.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          {p.photo?.preview ? <img src={p.photo.preview} alt={p.name} className="h-12 w-12 rounded-full object-cover" /> : <Avatar name={p.name} size={48} />}
          <div className="min-w-0">
            <div className="truncate font-bold">{p.name}</div>
            <div className="truncate text-xs text-ink-500">{p.title}</div>
            {withPhone && p.phone && <div className="text-xs text-brand-700" dir="ltr">{p.phone}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopFive() {
  const db = useDB();
  const scores = useScores();
  if (!rankingPublic(db)) return <p className="text-sm text-ink-500">يظهر الترتيب بعد نشر تشكيل المجموعات.</p>;
  const top = [...scores.persons].sort((a, b) => a.rank - b.rank).slice(0, 5);
  const medal = ['🥇', '🥈', '🥉', '٤', '٥'];
  return (
    <ol className="grid gap-6 sm:grid-cols-5">
      {top.map((p, i) => {
        const person = db.persons.find((x) => x.id === p.personId)!;
        return (
          <li key={p.personId} className="rounded-2xl border border-ink-100 bg-white p-6 text-center shadow-card">
            <div className="text-2xl">{medal[i]}</div>
            <div className="mt-1 font-bold">{person.name}</div>
            <div className="text-xs text-ink-500">{db.groups.find((g) => g.id === p.groupId)?.name}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function GroupsTable() {
  const db = useDB();
  const scores = useScores();
  if (!rankingPublic(db)) return <p className="text-sm text-ink-500">تُعلن المجموعات يوم نشر التشكيل.</p>;
  const rows = [...db.groups].sort((a, b) => (scores.groups.find((x) => x.groupId === a.id)?.rank ?? 9) - (scores.groups.find((x) => x.groupId === b.id)?.rank ?? 9));
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((g) => (
        <div key={g.id} className="rounded-2xl border border-t-4 border-ink-100 bg-white p-5 shadow-card" style={{ borderTopColor: g.color }}>
          <div className="flex items-center justify-between"><b>{g.name}</b><span className="text-xs text-ink-500">المركز {scores.groups.find((x) => x.groupId === g.id)?.rank}</span></div>
          <div className="mt-1 text-xs text-ink-500">القائد: {db.persons.find((p) => p.id === g.leaderId)?.name ?? '—'} · الميسّر: {db.persons.find((p) => p.id === g.facilitatorId)?.name ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

/** جدول المشاركين بترتيب أبجدي مع المجموعة */
export function ParticipantsTable() {
  const db = useDB();
  const published = rankingPublic(db);
  const list = db.persons.filter((p) => p.kind === 'participant').sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return (
    <Table minWidth={320}>
      <thead><tr><th>المشارك</th><th>المجموعة</th></tr></thead>
      <tbody>{list.map((p) => <tr key={p.id}><td>{p.name}</td><td className="text-ink-600">{published ? db.groups.find((g) => g.memberIds.includes(p.id))?.name ?? '—' : 'تُعلن يوم النشر'}</td></tr>)}</tbody>
    </Table>
  );
}

/** شعارات الداعمين والشركاء: الترتيب والتصنيف يحدده القائد العام، والتصنيف لا يراه الزائر */
export function LogoStrip({ placement }: { placement: 'above' | 'below' }) {
  const db = useDB();
  const list = db.supporters.filter((s) => s.active && s.placement === placement).sort((a, b) => Number(b.primary) - Number(a.primary) || a.order - b.order);
  if (!list.length) return null;
  return <div className="flex flex-wrap items-center justify-center gap-4">{list.map((s) => <Logo key={s.id} s={s} />)}</div>;
}
function Logo({ s }: { s: SupporterEntity }) {
  const box = s.orientation === 'vertical' ? 'h-24 w-20' : 'h-14 w-40';
  return s.logo?.preview
    ? <img src={s.logo.preview} alt={s.name} className={`${box} rounded-xl bg-white object-contain p-2 shadow-card ${s.primary ? 'ring-2 ring-accent-400' : ''}`} />
    : <span className={`${box} flex items-center justify-center rounded-xl bg-white p-2 text-center text-xs font-bold text-ink-600 shadow-card ${s.primary ? 'ring-2 ring-accent-400' : ''}`}>{s.name}</span>;
}

/** قسم الموقع العام بقالبه */
export function SiteSectionView({ section: sec }: { section: SiteSection }) {
  const db = useDB();
  if (sec.type === 'text') return <p className="max-w-3xl whitespace-pre-line text-lg font-normal leading-[1.8] text-ink-600">{sec.body}</p>;
  if (sec.type === 'image') return sec.image?.preview ? <figure><img src={sec.image.preview} alt={sec.caption ?? sec.title} className="max-h-96 rounded-2xl object-cover" />{sec.caption && <figcaption className="mt-2 text-sm text-ink-500">{sec.caption}</figcaption>}</figure> : <p className="text-sm text-ink-500">{sec.caption ?? 'صورة'}</p>;
  if (sec.type === 'people') return sec.people === 'top5' ? <TopFive /> : <StaffList />;
  const t = sec.table!;
  if (t.source === 'groups') return <GroupsTable />;
  if (t.source === 'participants') return <ParticipantsTable />;
  void db;
  return (
    <Table minWidth={320}>
      {t.columns.length > 0 && <thead><tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>}
      <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 0 ? 'font-medium' : 'text-ink-600'}>{c}</td>)}</tr>)}</tbody>
    </Table>
  );
}
