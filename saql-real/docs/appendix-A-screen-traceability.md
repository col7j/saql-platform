# ملحق (أ): جدول تتبّع الشاشات

> كل مسار في `app/src/App.tsx` وكل تبويب/نافذة رئيسية (من `pages/*` و`docs/screen-inventory.md`) ← ما يقابله في المنصة الحقيقية. «الوحدة» بأسماء القسم 3. المسارات الجديدة تحت `apps/web/src/app/…`.

## الموقع العام وحسابات الدخول

| الشاشة في الديمو (المسار) | الوحدة | نقاط API (القسم 13) | الكيانات |
|---|---|---|---|
| الموقع العام `#/` (Home.tsx) | الموقع العام | `GET /public/site` | `site_content`, `site_section`, `person` (فريق/متميزون), `grp` |
| الدخول `#/login` (Login.tsx) + تغيير الكلمة المؤقتة | الهوية | `POST /auth/login`, `POST /auth/change-password` | `account`, `session` |
| رابط الداعم `#/supporter` (Tracking.tsx): دخول + عرض + تعليقات | الموقع العام/الداعم | `POST /public/supporter/login`, `GET …/overview`, `GET …/trips/{id}/live`, `POST …/comments` | `supporter_entity`, `supporter_session`, `trip`, `actual_schedule_entry`, `tracking_comment` |
| `#/t/:token` (قديم) | — | تحويل إلى `/supporter` | لا مقابل |
| شريط «الدخول كـ»/إعادة البيانات (RoleSwitcher) | — (للنموذج فقط) | **لا يُنقل** | — |

## المنصة الداخلية `/app`

