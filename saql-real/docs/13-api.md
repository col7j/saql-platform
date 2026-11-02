# 13. تصميم الـ API

> أسلوب: REST/JSON تحت `/api/v1`، مورد لكل كيان، وإجراءات الانتقال كأفعال فرعية `POST /…/{action}` (لأن آلات الحالة تحمل منطقاً وأثراً جانبياً، القسم 5). يُنفَّذ بـ Route Handlers تستدعي **خدمات** (`server/modules/*/service.ts`) ولا تحتوي منطقاً.
> مصدر الأسماء: دوال `createLocalRepositories` في الديمو (كل دالة هنا لها مقابل هناك؛ الملحق أ يربط الشاشات). **الديمو لا يتحقق من الصلاحية في كثير من الدوال** (⚠️ في 5.x)، والـ API **يفحص كل نقطة**.

## 13.1 اصطلاحات

| البند | القرار |
|---|---|
| الصيغة | JSON UTF-8؛ المعرّفات UUID؛ التواريخ `YYYY-MM-DD`؛ اللحظات ISO 8601 UTC؛ الساعات `HH:mm`؛ **المال نص عشري** `"3240.00"` (لا رقم عائم). |
| المصادقة | كوكي جلسة `HttpOnly; Secure; SameSite=Lax` (`saql_session`) تُنشأ عند الدخول؛ حماية CSRF بفحص `Origin`/`Host` + رأس `X-CSRF-Token` (double-submit) لكل طريقة غير آمنة. نقاط `/public/*` لها ترتيبها. |
| الصلاحيات | تعتمد الخدمات على `can(actor, action, resource)` من `packages/domain` (القسم 2/12). الرمز في عمود «المستدعي»: **أي** مسجّل · **م** مشارك · **ف** فريق عمل · **ق.ع** · **ميسّر** · **ق.م** قائد فريق الرحلة · **م.م** مسؤول المالية · **FD:perm** مفوَّض · **م.ت** مسؤول التقنية · **متابع** · **مالك** صاحب المورد. |
| الترقيم | قوائم طويلة: `?limit=50&cursor=…` ← `{"data":[…],"next_cursor":"…"}`. القوائم الصغيرة (مجموعات، لجان، إعدادات) تُعاد كاملة. الترتيب الافتراضي بالأحدث. |
| التصفية والفرز | معاملات صريحة (`status`, `group_id`, `from`, `to`, `q`, `sort`). لا لغة استعلام عامة. |
| التزامن | الموارد المعدّلة من أطراف متعددة تحمل `version`؛ التعديل `PATCH` يتطلب `If-Match: "<version>"` ويرد `409 version_conflict` عند التعارض. |
| التكرار | كل `POST` ينشئ أو يحرّك مالاً يقبل `Idempotency-Key` (إلزامي لنقاط المال المعلَّمة 💰). |
| التحقق | مخططات Zod مشتركة (`packages/contracts`) على الخادم والعميل؛ الخطأ `422 validation_failed` بقائمة حقول. تُولَّد وثيقة OpenAPI من نفس المخططات. |
| الإصدار | `/api/v1`؛ التغيير الكاسر ⇒ `/v2`. |
| الحدود | `login`: 10/دقيقة/IP و5 محاولات/حساب؛ `supporter/login`: 5/15 دقيقة/IP؛ رفع الملفات: 30/دقيقة/مستخدم؛ الباقي 300/دقيقة/مستخدم. |
| الاستجابات | `200/201` بالمورد المحدَّث (يعاد كاملاً بحالته الجديدة ليُحدِّث الواجهة)، `204` للحذف. الإجراءات التي لها أثر مشتق تعيد `{ resource, effects: { notifications, points_run? } }` للتشخيص. |
| اللغة | الرسائل `detail` بالعربية، و`code` مفتاح ثابت إنجليزي. |

