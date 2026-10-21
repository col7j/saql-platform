// الرحلات في البيانات التجريبية: كل رحلة في مرحلة مختلفة من المسار
import { addDays, timeOf, toISODate } from '@/domain/dates';
import type { ActualScheduleEntry, ScheduleItem, Trip, TripBudget, TripDoc, TripSession, DocKind, DocStatus } from '@/domain/types';
import { LEADER_ID } from './seed-people';

type Tpl = [number, string, string, string?]; // دقائق، تصنيف، تفصيل، عنوان لقاء
let seq = 0;
const nid = (p: string) => `${p}_${++seq}`;

/** يبني بنود جدول متتالية من لحظة بداية */
function buildRun(start: Date, tpl: Tpl[], presenter?: string) {
  const items: ScheduleItem[] = [];
  const sessions: TripSession[] = [];
  let cur = new Date(start);
  for (const [mins, cat, detail, sessionTitle] of tpl) {
    const end = new Date(cur.getTime() + mins * 60000);
    const date = toISODate(cur);
    const item: ScheduleItem = { id: nid('si'), date, start: timeOf(cur), end: timeOf(end), categoryId: cat, detail };
    if (sessionTitle) {
      const s: TripSession = { id: nid('ss'), title: sessionTitle, presenter, date, start: item.start, end: item.end };
      sessions.push(s);
      item.sessionId = s.id;
    }
    items.push(item);
    cur = end;
  }
  return { items, sessions };
}
function at(date: string, hh: number, mm = 0) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

const internalTpl = (topic1: string, topic2: string): Tpl[] => [
  [30, 'cat_move', 'التجمع والانطلاق من مقر البرنامج'],
  [60, 'cat_tour', 'جولة في الموقع مع المرشد'],
  [60, 'cat_lecture', `محاضرة: ${topic1}`, topic1],
  [30, 'cat_rest', 'استراحة وقهوة'],
  [30, 'cat_worship', 'الصلاة'],
  [60, 'cat_food', 'وجبة جماعية'],
  [90, 'cat_lecture', `ورشة: ${topic2}`, topic2],
  [45, 'cat_fun', 'نشاط جماعي ومسابقة'],
  [30, 'cat_move', 'العودة'],
];
const altInternal = (items: ScheduleItem[]): ScheduleItem[] =>
  items.map((i, idx) => ({ ...i, id: nid('si'), detail: idx === 1 ? 'جولة بديلة داخل المتحف (في حال الحر الشديد)' : idx === 7 ? 'نشاط داخلي بديل' : i.detail, sessionId: undefined }));

function externalDays(startDate: string, days: number, topics: string[]) {
  const items: ScheduleItem[] = [];
  const sessions: TripSession[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    const tpl: Tpl[] =
      d === 0
        ? [[240, 'cat_move', 'السفر بالحافلة'], [60, 'cat_rest', 'تسكين واستراحة'], [60, 'cat_food', 'الغداء'], [90, 'cat_lecture', `لقاء: ${topics[0]}`, topics[0]], [90, 'cat_tour', 'جولة تعريفية'], [60, 'cat_food', 'العشاء'], [600, 'cat_sleep', 'نوم']]
        : d === days - 1
          ? [[60, 'cat_food', 'الإفطار'], [90, 'cat_lecture', `ورشة: ${topics[topics.length - 1]}`, topics[topics.length - 1]], [60, 'cat_rest', 'تجهيز وتسليم السكن'], [240, 'cat_move', 'العودة']]
          : [[60, 'cat_food', 'الإفطار'], [120, 'cat_tour', 'زيارة المعالم'], [90, 'cat_lecture', `محاضرة: ${topics[d] ?? 'القيادة'}`, topics[d] ?? 'القيادة'], [60, 'cat_food', 'الغداء'], [120, 'cat_rest', 'راحة'], [120, 'cat_fun', 'برنامج ترفيهي'], [60, 'cat_food', 'العشاء'], [600, 'cat_sleep', 'نوم']];
    const r = buildRun(at(date, d === 0 ? 6 : 7), tpl);
    items.push(...r.items);
    sessions.push(...r.sessions);
  }
  return { items, sessions };
}

