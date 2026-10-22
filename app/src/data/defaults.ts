// القيم الافتراضية للإعدادات. كلها تُنسخ إلى قاعدة البيانات وتُعدّل من شاشة الإعدادات.
import type { BudgetCategory, ProgramBudget, Settings, TaskTemplate } from '@/domain/types';
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
    scheduleCategories: [
      { id: 'cat_lecture', name: 'لقاء/محاضرة', color: '#00708c' },
      { id: 'cat_culture', name: 'ثقافي', color: '#6b6fc9' },
      { id: 'cat_tour', name: 'سياحي', color: '#00b9d1' },
      { id: 'cat_fun', name: 'ترفيهي', color: '#f79845' },
      { id: 'cat_food', name: 'تغذية', color: '#fbb42b' },
      { id: 'cat_rest', name: 'استراحة', color: '#9fdde8' },
      { id: 'cat_move', name: 'تنقل', color: '#919498' },
      { id: 'cat_sleep', name: 'نوم', color: '#3f4246' },
      { id: 'cat_worship', name: 'عبادة', color: '#2fa37b' },
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
