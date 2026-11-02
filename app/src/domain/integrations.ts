// مفاتيح الربط والتكاملات: تعريفها فقط (الأسماء)، وقيمها في الخزنة لا هنا. يملكها ويديرها مسؤول اللجنة التقنية وحده.
export const INTEGRATION_KEYS = [
  { key: 'EMAIL_API_KEY', label: 'مفتاح مزوّد البريد', hint: 'يُستعمل لإرسال البريد الفعلي' },
  { key: 'STORAGE_ACCESS_KEY', label: 'مفتاح التخزين (الملفات والفواتير)', hint: 'رفع الملفات' },
  { key: 'DATABASE_URL', label: 'رابط قاعدة البيانات وبيانات دخولها', hint: 'اتصال الخادم بالقاعدة' },
  { key: 'SETTINGS_SECRET', label: 'سر إعدادات المنصة', hint: 'تشفير القيم الحساسة في الإعدادات' },
] as const;
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number]['key'];
