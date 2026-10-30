// هوية العرض: المرجع الوحيد للألوان والخطوط والأحجام والشعارات في شاشات العرض والمحرّر.
// المصدر: «brand assets/ملف الهوية الإعلامية - برنامج صقل.pdf» (الإصدار 1.0، 30 أكتوبر 2026)،
// مع قرارين معتمدين من الإدارة يخالفان الملف (موسومان بـ source: 'decision'):
//   - الخط: ثمانية Sans من مجلد brand assets/fonts بدل Cairo وTajawal.
//   - خلفية القالب الغامق: #044554.
// قيم tokens.css يجب أن تطابق هذا الملف، والاختبار brand.test يتحقق من ذلك.

export type BrandSource = 'pdf' | 'decision';

export interface BrandColor {
  hex: string;
  label: string;
  use: string;
  source: BrandSource;
}

export const BRAND_COLORS = {
  teal: { hex: '#00728E', label: 'التيل الأساسي', use: 'اللون الأساسي، من الشعار', source: 'pdf' },
  tealDeep: { hex: '#006F8C', label: 'التيل الداكن', use: 'من تدرّج الشعار، بداية تدرّج الخلفيات', source: 'pdf' },
  sky: { hex: '#00B9D1', label: 'السماوي', use: 'من تدرّج الشعار، التوهّج ونهاية تدرّج الخلفيات', source: 'pdf' },
  gold: { hex: '#FBB42B', label: 'الذهبي', use: 'من الأيقونة، الخطوط الفاصلة والتمييز', source: 'pdf' },
  orange: { hex: '#F79845', label: 'البرتقالي', use: 'من تدرّج الشعار، التمييز', source: 'pdf' },
  grey: { hex: '#8D8D8D', label: 'الرمادي', use: 'من نص الشعار الفرعي، التعليقات والمصادر', source: 'pdf' },
  ink: { hex: '#1E2E33', label: 'النص الداكن', use: 'النصوص الطويلة على الخلفيات الفاتحة', source: 'pdf' },
  white: { hex: '#FFFFFF', label: 'الأبيض', use: 'الخلفية الأساسية، والنص على الخلفيات الداكنة', source: 'pdf' },
  night: { hex: '#044554', label: 'خلفية القالب الغامق', use: 'خلفية القالب الغامق فقط', source: 'decision' },
} as const satisfies Record<string, BrandColor>;

export type BrandColorKey = keyof typeof BRAND_COLORS;

/** التدرّجان المعتمدان في الملف */
export const BRAND_GRADIENTS = {
  teal: { from: 'tealDeep', to: 'sky', label: 'تدرّج التيل', use: 'للخلفيات والشرائط' },
  gold: { from: 'gold', to: 'orange', label: 'تدرّج الذهبي', use: 'للخطوط الفاصلة والتمييز' },
} as const satisfies Record<string, { from: BrandColorKey; to: BrandColorKey; label: string; use: string }>;

/** الخطوط المتاحة في العرض والمحرّر: هذه فقط */
export const BRAND_FONTS = [
  {
    family: 'Thmanyah Sans',
    label: 'ثمانية',
    source: 'decision' as BrandSource,
    weights: { 300: 'Light', 400: 'Regular', 500: 'Medium', 700: 'Bold', 900: 'Black' } as Record<number, string>,
  },
] as const;

/** تسلسل العناوين بالبكسل على لوحة 1080 (جدول «الخطوط وتسلسل العناوين» في الملف، بالأوزان المقابلة في ثمانية) */
export const TYPE_SCALE = {
  display: { size: 110, weight: 900, line: 1.15, label: 'العنوان الرئيسي (أقصى)' },
  title: { size: 96, weight: 900, line: 1.15, label: 'العنوان الرئيسي' },
  subtitle: { size: 60, weight: 700, line: 1.25, label: 'العنوان الفرعي' },
  body: { size: 44, weight: 400, line: 1.6, label: 'النص العادي' },
  caption: { size: 30, weight: 400, line: 1.5, label: 'التعليق والمصدر' },
} as const;

/** لوحة العرض */
export const CANVAS = { w: 1920, h: 1080 } as const;

/** الهامش الآمن 9% من الحواف (نحو 96px على 1080) */
export const SAFE_MARGIN = 96;

/** الشعارات الثلاثة، والنسخة البيضاء الكاملة لكل منها (مسموحة على التيل) */
export const LOGOS = {
  horizontal: { color: './brand/logo-horizontal.svg', white: './brand/logo-horizontal-white.svg', label: 'الشعار العرضي', minWidth: 140 },
  vertical: { color: './brand/logo-vertical.svg', white: './brand/logo-vertical-white.svg', label: 'الشعار الطولي', minWidth: 90 },
  icon: { color: './brand/logo-icon.svg', white: './brand/logo-icon-white.svg', label: 'أيقونة الشعار', minWidth: 40 },
} as const;
export type LogoKind = keyof typeof LOGOS;

/**
 * قواعد الشعار من الملف: مساحة آمنة = خُمس ارتفاعه من كل جهة،
 * وممنوع: المد والضغط، تغيير الألوان (عدا الأبيض الكامل على التيل)، التدوير، تقليل الشفافية، الظل.
 */
export const LOGO_RULES = { clearRatio: 1 / 5, allowRotate: false, allowOpacity: false, allowShadow: false, allowRecolor: ['white'] } as const;

/** المساحة الآمنة حول شعار بارتفاع h */
export const logoClearance = (h: number) => h * LOGO_RULES.clearRatio;

/** أصغر عرض مسموح للشعار؛ تحته تُستخدم الأيقونة */
export const logoMinWidth = (kind: LogoKind) => LOGOS[kind].minWidth;

export const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
