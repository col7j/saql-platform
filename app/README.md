# منصة صقل — النموذج الأولي

## التشغيل
```
cd app
npm install
npm run dev
```
ثم افتح: http://localhost:5173

- `npm test` لتشغيل اختبارات الصلاحيات والنقاط ودورة الاعتماد وعرض الحفل (`tests/show-*.test.ts`).
- `npm run build` لبناء نسخة ثابتة في `dist/` (تعمل بلا خادم لأن التوجيه بنمط Hash).

## البنية
- `src/domain/` منطق نقي: الأنواع، الصلاحيات، المسارات، محرك النقاط، التقويم.
- `src/data/` البيانات التجريبية وطبقة التخزين والـ Repositories (الواجهة الوحيدة للتعديل على البيانات).
- `src/state/` الحالة المركزية والمستخدم الحالي.
- `src/ui/` مكونات الواجهة بهوية صقل.
- `src/pages/` الشاشات (الموقع العام، الدخول، رابط المتابعة، والمنصة الداخلية).
- `src/show/` وضع «عرض الحفل» (#/show و#/show-admin)، حزمة منفصلة تُحمَّل خارج موجّه المنصة من `main.tsx`:
  - `model.ts` الفقرات وأنواعها، `nav.ts` الترتيب والتنقل (منطق نقي)، `storage.ts` مفتاح `show-config` واستيراد/تصدير وshow.json، `media.ts` الوسائط وIndexedDB والتحميل المسبق.
  - `sync.ts` واجهة `ShowSync` بتنفيذ BroadcastChannel. لاستبدالها بـ Firebase/Supabase اكتب تنفيذاً جديداً للواجهة وغيّر `useSync` في `useShow.ts` فقط.
  - `guard.ts` يمنع في نوافذ العرض أي كتابة على مفاتيح المنصة `saql.*`.
  - `demo/` الديمو: `DemoFrame` يعرض شاشات المنصة الحقيقية في iframe (`#/show/demo`) فوق لقطة ثابتة ومتجر للقراءة فقط، و`DemoView` كاميرا بتحويلات CSS (`camera.ts`).

القرارات والافتراضات في `../ASSUMPTIONS.md`.

## ملاحظة iCloud
سطح المكتب مُزامَن مع iCloud، وiCloud قد يُخلي ملفات الحزم من القرص فتتعطل القراءة. لذلك الحزم مثبتة في `~/.saql-platform-deps` (خارج iCloud)، و`app/node_modules` رابط رمزي إليها. لإعادة التثبيت:
```
cp package.json ~/.saql-platform-deps/ && npm install --prefix ~/.saql-platform-deps && ln -sfn ~/.saql-platform-deps/node_modules node_modules
```
