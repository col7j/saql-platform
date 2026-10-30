// القيم الافتراضية للإعدادات. كلها تُنسخ إلى قاعدة البيانات وتُعدّل من شاشة الإعدادات.
import type { BudgetCategory, CapacityRule, ProgramBudget, Settings, TaskTemplate, UiConfig } from '@/domain/types';

export function defaultSettings(startDate: string, endDate: string): Settings {
  return {
    program: { name: 'صقل', cohort: 'الدفعة الأولى', startDate, endDate, participantsCount: 28 },
    split: { individual: 50, group: 50 },
    groupTripSplit: { internal: 40, external: 60 },
    // القالب الافتراضي للتقييم (وثيقة القرارات + س9 وس10). يضبطه القائد العام ثم يُقفل
    evaluationItems: [
      { key: 'attendance', name: 'الحضور', scope: 'individual', weight: 45, mode: 'auto', enabled: true, description: 'تلقائي بأوزان كل نوع (لقاءات التركيز، الرحلة، لقاءات الرحلة). المبكر والوقت درجة كاملة، والمتأخر درجة جزئية، والغائب صفر.' },
      { key: 'presenting', name: 'تقديم المحتوى', scope: 'individual', weight: 20, mode: 'manual', enabled: true, description: 'يقيّمه الميسّر بعد كل لقاء تركيز. متوسط مرات التقديم مع تميّز عن كل مرة بعد الأولى، ويظهر بعد نهاية البرنامج.' },
      { key: 'leader_eval', name: 'تقييم القائد العام', scope: 'individual', weight: 25, mode: 'manual', enabled: true, description: 'مرة واحدة لكل مشارك ببنود يحددها القائد العام (ومنها الإبداع والابتكار).' },
      {
        key: 'personal_plan', name: 'الخطة الشخصية', scope: 'individual', weight: 10, mode: 'auto', enabled: true,
        description: 'حضور اللقاءات الفردية ومستوى التقدم في الخطوات.',
        subItems: [
          { key: 'meetings', name: 'حضور اللقاءات الفردية', weight: 50 },
          { key: 'steps', name: 'التقدم في الخطوات', weight: 50 },
        ],
      },
      { key: 'enrichment', name: 'المواد الإثرائية (لأعضاء الإدارة)', scope: 'individual', weight: 0, mode: 'auto', enabled: true, description: 'نقاط لعضو الإدارة عن كل مادة عامة يعتمدها القائد العام، خارج ترتيب المشاركين.' },

      {
        key: 'trip_auto', name: 'البنود التلقائية للرحلة', scope: 'group', weight: 50, mode: 'auto', enabled: true,
        description: 'من نشاط المنصة: تسليم النماذج (مبكراً كامل الوزن، وفي الموعد النهائي جزء، وبعده صفر)، وإغلاق الرحلة وإغلاقها مالياً خلال المهلة، والتقرير، والالتزام بالجدول الفعلي.',
        subItems: [
          { key: 'document_on_time', name: 'وثيقة الرحلة', weight: 15 },
          { key: 'schedule_on_time', name: 'الجدول الزمني', weight: 15 },
          { key: 'budget_on_time', name: 'الميزانية', weight: 15 },
          { key: 'trip_closed', name: 'إغلاق الرحلة خلال المهلة', weight: 10 },
          { key: 'finance_closed', name: 'الإغلاق المالي خلال المهلة', weight: 15 },
          { key: 'report_on_time', name: 'التقرير الختامي في موعده', weight: 10 },
          { key: 'schedule_adherence', name: 'الالتزام بالجدول (الفعلي)', weight: 20 },
        ],
      },
      { key: 'finance_manual', name: 'بنود المسؤول المالي', scope: 'group', weight: 20, mode: 'manual', enabled: true, description: 'بنود يحددها مسؤول المالية (مثل الترشيد) ويقيّم بها وحده.' },
      { key: 'staff_rating', name: 'متوسط تقييم فريق العمل', scope: 'group', weight: 30, mode: 'manual', enabled: true, description: 'كل عضو في فريق العمل يقيّم الرحلة من 10، ويدخل المتوسط.' },
    ],
    presentationCriteria: [
      { key: 'style', name: 'أسلوب الطرح' },
      { key: 'quality', name: 'جودة الطرح' },
      { key: 'aids', name: 'استخدام وسائل مساعدة' },
      { key: 'fit', name: 'مناسبة الطرح للمادة' },
    ],
    presentingExtraBonus: 2,
    presentingRevealAfterEnd: true,
    leaderEvalItems: [
      { key: 'leadership', name: 'المبادرة والقيادة', max: 20 },
      { key: 'teamwork', name: 'العمل بروح الفريق', max: 15 },
      { key: 'responsibility', name: 'تحمّل المسؤولية', max: 15 },
      { key: 'communication', name: 'التواصل والتأثير', max: 15 },
      { key: 'growth', name: 'النمو خلال البرنامج', max: 15 },
      { key: 'creativity', name: 'الإبداع والابتكار', max: 20 },
    ],
    deadlineFinalCredit: 0.5,
    enrichmentPointsPerMaterial: 2,
    targets: { focusMeetingsPerGroup: 4, individualMeetingsPerParticipant: 4 },
    programCounts: { staffInternal: 2, groupInternal: 1, groupExternal: 1, staffExternal: 1 },
    deadlineDefaults: { documentEarlyDaysBefore: 30, documentDaysBefore: 21, scheduleEarlyDaysBefore: 15, scheduleDaysBefore: 10, budgetEarlyDaysBefore: 15, budgetDaysBefore: 10, finalReportDaysAfter: 7, tripCloseDaysAfter: 14, financeCloseDaysAfter: 14, reminderDaysBefore: 3 },
    attendanceWeights: { focus: 40, trip: 40, tripSession: 20 },
    attendanceLateCredit: 0.5,
    evaluationLock: { locked: false },
    scheduleCategories: [
      { id: 'cat_lecture', name: 'لقاء/محاضرة', color: '#00708c', description: 'محاضرة أو دورة أو ورشة بمقدّم', requiresPrep: true },
      { id: 'cat_culture', name: 'ثقافي', color: '#6b6fc9', description: 'زيارة أو نشاط ثقافي', requiresPrep: false },
      { id: 'cat_tour', name: 'سياحي', color: '#00b9d1', description: 'جولة أو زيارة معلم', requiresPrep: false },
      { id: 'cat_fun', name: 'ترفيهي', color: '#f79845', description: 'نشاط ترفيهي جماعي', requiresPrep: false },
      { id: 'cat_food', name: 'تغذية', color: '#fbb42b', description: 'وجبات واستراحات طعام', requiresPrep: false },
      { id: 'cat_rest', name: 'استراحة', color: '#9fdde8', description: 'وقت حر أو راحة', requiresPrep: false },
      { id: 'cat_move', name: 'تنقل', color: '#919498', description: 'انتقال بين المواقع', requiresPrep: false },
      { id: 'cat_sleep', name: 'نوم', color: '#3f4246', description: 'السكن والنوم', requiresPrep: false },
      { id: 'cat_worship', name: 'عبادة', color: '#2fa37b', description: 'صلوات وأوراد', requiresPrep: false },
    ],
    scheduleRevealHours: 24,
    tripRatingQuorum: 0.5,
    trackingCommentsNeedReview: true,
    importantNotifications: ['budget_request', 'approval_rejected', 'deadline_passed', 'custody_issued', 'groups_published', 'leader_absent_focus', 'committee_member_request'],
    showHijri: true,
    feesInPlatform: false,
    feeAmount: 500,
    finance: { maxOpenCustodies: 2, splitAlert: { maxAmount: 300, windowDays: 3, minCount: 3 }, evalItems: [{ key: 'rationing', name: 'الترشيد' }, { key: 'proof_quality', name: 'اكتمال الإثباتات ووضوحها' }] },
    ui: defaultUiConfig(),
    supporterLink: { maxAttempts: 5, lockMinutes: 15, programIdea: 'صقل برنامج لتنمية وتأهيل القيادات الشبابية من طلاب الجامعات في المدينة المنورة، يتعلم فيه المشارك القيادة بممارستها: يخطط مع مجموعته رحلات ولقاءات وينفّذها ويغلقها.' },
    site: {
      heroTitle: 'برنامج صقل للقيادات الشبابية',
      heroAccent: 'صقل',
      heroSubtitle: 'برنامج لتنمية وتأهيل القيادات الشبابية من طلاب الجامعات في المدينة المنورة. نتعلم القيادة بممارستها.',
      contactEmail: 'info@saql.example',
      // أقسام بقوالب جاهزة (نص، صورة، قائمة أشخاص، جدول) تُدار من المنصة بلا محرر مواقع حر
      sections: [
        { id: 'sec_about', type: 'text', title: 'فكرة البرنامج وأهدافه', hidden: false, body: 'صقل برنامج تأهيلي يمتد لعام كامل، يجمع نخبة من الشباب الجامعيين (18 إلى 22 سنة) في المدينة المنورة. يحضر المشارك معظم اللقاءات والرحلات مشاركاً، وفي بعضها يكون معدّاً ومنفّذاً مع مجموعته، فيتعلم كيف تُخطّط الرحلات وتُدار وتُغلق.' },
        { id: 'sec_pillars', type: 'table', title: 'محاور البرنامج', hidden: false, table: { source: 'manual', columns: ['المحور', 'الوصف'], rows: [['التعلّم بالممارسة', 'تخطّط المجموعة رحلاتها وتنفّذها وتغلقها بنفسها، بإشراف ميسّر من فريق العمل.'], ['الخطة الشخصية', 'عجلة حياة من ستة جوانب، ورؤية وخطوات عملية يتابعها الميسّر في لقاءات فردية.'], ['لقاءات التركيز', 'لقاءات قصيرة على مستوى المجموعة، يقدّم فيها المشاركون ويتدرّبون على الطرح.'], ['الرحلات', 'رحلات داخلية تمهيدية وأخرى خارجية بسفر وسكن.']] } },
        { id: 'sec_staff', type: 'people', title: 'فريق العمل', hidden: false, people: 'staff' },
        { id: 'sec_top', type: 'people', title: 'المشاركون المتميزون', hidden: false, people: 'top5' },
        { id: 'sec_groups', type: 'table', title: 'المجموعات', hidden: false, table: { source: 'groups', columns: [], rows: [] } },
        { id: 'sec_faq', type: 'table', title: 'أسئلة شائعة', hidden: false, table: { source: 'manual', columns: ['السؤال', 'الجواب'], rows: [['كم مدة البرنامج؟', 'يمتد البرنامج قرابة عام دراسي كامل.'], ['كيف أتابع لقاءاتي؟', 'من خلال المنصة الداخلية بعد تسجيل الدخول.']] } },
      ],
    },
  };
}

