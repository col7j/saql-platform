// نموذج بيانات منصة صقل (قسم 18 في الوثيقة)
// كل الكيانات هنا قابلة للتسلسل JSON حتى يمكن نقلها لقاعدة بيانات لاحقاً كما هي.

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // ISO كامل

// ───────────── الأشخاص والصفات ─────────────
export type PersonKind = 'participant' | 'staff';

export interface Person {
  id: ID;
  name: string;
  kind: PersonKind;
  isGeneralLeader?: boolean; // القائد العام (لم يعد يساوي المشرف العام)
  /** المشرف العام: قراءة فقط تُفرض في طبقة البيانات */
  isSupervisor?: boolean;
  /** مساعد القائد العام ومسؤول التدريب والتطوير: هو متابع الرحلات */
  isAssistant?: boolean;
  email: string;
  phone?: string;
  university?: string;
  major?: string;
  title?: string; // وصف قصير لعضو الإدارة
  photo?: Attachment;
  /** البيانات المالية يضيفها المشارك أول دخول، وتظهر لمسؤول المالية عند التحويل */
  bank?: { iban: string; bankName?: string; barcode?: Attachment };
  /** أكمل ملفه الشخصي أول دخول (وبه يوافق ضمنياً على الشروط والأحكام العامة) */
  profileCompletedAt?: ISODateTime;
}

/**
 * مفتاح صفة في قواعد التعارض. الصفات نفسها تُشتق من المجموعات واللجان والرحلات والإعدادات،
 * وهذه المفاتيح توحّدها حتى تُكتب القواعد كبيانات.
 */
export type CapacityKey =
  | 'facilitator' // ميسّر مجموعة
  | 'group_leader' // قائد مجموعة
  | 'tracker' // متابع الرحلات الدائم
  | 'committee_head' // مسؤول أي لجنة
  | 'committee_member' // عضو أي لجنة
  | `head:${CommitteeKind}`
  | `member:${CommitteeKind}`
  | 'staff_trip_team' // عضو فريق رحلة لفريق العمل
  | 'trip_substitute' // بديل مؤقت لمتابع الرحلات في رحلة محددة
  | 'trip_facilitator'; // ميسّر المجموعة المنفِّذة لرحلة محددة

/** قاعدة تعارض: الصفة a لا تجتمع مع b، و'any' تعني أن a حصرية لا تجتمع مع أي صفة أخرى */
export interface CapacityRule {
  id: ID;
  a: CapacityKey;
  b: CapacityKey | 'any';
  message: string;
}

/** صلاحيات مؤقتة يمنحها القائد العام لأشخاص يحددهم حتى تاريخ معيّن */
export type TempPermission = 'register_participants' | 'edit_site' | 'manage_schedule_categories';
export interface TempGrant {
  id: ID;
  personId: ID;
  permission: TempPermission;
  grantedBy: ID;
  at: ISODateTime;
  expiresAt: ISODate; // آخر يوم صالح
  revokedAt?: ISODateTime;
}

/** حساب الدخول: يديره مسؤول اللجنة التقنية وحده */
export interface Account {
  personId: ID;
  username: string;
  /** في النموذج الأولي: SHA-256 مع ملح. في المنصة الحقيقية يُستبدل بتشفير على الخادم */
  passwordHash?: string;
  salt?: string;
  mustChangePassword: boolean;
  disabled: boolean;
  updatedAt: ISODateTime;
  updatedBy: ID;
}

// ───────────── المجموعات ─────────────
export interface Group {
  id: ID;
  name: string;
  color: string;
  leaderId?: ID;
  facilitatorId?: ID;
  memberIds: ID[];
}

export interface GroupFormation {
  status: 'draft' | 'scheduled' | 'published';
  publishAt?: ISODateTime;
  publishedAt?: ISODateTime;
}

export interface TransferLog {
  id: ID;
  personId: ID;
  fromGroupId: ID;
  toGroupId: ID;
  by: ID;
  at: ISODateTime;
  reason?: string;
}

export interface FacilitatorNote {
  id: ID;
  participantId: ID;
  authorId: ID;
  groupIdAtTime?: ID;
  text: string;
  at: ISODateTime;
}

export interface AdminMessage {
  id: ID;
  fromId: ID;
  text: string;
  at: ISODateTime;
  reply?: { byId: ID; text: string; at: ISODateTime };
}

// ───────────── اللجان والمهام ─────────────
export type CommitteeKind = 'finance' | 'media' | 'tech' | 'general' | 'other';
export interface CommitteeKPI {
  id: ID;
  title: string;
  target: number;
  taskTag: string; // المؤشر الحي يعدّ المهام المنتهية بهذا الوسم
}
export interface Committee {
  id: ID;
  name: string;
  kind: CommitteeKind;
  description?: string;
  kpis: CommitteeKPI[];
}
/** صلاحيات مالية يفوّضها مسؤول اللجنة المالية لأعضاء لجنته، كل واحدة على حدة */
export type FinancePermission = 'view_budget' | 'manage_categories' | 'approve_within' | 'disburse' | 'review_invoices' | 'close_custody';
export interface CommitteeMembership {
  id: ID;
  committeeId: ID;
  personId: ID;
  role: 'leader' | 'member';
  canSeeFinance: boolean;
  /** للجنة المالية فقط: الصلاحيات المفوّضة (قائد اللجنة يملكها كلها) */
  financePerms?: FinancePermission[];
  /** للجنة الإعلامية فقط: صلاحيات المركز الإعلامي التي يمنحها القائد العام لكل عضو على حدة (رئيس اللجنة يملكها كلها) */
  mediaPerms?: MediaPermission[];
}
export interface MemberRequest {
  id: ID;
  committeeId: ID;
  personId: ID;
  requestedBy: ID;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  at: ISODateTime;
  decidedAt?: ISODateTime;
}

export type ProofType = 'none' | 'link' | 'file' | 'text';
export type TaskStatus = 'new' | 'in_progress' | 'done';
export type TaskScope = 'general' | 'committee' | 'trip_team' | 'group';
export interface Task {
  id: ID;
  title: string;
  description?: string;
  scope: TaskScope;
  committeeId?: ID;
  tripId?: ID;
  focusMeetingId?: ID;
  meetingId?: ID;
  groupId?: ID;
  assigneeId: ID;
  createdBy: ID;
  dueDate: ISODate;
  status: TaskStatus;
  proofType: ProofType;
  proof?: string;
  tag?: string;
  mandatory?: boolean;
  autoFromTemplateId?: ID;
  createdAt: ISODateTime;
  doneAt?: ISODateTime;
}
export interface TaskTemplate {
  id: ID;
  committeeId: ID;
  title: string;
  proofType: ProofType;
  tag?: string;
  dueOffsetDays: number; // بالنسبة لنهاية الرحلة (سالب = قبلها)
  appliesTo: 'all' | 'internal' | 'external';
}

