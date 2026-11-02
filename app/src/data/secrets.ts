// خزنة الأسرار (مفاتيح البريد والتخزين وقاعدة البيانات): خارج قاعدة البيانات وخارج الكود وخارج التصدير.
// في النموذج: ذاكرة + مفتاح محلي منفصل في المتصفح. في المنصة الحقيقية: متغيرات بيئة على الخادم لا يقرؤها المتصفح أبداً.
// لا توجد دالة قراءة تُرجع القيمة للواجهة: الواجهة تعرف فقط «مضبوط/غير مضبوط».
const mem = new Map<string, string>();
const KEY = 'saql.vault';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.entries(JSON.parse(raw) as Record<string, string>).forEach(([k, v]) => mem.set(k, v));
  } catch { /* لا تخزين: نكمل في الذاكرة */ }
}
load();

export const vault = {
  set(key: string, value: string) {
    mem.set(key, value);
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(mem))); } catch { /* تجاهل */ }
  },
  clear(key: string) {
    mem.delete(key);
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(mem))); } catch { /* تجاهل */ }
  },
  /** للخادم فقط (المزوّد الفعلي للبريد مثلاً): لا تُستدعى من الشاشات */
  has: (key: string) => mem.has(key),
};