export const defaultBudgetCategories: BudgetCategory[] = [
  { id: 'bc_transport', name: 'المواصلات', items: [{ id: 'bi_bus', name: 'حافلة/باص' }, { id: 'bi_car', name: 'سيارات وتوصيل' }, { id: 'bi_fuel', name: 'وقود' }] },
  { id: 'bc_food', name: 'التغذية', items: [{ id: 'bi_meals', name: 'وجبات رئيسية' }, { id: 'bi_snacks', name: 'وجبات خفيفة' }] },
  { id: 'bc_housing', name: 'السكن', items: [{ id: 'bi_house_trainers', name: 'سكن المدربين' }, { id: 'bi_house_part', name: 'سكن المشاركين' }] },
  { id: 'bc_hosting', name: 'الضيافة', items: [{ id: 'bi_coffee', name: 'قهوة وتمر' }, { id: 'bi_water', name: 'ماء ومشروبات' }] },
  { id: 'bc_guests', name: 'مكافآت الضيوف', items: [{ id: 'bi_lecturer', name: 'محاضر' }, { id: 'bi_trainer', name: 'مدرب ورشة' }] },
  { id: 'bc_tickets', name: 'تذاكر ودخول', items: [{ id: 'bi_entry', name: 'رسوم دخول' }] },
  { id: 'bc_print', name: 'أدوات ومطبوعات', items: [{ id: 'bi_print', name: 'مطبوعات' }, { id: 'bi_gifts', name: 'دروع وهدايا' }] },
  { id: 'bc_other', name: 'أخرى', items: [] },
];

