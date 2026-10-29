import { useEffect, useState } from 'react';
import { resolveMedia } from '../media';
import type { MediaRef } from '../model';

/** رابط الوسيط أو خطأ تحميله (الملف المحلي غير موجود على هذا الجهاز مثلاً) */
export function useMediaUrl(ref?: MediaRef): { url?: string; error?: string } {
  const [state, setState] = useState<{ url?: string; error?: string }>({});
  const key = ref ? (ref.kind === 'url' ? ref.src : ref.id) : '';
  useEffect(() => {
    if (!ref) return setState({ error: 'لم يُحدَّد ملف' });
    let alive = true;
    setState({});
    resolveMedia(ref).then(
      (url) => alive && setState({ url }),
      (e: Error) => alive && setState({ error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}