### صيغة الأخطاء (RFC 9457 `application/problem+json`)
```json
{
  "type": "https://saql.example/errors/insufficient_funds",
  "title": "الرصيد لا يكفي",
  "status": 409,
  "code": "insufficient_funds",
  "detail": "الرصيد الفعلي 1200.00 ر.س لا يكفي لـ 2000.00 ر.س. سجّل إيداعاً، أو اصرف جزءاً وأجّل الباقي.",
  "errors": [],
  "request_id": "01JABC…"
}
```
| الرمز | HTTP | متى |
|---|---|---|
| `unauthenticated` | 401 | لا جلسة / منتهية |
| `access_denied` | 403 | ممنوع **أو** غير موجود في مورد محمي (BR-014: الرسالة نفسها) |
| `not_found` | 404 | موارد عامة فقط (مثل جهة غير موجودة) |
| `validation_failed` | 422 | حقول ناقصة/غير صالحة (`errors[]`: path, code, message) |
| `state_conflict` | 409 | انتقال غير مسموح من الحالة الحالية (يذكر الحالة والمسموح) |
| `version_conflict` | 409 | `If-Match` قديم |
| `rule_violation` | 422 | قاعدة عمل (`rule: "BR-210"` + `failed_checks[]` مثل شروط النشر) |
| `capacity_conflict` | 422 | تعارض صفات (يذكر القاعدة) |
| `insufficient_funds` | 409 | رصيد المحفظة |
| `account_locked` | 423 | حساب/رابط داعم مقفل (`retry_after`) |
| `rate_limited` | 429 | |
| `locked_settings` | 423 | إعدادات التقييم مقفلة |
| `conflict_duplicate` | 409 | تكرار فريد (اسم دخول، كلمة مرور جهة) |
| `internal` | 500 | |

## 13.2 المصادقة والحساب والأشخاص

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `POST /auth/login` | عام (مقيَّد) | `{username, password}` | `{person, must_change_password}` + كوكي؛ 401 رسالة موحّدة؛ 423 مقفل |
| `POST /auth/logout` | أي | — | 204 |
| `GET /auth/me` | أي | — | `{person, capabilities, labels, nav, home, flags:{profile_complete, formation_published, pre_survey_pending}}` — **كل ما تحتاجه الواجهة للتوجيه** |
| `POST /auth/change-password` | أي | `{current, next}` | يُنهي `must_change_password`؛ يُبطل بقية الجلسات |
| `GET /people` | ف: الكل · م: الأسماء والمجموعات فقط | `?kind&group_id&q` | قائمة؛ الجوال/البريد لا يظهران لغير الفريق |
| `POST /people` | ق.ع (فريق/مشارك) · حامل `register_participants` (مشارك) | `{full_name, kind, email?, phone?, university?, major?, title?}` | ينشئ person + account بلا كلمة مرور ويشعر م.ت |
| `GET /people/{id}` | ف · نفسه | — | ملف + مرات التقديم + (ف) تقييم فردي |
| `PATCH /people/{id}` | نفسه (phone, university, major, photo) · ق.ع (title, phone, photo لفريق العمل) | | |
| `PUT /people/me/profile/complete` | م | `{photo_file_id, bank:{iban, bank_name?, barcode_file_id?}}` | يتحقق الآيبان `^SA\d{22}$`؛ يضبط `profile_completed_at` و`terms_accepted_at` |
| `GET /people/{id}/bank` | نفسه · FD:disburse | — | يسجَّل الاطلاع |
| `GET /accounts` | م.ت | | حساب لكل شخص (دون هاش) |
| `PATCH /accounts/{personId}` | م.ت | `{username}` | `conflict_duplicate` |
| `POST /accounts/{personId}/reset-password` | م.ت | — | `{temp_password}` **مرة واحدة** |
| `POST /accounts/{personId}/disable` · `…/enable` | م.ت | | يمنع تعطيل نفسه |
| `GET /grants` · `POST /grants` · `DELETE /grants/{id}` | ق.ع | `{person_id, permission, expires_on}` | |
| `GET /capacity-rules` | ق.ع · م.ت | | `PUT /capacity-rules/{id}` · `POST` · `DELETE` — المالك غير محدد بالديمو (20 س-24)؛ مقترح م.ت |
| `GET /people/{id}/notes` · `POST /people/{id}/notes` | ف (قراءة) · ميسّر المشارك/ق.ع (كتابة) | `{text}` | |
| `GET /messages` · `POST /messages` · `POST /messages/{id}/reply` | ق.ع (الكل/رد) · م (مرسل وقت قبل النشر) | | |

