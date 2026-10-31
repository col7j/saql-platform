// العرض الافتراضي لحفل «صقل 7»: الفقرات العشر بمددها (59 دقيقة) وفقرة توقيع الاتفاقيات بعد كلمة الجمعية.
// بلا أي بيانات شخصية: أسماء المشاركين ومعلوماتهم تُسحب في المحرّر من لقطة المنصة وتبقى في show-config.
import { DEMO_DEFAULTS, DEMO_SCENES, LAUNCH_DEFAULTS, PHOTO_DEFAULTS, SHOW_SCHEMA_VERSION, type Section, type Segment, type ShowConfig } from '../model';
import { templateSegment } from '../slides/templates';
import { celebrationSettings, closingSettings, programSegments, quranSettings, speakerSettings, welcomeSettings } from './program';

const sec = (title: string, minutes: number): Section => ({ title, minutes });

/** الجهات الأربع: أسماء مؤقتة تُستبدل من المحرّر (الاسم والشعار وعنوان الاتفاقية والممثل) */
export const PLACEHOLDER_PARTIES = [1, 2, 3, 4].map((n) => ({ id: `party_${n}`, name: `الجهة ${n}`, title: 'اتفاقية تعاون', rep: '', repTitle: '' }));

export function ceremonySegments(): Segment[] {
  const list: Segment[] = [
    { id: 'c_welcome', type: 'slide', title: 'الترحيب', order: 0, settings: welcomeSettings('c_welcome'), section: sec('المقدمة والترحيب بالحضور', 3) },
    { id: 'c_quran', type: 'slide', title: 'القرآن الكريم', order: 0, settings: quranSettings('c_quran'), section: sec('تلاوة آيات من القرآن الكريم', 3) },
    { ...templateSegment('video', 'c_video', 0, { title: 'عرض فيديو', video: { autoAdvance: true, showSkip: false } }), section: sec('عرض فيديو', 5) },
    ...programSegments('c_prog', sec('التعريف بالبرنامج', 10)),
    { id: 'c_launch', type: 'launch', title: 'التدشين', order: 0, settings: { ...LAUNCH_DEFAULTS }, section: sec('تدشين المنصة الإلكترونية', 5) },
    templateSegment('video', 'c_launch_video', 0, { title: 'فيديو المنصة', video: { autoAdvance: true, showSkip: false } }),
    { id: 'c_demo', type: 'demo', title: 'جولة في المنصة', order: 0, settings: { scenes: [...DEMO_SCENES], ...DEMO_DEFAULTS } },
    { id: 'c_whoami', type: 'whoami', title: 'من أنا؟', order: 0, settings: { heading: 'من أنا؟', entries: [] }, section: sec('فقرة التعارف «من أنا؟»', 15) },
    { id: 'c_roster', type: 'roster', title: 'المشاركون', order: 0, settings: { heading: 'مشاركو صقل 7', source: 'participants', people: [], perPage: 35 } },
    { id: 'c_speaker', type: 'slide', title: 'كلمة الجمعية', order: 0, settings: speakerSettings('c_speaker'), section: sec('كلمة الجمعية', 5) },
    { id: 'c_agreements', type: 'agreements', title: 'توقيع الاتفاقيات', order: 0, settings: { heading: 'توقيع اتفاقيات التعاون', hostName: '', parties: PLACEHOLDER_PARTIES.map((p) => ({ ...p })) }, section: sec('توقيع اتفاقيات التعاون', 0) },
    { id: 'c_photo', type: 'photo', title: 'الصورة الجماعية', order: 0, settings: { ...PHOTO_DEFAULTS }, section: sec('التقاط الصورة الجماعية', 5) },
    { id: 'c_cake', type: 'slide', title: 'كيكة التدشين', order: 0, settings: celebrationSettings('c_cake'), section: sec('كيكة تدشين النسخة السابعة', 5) },
    { id: 'c_closing', type: 'slide', title: 'الختام والشكر', order: 0, settings: closingSettings('c_closing'), section: sec('الختام والشكر', 3) },
  ];
  return list.map((s, i) => ({ ...s, order: i }));
}

export function ceremonyConfig(): ShowConfig {
  return { schemaVersion: SHOW_SCHEMA_VERSION, title: 'اللقاء الافتتاحي · صقل 7', theme: 'dark', segments: ceremonySegments(), updatedAt: '2026-10-31T00:00:00.000Z' };
}

/**
 * يضيف فقرات حفل «صقل 7» إلى عرض قائم بعد شرائحه، دون حذف شيء منه أو تغييره:
 * تبقى التصاميم السابقة (الشراكات والقرآن وغيرها) والملفات المرفوعة كما هي، وتُرتَّب بعدها من المحرّر.
 * added = 0 إن كانت الفقرات مضافة من قبل
 */
export function withCeremony(cfg: ShowConfig): { cfg: ShowConfig; added: number } {
  const ids = new Set(cfg.segments.map((s) => s.id));
  if (ids.has('c_welcome') && ids.has('c_prog_1')) return { cfg, added: 0 };
  const start = cfg.segments.length;
  const extra = ceremonySegments().map((s, i) => ({ ...s, id: ids.has(s.id) ? `${s.id}_${Date.now().toString(36)}` : s.id, order: start + i }));
  return { cfg: { ...cfg, segments: [...cfg.segments, ...extra] }, added: extra.length };
}
