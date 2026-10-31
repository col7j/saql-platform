// قوالب فقرات الحفل في نافذة «شريحة جديدة»: كل نوع فقرة من جدول الحفل يُنشئ شريحة (أو شرائح) قابلة للتعديل
import { DEMO_DEFAULTS, DEMO_SCENES, LAUNCH_DEFAULTS, PHOTO_DEFAULTS, type Segment, type SlideSegment } from '../model';
import { templateSegment } from '../slides/templates';
import { PLACEHOLDER_PARTIES } from './defaults';
import { celebrationSettings, closingSettings, programSegments, quranSettings, speakerSettings, welcomeSettings } from './program';

export const CEREMONY_TEMPLATES = {
  welcome: { label: 'الترحيب', hint: 'شعار الجمعية واسمها وعنوان الحفل بدخول سينمائي', icon: 'Sparkles' },
  quran: { label: 'القرآن الكريم', hint: 'شاشة هادئة والآية بخط المصحف مع اسم القارئ', icon: 'BookOpen' },
  video: { label: 'فيديو', hint: 'بملء الإطار، والتخطي من التحكم فقط، وينتقل تلقائياً بعده', icon: 'Film' },
  program: { label: 'التعريف بالبرنامج', hint: '11 شريحة: من «هلا بك في صقل 7» إلى «بنسخةٍ أفضل من نفسه»', icon: 'Presentation' },
  launch: { label: 'التدشين', hint: 'انتظار، ثم حركة سينمائية، ثم «تم التدشين» بضغطة مطوّلة', icon: 'Rocket' },
  demo: { label: 'ديمو المنصة', hint: 'جولة تلقائية في شاشات المنصة بمنظور مشارك', icon: 'MonitorPlay' },
  whoami: { label: 'من أنا؟', hint: 'معلومة طريفة ثم تلميحات ثم كشف الاسم', icon: 'CircleHelp' },
  roster: { label: 'شبكة الأسماء', hint: 'أسماء المشاركين أو فريق العمل من لقطة المنصة', icon: 'Users' },
  speaker: { label: 'كلمة الجمعية', hint: 'الشعار واسم المتحدث وصفته', icon: 'Mic' },
  agreements: { label: 'توقيع الاتفاقيات', hint: 'افتتاح، ثم شريحة لكل جهة، ثم شبكة الشعارات', icon: 'Handshake' },
  photo: { label: 'الصورة الجماعية', hint: 'عنوان وعدّ تنازلي 3-2-1 مع وميض كاميرا', icon: 'Camera' },
  celebration: { label: 'كيكة التدشين', hint: 'قصاصات احتفالية و«النسخة السابعة»', icon: 'PartyPopper' },
  closing: { label: 'الختام والشكر', hint: 'الشعار وعبارة الختام وشعارات الشركاء', icon: 'Heart' },
} as const;
export type CeremonyKey = keyof typeof CEREMONY_TEMPLATES;

const slideSeg = (id: string, title: string, settings: SlideSegment['settings']): SlideSegment => ({ id, type: 'slide', title, order: 0, settings });

/** الفقرة (أو الشرائح) الجديدة من قالب */
export function ceremonySegmentsFor(key: CeremonyKey, id: string): Segment[] {
  switch (key) {
    case 'welcome': return [slideSeg(id, 'الترحيب', welcomeSettings(id))];
    case 'quran': return [slideSeg(id, 'القرآن الكريم', quranSettings(id))];
    case 'video': return [templateSegment('video', id, 0, { title: 'فيديو', video: { autoAdvance: true, showSkip: false } })];
    case 'program': return programSegments(id);
    case 'launch': return [{ id, type: 'launch', title: 'التدشين', order: 0, settings: { ...LAUNCH_DEFAULTS } }];
    case 'demo': return [{ id, type: 'demo', title: 'جولة في المنصة', order: 0, settings: { scenes: [...DEMO_SCENES], ...DEMO_DEFAULTS } }];
    case 'whoami': return [{ id, type: 'whoami', title: 'من أنا؟', order: 0, settings: { heading: 'من أنا؟', entries: [] } }];
    case 'roster': return [{ id, type: 'roster', title: 'المشاركون', order: 0, settings: { heading: 'المشاركون', source: 'participants', people: [], perPage: 35 } }];
    case 'speaker': return [slideSeg(id, 'كلمة الجمعية', speakerSettings(id))];
    case 'agreements': return [{ id, type: 'agreements', title: 'توقيع الاتفاقيات', order: 0, settings: { heading: 'توقيع اتفاقيات التعاون', hostName: '', parties: PLACEHOLDER_PARTIES.map((p) => ({ ...p })) } }];
    case 'photo': return [{ id, type: 'photo', title: 'الصورة الجماعية', order: 0, settings: { ...PHOTO_DEFAULTS } }];
    case 'celebration': return [slideSeg(id, 'كيكة التدشين', celebrationSettings(id))];
    case 'closing': return [slideSeg(id, 'الختام والشكر', closingSettings(id))];
  }
}
