// ملف تعريف العرض: يسمح لحفل آخر (مثل app/src/events/bia2026) بإعادة استخدام وضع العرض كله بمعزل عن «صقل».
// يُعرَّف قبل تحميل أي وحدة في صفحة الحفل (window.__SHOW_PROFILE__ في ملف HTML الخاص به).
// بلا تعريف: قيم «صقل» الحالية كما هي، فلا يتغير شيء في عرض «صقل».

export interface ShowProfile {
  /** معرّف الحفل (يظهر في صيغة ملف التصدير) */
  id: string;
  /** بادئة كل مفاتيح المتصفح (localStorage وsessionStorage وIndexedDB وقناة BroadcastChannel). فارغة لـ«صقل» */
  ns: string;
  /** مسار الحفل في Firebase (فارغ = الجذر كما في «صقل») */
  firebaseRoot: string;
  /** خطوط بديلة عند الرسم: اسم الخط المخزّن ← الخط الفعلي */
  fontAlias?: Record<string, string>;
  /** نسبة عرض الشعارات إلى ارتفاعها إن اختلفت عن شعارات «صقل» */
  logoRatio?: Partial<Record<'horizontal' | 'vertical' | 'icon', number>>;
  /** بلا ديمو المنصة ولا لقطة بياناتها ولا فقرات «صقل» الجاهزة */
  standalone?: boolean;
  /** ترويسة ثابتة بدل شعار الزاوية: صور لكل قالب ومواضعها على لوحة 1920×1080 */
  frame?: { dark: FrameItem[]; light: FrameItem[] };
}

export interface FrameItem {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** في الحافة السفلية (يُخفى مع الشرائح التي تخفي الترويسة أيضاً) */
  bottom?: boolean;
}

const SAQL: ShowProfile = { id: 'saql', ns: '', firebaseRoot: '' };

export const profile: ShowProfile = { ...SAQL, ...((globalThis as { __SHOW_PROFILE__?: Partial<ShowProfile> }).__SHOW_PROFILE__ ?? {}) };

/** مفتاح تخزين بالبادئة: «show-config» لـ«صقل»، و«bia2026.show-config» للحفل */
export const nsKey = (key: string) => (profile.ns ? `${profile.ns}.${key}` : key);

/** مسار في Firebase تحت جذر الحفل */
export const fbPath = (path: string) => (profile.firebaseRoot ? `${profile.firebaseRoot}/${path}` : path);

/** اسم الخط الذي يُرسم فعلاً */
export const fontFor = (family: string) => profile.fontAlias?.[family] ?? family;