## 13.3 المجموعات والتشكيل

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `GET /groups` | أي (بعد النشر) · ف دائماً | | مع الأعضاء والقائد والميسّر |
| `POST /groups` · `PATCH /groups/{id}` | ق.ع | `{name, color, leader_id, facilitator_id}` | `capacity_conflict` |
| `PUT /groups/{id}/members/{personId}` · `DELETE …` | ق.ع | | قبل النشر فقط؛ وبعده استخدم النقل |
| `POST /groups/transfers` | ق.ع | `{person_id, to_group_id, reason?}` | بعد النشر؛ يسجّل ويشعر |
| `GET /formation` | أي | | `{status, publish_at, published_at}` |
| `POST /formation/schedule` | ق.ع | `{publish_at}` | |
| `POST /formation/publish` | ق.ع | — | فوري |

## 13.4 اللجان والمهام والاجتماعات والتعليقات

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `GET /committees` · `GET /committees/{id}` | ف (قائمة) · عضو/ق.ع (تفاصيل) | | غير العضو ← `access_denied` (نفس الرسالة للموجود وغير الموجود) |
| `POST /committees` | ق.ع | `{name, kind, description}` | |
| `PUT /committees/{id}/members/{personId}` · `DELETE` | ق.ع | `{role, can_see_finance}` | فحص التعارض + تدقيق |
| `POST /committees/{id}/member-requests` | قائد اللجنة | `{person_id, note?}` | |
| `POST /member-requests/{id}/decision` | ق.ع | `{approve, role?, can_see_finance?}` | |
| `PUT /committees/{id}/kpis/{kpiId}` · `DELETE …` | قائد اللجنة · ق.ع | `{title, target, task_tag}` | |
| `GET /tasks` | أي (يرى ما يخصه + اللجان التي يراها) | `?mine&scope&committee_id&trip_id&status&late` | |
| `POST /tasks` | وفق BR-703 | `{title, scope, assignee_id, due_date, proof_type, committee_id?, trip_id?, …}` | |
| `PATCH /tasks/{id}` | المنشئ · المسند | | تغيير المسند يشعر |
| `POST /tasks/{id}/complete` | المسند | `{proof?: {kind, value|file_id}}` | `rule_violation` إن الإثبات مطلوب |
| `DELETE /tasks/{id}` | المنشئ · ق.ع | | |
| `GET/PUT/DELETE /task-templates` | ق.ع | | |
| `GET /comments?target_kind&target_id` · `POST /comments` | من يرى الهدف | `{target_kind, target_id, text, kind}` | |
| `GET /meetings` · `GET /meetings/{id}` | المدعوون/المسؤول/المنشئ/ق.ع/م.م | | |
| `POST /meetings` | ف | `{…, invitee_ids, agenda[], budget?:{amount,note}}` | يرفض المشارك وقائد المجموعة (يستخدمان الطلب) |
| `POST /meetings/requests` | ق.ع.م (قائد مجموعة) | نفس النموذج | ق.ع مدعو افتراضياً |
| `PATCH /meetings/{id}` | المسؤول · المنشئ | | |
| `POST /meetings/{id}/held` | المسؤول | `{attendee_ids}` | |
| `PUT /meetings/{id}/minutes` | المسؤول | `{discussion, decisions[], outputs[], tasks[]}` | ينشئ المهام |
| `POST /meetings/{id}/close` | المسؤول | | ينشئ التالي إن دوري |

