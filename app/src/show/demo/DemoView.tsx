import type { DemoSegment } from '../model';

export default function DemoView({ seg, step }: { seg: DemoSegment; step: number; active: boolean }) {
  return (
    <div className="show-dark absolute inset-0 grid place-items-center text-2xl text-white">
      {seg.title} · {seg.settings.steps[step]}
    </div>
  );
}
