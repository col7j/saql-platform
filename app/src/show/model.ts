// نموذج بيانات وضع «عرض الحفل»: منفصل تماماً عن قاعدة بيانات المنصة وعن DB_VERSION.

export const SHOW_SCHEMA_VERSION = 1;

export type SegmentType = 'video' | 'slides' | 'demo' | 'names' | 'blank';

/** مرجع وسيط: ملف في public/show-media (أو أي رابط)، أو ملف مرفوع محلياً في IndexedDB على هذا الجهاز */
export type MediaRef = { kind: 'url'; src: string } | { kind: 'local'; id: string; name?: string };

export interface VideoSettings {
  media?: MediaRef;
  muted: boolean;
  showSkip: boolean;
  /** ينتقل للفقرة التالية تلقائياً عند انتهاء الفيديو */
  autoAdvance: boolean;
}
export interface SlidesSettings {
  slides: MediaRef[];
  fit: 'contain' | 'cover';
}
/** خطوات الديمو بالترتيب: قائمة الرحلات ← رحلة ← مكوناتها ← الخطتان ← الرجوع */
export const DEMO_STEPS = ['list', 'focusTrip', 'trip', 'document', 'schedule', 'budget', 'plans', 'back'] as const;
export type DemoStep = (typeof DEMO_STEPS)[number];
export interface DemoSettings {
  /** معرّف الرحلة في البيانات التجريبية، وإلا تُختار أول رحلة مكتملة النماذج */
  tripId?: string;
  steps: DemoStep[];
}
export interface NamesSettings {
  heading?: string;
  names: string[];
  /** كم اسماً يظهر مع كل نقرة (1 = اسماً اسماً) */
  perStep: number;
  columns: 1 | 2 | 3;
}
export interface BlankSettings {
  variant: 'black' | 'logo';
  caption?: string;
}

interface Base<T extends SegmentType, S> {
  id: string;
  type: T;
  title: string;
  order: number;
  settings: S;
}
export type VideoSegment = Base<'video', VideoSettings>;
export type SlidesSegment = Base<'slides', SlidesSettings>;
export type DemoSegment = Base<'demo', DemoSettings>;
export type NamesSegment = Base<'names', NamesSettings>;
export type BlankSegment = Base<'blank', BlankSettings>;
export type Segment = VideoSegment | SlidesSegment | DemoSegment | NamesSegment | BlankSegment;

export interface ShowConfig {
  schemaVersion: number;
  title: string;
  segments: Segment[];
  updatedAt: string;
}

export const SEGMENT_LABELS: Record<SegmentType, string> = {
  video: 'فيديو',
  slides: 'شرائح',
  demo: 'ديمو المنصة',
  names: 'أسماء',
  blank: 'شاشة المتحدث',
};

export function defaultSettings(type: SegmentType): Segment['settings'] {
  switch (type) {
    case 'video': return { muted: false, showSkip: true, autoAdvance: true } satisfies VideoSettings;
    case 'slides': return { slides: [], fit: 'contain' } satisfies SlidesSettings;
    case 'demo': return { steps: [...DEMO_STEPS] } satisfies DemoSettings;
    case 'names': return { heading: '', names: [], perStep: 1, columns: 2 } satisfies NamesSettings;
    case 'blank': return { variant: 'logo' } satisfies BlankSettings;
  }
}

export const DEFAULT_CONFIG: ShowConfig = {
  schemaVersion: SHOW_SCHEMA_VERSION,
  title: 'حفل برنامج صقل',
  updatedAt: '2026-01-01T00:00:00.000Z',
  segments: [
    { id: 'seg_intro', type: 'blank', title: 'الافتتاح', order: 0, settings: { variant: 'logo', caption: 'حفل برنامج صقل' } },
    { id: 'seg_demo', type: 'demo', title: 'جولة في المنصة', order: 1, settings: { steps: [...DEMO_STEPS] } },
    { id: 'seg_speaker', type: 'blank', title: 'كلمة', order: 2, settings: { variant: 'black' } },
  ],
};
