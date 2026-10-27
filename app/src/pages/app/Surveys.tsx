// الاستبيانات القبلية والبعدية (قسم 9) + قياس الأثر
import { useState } from 'react';
import { fmtDate, nowISO } from '@/domain/dates';
import { uid } from '@/domain/id';
import { surveysForPerson } from '@/domain/workflow';
import type { Question, QuestionType, Survey } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, Notice, PageHeader, Progress, Select, Tabs, Textarea, Toggle, cx } from '@/ui';

const ctxTitle = (db: ReturnType<typeof useDB>, s: Survey) =>
  s.context.kind === 'program' ? 'البرنامج' : s.context.kind === 'trip' ? db.trips.find((t) => t.id === s.context.id)?.title : db.focusMeetings.find((f) => f.id === s.context.id)?.title;

export default function SurveysPage() {
  const me = useMe();
  return me.isStaff ? <StaffSurveys /> : <ParticipantSurveys />;
}

function ParticipantSurveys() {
  const db = useDB();
  const me = useMe();
  const [filling, setFilling] = useState<Survey | null>(null);
  const list = surveysForPerson(db, me.person.id);
  const done = (s: Survey) => s.responses.some((r) => r.personId === me.person.id);
  return (
    <div>
      <PageHeader title="الاستبيانات" subtitle="إلزامية في الرحلات، واختيارية في لقاءات التركيز. تساعدنا على قياس أثر البرنامج" />
      {list.length === 0 ? <Empty title="لا استبيانات متاحة" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {[...list].sort((a, b) => Number(done(a)) - Number(done(b))).map((s, i) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={s.phase === 'pre' ? 'blue' : 'purple'}>{s.phase === 'pre' ? 'قبلي' : 'بعدي'}</Badge>
                <Badge tone={s.mandatory ? 'orange' : 'gray'}>{s.mandatory ? 'إلزامي' : 'اختياري'}</Badge>
                {done(s) && <Badge tone="green">عبّأته</Badge>}
              </div>
              <h3 className="mt-2 font-bold">{s.title}</h3>
              <p className="text-xs text-ink-500">{ctxTitle(db, s)} · {s.questions.length} أسئلة</p>
              <Button className="mt-3" size="sm" variant={!done(s) && i === 0 ? 'primary' : 'secondary'} onClick={() => setFilling(s)}>{done(s) ? 'عدّل إجابتي' : 'عبّئ الاستبيان'}</Button>
            </Card>
          ))}
        </div>
      )}
      {filling && <FillModal survey={filling} onClose={() => setFilling(null)} />}
    </div>
  );
}