// ───────────── الرحلات ─────────────
export type TripType = 'internal' | 'external';
export type TripExecutor =
  | { kind: 'group'; groupId: ID }
  | { kind: 'staff'; leaderId: ID; memberIds: ID[] };

/** الموازنة لم تعد وثيقة في دورة الخطط، بل طلب ميزانية مستقل (BudgetRequest) */
export type DocKind = 'document' | 'detailed' | 'schedule' | 'final_report';
export type DocStatus =
  | 'draft'
  | 'submitted' // بانتظار الميسّر (أو القائد العام في رحلات فريق العمل)
  | 'facilitator_approved' // بانتظار قرار القائد العام
  | 'returned_by_facilitator'
  | 'returned_by_leader'
  | 'approved';

export interface Approval {
  id: ID;
  byId: ID;
  role: 'facilitator' | 'leader';
  decision: 'approve' | 'reject' | 'edit';
  reason?: string;
  at: ISODateTime;
  version: number;
}

export interface TripDoc {
  id: ID;
  tripId: ID;
  kind: DocKind;
  status: DocStatus;
  version: number;
  fields: Record<string, string>;
  submittedAt?: ISODateTime;
  approvedAt?: ISODateTime;
  history: Approval[];
}

export interface ScheduleItem {
  id: ID;
  date: ISODate;
  start: string; // HH:mm
  end: string;
  categoryId: ID;
  detail: string;
  sessionId?: ID; // ربط بلقاء داخل الرحلة
}
export interface SchedulePlan {
  id: ID;
  name: string; // الخطة أ، الخطة ب...
  items: ScheduleItem[];
}
export interface ActualScheduleEntry {
  id: ID;
  tripId: ID;
  refItemId: ID; // بند في الخطة أ
  followed: 'A' | 'B' | 'none';
  note?: string;
  actualStart?: string;
  actualEnd?: string;
  categoryId?: ID;
  byId: ID;
  at: ISODateTime;
}
export interface TripSession {
  id: ID;
  title: string;
  presenter?: string;
  date: ISODate;
  start: string;
  end: string;
}
export interface TripGuest {
  id: ID;
  name: string;
  role: string;
  sessionId?: ID;
  confirmed: boolean;
}
export interface Coordination {
  key: 'housing' | 'transport' | 'food' | 'hosting';
  status: 'pending' | 'in_progress' | 'done';
  note?: string;
}

/** تقييم الرحلة: كل فريق العمل يقيّمها (من 10) ويدخل المتوسط في نقاطها، وبنود المالية يقيّم بها مسؤول المالية وحده (من 5) */
export interface TripEvaluation {
  staffRatings: Record<ID, { score: number; note?: string; at: ISODateTime }>;
  finance: Record<string, number>;
}

export interface Trip {
  id: ID;
  title: string;
  type: TripType;
  executor: TripExecutor;
  startDate: ISODate;
  endDate: ISODate;
  location?: string;
  description?: string;
  isPersonalPlanMeeting: boolean;
  /** اللقاء الافتتاحي أو الختامي (نوع صرف مستقل) */
  /** الرحلة الخارجية المزدوجة: وجهة واحدة لمجموعتين متتاليتين، ونهاية الأولى بداية الثانية */
  pair?: { tripId: ID; part: 1 | 2 };
  /** مواعيد النماذج الثلاثة: الوثيقة أولاً، ثم الجدول والميزانية */
  deadlines: { document: ISODate; schedule: ISODate; budget: ISODate };
  createdAt: ISODateTime;
  createdBy: ID;
  published: boolean;
  publishedAt?: ISODateTime;
  schedule: { plans: SchedulePlan[] };
  scheduleVisibility: 'hidden' | 'full' | 'next24';
  scheduleStartedNotified?: boolean;
  sessions: TripSession[];
  guests: TripGuest[];
  /** أعضاء فريق من خارج المجموعة المنفذة (توزيع أعضاء المجموعة التي بلا رحلة خارجية) */
  extraMemberIds?: ID[];
  /** نسخة قالب الوثيقة وقت إنشاء الرحلة: تغيير القالب لاحقاً يؤثر على الرحلات الجديدة فقط */
  docTemplate?: DocSectionDef[];
  coordinationOwnerId?: ID;
  coordinations: Coordination[];
  attendanceTakerId?: ID;
  trackerSubstitute?: { candidateId: ID; reason?: string; status: 'pending' | 'approved' | 'rejected' };
  closure: { teamEvalForm?: string; experienceForm?: string; publicReport?: string; photos: string[]; driveLink?: string; tweets?: string[] };
  /** إغلاق الرحلة: بعد اكتمال المتطلبات ونصاب تقييم فريق العمل. موعده يدخل في نقاط المجموعة */
  closedAt?: ISODateTime;
  closedBy?: ID;
  /** رحلة الخطة الشخصية: من يخطط الرحلة يحدد بند الجدول أو توقيت فتح الخطة */
  planUnlock?: { mode: 'item'; itemId: ID } | { mode: 'time'; at: ISODateTime };
  evaluation: TripEvaluation;
}

// ───────────── لقاءات التركيز ─────────────
export type FocusStatus = 'draft' | 'published' | 'held' | 'closed';
/** سطر موازنة: تصنيف ← بند ← عدد × سعر الوحدة */
export interface BudgetLine {
  id: ID;
  categoryId: ID;
  itemId?: ID;
  description: string;
  unit: string;
  qty: number;
  price: number;
}
export interface FocusMeeting {
  id: ID;
  groupId: ID;
  createdBy: ID;
  title: string;
  isUmrah: boolean;
  topicMode: 'fixed' | 'options' | 'free';
  topicOptions: string[];
  topic?: string;
  dateMode: 'fixed' | 'options' | 'free';
  dateOptions: string[];
  date?: ISODate;
  start?: string;
  end?: string;
  location?: string;
  presenterMode: 'members' | 'guest' | 'facilitator' | 'none';
  presenterIds: ID[];
  presenterAxes: Record<ID, string>;
  guestName?: string;
  status: FocusStatus;

  attendanceTakerId?: ID;
  attendanceConfirmedBy?: ID;
  presenterEvaluations: Record<ID, Record<string, number>>; // personId -> criterion -> 1..5
  surveyId?: ID;
}

// ───────────── اللقاءات الفردية ─────────────
export interface AvailabilitySlot {
  id: ID;
  facilitatorId: ID;
  date: ISODate;
  start: string;
  end: string;
  invite: 'open' | ID; // دعوة عامة أو لشخص معين
  bookedBy?: ID;
}
export interface IndividualMeeting {
  id: ID;
  facilitatorId: ID;
  participantId: ID;
  slotId?: ID;
  date: ISODate;
  start: string;
  end: string;
  origin: 'open_invite' | 'personal_invite' | 'participant_request';
  status: 'requested' | 'booked' | 'done' | 'cancelled';
  requestNote?: string;
  notesOnPlan?: string;
  notesOnMeeting?: string;
  attachmentMaterialId?: ID;
}

