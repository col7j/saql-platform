// نموذج بيانات وضع «عرض الحفل»: منفصل تماماً عن قاعدة بيانات المنصة وعن DB_VERSION.
// الإصدار 2: كل فقرة شريحة حرّة (slides/model.ts) أو ديمو المنصة. أنواع الإصدار 1
// (فيديو، صور، أسماء، شاشة المتحدث) صارت قوالب، وتتحول تلقائياً عند القراءة (slides/templates.ts).
import type { SlideSettings } from './slides/model';

export const SHOW_SCHEMA_VERSION = 2;

export type SegmentType = 'slide' | 'demo';
/** أنواع الإصدار 1: للقراءة والتحويل فقط */
export type LegacySegmentType = 'video' | 'slides' | 'names' | 'blank';

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
/** مشاهد الديمو (من منظور المشارك) وخطوات كل مشهد بالترتيب */
export const DEMO_SCENES = ['calendar', 'trips', 'focus', 'plan'] as const;
export type DemoScene = (typeof DEMO_SCENES)[number];
export const DEMO_SCENE_STEPS = {
  calendar: ['month', 'day', 'event'],
  trips: ['trip', 'docs', 'plans', 'attendance', 'evaluation'],
  focus: ['list', 'detail', 'evaluation'],
  plan: ['wheel', 'goals'],
} as const satisfies Record<DemoScene, readonly string[]>;
export type DemoStepKey = { [S in DemoScene]: `${S}.${(typeof DEMO_SCENE_STEPS)[S][number]}` }[DemoScene];

export const DEMO_SCENE_LABELS: Record<DemoScene, string> = {
  calendar: 'التقويم',
  trips: 'الرحلات',
  focus: 'لقاءات التركيز',
  plan: 'الخطة الشخصية',
};
export const DEMO_STEP_LABELS: Record<DemoStepKey, string> = {
  'calendar.month': 'الشهر كاملاً',
  'calendar.day': 'يوم فيه أنشطة',
  'calendar.event': 'تفاصيل نشاط',
  'trips.trip': 'رحلة المجموعة',
  'trips.docs': 'مكونات الرحلة',
  'trips.plans': 'الخطتان أ وب',
  'trips.attendance': 'الحضور',
  'trips.evaluation': 'تقييم الرحلة',
  'focus.list': 'قائمة اللقاءات',
  'focus.detail': 'تفاصيل اللقاء',
  'focus.evaluation': 'تقييم التقديم',
  'plan.wheel': 'عجلة الحياة',
  'plan.goals': 'الأهداف',
};

export interface DemoSettings {
  scenes: DemoScene[];
}

/** الخطوات المسطّحة للديمو: لكل خطوة مشهدها وترتيب المشهد، وهل هي أول المشهد (يظهر عنوانه) */
export function demoSteps(settings: DemoSettings) {
  return settings.scenes.flatMap((scene, sceneIndex) =>
    DEMO_SCENE_STEPS[scene].map((s, i) => ({ scene, sceneIndex, key: `${scene}.${s}` as DemoStepKey, first: i === 0 })),
  );
}

/** أول خطوة في المشهد رقم n (من 0)، أو null إن لم يوجد */
export function sceneStart(settings: DemoSettings, n: number): number | null {
  if (n < 0 || n >= settings.scenes.length) return null;
  return demoSteps(settings).findIndex((x) => x.sceneIndex === n);
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

interface Base<T extends SegmentType | LegacySegmentType, S> {
  id: string;
  type: T;
  title: string;
  order: number;
  settings: S;
}
export type SlideSegment = Base<'slide', SlideSettings>;
export type DemoSegment = Base<'demo', DemoSettings>;
export type Segment = SlideSegment | DemoSegment;

export type VideoSegment = Base<'video', VideoSettings>;
export type SlidesSegment = Base<'slides', SlidesSettings>;
export type NamesSegment = Base<'names', NamesSettings>;
export type BlankSegment = Base<'blank', BlankSettings>;
export type LegacySegment = VideoSegment | SlidesSegment | NamesSegment | BlankSegment;

export interface ShowConfig {
  schemaVersion: number;
  title: string;
  segments: Segment[];
  updatedAt: string;
}

export const SEGMENT_LABELS: Record<SegmentType, string> = {
  slide: 'شريحة',
  demo: 'ديمو المنصة',
};

export const DEFAULT_CONFIG: ShowConfig = {
  schemaVersion: SHOW_SCHEMA_VERSION,
  title: 'حفل برنامج صقل',
  updatedAt: '2026-01-01T00:00:00.000Z',
  segments: [
    { id: 'seg_demo', type: 'demo', title: 'جولة في المنصة', order: 0, settings: { scenes: [...DEMO_SCENES] } },
  ],
};