function FillModal({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const me = useMe();
  const prev = survey.responses.find((r) => r.personId === me.person.id)?.answers ?? {};
  const [ans, setAns] = useState<Record<string, string>>(prev);
  const complete = survey.questions.every((q) => q.type === 'text' || ans[q.id]);
  const general = survey.questions.filter((q) => q.isGeneral);
  const specific = survey.questions.filter((q) => !q.isGeneral);
  const renderQ = (q: Question, i: number) => (
    <div key={q.id} className="rounded-2xl border border-ink-100 p-3">
      <div className="mb-2 text-sm font-medium"><span className="num text-ink-400">{i + 1}. </span>{q.text}</div>
      {q.type === 'scale' && (
        <div className="flex gap-1.5" dir="ltr">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setAns({ ...ans, [q.id]: String(n) })} className={cx('num h-10 flex-1 rounded-xl border text-sm font-bold', ans[q.id] === String(n) ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 hover:bg-brand-50')}>{n}</button>)}
        </div>
      )}
      {q.type === 'scale' && <div className="mt-1 flex justify-between text-xs text-ink-400"><span>كثيراً</span><span>قليلاً</span></div>}
      {q.type === 'choice' && <div className="flex flex-wrap gap-1.5">{q.options?.map((o) => <button key={o} onClick={() => setAns({ ...ans, [q.id]: o })} className={cx('chip border py-1', ans[q.id] === o ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-200')}>{o}</button>)}</div>}
      {q.type === 'text' && <Textarea rows={2} value={ans[q.id] ?? ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} />}
    </div>
  );
  return (
    <Modal open onClose={onClose} title={survey.title} wide footer={<Button disabled={!complete} onClick={() => act(() => { repos.surveys.respond(survey.id, ans); onClose(); }, 'شكراً، سُجّلت إجاباتك')}>أرسل</Button>}>
      <div className="space-y-3">
        {specific.map(renderQ)}
        {general.length > 0 && <div className="pt-2 text-xs font-bold text-ink-500">الرضا والأثر العام</div>}
        {general.map((q, i) => renderQ(q, specific.length + i))}
      </div>
    </Modal>
  );
}

function StaffSurveys() {
  const db = useDB();
  const [tab, setTab] = useState<'list' | 'impact'>('list');
  const [building, setBuilding] = useState(false);
  const [viewing, setViewing] = useState<Survey | null>(null);
  const participants = db.persons.filter((p) => p.kind === 'participant').length;
  return (
    <div>
      <PageHeader title="الاستبيانات وقياس الأثر" subtitle="فريق الإعداد يجهّز الأسئلة، والبعدي يقابل القبلي بصياغة مختلفة" actions={<Button onClick={() => setBuilding(true)} icon={<Icons.Plus className="h-4 w-4" />}>أنشئ استبياناً</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'list', label: 'كل الاستبيانات' }, { key: 'impact', label: 'قياس الأثر (قبلي/بعدي)' }]} />
      {tab === 'list' ? (
        <Card pad={false}>
          <div className="divide-y divide-ink-100">
            {db.surveys.map((s) => (
              <button key={s.id} onClick={() => setViewing(s)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-start hover:bg-ink-50 sm:px-5">
                <Badge tone={s.phase === 'pre' ? 'blue' : 'purple'}>{s.phase === 'pre' ? 'قبلي' : 'بعدي'}</Badge>
                <div className="min-w-0 flex-1"><div className="text-sm font-medium">{s.title}</div><div className="text-xs text-ink-400">{ctxTitle(db, s)} · يُفتح {fmtDate(s.opensAt)} · {s.mandatory ? 'إلزامي' : 'اختياري'}</div></div>
                <div className="w-36"><Progress value={(s.responses.length / participants) * 100} /><div className="num mt-0.5 text-xs text-ink-400">{s.responses.length} استجابة</div></div>
              </button>
            ))}
          </div>
        </Card>
      ) : <Impact />}
      {building && <Builder onClose={() => setBuilding(false)} />}
      {viewing && <Results survey={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

const avg = (s: Survey, qid: string) => {
  const v = s.responses.map((r) => Number(r.answers[qid])).filter((x) => !isNaN(x) && x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function Impact() {
  const db = useDB();
  const posts = db.surveys.filter((s) => s.phase === 'post' && s.preSurveyId);
  if (!posts.length) return <Empty title="لا أزواج قبلي/بعدي بعد" />;
  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const pre = db.surveys.find((s) => s.id === post.preSurveyId)!;
        return (
          <Card key={post.id} title={ctxTitle(db, post)} subtitle={`${pre.responses.length} قبلي · ${post.responses.length} بعدي`}>
            <div className="space-y-3">
              {post.questions.filter((q) => q.pairsWith).map((q) => {
                const pq = pre.questions.find((x) => x.id === q.pairsWith)!;
                const a = avg(pre, pq.id), b = avg(post, q.id);
                return (
                  <div key={q.id} className="grid gap-2 rounded-xl bg-ink-50 p-3 text-sm md:grid-cols-[1fr_1fr_auto]">
                    <div><div className="text-xs text-ink-400">قبلي</div>{pq.text}<Progress value={((a ?? 0) / 5) * 100} className="mt-1" /></div>
                    <div><div className="text-xs text-ink-400">بعدي</div>{q.text}<Progress value={((b ?? 0) / 5) * 100} tone="green" className="mt-1" /></div>
                    <div className="self-center text-center"><div className="num text-lg font-bold text-emerald-700">{a != null && b != null ? `${b - a >= 0 ? '+' : ''}${(b - a).toFixed(1)}` : '—'}</div><div className="text-xs text-ink-400">التغيّر</div></div>
                  </div>
                );
              })}
              {post.questions.filter((q) => q.isGeneral && q.type === 'scale').map((q) => (
                <div key={q.id} className="flex items-center justify-between text-sm"><span>{q.text}</span><span className="num font-bold">{avg(post, q.id)?.toFixed(1) ?? '—'} / 5</span></div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Results({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={survey.title} wide>
      <div className="space-y-3">
        {survey.questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-ink-100 p-3 text-sm">
            <div className="font-medium">{q.text} {q.isGeneral && <Badge>عام</Badge>}</div>
            {q.type === 'scale' && <div className="mt-1 flex items-center gap-2"><Progress value={((avg(survey, q.id) ?? 0) / 5) * 100} className="flex-1" /><span className="num">{avg(survey, q.id)?.toFixed(1) ?? '—'}</span></div>}
            {q.type === 'choice' && q.options?.map((o) => <div key={o} className="mt-1 flex justify-between text-xs"><span>{o}</span><span className="num">{survey.responses.filter((r) => r.answers[q.id] === o).length}</span></div>)}
            {q.type === 'text' && <ul className="mt-1 list-disc ps-5 text-xs text-ink-600">{survey.responses.map((r) => r.answers[q.id]).filter(Boolean).slice(0, 6).map((t, i) => <li key={i}>{t}</li>)}</ul>}
          </div>
        ))}
        {survey.responses.length === 0 && <p className="text-sm text-ink-400">لا استجابات بعد</p>}
      </div>
    </Modal>
  );
}

function Builder({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const me = useMe();
  const [ctx, setCtx] = useState('program');
  const [title, setTitle] = useState('');
  const [mandatory, setMandatory] = useState(true);
  const [pairs, setPairs] = useState<{ pre: string; post: string; type: QuestionType }[]>([{ pre: '', post: '', type: 'scale' }]);
  const [general, setGeneral] = useState(['ما مدى رضاك بشكل عام؟', 'ما مدى رضاك عن المادة العلمية؟']);
  const context: Survey['context'] = ctx === 'program' ? { kind: 'program' } : ctx.startsWith('t:') ? { kind: 'trip', id: ctx.slice(2) } : { kind: 'focus', id: ctx.slice(2) };
  const save = () => act(() => {
    if (!title.trim()) throw new Error('العنوان مطلوب');
    const preId = uid('sv'), postId = uid('sv');
    const preQs = pairs.filter((p) => p.pre).map((p, i) => ({ id: `${preId}_q${i}`, text: p.pre, type: p.type }));
    repos.surveys.save({ id: preId, title: `${title} — قبلي`, context, phase: 'pre', mandatory, questions: preQs, opensAt: nowISO(), responses: [], createdBy: me.person.id });
    repos.surveys.save({
      id: postId, title: `${title} — بعدي`, context, phase: 'post', preSurveyId: preId, mandatory, opensAt: new Date(Date.now() + 86400000 * 3).toISOString(), responses: [], createdBy: me.person.id,
      questions: [...pairs.filter((p) => p.pre).map((p, i) => ({ id: `${postId}_q${i}`, text: p.post || p.pre, type: p.type, pairsWith: preQs[i].id })), ...general.filter(Boolean).map((g, i) => ({ id: `${postId}_g${i}`, text: g, type: 'scale' as const, isGeneral: true }))],
    });
    onClose();
  }, 'أُنشئ الاستبيانان القبلي والبعدي');
  return (
    <Modal open onClose={onClose} title="استبيان قبلي/بعدي جديد" wide footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button onClick={save}>أنشئ</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العنوان"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="مرتبط بـ"><Select value={ctx} onChange={(e) => { setCtx(e.target.value); setMandatory(!e.target.value.startsWith('f:')); }} options={[{ value: 'program', label: 'البرنامج عامة' }, ...db.trips.map((t) => ({ value: `t:${t.id}`, label: `رحلة: ${t.title}` })), ...db.focusMeetings.map((f) => ({ value: `f:${f.id}`, label: `لقاء تركيز: ${f.title}` }))]} /></Field>
        <Toggle checked={mandatory} onChange={setMandatory} label="إلزامي" />
      </div>
      <Notice>عند إضافة سؤال قبلي، اكتب مقابله البعدي بصياغة مختلفة. مثال: "هل تعرف ما هي عجلة الحياة؟" ← "بعد حضورك، بماذا تعرّف عجلة الحياة؟"</Notice>
      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[1fr_1fr_100px_24px] gap-2 text-xs font-bold text-ink-500"><span>السؤال القبلي</span><span>مقابله البعدي</span><span>النوع</span><span /></div>
        {pairs.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_100px_24px] gap-2">
            <Input value={p.pre} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, pre: e.target.value } : x)))} />
            <Input value={p.post} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, post: e.target.value } : x)))} />
            <Select value={p.type} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, type: e.target.value as QuestionType } : x)))} options={[{ value: 'scale', label: 'مقياس' }, { value: 'text', label: 'نص' }]} />
            <button onClick={() => setPairs(pairs.filter((_, j) => j !== i))} className="text-ink-300 hover:text-red-600"><Icons.X className="h-4 w-4" /></button>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setPairs([...pairs, { pre: '', post: '', type: 'scale' }])}>أضف سؤالاً</Button>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-xs font-bold text-ink-500">الاستبيان العام (رضا وأثر): جزء من البعدي</div>
        {general.map((g, i) => <Input key={i} className="mb-2" value={g} onChange={(e) => setGeneral(general.map((x, j) => (j === i ? e.target.value : x)))} />)}
        <Button size="sm" variant="secondary" onClick={() => setGeneral([...general, ''])}>أضف سؤالاً عاماً</Button>
      </div>
    </Modal>
  );
}