// ───────────── الخطة الشخصية ─────────────
export type LifeAspectKey = 'spiritual' | 'health' | 'family' | 'financial' | 'social' | 'career';
export interface StepFollowUp {
  id: ID;
  at: ISODateTime;
  started: boolean;
  progress: string;
  challenge?: string;
  overcome?: string;
  needHelp?: boolean;
}
export interface PlanStep {
  id: ID;
  title: string;
  startDate: ISODate;
  importance: string;
  evidence: string;
  howWhen: string;
  status: 'pending' | 'started' | 'done' | 'challenged';
  followUps: StepFollowUp[];
}
export interface LifeAspect {
  key: LifeAspectKey;
  level: number; // 1..10
  vision: string;
  steps: PlanStep[];
}
export interface PersonalPlan {
  participantId: ID;
  manuallyUnlocked?: boolean;
  aspects: LifeAspect[];
  updatedAt?: ISODateTime;
}

// ───────────── الاستبيانات ─────────────
export type QuestionType = 'scale' | 'text' | 'choice';
export interface Question {
  id: ID;
  text: string;
  type: QuestionType;
  options?: string[];
  pairsWith?: ID; // للسؤال البعدي: السؤال القبلي المقابل
  isGeneral?: boolean; // جزء الرضا والأثر العام
}
export interface SurveyResponse {
  id: ID;
  personId: ID;
  answers: Record<ID, string>;
  at: ISODateTime;
}
export interface Survey {
  id: ID;
  title: string;
  context: { kind: 'trip' | 'focus' | 'program'; id?: ID };
  phase: 'pre' | 'post';
  preSurveyId?: ID;
  mandatory: boolean;
  questions: Question[];
  opensAt: ISODateTime;
  responses: SurveyResponse[];
  createdBy: ID;
}

// ───────────── المكتبة ─────────────
export type MaterialType = 'file' | 'pdf' | 'video' | 'link';
export type MaterialOrigin = 'session' | 'attached' | 'pre_trip' | 'individual' | 'general' | 'focus';
export type Audience = { kind: 'all' } | { kind: 'group'; groupId: ID } | { kind: 'person'; personId: ID };
export interface Material {
  id: ID;
  title: string;
  description?: string;
  type: MaterialType;
  url: string;
  uploaderId: ID;
  origin: MaterialOrigin;
  tripId?: ID;
  sessionId?: ID;
  focusMeetingId?: ID;
  revealMode: 'auto' | 'manual';
  revealAt?: ISODateTime; // للوضع التلقائي: نهاية وقت اللقاء
  revealed: boolean; // للوضع اليدوي
  audience: Audience;
  mandatory?: boolean;
  pointsRequested?: boolean;
  pointsStatus?: 'pending' | 'approved' | 'rejected';
  at: ISODateTime;
}
export interface MaterialView {
  id: ID;
  personId: ID;
  materialId: ID;
  status: 'viewed' | 'skipped';
  at: ISODateTime;
}

// ───────────── المالية ─────────────
/** أنواع الصرف السبعة (وثيقة القرارات): تنفيذ البرنامج وإداري. لكل نوع طريقان: عهدة أو صرف مباشر */
export type SpendKind = 'internal_trip' | 'external_trip' | 'focus' | 'opening' | 'closing' | 'meeting' | 'program_needs';
/** ما يُربط به الصرف: رحلة (ومنها الافتتاحي والختامي)، لقاء تركيز، اجتماع، بند من احتياجات البرنامج */
export type BudgetOwnerKind = 'trip' | 'focus' | 'meeting' | 'need' | 'event';

/** مرفق حقيقي: يُحفظ اسمه وبصمته (SHA-256 لمحتوى الملف) ومعاينة مصغّرة للصور */
export interface Attachment {
  name: string;
  type: string;
  size: number;
  hash: string;
  preview?: string; // data URL مصغّر (صور فقط)
}

export interface BudgetCategoryItem {
  id: ID;
  name: string;
  hidden?: boolean;
}
export interface BudgetCategory {
  id: ID;
  name: string;
  hidden?: boolean;
  items: BudgetCategoryItem[];
}

/** مبلغ لكل عنصر، أو إجمالي يُقسَّم على عدد */
export interface AllocationRule {
  mode: 'per_item' | 'total';
  perItem: number;
  total: number;
  divisor: number;
}
/** الموازنة العامة: يسجّلها مسؤول المالية أول دخوله، ثم تُقفل ويُعدَّل بطلب يوافق عليه القائد العام */
export interface ProgramBudget {
  setupDone: boolean;
  setupAt?: ISODateTime;
  focus: AllocationRule;
  umrahPerGroup: number;
  internalTrip: AllocationRule;
  externalTrip: AllocationRule;
  opening: number;
  closing: number;
  meetingDefault: number; // مرصود كل اجتماع (صرف فعلي بعهدة)
  programNeeds: number; // مرصود احتياجات البرنامج
  focusLimits: { min: number; max: number }; // لقاءات التركيز بميزانية لكل مجموعة
}

/** بند من احتياجات البرنامج يُصرف عليه مباشرة أو بعهدة أو بعقد */
export interface ProgramNeed {
  id: ID;
  title: string;
  description?: string;
  createdBy: ID;
  at: ISODateTime;
}

export type BudgetRequestStatus =
  | 'draft'
  | 'pending_facilitator' // ميزانية رحلة مجموعة: بانتظار الميسّر
  | 'pending_finance' // ضمن المرصود: بانتظار مسؤول المالية
  | 'pending_leader' // تجاوز المرصود، أو ميزانية رحلة بعد الميسّر: بانتظار القائد العام
  | 'needs_detail' // القائد العام طلب موازنة تفصيلية من مقدّم الطلب
  | 'approved' // معتمد: بانتظار صرف العهدة
  | 'rejected'; // مرفوض بسبب: يعود لمقدّم الطلب
export interface BudgetRequestEvent {
  at: ISODateTime;
  byId: ID;
  action: 'submit' | 'facilitator_approve' | 'facilitator_reject' | 'finance_approve' | 'finance_reject' | 'leader_approve' | 'leader_reject' | 'leader_request_detail' | 'detail_submitted' | 'disbursed';
  note?: string;
}
export interface BudgetRequest {
  id: ID;
  ownerKind: BudgetOwnerKind;
  ownerId: ID;
  spendKind: SpendKind;
  requestedBy: ID;
  amount: number; // المبلغ المطلوب (مجموع الأسطر إن كانت تفصيلية)
  allocated: number; // المرصود وقت التقديم
  detailed: boolean;
  lines: BudgetLine[];
  note?: string;
  status: BudgetRequestStatus;
  submittedAt?: ISODateTime;
  history: BudgetRequestEvent[];
}

