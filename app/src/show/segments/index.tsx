// عرض الفقرة: شريحة حرّة (slides/SlideView) أو ديمو المنصة. كل مكوّن يأخذ الخطوة الحالية فقط، والتنقل في nav.ts.
import { lazy, Suspense } from 'react';
import type { Segment, ShowTheme, SlideSegment } from '../model';
import { FitStage, SlideCanvas } from '../slides/SlideView';
import { Backdrop, SegmentBoundary } from './Fallback';
import type { DemoNav } from '../demo/DemoView';
import { AgreementsView, LaunchView, PhotoView, RosterView, WhoAmIView } from '../ceremony/views';

const DemoView = lazy(() => import('../demo/DemoView'));

export interface SegProps<S extends Segment = Segment> {
  seg: S;
  step: number;
  /** الفقرة المعروضة الآن (لا الخارجة في الانتقال أو المعاينة المتوقفة) */
  active: boolean;
  onSkip: () => void;
  theme: ShowTheme;
  /** حركات الدخول (افتراضياً تعمل) */
  animate?: boolean;
  /** الديمو: الجولة تعمل، وانتقالها للصفحة التالية، وانتهاؤها، ومعالج التنقل اليدوي */
  playing?: boolean;
  onAdvance?: () => void;
  onEnd?: () => void;
  registerNav?: (fn: DemoNav | null) => void;
  /** الصورة الجماعية: رقم تشغيل العدّ التنازلي (يزيد مع كل تشغيل) */
  photoRun?: number;
}

/** شرائح الشعار الكبير والشاشة السوداء: لا يظهر شعار الزاوية */
export const hidesCornerMark = (seg?: Segment) => (seg?.type === 'slide' && !seg.settings.mark) || seg?.type === 'launch';

export function SegmentView(p: SegProps) {
  return (
    <SegmentBoundary key={p.seg.id} title={p.seg.title}>
      {p.seg.type === 'demo' ? (
        <Suspense fallback={<Backdrop />}>
          <DemoView seg={p.seg} step={p.step} active={p.active} animate={p.animate} playing={p.playing} onAdvance={p.onAdvance} onEnd={p.onEnd} registerNav={p.registerNav} theme={p.theme} />
        </Suspense>
      ) : p.seg.type === 'whoami' ? (
        <WhoAmIView seg={p.seg} step={p.step} theme={p.theme} active={p.active} />
      ) : p.seg.type === 'roster' ? (
        <RosterView seg={p.seg} step={p.step} theme={p.theme} active={p.active} />
      ) : p.seg.type === 'agreements' ? (
        <AgreementsView seg={p.seg} step={p.step} theme={p.theme} active={p.active} />
      ) : p.seg.type === 'launch' ? (
        <LaunchView seg={p.seg} step={p.step} theme={p.theme} active={p.active} onAdvance={p.onAdvance} />
      ) : p.seg.type === 'photo' ? (
        <PhotoView seg={p.seg} step={p.step} theme={p.theme} active={p.active} photoRun={p.photoRun} />
      ) : (
        <SlidePlayer {...(p as SegProps<SlideSegment>)} />
      )}
    </SegmentBoundary>
  );
}

function SlidePlayer({ seg, step, active, onSkip, theme, animate = true }: SegProps<SlideSegment>) {
  return (
    <div className="absolute inset-0" style={{ background: 'rgb(var(--t-bg))' }}>
      <FitStage>{(scale) => <SlideCanvas settings={seg.settings} theme={theme} step={step} mode="play" active={active} animate={animate} scale={scale} onSkip={onSkip} />}</FitStage>
    </div>
  );
}
