# 15. خطة النقل من الديمو

> الديمو **مرجع للقراءة فقط**: لا يُعدَّل ولا يُنسخ كوده كما هو. يُفهم منه السلوك، ويُعاد بناؤه في `saql-real/` بملفات جديدة.

## 15.1 جدول مطابقة الكيانات

| كيان الديمو (`types.ts`) | الجدول الحقيقي | التحويلات اللازمة |
|---|---|---|
| `Person` | `person` + `bank_account` + `account` | فصل `bank` إلى جدول مشفّر؛ `photo` (Attachment) ← `file`؛ `email` اختياري؛ `profileCompletedAt` يُنقل ويُضاف `terms_accepted_at` |
| `Account` | `account` | كلمة المرور SHA-256 **لا تُنقل** (حسابات الديمو تجريبية)؛ كلمات جديدة بـArgon2id |
| `TempGrant` | `temp_grant` | `expiresAt` ← `expires_on` |
| `CapacityRule` | `capacity_rule` | كما هي |
| `Group` (memberIds[]) | `grp` + `group_member` | مصفوفة ← جدول ربط |
| `GroupFormation` | `group_formation` | صف واحد |
| `TransferLog` | `group_transfer` | |
| `FacilitatorNote`, `AdminMessage` | `facilitator_note`, `admin_message` | |
| `Committee`, `CommitteeKPI` | `committee`, `committee_kpi` | |
| `CommitteeMembership` (financePerms[]) | `committee_membership` (`finance_perm[]`) | |
| `MemberRequest` | `member_request` | |
| `Task`, `TaskTemplate` | `task`, `task_template` | `proof` النصي ← `proof`/`proof_file_id` |
| `Trip` (+ executor union) | `trip` + `trip_staff_member` | `executor` ← أعمدة `executor_kind/group_id/staff_leader_id`؛ `deadlines{}` ← 3 أعمدة؛ `trackerSubstitute` ← 3 أعمدة؛ `closure{}` ← أعمدة + `trip_tweet`/`trip_photo`؛ `evaluation{}` ← `trip_staff_rating` + `trip_finance_rating` |
| `TripDoc` + `Approval[]` | `trip_doc` + `approval` + `trip_doc_revision` | `fields` Record ← jsonb؛ تُولَّد revisions من `history` عند الاستيراد |
| `SchedulePlan`/`ScheduleItem` | `schedule_plan`/`schedule_item` | `plans[]` ← صفوف بـ`position` |
| `TripSession`, `TripGuest`, `Coordination` | `trip_session`, `trip_guest`, `trip_coordination` | |
| `ActualScheduleEntry` | `actual_schedule_entry` | |
| `ProgramEvent` | `program_event` | |
| `FocusMeeting` (presenterIds[], presenterAxes, presenterEvaluations) | `focus_meeting` + `focus_presenter` + `presenter_score` | `presenterEvaluations` Record ← صفوف؛ `seq_in_group` يُحسب من ترتيب الإنشاء |
| `AvailabilitySlot`, `IndividualMeeting` | `availability_slot`, `individual_meeting` | `invite:'open'|ID` ← عمودان |
| `PersonalPlan`/`LifeAspect`/`PlanStep`/`StepFollowUp` | `personal_plan`/`life_aspect`/`plan_step`/`step_follow_up` | |
| `FinalFile` | `final_file` | Attachment ← `file` |
| `Survey`/`Question`/`SurveyResponse` | `survey`/`survey_question`/`survey_response`/`survey_answer` | `answers` Record ← صفوف؛ `context` ← أعمدة |
| `Material`/`MaterialView` | `material`/`material_view` | `audience` union ← أعمدة |
| `BudgetCategory` (+items) | `budget_category`/`budget_category_item` | |
| `ProgramBudget` | `program_budget_version` (v1) | `AllocationRule` ← 3 أعمدة لكل قاعدة |
| `BudgetRequest` (+lines, history) | `budget_request` + `budget_request_line` + `budget_request_event` | `allocated_version=1` |
| `WalletEntry` | `wallet_entry` | `Attachment` ← `file`؛ `ref{}` ← FKs |
| `Custody`, `CustodyTransfer`, `CustodySettlement` | `custody`, `custody_transfer`, `custody_settlement` | |
| `SpendForm`/`SpendLine` | `spend_form`/`spend_line` | `original{}` ← 3 أعمدة |
| `DirectSpend` | `direct_spend` + `direct_spend_allocation` + `direct_spend_line` | |
| `ProgramNeed`, `Contract`, `ContractPayment` | `program_need`, `contract`, `contract_payment` | |
| `EditRequest` | `edit_request` | `target` union ← `target_kind/target_id`؛ `patch` jsonb |
| `FeeRecord` | `fee_record` | |
| `AuditEntry` | `audit_log` | `area` الافتراضي finance |
| `Meeting` (agenda[], decisions[], outputs[]) | `meeting` + فرعيات | مصفوفات ← جداول |
| `Attendance` (eventKind+eventId) | `attendance` | `eventId` ← FK بحسب النوع |
| `PointsEntry` (محسوب حياً) | `points_run`/`points_entry` | لا ينقل: يُولَّد |
| `EvaluationItem` + Settings.* | `evaluation_item`/`subitem`/`setting`… | |
| `Notification` | `notification` | `read` ← `read_at` |
| `Comment`, `TrackingComment` | `comment`, `tracking_comment` | |
| `SupporterEntity` | `supporter_entity` | كلمات المرور الأصلية معروفة للديمو؛ تُولَّد جديدة |
| `SiteSection`/`SiteContent` | `site_section`/`site_content` | |
| `Settings.ui` | `ui_config` | |
| `Attachment` | `file` | الديمو يخزّن اسماً وبصمة ومعاينة؛ الحقيقية ملف فعلي (seed: صورة بديلة) |
| `DB.version`, `seededAt` | — | لا مقابل |
| مبدّل الأدوار، إعادة البيانات، `localStorage` | — | **لا يُنقل** (للنموذج فقط) |