/** حركة في محفظة مسؤول المالية. لا حركة بلا مرفق (إيصال حوالة أو فاتورة أو إيصال تحويل) */
export type WalletEntryKind = 'deposit' | 'surplus_return' | 'custody_transfer' | 'direct_spend' | 'contract_payment' | 'deficit_payout';
export interface WalletEntry {
  id: ID;
  kind: WalletEntryKind;
  amount: number; // موجب دائماً، والاتجاه من النوع
  at: ISODateTime;
  byId: ID;
  attachment: Attachment;
  source?: string; // للإيداع: الجهة المحوِّلة
  note?: string;
  ref?: { custodyId?: ID; directSpendId?: ID; contractId?: ID; paymentId?: ID };
}

export interface CustodyTransfer {
  id: ID;
  amount: number;
  at: ISODateTime;
  byId: ID;
  walletEntryId: ID;
}
export type CustodyStatus = 'active' | 'closing' | 'closed';
/** تسوية الإغلاق: فائض يحوّله صاحب العهدة لمسؤول المالية، أو عجز يحوّله المسؤول أو يُسجَّل تسوية من خارج العهدة */
export interface CustodySettlement {
  kind: 'surplus' | 'deficit';
  amount: number;
  method: 'transfer' | 'external'; // external للعجز فقط
  bearer?: 'finance_officer' | 'holder'; // من يتحمّل التسوية الخارجية
  attachment: Attachment;
  note?: string;
  at: ISODateTime;
  byId: ID;
  walletEntryId?: ID;
}
export interface Custody {
  id: ID;
  requestId?: ID;
  ownerKind: BudgetOwnerKind;
  ownerId: ID;
  spendKind: SpendKind;
  recipientId: ID;
  approved: number; // المبلغ المعتمد للعهدة
  transfers: CustodyTransfer[]; // التحويل يعبّئ رصيد المستلم، وقد يُؤجَّل جزء كدفعة ثانية
  status: CustodyStatus;
  closeRequestedAt?: ISODateTime;
  surplusReturn?: { attachment: Attachment; at: ISODateTime }; // إيصال تحويل الفائض يرفعه صاحب العهدة
  settlement?: CustodySettlement;
  closedAt?: ISODateTime;
  closedBy?: ID;
  createdAt: ISODateTime;
  createdBy: ID;
}

/** سطر في نموذج الصرف: تصنيف (أو «غير موجود» باسم مقترح) + بند كشرح حر + مبلغ. يراجَع وحده */
export interface SpendLine {
  id: ID;
  categoryId?: ID;
  customCategory?: string; // «غير موجود»: يسمّيه رافع النموذج
  item: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected';
  /** ما كتبه الرافع قبل تعديل المالية للتصنيف أو المبلغ */
  original?: { categoryId?: ID; customCategory?: string; amount: number };
  reviewNote?: string;
  reviewedBy?: ID;
  reviewedAt?: ISODateTime;
}
export type ProofKind = 'invoice' | 'transfer_receipt';
/** نموذج الصرف من العهدة: فاتورة واحدة (أو إيصال تحويل) بسطر أو أكثر */
export interface SpendForm {
  id: ID;
  custodyId: ID;
  uploadedBy: ID;
  at: ISODateTime;
  vendor: string;
  serial?: string; // الرقم التسلسلي: يُدخل يدوياً (مكان جاهز لـ OCR لاحقاً)
  invoiceDate: ISODate;
  proofKind: ProofKind;
  attachment: Attachment;
  lines: SpendLine[];
}

/** الصرف المباشر: يصرفه مسؤول المالية بنفسه على نشاط أو أكثر (المصروف المشترك يُوزَّع) بلا اعتماد */
export interface DirectSpendLine {
  id: ID;
  categoryId?: ID;
  customCategory?: string;
  item: string;
  amount: number;
}
export interface DirectSpend {
  id: ID;
  allocations: { ownerKind: BudgetOwnerKind; ownerId: ID; amount: number }[];
  vendor: string;
  serial?: string;
  invoiceDate: ISODate;
  proofKind: ProofKind;
  attachment: Attachment;
  lines: DirectSpendLine[];
  total: number;
  byId: ID;
  at: ISODateTime;
  walletEntryId: ID;
}

/** العقد (احتياجات البرنامج فقط): قيمة إجمالية تُصرف دفعة أو دفعات، لكل دفعة موعد وفاتورة */
export interface ContractPayment {
  id: ID;
  amount: number;
  dueDate: ISODate;
  paidAt?: ISODateTime;
  byId?: ID;
  attachment?: Attachment;
  walletEntryId?: ID;
}
export interface Contract {
  id: ID;
  needId: ID;
  vendor: string;
  title: string;
  total: number;
  payments: ContractPayment[];
  createdBy: ID;
  at: ISODateTime;
}

export type FeeStatus = 'paid' | 'partial' | 'unpaid';
export interface FeeRecord {
  personId: ID;
  amount: number;
  status: FeeStatus;
  paidAmount: number;
  /** استثناء يُعتبر سداداً (مثل جمعية البر) مع تفصيله */
  exemption?: string;
  note?: string;
  updatedAt?: ISODateTime;
}
export interface AuditEntry {
  id: ID;
  at: ISODateTime;
  byId: ID;
  action: string;
  detail: string;
  /** المجال: المالية، الأدوار والصفات، الحسابات، الإعدادات (السجلات القديمة بلا مجال = المالية) */
  area?: 'finance' | 'roles' | 'accounts' | 'settings';
}

/** السجلات المعتمدة لا تُعدَّل مباشرة: يُرفع طلب تعديل يوافق عليه القائد العام أو يرفضه */
export type EditTarget =
  | { kind: 'spend_line'; formId: ID; lineId: ID }
  | { kind: 'direct_spend'; id: ID }
  | { kind: 'deposit'; id: ID }
  | { kind: 'program_budget' };
export interface EditRequest {
  id: ID;
  target: EditTarget;
  /** القيم الجديدة: spend_line {amount, categoryId}، direct_spend {amount (سطر واحد)، categoryId}، deposit {amount, note}، program_budget {budget} */
  patch: Record<string, unknown>;
  summary: string; // ماذا يتغيّر (قبل ← بعد)
  reason: string;
  requestedBy: ID;
  at: ISODateTime;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy?: ID;
  decidedAt?: ISODateTime;
  decisionNote?: string;
}

// ───────────── الاجتماعات ─────────────
export type MeetingStatus = 'planned' | 'held' | 'minutes' | 'closed';
export interface Meeting {
  id: ID;
  title: string;
  kind: 'periodic' | 'urgent';
  recurrence: 'none' | 'weekly' | 'biweekly' | 'monthly';
  withGroupLeaders: boolean;
  createdBy: ID;
  ownerId: ID; // المسؤول الوحيد، وهو من يكتب المحضر
  date: ISODate;
  start: string;
  end: string;
  location: string;
  inviteeIds: ID[];
  agenda: string[];
  status: MeetingStatus;
  attendeeIds: ID[];
  discussion?: string;
  decisions: string[];
  outputs: string[];
  allocated?: number; // مبلغ مرصود اختياري يضعه المسؤول المالي (للتخطيط)
  createdAt: ISODateTime;
}

