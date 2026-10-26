// معالج إنشاء الميزانية: خطوة بخطوة (لقاءات التركيز، العمرة، الرحلات، الافتتاحي والختامي، الاجتماعات، مراجعة)
import { useState } from 'react';
import { defaultDivisor, perItem } from '@/domain/finance';
import { SAR } from '@/domain/labels';
import type { AllocationRule, ProgramBudget } from '@/domain/types';
import { act, repos, useDB } from '@/state/store';
import { Field, Input, StepWizard, Textarea, cx } from '@/ui';

function RuleEditor({ rule, onChange, unitLabel, defaultDiv }: { rule: AllocationRule; onChange: (r: AllocationRule) => void; unitLabel: string; defaultDiv: number }) {
  const per = perItem(rule);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {([['per_item', `مبلغ لكل ${unitLabel}`], ['total', 'مبلغ إجمالي يُقسَّم']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => onChange({ ...rule, mode: k, divisor: rule.divisor || defaultDiv })}
            className={cx('min-h-[56px] rounded-2xl border p-3 text-sm font-medium', rule.mode === k ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-ink-200')}>{l}</button>
        ))}
      </div>
      {rule.mode === 'per_item' ? (
        <Field label={`المبلغ لكل ${unitLabel} (ر.س)`}><Input className="num" type="number" min={0} value={rule.perItem} onChange={(e) => onChange({ ...rule, perItem: Math.max(0, +e.target.value) })} /></Field>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="المبلغ الإجمالي (ر.س)"><Input className="num" type="number" min={0} value={rule.total} onChange={(e) => onChange({ ...rule, total: Math.max(0, +e.target.value) })} /></Field>
          <Field label="يُقسَّم على" hint={`الافتراضي ${defaultDiv}`}><Input className="num" type="number" min={1} value={rule.divisor} onChange={(e) => onChange({ ...rule, divisor: Math.max(1, +e.target.value) })} /></Field>
        </div>
      )}
      <div className="rounded-2xl bg-brand-50 px-4 py-3 text-brand-800">
        ناتج القسمة: <b className="num">{SAR(per)}</b> لكل {unitLabel}
        {rule.mode === 'total' && <span className="block text-xs">{SAR(rule.total)} ÷ {rule.divisor}</span>}
      </div>
    </div>
  );
}

