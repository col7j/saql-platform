// أين يُستخدم كل ملف محلي: لمكتبة الوسائط (شارة «مستخدم في…») ولتصدير العرض لاحقاً.
import type { MediaRef, ShowConfig } from '../model';
import { sortSegments } from '../nav';

/** الملفات المحلية المستخدمة: معرّف الملف ← أسماء الشرائح التي تستخدمه */
export function mediaUsage(cfg: ShowConfig) {
  const used = new Map<string, string[]>();
  for (const s of sortSegments(cfg.segments)) {
    if (s.type !== 'slide') continue;
    const add = (m?: MediaRef) => {
      if (m?.kind !== 'local') return;
      const l = used.get(m.id) ?? [];
      if (!l.includes(s.title)) l.push(s.title);
      used.set(m.id, l);
    };
    if (s.settings.bg.kind === 'media') add(s.settings.bg.media);
    for (const el of s.settings.elements) {
      if (el.type === 'image' || el.type === 'video') add(el.props.media);
      if (el.type === 'logoGrid') el.props.tiers.forEach((t) => t.logos.forEach(add));
    }
  }
  return used;
}

