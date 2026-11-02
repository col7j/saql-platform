# وثائق معمارية منصة صقل الحقيقية

وثائق لنقل «صقل» من الديمو (`app/`) إلى منصة حقيقية في `saql-real/`. **لا كود هنا**: تصميم يكفي لبناء المنصة دون الرجوع للديمو إلا للتحقق.

## ترتيب القراءة
1. [ARCHITECTURE.md](ARCHITECTURE.md) — **ابدأ هنا**: المصادر والتعارضات (0)، الملخص (1)، الأدوار والصلاحيات (2)، الوحدات (3)، المعمارية التقنية (12)، الأمان (14)، هيكل المشروع (16)، الاختبار (17)، الخارطة (18)، المخاطر (19).
2. [04-data-model.md](04-data-model.md) — قاعدة البيانات كاملة (ERD + جداول + قيود + أمثلة JSON).
3. [05-state-machines.md](05-state-machines.md) — دورات الحياة والانتقالات.
4. [06-business-rules.md](06-business-rules.md) — القواعد BR-001… بمصادرها.
5. [07-finance.md](07-finance.md) و[08-evaluation-points.md](08-evaluation-points.md) — المالية والنقاط بالصيغ.
6. [09-notifications-files-public.md](09-notifications-files-public.md) — الإشعارات والمجدول، الملفات، الموقع العام والداعم.
7. [13-api.md](13-api.md) — نقاط النهاية والأخطاء.
8. [15-migration-plan.md](15-migration-plan.md) — المطابقة وإعادة الاستخدام وخطة seed.
9. [20-open-questions.md](20-open-questions.md) — القرارات المطلوبة (25 سؤالاً).
10. ملاحق: [أ تتبّع الشاشات](appendix-A-screen-traceability.md) · [ب المعجم](appendix-B-glossary.md) · [ج الإعدادات](appendix-C-settings.md).

## أسبقية المصادر عند التعارض
`docs/saql-decisions.md` (الأحدث) ← `ASSUMPTIONS.md` (البند الأحدث) ← كود الديمو ← `docs/saql-platform-spec.md`. الجدول في ARCHITECTURE §0.3.

## اصطلاحات
- رموز المصدر في القواعد: `S§` التصور · `D:` القرارات · `A#` ASSUMPTIONS · `C:` كود الديمو · **[جديد]** مقترح للحقيقية · ⚠️ ما كان بالواجهة فقط في الديمو.
- «س-NN» أسئلة القسم 20. «BR-NNN» قواعد العمل. «م.م» مسؤول المالية، «م.ت» مسؤول التقنية، «ق.ع» القائد العام، «ق.م» قائد المجموعة/فريق الرحلة.