export function BudgetWizard({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const db = useDB();
  const [b, setB] = useState<ProgramBudget>(structuredClone(db.programBudget));
  // بعد الاعتماد تُقفل الموازنة، والتعديل يذهب طلباً للقائد العام
  const locked = db.programBudget.setupDone;
  const [reason, setReason] = useState('');
  const set = (p: Partial<ProgramBudget>) => setB({ ...b, ...p });
  const num = (v: string) => Math.max(0, +v || 0);
  const groups = db.groups.length;
  const summary = [
    ['لقاءات التركيز', `${SAR(perItem(b.focus))} لكل لقاء (حد ${b.focusLimits.min} إلى ${b.focusLimits.max} لكل مجموعة)`],
    ['لقاء العمرة', `${SAR(b.umrahPerGroup)} لكل مجموعة × ${groups}`],
    ['الرحلات الداخلية', `${SAR(perItem(b.internalTrip))} لكل رحلة`],
    ['الرحلات الخارجية', `${SAR(perItem(b.externalTrip))} لكل رحلة`],
    ['اللقاء الافتتاحي', SAR(b.opening)],
    ['اللقاء الختامي', SAR(b.closing)],
    ['الاجتماعات', b.meetingDefault ? `${SAR(b.meetingDefault)} لكل اجتماع` : 'بلا مرصود'],
    ['احتياجات البرنامج', SAR(b.programNeeds)],
  ];
  return (
    <StepWizard onCancel={onCancel} finishLabel={locked ? 'أرسل طلب التعديل' : 'احفظ الموازنة واقفلها'} onFinish={() => act(() => {
      if (locked) repos.finance.requestEdit({ target: { kind: 'program_budget' }, patch: { budget: b }, summary: 'تعديل الموازنة العامة', reason });
      else repos.finance.setupBudget(b);
      onDone?.();
    }, locked ? 'رُفع طلب تعديل الموازنة للقائد العام' : 'حُفظت الموازنة وقُفلت، وأصبح استقبال الطلبات متاحاً')} steps={[
      {
        title: 'لقاءات التركيز',
        valid: perItem(b.focus) > 0 && b.focusLimits.min <= b.focusLimits.max,
        hint: 'حدد مبلغاً أكبر من صفر',
        content: (
          <div className="space-y-4">
            <RuleEditor rule={b.focus} onChange={(focus) => set({ focus })} unitLabel="لقاء" defaultDiv={defaultDivisor(db, 'focus')} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="الحد الأدنى لكل مجموعة"><Input className="num" type="number" value={b.focusLimits.min} onChange={(e) => set({ focusLimits: { ...b.focusLimits, min: num(e.target.value) } })} /></Field>
              <Field label="الحد الأعلى بميزانية"><Input className="num" type="number" value={b.focusLimits.max} onChange={(e) => set({ focusLimits: { ...b.focusLimits, max: num(e.target.value) } })} /></Field>
            </div>
          </div>
        ),
      },
      {
        title: 'لقاء العمرة', valid: b.umrahPerGroup > 0, hint: 'حدد مبلغ لقاء العمرة',
        content: (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">لقاء واحد لكل مجموعة، وله مبلغ مستقل أعلى من لقاءات التركيز العادية.</p>
            <Field label="المبلغ لكل مجموعة (ر.س)"><Input className="num" type="number" value={b.umrahPerGroup} onChange={(e) => set({ umrahPerGroup: num(e.target.value) })} /></Field>
            <p className="text-sm text-brand-800">الإجمالي: <b className="num">{SAR(b.umrahPerGroup * groups)}</b> لـ {groups} مجموعات</p>
          </div>
        ),
      },
      { title: 'الرحلات الداخلية', valid: perItem(b.internalTrip) > 0, hint: 'حدد مبلغاً أكبر من صفر', content: <RuleEditor rule={b.internalTrip} onChange={(internalTrip) => set({ internalTrip })} unitLabel="رحلة" defaultDiv={defaultDivisor(db, 'internal_trip')} /> },
      { title: 'الرحلات الخارجية', valid: perItem(b.externalTrip) > 0, hint: 'حدد مبلغاً أكبر من صفر', content: <RuleEditor rule={b.externalTrip} onChange={(externalTrip) => set({ externalTrip })} unitLabel="رحلة" defaultDiv={defaultDivisor(db, 'external_trip')} /> },
      {
        title: 'اللقاء الافتتاحي والختامي', valid: b.opening > 0 && b.closing > 0, hint: 'حدد مبلغ كل منهما',
        content: (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اللقاء الافتتاحي (ر.س)"><Input className="num" type="number" value={b.opening} onChange={(e) => set({ opening: num(e.target.value) })} /></Field>
            <Field label="اللقاء الختامي (ر.س)"><Input className="num" type="number" value={b.closing} onChange={(e) => set({ closing: num(e.target.value) })} /></Field>
          </div>
        ),
      },
      {
        title: 'الاجتماعات واحتياجات البرنامج',
        content: (
          <div className="space-y-3">
            <Field label="مرصود كل اجتماع (ر.س)" hint="صرف فعلي بعهدة لمسؤول الاجتماع، ويُعدَّل لكل اجتماع">
              <Input className="num" type="number" value={b.meetingDefault} onChange={(e) => set({ meetingDefault: num(e.target.value) })} />
            </Field>
            <Field label="احتياجات البرنامج (إجمالي ر.س)" hint="صرف مباشر أو عهدة أو عقود">
              <Input className="num" type="number" value={b.programNeeds} onChange={(e) => set({ programNeeds: num(e.target.value) })} />
            </Field>
          </div>
        ),
      },
      {
        title: 'مراجعة وحفظ', valid: !locked || !!reason.trim(), hint: 'اكتب سبب التعديل',
        content: (
          <div className="space-y-2">
            {summary.map(([k, v]) => <div key={k} className="flex justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm"><span>{k}</span><b className="num">{v}</b></div>)}
            {locked ? <Field label="سبب التعديل (يُرفع للقائد العام)"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              : <p className="text-xs text-ink-500">بعد الحفظ تُقفل الموازنة، وأي تعديل لاحق يُرفع طلباً يوافق عليه القائد العام.</p>}
          </div>
        ),
      },
    ]} />
  );
}
