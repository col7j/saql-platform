// مؤثرات الشرائح (قصاصات احتفالية وتوهّج نابض) بألوان الهوية فقط
import { useMemo } from 'react';
import type { SlideFx } from '../slides/model';
import './ceremony.css';

const CONFETTI_TONES = ['gold', 'orange', 'sky', 'white', 'teal'];
export function Confetti({ count = 90 }: { count?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
        return { x: r(1) * 100, d: r(2) * 2.4, t: 3.2 + r(3) * 2.6, w: 10 + r(4) * 16, rot: r(5) * 360, sway: (r(6) - 0.5) * 220, tone: CONFETTI_TONES[i % CONFETTI_TONES.length], round: r(7) > 0.7 };
      }),
    [count],
  );
  return (
    <div className="cv-confetti" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          data-tone={b.tone}
          className={b.round ? 'cv-bit cv-bit-round' : 'cv-bit'}
          style={{ left: `${b.x}%`, width: b.w, height: b.round ? b.w : b.w * 0.45, animationDelay: `${b.d}s`, animationDuration: `${b.t}s`, ['--rot' as string]: `${b.rot}deg`, ['--sway' as string]: `${b.sway}px` }}
        />
      ))}
    </div>
  );
}

export function SlideFxLayer({ fx, still }: { fx?: SlideFx; still?: boolean }) {
  if (!fx || fx === 'none' || still) return null;
  if (fx === 'confetti') return <Confetti />;
  return <div className="cv-pulse" aria-hidden />;
}