/** ميزانية مقترحة تُعبّأ في المعالج. لا تُعتمد حتى يحفظها المسؤول المالي (setupDone) */
export function defaultProgramBudget(): ProgramBudget {
  return {
    setupDone: false,
    focus: { mode: 'per_item', perItem: 150, total: 1000, divisor: 16 },
    umrahPerGroup: 1500,
    internalTrip: { mode: 'per_item', perItem: 3500, total: 14000, divisor: 4 },
    externalTrip: { mode: 'per_item', perItem: 15000, total: 60000, divisor: 4 },
    opening: 4000,
    closing: 20000,
    meetingDefault: 300,
    programNeeds: 15000,
    focusLimits: { min: 4, max: 8 },
  };
}

export function defaultTaskTemplates(financeId: string, mediaId: string): TaskTemplate[] {
  return [
    { id: 'tpl_doc', committeeId: mediaId, title: 'ملف التوثيق', proofType: 'link', tag: 'doc_file', dueOffsetDays: 3, appliesTo: 'all' },
    { id: 'tpl_tweet', committeeId: mediaId, title: 'التغريدة', proofType: 'link', tag: 'tweet', dueOffsetDays: 1, appliesTo: 'all' },
    { id: 'tpl_news', committeeId: mediaId, title: 'النشرة', proofType: 'file', tag: 'newsletter', dueOffsetDays: 7, appliesTo: 'external' },
    { id: 'tpl_custody', committeeId: financeId, title: 'صرف العهدة', proofType: 'text', tag: 'custody_issue', dueOffsetDays: -5, appliesTo: 'all' },
    { id: 'tpl_close', committeeId: financeId, title: 'الإغلاق المالي', proofType: 'none', tag: 'custody_close', dueOffsetDays: 14, appliesTo: 'all' },
  ];
}

