// معاينة فقرة واحدة داخل شاشة التحكم (#/show?preview=<id>&step=<n> في iframe).
// لا ترسل حالة ولا تستقبل أوامر تنقل، فلا تؤثر على شاشة العرض الفعلية، والفيديو فيها متوقف.
import { useEffect, useState } from 'react';
import { sortSegments, stepCount } from './nav';
import { SegmentView } from './segments';
import { Fallback } from './segments/Fallback';
import { useShowConfig, useSync } from './useShow';
import './show.css';

export const previewParams = (hash = window.location.hash) => {
  const q = new URLSearchParams(hash.split('?')[1] ?? '');
  const id = q.get('preview');
  return id ? { id, step: Math.max(0, Number(q.get('step')) || 0) } : null;
};

export default function PreviewFrame() {
  const sync = useSync();
  const [cfg] = useShowConfig(sync);
  const [p, setP] = useState(previewParams);
  useEffect(() => {
    const on = () => setP(previewParams());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  if (!cfg || !p) return <div className="show-stage" />;
  const seg = sortSegments(cfg.segments).find((s) => s.id === p.id);
  return (
    <div className="show-stage" data-show-theme={cfg.theme}>
      {seg ? <SegmentView seg={seg} theme={cfg.theme} step={Math.min(p.step, stepCount(seg) - 1)} active={false} onSkip={() => undefined} /> : <Fallback reason="الفقرة غير موجودة" />}
    </div>
  );
}
