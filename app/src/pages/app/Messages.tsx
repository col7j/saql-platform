// التواصل مع الإدارة في مرحلة ما قبل التشكيل
import { useState } from 'react';
import { fmtDateTime } from '@/domain/dates';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Button, Card, Empty, Input, PageHeader, Textarea } from '@/ui';
import { PersonChip } from '@/ui/domain';

export function ContactPage() {
  const db = useDB();
  const me = useMe();
  const [text, setText] = useState('');
  const mine = db.adminMessages.filter((m) => m.fromId === me.person.id);
  return (
    <div>
      <PageHeader title="تواصل مع الإدارة" subtitle="قبل تشكيل المجموعات يتواصل المشاركون مع الإدارة من داخل المنصة" />
      <Card>
        <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالتك" />
        <Button className="mt-2" disabled={!text.trim()} onClick={() => act(() => { repos.messages.send(text); setText(''); }, 'أُرسلت الرسالة')}>أرسل</Button>
      </Card>
      <div className="mt-4 space-y-3">
        {mine.map((m) => (
          <Card key={m.id}>
            <p className="text-sm">{m.text}</p>
            <div className="text-xs text-ink-400">{fmtDateTime(m.at)}</div>
            {m.reply && <div className="mt-2 rounded-xl bg-brand-50 p-2 text-sm"><b>{personName(db, m.reply.byId)}:</b> {m.reply.text}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function InboxPage() {
  const db = useDB();
  const [replies, setReplies] = useState<Record<string, string>>({});
  return (
    <div>
      <PageHeader title="رسائل المشاركين" />
      {db.adminMessages.length === 0 ? <Empty title="لا رسائل" /> : (
        <div className="space-y-3">
          {[...db.adminMessages].reverse().map((m) => (
            <Card key={m.id}>
              <div className="flex items-center justify-between"><PersonChip id={m.fromId} /><span className="text-xs text-ink-400">{fmtDateTime(m.at)}</span></div>
              <p className="mt-2 text-sm">{m.text}</p>
              {m.reply ? <div className="mt-2 rounded-xl bg-brand-50 p-2 text-sm"><b>الرد:</b> {m.reply.text}</div> : (
                <div className="mt-2 flex gap-2"><Input value={replies[m.id] ?? ''} onChange={(e) => setReplies({ ...replies, [m.id]: e.target.value })} placeholder="الرد" /><Button disabled={!replies[m.id]} onClick={() => act(() => repos.messages.reply(m.id, replies[m.id]), 'أُرسل الرد')}>ردّ</Button></div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
