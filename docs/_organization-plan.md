# خطة ترتيب الملفات (الخطوة 0)

نُفّذت قبل أي تعديل على الكود. **لم يُنقل ولم يُحذف ولم يُعدَّل أي ملف كود أو إعدادات.** النقل بـ`git mv` حيث الملف مُتتبَّع، وبـ`mv` حيث غير متتبَّع.

## الجرد (خارج `docs/`)

| الصنف | ما فيه |
|---|---|
| كود | `app/src` و`app/tests` و`app/scripts` و`app/public` و`app/firebase` |
| إعدادات وبناء | `package.json` (الجذر و`app/`) و`vite.config.ts` و`tsconfig*.json` و`tailwind.config.js` و`postcss.config.js` و`app/index.html` و`deploy-pages.sh` و`.github/workflows/static.yml` و`.gitignore` |
| بيانات تجريبية | داخل الكود (`app/src/data/seed*.ts`) و`app/public/show.json` |
| وثائق جذرية تبقى | `README.md` و`ASSUMPTIONS.md` |
| مجلد قديم خارج `docs/` | `docs-old/` (الوثائق القديمة التي كان اسم مجلدها `docs/`) |
| مواد هوية | `brand assets/` (الشعارات والخط وملف الهوية PDF وحزمة `saqal_identity_kit.jsx`) |
| مجلد معماري مستقل | `saql-real/docs/` (14 ملفاً لمرحلة المنصة الحقيقية) |
| بناء وحزم | `app/dist` و`app/node_modules` و`app/node_modules 2` (تُتجاهل) |

## جدول النقل

| الملف الحالي | الوجهة | السبب |
|---|---|---|
| `docs-old/` كاملاً (5 ملفات `.md` و`.DS_Store`) | `docs/archive/old-docs/` | التعليمات: يُنقل كما هو بلا تعديل محتوى |
| `docs-old/saql-platform-spec.md` | `docs/archive/old-docs/saql-platform-spec.md` | قديمة ومستبدلة بـ`docs/spec/` |
| `docs-old/saql-decisions.md` | `docs/archive/old-docs/saql-decisions.md` | قرارات النسخة 1 (للرجوع) |
| `docs-old/screen-inventory.md` | `docs/archive/old-docs/screen-inventory.md` | جرد قديم للشاشات (للرجوع) |
| `docs-old/ceremony-show-brief.md` و`ceremony-decisions.md` | `docs/archive/old-docs/` | مواصفات وضع عرض الحفل: لا تزال سارية على `#/show` (انظر INDEX) |
| `brand assets/` | **يبقى** | يعتمد عليه README وASSUMPTIONS، وهو مصدر الهوية الأصلي (ملف PDF وخطوط). أُشير إليه في INDEX |
| `saql-real/` | **يبقى** | مجلد مستقل غير كود المنصة التجريبية، وهو خاص بمرحلة `claude-code-architecture-prompt.md` (لا تُنفَّذ الآن) |
| `README.md` و`ASSUMPTIONS.md` | **يبقيان في الجذر** | حسب التعليمات |
| أي ملف كود أو إعدادات | **لا يُنقل** | ممنوع |

لا ملفات مجهولة، فلم يُنشأ `docs/archive/unsorted/` ولا `docs/archive/old-specs/` ولا `docs/archive/old-prompts/` (لا توجد وثائق متطلبات ولا برومتات قديمة خارج `docs-old/`).

## ما بعد النقل

- حُدِّثت المراجع إلى المسارات القديمة في `README.md` (3 مواضع) و`ASSUMPTIONS.md` (موضع واحد).
- التحقق: `tsc` و`npm test` (317 اختباراً) نجحا قبل النقل وبعده.
- التثبيت: `chore: organize docs` تثبيت مستقل.
