# ملحق (ج): الإعدادات القابلة للتعديل وقيمها الافتراضية

> المصدر: `app/src/data/defaults.ts` (القيم) و`domain/settings.ts` (الملكية). **المالك** = من يملك حفظ المفتاح (BR-902). 🔒 = مقفل بعد الحفظ (قفل التقييم). `[مقترح]` = ليس في الديمو.
> التخزين: جدول `setting(key, value jsonb, owner, locked, version…)` ما لم يُذكر جدول مخصص.

## C.1 إعدادات التقييم 🔒 (المالك: ق.ع؛ الفتح: م.ت)

| المفتاح | القيمة الافتراضية | ملاحظة |
|---|---|---|
| `eval.split` | `{individual: 50, group: 50}` | ثابتان بالوثيقة |
| `eval.groupTripSplit` | `{internal: 40, external: 60}` | نصيب الجماعي |
| `evaluation_item` | attendance 45 · presenting 20 · leader_eval 25 · personal_plan 10 {meetings 50, steps 50} · enrichment 0 · trip_auto 50 {document_on_time 15, schedule_on_time 15, budget_on_time 15, trip_closed 10, finance_closed 15, report_on_time 10, schedule_adherence 20} · finance_manual 20 · staff_rating 30 | جدول `evaluation_item/subitem` |
| `presentation_criterion` | style أسلوب الطرح · quality جودة الطرح · aids وسائل مساعدة · fit مناسبة المادة (مقياس 1–5) | |
| `eval.presentingExtraBonus` | 2 | نقطة ثابتة لكل مرة بعد الأولى |
| `eval.presentingRevealAfterEnd` | true | |
| `leader_eval_item` | leadership 20 · teamwork 15 · responsibility 15 · communication 15 · growth 15 · creativity 20 (=100) | |
| `eval.deadlineFinalCredit` | 0.5 | الحصة في الموعد النهائي |
| `eval.enrichmentPointsPerMaterial` | 2 | |
| `eval.deadlineDefaults` | documentEarlyDaysBefore 30 · documentDaysBefore 21 · scheduleEarlyDaysBefore 15 · scheduleDaysBefore 10 · budgetEarlyDaysBefore 15 · budgetDaysBefore 10 · finalReportDaysAfter 7 · tripCloseDaysAfter 14 · financeCloseDaysAfter 14 · reminderDaysBefore 3 | التبكير أكبر من النهائي (BR-903) |
| `eval.attendanceWeights` | `{focus: 40, trip: 40, tripSession: 20}` | |
| `eval.attendanceLateCredit` | 0.5 | |
| `eval.tripRatingQuorum` | 0.5 | |

## C.2 المستهدفات والأعداد (المالك: ق.ع)

| المفتاح | الافتراضي |
|---|---|
| `program.name` / `cohort` | «صقل» / «الدفعة الأولى» |
| `program.startDate` / `endDate` | غير محدد (س-06) |
| `program.participantsCount` | 28 في الديمو (س-06) |
| `program.timezone` [مقترح] | `Asia/Riyadh` |
| `targets.focusMeetingsPerGroup` | 4 |
| `targets.individualMeetingsPerParticipant` | 4 |
| `programCounts` | staffInternal 2 · groupInternal 1 · groupExternal 1 · staffExternal 1 (إرشادي، غير مفروض) |
| `scheduleRevealHours` | 24 |
| `showHijri` | true |
| `feesInPlatform` | false |
| `feeAmount` | 500 ر.س |
| `trackingCommentsNeedReview` | true |
| `supporterLink` | `maxAttempts 5` · `lockMinutes 15` · `programIdea` نص |
| `tracker_person_id` | يعيّنه ق.ع (قواعد التعارض تُطبَّق) |

## C.3 المالية (المالك: م.م)

| المفتاح | الافتراضي |
|---|---|
| `finance.maxOpenCustodies` | 2 (≥1) |
| `finance.splitAlert` | `maxAmount 300 · windowDays 3 · minCount 3` |
| `finance_eval_item` | rationing «الترشيد» · proof_quality «اكتمال الإثباتات ووضوحها» (0–5) |
| `program_budget_version` (v1) | focus per_item 150 (total 1000 ÷ 16) · umrahPerGroup 1500 · internalTrip per_item 3500 (14000÷4) · externalTrip per_item 15000 (60000÷4) · opening 4000 · closing 20000 · meetingDefault 300 · programNeeds 15000 · focus_min 4 · focus_max 8 |
| `budget_category` | انظر 07 §7.3 (8 تصنيفات وبنودها) |
| الأنواع المسموحة | سبعة ثابتة (لم يعد إعداداً — A#117) |

## C.4 القوالب والواجهة والإشعارات

| المفتاح | المالك | الافتراضي |
|---|---|---|
| `schedule_category` | ق.ع أو `manage_schedule_categories` | لقاء/محاضرة (يلزمه تحضير) · ثقافي · سياحي · ترفيهي · تغذية · استراحة · تنقل · نوم · عبادة (ألوان وأوصاف في الديمو) |
| `task_template` | ق.ع | doc_file «ملف التوثيق» (link، +3 أيام، الكل) · tweet «التغريدة» (link، +1) · newsletter «النشرة» (file، +7، خارجية) · custody_issue «صرف العهدة» (text، −5) · custody_close «الإغلاق المالي» (none، +14) |
| `capacity_rule` | م.ت (س-24) | 6 قواعد (06 BR-010) |
| `ui_config` | م.ت | كتالوج القوائم + ترتيب 9 أدوار (`finance_head, tech_head, media_head, leader, facilitator, tracker, group_leader, staff, participant`) + `extras: tracker` |
| `notification_policy` / `importantNotifications` | م.ت | budget_request · approval_rejected · deadline_passed · custody_issued · groups_published · leader_absent_focus · committee_member_request (للإيميل المستقبلي) |
| `site_content` / `site_section` | ق.ع أو `edit_site` | عنوان «برنامج صقل للقيادات الشبابية»، كلمة التمييز «صقل»، أقسام: فكرة البرنامج، محاور، فريق العمل، المتميزون، المجموعات، أسئلة شائعة |

## C.5 إعدادات أمنية وتشغيلية [مقترحة — ليست في الديمو]

| المفتاح | المقترح |
|---|---|
| `auth.sessionTtlHours` | 12 (تجديد منزلق، حد أقصى 7 أيام) |
| `auth.maxFailedLogins` / `lockMinutes` | 5 / 15 |
| `auth.minPasswordLength` | 8 |
| `supporter.sessionTtlHours` | 8 |
| `files.maxImageMB` / `maxPdfMB` / `maxVideoMB` | 10 / 20 / 200 (الفيديو رابط افتراضياً) |
| `files.signedUrlTtlSeconds` | 300 |
| `points.debounceSeconds` | 10 |
| `notifications.retentionDays` | 180 |
| `jobs.deadlinesScanMinutes` | 15 |