## 13.5 الرحلات

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `GET /trips` | أي (حسب إخفاء المنفِّذ قبل النشر) | `?type&stage&group_id` | مع `stage`, `progress`, أقرب موعد |
| `GET /trips/{id}` | أي | | بيانات الرحلة حسب الصلاحية (الخطط للفريق والإدارة فقط؛ العام: تفاصيل الرحلة) |
| `POST /trips` | ق.ع | `{title, type, executor, start_date, end_date, location?, description?, is_personal_plan_meeting, deadlines?}` | `capacity_conflict` / `rule_violation` (BR-201) |
| `POST /trips/double` | ق.ع | `{…, group_ids:[a,b], split_date}` | `{ids:[1,2]}` |
| `PATCH /trips/{id}` | ق.ع (أساسي) · ق.م (مسؤول التحضير، مسؤول التنسيقات) | `If-Match` | تعديل التاريخ يزامن المزدوجة |
| `GET /trips/{id}/stage` | أي | | `{stage, publish_checks:[{label, ok}], closure_checks}` |
| `GET /trips/{id}/docs` | من يرى الخطط | | الثلاثة بحالاتها |
| `PATCH /trips/{id}/docs/{kind}` | ق.م | `{fields}` + `If-Match` | في draft/returned فقط |
| `POST /trips/{id}/docs/{kind}/submit` | ق.م | — | `state_conflict` / `rule_violation` |
| `POST …/{kind}/facilitator-approve` · `…/facilitator-reject` | ميسّر الرحلة | `{reason}` للرفض | |
| `POST …/{kind}/leader-approve` · `…/leader-edit-approve` · `…/leader-reject` | ق.ع | `{reason}` + `fields?` | |
| `GET /trips/{id}/docs/{kind}/revisions` | من يرى الخطط | | |
| `GET /trips/{id}/schedule` | حسب `participantScheduleView` | | الخطط والبنود + الفعلي |
| `PUT /trips/{id}/schedule` | ق.م | `{plans:[{id,name,items:[…]}], sessions?}` | `rule_violation` على بند بدأ (BR-214) |
| `POST /trips/{id}/schedule/visibility` | ق.م | `{mode: hidden|full|next24}` | يشعر المشاركين |
| `PUT /trips/{id}/guests` | ق.م | `[{name, role, session_id?, confirmed}]` | |
| `PATCH /trips/{id}/coordinations/{key}` | ق.م · المسؤول | `{status, note}` | |
| `PUT /trips/{id}/plan-unlock` | ق.م · ق.ع | `{mode:'item', item_id}|{mode:'time', at}` | لرحلة الخطة الشخصية |
| `POST /trips/{id}/publish` | ق.م | — | 💰 لا؛ `rule_violation` بالشروط الناقصة |
| `GET /trips/{id}/attendance` · `PUT /trips/{id}/attendance/{personId}` | ق.م · مسؤول التحضير | `{status, session_id?}` | الرحلة: early/on_time/late/absent؛ لقاء: present/absent |
| `GET /tracker/trips` | متابع/بديل | | الرحلات الحية والقادمة |
| `PUT /trips/{id}/actual/{itemId}` | متابع الرحلة | `{followed:'A'|'B'|'none', note?, actual_start?, actual_end?, category_id?}` | يُحدّث الحي للداعمين |
| `POST /trips/{id}/tracker-substitute` | المتابع الدائم | `{candidate_id, reason}` | `capacity_conflict` |
| `POST /trips/{id}/tracker-substitute/decision` | ق.ع | `{approve}` | |
| `PUT /trips/{id}/ratings/me` | ف | `{score 0..10, note?}` | مرة واحدة (409 إن تكرر) |
| `PUT /trips/{id}/finance-ratings/{key}` | م.م | `{score 0..5}` | |
| `PATCH /trips/{id}/closure` | ق.م · الإعلامية (للدرايف والتغريدات والصور) · ق.ع | `{team_eval_form?, experience_form?, public_report?, drive_link?, tweets?, photo_file_ids?}` | |
| `GET /trips/{id}/closure-checks` | ف | | قائمة المتطلبات |
| `POST /trips/{id}/close` | ق.م · ق.ع | — | `rule_violation` بالمتطلب الناقص |
| `GET /events` · `POST /events` · `POST /events/{id}/done` | أي · ق.ع | `{kind, title, date, retroactive, attendees?}` | واحد لكل نوع |

