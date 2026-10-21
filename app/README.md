# منصة صقل — النموذج الأولي

## التشغيل
```
cd app
npm install
npm run dev
```
ثم افتح: http://localhost:5173

- `npm test` لتشغيل اختبارات الصلاحيات والنقاط ودورة الاعتماد.
- `npm run build` لبناء نسخة ثابتة في `dist/` (تعمل بلا خادم لأن التوجيه بنمط Hash).

## البنية
- `src/domain/` منطق نقي: الأنواع، الصلاحيات، المسارات، محرك النقاط، التقويم.
- `src/data/` البيانات التجريبية وطبقة التخزين والـ Repositories (الواجهة الوحيدة للتعديل على البيانات).
- `src/state/` الحالة المركزية والمستخدم الحالي.
- `src/ui/` مكونات الواجهة بهوية صقل.
- `src/pages/` الشاشات (الموقع العام، الدخول، رابط المتابعة، والمنصة الداخلية).

القرارات والافتراضات في `../ASSUMPTIONS.md`.

## ملاحظة iCloud
سطح المكتب مُزامَن مع iCloud، وiCloud قد يُخلي ملفات الحزم من القرص فتتعطل القراءة. لذلك الحزم مثبتة في `~/.saql-platform-deps` (خارج iCloud)، و`app/node_modules` رابط رمزي إليها. لإعادة التثبيت:
```
cp package.json ~/.saql-platform-deps/ && npm install --prefix ~/.saql-platform-deps && ln -sfn ~/.saql-platform-deps/node_modules node_modules
```
