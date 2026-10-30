// إعدادات فقرة ديمو المنصة: المشاهد الأربعة بصفة مشارك
import { cx } from '@/ui';
import { DEMO_SCENES, DEMO_SCENE_LABELS, DEMO_SCENE_STEPS, DEMO_STEP_LABELS, type DemoSegment, type DemoSettings, type DemoStepKey } from '../model';

export function DemoEditor({ seg, patch }: { seg: DemoSegment; patch: (s: Partial<DemoSettings>) => void }) {
  const on = new Set(seg.settings.scenes);
  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500">الديمو بصفة مشارك من البيانات التجريبية الثابتة، للقراءة فقط ولا يكتب في بيانات المنصة. في العرض: الأرقام 1–4 تقفز إلى أول كل مشهد.</p>
      <div className="space-y-2">
        {DEMO_SCENES.map((k, i) => (
          <button
            key={k}
            onClick={() => { const scenes = DEMO_SCENES.filter((x) => (x === k ? !on.has(k) : on.has(x))); if (scenes.length) patch({ scenes }); }}
            className={cx('flex w-full items-start gap-3 rounded-xl border p-3 text-start transition', on.has(k) ? 'border-brand-600/40 bg-brand-50' : 'border-ink-100 opacity-60 hover:opacity-100')}
          >
            <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold num', on.has(k) ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500')}>{i + 1}</span>
            <span>
              <span className="block text-sm font-medium text-ink-900">{DEMO_SCENE_LABELS[k]}</span>
              <span className="block text-xs text-ink-500">{DEMO_SCENE_STEPS[k].map((st) => DEMO_STEP_LABELS[`${k}.${st}` as DemoStepKey]).join(' ← ')}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