// ───────────── الحضور والنقاط ─────────────
/** حالات الحضور: الرحلة (التحضير العام) مبكر/في الوقت/متأخر/غائب، ولقاءات التركيز ولقاءات الرحلة حاضر/غائب */
export type AttendanceStatus = 'early' | 'on_time' | 'late' | 'present' | 'absent';
export interface Attendance {
  id: ID;
  eventKind: 'trip' | 'focus' | 'individual' | 'trip_session';
  eventId: ID; // للقاء الرحلة: معرّف الرحلة
  sessionId?: ID;
  personId: ID;
  status: AttendanceStatus;
  present: boolean; // كل ما عدا الغياب
  byId: ID;
  at: ISODateTime;
}

/** التقييم الفردي من القائد العام: مرة واحدة لكل مشارك ببنود يحددها (مجموعها 100) */
export interface LeaderEvaluation {
  participantId: ID;
  scores: Record<string, number>;
  note?: string;
  byId: ID;
  at: ISODateTime;
}

/** اللقاء الافتتاحي والختامي: واحد لكل منهما، ويجوز إنشاؤه بأثر رجعي كلقاء منتهٍ يتخطى التخطيط والتجهيز */
export interface ProgramEvent {
  id: ID;
  kind: 'opening' | 'closing';
  title: string;
  date: ISODate;
  location?: string;
  description?: string;
  status: 'planned' | 'done';
  retroactive: boolean;
  attendees?: number;
  createdBy: ID;
  createdAt: ISODateTime;
  /** حقول الافتتاحي فقط */
  opening?: { programIntro?: string; groupsAnnouncement?: string; participantsDistribution?: string };
  /** حقول الختامي فقط */
  closing?: { rankingAnnouncement?: string; honorsAndCertificates?: string; finalReport?: string };
}

export interface PointsEntry {
  id: string;
  personId?: ID;
  groupId?: ID;
  itemKey: string;
  points: number;
  source: string;
  auto: boolean;
  at: ISODateTime;
  scope: 'individual' | 'group';
  tripType?: TripType;
}

export interface EvaluationSubItem {
  key: string;
  name: string;
  weight: number;
}
export interface EvaluationItem {
  key: string;
  name: string;
  scope: 'individual' | 'group';
  weight: number; // نسبة داخل نصيبه (الفردي أو الجماعي)
  mode: 'auto' | 'manual';
  enabled: boolean;
  description?: string;
  subItems?: EvaluationSubItem[];
}

// ───────────── الإشعارات والتعليقات ─────────────
export type NotificationType =
  | 'focus_created_presenter'
  | 'focus_published'
  | 'groups_published'
  | 'approval_submitted'
  | 'approval_approved'
  | 'approval_rejected'
  | 'deadline_near'
  | 'deadline_passed'
  | 'schedule_started'
  | 'task_assigned'
  | 'custody_issued'
  | 'leader_absent_focus'
  | 'individual_booked'
  | 'plan_step_due'
  | 'committee_member_request'
  | 'trip_published'
  | 'survey_available'
  | 'invoice_rejected'
  | 'budget_request'
  | 'meeting'
  | 'letter_request'
  | 'letter_issued'
  | 'letter_reminder'
  | 'general';

export interface Notification {
  id: ID;
  toId: ID;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  at: ISODateTime;
  read: boolean;
}

export interface Comment {
  id: ID;
  target: { kind: 'doc' | 'task' | 'trip'; id: ID };
  authorId: ID;
  text: string;
  kind: 'comment' | 'suggestion';
  at: ISODateTime;
}

/** جهة داعمة أو شريكة: كلمة مرور خاصة لنفس رابط الداعم، وشعار بترتيب وتصنيف لا يراه الزائر */
export interface SupporterEntity {
  id: ID;
  name: string;
  kind: 'supporter' | 'partner';
  salt: string;
  passwordHash: string;
  active: boolean;
  logo?: Attachment;
  placement: 'above' | 'below';
  orientation: 'horizontal' | 'vertical';
  primary: boolean;
  order: number;
  createdAt: ISODateTime;
}

/** الملف الختامي: يرفعه الميسّر لكل مشارك في نهاية البرنامج، ويُحسب جزءاً من الخطة الشخصية */
export interface FinalFile {
  participantId: ID;
  advice: string;
  attachment: Attachment;
  uploadedBy: ID;
  at: ISODateTime;
}

/** قسم في الموقع العام بقالب جاهز (لا محرر مواقع حر) */
export interface SiteSection {
  id: ID;
  type: 'text' | 'image' | 'people' | 'table';
  title: string;
  hidden: boolean;
  body?: string; // نص
  image?: Attachment; // صورة
  caption?: string;
  people?: 'staff' | 'top5'; // قائمة أشخاص من بيانات المنصة
  table?: { source: 'manual' | 'participants' | 'groups'; columns: string[]; rows: string[][] };
}

export interface TrackingComment {
  id: ID;
  entityId?: ID; // الجهة التي علّقت بعد الدخول
  name: string;
  text: string;
  at: ISODateTime;
  status: 'visible' | 'pending' | 'hidden';
}

// ───────────── الإعدادات ─────────────
export interface ScheduleCategory {
  id: ID;
  name: string;
  color: string;
  description?: string;
  /** يلزمه تحضير: لقاءاته يُسجَّل فيها الحضور (حاضر/غائب) */
  requiresPrep: boolean;
}

export interface SiteContent {
  heroTitle: string;
  /** كلمة التمييز في العنوان تظهر باللون الأساسي (اختيارية) */
  heroAccent?: string;
  heroSubtitle: string;
  contactEmail: string;
  /** الأقسام بالترتيب: يضيفها القائد العام (أو المفوَّض) ويحذفها ويخفيها ويعيد ترتيبها */
  sections: SiteSection[];
}

