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
  isGeneralLeader?: boolean; // القائد العام = المشرف العام
  email: string;
  phone?: string;
  university?: string;
  major?: string;
  title?: string; // وصف قصير لعضو الإدارة
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
export type DocKind = 'initial' | 'detailed' | 'final_report';
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
export interface ScheduleChange {
  id: ID;
  at: ISODateTime;
  byId: ID;
  description: string;
  afterStart: boolean;
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

export interface TripEvaluation {
  trackerScore?: number; // من 10
  trackerNote?: string;
  leaderScore?: number; // من 10
  leaderNote?: string;
  /** درجات يدوية لبنود التقييم الجماعي (0..5) مفتاحها: evaluationItemKey.subKey */
  manual: Record<string, number>;
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
  milestone?: 'opening' | 'closing';
  deadlines: { initial: ISODate; detailed: ISODate };
  createdAt: ISODateTime;
  createdBy: ID;
  published: boolean;
  publishedAt?: ISODateTime;
  schedule: { plans: SchedulePlan[]; changes: ScheduleChange[] };
  scheduleVisibility: 'hidden' | 'full' | 'next24';
  scheduleStartedNotified?: boolean;
  sessions: TripSession[];
  guests: TripGuest[];
  coordinationOwnerId?: ID;
  coordinations: Coordination[];
  attendanceTakerId?: ID;
  trackerSubstitute?: { candidateId: ID; reason?: string; status: 'pending' | 'approved' | 'rejected' };
  closure: { teamEvalForm?: string; experienceForm?: string; publicReport?: string; photos: string[] };
  evaluation: TripEvaluation;
  /** درجات الالتزام بالوقت لكل مشارك يرصدها قائد المجموعة (0..5) */
  punctuality: Record<ID, number>;
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
export type BudgetOwnerKind = 'trip' | 'focus' | 'meeting' | 'need';

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
export interface Attendance {
  id: ID;
  eventKind: 'trip' | 'focus' | 'individual';
  eventId: ID;
  personId: ID;
  present: boolean;
  byId: ID;
  at: ISODateTime;
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
  mode: 'auto' | 'manual' | 'mixed';
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

export interface TrackingComment {
  id: ID;
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
  heroSubtitle: string;
  about: string;
  pillars: { title: string; text: string }[];
  journey: { title: string; text: string }[];
  audience: string;
  faq: { q: string; a: string }[];
  contactEmail: string;
}

/** واجهة كل دور: ترتيب القائمة الجانبية ومحتوى الرئيسية (بيانات لا كود). الصلاحية نفسها تُحسب من الأدوار */
export type LayoutRole = 'finance_head' | 'tech_head' | 'media_head' | 'leader' | 'facilitator' | 'tracker' | 'group_leader' | 'staff' | 'participant';
export type HomeWidget = 'contact_notice' | 'competition' | 'actions' | 'upcoming';
export interface NavCatalogItem {
  key: string;
  to: string; // المسار، وقد يحمل ?tab= لتبويب داخل الشاشة
  label: string;
  icon: string;
  section: string; // المجموعة الافتراضية لما لا يذكره ترتيب الدور
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
}

export interface Settings {
  program: { name: string; cohort: string; startDate: ISODate; endDate: ISODate; participantsCount: number };
  /** النصيب الثابت 50/50 حسب الوثيقة لكنه مخزّن هنا لا في الكود */
  split: { individual: number; group: number };
  /** نصيب الرحلات الداخلية والخارجية من الجماعي */
  groupTripSplit: { internal: number; external: number };
  evaluationItems: EvaluationItem[];
  presentationCriteria: { key: string; name: string }[];
  repeatPresentationFactor: number; // 20.2
  presentingMaxMultiplier: number;
  lateFactor: number; // ما يُكسب من النقطة عند التأخر عن الموعد النهائي
  enrichmentPointsPerMaterial: number;
  targets: { focusMeetingsPerGroup: number; individualMeetingsPerParticipant: number };
  programCounts: { staffInternal: number; groupInternal: number; groupExternal: number; staffExternal: number };
  deadlineDefaults: { initialDaysBefore: number; detailedDaysBefore: number; finalReportDaysAfter: number; reminderDaysBefore: number };
  /** وزن كل نوع حضور في التقييم الفردي (لقاءات التركيز، الرحلة، لقاءات الرحلة) */
  attendanceWeights: { focus: number; trip: number; tripSession: number };
  /** ما يُكسب من نقطة حضور الرحلة لكل حالة (0..1). الغياب صفر دائماً: لا خصم */
  tripAttendanceStates: { early: number; on_time: number; late: number };
  /** قفل إعدادات التقييم: يُقفل عند الحفظ، ولا يفتحه إلا مسؤول اللجنة التقنية */
  evaluationLock: { locked: boolean; at?: ISODateTime; by?: ID };
  scheduleCategories: ScheduleCategory[];
  scheduleRevealHours: number;
  scheduleEditAfterStartNeedsApproval: boolean; // 20.6
  trackingCommentsNeedReview: boolean; // 20.8
  /** ما يصل بالإيميل عند ربطه لاحقاً (يحدده مسؤول اللجنة التقنية). حالياً كل الإشعارات داخل المنصة فقط */
  importantNotifications: NotificationType[];
  showHijri: boolean; // 20.11
  feesInPlatform: boolean; // 20.12
  feeAmount: number;
  /** قوالب مالية يملكها مسؤول المالية */
  finance: {
    maxOpenCustodies: number; // عدد العهد المفتوحة المتزامنة للشخص (بشرط ألا يتكرر نوعها)
    splitAlert: { maxAmount: number; windowDays: number; minCount: number }; // تنبيه تجزئة المصروف
  };
  trackerId?: ID;
  trackingLink: { token?: string; active: boolean; createdAt?: ISODateTime };
  site: SiteContent;
  /** القوائم والرئيسية لكل دور. يعدّلها مسؤول اللجنة التقنية (إعداد متغيّر) */
  ui: UiConfig;
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
  manualPoints: PointsEntry[];
  notifications: Notification[];
  comments: Comment[];
  trackingComments: TrackingComment[];
  settings: Settings;
}
