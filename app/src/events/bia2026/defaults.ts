// العرض الافتراضي لحفل ختام «بيئات التطوع 2026»: 17 فقرة بترتيب العرض الأصلي (29 شريحة)، والنصوص بلا تطويل.
// الأسماء والشعارات والصور ورابط التقييم الناقصة تبقى فارغة وتُملأ من المحرّر («بيانات ناقصة»).
// منطقة المحتوى بين الترويسة (أعلى 170) والزخرفة السفلية (من 920) على لوحة 1920×1080.
import { PHOTO_DEFAULTS, SHOW_SCHEMA_VERSION, type ExtSegment, type MediaRef, type Section, type Segment, type ShowConfig, type SlideSegment } from '@/show/model';
import type { ExtPreset } from '@/show/ext';
import { QURAN_FONT } from '@/show/brand/brand';
import { makeElement, type AnimType, type ColorRef, type SlideElement, type SlideSettings } from '@/show/slides/model';
import type { AwardData, ExperienceData, HonoringData, QrData, SpeakerData } from './kinds';
import { award, experience, honoring, qrLink, speaker } from './kinds';

const W = 1920;
const sec = (title: string, minutes = 0): Section => ({ title, minutes });
/** شعار وفادة من ملفات الحفل نفسه (في المستودع لأنه شعار جهة لا بيانات شخصية) */
export const WIFADA_LOGO: MediaRef = { kind: 'url', src: 'brand/header-wifada-siaq.svg' };

let n = 0;
function T(base: string, text: string, o: { y: number; h: number; size: number; weight?: number; color?: ColorRef; delay?: number; anim?: AnimType; font?: string; x?: number; w?: number; line?: number }): SlideElement {
  return makeElement('text', `${base}_e${++n}`, {
    x: o.x ?? 160,
    y: o.y,
    w: o.w ?? W - 320,
    h: o.h,
    anim: { type: o.anim ?? 'up', delay: o.delay ?? 0, duration: 1000 },
    props: { text, size: o.size, weight: o.weight ?? 700, color: o.color ?? 'fg', align: 'center', line: o.line ?? (o.size >= 60 ? 1.2 : 1.5), ...(o.font ? { font: o.font } : {}) },
  });
}
const rule = (base: string, y: number, delay = 400) => makeElement('shape', `${base}_e${++n}`, { x: (W - 180) / 2, y, w: 180, h: 9, anim: { type: 'wipe', delay, duration: 900 }, props: { shape: 'rect', fill: 'gradGold', radius: 999 } });
const slideSettings = (elements: SlideElement[]): SlideSettings => ({ bg: { kind: 'theme', glow: false }, mark: true, elements });
const slide = (id: string, title: string, elements: SlideElement[], section?: Section): SlideSegment => ({ id, type: 'slide', title, order: 0, settings: slideSettings(elements), ...(section ? { section } : {}) });
const ext = <D,>(id: string, title: string, kind: string, data: D, section?: Section): ExtSegment => ({ id, type: 'ext', title, order: 0, settings: { kind, data }, ...(section ? { section } : {}) });

export function welcomeSlide(id: string, section?: Section) {
  n = 0;
  return slide(id, 'الترحيب', [
    T(id, 'حيّاكم الله', { y: 250, h: 200, size: 170, weight: 900, color: 'head', anim: 'scale', delay: 200 }),
    rule(id, 490, 900),
    T(id, 'في حفل ختام مشروع', { y: 540, h: 100, size: 64, weight: 500, delay: 1100 }),
    T(id, 'بيئات التطوع 2026', { y: 650, h: 160, size: 130, weight: 900, color: 'em', delay: 1500 }),
  ], section);
}

export function quranSlide(id: string, reader = '', section?: Section) {
  n = 0;
  return slide(id, 'القرآن الكريم', [
    T(id, 'القرآن الكريم', { y: 300, h: 220, size: 160, weight: 700, color: 'head', anim: 'fade', delay: 200, font: QURAN_FONT, line: 1.4 }),
    rule(id, 560, 900),
    T(id, reader, { y: 610, h: 110, size: 72, weight: 500, delay: 1100 }),
  ], section);
}

