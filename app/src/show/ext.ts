// أنواع فقرات إضافية تُسجَّل من خارج وضع العرض (حفل آخر مثل app/src/events/bia2026)، دون تعديل أنواع «صقل».
// الفقرة من نوع 'ext' تحمل اسم النوع وبياناته، وكل نوع يعرّف عرضه ومحرّره وخطواته وما ينقصه من بيانات.
import type { ComponentType } from 'react';
import type { ShowTheme } from './model';

export interface ExtViewProps<D = any> {
  data: D;
  step: number;
  theme: ShowTheme;
  active: boolean;
  /** داخل المحرّر (معاينة أو تشغيل): تظهر الأماكن الفارغة، وعلى شاشة العرض لا */
  preview: boolean;
  /** عدّاد الصورة الجماعية وما شابه: يزيد مع كل تشغيل من التحكم */
  run?: number;
}

export interface ExtEditorProps<D = any> {
  data: D;
  patch: (p: Partial<D>) => void;
}

export interface ExtKind<D = any> {
  kind: string;
  label: string;
  hint: string;
  /** اسم أيقونة lucide */
  icon: string;
  create(): D;
  /** يتحقق من البيانات المخزّنة أو المستوردة ويكمل الناقص */
  parse(raw: unknown): D;
  steps(d: D): number;
  /** وصف الخطوة للمحرّر والجوال */
  sub?(d: D, step: number): string | undefined;
  /** الحقول التي لم تُملأ بعد (لقائمة «بيانات ناقصة» في المحرّر) */
  missing?(d: D): string[];
  /** يحذف الأسماء والصور الشخصية قبل تصدير JSON أو show.json العلني */
  scrub?(d: D): D;
  View: ComponentType<ExtViewProps<D>>;
  Editor: ComponentType<ExtEditorProps<D>>;
}

const registry = new Map<string, ExtKind>();

export function registerExt(...kinds: ExtKind[]) {
  for (const k of kinds) registry.set(k.kind, k);
}
export const extKind = (kind: string) => registry.get(kind);
export const extKinds = () => [...registry.values()];

/** في المحرّر: معاينة الفقرة داخل إطار (#/show?preview=…) */
export const isPreviewWindow = () => typeof location !== 'undefined' && /[?&]preview=/.test(location.hash);

/** قوالب جاهزة في نافذة «شريحة جديدة» لحفل آخر: كل قالب ينشئ فقرة أو أكثر */
export interface ExtPreset {
  key: string;
  label: string;
  hint: string;
  icon: string;
  create(id: string): import('./model').Segment[];
}
const presets: ExtPreset[] = [];
export function registerPresets(...p: ExtPreset[]) {
  presets.push(...p);
}
export const extPresets = () => presets;

/** ما لم يُملأ بعد في العرض كله: لكل فقرة عنوانها وحقولها الناقصة */
export function missingData(segments: import('./model').Segment[]): { id: string; title: string; fields: string[] }[] {
  const out: { id: string; title: string; fields: string[] }[] = [];
  for (const s of segments) {
    const fields: string[] = [];
    if (s.type === 'ext') fields.push(...(extKind(s.settings.kind)?.missing?.(s.settings.data) ?? []));
    if (s.type === 'slide')
      for (const el of s.settings.elements) {
        if ((el.type === 'video' || el.type === 'image') && !el.props.media) fields.push(el.type === 'video' ? 'ملف الفيديو' : `صورة: ${el.name ?? 'بلا اسم'}`);
      }
    if (fields.length) out.push({ id: s.id, title: s.title, fields });
  }
  return out;
}