## 13.6 لقاءات التركيز واللقاءات الفردية والخطة الشخصية

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `GET /focus` | ف · أعضاء المجموعة بعد النشر | `?group_id&status` | مع العداد |
| `GET /focus/{id}` | `canViewFocus` | | |
| `POST /focus` | الميسّر | `{group_id, title, is_umrah, topic_mode, …, presenter_mode, presenter_ids[], axes, guest_name?, budget?:{amount,note}}` | 💰؛ يرفض طلب ميزانية لما بعد الحد الأعلى |
| `PATCH /focus/{id}` | الميسّر | | |
| `PUT /focus/{id}/presenters` | الميسّر | `{mode, ids[], axes, guest_name?, topic?}` | قبل الموعد؛ `rule_violation` |
| `POST /focus/{id}/publish` | الميسّر | | |
| `PUT /focus/{id}/attendance-taker` | ق.م · الميسّر | `{person_id}` | نائب لهذا اللقاء |
| `PUT /focus/{id}/attendance/{personId}` | مسجّل الحضور | `{status: present|absent}` | |
| `POST /focus/{id}/hold` | مسجّل الحضور | | يُنشئ الاستبيان؛ إشعار الغياب |
| `PUT /focus/{id}/presenter-scores/{personId}` | الميسّر | `{scores:{style:1..5,…}}` | |
| `POST /focus/{id}/close` | الميسّر | | |
| `GET /individual/slots` · `POST /individual/slots` · `DELETE /individual/slots/{id}` | الميسّر (إنشاء/حذف) · م (قراءة مجموعته) | `{date,start,end,invite:'open'|person_id}` | |
| `POST /individual/slots/{id}/book` | م | — | ذرّي؛ `state_conflict` إن محجوز |
| `POST /individual/requests` | م | `{date, start, note}` | |
| `POST /individual/{id}/confirm` | الميسّر | `{date,start,end}` | |
| `POST /individual/{id}/complete` | الميسّر | `{notes_on_plan, notes_on_meeting, attachment?}` | يسجّل الحضور |
| `POST /individual/{id}/cancel` | الميسّر · م | | |
| `GET /plans` | ق.ع · الميسّر (مجموعته) | `?group_id` | قائمة بتقدّم كل خطة |
| `GET /plans/me` · `GET /plans/{participantId}` | نفسه · ميسّره · ق.ع | | `locked` + سبب (`unlock_at`) |
| `PUT /plans/{pid}/aspects/{key}` | صاحبها | `{level, vision, steps[]}` | إن مفتوحة |
| `POST /plans/{pid}/steps/{stepId}/follow-ups` | صاحبها | `{started, progress, challenge?, overcome?, need_help?, status}` | |
| `POST /plans/{pid}/unlock` | ق.ع | `{on}` | |
| `PUT /final-files/{participantId}` | ميسّر المشارك | `{advice, file_id}` | |

## 13.7 الاستبيانات والمكتبة

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `GET /surveys` | أي | `?mine` | المؤهَّل فقط (`surveysForPerson`) |
| `GET /surveys/{id}` · `GET /surveys/{id}/results` | م (الأسئلة) · ف (النتائج + مقارنة قبلي/بعدي) | | |
| `POST /surveys` · `PUT /surveys/{id}` | ق.ع · فريق الإعداد · الميسّر (لقاء) | `{title, context, phase, mandatory, opens_at, questions[]}` | `rule_violation` للعام البعدي (BR-407) |
| `POST /surveys/{id}/responses` | م | `{answers:{question_id: value}}` | مرة واحدة/تحديث |
| `GET /materials` | أي | `?origin&trip_id&state=new|viewed|skipped&q` | مصفّاة بالرؤية |
| `POST /materials` | `canUploadMaterial` | `{title, type, url|file_id, origin, audience, reveal_mode, reveal_at?, points_requested?, …}` | |
| `PATCH /materials/{id}/reveal` | الرافع | `{revealed}` | |
| `PUT /materials/{id}/view` · `DELETE /materials/{id}/view` | م | `{status}` | |
| `POST /materials/{id}/points-decision` | ق.ع | `{approve}` | |