/** قواعد تعارض الصفات المعتمدة (وثيقة القرارات + إجابات المالك). تُنسخ للبيانات وتُطبَّق عند إضافة أي صفة */
export const defaultCapacityRules: CapacityRule[] = [
  { id: 'cr_finance_only', a: 'head:finance', b: 'any', message: 'مسؤول المالية عضو إدارة فقط بلا أي صفة ثانية' },
  { id: 'cr_head_fac', a: 'committee_head', b: 'facilitator', message: 'مسؤول اللجنة لا يكون ميسّراً' },
  { id: 'cr_tech_tracker', a: 'head:tech', b: 'tracker', message: 'مسؤول اللجنة التقنية لا يكون متابع الرحلات الدائم (يجوز بديلاً مؤقتاً لرحلة محددة)' },
  { id: 'cr_tracker_fac', a: 'tracker', b: 'facilitator', message: 'متابع الرحلات الدائم لا يكون ميسّراً' },
  { id: 'cr_tracker_head', a: 'tracker', b: 'committee_head', message: 'متابع الرحلات الدائم لا يكون مسؤول لجنة (يجوز عضواً)' },
  { id: 'cr_sub_fac', a: 'trip_substitute', b: 'trip_facilitator', message: 'المتابع البديل لا يكون ميسّر المجموعة المنفِّذة للرحلة' },
];