| الشاشة (المسار) | الوحدة | API | الكيانات |
|---|---|---|---|
| الرئيسية `/app` (Dashboard.tsx): المطلوب منك، المنافسة، القادم | الإشعارات/التقييم/التقويم | `GET /home`, `GET /leaderboard`, `GET /calendar` | `notification`, `points_entry`, محسوب |
| التقويم `/app/calendar` | التقويم | `GET /calendar` | `trip`, `program_event`, `focus_meeting`, `individual_meeting`, `plan_step` |
| الإشعارات `/app/notifications` + الجرس | الإشعارات | `GET /notifications`, `POST …/read`, `…/read-all` | `notification` |
| الرحلات `/app/trips` (Trips.tsx): قائمة، بطاقات، إنشاء، مزدوجة، الافتتاحي/الختامي | الرحلات | `GET /trips`, `POST /trips`, `POST /trips/double`, `GET/POST /events` | `trip`, `program_event`, `trip_doc`, `task` |
| تفاصيل الرحلة `/app/trips/:id` — تبويب نظرة عامة | الرحلات | `GET /trips/{id}`, `GET …/stage`, `POST …/publish`, `POST …/close` | `trip` |
| … تبويب النماذج والاعتماد (DocsTab) | الرحلات | `docs/*` (submit/approve/reject)، `GET …/revisions`, `comments` | `trip_doc`, `approval`, `trip_doc_revision`, `comment` |
| … تبويب الميزانية (RequestPanel) | المالية | `POST /finance/requests`, قرارات | `budget_request`, `…_line`, `…_event` |
| … تبويب الجدول الزمني (ScheduleTab) | الرحلات | `GET/PUT …/schedule`, `…/visibility` | `schedule_plan`, `schedule_item`, `trip_session`, `schedule_category` |
| … تبويب التجهيز والمهام (PrepTab) | الرحلات/المهام | `tasks`, `PATCH …/coordinations`, `PATCH /trips/{id}` | `task`, `trip_coordination` |
| … تبويب بيانات/تفاصيل الرحلة (DataTab): ضيوف، مواد قبلية، عرض الجدول، الخطة الشخصية | الرحلات/المكتبة | `PUT …/guests`, `materials`, `PUT …/plan-unlock`, `…/tracker-substitute` | `trip_guest`, `material`, `trip` |
| … تبويب الحضور (AttendanceTab) | الرحلات/التقييم | `GET/PUT …/attendance` | `attendance` |
| … تبويب الإغلاق والتقييم (ClosureTab) | الرحلات | `PATCH …/closure`, `PUT …/ratings/me`, `…/finance-ratings`, `GET …/closure-checks` | `trip_staff_rating`, `trip_finance_rating`, `trip_tweet`, `trip_photo` |
| متابعة الرحلات `/app/tracker` (Tracker.tsx) | الرحلات | `GET /tracker/trips`, `PUT …/actual/{itemId}` | `actual_schedule_entry` |
| لقاءات التركيز `/app/focus` + إنشاء (StepWizard) | لقاءات التركيز | `GET/POST /focus` | `focus_meeting`, `budget_request` |
| تفاصيل اللقاء `/app/focus/:id`: مقدّم، نشر، حضور، تقييم، ملفات | لقاءات التركيز | `PUT …/presenters`, `publish`, `hold`, `attendance`, `presenter-scores`, `close`, `materials` | `focus_presenter`, `presenter_score`, `attendance`, `material` |
| اللقاءات الفردية `/app/individual` | الفردية والخطة | `individual/*` | `availability_slot`, `individual_meeting` |
| الخطط الشخصية `/app/plans` + `/app/plans/:id` + «خطتي» `/app/plan` (PlanView) | الفردية والخطة | `GET /plans*`, `PUT …/aspects`, `…/follow-ups`, `…/unlock`, `PUT /final-files` | `personal_plan`, `life_aspect`, `plan_step`, `step_follow_up`, `final_file` |
| الاستبيانات `/app/surveys` | الاستبيانات | `surveys/*` | `survey`, `survey_question`, `survey_response`, `survey_answer` |
| المكتبة `/app/library` + رفع (MaterialUpload) | المكتبة | `materials/*`, `files/*` | `material`, `material_view`, `file` |
| المجموعات `/app/groups`: تشكيل، نشر، نقل، ملاحظات | المستخدمون والمجموعات | `groups/*`, `formation/*`, `notes` | `grp`, `group_member`, `group_formation`, `group_transfer`, `facilitator_note` |
| الأشخاص والصلاحيات `/app/people` (+`users`): الأشخاص · فريق العمل · اللجان · الصلاحيات المؤقتة · المتابع الدائم · قواعد التعارض · (م.ت) الحسابات | المستخدمون | `people/*`, `accounts/*`, `grants/*`, `capacity-rules/*`, `committees/*`, `PATCH /settings/tracker` | `person`, `account`, `temp_grant`, `capacity_rule`, `committee_membership` |
| ملف شخص `/app/people/:id` (Person.tsx): بيانات، مرات التقديم، ملاحظات، تقييم ق.ع | المستخدمون/التقييم | `GET /people/{id}`, `notes`, `PUT /leader-evaluations/…`, `GET /scores/persons/{id}` | `person`, `facilitator_note`, `leader_evaluation*` |
| ملفي `/app/profile` (Profile.tsx): أول دخول، صورة، آيبان | المستخدمون | `PUT /people/me/profile/complete`, `PATCH /people/{id}` | `person`, `bank_account`, `file` |
| الترتيب `/app/leaderboard`: ترتيب، تفصيل المجموعات، سجل النقاط، نقاط الإدارة | التقييم | `GET /leaderboard`, `/scores/*` | `points_entry`, `points_run` |
| المهام `/app/tasks` (+TaskParts) | اللجان والمهام | `tasks/*` | `task`, `comment` |
| اللجان `/app/committees` + `/:id` + «لجنتي» | اللجان | `committees/*` | `committee`, `committee_kpi`, `committee_membership`, `member_request`, `task` |
| الاجتماعات `/app/meetings` + `/:id` (محضر) | الاجتماعات | `meetings/*` | `meeting` + فرعيات، `task` |
| المؤشرات `/app/insights` | التقييم/التقارير | `GET /insights` | محسوب من الجميع |
| بانتظار اعتمادي `/app/approvals` (Approvals.tsx) | عبر الوحدات | `GET /approvals`, قرارات الميزانية/التعديل/الاعتماد | `budget_request`, `trip_doc`, `edit_request`, `member_request`, `material` |
| الطلبات والعهد `/app/requests` (+`custody`) (Requests, RequestsCustody, CustodyCard) | المالية | `finance/requests`, `custodies`, `spend-forms` | `budget_request`, `custody`, `spend_form` |
| المالية `/app/finance?tab=overview` | المالية | `GET /finance/overview` | محسوب |
| … `requests` (الطلبات والعهد) | المالية | `finance/requests/*`, `custodies/*` | كما أعلاه |
| … `invoices` (InvoiceTable) | المالية | `GET /finance/invoices`, `…/spend-lines/{id}/review`, `…/serial` | `spend_line`, `spend_form` |
| … `direct` (صرف مباشر، احتياجات، عقود) | المالية | `finance/direct-spends`, `needs`, `contracts` | `direct_spend*`, `program_need`, `contract*` |
| … `wallet` (المحفظة والموازنة + BudgetWizard) | المالية | `finance/wallet`, `program-budget`, `budget-overview` | `wallet_entry`, `program_budget_version` |
| … `fees` | المالية | `finance/fees` | `fee_record` |
| … `reports` (التحليلات · سجل المالية) | المالية/التدقيق | `finance/reports/analysis`, `finance/audit` | `spend_line`, `direct_spend`, `audit_log` |
| … `settings` (التصنيفات · الفريق والصلاحيات · الإعدادات · طلبات التعديل) (EditRequest) | المالية | `finance/categories`, `members/*/permissions`, `settings`, `edit-requests` | `budget_category*`, `committee_membership`, `setting`, `edit_request` |
| الرسائل `/app/messages` (+`contact`,`inbox`) | المستخدمون | `messages/*` | `admin_message` |
| سجل التدقيق `/app/audit` (Audit.tsx) | التدقيق | `GET /audit` | `audit_log` |
| رابط الداعم (إدارة) `/app/tracking-link` | الموقع العام/الداعم | `supporters/*`, `tracking-comments/*` | `supporter_entity`, `tracking_comment` |
| تحرير الموقع `/app/site-editor` | الموقع العام | `site/*` | `site_content`, `site_section`, `file` |
| الإعدادات `/app/settings`: التقييم والأوزان · المستهدفات والأعداد · تصنيفات الجدول · قالب المهام · الإشعارات | الإعدادات | `evaluation/*`, `settings/*`, `task-templates` | `evaluation_*`, `setting`, `schedule_category`, `task_template`, `notification_policy` |
| المزيد `/app/more` (قائمة الجوال) | الواجهة | `GET /auth/me` (nav) | `ui_config` |
| صفحة رفض الوصول (AccessDenied) | الوصول | — (403 `access_denied`) | — |

## خارج النطاق (موثّق للتحقق من الاكتمال)
| العنصر | القرار |
|---|---|
| عرض الحفل `#/show`, `#/show-admin`, `#/show-remote`, `#/show/demo` + `app/src/show/*` + Firebase + `scripts/*` | أداة مستقلة تبقى في الديمو (15.2، س-18) |
| `RoleSwitcher`, إعادة البيانات، مفاتيح `saql.*` | للنموذج فقط |
