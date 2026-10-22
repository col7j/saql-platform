// الخطة الشخصية وعجلة الحياة التفاعلية (قسم 8.2)
import { useState } from 'react';
import { addDays, fmtDate, fmtDateTime, todayISO } from '@/domain/dates';
import { uid } from '@/domain/id';
import { ASPECT_KEYS, aspectColor, aspectEvidenceHint, aspectLabel } from '@/domain/labels';
import { dueSteps, planProgress } from '@/domain/workflow';
import type { LifeAspect, LifeAspectKey, PlanStep } from '@/domain/types';
import { act, repos, useDB } from '@/state/store';
import { Badge, Button, Card, Field, Icons, Input, Modal, Notice, Progress, Textarea, Toggle, cx } from '@/ui';

const emptyAspect = (key: LifeAspectKey): LifeAspect => ({ key, level: 5, vision: '', steps: [] });

/** عجلة الحياة: ستة جوانب، يتغير شكلها كلما ارتفع المستوى */
export function LifeWheel({ aspects, onLevel, size = 320 }: { aspects: LifeAspect[]; onLevel?: (k: LifeAspectKey, level: number) => void; size?: number }) {
  const c = size / 2;
  const R = c - 34;
  const n = ASPECT_KEYS.length;
  const ang = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => [c + r * Math.cos(ang(i)), c + r * Math.sin(ang(i))];
  const level = (k: LifeAspectKey) => aspects.find((a) => a.key === k)?.level ?? 0;
  const sector = (i: number, r: number) => {
    const a0 = ang(i - 0.5), a1 = ang(i + 0.5);
    return `M ${c} ${c} L ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`;
  };
  const handle = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onLevel) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * size - c;
    const y = ((e.clientY - rect.top) / rect.height) * size - c;
    const dist = Math.sqrt(x * x + y * y);
    let a = Math.atan2(y, x) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    const i = Math.round(a / ((Math.PI * 2) / n)) % n;
    const lv = Math.max(1, Math.min(10, Math.round((dist / R) * 10)));
    onLevel(ASPECT_KEYS[i], lv);
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={cx('mx-auto w-full max-w-[340px] select-none', onLevel && 'cursor-pointer')} onClick={handle} style={{ direction: 'ltr' }}>
      {[2, 4, 6, 8, 10].map((l) => <circle key={l} cx={c} cy={c} r={(R * l) / 10} fill="none" stroke="#e6e8ea" strokeDasharray={l === 10 ? '' : '3 3'} />)}
      {ASPECT_KEYS.map((k, i) => <path key={k} d={sector(i, R)} fill={aspectColor[k]} opacity={0.07} />)}
      {ASPECT_KEYS.map((k, i) => <path key={k + 'v'} d={sector(i, (R * level(k)) / 10)} fill={aspectColor[k]} opacity={0.8} className="transition-all duration-300" />)}
      <polygon points={ASPECT_KEYS.map((k, i) => pt(i, (R * level(k)) / 10).join(',')).join(' ')} fill="none" stroke="#06384a" strokeWidth={1.5} strokeLinejoin="round" className="transition-all duration-300" />
      {ASPECT_KEYS.map((k, i) => {
        const [x, y] = pt(i, R + 18);
        return <text key={k + 't'} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={700} fill={aspectColor[k]} style={{ fontFamily: 'Thmanyah Sans' }}>{aspectLabel[k]} {level(k) || ''}</text>;
      })}
      <circle cx={c} cy={c} r={4} fill="#06384a" />
    </svg>
  );
}