## 15.2 ما يُعاد استخدامه وما يُعاد كتابته

| البند | القرار | كيف |
|---|---|---|
| **الهوية البصرية**: الشعارات SVG الثلاثة، الألوان (التيل `#00728E`، السماوي `#00B9D1`، البرتقالي `#F79845`، الذهبي `#FBB42B`، الرمادي `#8D8D8D`، الحبر `#0E2A33`/`#5B6770`)، الحواف والظلال والأقراص (`app/src/tokens.css` مرجع) | **يُعاد استخدام** | تُنسخ الأصول وتُعاد كتابة الرموز في `styles/tokens.css` الجديد؛ الخط: س-10 |
| الخط ثمانية Sans (`brand assets/fonts`) أو IBM Plex Sans Arabic | قرار | الديمو يستخدم Plex للمنصة وثمانية لعرض الحفل (س-10) |
| **مكوّنات بصرية** (`src/ui`: Button، Card، Badge، Tabs، Field، Modal، Progress، Stat، Table، Empty، Notice، StepWizard، TwoToneTitle) | **تُعاد كتابتها** على نفس التصميم | بخصائص CSS المنطقية (RTL)، وإتاحة a11y وأهداف 44px؛ تُنقل أفكار التصميم لا الكود |
| **منطق الصلاحيات** (`permissions.ts`, `access.ts`, `capacities.ts`, `grants.ts`, `settings.ts`, `accounts.ts` ما عدا التجزئة) | **يُعاد استخدام بعد الفصل** | يُنقل لـ`packages/domain` كدوال نقية. تتغير الواجهة: بدل `DB` كاملة تأخذ **`DomainSnapshot` / واجهة قارئ** يملؤها الخادم بالاستعلامات المطلوبة فقط |
| **منطق المسارات** (`workflow.ts`) و**المالية** (`finance.ts`, `ledger.ts`) | يُعاد استخدام بعد الفصل | الحسابات النقية (مسار الطلب، المرصود، الأرقام، التكرار) تُنقل؛ والتغييرات `mutate` تُعاد كتابتها كخدمات بمعاملات |
| **منطق النقاط** (`points.ts`) | يُعاد استخدام + اختبار مطابقة | يعمل على لقطة بيانات في مهمة `points_run` |
| `calendar.ts`, `actions.ts`, `supporter.ts`, `dates.ts` | يُعاد استخدام بعد الفصل | `actions` تتحول لاستعلامات؛ `dates` تُدار بمنطقة البرنامج |
| **`repositories.ts`** | **يُعاد كتابته بالكامل** | هو المرجع الرئيسي للقواعد (BR) ولا يُنسخ: يحمل نموذج «استنساخ DB كاملة»، وغياب فحوص الصلاحية، وإشعارات متزامنة |
| `db.ts`, `store.ts` (zustand/localStorage/مبدّل الأدوار) | يُعاد كتابته | استبدال بـ TanStack Query وAPI |
| `crypto.ts` (SHA-256) | يُترك | Argon2id على الخادم |
| `seed*.ts` | مرجع لبيانات seed فقط (15.3) | |
| `pages/*` | تُعاد كتابتها شاشةً شاشة (الملحق أ) | تُحفظ البنية والنصوص العربية كمرجع UX |
| `show/` (عرض الحفل) و`scripts/*` وFirebase remote | **خارج النطاق** | أداة مستقلة للحفل تبقى في الديمو؛ تُعتمد كما هي أو تُنقل لاحقاً كمنتج منفصل (س-18) |
| `tests/*.test.ts` | تُحوَّل لاختبارات مرجعية | أسماء الاختبارات تتحول إلى سيناريوهات قبول (القسم 17) |

## 15.3 البيانات التجريبية كـ seed (تطوير واختبار فقط)

**مبدأ:** seed للتطوير والاختبار والعرض الداخلي. **ليست بيانات إنتاج ولا تُستورد للإنتاج أبداً.** يمنعها حارس: `if (env === 'production') throw`.