/** واجهة كل دور: ترتيب القائمة الجانبية ومحتوى الرئيسية (بيانات لا كود). الصلاحية نفسها تُحسب من الأدوار */
export type LayoutRole = 'finance_head' | 'tech_head' | 'media_head' | 'leader' | 'facilitator' | 'tracker' | 'group_leader' | 'staff' | 'participant';
export type HomeWidget = 'contact_notice' | 'competition' | 'actions' | 'upcoming';
export interface NavCatalogItem {
  key: string;
  to: string; // المسار، وقد يحمل ?tab= لتبويب داخل الشاشة
  label: string;
  icon: string;
  section: string; // المجموعة الافتراضية (للعرض فقط، فالقائمة لا تُظهر إلا ما ذكره ترتيب الدور)
}
export interface RoleLayout {
  role: LayoutRole;
  priority: number; // الأصغر أولاً عند اجتماع أكثر من دور
  sections: { title: string; items: { key: string; label?: string }[] }[];
  /** عناصر تنزل لآخر القائمة لهذا الدور (مثل الترتيب لمسؤولي المالية والإعلامية والتقنية) */
  tail?: string[];
  home: HomeWidget[];
}
export interface UiConfig {
  navCatalog: NavCatalogItem[];
  layouts: RoleLayout[];
  /** عناصر تظهر لمن يملكها وإن لم يذكرها ترتيب دوره (مثل «متابعة الرحلات» للبديل المؤقت)، في المجموعة المذكورة */
  extras?: { key: string; section: string }[];
}

export interface Settings {
  program: { name: string; cohort: string; startDate: ISODate; endDate: ISODate; participantsCount: number };
  /** النصيب الثابت 50/50 حسب الوثيقة لكنه مخزّن هنا لا في الكود */
  split: { individual: number; group: number };
  /** نصيب الرحلات الداخلية والخارجية من الجماعي */
  groupTripSplit: { internal: number; external: number };
  evaluationItems: EvaluationItem[];
  presentationCriteria: { key: string; name: string }[];
  /** التقديم المتكرر: يُحسب متوسط مرات التقديم لكل معيار، ويُضاف تميّز عن كل مرة بعد الأولى (نقاط ثابتة لا نسبة) */
  presentingExtraBonus: number;
  /** نتائج تقييم المقدّمين تظهر بعد نهاية البرنامج */
  presentingRevealAfterEnd: boolean;
  /** بنود تقييم القائد العام الفردي (مرة واحدة لكل مشارك) ومجموع أقصاها 100 */
  leaderEvalItems: { key: string; name: string; max: number }[];
  /** نماذج الرحلة: ما يُكسب من وزن البند عند التسليم بعد موعد التبكير وقبل الموعد النهائي (0..1). المبكر كامل، وبعد النهائي صفر */
  deadlineFinalCredit: number;
  enrichmentPointsPerMaterial: number;
  targets: { focusMeetingsPerGroup: number; individualMeetingsPerParticipant: number };
  programCounts: { staffInternal: number; groupInternal: number; groupExternal: number; staffExternal: number };
  /** مواعيد الرحلة بالأيام: لكل نموذج موعد تبكير وموعد نهائي قبل الرحلة، ومهلة الإغلاق والإغلاق المالي بعدها */
  deadlineDefaults: {
    documentEarlyDaysBefore: number; documentDaysBefore: number;
    scheduleEarlyDaysBefore: number; scheduleDaysBefore: number;
    budgetEarlyDaysBefore: number; budgetDaysBefore: number;
    finalReportDaysAfter: number; tripCloseDaysAfter: number; financeCloseDaysAfter: number; reminderDaysBefore: number;
  };
  /** وزن كل نوع حضور في التقييم الفردي (لقاءات التركيز، الرحلة، لقاءات الرحلة) */
  attendanceWeights: { focus: number; trip: number; tripSession: number };
  /** ما يُكسب من نقطة حضور الرحلة عند التأخر (0..1). المبكر والوقت كاملة بلا زيادة، والغياب صفر: لا خصم */
  attendanceLateCredit: number;
  /** قفل إعدادات التقييم: يُقفل عند الحفظ، ولا يفتحه إلا مسؤول اللجنة التقنية */
  evaluationLock: { locked: boolean; at?: ISODateTime; by?: ID };
  scheduleCategories: ScheduleCategory[];
  scheduleRevealHours: number;
  /** نسبة فريق العمل الذين يلزم تقييمهم للرحلة قبل إغلاقها */
  tripRatingQuorum: number;
  trackingCommentsNeedReview: boolean; // 20.8
  /** ما يصل بالإيميل عند ربطه لاحقاً (يحدده مسؤول اللجنة التقنية). حالياً كل الإشعارات داخل المنصة فقط */
  importantNotifications: NotificationType[];
  /** قواعد الإشعارات والبريد (مسؤول اللجنة التقنية وحده) */
  notifyRules: NotificationRule[];
  email: EmailSettings;
  showHijri: boolean; // 20.11
  feesInPlatform: boolean; // 20.12
  feeAmount: number;
  /** قوالب مالية يملكها مسؤول المالية */
  finance: {
    maxOpenCustodies: number; // عدد العهد المفتوحة المتزامنة للشخص (بشرط ألا يتكرر نوعها)
    splitAlert: { maxAmount: number; windowDays: number; minCount: number }; // تنبيه تجزئة المصروف
    evalItems: { key: string; name: string }[]; // بنود المالية في تقييم الرحلة (مثل الترشيد) يقيّم بها وحده
  };
  /** متابع الرحلات = مساعد القائد العام (يُشتق من حسابه ولا يُعيَّن يدوياً) */
  trackerId?: ID;
  /** مندوب الجمعية: ميسّر واحد يصدر الخطابات */
  societyDelegateId?: ID;
  /** مقيّمو الرحلات (متوسط تقييماتهم درجة الرحلة). فارغ = القائد العام ومساعده */
  tripEvaluatorIds?: ID[];
  /** عدد الحجوزات الفردية النشطة المسموحة لكل مشارك (الافتراضي 1) يعدّلها ميسّره */
  bookingLimits?: Record<ID, number>;
  /** بنية وثيقة الرحلة (أقسام وأعمدة جداولها): بيانات يعدّلها القائد العام أو مساعده */
  docTemplate: DocSectionDef[];
  /** الأهداف المقترحة (من محتوى البرنامج) تُختار وتُضاف */
  suggestedGoals: { educational: string[]; social: string[] };
  /** رابط الداعم الثابت: حد للمحاولات الخاطئة ومدة القفل */
  supporterLink: { maxAttempts: number; lockMinutes: number; programIdea: string };
  /** المركز الإعلامي */
  media: MediaSettings;
  site: SiteContent;
  /** القوائم والرئيسية لكل دور. يعدّلها مسؤول اللجنة التقنية (إعداد متغيّر) */
  ui: UiConfig;
}


// ───────────── فواتير إضافية (لا تُحتسب ضمن العهدة) ─────────────
/** يرفعها صاحب العهدة بعد الشراء لتُستفاد لاحقاً. لا تدخل مصروف العهدة ولا فائضها ولا إغلاقها */
export interface ExtraInvoice {
  id: ID;
  custodyId: ID;
  /** النشاط المرتبط (تلقائي من العهدة) */
  ownerKind: BudgetOwnerKind;
  ownerId: ID;
  addedBy: ID;
  at: ISODateTime;
  attachment: Attachment;
  amount: number;
  date: ISODate;
  /** غير محدد = «غير مصنف» */
  categoryId?: ID;
  description: string;
  /** المراجعة: علامة «تمت مراجعتها» وملاحظة اختيارية، لا رفض ولا اعتماد كصرف */
  review?: { by: ID; at: ISODateTime; note?: string };
}