/** القوائم والرئيسية لكل دور: الكتالوج يعرّف كل عنصر، والترتيب لكل دور يحدد مكانه. من لا يملك صلاحية عنصر لا يظهر له */
export function defaultUiConfig(): UiConfig {
  // كل قائمة: «الأساسية» ثم 3 إلى 5 مجموعات، وفي كل مجموعة 5 عناصر أو أقل. مهام الدور فقط
  const B = 'الأساسية';
  const P = 'البرنامج';
  const k = (key: string, label?: string) => ({ key, label });
  const basics = { title: B, items: [k('home'), k('calendar'), k('notifications'), k('profile')] };
  const view = { title: 'البرنامج (عرض)', items: [k('trips'), k('focus'), k('meetings')] };
  const fin = (key: string, label: string, icon: string) => ({ key: `finance_${key}`, to: `/app/finance?tab=${key}`, label, icon, section: 'المالية' });
  return {
    navCatalog: [
      { key: 'home', to: '/app', label: 'الرئيسية', icon: 'home', section: B },
      { key: 'calendar', to: '/app/calendar', label: 'التقويم', icon: 'calendar', section: B },
      { key: 'notifications', to: '/app/notifications', label: 'الإشعارات', icon: 'bell', section: B },
      { key: 'profile', to: '/app/profile', label: 'ملفي', icon: 'contact', section: B },
      { key: 'trips', to: '/app/trips', label: 'الرحلات', icon: 'map', section: P },
      { key: 'focus', to: '/app/focus', label: 'لقاءات التركيز', icon: 'target', section: P },
      { key: 'meetings', to: '/app/meetings', label: 'الاجتماعات', icon: 'meeting', section: P },
      { key: 'plan', to: '/app/plans', label: 'خطتي', icon: 'compass', section: P },
      { key: 'individual', to: '/app/individual', label: 'اللقاءات الفردية', icon: 'users', section: P },
      { key: 'plans', to: '/app/plans', label: 'الخطط الشخصية', icon: 'compass', section: P },
      { key: 'library', to: '/app/library', label: 'المكتبة', icon: 'book', section: P },
      { key: 'surveys', to: '/app/surveys', label: 'الاستبيانات', icon: 'clipboard', section: P },
      { key: 'groups', to: '/app/groups', label: 'المجموعات', icon: 'grid', section: P },
      { key: 'leaderboard', to: '/app/leaderboard', label: 'الترتيب', icon: 'trophy', section: P },
      { key: 'tasks', to: '/app/tasks', label: 'المهام', icon: 'check', section: 'المتابعة' },
      { key: 'requests', to: '/app/requests', label: 'طلباتي', icon: 'receipt', section: 'المتابعة' },
      { key: 'contact', to: '/app/messages', label: 'راسل الإدارة', icon: 'message', section: P },
      { key: 'tracker', to: '/app/tracker', label: 'متابعة الرحلات', icon: 'radar', section: 'المتابعة' },
      { key: 'committees', to: '/app/committees', label: 'اللجان', icon: 'layers', section: 'المتابعة' },
      { key: 'my_committee', to: '/app/committees', label: 'لجنتي', icon: 'layers', section: 'المتابعة' },
      { key: 'people', to: '/app/people', label: 'الأشخاص', icon: 'contact', section: 'الأشخاص' },
      { key: 'insights', to: '/app/insights', label: 'المؤشرات', icon: 'chart', section: 'المتابعة' },
      { key: 'approvals', to: '/app/approvals', label: 'بانتظار اعتمادي', icon: 'stamp', section: 'المتابعة' },
      { key: 'inbox', to: '/app/messages', label: 'رسائل المشاركين', icon: 'message', section: 'المحتوى' },
      { key: 'tracking_link', to: '/app/tracking-link', label: 'رابط الداعم', icon: 'link', section: 'المحتوى' },
      { key: 'site_editor', to: '/app/site-editor', label: 'تحرير الموقع', icon: 'globe', section: 'المحتوى' },
      { key: 'audit', to: '/app/audit', label: 'سجل التدقيق', icon: 'history', section: 'المتابعة' },
      { key: 'settings', to: '/app/settings', label: 'الإعدادات', icon: 'settings', section: 'التقييم' },
      { key: 'finance', to: '/app/finance', label: 'المالية', icon: 'wallet', section: 'المتابعة' },
      fin('overview', 'نظرة عامة', 'chart'),
      fin('requests', 'الطلبات والعهد', 'receipt'),
      fin('invoices', 'مراجعة الفواتير', 'clipboard'),
      fin('direct', 'الصرف المباشر والاحتياجات', 'layers'),
      fin('wallet', 'المحفظة والموازنة', 'wallet'),
      fin('fees', 'الرسوم', 'contact'),
      fin('reports', 'التقارير', 'history'),
      fin('settings', 'إعدادات المالية', 'settings'),
    ],
    layouts: [
      {
        role: 'finance_head', priority: 1, tail: ['leaderboard'], home: ['actions', 'upcoming'],
        sections: [
          basics,
          { title: 'المالية', items: [k('finance_overview'), k('finance_requests'), k('finance_invoices'), k('finance_direct'), k('finance_wallet')] },
          { title: 'الإدارة المالية', items: [k('finance_fees'), k('finance_reports'), k('finance_settings')] },
        ],
      },
      {
        role: 'tech_head', priority: 2, tail: ['leaderboard'], home: ['actions', 'upcoming'],
        sections: [basics, { title: 'أدوات اللجنة التقنية', items: [k('people', 'الأشخاص والحسابات'), k('settings', 'إعدادات النظام'), k('audit'), k('my_committee')] }, view],
      },
      {
        role: 'media_head', priority: 3, tail: ['leaderboard'], home: ['actions', 'upcoming'],
        sections: [basics, { title: 'أدوات اللجنة الإعلامية', items: [k('my_committee'), k('tracking_link'), k('site_editor'), k('library'), k('trips')] }, view],
      },
      {
        role: 'leader', priority: 4, home: ['actions', 'upcoming', 'competition'],
        sections: [
          basics,
          { title: P, items: [k('trips'), k('groups'), k('focus'), k('meetings'), k('leaderboard')] },
          { title: 'المتابعة', items: [k('insights'), k('tasks'), k('approvals'), k('finance', 'المالية (مراقبة)')] },
          { title: 'الأشخاص والصلاحيات', items: [k('people', 'الأشخاص والصلاحيات')] },
          { title: 'التقييم', items: [k('settings', 'الإعدادات والتقييم'), k('surveys'), k('plans')] },
          { title: 'المحتوى', items: [k('tracking_link'), k('site_editor'), k('library'), k('inbox')] },
        ],
      },
      {
        role: 'facilitator', priority: 5, home: ['actions', 'upcoming', 'competition'],
        sections: [
          basics,
          { title: 'مجموعتي', items: [k('groups', 'مجموعتي'), k('focus', 'اللقاءات'), k('individual'), k('plans')] },
          { title: P, items: [k('trips'), k('meetings'), k('surveys'), k('library')] },
          { title: 'المتابعة', items: [k('requests'), k('tasks'), k('my_committee')] },
        ],
      },
      {
        role: 'tracker', priority: 6, home: ['actions', 'upcoming', 'competition'],
        sections: [
          basics,
          { title: 'الرحلات', items: [k('tracker'), k('trips'), k('tasks')] },
          { title: P, items: [k('focus'), k('meetings'), k('groups'), k('leaderboard')] },
          { title: 'الفريق', items: [k('committees'), k('people'), k('insights')] },
          { title: 'المحتوى', items: [k('library'), k('surveys'), k('tracking_link')] },
        ],
      },
      {
        role: 'group_leader', priority: 7, home: ['contact_notice', 'competition', 'actions', 'upcoming'],
        sections: [
          basics,
          { title: 'رحلتي ومجموعتي', items: [k('trips', 'رحلتي'), k('requests'), k('meetings'), k('groups'), k('leaderboard')] },
          { title: 'لقاءاتي', items: [k('focus'), k('individual', 'لقائي مع الميسّر'), k('plan')] },
          { title: 'المهام والمحتوى', items: [k('tasks', 'مهامي'), k('library'), k('surveys'), k('my_committee'), k('contact')] },
        ],
      },
      {
        role: 'staff', priority: 8, home: ['actions', 'upcoming', 'competition'],
        sections: [
          basics,
          { title: P, items: [k('trips'), k('focus'), k('meetings'), k('groups'), k('leaderboard')] },
          { title: 'المتابعة', items: [k('tasks'), k('committees'), k('insights'), k('requests'), k('finance')] },
          { title: 'الموارد', items: [k('library'), k('surveys'), k('people'), k('tracking_link')] },
        ],
      },
      {
        role: 'participant', priority: 9, home: ['contact_notice', 'competition', 'actions', 'upcoming'],
        sections: [
          basics,
          { title: P, items: [k('trips'), k('focus'), k('groups'), k('leaderboard')] },
          { title: 'نموّي', items: [k('plan'), k('individual', 'لقائي مع الميسّر'), k('library')] },
          { title: 'المشاركة', items: [k('tasks', 'مهامي'), k('surveys'), k('my_committee'), k('contact')] },
        ],
      },
    ],
    extras: [{ key: 'tracker', section: 'المتابعة' }],
  };
}