### الخطة
1. **اللقطة المرجعية**: سكربت لمرة واحدة في الديمو (قراءة فقط، خارج مجلد `app/` تُنفَّذ بـ`tsx` من `saql-real/scripts`) يستدعي `buildSeed()` بتاريخ ثابت ويُنتج `fixtures/demo-snapshot.json` ثم تُدخلها خطوة **إخفاء الهوية**:
   - استبدال الأسماء والجوالات والبريد والآيبان بقيم خيالية مولّدة بنمط ثابت (`seed: 42`). **لا تُنقل أسماء الأشخاص الحقيقيين في الديمو** (س-16).
   - إبقاء أسماء الفرق (أُحُد، قُباء، سَلع، العقيق) والتصنيفات والمبالغ (لا حساسية).
2. **التواريخ**: الديمو نسبي لـ«اليوم»؛ يأخذ السكربت `--anchor <date>` ويُزيح كل التواريخ، فتبقى «الرحلة الجارية» جارية عند التشغيل (يُعاد بـ`pnpm seed:dev`).
3. **المعرّفات**: `uuid v5(namespace, demoId)` حتمي ⇒ استيراد idempotent ومقارنات ثابتة.
4. **الملفات**: كل `Attachment` ← صف `file` بملف PNG بديل (1×1 أو شعار) مع `sha256` مميز لكل اسم، فتعمل قواعد التكرار.
5. **الحسابات**: `username` كما في الديمو (`leader`, `s1`, `u1`…)، وكلمة مرور **dev فقط** من متغير بيئة (لا تُكتب في المستودع)؛ `must_change_password=false` في dev.
6. **الاستيراد**: سكربت `scripts/import-demo.ts` (تصميم بلا كود هنا):
   - يقرأ اللقطة، يتحقق من كل سجل بمخططات `packages/contracts` نفسها (فيفشل مبكراً).
   - يحمّل **بترتيب التبعيات** داخل transaction واحدة مع تأجيل القيود (`SET CONSTRAINTS ALL DEFERRED`): `file` ← `person/account/bank_account` ← `setting`/`evaluation_*`/`schedule_category`/`ui_config`/`capacity_rule` ← `grp/group_member/group_formation` ← `committee*` ← `program_event` ← `trip*` ← `trip_doc/approval/revision` ← `schedule_*` ← `focus*` ← `availability/individual` ← `personal_plan*` ← `survey*` ← `material*` ← `budget_category` ← `program_budget_version` ← `budget_request*` ← `wallet_entry` ← `custody*` ← `spend_*` ← `direct_spend*` ← `contract*` ← `edit_request` ← `fee_record` ← `attendance` ← `task*`/`comment` ← `meeting*` ← `notification` ← `supporter_*`/`tracking_comment`/`site_*` ← `audit_log`.
   - يكتب `audit_log` أصلياً، ويستعمل دوال DB المعتمدة للمحفظة (لا تجاوز triggers).
   - يطلق `points_run` ثم يقارن.
7. **التحقق (parity)**: اختبار آلي: ينفّذ `computeScores` (الدالة المنقولة) على بيانات الديمو المستوردة ويقارن بإخراج الديمو المخزَّن في اللقطة (`expected-scores.json`) ⇒ تطابق بالهللة. وكذلك مرحلة كل رحلة (`tripStage`) وأرقام كل عهدة ورصيد المحفظة.
8. **البيانات الحقيقية للإنتاج**: تُدخل يدوياً عبر المنصة (ق.ع ينشئ الأشخاص) أو بجدول CSV للمشاركين المقبولين يُستورد بسكربت منفصل `import-roster` بعد موافقة وفق س-01 وس-06.

### مجموعات seed
| المجموعة | المحتوى | الاستخدام |
|---|---|---|
| `minimal` | ق.ع + م.ت + مسؤول مالية + ميسّر + 4 مشاركين بمجموعة | اختبارات الوحدة والتكامل السريعة |
| `demo` | اللقطة الكاملة المُخفاة هويتها (28 مشاركاً، 4 مجموعات، 11 رحلة بمراحل مختلفة، عهدة بدفعتين، فواتير مرفوضة، طلب تعديل، لقاء عمرة، خطط مقفلة ومفتوحة) | المعاينة، الاختبارات الشاملة، e2e |
| `scenarios/*` | حالات حدّية (رصيد ناقص، عجز، تكرار صورة، تجزئة، تعارض صفات، قفل التقييم) | اختبارات القبول |

## 15.4 وضع الديمو بعد النقل
- يبقى **كما هو** كمرجع وعرض: لا تعديل على `app/` ولا تبعياته ولا نشره (`deploy-pages.sh`, `.github/workflows/static.yml`).
- لا يشترك الديمو والمنصة في كود ولا بيانات؛ وأي إصلاح في الوثائق الأصلية يُسجَّل في الأسئلة المفتوحة (س-19) لا في الملفات.
- يُستعمل الديمو للتحقق السلوكي فقط (مقارنة شاشة بشاشة، أرقام النقاط).
- **تنبيه خصوصية** (س-16): الديمو المنشور يحمل أسماء حقيقية؛ يُقرَّر هل يُستبدل بنسخة مخفاة قبل الاستمرار في نشره.