// ───────────── المركز الإعلامي ─────────────
/** صلاحيات المركز: يمنحها القائد العام لأعضاء اللجنة الإعلامية كل واحدة على حدة */
export type MediaPermission = 'edit' | 'approve' | 'metrics';
export type MediaPriority = 'must' | 'important' | 'extra';
export type MediaItemStatus = 'not_started' | 'in_progress' | 'done' | 'failed';
export type MediaBriefKind = 'event' | 'week';
export type MediaBriefStatus = 'draft' | 'approved' | 'archived';
export type MediaLinkKind = 'read' | 'track';
/** مرجع فعالية موجودة في المنصة: لا تُنسخ بياناتها */
export interface EventRef {
  kind: 'trip' | 'focus' | 'meeting' | 'event';
  id: ID;
}
/** مفاتيح أقسام الموجز الاثني عشر (والمخصصة بمفتاح custom_*) */
export type BriefSectionKey =
  | 'info' | 'goals' | 'schedule' | 'shots' | 'interviews' | 'visual' | 'onsite' | 'deliverables' | 'partners' | 'contacts' | 'notes' | 'responsibilities' | 'deadlines'
  | `custom_${string}`;
export interface BriefSection {
  key: BriefSectionKey;
  title: string;
  visible: boolean;
  /** النص الحر للقسم (الأهداف، التوجيهات، التعليمات، القسم المخصص...) */
  body: string;
  custom?: boolean;
}
export interface BriefShot {
  id: ID;
  title: string;
  priority: MediaPriority;
  /** فقرة من جدول الفعالية (اختيارية) */
  scheduleItemId?: ID;
  /** افتراضها: ضرورية ومهمة مطلوبة، وإضافية اختيارية، وقابلة للتعديل */
  required: boolean;
}
export interface BriefInterview {
  id: ID;
  who: string;
  questions: string[];
  required: boolean;
}
export interface BriefDeliverable {
  id: ID;
  title: string;
  type: string;
  /** المقاس والصيغة */
  spec: string;
  dueDate?: ISODate;
  required: boolean;
}
export interface BriefContact {
  id: ID;
  name: string;
  role: string;
  phone?: string;
  /** لا تظهر خارج المنصة إلا الجهة المصرّح بمشاركتها */
  authorized: boolean;
}
export interface BriefResponsibility {
  id: ID;
  task: string;
  owner: string;
}
export interface BriefDeadline {
  id: ID;
  title: string;
  date: ISODate;
}
/** فعالية داخل الموجز بمتطلباتها الخاصة (الموجز الأسبوعي فيه أكثر من واحدة) */
export interface BriefEvent {
  id: ID;
  ref: EventRef;
  shots: BriefShot[];
  interviews: BriefInterview[];
  notes: string;
}
/** المحتوى القابل للتحرير: يُحفظ في الموجز، وتُحلّ بيانات الفعالية منه حياً ولا تُنسخ */
export interface BriefContent {
  title: string;
  weekStart?: ISODate;
  events: BriefEvent[];
  sections: BriefSection[];
  deliverables: BriefDeliverable[];
  contacts: BriefContact[];
  responsibilities: BriefResponsibility[];
  deadlines: BriefDeadline[];
}
/** فعالية مُحلّة وقت الاعتماد: ما يُجمَّد في اللقطة */
export interface ResolvedBriefEvent {
  id: ID;
  ref: EventRef;
  title: string;
  kindLabel: string;
  date: ISODate;
  endDate?: ISODate;
  start?: string;
  end?: string;
  location?: string;
  schedule: { id: ID; date: ISODate; start: string; end: string; detail: string }[];
  shots: BriefShot[];
  interviews: BriefInterview[];
  notes: string;
}
export interface BriefFrozen extends Omit<BriefContent, 'events'> {
  kind: MediaBriefKind;
  events: ResolvedBriefEvent[];
}
/** لقطة معتمدة بإصدار: هي ما يراه الفريق وما يُصدَّر */
export interface BriefSnapshot {
  version: number;
  at: ISODateTime;
  by: ID;
  /** سبب الإصدار: اعتماد أول، أو تأكيد تغييرات الجدول، أو تعديل المحتوى */
  reason: 'first' | 'schedule_change' | 'content_edit';
  /** بصمة محتوى الموجز وقت الاعتماد: لمعرفة وجود تعديلات غير معتمدة */
  contentHash: string;
  data: BriefFrozen;
}
/** حالة تنفيذ بند (لقطة أو مقابلة أو مخرج): حيّة وتبقى عبر الإصدارات */
export interface BriefItemExec {
  status: MediaItemStatus;
  /** إلزامي مع «متعذرة» */
  reason?: string;
  proofs: string[];
  notes: { id: ID; text: string; by: string; at: ISODateTime }[];
  updatedBy: string;
  updatedAt: ISODateTime;
  doneAt?: ISODateTime;
}
export interface MediaBrief {
  id: ID;
  kind: MediaBriefKind;
  status: MediaBriefStatus;
  templateId: ID;
  /** اسم القالب وقت الإنشاء (تعديل القالب لاحقاً لا يؤثر على الموجز) */
  templateName: string;
  content: BriefContent;
  /** ملاحظات داخلية: لا تدخل اللقطة ولا الرابط ولا الـPDF */
  internalNotes: string;
  snapshots: BriefSnapshot[];
  execution: Record<ID, BriefItemExec>;
  /** عند تفعيل «يتطلب موافقة القائد العام»: طلب الاعتماد بانتظاره */
  approvalRequest?: { by: ID; at: ISODateTime };
  createdBy: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
export interface MediaTemplate {
  id: ID;
  name: string;
  description: string;
  kind: MediaBriefKind | 'both';
  sections: BriefSection[];
  shots: { title: string; priority: MediaPriority; required: boolean }[];
  interviews: { who: string; questions: string[]; required: boolean }[];
  deliverables: { title: string; type: string; spec: string; dueOffsetDays: number; required: boolean }[];
  updatedAt: ISODateTime;
}
/** رابط مشاركة: الرمز العشوائي لا يُخزَّن، تُخزَّن بصمته فقط */
export interface MediaLink {
  id: ID;
  briefId: ID;
  kind: MediaLinkKind;
  tokenHash: string;
  /** آخر ستة أحرف للتعريف فقط */
  tokenTail: string;
  createdBy: ID;
  createdAt: ISODateTime;
  expiresAt?: ISODateTime;
  revokedAt?: ISODateTime;
  revokedBy?: ID;
  accessCount: number;
  lastAccessAt?: ISODateTime;
  lastVisitor?: string;
}
/** سجل تدقيق إجراءات الزوار على روابط المتابعة */
export interface MediaActivity {
  id: ID;
  briefId: ID;
  linkId: ID;
  itemId?: ID;
  itemTitle?: string;
  actor: string;
  action: string;
  at: ISODateTime;
}
export interface MediaSettings {
  /** يتطلب اعتماد الموجز موافقة القائد العام (معطّل افتراضياً) */
  requireLeaderApproval: boolean;
  /** يوم بداية الأسبوع: 0 الأحد ... 6 السبت */
  weekStartDay: number;
  /** «فعاليات قادمة بلا موجز»: خلال كم يوم */
  upcomingDays: number;
  /** تنبيه الروابط التي ستنتهي خلال كم يوم */
  linkExpiryWarnDays: number;
  /** صلاحية الرابط الجديد افتراضياً بالأيام (0 = بلا انتهاء) */
  defaultLinkDays: number;
}

// ───────────── قاعدة البيانات الكاملة ─────────────
export interface DB {
  version: number;
  seededAt: ISODateTime;
  persons: Person[];
  tempGrants: TempGrant[];
  accounts: Account[];
  /** قواعد تعارض الصفات: تُطبَّق عند إضافة أي صفة */
  capacityRules: CapacityRule[];
  groups: Group[];
  formation: GroupFormation;
  transfers: TransferLog[];
  facilitatorNotes: FacilitatorNote[];
  adminMessages: AdminMessage[];
  committees: Committee[];
  memberships: CommitteeMembership[];
  memberRequests: MemberRequest[];
  tasks: Task[];
  taskTemplates: TaskTemplate[];
  trips: Trip[];
  events: ProgramEvent[];
  leaderEvaluations: LeaderEvaluation[];
  docs: TripDoc[];
  actualSchedule: ActualScheduleEntry[];
  focusMeetings: FocusMeeting[];
  slots: AvailabilitySlot[];
  individualMeetings: IndividualMeeting[];
  personalPlans: PersonalPlan[];
  surveys: Survey[];
  materials: Material[];
  materialViews: MaterialView[];
  budgetCategories: BudgetCategory[];
  programBudget: ProgramBudget;
  budgetRequests: BudgetRequest[];
  audit: AuditEntry[];
  meetings: Meeting[];
  wallet: WalletEntry[];
  custodies: Custody[];
  spendForms: SpendForm[];
  directSpends: DirectSpend[];
  programNeeds: ProgramNeed[];
  contracts: Contract[];
  editRequests: EditRequest[];
  fees: FeeRecord[];
  attendance: Attendance[];
  notifications: Notification[];
  comments: Comment[];
  trackingComments: TrackingComment[];
  supporters: SupporterEntity[];
  /** عدّاد المحاولات الخاطئة (في المنصة الحقيقية على الخادم لكل عنوان) */
  supporterAccess: { failed: number; lockedUntil?: ISODateTime };
  finalFiles: FinalFile[];
  extraInvoices: ExtraInvoice[];
  letterTypes: LetterType[];
  letters: Letter[];
  emailLog: EmailLogEntry[];
  mediaTemplates: MediaTemplate[];
  mediaBriefs: MediaBrief[];
  mediaLinks: MediaLink[];
  mediaActivity: MediaActivity[];
  settings: Settings;
}

// ───────────── الخطابات (مندوب الجمعية) ─────────────
export interface LetterType {
  id: ID;
  name: string;
  /** نص مقترح قابل للتعديل يساعد في الصياغة */
  suggestedText: string;
}
export type LetterStatus = 'submitted' | 'preparing' | 'issued' | 'delivered' | 'needs_edit';
export interface Letter {
  id: ID;
  tripId: ID;
  typeId: ID;
  addressee: string;
  purpose: string;
  /** الحاجة قبل هذا التاريخ */
  neededBy: ISODate;
  /** مرفقات اختيارية: ملف أو رابط */
  attachments: { name: string; link?: string }[];
  requestedBy: ID;
  createdAt: ISODateTime;
  status: LetterStatus;
  editReason?: string;
  /** الخطاب الصادر: يُصدر خارج المنصة بترويسة الجمعية، وتحفظه المنصة وتتابعه */
  issued?: { number: string; date: ISODate; file: Attachment; byId: ID; at: ISODateTime };
  deliveredAt?: ISODateTime;
  reminderSent?: boolean;
}

// ───────────── وثيقة الرحلة (على بنية نموذج إعداد الرحلة) ─────────────
export type DocColumnType = 'text' | 'number' | 'yesno' | 'goal' | 'date' | 'person';
export interface DocColumn {
  key: string;
  label: string;
  type?: DocColumnType;
}
export interface DocSectionDef {
  id: string;
  title: string;
  /** المبدئية = الأقسام 1 إلى 4، والتفصيلية = 5 إلى 10 */
  stage: 'initial' | 'detailed';
  /** fields حقول نصية، goals قوائم أهداف، table جدول صفوفه قابلة للإضافة والحذف، embed يعرض الجدول الزمني والموازنة */
  kind: 'fields' | 'goals' | 'table' | 'embed';
  fields?: { key: string; label: string; long?: boolean }[];
  columns?: DocColumn[];
  /** الأنواع التي يظهر لها القسم (يُخفى السكن والتواصل مع الأسر في الداخلية) */
  tripTypes: TripType[];
}

// ───────────── قواعد الإشعارات والبريد (اللجنة التقنية وحدها) ─────────────
export type RecipientRole = 'participant' | 'group_leader' | 'facilitator' | 'staff' | 'leader' | 'finance' | 'media';
export interface NotificationRule {
  type: NotificationType;
  /** مفتاح تشغيل الحدث. القناة داخل المنصة دائماً */
  enabled: boolean;
  email: boolean;
  /** تذكيرات قبل الموعد بالساعات (يمكن أكثر من واحد) */
  reminders: number[];
  /** الأدوار التي يصلها بالبريد (فارغ = كل المستلمين) */
  recipients: RecipientRole[];
}
export interface SendWindow { days: number[]; from: string; to: string }
export interface EmailSettings {
  /** إيقاف كل البريد */
  masterOff: boolean;
  dailyCap: number;
  perUserCap: number;
  /** عند بلوغ السقف: تأجيل للنافذة التالية أو تخطٍّ */
  onCap: 'defer' | 'skip';
  windows: SendWindow[];
  /** استثناءات بتواريخ: closed = لا إرسال في ذلك اليوم */
  exceptions: { date: ISODate; closed: boolean }[];
  templates: Record<string, { subject: string; body: string }>;
}
export type EmailStatus = 'sent' | 'deferred' | 'skipped' | 'disabled';
export interface EmailLogEntry {
  id: ID;
  at: ISODateTime;
  toId: ID;
  type: NotificationType;
  subject: string;
  status: EmailStatus;
  reason?: string;
  test?: boolean;
}
