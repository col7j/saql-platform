import type {
  CustodyStatus, DocKind, DocStatus, FocusStatus, LifeAspectKey, NotificationType,
  ProofType, TaskStatus, TripType,
} from './types';

export const tripTypeLabel: Record<TripType, string> = { internal: 'داخلية', external: 'خارجية' };

export const docKindLabel: Record<DocKind, string> = {
  initial: 'الخطة المبسطة',
  detailed: 'الخطة التفصيلية',
  final_report: 'التقرير الختامي',
};

export const docStatusLabel: Record<DocStatus, string> = {
  draft: 'مسودة',
  submitted: 'بانتظار مراجعة الميسّر',
  facilitator_approved: 'بانتظار قرار القائد العام',
  returned_by_facilitator: 'أعادها الميسّر للتعديل',
  returned_by_leader: 'أعادها القائد العام للتعديل',
  approved: 'معتمدة',
};
export const docStatusTone: Record<DocStatus, Tone> = {
  draft: 'gray',
  submitted: 'blue',
  facilitator_approved: 'blue',
  returned_by_facilitator: 'red',
  returned_by_leader: 'red',
  approved: 'green',
};

export type Tone = 'gray' | 'blue' | 'green' | 'red' | 'orange' | 'brand' | 'purple';

export const focusStatusLabel: Record<FocusStatus, string> = {
  draft: 'قيد التجهيز',
  published: 'منشور',
  held: 'انعقد (بانتظار الإغلاق)',
  closed: 'مغلق',
};
export const focusStatusTone: Record<FocusStatus, Tone> = { draft: 'gray', published: 'blue', held: 'orange', closed: 'green' };

export const taskStatusLabel: Record<TaskStatus | 'late', string> = {
  new: 'جديدة',
  in_progress: 'قيد التنفيذ',
  done: 'منتهية',
  late: 'متأخرة',
};
export const taskStatusTone: Record<TaskStatus | 'late', Tone> = { new: 'gray', in_progress: 'blue', done: 'green', late: 'red' };

export const proofTypeLabel: Record<ProofType, string> = { none: 'لا يلزم', link: 'رابط', file: 'ملف', text: 'نص' };

export const aspectLabel: Record<LifeAspectKey, string> = {
  spiritual: 'الروحي',
  health: 'الصحي',
  family: 'الأسري',
  financial: 'المالي',
  social: 'الاجتماعي',
  career: 'التعليمي والوظيفي',
};
export const aspectColor: Record<LifeAspectKey, string> = {
  spiritual: '#00708c',
  health: '#2fa37b',
  family: '#f79845',
  financial: '#fbb42b',
  social: '#00b9d1',
  career: '#6b6fc9',
};
export const aspectEvidenceHint: Record<LifeAspectKey, string> = {
  spiritual: 'الأدلة الشرعية (آية، حديث، أثر)',
  health: 'الأدلة الصحية أو العلمية',
  family: 'الأدلة العلمية أو الشرعية',
  financial: 'الأدلة العلمية أو الشرعية',
  social: 'الأدلة العلمية أو الشرعية',
  career: 'الأدلة العلمية',
};
export const ASPECT_KEYS: LifeAspectKey[] = ['spiritual', 'health', 'family', 'financial', 'social', 'career'];

export const custodyStatusLabel: Record<CustodyStatus, string> = {
  active: 'مفعّلة',
  closing: 'قيد الإغلاق',
  closed: 'مغلقة',
};
export const custodyStatusTone: Record<CustodyStatus, Tone> = { active: 'blue', closing: 'purple', closed: 'green' };

export const coordinationLabel = { housing: 'السكن', transport: 'المواصلات', food: 'التغذية', hosting: 'الاستضافات' } as const;

export const notificationTypeLabel: Record<NotificationType, string> = {
  focus_created_presenter: 'تكليف بتقديم لقاء تركيز',
  focus_published: 'نشر لقاء تركيز',
  groups_published: 'نشر المجموعات',
  approval_submitted: 'رفع خطة للاعتماد',
  approval_approved: 'موافقة/اعتماد',
  approval_rejected: 'رفض بسبب',
  deadline_near: 'اقتراب موعد نهائي',
  deadline_passed: 'فوات موعد نهائي',
  schedule_started: 'بدأ الجدول',
  task_assigned: 'إسناد مهمة',
  custody_issued: 'صرف عهدة',
  leader_absent_focus: 'غياب قائد المجموعة عن لقاء تركيز',
  individual_booked: 'حجز لقاء فردي',
  plan_step_due: 'تاريخ خطوة في الخطة الشخصية',
  committee_member_request: 'طلب إضافة عضو للجنة',
  trip_published: 'نشر رحلة',
  survey_available: 'استبيان متاح',
  invoice_rejected: 'رفض بند صرف',
  budget_request: 'طلب ميزانية',
  meeting: 'اجتماع',
  general: 'عام',
};

export const materialTypeLabel = { file: 'ملف', pdf: 'PDF', video: 'فيديو', link: 'رابط' } as const;
export const materialOriginLabel = {
  session: 'مخصصة للقاء',
  attached: 'مرفقة من الميسّر',
  pre_trip: 'مادة قبلية',
  individual: 'بعد لقاء فردي',
  general: 'مادة إثرائية',
  focus: 'ملف لقاء تركيز',
} as const;

export const SAR = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} ر.س`;
