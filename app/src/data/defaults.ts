// القيم الافتراضية للإعدادات. كلها تُنسخ إلى قاعدة البيانات وتُعدّل من شاشة الإعدادات.
import type { BudgetCategory, CapacityRule, ProgramBudget, Settings, TaskTemplate, UiConfig } from '@/domain/types';
import { DEFAULT_SPENDABLE } from '@/domain/finance';

export function defaultSettings(startDate: string, endDate: string): Settings {
  return {
    program: { name: 'صقل', cohort: 'الدفعة الأولى', startDate, endDate, participantsCount: 24 },
    split: { individual: 50, group: 50 },
    groupTripSplit: { internal: 40, external: 60 },
    evaluationItems: [
      {
        key: 'attendance', name: 'الحضور', scope: 'individual', weight: 40, mode: 'auto', enabled: true,
        description: 'يُحسب تلقائياً من سجلات الحضور. من التزم بالكل نال الدرجة الكاملة.',
        subItems: [
          { key: 'focus', name: 'لقاءات التركيز', weight: 40 },
          { key: 'internal', name: 'الرحلات الداخلية', weight: 30 },
          { key: 'external', name: 'الرحلات الخارجية', weight: 30 },
        ],
      },
      { key: 'punctuality', name: 'الالتزام بالوقت والحضور المبكر', scope: 'individual', weight: 15, mode: 'manual', enabled: true, description: 'يرصده قائد المجموعة لكل رحلة (من 5).' },
      {
        key: 'personal_plan', name: 'الخطة الشخصية', scope: 'individual', weight: 20, mode: 'auto', enabled: true,
        description: 'حضور اللقاءات الفردية ومستوى التقدم في الخطوات.',
        subItems: [
          { key: 'meetings', name: 'حضور اللقاءات الفردية', weight: 50 },
          { key: 'steps', name: 'التقدم في الخطوات', weight: 50 },
        ],
      },
      { key: 'presenting', name: 'تقديم المحتوى', scope: 'individual', weight: 25, mode: 'manual', enabled: true, description: 'يقيّمه الميسّر بعد كل تقديم في لقاءات التركيز.' },
      { key: 'enrichment', name: 'المواد الإثرائية (لأعضاء الإدارة)', scope: 'individual', weight: 0, mode: 'auto', enabled: true, description: 'نقاط إضافية لعضو الإدارة عن كل مادة عامة يعتمدها القائد العام.' },

      {
        key: 'exec_plan', name: 'الخطة التنفيذية', scope: 'group', weight: 20, mode: 'mixed', enabled: true,
        subItems: [
          { key: 'schedule', name: 'الالتزام بالجدول', weight: 40 },
          { key: 'schedule_on_time', name: 'وقت رفع الجدول', weight: 20 },
          { key: 'budget_on_time', name: 'توقيت رفع الموازنة التقديرية', weight: 20 },
          { key: 'location_early', name: 'تحديد الموقع مبكراً', weight: 20 },
        ],
      },
      {
        key: 'coordination', name: 'التنسيقات', scope: 'group', weight: 15, mode: 'manual', enabled: true,
        subItems: [
          { key: 'transport', name: 'المواصلات', weight: 25 },
          { key: 'food', name: 'التغذية', weight: 25 },
          { key: 'housing', name: 'السكن', weight: 25 },
          { key: 'hosting', name: 'الاستضافات', weight: 25 },
        ],
      },
      {
        key: 'program_mgmt', name: 'إدارة البرنامج', scope: 'group', weight: 15, mode: 'mixed', enabled: true,
        subItems: [
          { key: 'schedule_topics', name: 'الالتزام بالجدول والمواضيع', weight: 30 },
          { key: 'activation', name: 'تفعيل المجموعات', weight: 25 },
          { key: 'flexibility', name: 'المرونة', weight: 20 },
          { key: 'all_presented', name: 'تقديم كل أفراد المجموعة', weight: 25 },
        ],
      },
      {
        key: 'completeness', name: 'الاكتمال', scope: 'group', weight: 15, mode: 'auto', enabled: true,
        subItems: [
          { key: 'session_files', name: 'ملفات محتوى كل لقاء', weight: 25 },
          { key: 'invoices_closed', name: 'إغلاق الفواتير', weight: 25 },
          { key: 'media', name: 'التغطية الإعلامية', weight: 25 },
          { key: 'final_report', name: 'الوثيقة الختامية', weight: 25 },
        ],
      },
      { key: 'trip_eval', name: 'تقييم الرحلة', scope: 'group', weight: 25, mode: 'manual', enabled: true, description: 'من متابع الرحلات والقائد العام.' },
      { key: 'deadlines', name: 'الالتزام بالمواعيد النهائية', scope: 'group', weight: 10, mode: 'auto', enabled: true },
      { key: 'creativity', name: 'الإبداع والابتكار', scope: 'group', weight: 0, mode: 'manual', enabled: false, description: 'نقطة مفتوحة (20.3): معطّل افتراضياً.' },
    ],
    presentationCriteria: [
      { key: 'style', name: 'أسلوب الطرح' },
      { key: 'quality', name: 'جودة الطرح' },
      { key: 'aids', name: 'استخدام وسائل مساعدة' },
      { key: 'fit', name: 'مناسبة الطرح للمادة' },
    ],
    repeatPresentationFactor: 0.5,
    presentingMaxMultiplier: 1.5,
    lateFactor: 0.5,
    enrichmentPointsPerMaterial: 2,
    targets: { focusMeetingsPerGroup: 4, individualMeetingsPerParticipant: 4 },
    programCounts: { staffInternal: 2, groupInternal: 1, groupExternal: 1, staffExternal: 1 },
    deadlineDefaults: { initialDaysBefore: 21, detailedDaysBefore: 10, finalReportDaysAfter: 7, reminderDaysBefore: 3 },
    attendanceWeights: { focus: 40, trip: 40, tripSession: 20 },
    tripAttendanceStates: { early: 1, on_time: 1, late: 0.5 },
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
    scheduleEditAfterStartNeedsApproval: false,
    overspendNeedsApproval: true,
    trackingCommentsNeedReview: true,
    importantNotifications: ['budget_request', 'approval_rejected', 'deadline_passed', 'custody_issued', 'groups_published', 'leader_absent_focus', 'committee_member_request'],
    showHijri: true,
    feesInPlatform: false,
    feeAmount: 500,
    budgetVisibleToStaff: false,
    spendableTypes: [...DEFAULT_SPENDABLE],
    trackingLink: { active: false },
    ui: defaultUiConfig(),
    site: {
      heroTitle: 'صقل',
      heroSubtitle: 'برنامج لتنمية وتأهيل القيادات الشبابية من طلاب الجامعات في المدينة المنورة. نتعلم القيادة بممارستها.',
      about:
        'صقل برنامج تأهيلي يمتد لعام كامل، يجمع نخبة من الشباب الجامعيين في المدينة المنورة. يحضر المشارك معظم اللقاءات والرحلات مشاركاً، وفي بعضها يكون معدّاً ومنفّذاً مع مجموعته، فيتعلم كيف تُخطّط الرحلات وتُدار وتُغلق.',
      pillars: [
        { title: 'التعلّم بالممارسة', text: 'تخطّط المجموعة رحلاتها وتنفّذها وتغلقها بنفسها، بإشراف ميسّر من فريق العمل.' },
        { title: 'الخطة الشخصية', text: 'عجلة حياة من ستة جوانب، ورؤية وخطوات عملية يتابعها الميسّر في لقاءات فردية.' },
        { title: 'لقاءات التركيز', text: 'لقاءات قصيرة على مستوى المجموعة، يقدّم فيها المشاركون ويتدرّبون على الطرح.' },
        { title: 'الرحلات', text: 'رحلات داخلية تمهيدية وأخرى خارجية بسفر وسكن، تصنع تجربة لا تُنسى.' },
      ],
      journey: [
        { title: 'الانطلاقة', text: 'لقاءات تعارف وتأسيس قبل تشكيل المجموعات.' },
        { title: 'تشكيل المجموعات', text: 'أربع مجموعات، لكل منها قائد من المشاركين وميسّر من فريق العمل.' },
        { title: 'الرحلات الداخلية', text: 'كل مجموعة تنفّذ رحلة داخل المدينة تمهيداً للخارجية.' },
        { title: 'الرحلات الخارجية', text: 'رحلات بسفر وسكن تخطّطها المجموعات وتديرها كاملة.' },
        { title: 'الختام', text: 'تقرير البرنامج وقياس الأثر وتكريم المتميزين.' },
      ],
      audience: 'طلاب الجامعات في المدينة المنورة ممن يطمحون لتطوير قدراتهم القيادية.',
      faq: [
        { q: 'كم مدة البرنامج؟', a: 'يمتد البرنامج قرابة عام دراسي كامل.' },
        { q: 'هل البرنامج برسوم؟', a: 'نعم، برسوم رمزية تُسدّد عند القبول.' },
        { q: 'كيف أتابع لقاءاتي؟', a: 'من خلال المنصة الداخلية بعد تسجيل الدخول.' },
      ],
      contactEmail: 'info@saql.example',
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
    meetingDefault: 0,
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
  const B = 'الأساسية';
  const P = 'البرنامج';
  const A = 'الإدارة';
  const F = 'المالية';
  const k = (key: string, label?: string) => ({ key, label });
  const basics = { title: B, items: [k('home'), k('calendar'), k('notifications')] };
  return {
    navCatalog: [
      { key: 'home', to: '/app', label: 'الرئيسية', icon: 'home', section: B },
      { key: 'calendar', to: '/app/calendar', label: 'التقويم', icon: 'calendar', section: B },
      { key: 'notifications', to: '/app/notifications', label: 'الإشعارات', icon: 'bell', section: B },
      { key: 'trips', to: '/app/trips', label: 'الرحلات', icon: 'map', section: P },
      { key: 'focus', to: '/app/focus', label: 'لقاءات التركيز', icon: 'target', section: P },
      { key: 'meetings', to: '/app/meetings', label: 'الاجتماعات', icon: 'meeting', section: P },
      { key: 'plan', to: '/app/plan', label: 'خطتي', icon: 'compass', section: P },
      { key: 'individual', to: '/app/individual', label: 'اللقاءات الفردية', icon: 'users', section: P },
      { key: 'plans', to: '/app/plans', label: 'الخطط الشخصية', icon: 'compass', section: P },
      { key: 'library', to: '/app/library', label: 'المكتبة', icon: 'book', section: P },
      { key: 'surveys', to: '/app/surveys', label: 'الاستبيانات', icon: 'clipboard', section: P },
      { key: 'groups', to: '/app/groups', label: 'المجموعات', icon: 'grid', section: P },
      { key: 'leaderboard', to: '/app/leaderboard', label: 'الترتيب', icon: 'trophy', section: P },
      { key: 'tasks', to: '/app/tasks', label: 'المهام', icon: 'check', section: A },
      { key: 'requests', to: '/app/requests', label: 'طلباتي', icon: 'receipt', section: P },
      { key: 'contact', to: '/app/contact', label: 'راسل الإدارة', icon: 'message', section: P },
      { key: 'tracker', to: '/app/tracker', label: 'متابعة الرحلات', icon: 'radar', section: P },
      { key: 'committees', to: '/app/committees', label: 'اللجان', icon: 'layers', section: A },
      { key: 'people', to: '/app/people', label: 'الأشخاص', icon: 'contact', section: A },
      { key: 'insights', to: '/app/insights', label: 'المؤشرات', icon: 'chart', section: A },
      { key: 'inbox', to: '/app/inbox', label: 'رسائل المشاركين', icon: 'message', section: A },
      { key: 'tracking_link', to: '/app/tracking-link', label: 'رابط المتابعة', icon: 'link', section: A },
      { key: 'site_editor', to: '/app/site-editor', label: 'تحرير الموقع', icon: 'globe', section: A },
      { key: 'users', to: '/app/users', label: 'المستخدمون', icon: 'key', section: A },
      { key: 'settings', to: '/app/settings', label: 'الإعدادات', icon: 'settings', section: A },
      { key: 'finance', to: '/app/finance', label: 'المالية', icon: 'wallet', section: A },
      { key: 'finance_budget', to: '/app/finance?tab=budget', label: 'الموازنة', icon: 'wallet', section: F },
      { key: 'finance_custody', to: '/app/finance?tab=custody', label: 'العهد والإغلاق', icon: 'receipt', section: F },
      { key: 'finance_requests', to: '/app/finance?tab=requests', label: 'طلبات الصرف', icon: 'check', section: F },
      { key: 'finance_invoices', to: '/app/finance?tab=invoices', label: 'الفواتير', icon: 'clipboard', section: F },
      { key: 'finance_analysis', to: '/app/finance?tab=analysis', label: 'التحليلات', icon: 'chart', section: F },
      { key: 'finance_fees', to: '/app/finance?tab=fees', label: 'الرسوم', icon: 'contact', section: F },
      { key: 'finance_categories', to: '/app/finance?tab=categories', label: 'التصنيفات', icon: 'layers', section: F },
      { key: 'finance_team', to: '/app/finance?tab=team', label: 'الفريق والصلاحيات', icon: 'users', section: F },
      { key: 'finance_audit', to: '/app/finance?tab=audit', label: 'سجل التدقيق', icon: 'link', section: F },
    ],
    layouts: [
      {
        role: 'finance_head', priority: 1, tail: ['leaderboard'], home: ['actions', 'upcoming'],
        sections: [
          { title: F, items: [k('finance_budget'), k('finance_custody'), k('finance_requests'), k('finance_invoices'), k('finance_analysis'), k('finance_fees'), k('finance_categories'), k('finance_team'), k('finance_audit')] },
          basics,
        ],
      },
      {
        role: 'tech_head', priority: 2, tail: ['leaderboard'], home: ['actions', 'upcoming'],
        sections: [{ title: 'أدوات اللجنة التقنية', items: [k('users'), k('settings'), k('committees', 'لجاني')] }, basics],
      },
      {
        role: 'media_head', priority: 3, tail: ['leaderboard'], home: ['actions', 'upcoming'],
        sections: [{ title: 'أدوات اللجنة الإعلامية', items: [k('committees', 'لجاني'), k('tracking_link'), k('site_editor'), k('library'), k('trips')] }, basics],
      },
      {
        role: 'leader', priority: 4, home: ['actions', 'upcoming', 'competition'],
        sections: [
          basics,
          { title: P, items: [k('trips'), k('groups'), k('meetings'), k('insights'), k('focus'), k('plans'), k('library'), k('surveys'), k('leaderboard')] },
          { title: A, items: [k('finance'), k('tasks'), k('committees'), k('people'), k('settings'), k('inbox'), k('tracking_link'), k('site_editor')] },
        ],
      },
      {
        role: 'facilitator', priority: 5, home: ['actions', 'upcoming', 'competition'],
        sections: [basics, { title: P, items: [k('focus', 'اللقاءات'), k('groups', 'مجموعتي'), k('individual'), k('requests'), k('plans'), k('trips'), k('meetings')] }],
      },
      { role: 'tracker', priority: 6, home: ['actions', 'upcoming', 'competition'], sections: [basics, { title: P, items: [k('tracker')] }] },
      { role: 'group_leader', priority: 7, home: ['contact_notice', 'competition', 'actions', 'upcoming'], sections: [basics, { title: P, items: [k('trips', 'رحلتي'), k('requests')] }] },
      {
        role: 'staff', priority: 8, home: ['actions', 'upcoming', 'competition'],
        sections: [
          basics,
          { title: P, items: [k('trips'), k('focus'), k('meetings'), k('library'), k('surveys'), k('groups'), k('leaderboard')] },
          { title: A, items: [k('finance'), k('tasks'), k('committees'), k('people'), k('insights'), k('tracking_link')] },
        ],
      },
      {
        role: 'participant', priority: 9, home: ['contact_notice', 'competition', 'actions', 'upcoming'],
        sections: [
          basics,
          { title: P, items: [k('trips'), k('contact'), k('focus'), k('plan'), k('library'), k('individual', 'لقائي مع الميسّر'), k('tasks', 'مهامي'), k('committees', 'لجنتي'), k('surveys'), k('groups'), k('leaderboard')] },
        ],
      },
    ],
  };
}
