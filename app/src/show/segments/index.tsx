// عرض الفقرة: شريحة حرّة (slides/SlideView) أو ديمو المنصة. كل مكوّن يأخذ الخطوة الحالية فقط، والتنقل في nav.ts.
import { lazy, Suspense } from 'react';
import type { Segment, SlideSegment } from '../model';
import { FitStage, SlideCanvas } from '../slides/SlideView';
import { Backdrop, SegmentBoundary } from './Fallback';

const DemoView = lazy(() => import('../demo/DemoView'));

export interface SegProps<S extends Segment = Segment> {
  seg: S;
  step: number;
  /** الفقرة المعروضة الآن (لا الخارجة في الانتقال أو المعاينة المتوقفة) */
  active: boolean;
  onSkip: () => void;
}

/** شرائح الشعار الكبير والشاشة السوداء: لا يظهر شعار الزاوية */
export const hidesCornerMark = (seg?: Segment) => seg?.type === 'slide' && !seg.settings.mark;

export function SegmentView(p: SegProps) {
  return (
    <SegmentBoundary key={p.seg.id} title={p.seg.title}>
      {p.seg.type === 'demo' ? (
        <Suspense fallback={<Backdrop />}>
          <DemoView seg={p.seg} step={p.step} active={p.active} />
        </Suspense>
      ) : (
        <SlidePlayer {...(p as SegProps<SlideSegment>)} />
      )}
    </SegmentBoundary>
  );
}

function SlidePlayer({ seg, step, active, onSkip }: SegProps<SlideSegment>) {
  return (
    <div className="absolute inset-0" style={{ background: 'rgb(var(--t-bg))' }}>
      <FitStage>{(scale) => <SlideCanvas settings={seg.settings} step={step} mode="play" active={active} scale={scale} onSkip={onSkip} />}</FitStage>
    </div>
  );
}
