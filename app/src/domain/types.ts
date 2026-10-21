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

/** صفة مخزّنة صراحةً (الصفات الأخرى تُشتق من المجموعات واللجان والرحلات) */
export type StoredCapacityKind = 'site_editor';
export interface Capacity {
  id: ID;
  personId: ID;
  kind: StoredCapacityKind;
  grantedBy: ID;
  at: ISODateTime;
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
export type CommitteeKind = 'finance' | 'media' | 'general' | 'other';
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
export interface CommitteeMembership {
  id: ID;
  committeeId: ID;
  personId: ID;
  role: 'leader' | 'member';
  canSeeFinance: boolean;
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
export interface ChatMessage {
  id: ID;
  committeeId: ID;
  authorId: ID;
  text: string;
  at: ISODateTime;
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

export type DocKind = 'initial' | 'detailed' | 'budget' | 'final_report';
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
export interface BudgetLine {
  id: ID;
  categoryId: ID;
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
  budget: {
    lines: BudgetLine[];
    status: 'none' | 'pending' | 'accepted' | 'revise' | 'accepted_lower';
    approvedAmount?: number;
    financeNote?: string;
  };
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
export type BudgetOwnerKind = 'trip' | 'focus' | 'individual';
export interface BudgetCategory {
  id: ID;
  name: string;
  appliesTo: BudgetOwnerKind[];
}
export interface TripBudget {
  tripId: ID;
  lines: BudgetLine[];
}
export type InstallmentStatus = 'scheduled' | 'awaiting_iban' | 'awaiting_transfer' | 'awaiting_confirm' | 'received';
export interface Installment {
  id: ID;
  amount: number;
  dueDate: ISODate;
  condition?: string;
  status: InstallmentStatus;
  transferReceipt?: string;
  transferredAt?: ISODateTime;
  confirmedAt?: ISODateTime;
}
export type CustodyStatus = 'setup' | 'active' | 'closing' | 'closed';
export interface Custody {
  id: ID;
  ownerKind: BudgetOwnerKind;
  ownerId: ID;
  recipientId: ID;
  total: number;
  iban?: string;
  installments: Installment[];
  status: CustodyStatus;
  refund?: { amount: number; receipt: string; at: ISODateTime };
  overspend?: { amount: number; reason: string; financeApproved?: boolean; adminApproved?: boolean };
  closedAt?: ISODateTime;
  createdAt: ISODateTime;
}
export interface Invoice {
  id: ID;
  custodyId: ID;
  categoryId: ID;
  statement: string;
  amount: number;
  image: string;
  uploadedBy: ID;
  status: 'pending' | 'accepted' | 'rejected';
  rejectReason?: string;
  at: ISODateTime;
}
export interface FeeRecord {
  personId: ID;
  amount: number;
  paid: boolean;
  paidAt?: ISODate;
  note?: string;
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
  emailed: boolean;
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
  scheduleCategories: ScheduleCategory[];
  scheduleRevealHours: number;
  scheduleEditAfterStartNeedsApproval: boolean; // 20.6
  overspendNeedsApproval: boolean; // 20.7
  trackingCommentsNeedReview: boolean; // 20.8
  importantNotifications: NotificationType[]; // 20.9
  showHijri: boolean; // 20.11
  feesInPlatform: boolean; // 20.12
  feeAmount: number;
  budgetVisibleToStaff: boolean;
  trackerId?: ID;
  trackingLink: { token?: string; active: boolean; createdAt?: ISODateTime };
  site: SiteContent;
}

// ───────────── قاعدة البيانات الكاملة ─────────────
export interface DB {
  version: number;
  seededAt: ISODateTime;
  persons: Person[];
  capacities: Capacity[];
  groups: Group[];
  formation: GroupFormation;
  transfers: TransferLog[];
  facilitatorNotes: FacilitatorNote[];
  adminMessages: AdminMessage[];
  committees: Committee[];
  memberships: CommitteeMembership[];
  memberRequests: MemberRequest[];
  chat: ChatMessage[];
  tasks: Task[];
  taskTemplates: TaskTemplate[];
  trips: Trip[];
  docs: TripDoc[];
  tripBudgets: TripBudget[];
  actualSchedule: ActualScheduleEntry[];
  focusMeetings: FocusMeeting[];
  slots: AvailabilitySlot[];
  individualMeetings: IndividualMeeting[];
  personalPlans: PersonalPlan[];
  surveys: Survey[];
  materials: Material[];
  materialViews: MaterialView[];
  budgetCategories: BudgetCategory[];
  custodies: Custody[];
  invoices: Invoice[];
  fees: FeeRecord[];
  attendance: Attendance[];
  manualPoints: PointsEntry[];
  notifications: Notification[];
  comments: Comment[];
  trackingComments: TrackingComment[];
  settings: Settings;
}
