// نموذج بيانات وضع «عرض الحفل»: منفصل تماماً عن قاعدة بيانات المنصة وعن DB_VERSION.
// الإصدار 2: كل فقرة شريحة حرّة (slides/model.ts) أو ديمو المنصة. أنواع الإصدار 1
// (فيديو، صور، أسماء، شاشة المتحدث) صارت قوالب، وتتحول تلقائياً عند القراءة (slides/templates.ts).
import type { SlideSettings } from './slides/model';

export const SHOW_SCHEMA_VERSION = 2;

export type SegmentType = 'slide' | 'demo' | 'whoami' | 'roster' | 'agreements' | 'launch' | 'photo';
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
/** مشاهد الديمو (من منظور المشارك)، وكل مشهد صفحات من المنصة بالترتيب.
 *  داخل كل صفحة لا مسارات مكتوبة: الجولة تقرأ بطاقاتها من السمة data-demo-card (demo/tour.ts). */
export const DEMO_SCENES = ['calendar', 'trips', 'focus', 'plan'] as const;
export type DemoScene = (typeof DEMO_SCENES)[number];
export const DEMO_PAGES = ['calendar', 'individual', 'trip', 'docs', 'plans', 'attendance', 'closure', 'focus', 'focusDetail', 'plan'] as const;
export type DemoPage = (typeof DEMO_PAGES)[number];
export const DEMO_SCENE_PAGES = {
  calendar: ['calendar', 'individual'],
  trips: ['trip', 'docs', 'plans', 'attendance', 'closure'],
  focus: ['focus', 'focusDetail'],
  plan: ['plan'],
} as const satisfies Record<DemoScene, readonly DemoPage[]>;

export const DEMO_SCENE_LABELS: Record<DemoScene, string> = {
  calendar: 'التقويم',
  trips: 'الرحلات',
  focus: 'لقاءات التركيز',
  plan: 'الخطة الشخصية',
};
export const DEMO_PAGE_LABELS: Record<DemoPage, string> = {
  calendar: 'التقويم',
  individual: 'لقاءاتي',
  trip: 'رحلة المجموعة',
  docs: 'وثيقة الرحلة',
  plans: 'الخطتان أ وب',
  attendance: 'الحضور',
  closure: 'تقييم الرحلة',
  focus: 'قائمة اللقاءات',
  focusDetail: 'لقاء قدّمه المشارك',
  plan: 'عجلة الحياة والأهداف',
};

export interface DemoSettings {
  scenes: DemoScene[];
  /** تبدأ الجولة وحدها (تشغيل) أم تنتظر المقدّم */
  autoplay: boolean;
  /** مدة كل خطوة بالثواني ما لم تُحدَّد لها مدة خاصة */
  dwell: number;
  /** مدد خاصة: مفتاح الخطوة (صفحة|بطاقة|جزء) ← ثوانٍ */
  durations: Record<string, number>;
}
export const DEMO_DEFAULTS: Omit<DemoSettings, 'scenes'> = { autoplay: true, dwell: 5, durations: {} };

/** صفحات الديمو بالترتيب (خطوات الفقرة في التنقل): لكل صفحة مشهدها وهل هي أول المشهد (يظهر عنوانه) */
export function demoSteps(settings: Pick<DemoSettings, 'scenes'>) {
  return settings.scenes.flatMap((scene, sceneIndex) =>
    DEMO_SCENE_PAGES[scene].map((page, i) => ({ scene, sceneIndex, page: page as DemoPage, first: i === 0 })),
  );
}

