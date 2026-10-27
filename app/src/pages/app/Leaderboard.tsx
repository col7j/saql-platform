// صفحة الترتيب والتقييم: تظهر بعد نشر التشكيل، وترتيب المجموعات والأفراد بالأسماء يظهر أيضاً في الموقع العام ورابط الداعم
import { useState } from 'react';
import { act, personName, repos, useDB, useMe, useScores } from '@/state/store';
import { groupsPublished } from '@/domain/permissions';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, Notice, PageHeader, Progress, Select, Table, Tabs, cx } from '@/ui';
import { GroupBadge, PersonChip } from '@/ui/domain';

const medal = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const db = useDB();
  const me = useMe();
  const scores = useScores();
  const [tab, setTab] = useState<'ranking' | 'groups' | 'log' | 'staff'>('ranking');
  const [award, setAward] = useState(false);
  const groups = [...scores.groups].sort((a, b) => a.rank - b.rank);
  const persons = [...scores.persons].sort((a, b) => a.rank - b.rank);
  const mine = scores.persons.find((p) => p.personId === me.person.id);
  const s = db.settings;
  const log = scores.log.filter((l) => me.isStaff || l.personId === me.person.id || l.groupId === me.group?.id);
  if (me.isParticipant && !groupsPublished(db)) return <div><PageHeader title="الترتيب" /><Empty title="يظهر الترتيب يوم نشر التشكيل" /></div>;

  return (
    <div>
      <PageHeader title="الترتيب والتقييم" subtitle={`${s.split.individual}% فردي و${s.split.group}% جماعي · النقاط كسب فقط، لا خصم أبداً · معظم البنود تُحسب حياً من نشاط المنصة`}
        actions={me.isLeader && <Button variant="secondary" onClick={() => setAward(true)} icon={<Icons.Plus className="h-4 w-4" />}>سجّل نقاطاً يدوية</Button>} />
      <Notice icon={<Icons.Info className="h-4 w-4" />}>بعد نشر التشكيل يظهر ترتيب المجموعات والأفراد بالأسماء في المنصة والموقع العام ورابط الداعم، أما النقاط وتفصيلها فداخل المنصة فقط. تقييم المقدّمين يُضاف بعد نهاية البرنامج.</Notice>
      <div className="mt-4"><Tabs value={tab} onChange={setTab} tabs={[{ key: 'ranking', label: 'الترتيب' }, { key: 'groups', label: 'تفصيل المجموعات' }, { key: 'log', label: 'سجل النقاط' }, ...(me.isStaff ? [{ key: 'staff' as const, label: 'نقاط الإدارة' }] : [])]} /></div>

      {tab === 'ranking' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="ترتيب المجموعات" className="lg:col-span-2">
            <div className="space-y-3">
              {groups.map((g) => {
                const gr = db.groups.find((x) => x.id === g.groupId)!;
                return (
                  <div key={g.groupId} className={cx('flex items-center gap-4 rounded-2xl border p-3', me.group?.id === g.groupId ? 'border-brand-300 bg-brand-50/50' : 'border-ink-100')}>
                    <span className="num w-8 text-center text-2xl">{medal[g.rank - 1] ?? g.rank}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold" style={{ color: gr.color }}>{gr.name}</div>
                      <div className="mt-1 flex gap-3 text-xs text-ink-500"><span>داخلية {g.internal.points}/{g.internal.max}</span><span>خارجية {g.external.points}/{g.external.max}</span></div>
                      <Progress value={(g.total / s.split.group) * 100} className="mt-1.5" />
                    </div>
                    <span className="num text-xl font-black">{g.total}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="space-y-6">
            {mine && (
              <Card title="مستواي ومكاني">
                <div className="text-center">
                  <div className="num text-4xl font-black text-brand-700">#{mine.rank}</div>
                  <div className="text-sm text-ink-500">من {persons.length} مشاركاً · {mine.total} نقطة</div>
                </div>
                <div className="mt-4 space-y-2">
                  {mine.individual.map((i) => (
                    <div key={i.key}>
                      <div className="flex justify-between text-xs"><span>{i.name} {i.mode === 'auto' ? <Badge className="ms-1">تلقائي</Badge> : <Badge tone="orange" className="ms-1">يدوي</Badge>}</span><span className="num">{i.points}/{i.maxPoints}</span></div>
                      <Progress value={Math.min(100, (i.points / (i.maxPoints || 1)) * 100)} className="mt-0.5" />
                      <div className="text-xs text-ink-400">{i.detail}</div>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-ink-100 pt-2 text-sm"><span>الجماعي (من مجموعتي)</span><span className="num font-bold">{mine.groupShare}</span></div>
                </div>
              </Card>
            )}
            <Card title="أفضل 5 أفراد">
              <ol className="space-y-2">
                {persons.slice(0, 5).map((p) => (
                  <li key={p.personId} className="flex items-center gap-3">
                    <span className="num w-6 text-center">{medal[p.rank - 1] ?? p.rank}</span>
                    <div className="min-w-0 flex-1"><PersonChip id={p.personId} size={26} /></div>
                    <span className="num font-bold">{p.total}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}

      {tab === 'groups' && (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.groupId} title={<GroupBadge id={g.groupId} />} subtitle={`المجموع ${g.total} من ${s.split.group} · يُوزَّع على الأعضاء بالتساوي`}>
              <div className="grid gap-4 md:grid-cols-2">
                {(['internal', 'external'] as const).map((k) => (
                  <div key={k}>
                    <div className="mb-2 text-sm font-bold">{k === 'internal' ? 'الرحلات الداخلية' : 'الرحلات الخارجية'} <span className="num font-normal text-ink-500">({g[k].points}/{g[k].max})</span></div>
                    {g[k].trips.length === 0 && <p className="text-xs text-ink-400">لا رحلات</p>}
                    {g[k].trips.map((t) => (
                      <div key={t.tripId} className="rounded-xl bg-ink-50 p-3">
                        <div className="mb-2 text-xs font-medium">{t.title}</div>
                        {t.items.map((i) => (
                          <div key={i.key} className="flex justify-between py-0.5 text-xs"><span>{i.name} <span className="text-ink-400">{i.detail && `· ${i.detail}`}</span></span><span className="num">{i.points}/{i.maxPoints}</span></div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'log' && (
        <Card pad={false} title="سجل النقاط" subtitle="المصدر، والشخص أو المجموعة، وتلقائية أو يدوية">
          <Table>
            <thead><tr><th>لمن</th><th>المصدر</th><th>النوع</th><th>النقاط</th></tr></thead>
            <tbody>
              {log.slice(0, 200).map((l) => (
                <tr key={l.id}>
                  <td>{l.personId ? <PersonChip id={l.personId} size={22} /> : <GroupBadge id={l.groupId} />}</td>
                  <td className="text-xs">{l.source}</td>
                  <td><Badge tone={l.auto ? 'blue' : 'orange'}>{l.auto ? 'تلقائي' : 'يدوي'}</Badge></td>
                  <td className="num font-medium text-emerald-700">+{l.points}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === 'staff' && (
        <Card title="نقاط المواد الإثرائية لأعضاء الإدارة" subtitle={`${s.enrichmentPointsPerMaterial} نقاط لكل مادة عامة يعتمدها القائد العام`}>
          <Table>
            <thead><tr><th>العضو</th><th>مواد معتمدة</th><th>النقاط</th></tr></thead>
            <tbody>{scores.staff.map((st) => <tr key={st.personId}><td><PersonChip id={st.personId} size={22} /></td><td className="num">{st.approvedMaterials}</td><td className="num font-bold">{st.enrichment}</td></tr>)}</tbody>
          </Table>
        </Card>
      )}
      {award && <AwardModal onClose={() => setAward(false)} />}
    </div>
  );
}

function AwardModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const [f, setF] = useState({ personId: db.persons.find((p) => p.kind === 'participant')!.id, points: 1, source: '' });
  return (
    <Modal open onClose={onClose} title="نقاط يدوية (في أضيق الحدود)" footer={<Button disabled={!f.source} onClick={() => act(() => { repos.points.addManual({ personId: f.personId, points: f.points, source: f.source, itemKey: 'manual', scope: 'individual' }); onClose(); }, 'سُجّلت النقاط')}>سجّل</Button>}>
      <div className="grid gap-3">
        <Field label="المشارك"><Select value={f.personId} onChange={(e) => setF({ ...f, personId: e.target.value })} options={db.persons.filter((p) => p.kind === 'participant').map((p) => ({ value: p.id, label: personName(db, p.id) }))} /></Field>
        <Field label="النقاط" hint="كسب فقط، لا يمكن إدخال قيمة سالبة"><Input type="number" min={0} value={f.points} onChange={(e) => setF({ ...f, points: Math.max(0, +e.target.value) })} /></Field>
        <Field label="المصدر/السبب"><Input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