export function videoSlide(id: string, title = 'التقرير الختامي', section?: Section) {
  n = 0;
  return slide(id, title, [
    T(id, title, { y: 440, h: 160, size: 120, weight: 900, color: 'head', delay: 100 }),
    makeElement('video', `${id}_e${++n}`, { x: 320, y: 185, w: 1280, h: 720, anim: { type: 'fade', delay: 0, duration: 900 }, shadow: 'lift', props: { fit: 'contain', radius: 28, muted: false, autoAdvance: true, showSkip: false } }),
  ], section);
}

export function closingSlide(id: string, section?: Section) {
  n = 0;
  return slide(id, 'الختام', [
    T(id, 'الختام', { y: 290, h: 100, size: 64, weight: 700, color: 'em', delay: 100 }),
    T(id, 'بيئات تصنع الأثر', { y: 400, h: 220, size: 180, weight: 900, color: 'head', anim: 'scale', delay: 400 }),
    rule(id, 660, 1200),
  ], section);
}

const places = (k: number) => Array.from({ length: k }, () => ({ name: '', sub: '' }));

/** الفقرات السبع عشرة بترتيب العرض الأصلي */
export function biaSegments(): Segment[] {
  const list: Segment[] = [
    welcomeSlide('b_welcome', sec('الترحيب')),
    ext<SpeakerData>('b_intro', 'المقدمة', 'speaker', { kicker: 'المقدمة', name: 'أ. سهيل البرقاوي', role: '' }, sec('المقدمة')),
    quranSlide('b_quran', 'أ. عمر ضياء', sec('القرآن الكريم')),
    ext<SpeakerData>('b_wifada', 'كلمة جمعية وفادة', 'speaker', { kicker: 'كلمة جمعية وفادة', name: '', role: '', logo: WIFADA_LOGO }, sec('كلمة جمعية وفادة')),
    ext<ExperienceData>('b_exp_assoc', 'تجربة جمعية', 'experience', { kicker: 'تجربة جمعية', name: 'جمعية الرياضة النسائية', mediaKind: 'logo' }, sec('تجربة جمعية')),
    ext<ExperienceData>('b_exp_vol', 'تجربة متطوع', 'experience', { kicker: 'تجربة متطوع', name: '', mediaKind: 'photo' }, sec('تجربة متطوع')),
    videoSlide('b_report', 'التقرير الختامي', sec('التقرير الختامي')),
    ext<SpeakerData>('b_smf', 'كلمة مؤسسة سالم بن محفوظ الأهلية', 'speaker', { kicker: 'كلمة مؤسسة سالم بن محفوظ الأهلية', name: 'م. ممدوح الحربي', role: '' }, sec('كلمة مؤسسة سالم بن محفوظ الأهلية')),
    ext<AwardData>('b_award_brq', 'جائزة بريق العطاء', 'award', { intro: 'الإعلان عن الفائزين بجائزة', title: 'بريق العطاء', mode: 'person', places: places(3), crown: 'صاحب بريق العطاء' }, sec('جائزة بريق العطاء')),
    ext<AwardData>('b_award_init', 'جائزة أفضل مبادرة', 'award', { intro: 'الإعلان عن الفائزين بجائزة', title: 'أفضل مبادرة', mode: 'org', places: places(3), crown: '' }, sec('جائزة أفضل مبادرة')),
    ext<HonoringData>('b_partners', 'تكريم الشركاء', 'honoring', { kicker: 'تكريم', title: 'الشركاء', items: [{ label: 'شريك النجاح', name: '', role: '' }], grid: false, gridOnly: false }, sec('تكريم الشركاء')),
    ext<HonoringData>('b_team', 'تكريم فريق العمل', 'honoring', { kicker: 'تكريم', title: 'فريق العمل', items: [], grid: true, gridOnly: true }, sec('تكريم فريق العمل')),
    ext<AwardData>('b_award_orgs', 'تكريم الجهات المتميزة', 'award', { intro: 'تكريم الفائزين بجائزة', title: 'الجهات المتميزة', mode: 'org', places: places(3), crown: '' }, sec('تكريم الجهات المتميزة')),
    ext<HonoringData>('b_support', 'تكريم الجهات الداعمة والإشرافية', 'honoring', { kicker: 'تكريم', title: 'الجهات الداعمة والإشرافية', items: [{ label: 'الجهة الإشرافية', name: '', role: '' }, { label: 'الجهة الداعمة', name: '', role: '' }], grid: false, gridOnly: false }, sec('تكريم الجهات الداعمة والإشرافية')),
    closingSlide('b_closing', sec('الختام')),
    { id: 'b_photo', type: 'photo', title: 'الصورة التذكارية', order: 0, settings: { ...PHOTO_DEFAULTS, heading: 'صورة تذكارية', sub: 'بيئات التطوع 2026' }, section: sec('الصورة التذكارية') },
    ext<QrData>('b_rating', 'رابط تقييم الحفل', 'qr-link', { title: 'رابط تقييم الحفل', sub: 'لمشاركتكم وحضوركم', url: '' }, sec('رابط تقييم الحفل')),
  ];
  return list.map((s, i) => ({ ...s, order: i }));
}

