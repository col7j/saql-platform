// مؤقت حتى المرحلة 3: عنوان المشهد والخطوة
import { DEMO_SCENE_LABELS, DEMO_STEP_LABELS, demoSteps, type DemoSegment } from '../model';
import { Backdrop } from '../segments/Fallback';

export default function DemoView({ seg, step }: { seg: DemoSegment; step: number; active: boolean }) {
  const d = demoSteps(seg.settings)[step];
  return (
    <Backdrop>
      <div className="show-center">
        <div>
          <h1 className="show-title">{d ? DEMO_SCENE_LABELS[d.scene] : seg.title}</h1>
          {d && <p className="show-kicker mt-6">{DEMO_STEP_LABELS[d.key]}</p>}
        </div>
      </div>
    </Backdrop>
  );
}