## 13.8 المالية

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `GET /finance/overview` | فتح المالية | | الرصيد، ما ينتظرني، العد |
| `GET /finance/program-budget` | `view_budget` · ق.ع | | الحالي + `versions[]` |
| `POST /finance/program-budget` | م.م | الحقول (7.2) | مرة واحدة (`state_conflict` إن محفوظة) 💰 |
| `GET /finance/budget-overview` | `view_budget` | | صفوف النظرة |
| `GET/POST/PATCH /finance/categories` · `POST /finance/categories/{id}/hide` | `manage_categories` | | `DELETE` يرفض المستخدم |
| `GET /finance/settings` · `PATCH /finance/settings` | م.م | `{max_open_custodies, split_alert, eval_items}` | تدقيق |
| `PUT /finance/members/{personId}/permissions/{perm}` | م.م | `{on}` | تدقيق + إشعار |
| `GET /finance/requests` | حسب الرؤية | `?status&owner_kind&mine&waiting_on_me` | مع `stage{label,next,waiting_on}` |
| `GET /finance/requests/{id}` | صاحب الطلب · الميسّر · مالية · ق.ع | | الأسطر، السجل، العهدة والأرقام |
| `POST /finance/requests` | المقدّم (BR-511) | `{owner_kind, owner_id, amount?, lines[], detailed, note}` | 💰؛ تقديم أو إعادة تقديم |
| `POST /finance/requests/{id}/facilitator-decision` | ميسّر الرحلة | `{approve, reason?}` | |
| `POST /finance/requests/{id}/finance-decision` | FD:approve_within (ليس الطالب) | `{approve, reason?}` | 💰 |
| `POST /finance/requests/{id}/leader-decision` | ق.ع | `{decision:'approve'|'reject'|'detail', reason?}` | |
| `GET /finance/wallet` | `view_budget` · `disburse` | `?kind&from&to` | الحركات + الأرقام |
| `POST /finance/wallet/deposits` | FD:disburse | `{amount, source, attachment_id, note?}` | 💰 |
| `GET /finance/custodies` · `GET /finance/custodies/{id}` | مالية · المستلم · ق.ع | `?status&recipient_id` | الأرقام + النماذج |
| `POST /finance/requests/{id}/disburse` | FD:disburse | `{recipient_id, amount, attachment_id}` | 💰؛ `insufficient_funds` / `rule_violation` (العهد المتزامنة) |
| `POST /finance/custodies` | FD:disburse | `{owner_kind, owner_id, recipient_id, approved, amount, attachment_id}` | افتتاحي/ختامي/احتياجات فقط 💰 |
| `POST /finance/custodies/{id}/transfers` | FD:disburse | `{amount, attachment_id}` | 💰 |
| `POST /finance/custodies/{id}/spend-forms` | المستلم | `{vendor, serial?, invoice_date, proof_kind, attachment_id, lines[]}` | `warnings[]` (تكرار/تجزئة) |
| `GET /finance/invoices` | `review_invoices` · `view_budget` | `?status=pending&activity&holder&flag` | الجدول |
| `PATCH /finance/spend-forms/{id}/serial` | `review_invoices` | `{serial}` | ليس المالك |
| `POST /finance/spend-lines/{id}/review` | `review_invoices` | `{accept, category_id?, amount?, note?}` | |
| `POST /finance/custodies/{id}/close-request` | المستلم | | |
| `POST /finance/custodies/{id}/surplus-receipt` | المستلم | `{attachment_id}` | |
| `POST /finance/custodies/{id}/settlement` | `close_custody` | `{method, bearer?, attachment_id?, note?}` | 💰 |
| `POST /finance/custodies/{id}/close` | `close_custody` | | |
| `GET/POST /finance/direct-spends` | `view_budget`/`disburse` | `{allocations[], vendor, serial?, invoice_date, proof_kind, attachment_id, lines[]}` | 💰 |
| `GET/POST /finance/needs` · `POST /finance/contracts` · `POST /finance/contracts/{id}/payments/{pid}/pay` | `disburse` | | 💰 |
| `GET /finance/edit-requests` · `POST /finance/edit-requests` | تنفيذي · ق.ع (قراءة) | `{target, patch, summary, reason}` | |
| `POST /finance/edit-requests/{id}/decision` | ق.ع | `{approve, note?}` | يطبّق في transaction |
| `GET /finance/fees` · `PUT /finance/fees/{personId}` | `view_budget` · م.م | `{status, paid_amount?, exemption?, note?}` | |
| `GET /finance/reports/analysis` | `view_budget`/م.م/ق.ع | `?group_by=category|kind|activity` | |
| `GET /finance/audit` | م.م · مفوَّض · ق.ع | `?area=finance&cursor` | |

