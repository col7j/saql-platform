// الرسائل: شاشة واحدة لطرفي القناة. المشارك (قبل التشكيل) يراسل الإدارة، والقائد العام يقرأ ويردّ
import { useState } from 'react';
import { accessibleKeys } from '@/domain/access';
import { fmtDateTime } from '@/domain/dates';
import type { AdminMessage } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, FilterPills, Input, PageHeader, Textarea } from '@/ui';
import { PersonChip } from '@/ui/domain';

export default function MessagesPage() {
  const db = useDB();
  const me = useMe();
  const inbox = accessibleKeys(db, me.person.id).has('inbox');
  return inbox ? <Inbox /> : <Compose />;
}

function Thread({ m, reply }: { m: AdminMessage; reply?: React.ReactNode }) {
  const db = useDB();
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><PersonChip id={m.fromId} /><span className="text-xs text-ink-500">{fmtDateTime(m.at)}</span></div>
      <p className="mt-3 text-sm">{m.text}</p>
      {m.reply ? <div className="mt-3 rounded-xl bg-brand-50 p-3 text-sm"><b>{personName(db, m.reply.byId)}:</b> {m.reply.text}</div> : reply}
    </Card>
  );
}

function Compose() {
  const db = useDB();
  const me = useMe();
  const [text, setText] = useState('');
  const mine = db.adminMessages.filter((m) => m.fromId === me.person.id);
  return (
    <div>
      <PageHeader title="الرسائل" subtitle="قبل تشكيل المجموعات يتواصل المشاركون مع الإدارة من داخل المنصة" />
      <Card title="راسل الإدارة">
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالتك" />
        <Button className="mt-3" disabled={!text.trim()} onClick={() => act(() => { repos.messages.send(text); setText(''); }, 'أُرسلت الرسالة')}>أرسل</Button>
      </Card>
      <div className="mt-6 space-y-3">{[...mine].reverse().map((m) => <Thread key={m.id} m={m} reply={<Badge tone="orange" className="mt-3">بانتظار الرد</Badge>} />)}</div>
    </div>
  );
}

function Inbox() {
  const db = useDB();
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [f, setF] = useState<'open' | 'all'>('open');
  const list = [...db.adminMessages].reverse().filter((m) => f === 'all' || !m.reply);
  return (
    <div>
      <PageHeader title="رسائل المشاركين" subtitle="ما يرسله المشاركون قبل تشكيل المجموعات" />
      <FilterPills value={f} onChange={setF} options={[{ key: 'open', label: `بلا رد (${db.adminMessages.filter((m) => !m.reply).length})` }, { key: 'all', label: `الكل (${db.adminMessages.length})` }]} />
      <div className="mt-4 space-y-3">
        {list.length === 0 ? <Empty title="لا رسائل" /> : list.map((m) => (
          <Thread key={m.id} m={m} reply={
            <div className="mt-3 flex gap-2"><Input value={replies[m.id] ?? ''} onChange={(e) => setReplies({ ...replies, [m.id]: e.target.value })} placeholder="الرد" /><Button disabled={!replies[m.id]} onClick={() => act(() => repos.messages.reply(m.id, replies[m.id]), 'أُرسل الرد')}>ردّ</Button></div>
          } />
        ))}
      </div>
    </div>
  );
}