function baseTrip(p: Partial<Trip> & Pick<Trip, 'id' | 'title' | 'type' | 'executor' | 'startDate' | 'endDate'>, T: string): Trip {
  return {
    location: '',
    description: '',
    isPersonalPlanMeeting: false,
    deadlines: { initial: addDays(p.startDate, -21), detailed: addDays(p.startDate, -10) },
    createdAt: new Date(addDays(T, -70)).toISOString(),
    createdBy: LEADER_ID,
    published: false,
    schedule: { plans: [{ id: nid('pl'), name: 'الخطة أ', items: [] }, { id: nid('pl'), name: 'الخطة ب', items: [] }], changes: [] },
    scheduleVisibility: 'hidden',
    sessions: [],
    guests: [],
    coordinations: [
      { key: 'transport', status: 'pending' },
      { key: 'food', status: 'pending' },
      ...(p.type === 'external' ? [{ key: 'housing' as const, status: 'pending' as const }, { key: 'hosting' as const, status: 'pending' as const }] : [{ key: 'hosting' as const, status: 'pending' as const }]),
    ],
    closure: { photos: [] },
    evaluation: { manual: {} },
    punctuality: {},
    ...p,
  };
}

export interface TripSeed {
  trips: Trip[];
  docs: TripDoc[];
  budgets: TripBudget[];
  actual: ActualScheduleEntry[];
}