## 13.9 التقييم والنقاط

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `GET /evaluation/config` | أي | | البنود والأوزان (يراها المشاركون) + حالة القفل |
| `PUT /evaluation/config` | ق.ع · م.ت (إن غير مقفل) | القيم كاملة | `locked_settings` 423؛ يقفل ويلتقط نسخة ويطلق `points_run` |
| `POST /evaluation/unlock` | م.ت | `{reason}` | إشعار ق.ع + تدقيق |
| `GET /evaluation/versions` | ق.ع · م.ت | | |
| `GET /leaderboard` | م (بعد النشر) · ف | | المجموعات + الخمسة + «مستواي»؛ قبل النشر `{visible:false}` |
| `GET /scores/me` · `GET /scores/persons/{id}` | نفسه · ف | | تفصيل البنود |
| `GET /scores/groups` · `GET /scores/log` · `GET /scores/staff` | ف / م (ما يخصه) | | |
| `POST /scores/recompute` | ق.ع · م.ت | | يدوي |
| `PUT /leader-evaluations/{participantId}` | ق.ع | `{scores:{}, note?}` | مرة واحدة |

## 13.10 الإشعارات والتقويم والرئيسية والمؤشرات والإعدادات

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `GET /notifications` | نفسه | `?unread&cursor` | |
| `POST /notifications/{id}/read` · `POST /notifications/read-all` | نفسه | | |
| `GET /home` | أي | | `{pending_actions[], widgets:{competition?,upcoming[]}, notices[]}` |
| `GET /calendar` | أي | `?from&to` | `eventsFor` |
| `GET /insights` | ف | | مؤشرات الإدارة |
| `GET /approvals` | ق.ع | | «بانتظار اعتمادي» (ميزانيات، نماذج رحلات، بديل متابع، عضوية، تعديل سجلات، تنبيهات تجاوز) |
| `GET /settings` | حسب الملكية | `?group=` | |
| `PATCH /settings/{key}` | المالك (BR-902) | `{value}` + `If-Match` | `access_denied` يسمّي المالك |
| `GET/PUT /settings/schedule-categories` | ق.ع · `manage_schedule_categories` | | |
| `GET/PUT /settings/ui` · `PUT /settings/notification-policy` | م.ت | | |
| `GET /audit` | م.ت · ق.ع | `?area&cursor` | |

## 13.11 الملفات والعام

| الطريقة والمسار | المستدعي | الدخل | الخرج / ملاحظات |
|---|---|---|---|
| `POST /files` | أي مصرَّح له بالغرض | `{purpose, name, mime, size}` | `{id, upload_url}` presigned |
| `POST /files/{id}/complete` | الرافع | | الخادم يحسب sha256 ويتحقق |
| `GET /files/{id}/url` | حسب الكيان الحامل | | رابط 5 دقائق |
| `GET /public/site` | عام | | المحتوى + أقسام (ISR) |
| `POST /public/supporter/login` · `POST …/logout` | عام | `{password}` | 401/423 |
| `GET /public/supporter/overview` | جلسة داعم | | حسب 11.2 (حسب الحالة) |
| `GET /public/supporter/trips/{id}/live` | جلسة داعم | | الجدول الفعلي (استطلاع) |
| `POST /public/supporter/comments` | جلسة داعم | `{name?, text}` | pending |
| `GET/POST/PATCH /supporters` · `PUT /supporters/{id}/password` | ق.ع | | |
| `GET /tracking-comments` · `POST /tracking-comments/{id}/moderate` | ف | `{status}` | |
| `GET/PUT /site` · `POST/PATCH/DELETE /site/sections` | ق.ع · `edit_site` | | الترتيب `PUT /site/sections/order` |
| `GET /healthz` · `GET /readyz` | بنية | | للنشر والمراقبة |

> كل النقاط أعلاه تعيد `access_denied` للمستدعي غير المخوَّل ولا تفصح هل المورد موجود (BR-014)، إلا حين يكون المورد عاماً.