export function biaConfig(): ShowConfig {
  return { schemaVersion: SHOW_SCHEMA_VERSION, title: 'حفل ختام مشروع بيئات التطوع 2026', theme: 'dark', segments: biaSegments(), updatedAt: '2026-11-04T00:00:00.000Z' };
}

const one = (s: Segment) => [s];
/** قوالب «شريحة جديدة» لهذا الحفل: كل نوع فقرة قابل للتكرار */
export const PRESETS: ExtPreset[] = [
  { key: 'welcome', label: 'الترحيب', hint: '«حيّاكم الله» وعنوان الحفل', icon: 'Sparkles', create: (id) => one(welcomeSlide(id)) },
  { key: 'speaker', label: speaker.label, hint: speaker.hint, icon: speaker.icon, create: (id) => one(ext(id, 'كلمة', 'speaker', speaker.create())) },
  { key: 'quran', label: 'القرآن الكريم', hint: 'العنوان بخط المصحف واسم القارئ', icon: 'BookOpen', create: (id) => one(quranSlide(id)) },
  { key: 'experience', label: experience.label, hint: experience.hint, icon: experience.icon, create: (id) => one(ext(id, 'تجربة', 'experience', experience.create())) },
  { key: 'video', label: 'فيديو', hint: 'بملء الإطار، وينتقل تلقائياً بعده', icon: 'Film', create: (id) => one(videoSlide(id, 'فيديو')) },
  { key: 'award', label: award.label, hint: award.hint, icon: award.icon, create: (id) => one(ext(id, 'جائزة', 'award', award.create())) },
  { key: 'honoring', label: honoring.label, hint: honoring.hint, icon: honoring.icon, create: (id) => one(ext(id, 'تكريم', 'honoring', honoring.create())) },
  { key: 'closing', label: 'الختام', hint: '«بيئات تصنع الأثر»', icon: 'Heart', create: (id) => one(closingSlide(id)) },
  { key: 'photo', label: 'الصورة التذكارية', hint: 'عنوان وعدّ تنازلي 3-2-1 مع وميض', icon: 'Camera', create: (id) => one({ id, type: 'photo', title: 'الصورة التذكارية', order: 0, settings: { ...PHOTO_DEFAULTS, heading: 'صورة تذكارية', sub: '' } }) },
  { key: 'qr', label: qrLink.label, hint: qrLink.hint, icon: qrLink.icon, create: (id) => one(ext(id, 'رابط', 'qr-link', qrLink.create())) },
];