export function buildTrips(T: string, nowDate: Date): TripSeed {
  seq = 0;
  const trips: Trip[] = [];
  const docs: TripDoc[] = [];
  const budgets: TripBudget[] = [];
  const actual: ActualScheduleEntry[] = [];

  const iso = (date: string, h = 10) => at(date, h).toISOString();
  const doc = (tripId: string, kind: DocKind, status: DocStatus, submitted: string | null, fields: Record<string, string>, history: TripDoc['history'] = [], version = 1) => {
    docs.push({ id: nid('doc'), tripId, kind, status, version, fields, submittedAt: submitted ?? undefined, approvedAt: status === 'approved' ? submitted ?? undefined : undefined, history });
  };
  const ap = (byId: string, role: 'facilitator' | 'leader', decision: 'approve' | 'reject' | 'edit', when: string, reason?: string, version = 1) => ({ id: nid('ap'), byId, role, decision, reason, at: when, version });
  const approvedChain = (tripId: string, fac: string | null, d: string) => {
    const h = fac ? [ap(fac, 'facilitator', 'approve', iso(d, 12)), ap(LEADER_ID, 'leader', 'approve', iso(addDays(d, 1), 18))] : [ap(LEADER_ID, 'leader', 'approve', iso(addDays(d, 1), 18))];
    return h;
  };
  const initialFields = (place: string) => ({ location: place, titles: 'القيادة بالقدوة · العمل بروح الفريق', outline: 'جولة صباحية، ثم محاضرة، ثم ورشة تطبيقية ونشاط جماعي.' });
  const detailedFields = { summary: 'الجدول الزمني المعتمد مع الخطة البديلة، وتوزيع المهام على الفريق.', details: 'التجمع 7:00 ص، العودة بعد العصر. الضيوف مؤكدون.' };
  const budget = (tripId: string, lines: [string, string, string, number, number][]) =>
    budgets.push({ tripId, lines: lines.map(([categoryId, description, unit, qty, price]) => ({ id: nid('bl'), categoryId, description, unit, qty, price })) });
  const internalBudget = (tripId: string) =>
    budget(tripId, [
      ['bc_transport', 'باص كوستر مع سائق', 'يوم', 1, 1000],
      ['bc_food', 'غداء للمشاركين والفريق', 'وجبة', 32, 35],
      ['bc_hosting', 'قهوة وتمر وماء', 'طلب', 2, 150],
      ['bc_guests', 'مكافأة ضيف المحاضرة', 'ضيف', 1, 500],
      ['bc_tickets', 'رسوم دخول الموقع', 'تذكرة', 32, 10],
    ]);
  const externalBudget = (tripId: string) =>
    budget(tripId, [
      ['bc_transport', 'حافلة 50 راكباً ذهاباً وعودة', 'رحلة', 1, 6500],
      ['bc_housing', 'استراحة/شاليه', 'ليلة', 2, 2200],
      ['bc_food', 'وجبات رئيسية', 'وجبة', 32 * 6, 30],
      ['bc_hosting', 'ضيافة يومية', 'يوم', 3, 300],
      ['bc_guests', 'مكافآت الضيوف', 'ضيف', 2, 700],
      ['bc_print', 'مطبوعات ودروع', 'طقم', 1, 600],
    ]);
  const guests = (names: [string, string][], confirmed = true) => names.map(([name, role]) => ({ id: nid('gs'), name, role, confirmed }));

  // 1) لقاء تطويري أول (فريق عمل) — مغلق
  {
    const d = addDays(T, -52);
    const r = buildRun(at(d, 8), internalTpl('معنى القيادة الشبابية', 'اكتشف نقاط قوتك'), 'د. سامي الغامدي');
    const t = baseTrip({
      id: 't1', title: 'اللقاء التطويري الأول: الانطلاقة', type: 'internal', executor: { kind: 'staff', leaderId: 's2', memberIds: ['s3', 's4'] },
      startDate: d, endDate: d, location: 'قاعة الملتقى · المدينة المنورة', description: 'لقاء التأسيس والتعارف قبل تشكيل المجموعات.',
      published: true, publishedAt: iso(addDays(d, -3)), scheduleVisibility: 'full', scheduleStartedNotified: true,
      schedule: { plans: [{ id: nid('pl'), name: 'الخطة أ', items: r.items }, { id: nid('pl'), name: 'الخطة ب', items: altInternal(r.items) }], changes: [] },
      sessions: r.sessions, guests: guests([['د. سامي الغامدي', 'محاضر'], ['أ. وائل حسن', 'مدرب ورشة']]),
      closure: { teamEvalForm: 'أداء الفريق ممتاز، والتحدي الأكبر كان ضبط الوقت.', experienceForm: 'تعلمنا أهمية التجهيز المبكر للضيافة.', publicReport: 'حضر 22 مشاركاً، وقُدّمت محاضرة وورشة. انطلاقة موفقة للبرنامج.', photos: ['ph1', 'ph2', 'ph3'] },
      evaluation: { trackerScore: 8, leaderScore: 9, manual: {} },
    }, T);
    t.coordinations = t.coordinations.map((c) => ({ ...c, status: 'done' }));
    trips.push(t);
    doc('t1', 'initial', 'approved', iso(addDays(d, -25)), initialFields('قاعة الملتقى'), approvedChain('t1', null, addDays(d, -25)));
    doc('t1', 'detailed', 'approved', iso(addDays(d, -12)), detailedFields, approvedChain('t1', null, addDays(d, -12)));
    doc('t1', 'budget', 'approved', iso(addDays(d, -12)), {}, approvedChain('t1', null, addDays(d, -12)));
    doc('t1', 'final_report', 'approved', iso(addDays(d, 4)), { summary: 'تقرير اللقاء التطويري الأول', achievements: 'تعارف المشاركين، وبناء التوقعات.', recommendations: 'تقديم موعد الغداء.' }, approvedChain('t1', null, addDays(d, 4)));
    internalBudget('t1');
    r.items.forEach((it, i) => actual.push({ id: nid('ac'), tripId: 't1', refItemId: it.id, followed: i === 6 ? 'none' : i === 1 ? 'B' : 'A', note: i === 6 ? 'تأخر الضيف 20 دقيقة: وقت بدل ضائع' : undefined, actualStart: it.start, actualEnd: it.end, byId: 's5', at: iso(d, 18) }));
  }

  // 2) لقاء الخطة الشخصية (فريق عمل) — منفذ، قيد الإغلاق
  {
    const d = addDays(T, -30);
    const r = buildRun(at(d, 8), internalTpl('عجلة الحياة: كيف تعبّئها', 'من الرؤية إلى الخطوات'), 'أ. نايف البلوي');
    const t = baseTrip({
      id: 't2', title: 'لقاء الخطة الشخصية', type: 'internal', executor: { kind: 'staff', leaderId: 's3', memberIds: ['s1', 's4'] },
      startDate: d, endDate: d, location: 'مزرعة الريحان · طريق الهجرة', isPersonalPlanMeeting: true,
      description: 'لقاء تطويري يفتح قسم الخطة الشخصية: استبيان قبلي عن عجلة الحياة ومدرب يشرح التعبئة.',
      published: true, publishedAt: iso(addDays(d, -4)), scheduleVisibility: 'full', scheduleStartedNotified: true,
      schedule: { plans: [{ id: nid('pl'), name: 'الخطة أ', items: r.items }, { id: nid('pl'), name: 'الخطة ب', items: altInternal(r.items) }], changes: [] },
      sessions: r.sessions, guests: guests([['أ. نايف البلوي', 'مدرب كوتشينج']]),
      closure: { teamEvalForm: 'الفريق التزم بالمهام.', photos: ['ph4'] },
      evaluation: { trackerScore: 9, manual: {} },
    }, T);
    trips.push(t);
    doc('t2', 'initial', 'approved', iso(addDays(d, -24)), initialFields('مزرعة الريحان'), approvedChain('t2', null, addDays(d, -24)));
    doc('t2', 'detailed', 'approved', iso(addDays(d, -11)), detailedFields, approvedChain('t2', null, addDays(d, -11)));
    doc('t2', 'budget', 'approved', iso(addDays(d, -11)), {}, approvedChain('t2', null, addDays(d, -11)));
    doc('t2', 'final_report', 'submitted', iso(addDays(d, 6)), { summary: 'تقرير لقاء الخطة الشخصية', achievements: 'عبّأ 20 مشاركاً عجلة الحياة.', recommendations: 'متابعة الغائبين بلقاء تعويضي.' });
    internalBudget('t2');
    r.items.forEach((it) => actual.push({ id: nid('ac'), tripId: 't2', refItemId: it.id, followed: 'A', byId: 's5', at: iso(d, 18) }));
  }

  // 3) رحلة أُحُد الداخلية — منفذة ومغلقة بالكامل
  {
    const d = addDays(T, -16);
    const r = buildRun(at(d, 7), internalTpl('دروس القيادة في غزوة أُحُد', 'اتخاذ القرار تحت الضغط'), 'الشيخ د. حسن الأنصاري');
    const t = baseTrip({
      id: 't3', title: 'رحلة أُحُد الداخلية: معالم السيرة', type: 'internal', executor: { kind: 'group', groupId: 'g1' },
      startDate: d, endDate: d, location: 'جبل أُحُد ومجمع الشهداء', description: 'رحلة في معالم السيرة النبوية بالمدينة.',
      published: true, publishedAt: iso(addDays(d, -2)), scheduleVisibility: 'full', scheduleStartedNotified: true, attendanceTakerId: 'u2', coordinationOwnerId: 'u3',
      schedule: { plans: [{ id: nid('pl'), name: 'الخطة أ', items: r.items }, { id: nid('pl'), name: 'الخطة ب', items: altInternal(r.items) }], changes: [{ id: nid('ch'), at: iso(d, 11), byId: 'u1', description: 'تبديل موعد الاستراحة مع الغداء', afterStart: true }] },
      sessions: r.sessions, guests: guests([['الشيخ د. حسن الأنصاري', 'محاضر'], ['أ. مازن العلي', 'مدرب ورشة']]),
      closure: { teamEvalForm: 'وزعنا المهام مبكراً. التحدي: التنسيق مع المرشد.', experienceForm: 'التجربة رسّخت أهمية الخطة البديلة.', publicReport: 'حضر 21 مشاركاً من المجموعات الأربع. نُفّذت جولة ومحاضرة وورشة. التزام بالجدول بنسبة 89%.', photos: ['ph5', 'ph6', 'ph7', 'ph8'] },
      evaluation: { trackerScore: 8, trackerNote: 'تنظيم جيد وتأخر بسيط في الورشة', leaderScore: 8.5, leaderNote: 'رحلة موفقة', manual: { 'coordination.transport': 5, 'coordination.food': 4, 'coordination.hosting': 4, 'program_mgmt.schedule_topics': 4, 'program_mgmt.activation': 5, 'program_mgmt.flexibility': 4 } },
      punctuality: { u1: 5, u2: 5, u3: 4, u4: 3, u5: 5, u6: 4, u7: 5, u8: 3, u9: 4, u13: 5, u14: 4, u19: 4, u20: 3 },
    }, T);
    t.coordinations = t.coordinations.map((c) => ({ ...c, status: 'done' }));
    trips.push(t);
    doc('t3', 'initial', 'approved', iso(addDays(d, -24)), initialFields('جبل أُحُد'), approvedChain('t3', 's1', addDays(d, -24)));
    doc('t3', 'detailed', 'approved', iso(addDays(d, -11)), detailedFields, [ap('s1', 'facilitator', 'reject', iso(addDays(d, -12)), 'الجدول لا يتضمن وقتاً للصلاة'), ap('s1', 'facilitator', 'approve', iso(addDays(d, -11), 14), undefined, 2), ap(LEADER_ID, 'leader', 'approve', iso(addDays(d, -10)), undefined, 2)], 2);
    doc('t3', 'budget', 'approved', iso(addDays(d, -11)), {}, approvedChain('t3', 's1', addDays(d, -11)));
    doc('t3', 'final_report', 'approved', iso(addDays(d, 5)), { summary: 'تقرير رحلة أُحُد الداخلية', achievements: 'تنفيذ كامل البرنامج ومشاركة كل المجموعات.', recommendations: 'تقليل وقت التنقل.' }, approvedChain('t3', 's1', addDays(d, 5)));
    internalBudget('t3');
    r.items.forEach((it, i) => actual.push({ id: nid('ac'), tripId: 't3', refItemId: it.id, followed: i === 6 ? 'none' : 'A', note: i === 6 ? 'بدأت الورشة متأخرة 15 دقيقة' : undefined, actualStart: i === 6 ? it.start.replace(/:(\d\d)$/, ':15') : it.start, actualEnd: it.end, categoryId: it.categoryId, byId: 's5', at: iso(d, 18) }));
  }

  // 4) رحلة قُباء الداخلية — يوم التنفيذ (الآن)
  {
    const start = new Date(nowDate);
    start.setMinutes(start.getMinutes() < 30 ? 0 : 30, 0, 0);
    start.setHours(start.getHours() - 3);
    const r = buildRun(start, internalTpl('قيادة الذات', 'التواصل المؤثر'), 'د. عادل الحربي');
    const d = r.items[0].date;
    const t = baseTrip({
      id: 't4', title: 'رحلة قُباء الداخلية: على خطى الهجرة', type: 'internal', executor: { kind: 'group', groupId: 'g2' },
      startDate: d, endDate: r.items[r.items.length - 1].date, location: 'مسجد قُباء ومسار الهجرة', description: 'رحلة على مسار الهجرة النبوية مع لقاءين.',
      published: true, publishedAt: iso(addDays(T, -3)), scheduleVisibility: 'full', scheduleStartedNotified: true, attendanceTakerId: 'u8', coordinationOwnerId: 'u9',
      schedule: { plans: [{ id: nid('pl'), name: 'الخطة أ', items: r.items }, { id: nid('pl'), name: 'الخطة ب', items: altInternal(r.items) }], changes: [] },
      sessions: r.sessions, guests: guests([['د. عادل الحربي', 'محاضر'], ['أ. طارق السيد', 'مدرب ورشة']]),
    }, T);
    t.coordinations = t.coordinations.map((c) => ({ ...c, status: 'done' }));
    trips.push(t);
    doc('t4', 'initial', 'approved', iso(addDays(T, -26)), initialFields('مسجد قُباء'), approvedChain('t4', 's2', addDays(T, -26)));
    doc('t4', 'detailed', 'approved', iso(addDays(T, -9)), detailedFields, approvedChain('t4', 's2', addDays(T, -9)));
    doc('t4', 'budget', 'approved', iso(addDays(T, -9)), {}, approvedChain('t4', 's2', addDays(T, -9)));
    internalBudget('t4');
    // المتابع وثّق أول بندين
    r.items.slice(0, 2).forEach((it, i) => actual.push({ id: nid('ac'), tripId: 't4', refItemId: it.id, followed: i === 0 ? 'A' : 'B', byId: 's5', at: new Date().toISOString() }));
  }

  // 5) رحلة سَلع الداخلية — منشورة (قادمة)
  {
    const d = addDays(T, 9);
    const r = buildRun(at(d, 7), internalTpl('إدارة الوقت للقائد', 'بناء الفريق'), 'أ. فهد القحطاني');
    const t = baseTrip({
      id: 't5', title: 'رحلة سَلع الداخلية: القائد والفريق', type: 'internal', executor: { kind: 'group', groupId: 'g3' },
      startDate: d, endDate: d, location: 'جبل سَلع وحديقة الملك فهد', published: true, publishedAt: iso(addDays(T, -1)), scheduleVisibility: 'hidden', attendanceTakerId: 'u14',
      schedule: { plans: [{ id: nid('pl'), name: 'الخطة أ', items: r.items }, { id: nid('pl'), name: 'الخطة ب', items: altInternal(r.items) }], changes: [] },
      sessions: r.sessions, guests: guests([['أ. فهد القحطاني', 'محاضر'], ['م. باسل يماني', 'مدرب ورشة']]),
    }, T);
    trips.push(t);
    doc('t5', 'initial', 'approved', iso(addDays(T, -14)), initialFields('جبل سَلع'), approvedChain('t5', 's3', addDays(T, -14)));
    doc('t5', 'detailed', 'approved', iso(addDays(T, -3)), detailedFields, approvedChain('t5', 's3', addDays(T, -3)));
    doc('t5', 'budget', 'approved', iso(addDays(T, -3)), {}, approvedChain('t5', 's3', addDays(T, -3)));
    internalBudget('t5');
  }

  // 6) رحلة العقيق الداخلية — بانتظار اعتماد الموازنة
  {
    const d = addDays(T, 20);
    const r = buildRun(at(d, 7), internalTpl('القائد المبادر', 'التفكير الإبداعي'), 'د. منصور العنزي');
    const t = baseTrip({
      id: 't6', title: 'رحلة العقيق الداخلية: وادي المبادرات', type: 'internal', executor: { kind: 'group', groupId: 'g4' },
      startDate: d, endDate: d, location: 'وادي العقيق',
      schedule: { plans: [{ id: nid('pl'), name: 'الخطة أ', items: r.items }, { id: nid('pl'), name: 'الخطة ب', items: [] }], changes: [] },
      sessions: r.sessions, guests: guests([['د. منصور العنزي', 'محاضر'], ['أ. حاتم سراج', 'مدرب ورشة']], false),
    }, T);
    trips.push(t);
    doc('t6', 'initial', 'approved', iso(addDays(T, -3)), initialFields('وادي العقيق'), approvedChain('t6', 's4', addDays(T, -3)));
    doc('t6', 'detailed', 'approved', iso(addDays(T, -1), 9), detailedFields, [ap('s4', 'facilitator', 'approve', iso(addDays(T, -1), 13))].concat([ap(LEADER_ID, 'leader', 'approve', iso(T, 9))]));
    doc('t6', 'budget', 'facilitator_approved', iso(addDays(T, -1), 9), {}, [ap('s4', 'facilitator', 'approve', iso(addDays(T, -1), 13))]);
    internalBudget('t6');
  }

  // 7) رحلة أُحُد الخارجية — الخطة التفصيلية بانتظار الميسّر
  {
    const d = addDays(T, 40);
    const r = externalDays(d, 3, ['القيادة في التاريخ', 'التخطيط الاستراتيجي', 'صناعة الأثر']);
    const t = baseTrip({
      id: 't7', title: 'رحلة أُحُد الخارجية: العُلا', type: 'external', executor: { kind: 'group', groupId: 'g1' },
      startDate: d, endDate: addDays(d, 2), location: 'العُلا', coordinationOwnerId: 'u4',
      schedule: { plans: [{ id: nid('pl'), name: 'الخطة أ', items: r.items }, { id: nid('pl'), name: 'الخطة ب', items: [] }], changes: [] },
      sessions: r.sessions, guests: guests([['د. ناصر الشمري', 'محاضر'], ['أ. ريان فلاته', 'مرشد سياحي']], false),
    }, T);
    t.coordinations = t.coordinations.map((c) => (c.key === 'transport' ? { ...c, status: 'in_progress', note: 'عروض أسعار من 3 شركات نقل' } : c.key === 'housing' ? { ...c, status: 'in_progress', note: 'حجز مبدئي لنُزل تراثي' } : c));
    trips.push(t);
    doc('t7', 'initial', 'approved', iso(addDays(T, -22)), { ...initialFields('العُلا'), titles: 'القيادة في التاريخ · التخطيط الاستراتيجي' }, approvedChain('t7', 's1', addDays(T, -22)));
    doc('t7', 'detailed', 'submitted', iso(addDays(T, -1)), detailedFields);
    doc('t7', 'budget', 'submitted', iso(addDays(T, -1)), {});
    externalBudget('t7');
  }

  // 8) رحلة قُباء الخارجية — الخطة المبسطة أعادها الميسّر
  {
    const d = addDays(T, 55);
    const t = baseTrip({ id: 't8', title: 'رحلة قُباء الخارجية: الطائف', type: 'external', executor: { kind: 'group', groupId: 'g2' }, startDate: d, endDate: addDays(d, 2), location: 'الطائف' }, T);
    trips.push(t);
    doc('t8', 'initial', 'returned_by_facilitator', iso(addDays(T, -2)), { location: 'الطائف · الشفا', titles: 'القيادة والطبيعة', outline: 'رحلة ثلاثة أيام بين الهدا والشفا.' }, [ap('s2', 'facilitator', 'reject', iso(addDays(T, -1)), 'العناوين عامة جداً، حددوا محاور اللقاءات والضيوف المقترحين.')]);
  }

  // 9) رحلة سَلع الخارجية — الخطة المبسطة مسودة
  {
    const d = addDays(T, 75);
    trips.push(baseTrip({ id: 't9', title: 'رحلة سَلع الخارجية: أبها', type: 'external', executor: { kind: 'group', groupId: 'g3' }, startDate: d, endDate: addDays(d, 3), location: 'أبها' }, T));
    doc('t9', 'initial', 'draft', null, { location: 'أبها', titles: '', outline: '' });
  }

  // 10) رحلة العقيق الخارجية — الخطة المبسطة متأخرة عن موعدها
  {
    const d = addDays(T, 18);
    const t = baseTrip({ id: 't10', title: 'رحلة العقيق الخارجية: تبوك', type: 'external', executor: { kind: 'group', groupId: 'g4' }, startDate: addDays(T, 90), endDate: addDays(T, 92), location: 'تبوك' }, T);
    t.deadlines = { initial: addDays(T, -2), detailed: addDays(T, 60) };
    trips.push(t);
    doc('t10', 'initial', 'draft', null, { location: 'تبوك', titles: 'القيادة في البيئات الصعبة', outline: '' });
    void d;
  }

  // 11) رحلة ينبع (فريق عمل خارجية) — مبسطة معتمدة مباشرة من القائد العام
  {
    const d = addDays(T, 110);
    trips.push(baseTrip({ id: 't11', title: 'رحلة ينبع: ختام البرنامج', type: 'external', executor: { kind: 'staff', leaderId: 's1', memberIds: ['s2', 's5'] }, startDate: d, endDate: addDays(d, 2), location: 'ينبع البحر' }, T));
    doc('t11', 'initial', 'approved', iso(addDays(T, -5)), initialFields('ينبع البحر'), [ap(LEADER_ID, 'leader', 'approve', iso(addDays(T, -4)))]);
    doc('t11', 'detailed', 'draft', null, { summary: '', details: '' });
  }

  return { trips, docs, budgets, actual };
}