/** أول صفحة في المشهد رقم n (من 0)، أو null إن لم يوجد */
export function sceneStart(settings: Pick<DemoSettings, 'scenes'>, n: number): number | null {
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

/** بداية فقرة في جدول الحفل: عنوانها ومدتها المخططة بالدقائق. داخلية للمنظمين فقط:
 *  تظهر في المحرّر والجوال، ولا تظهر أبداً على شاشة العرض ولا في أي شريحة */
export interface Section {
  title: string;
  minutes: number;
}

interface Base<T extends SegmentType | LegacySegmentType, S> {
  id: string;
  type: T;
  title: string;
  order: number;
  settings: S;
  /** هذه الشريحة تبدأ فقرة في جدول الحفل (وما بعدها حتى الفقرة التالية تابع لها) */
  section?: Section;
}

// ───────────── «من أنا؟» ─────────────
/** مشارك في «من أنا؟»: الاسم والمجموعة من لقطة المنصة، والمعلومة والتلميحات تُدخَل في المحرّر وتبقى في show-config فقط */
export interface WhoEntry {
  id: string;
  /** معرّفه في المنصة إن سُحب من اللقطة */
  personId?: string;
  name: string;
  group?: string;
  /** المعلومة الغريبة أو الطريفة (تظهر وحدها أولاً) */
  fact: string;
  /** تلميحات إضافية تظهر متتابعة قبل الكشف */
  hints: string[];
  photo?: MediaRef;
  /** مُتخطّى: لا يظهر في العرض */
  skip?: boolean;
}
export interface WhoAmISettings {
  /** عنوان شاشة البداية */
  heading: string;
  entries: WhoEntry[];
}

// ───────────── شبكة الأسماء ─────────────
export interface RosterPerson {
  name: string;
  group?: string;
  /** صفة (لفريق العمل واللجان) */
  role?: string;
}
export interface RosterSettings {
  heading: string;
  /** participants: المشاركون بمجموعاتهم، staff: فريق العمل بصفاتهم (تُسحب من لقطة المنصة) */
  source: 'participants' | 'staff';
  people: RosterPerson[];
  /** أقصى عدد في الصفحة الواحدة، والزائد يُقسّم صفحات */
  perPage: number;
}

// ───────────── توقيع الاتفاقيات ─────────────
export interface AgreementParty {
  id: string;
  name: string;
  logo?: MediaRef;
  /** عنوان الاتفاقية */
  title: string;
  rep: string;
  repTitle: string;
}
export interface AgreementsSettings {
  heading: string;
  /** شعار الجمعية واسمها (الطرف الثابت في كل اتفاقية) */
  hostName: string;
  hostLogo?: MediaRef;
  parties: AgreementParty[];
}

// ───────────── التدشين ─────────────
export interface LaunchSettings {
  /** شاشة الانتظار */
  waitTitle: string;
  waitSub: string;
  /** بعد الحركة */
  doneTitle: string;
  /** ثوانٍ بعد ظهور «تم التدشين» ثم الفقرة التالية تلقائياً (0 = ينتظر المقدّم) */
  autoNext: number;
}

// ───────────── الصورة الجماعية ─────────────
export interface PhotoSettings {
  heading: string;
  sub: string;
  /** ثواني العدّ التنازلي */
  seconds: number;
}

export type SlideSegment = Base<'slide', SlideSettings>;
export type DemoSegment = Base<'demo', DemoSettings>;
export type WhoAmISegment = Base<'whoami', WhoAmISettings>;
export type RosterSegment = Base<'roster', RosterSettings>;
export type AgreementsSegment = Base<'agreements', AgreementsSettings>;
export type LaunchSegment = Base<'launch', LaunchSettings>;
export type PhotoSegment = Base<'photo', PhotoSettings>;
export type Segment = SlideSegment | DemoSegment | WhoAmISegment | RosterSegment | AgreementsSegment | LaunchSegment | PhotoSegment;

export type VideoSegment = Base<'video', VideoSettings>;
export type SlidesSegment = Base<'slides', SlidesSettings>;
export type NamesSegment = Base<'names', NamesSettings>;
export type BlankSegment = Base<'blank', BlankSettings>;
export type LegacySegment = VideoSegment | SlidesSegment | NamesSegment | BlankSegment;

/** القالب: غامق (خلفية ‎#044554) أو فاتح (أبيض)، ويطبّق على كل الشرائح عبر رموز --t-* */
export type ShowTheme = 'dark' | 'light';
export const THEMES: Record<ShowTheme, string> = { dark: 'غامق', light: 'فاتح' };

export interface ShowConfig {
  schemaVersion: number;
  title: string;
  theme: ShowTheme;
  segments: Segment[];
  updatedAt: string;
}

export const SEGMENT_LABELS: Record<SegmentType, string> = {
  slide: 'شريحة',
  demo: 'ديمو المنصة',
  whoami: 'من أنا؟',
  roster: 'شبكة الأسماء',
  agreements: 'توقيع الاتفاقيات',
  launch: 'التدشين',
  photo: 'الصورة الجماعية',
};

export const LAUNCH_DEFAULTS: LaunchSettings = { waitTitle: 'منصة صقل الإلكترونية', waitSub: 'لحظات وتنطلق', doneTitle: 'تم تدشين منصة صقل الإلكترونية', autoNext: 5 };
export const PHOTO_DEFAULTS: PhotoSettings = { heading: 'الصورة الجماعية', sub: 'ابتسموا، صقل 7', seconds: 3 };

export const DEFAULT_CONFIG: ShowConfig = {
  schemaVersion: SHOW_SCHEMA_VERSION,
  title: 'حفل برنامج صقل',
  theme: 'dark',
  updatedAt: '2026-01-01T00:00:00.000Z',
  segments: [
    { id: 'seg_demo', type: 'demo', title: 'جولة في المنصة', order: 0, settings: { scenes: [...DEMO_SCENES], ...DEMO_DEFAULTS } },
  ],
};