export function PlanView({ participantId, editable }: { participantId: string; editable: boolean }) {
  const db = useDB();
  const plan = db.personalPlans.find((p) => p.participantId === participantId);
  const aspects = ASPECT_KEYS.map((k) => plan?.aspects.find((a) => a.key === k) ?? emptyAspect(k));
  const [active, setActive] = useState<LifeAspectKey>('spiritual');
  const pr = planProgress(plan);
  const due = editable ? dueSteps(plan) : [];
  const aspect = aspects.find((a) => a.key === active)!;

  return (
    <div className="space-y-6">
      {due.length > 0 && <FollowUpCard participantId={participantId} due={due} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card title="عجلة الحياة" subtitle={editable ? 'انقر على أي جانب لتحديد مستواك (1–10)' : 'المستوى الحالي في كل جانب'}>
          <LifeWheel aspects={aspects} onLevel={editable ? (k, l) => repos.plans.setLevel(participantId, k, l) : undefined} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {aspects.map((a) => {
              const done = a.steps.filter((s) => s.status === 'done').length;
              return (
                <button key={a.key} onClick={() => setActive(a.key)} className={cx('rounded-xl border p-2 text-start text-xs transition', active === a.key ? 'border-transparent text-white' : 'border-ink-100 hover:bg-ink-50')} style={active === a.key ? { background: aspectColor[a.key] } : {}}>
                  <div className="font-bold">{aspectLabel[a.key]}</div>
                  <div className={active === a.key ? 'text-white/85' : 'text-ink-400'}>مستوى {a.level} · {done}/{a.steps.length} خطوات</div>
                </button>
              );
            })}
          </div>
          <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>التقدم العام</span><span className="num">{pr.done} منجزة · {pr.started} جارية</span></div><Progress value={pr.ratio * 100} tone="green" /></div>
        </Card>
        <AspectEditor key={active + (plan?.updatedAt ?? '')} participantId={participantId} aspect={aspect} editable={editable} />
      </div>
    </div>
  );
}

function AspectEditor({ participantId, aspect, editable }: { participantId: string; aspect: LifeAspect; editable: boolean }) {
  const [a, setA] = useState(aspect);
  const [dirty, setDirty] = useState(false);
  const upd = (p: Partial<LifeAspect>) => { setA({ ...a, ...p }); setDirty(true); };
  const updStep = (id: string, p: Partial<PlanStep>) => upd({ steps: a.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) });
  const color = aspectColor[a.key];
  return (
    <Card title={<span style={{ color }}>الجانب {aspectLabel[a.key]}</span>} subtitle="رؤية تريد الوصول إليها، وتحتها خطوات عملية (العدد حر)"
      action={editable && dirty && <Button size="sm" onClick={() => act(() => { repos.plans.saveAspect(participantId, a); setDirty(false); }, 'حُفظ الجانب')}>احفظ</Button>}>
      <Field label="الرؤية">
        {editable ? <Textarea rows={2} value={a.vision} onChange={(e) => upd({ vision: e.target.value })} placeholder="إلى أين تريد أن تصل في هذا الجانب؟" /> : <p className="text-sm">{a.vision || <span className="text-ink-300">لم تُكتب بعد</span>}</p>}
      </Field>
      <div className="mt-4 space-y-3">
        {a.steps.map((s, i) => (
          <div key={s.id} className="rounded-2xl border p-3" style={{ borderColor: color + '40' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold" style={{ color }}>الخطوة {i + 1}</span>
              <span className="flex items-center gap-2">
                <Badge tone={s.status === 'done' ? 'green' : s.status === 'started' ? 'blue' : s.status === 'challenged' ? 'red' : 'gray'}>{{ pending: 'لم تبدأ', started: 'بدأت', done: 'منجزة', challenged: 'تواجه تحدياً' }[s.status]}</Badge>
                {editable && <button onClick={() => upd({ steps: a.steps.filter((x) => x.id !== s.id) })} className="text-ink-300 hover:text-red-600"><Icons.Trash2 className="h-4 w-4" /></button>}
              </span>
            </div>
            {editable ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label="الخطوة"><Input value={s.title} onChange={(e) => updStep(s.id, { title: e.target.value })} /></Field>
                <Field label="تاريخ البدء"><Input type="date" value={s.startDate} onChange={(e) => updStep(s.id, { startDate: e.target.value })} /></Field>
                <Field label="الأهمية والفوائد (بحث)"><Textarea rows={2} value={s.importance} onChange={(e) => updStep(s.id, { importance: e.target.value })} /></Field>
                <Field label={`الأدلة المعرفية: ${aspectEvidenceHint[a.key]}`}><Textarea rows={2} value={s.evidence} onChange={(e) => updStep(s.id, { evidence: e.target.value })} /></Field>
                <Field label="كيف ومتى أبدأ؟" className="sm:col-span-2"><Input value={s.howWhen} onChange={(e) => updStep(s.id, { howWhen: e.target.value })} /></Field>
              </div>
            ) : (
              <div className="mt-2 space-y-1 text-sm">
                <div className="font-medium">{s.title} <span className="text-xs text-ink-400">· تبدأ {fmtDate(s.startDate)}</span></div>
                <div className="text-xs text-ink-500"><b>الأهمية:</b> {s.importance}</div>
                <div className="text-xs text-ink-500"><b>الأدلة:</b> {s.evidence}</div>
                <div className="text-xs text-ink-500"><b>كيف ومتى:</b> {s.howWhen}</div>
              </div>
            )}
            {s.followUps.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-ink-100 pt-2">
                {s.followUps.map((f) => (
                  <div key={f.id} className="text-xs text-ink-600">
                    <span className="text-ink-400">{fmtDateTime(f.at)}:</span> {f.progress}
                    {f.challenge && <span className="text-red-600"> · التحدي: {f.challenge}</span>}
                    {f.overcome && <span> · الحل: {f.overcome}</span>}
                    {f.needHelp && <Badge tone="red" className="ms-1">يحتاج مساعدة</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {editable && (
          <Button variant="secondary" onClick={() => upd({ steps: [...a.steps, { id: uid('st'), title: '', startDate: addDays(todayISO(), 7), importance: '', evidence: '', howWhen: '', status: 'pending', followUps: [] }] })} icon={<Icons.Plus className="h-4 w-4" />}>إضافة خطوة</Button>
        )}
        {!editable && a.steps.length === 0 && <p className="text-sm text-ink-400">لا خطوات</p>}
      </div>
    </Card>
  );
}

function FollowUpCard({ participantId, due }: { participantId: string; due: ReturnType<typeof dueSteps> }) {
  const [step, setStep] = useState<(typeof due)[number] | null>(null);
  return (
    <Card className="border-accent-200 bg-accent-50/40" title={<span className="flex items-center gap-2"><Icons.Sparkles className="h-5 w-5 text-accent-600" />المتابعة الذكية</span>} subtitle="حان تاريخ هذه الخطوات">
      <div className="space-y-2">
        {due.map((d) => (
          <div key={d.stepId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
            <span className="text-sm"><b>{d.title}</b> <span className="text-xs text-ink-400">({aspectLabel[d.aspectKey as LifeAspectKey]} · {fmtDate(d.startDate)})</span></span>
            <Button size="sm" variant="accent" onClick={() => setStep(d)}>وش صار؟ هل بدأت؟</Button>
          </div>
        ))}
      </div>
      {step && <FollowUpModal participantId={participantId} step={step} onClose={() => setStep(null)} />}
    </Card>
  );
}

function FollowUpModal({ participantId, step, onClose }: { participantId: string; step: { stepId: string; title: string }; onClose: () => void }) {
  const [answer, setAnswer] = useState<'started' | 'done' | 'not' | 'challenge' | null>(null);
  const [progress, setProgress] = useState('');
  const [challenge, setChallenge] = useState('');
  const [overcome, setOvercome] = useState('');
  const [needHelp, setNeedHelp] = useState(false);
  const submit = () => act(() => {
    const status = answer === 'done' ? 'done' : answer === 'started' ? 'started' : answer === 'challenge' ? 'challenged' : 'pending';
    repos.plans.followUp(participantId, step.stepId, { started: answer !== 'not', progress: progress || { started: 'بدأت', done: 'أنجزتها', not: 'لم أبدأ بعد', challenge: 'واجهت تحدياً' }[answer!], challenge: challenge || undefined, overcome: overcome || undefined, needHelp }, status);
    onClose();
  }, needHelp ? 'سُجّلت المتابعة ووصل الميسّر طلب المساعدة' : 'سُجّلت المتابعة');
  return (
    <Modal open onClose={onClose} title={`وش صار في "${step.title}"؟`} footer={<Button disabled={!answer} onClick={submit}>احفظ</Button>}>
      <div className="grid grid-cols-2 gap-2">
        {([['done', 'أنجزتها', Icons.CheckCircle2], ['started', 'بدأت وأكمل', Icons.PlayCircle], ['challenge', 'واجهت تحديات', Icons.AlertTriangle], ['not', 'لم أبدأ بعد', Icons.PauseCircle]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setAnswer(k)} className={cx('flex items-center gap-2 rounded-xl border p-3 text-sm', answer === k ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-ink-200')}><I className="h-4 w-4" />{l}</button>
        ))}
      </div>
      {answer && <Field label="اكتب باختصار" className="mt-3"><Input value={progress} onChange={(e) => setProgress(e.target.value)} /></Field>}
      {answer === 'challenge' && (
        <div className="mt-3 space-y-3 rounded-xl bg-accent-50 p-3">
          <Field label="ما التحدي؟"><Input value={challenge} onChange={(e) => setChallenge(e.target.value)} /></Field>
          <Field label="كيف تتغلب عليه؟"><Input value={overcome} onChange={(e) => setOvercome(e.target.value)} /></Field>
          <Toggle checked={needHelp} onChange={setNeedHelp} label="أحتاج مساعدة من الميسّر" />
        </div>
      )}
      <Notice>تصل هذه المتابعة لميسّرك ليتابع خطتك معك.</Notice>
    </Modal>
  );
}
