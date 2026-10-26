// البيانات التجريبية الكاملة. التواريخ نسبية لتاريخ اليوم حتى تبقى الحالات منطقية.
import { addDays, dateTime, todayISO } from '@/domain/dates';
import { tasksFromTemplates } from '@/domain/workflow';
import type {
  Attendance, AuditEntry, BudgetRequest, Custody, Meeting, DB, FocusMeeting, IndividualMeeting, AvailabilitySlot, Invoice, LifeAspect, Material, Notification,
  PersonalPlan, Survey, Task,
} from '@/domain/types';
import { defaultBudgetCategories, defaultCapacityRules, defaultProgramBudget, defaultSettings, defaultTaskTemplates } from './defaults';
import { buildAccounts, buildCommittees, buildGroups, buildPeople, LEADER_ID } from './seed-people';
import { buildTrips } from './seed-trips';

export const DB_VERSION = 6;

// مولّد أرقام شبه عشوائية ثابت حتى تتكرر البيانات نفسها
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function buildSeed(): DB {
  const rand = rng(42);
  const T = todayISO();
  const nowDate = new Date();
  const iso = (d: string, h = 10, m = 0) => dateTime(d, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`).toISOString();
  let n = 0;
  const id = (p: string) => `${p}_s${++n}`;

  const persons = buildPeople();
  const groups = buildGroups();
  const { committees, memberships } = buildCommittees();
  const settings = defaultSettings(addDays(T, -60), addDays(T, 150));
  settings.trackerId = 's7';
  // البرنامج جارٍ: حفظ القائد العام إعدادات التقييم فأُقفلت
  settings.evaluationLock = { locked: true, at: iso(addDays(T, -58)), by: LEADER_ID };
  const participants = persons.filter((p) => p.kind === 'participant');
  const { trips, docs, budgets, actual } = buildTrips(T, nowDate);

  // ── الحضور ──
  const attendance: Attendance[] = [];
  const mark = (eventKind: Attendance['eventKind'], eventId: string, personId: string, present: boolean, byId: string, when: string) =>
    attendance.push({ id: id('at'), eventKind, eventId, personId, present, byId, at: when });
  const absentPlan = new Set(['u6', 'u12', 'u18', 'u24']); // لم يحضروا لقاء الخطة الشخصية: خططهم مقفلة
  for (const t of trips.filter((x) => ['t1', 't2', 't3'].includes(x.id))) {
    participants.forEach((p) => {
      const present = t.id === 't2' ? !absentPlan.has(p.id) : rand() > 0.12;
      mark('trip', t.id, p.id, present, t.id === 't3' ? 'u2' : 's7', iso(t.startDate, 9));
    });
  }
  // الرحلة الجارية: حضّر المكلّف جزءاً من المشاركين
  participants.slice(0, 16).forEach((p) => mark('trip', 't4', p.id, rand() > 0.1, 'u8', new Date().toISOString()));

  // ── لقاءات التركيز ──
  const topics = ['فن الإلقاء', 'إدارة الوقت', 'الذكاء العاطفي', 'التفكير النقدي', 'العمل التطوعي', 'القراءة المنهجية', 'بناء العادات', 'التخطيط الشخصي'];
  const focusMeetings: FocusMeeting[] = [];
  const crit = settings.presentationCriteria.map((c) => c.key);
  groups.forEach((g, gi) => {
    const m = g.memberIds;
    const mk = (k: number, status: FocusMeeting['status'], dayOffset: number, presenters: string[], extra: Partial<FocusMeeting> = {}): FocusMeeting => {
      const fm: FocusMeeting = {
        id: `f_${g.id}_${k}`,
        groupId: g.id,
        createdBy: g.facilitatorId!,
        title: extra.isUmrah ? 'لقاء العمرة' : `لقاء تركيز: ${topics[(gi * 2 + k) % topics.length]}`,
        isUmrah: false,
        topicMode: 'fixed',
        topicOptions: [],
        topic: extra.isUmrah ? 'العمرة: معانٍ ودروس' : topics[(gi * 2 + k) % topics.length],
        dateMode: 'fixed',
        dateOptions: [],
        date: addDays(T, dayOffset),
        start: '20:00',
        end: '21:00',
        location: ['ديوانية البرنامج', 'قاعة المكتبة المركزية', 'مقهى الرواق'][k % 3],
        presenterMode: presenters.length ? 'members' : 'facilitator',
        presenterIds: presenters,
        presenterAxes: Object.fromEntries(presenters.map((p, i) => [p, i === 0 ? 'المحور الأول: المفهوم' : 'المحور الثاني: التطبيق'])),
        status,
        presenterEvaluations: {},
        ...extra,
      };
      if (status === 'closed') {
        presenters.forEach((p) => (fm.presenterEvaluations[p] = Object.fromEntries(crit.map((c) => [c, 3 + Math.round(rand() * 2)]))));
      }
      if (status === 'closed' || status === 'held') {
        m.forEach((pid) => mark('focus', fm.id, pid, rand() > 0.15 || pid === g.leaderId, g.leaderId!, iso(fm.date!, 20)));
      }
      return fm;
    };
    focusMeetings.push(mk(1, 'closed', -40 + gi, [m[1], m[2]]));
    focusMeetings.push(mk(2, 'closed', -25 + gi, [m[3]]));
    focusMeetings.push(mk(3, gi === 1 ? 'held' : 'closed', -6 + gi, [m[4]]));
    focusMeetings.push(mk(4, 'published', 4 + gi * 2, [m[5]]));
    if (gi === 0) {
      // أُحُد: 8 لقاءات بميزانية (الحد الأعلى)، فالتاسع يُنشأ بلا ميزانية
      focusMeetings.push(mk(5, 'closed', -18, [], { isUmrah: true, presenterMode: 'facilitator', location: 'مكة المكرمة', start: '04:00', end: '12:00' }));
      focusMeetings.push(mk(6, 'closed', -12, [m[0]]));
      focusMeetings.push(mk(7, 'published', 9, [m[1], m[2]]));
      focusMeetings.push(mk(8, 'draft', 20, [m[3]]));
    }
    if (gi === 2) focusMeetings.push(mk(5, 'draft', 30, [], { isUmrah: true, presenterMode: 'facilitator', location: 'مكة المكرمة', start: '04:00', end: '12:00' }));
    if (gi === 3)
      focusMeetings.push(mk(5, 'draft', 12, [m[0], m[1]], { topicMode: 'options', topicOptions: ['ريادة الأعمال', 'العمل الحر', 'المسار المهني'], topic: undefined, dateMode: 'options', dateOptions: [addDays(T, 12), addDays(T, 14)] }));
  });
  // ضيف في لقاء
  const fGuest = focusMeetings.find((f) => f.id === 'f_g2_4')!;
  Object.assign(fGuest, { presenterMode: 'guest', presenterIds: [], presenterAxes: {}, guestName: 'م. سامر خياط (من خارج البرنامج)', title: 'لقاء تركيز: ريادة الأعمال الاجتماعية', topic: 'ريادة الأعمال الاجتماعية' });

  // ── اللقاءات الفردية ──
  const slots: AvailabilitySlot[] = [];
  const individualMeetings: IndividualMeeting[] = [];
  groups.forEach((g, gi) => {
    g.memberIds.forEach((pid, k) => {
      const doneCount = (gi + k) % 5; // 0..4
      for (let i = 0; i < doneCount; i++) {
        const d = addDays(T, -45 + i * 10 + k);
        individualMeetings.push({
          id: id('im'), facilitatorId: g.facilitatorId!, participantId: pid, date: d, start: '17:00', end: '17:45', origin: i % 2 ? 'participant_request' : 'open_invite', status: 'done',
          notesOnPlan: i === 0 ? 'بداية جيدة، الرؤية في الجانب الصحي تحتاج تحديداً أكثر.' : 'تقدّم ملحوظ في الجانب الروحي، نركّز الشهر القادم على المالي.',
          notesOnMeeting: 'لقاء مثمر وحضور في الوقت.',
        });
      }
    });
    // أوقات إتاحة قادمة
    for (let i = 0; i < 6; i++) {
      const d = addDays(T, 1 + Math.floor(i / 2) * 2);
      const start = i % 2 ? '18:00' : '17:00';
      const end = i % 2 ? '18:45' : '17:45';
      const slot: AvailabilitySlot = { id: id('sl'), facilitatorId: g.facilitatorId!, date: d, start, end, invite: i === 5 ? g.memberIds[3] : 'open' };
      if (i === 0) {
        slot.bookedBy = g.memberIds[1];
        individualMeetings.push({ id: id('im'), facilitatorId: g.facilitatorId!, participantId: g.memberIds[1], slotId: slot.id, date: d, start, end, origin: 'open_invite', status: 'booked' });
      }
      slots.push(slot);
    }
  });
  individualMeetings.push({ id: id('im'), facilitatorId: 's1', participantId: 'u5', date: addDays(T, 5), start: '16:00', end: '16:45', origin: 'participant_request', status: 'requested', requestNote: 'أحتاج استشارة في الجانب المالي قبل نهاية الشهر' });

  // ── الخطط الشخصية ──
  const visions: Record<string, string> = {
    spiritual: 'أن أكون محافظاً على الصلوات في المسجد وورد يومي من القرآن',
    health: 'لياقة بدنية جيدة ونوم منتظم',
    family: 'علاقة أقرب بوالديّ وإخوتي',
    financial: 'ادخار 20% من دخلي الشهري',
    social: 'دائرة أصدقاء إيجابية ومشاركة تطوعية منتظمة',
    career: 'تخرج بمعدل ممتاز وتدريب صيفي في مجالي',
  };
  const stepTitles: Record<string, string[]> = {
    spiritual: ['ورد يومي صفحتين بعد الفجر', 'حضور درس أسبوعي', 'صيام الاثنين والخميس'],
    health: ['المشي 30 دقيقة يومياً', 'النوم قبل 11 مساءً', 'تقليل المشروبات الغازية'],
    family: ['زيارة أسبوعية للجدة', 'جلسة شهرية مع الوالد'],
    financial: ['تسجيل المصروفات يومياً', 'فتح حساب ادخار', 'قراءة كتاب في الثقافة المالية'],
    social: ['التطوع شهرياً في جمعية', 'التواصل مع صديق قديم كل أسبوع'],
    career: ['ساعتان مذاكرة يومياً', 'التقديم على تدريب صيفي', 'دورة في مهارات العرض'],
  };
  const personalPlans: PersonalPlan[] = participants.map((p, pi) => {
    if (absentPlan.has(p.id)) return { participantId: p.id, aspects: [] };
    const filled = pi % 4 !== 3; // بعضهم لم يكمل الخطة بعد
    const aspects: LifeAspect[] = (['spiritual', 'health', 'family', 'financial', 'social', 'career'] as const).map((key, ai) => ({
      key,
      level: 3 + Math.floor(rand() * 6),
      vision: filled ? visions[key] : ai < 2 ? visions[key] : '',
      steps: filled || ai < 2
        ? stepTitles[key].map((title, si) => {
            const startDate = addDays(T, -20 + si * 12 + ai);
            const status: 'pending' | 'started' | 'done' | 'challenged' = startDate > T ? 'pending' : rand() > 0.75 ? 'pending' : rand() > 0.5 ? 'done' : rand() > 0.3 ? 'started' : 'challenged';
            return {
              id: id('st'), title, startDate,
              importance: 'تساعدني على الثبات وتحقيق الرؤية تدريجياً.',
              evidence: key === 'spiritual' ? '﴿وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا﴾' : 'دراسات تشير إلى أثر العادات الصغيرة المتكررة في تغيير السلوك.',
              howWhen: 'أبدأ من الأسبوع القادم، وأربطها بعادة قائمة.',
              status,
              followUps: status === 'challenged' ? [{ id: id('fu'), at: iso(startDate, 21), started: true, progress: 'بدأت لكن انقطعت أسبوع الاختبارات', challenge: 'ضغط الاختبارات', overcome: 'تقليل المدة مؤقتاً', needHelp: true }] : status === 'done' || status === 'started' ? [{ id: id('fu'), at: iso(startDate, 21), started: true, progress: 'بدأت ومستمر' }] : [],
            };
          })
        : [],
    }));
    return { participantId: p.id, aspects, updatedAt: iso(addDays(T, -3)) };
  });

  // ── الاستبيانات ──
  const surveys: Survey[] = [];
  const addPrePost = (ctx: Survey['context'], title: string, mandatory: boolean, preOpens: string, postOpens: string | null, qs: [string, string][], respondents: string[], postRespondents: string[]) => {
    const preId = id('sv');
    const pre: Survey = {
      id: preId, title: `${title} — قبلي`, context: ctx, phase: 'pre', mandatory, opensAt: preOpens, createdBy: LEADER_ID,
      questions: qs.map(([q], i) => ({ id: `${preId}_q${i}`, text: q, type: 'scale' })),
      responses: respondents.map((pid) => ({ id: id('rs'), personId: pid, answers: Object.fromEntries(qs.map((_, i) => [`${preId}_q${i}`, String(1 + Math.floor(rand() * 3))])), at: preOpens })),
    };
    surveys.push(pre);
    if (!postOpens) return;
    const postId = id('sv');
    const general = [
      { id: `${postId}_g1`, text: 'ما مدى رضاك عن اللقاء بشكل عام؟', type: 'scale' as const, isGeneral: true },
      { id: `${postId}_g2`, text: 'ما مدى رضاك عن المادة العلمية؟', type: 'scale' as const, isGeneral: true },
      { id: `${postId}_g3`, text: 'ما أبرز ما استفدته؟', type: 'text' as const, isGeneral: true },
    ];
    surveys.push({
      id: postId, title: `${title} — بعدي`, context: ctx, phase: 'post', preSurveyId: preId, mandatory, opensAt: postOpens, createdBy: LEADER_ID,
      questions: [...qs.map(([, q], i) => ({ id: `${postId}_q${i}`, text: q, type: 'scale' as const, pairsWith: `${preId}_q${i}` })), ...general],
      responses: postRespondents.map((pid) => ({
        id: id('rs'), personId: pid, at: postOpens,
        answers: { ...Object.fromEntries(qs.map((_, i) => [`${postId}_q${i}`, String(3 + Math.floor(rand() * 3))])), [`${postId}_g1`]: String(4 + Math.round(rand())), [`${postId}_g2`]: String(3 + Math.round(rand() * 2)), [`${postId}_g3`]: 'وضوح الرؤية وأهمية التخطيط' },
      })),
    });
  };
  const ids = participants.map((p) => p.id);
  addPrePost({ kind: 'trip', id: 't1' }, 'استبيان اللقاء التطويري الأول', true, iso(addDays(T, -53)), iso(addDays(T, -52), 18), [['هل تعرف معنى القيادة الشبابية؟', 'بعد حضورك، كيف تعرّف القيادة الشبابية؟'], ['ما مدى معرفتك بنقاط قوتك؟', 'بعد الورشة، إلى أي حد تعرف نقاط قوتك؟']], ids, ids.slice(0, 21));
  addPrePost({ kind: 'trip', id: 't2' }, 'استبيان عجلة الحياة', true, iso(addDays(T, -31)), iso(addDays(T, -30), 18), [['هل تعرف ما هي عجلة الحياة؟', 'بعد حضورك، بماذا تعرّف عجلة الحياة؟'], ['هل لديك خطة شخصية مكتوبة؟', 'إلى أي حد أصبحت خطتك الشخصية واضحة؟'], ['هل تعرف كيف تحوّل الرؤية لخطوات؟', 'بعد اللقاء، ما مدى قدرتك على تحويل الرؤية لخطوات؟']], ids.filter((x) => !absentPlan.has(x)), ids.filter((x) => !absentPlan.has(x)).slice(0, 15));
  addPrePost({ kind: 'trip', id: 't3' }, 'استبيان رحلة أُحُد الداخلية', true, iso(addDays(T, -17)), iso(addDays(T, -16), 18), [['ما مدى معرفتك بأحداث غزوة أُحُد؟', 'بعد الرحلة، ما مدى إلمامك بدروس غزوة أُحُد؟'], ['هل تستطيع اتخاذ قرار سريع تحت الضغط؟', 'بعد الورشة، كيف تقيّم قدرتك على اتخاذ القرار تحت الضغط؟']], ids.slice(0, 20), ids.slice(0, 18));
  addPrePost({ kind: 'trip', id: 't4' }, 'استبيان رحلة قُباء الداخلية', true, iso(addDays(T, -1)), null, [['ما معرفتك بمفهوم قيادة الذات؟', 'بعد الرحلة، كيف تعرّف قيادة الذات؟']], ids.slice(0, 9), []);
  addPrePost({ kind: 'trip', id: 't5' }, 'استبيان رحلة سَلع الداخلية', true, iso(addDays(T, -1)), null, [['كيف تدير وقتك حالياً؟', 'بعد الرحلة، ما الذي تغيّر في إدارتك لوقتك؟']], [], []);
  addPrePost({ kind: 'focus', id: 'f_g1_3' }, 'استبيان لقاء التركيز', false, iso(addDays(T, -7)), iso(addDays(T, -6), 21), [['ما معرفتك بالموضوع؟', 'بعد اللقاء، ما معرفتك بالموضوع؟']], ['u1', 'u2', 'u3'], ['u1', 'u2']);
  surveys.push({ id: 'sv_prog', title: 'استبيان الرضا العام عن البرنامج (منتصف البرنامج)', context: { kind: 'program' }, phase: 'post', mandatory: false, opensAt: iso(addDays(T, -2)), createdBy: LEADER_ID, questions: [{ id: 'sv_prog_q1', text: 'ما مدى رضاك عن البرنامج حتى الآن؟', type: 'scale', isGeneral: true }, { id: 'sv_prog_q2', text: 'ما أكثر جزء استفدت منه؟', type: 'choice', options: ['الرحلات', 'لقاءات التركيز', 'اللقاءات الفردية', 'الخطة الشخصية'], isGeneral: true }, { id: 'sv_prog_q3', text: 'اقتراحاتك للتحسين', type: 'text', isGeneral: true }], responses: [] });

  // ── المكتبة ──
  const materials: Material[] = [];
  const mat = (m: Partial<Material> & Pick<Material, 'title' | 'type' | 'uploaderId' | 'origin'>) =>
    materials.push({ id: id('mt'), url: 'https://example.com/material', revealMode: 'auto', revealed: true, audience: { kind: 'all' }, at: iso(addDays(T, -10)), ...m });
  trips.forEach((t) => {
    if (!['t1', 't2', 't3', 't4'].includes(t.id)) return;
    t.sessions.forEach((s, i) => {
      const endAt = dateTime(s.date, s.end).toISOString();
      // الرحلة الجارية: مادة اللقاء الأول تظهر تلقائياً بعد وقته، ومادة الثاني مخفية حتى يفتحها الرافع
      const manual = t.id === 't4' && i === 1;
      mat({ title: `عرض: ${s.title}`, type: i ? 'pdf' : 'video', uploaderId: t.executor.kind === 'staff' ? t.executor.leaderId : t.id === 't3' ? 'u3' : 'u9', origin: 'session', tripId: t.id, sessionId: s.id, revealMode: manual ? 'manual' : 'auto', revealAt: endAt, revealed: !manual, at: endAt, description: `مادة مخصصة للقاء "${s.title}" في ${t.title}` });
    });
  });
  mat({ title: 'كتاب: العادات الذرية (ملخص)', type: 'pdf', uploaderId: 's2', origin: 'general', pointsRequested: true, pointsStatus: 'approved', description: 'ملخص عملي لبناء العادات.' });
  mat({ title: 'محاضرة: أهمية المال في الإسلام', type: 'video', uploaderId: 's1', origin: 'general', pointsRequested: true, pointsStatus: 'pending' });
  mat({ title: 'دليل كتابة الخطة الشخصية', type: 'pdf', uploaderId: LEADER_ID, origin: 'attached', description: 'مرفق من القائد العام لكل المشاركين' });
  mat({ title: 'قالب تقرير الرحلة الختامي', type: 'file', uploaderId: 's3', origin: 'attached', audience: { kind: 'group', groupId: 'g3' } });
  mat({ title: 'مقال: القائد الخادم', type: 'link', uploaderId: 's4', origin: 'general', pointsRequested: true, pointsStatus: 'approved' });
  mat({ title: 'مادة قبلية إلزامية: تاريخ قُباء', type: 'pdf', uploaderId: 'u9', origin: 'pre_trip', tripId: 't4', mandatory: true });
  mat({ title: 'مادة قبلية اختيارية: خريطة مسار الهجرة', type: 'link', uploaderId: 'u10', origin: 'pre_trip', tripId: 't4', mandatory: false });
  mat({ title: 'مادة قبلية: مهارات إدارة الوقت', type: 'video', uploaderId: 'u15', origin: 'pre_trip', tripId: 't5', mandatory: true, pointsRequested: true, pointsStatus: 'pending' });
  mat({ title: 'ملاحظات اللقاء الفردي: الجانب المالي', type: 'pdf', uploaderId: 's1', origin: 'individual', audience: { kind: 'person', personId: 'u2' } });
  mat({ title: 'تسجيل لقاء التركيز: فن الإلقاء', type: 'video', uploaderId: 'u2', origin: 'focus', focusMeetingId: 'f_g1_1', audience: { kind: 'group', groupId: 'g1' } });
  const materialViews = participants.flatMap((p, pi) =>
    materials.filter((_, mi) => (pi + mi) % 3 === 0).map((m, k) => ({ id: id('mv'), personId: p.id, materialId: m.id, status: (k % 4 === 3 ? 'skipped' : 'viewed') as 'viewed' | 'skipped', at: iso(addDays(T, -2)) })),
  );

  // ── المالية ──
  const programBudget = defaultProgramBudget(); // لم يُعدّها المسؤول المالي بعد: يظهر له المعالج أول دخول
  const budgetRequests: BudgetRequest[] = [];
  const reqEv = (byId: string, action: BudgetRequest['history'][number]['action'], daysAgo: number, note?: string) => ({ at: iso(addDays(T, -daysAgo)), byId, action, note });
  const req = (r: Partial<BudgetRequest> & Pick<BudgetRequest, 'ownerKind' | 'ownerId' | 'spendKind' | 'requestedBy' | 'amount' | 'allocated' | 'status'>, history: BudgetRequest['history']) => {
    const full: BudgetRequest = { id: id('br'), detailed: !!r.lines?.length, lines: [], history, submittedAt: history[0]?.at, ...r };
    budgetRequests.push(full);
    return full.id;
  };
  const per = programBudget.focus.perItem;
  const tripReq = (tripId: string, by: string, kind: 'opening' | 'internal_trip' | 'external_trip', allocated: number, status: BudgetRequest['status'], history: BudgetRequest['history']) => {
    const lines = budgets[tripId];
    return req({ ownerKind: 'trip', ownerId: tripId, spendKind: kind, requestedBy: by, lines, amount: lines.reduce((s, l) => s + l.qty * l.price, 0), allocated, status }, history);
  };
  const rT1 = tripReq('t1', 's2', 'opening', programBudget.opening, 'approved', [reqEv('s2', 'submit', 66), reqEv('s5', 'finance_approve', 65)]);
  const rT2 = tripReq('t2', 's3', 'internal_trip', 3500, 'approved', [reqEv('s3', 'submit', 42), reqEv('s5', 'finance_approve', 41)]);
  const rT3 = tripReq('t3', 'u1', 'internal_trip', 3500, 'approved', [reqEv('u1', 'submit', 27), reqEv('s5', 'finance_approve', 26)]);
  const rT4 = tripReq('t4', 'u7', 'internal_trip', 3500, 'approved', [reqEv('u7', 'submit', 12), reqEv('s1', 'finance_approve', 11)]);
  const rT5 = tripReq('t5', 'u13', 'internal_trip', 3500, 'approved', [reqEv('u13', 'submit', 4), reqEv('s5', 'finance_approve', 2)]);
  tripReq('t6', 'u19', 'internal_trip', 3500, 'pending_finance', [reqEv('u19', 'submit', 1)]);
  tripReq('t7', 'u1', 'external_trip', programBudget.externalTrip.perItem, 'pending_leader', [reqEv('u1', 'submit', 1, 'السكن في العُلا أغلى من المتوقع')]);
  const rUmrah = req({ ownerKind: 'focus', ownerId: 'f_g1_5', spendKind: 'focus', requestedBy: 's1', amount: 1440, allocated: programBudget.umrahPerGroup, status: 'approved' }, [reqEv('s1', 'submit', 24), reqEv('s5', 'finance_approve', 23)]);
  const rF23 = req({ ownerKind: 'focus', ownerId: 'f_g2_3', spendKind: 'focus', requestedBy: 's2', amount: 150, allocated: per, status: 'approved' }, [reqEv('s2', 'submit', 9), reqEv('s1', 'finance_approve', 8)]);
  req({ ownerKind: 'focus', ownerId: 'f_g1_4', spendKind: 'focus', requestedBy: 's1', amount: 150, allocated: per, status: 'approved' }, [reqEv('s1', 'submit', 3), reqEv('s5', 'finance_approve', 2)]);
  req({ ownerKind: 'focus', ownerId: 'f_g4_5', spendKind: 'focus', requestedBy: 's4', amount: 140, allocated: per, status: 'pending_finance', note: 'ضيافة ومطبوعات للورشة' }, [reqEv('s4', 'submit', 0)]);
  req({ ownerKind: 'focus', ownerId: 'f_g3_5', spendKind: 'focus', requestedBy: 's3', amount: 1860, allocated: programBudget.umrahPerGroup, status: 'pending_leader', note: 'باص أكبر لأن عدد الحضور 14 مع المرافقين' }, [reqEv('s3', 'submit', 1)]);
  req({ ownerKind: 'focus', ownerId: 'f_g2_4', spendKind: 'focus', requestedBy: 's2', amount: 400, allocated: per, status: 'rejected' }, [reqEv('s2', 'submit', 5), reqEv('p_lead', 'leader_reject', 4, 'مكافأة الضيف الخارجي لا تُصرف من لقاءات التركيز. أعد الطلب بالضيافة فقط.')]);

  const custodies: Custody[] = [];
  const invoices: Invoice[] = [];
  const inv = (custodyId: string, lines: [string, string, number][], status: Invoice['status'], uploadedBy: string, rejectReason?: string) =>
    invoices.push({ id: id('iv'), custodyId, total: lines.reduce((s, l) => s + l[2], 0), lines: lines.map(([categoryId, description, amount]) => ({ id: id('il'), categoryId, description, amount })), image: 'invoice.jpg', uploadedBy, status, rejectReason, at: iso(addDays(T, -1)) });
  const closedCustody = (cid: string, requestId: string, tripId: string, recipient: string, total: number, d: string) => {
    custodies.push({ id: cid, requestId, ownerKind: 'trip', ownerId: tripId, recipientId: recipient, total, iban: 'SA0380000000608010167519', status: 'closed', createdAt: iso(addDays(d, -8)), closedAt: iso(addDays(d, 9)),
      installments: [{ id: id('in'), amount: total, dueDate: addDays(d, -5), status: 'received', transferReceipt: 'receipt.pdf', transferredAt: iso(addDays(d, -5)), confirmedAt: iso(addDays(d, -5), 15) }],
      refund: { amount: 80, receipt: 'refund.pdf', at: iso(addDays(d, 6)) } });
    inv(cid, [['bc_transport', 'باص كوستر', 1000]], 'accepted', recipient);
    inv(cid, [['bc_food', 'غداء الرحلة', 1080]], 'accepted', recipient);
    inv(cid, [['bc_hosting', 'قهوة وتمر', 200], ['bc_food', 'ماء ووجبات خفيفة', 80]], 'accepted', recipient);
    inv(cid, [['bc_guests', 'مكافأة المحاضر', 500]], 'accepted', recipient);
    inv(cid, [['bc_tickets', 'رسوم دخول', 300]], 'accepted', recipient);
  };
  closedCustody('cu_t1', rT1, 't1', 's2', 3240, addDays(T, -52));
  closedCustody('cu_t3', rT3, 't3', 'u1', 3240, addDays(T, -16));
  // لقاء الخطة الشخصية: قيد الإغلاق
  custodies.push({ id: 'cu_t2', requestId: rT2, ownerKind: 'trip', ownerId: 't2', recipientId: 's3', total: 3240, iban: 'SA4420000001234567891234', status: 'closing', createdAt: iso(addDays(T, -38)),
    installments: [{ id: id('in'), amount: 3240, dueDate: addDays(T, -35), status: 'received', transferReceipt: 'receipt.pdf', transferredAt: iso(addDays(T, -35)), confirmedAt: iso(addDays(T, -35), 16) }] });
  inv('cu_t2', [['bc_transport', 'نقل المشاركين', 1000]], 'accepted', 's3');
  inv('cu_t2', [['bc_food', 'غداء', 1150]], 'pending', 's3');
  inv('cu_t2', [['bc_guests', 'مكافأة المدرب', 500]], 'pending', 's3');
  // الرحلة الجارية: عهدة بدفعتين وفاتورة بسطرين مرفوضة
  custodies.push({ id: 'cu_t4', requestId: rT4, ownerKind: 'trip', ownerId: 't4', recipientId: 'u7', total: 3240, iban: 'SA1180000123456789012345', status: 'active', createdAt: iso(addDays(T, -8)),
    installments: [
      { id: id('in'), amount: 2000, dueDate: addDays(T, -5), condition: 'بعد اعتماد الموازنة', status: 'received', transferReceipt: 'receipt-1.pdf', transferredAt: iso(addDays(T, -5)), confirmedAt: iso(addDays(T, -5), 14) },
      { id: id('in'), amount: 1240, dueDate: T, condition: 'بعد بداية الرحلة', status: 'awaiting_transfer' },
    ] });
  inv('cu_t4', [['bc_transport', 'عربون الباص', 500]], 'accepted', 'u7');
  inv('cu_t4', [['bc_hosting', 'قهوة وتمر', 180], ['bc_food', 'وجبات خفيفة', 110]], 'rejected', 'u7', 'الفاتورة غير واضحة ولا يظهر فيها الرقم الضريبي');
  inv('cu_t4', [['bc_tickets', 'رسوم دخول', 320]], 'pending', 'u8');
  // رحلة سَلع: صُرفت وتنتظر الآيبان
  custodies.push({ id: 'cu_t5', requestId: rT5, ownerKind: 'trip', ownerId: 't5', recipientId: 'u13', total: 3240, status: 'setup', createdAt: iso(addDays(T, -1)),
    installments: [{ id: id('in'), amount: 2500, dueDate: addDays(T, 2), condition: 'بعد اعتماد الموازنة', status: 'awaiting_iban' }, { id: id('in'), amount: 740, dueDate: addDays(T, 9), condition: 'بعد بداية الرحلة', status: 'scheduled' }] });
  // عهدة لقاء العمرة (ميسّر أُحُد): مغلقة
  custodies.push({ id: 'cu_umrah', requestId: rUmrah, ownerKind: 'focus', ownerId: 'f_g1_5', recipientId: 's1', total: 1440, iban: 'SA0380000000608010167519', status: 'closed', createdAt: iso(addDays(T, -22)), closedAt: iso(addDays(T, -12)),
    installments: [{ id: id('in'), amount: 1440, dueDate: addDays(T, -20), status: 'received', transferReceipt: 'r.pdf', transferredAt: iso(addDays(T, -20)), confirmedAt: iso(addDays(T, -20)) }] });
  inv('cu_umrah', [['bc_transport', 'باص كوستر', 1200], ['bc_food', 'إفطار', 240]], 'accepted', 's1');
  // عهدة لقاء تركيز عادي
  custodies.push({ id: 'cu_f22', requestId: rF23, ownerKind: 'focus', ownerId: 'f_g2_3', recipientId: 's2', total: 150, iban: 'SA5500000000000000000001', status: 'active', createdAt: iso(addDays(T, -6)),
    installments: [{ id: id('in'), amount: 150, dueDate: addDays(T, -5), status: 'received', transferReceipt: 'r.pdf', transferredAt: iso(addDays(T, -5)), confirmedAt: iso(addDays(T, -5)) }] });
  inv('cu_f22', [['bc_hosting', 'ضيافة اللقاء', 165]], 'pending', 's2');

  const audit: AuditEntry[] = [
    { id: 'au1', at: iso(addDays(T, -60)), byId: 's5', action: 'منح صلاحية', detail: 'عرض الميزانية — خالد العمري' },
    { id: 'au2', at: iso(addDays(T, -60)), byId: 's5', action: 'منح صلاحية', detail: 'الموافقة ضمن المرصود — خالد العمري' },
    { id: 'au3', at: iso(addDays(T, -60)), byId: 's5', action: 'منح صلاحية', detail: 'مراجعة الفواتير — خالد العمري' },
    { id: 'au4', at: iso(addDays(T, -8)), byId: 's5', action: 'تحويل دفعة', detail: 'رحلة قُباء الداخلية — 2000 ر.س إلى يوسف' },
    { id: 'au5', at: iso(addDays(T, -2)), byId: 's5', action: 'موافقة على طلب ميزانية', detail: 'رحلة سَلع الداخلية — 3240 ر.س' },
  ];

  // ── الاجتماعات ──
  const staffAll = persons.filter((p) => p.kind === 'staff').map((p) => p.id);
  const leadersAll = groups.map((g) => g.leaderId!).filter(Boolean);
  const meetings: Meeting[] = [
    { id: 'mt1', title: 'اجتماع فريق العمل الأسبوعي', kind: 'periodic', recurrence: 'weekly', withGroupLeaders: false, createdBy: LEADER_ID, ownerId: LEADER_ID, date: addDays(T, -6), start: '21:00', end: '22:00', location: 'مقر البرنامج', inviteeIds: staffAll, agenda: ['مراجعة تقدم الرحلات', 'جاهزية رحلة قُباء', 'المهام المتأخرة'], status: 'closed', attendeeIds: staffAll.slice(0, 5), discussion: 'استعرض الفريق تقدم الرحلات، وتأخر رفع خطة العقيق الخارجية.', decisions: ['التواصل مع قائد العقيق لرفع الخطة المبسطة', 'اعتماد موعد لقاء العمرة لسَلع بعد اعتماد الميزانية'], outputs: ['قائمة المتابعة الأسبوعية'], createdAt: iso(addDays(T, -9)) },
    { id: 'mt2', title: 'اجتماع فريق العمل الأسبوعي', kind: 'periodic', recurrence: 'weekly', withGroupLeaders: false, createdBy: LEADER_ID, ownerId: LEADER_ID, date: addDays(T, 1), start: '21:00', end: '22:00', location: 'مقر البرنامج', inviteeIds: staffAll, agenda: ['تقييم رحلة قُباء', 'طلبات الميزانية المعلقة'], status: 'planned', attendeeIds: [], decisions: [], outputs: [], createdAt: iso(addDays(T, -6)) },
    { id: 'mt3', title: 'تنسيق الرحلات الخارجية مع قادة المجموعات', kind: 'urgent', recurrence: 'none', withGroupLeaders: true, createdBy: 's2', ownerId: 's2', date: addDays(T, 3), start: '20:00', end: '21:00', location: 'قاعة المكتبة المركزية', inviteeIds: [...leadersAll, 's1', 's2', 's3', 's4'], agenda: ['المواعيد النهائية للخطط', 'الموازنات التفصيلية', 'أسئلة القادة'], status: 'planned', attendeeIds: [], decisions: [], outputs: [], allocated: 300, createdAt: iso(addDays(T, -1)) },
    { id: 'mt4', title: 'اجتماع اللجنة المالية', kind: 'urgent', recurrence: 'none', withGroupLeaders: false, createdBy: 's5', ownerId: 's5', date: addDays(T, -1), start: '19:00', end: '20:00', location: 'عن بعد', inviteeIds: ['s5', 's1', 's3', LEADER_ID], agenda: ['اعتماد مبالغ المرصود', 'العهد المفتوحة'], status: 'held', attendeeIds: ['s5', 's1', 's3'], decisions: [], outputs: [], createdAt: iso(addDays(T, -3)) },
  ];

  const fees = participants.map((p, i) => ({ personId: p.id, amount: settings.feeAmount, paid: i % 7 !== 3 && i % 5 !== 4, paidAt: i % 7 !== 3 && i % 5 !== 4 ? addDays(T, -58 + i) : undefined }));

  // ── المهام ──
  const tasks: Task[] = [];
  const taskTemplates = defaultTaskTemplates('c_fin', 'c_media');
  const dbForTpl = { taskTemplates, memberships } as unknown as DB;
  trips.forEach((t) => {
    const auto = tasksFromTemplates(dbForTpl, t, LEADER_ID).map((x, i) => ({ ...x, id: `tk_${t.id}_${i}` }));
    auto.forEach((x) => {
      const closedTrip = ['t1', 't3'].includes(t.id);
      if (closedTrip || (t.id === 't2' && x.tag !== 'custody_close')) {
        x.status = 'done';
        x.proof = x.proofType === 'link' ? 'https://x.com/saql/status/1' : x.proofType === 'file' ? 'نشرة.pdf' : x.proofType === 'text' ? 'تم التحويل' : undefined;
        x.doneAt = iso(addDays(t.endDate, 2));
      }
      if (t.id === 't4' && x.tag === 'custody_issue') { x.status = 'done'; x.proof = 'حُوّلت الدفعة الأولى'; }
      if (t.id === 't5' && x.tag === 'custody_issue') x.status = 'in_progress';
      if (t.id === 't4' && x.tag === 'doc_file') x.assigneeId = 's4';
    });
    tasks.push(...auto);
  });
  const task = (t: Partial<Task> & Pick<Task, 'title' | 'scope' | 'assigneeId' | 'createdBy' | 'dueDate'>) =>
    tasks.push({ id: id('tk'), status: 'new', proofType: 'none', createdAt: iso(addDays(T, -5)), ...t });
  // مهام تجهيز الرحلة (يسندها قائد المجموعة)
  task({ title: 'التنسيق مع شركة النقل', scope: 'trip_team', tripId: 't4', assigneeId: 'u9', createdBy: 'u7', dueDate: addDays(T, -3), status: 'done', proofType: 'file', proof: 'عقد-النقل.pdf', mandatory: true });
  task({ title: 'الضيافة يوم الرحلة', scope: 'trip_team', tripId: 't4', assigneeId: 'u10', createdBy: 'u7', dueDate: T, status: 'in_progress', mandatory: true });
  task({ title: 'متابعة الضيوف وتأكيد الحضور', scope: 'trip_team', tripId: 't4', assigneeId: 'u11', createdBy: 'u7', dueDate: addDays(T, -1), status: 'done' });
  task({ title: 'الشؤون المالية: جمع الفواتير', scope: 'trip_team', tripId: 't4', assigneeId: 'u12', createdBy: 'u7', dueDate: addDays(T, 2), proofType: 'text' });
  task({ title: 'حجز الموقع وتصريح الدخول', scope: 'trip_team', tripId: 't5', assigneeId: 'u15', createdBy: 'u13', dueDate: addDays(T, 3), status: 'in_progress', proofType: 'file', mandatory: true });
  task({ title: 'إعداد المادة القبلية', scope: 'trip_team', tripId: 't5', assigneeId: 'u16', createdBy: 'u13', dueDate: addDays(T, -1) });
  task({ title: 'عروض أسعار السكن في العُلا', scope: 'trip_team', tripId: 't7', assigneeId: 'u4', createdBy: 'u1', dueDate: addDays(T, 10), status: 'in_progress', proofType: 'file' });
  task({ title: 'تحديث العناوين حسب ملاحظات الميسّر', scope: 'trip_team', tripId: 't8', assigneeId: 'u8', createdBy: 'u7', dueDate: addDays(T, 2) });
  // مهام عامة في الإدارة
  task({ title: 'تجهيز تقرير منتصف البرنامج', scope: 'general', assigneeId: 's5', createdBy: LEADER_ID, dueDate: addDays(T, 12), status: 'in_progress', proofType: 'file', description: 'يتضمن نتائج الاستبيانات القبلية والبعدية' });
  task({ title: 'التواصل مع قائد العقيق لرفع الخطة المبسطة', scope: 'general', meetingId: 'mt1', assigneeId: 's4', createdBy: LEADER_ID, dueDate: addDays(T, -1), status: 'done', doneAt: iso(addDays(T, -2)) });
  task({ title: 'التواصل مع الجهة الداعمة', scope: 'general', assigneeId: 's1', createdBy: LEADER_ID, dueDate: addDays(T, -4), proofType: 'text' });
  task({ title: 'مراجعة قائمة الضيوف للرحلات الخارجية', scope: 'general', assigneeId: 's3', createdBy: LEADER_ID, dueDate: addDays(T, 20) });
  task({ title: 'تصميم بطاقات المجموعات', scope: 'committee', committeeId: 'c_media', assigneeId: 'u9', createdBy: 's2', dueDate: addDays(T, 6), proofType: 'link', status: 'in_progress' });
  task({ title: 'رابط مجلد صور رحلة قُباء على Google Drive', scope: 'committee', committeeId: 'c_media', tripId: 't4', assigneeId: 's4', createdBy: 's2', dueDate: addDays(T, 1), proofType: 'link', tag: 'photos' });
  task({ title: 'تحديث سجل الرسوم', scope: 'committee', committeeId: 'c_fin', assigneeId: 's3', createdBy: 's1', dueDate: addDays(T, -2), status: 'in_progress' });
  // مشارك لمشارك في مجموعته
  task({ title: 'تجهيز عرض لقاء التركيز القادم', scope: 'group', groupId: 'g1', assigneeId: 'u6', createdBy: 'u1', dueDate: addDays(T, 3), proofType: 'file' });

  // ── الإشعارات ──
  const notifications: Notification[] = [];
  const notify = (toId: string, type: Notification['type'], title: string, link: string, hoursAgo: number, read = false) =>
    notifications.push({ id: id('nt'), toId, type, title, link, at: new Date(nowDate.getTime() - hoursAgo * 3600000).toISOString(), read, emailed: settings.importantNotifications.includes(type) });
  [...ids, ...persons.filter((p) => p.kind === 'staff').map((p) => p.id)].forEach((pid) => notify(pid, 'schedule_started', 'بدأ جدول رحلة قُباء الداخلية', '/app/trips/t4', 3));
  ids.forEach((pid) => notify(pid, 'trip_published', 'نُشرت رحلة سَلع الداخلية', '/app/trips/t5', 26, true));
  notify(LEADER_ID, 'budget_request', 'ميزانية رحلة العُلا تتجاوز المرصود وتنتظر قرارك', '/app/finance', 5);
  notify(LEADER_ID, 'committee_member_request', 'طلب إضافة "زياد العتيبي" للجنة الإعلامية', '/app/committees/c_media', 20);
  notify(LEADER_ID, 'deadline_passed', 'فات موعد رفع الخطة المبسطة لرحلة العقيق الخارجية', '/app/trips/t10', 30);
  notify('s1', 'approval_submitted', 'رفع قائد أُحُد الخطة التفصيلية لرحلة العُلا', '/app/trips/t7', 22);
  notify('s5', 'budget_request', 'طلب ميزانية رحلة العقيق الداخلية (ضمن المرصود)', '/app/finance', 25);
  notify(LEADER_ID, 'budget_request', 'طلب ميزانية لقاء العمرة لسَلع يتجاوز المرصود', '/app/finance', 20);
  notify('s5', 'general', 'أعدّ ميزانية البرنامج لتبدأ استقبال الطلبات', '/app/finance', 2);
  notify('s2', 'leader_absent_focus', 'قائد مجموعة قُباء لم يؤكد حضوره للقاء التركيز', '/app/focus/f_g2_3', 140, true);
  notify('u7', 'approval_rejected', 'أعاد الميسّر الخطة المبسطة لرحلة الطائف: العناوين عامة جداً', '/app/trips/t8', 24);
  notify('u7', 'invoice_rejected', 'رُفضت فاتورة "قهوة وتمر اليوم": الفاتورة غير واضحة', '/app/custody', 8);
  notify('u13', 'custody_issued', 'صُرفت لك عهدة رحلة سَلع: ارفع بيانات الآيبان', '/app/custody', 20);
  notify('u19', 'deadline_passed', 'فات موعد رفع الخطة المبسطة لرحلة تبوك', '/app/trips/t10', 30);
  notify('u6', 'focus_created_presenter', 'كُلّفت بالتقديم في لقاء تركيز قادم', '/app/focus/f_g1_4', 48);
  notify('u2', 'individual_booked', 'تم حجز لقائك الفردي مع الميسّر', '/app/individual', 30, true);
  notify('u3', 'plan_step_due', 'حان موعد خطوة "المشي 30 دقيقة يومياً": وش صار؟', '/app/plan', 6);
  notify('u14', 'task_assigned', 'أُسندت لك مهمة: حجز الموقع وتصريح الدخول', '/app/tasks', 50, true);

  const comments = [
    { id: id('cm'), target: { kind: 'doc' as const, id: docs.find((d) => d.tripId === 't7' && d.kind === 'detailed')!.id }, authorId: 'u3', text: 'أقترح نقل زيارة المعالم للصباح الباكر بسبب الحر.', kind: 'suggestion' as const, at: iso(addDays(T, -1), 20) },
    { id: id('cm'), target: { kind: 'doc' as const, id: docs.find((d) => d.tripId === 't7' && d.kind === 'detailed')!.id }, authorId: 's2', text: 'فكرة جيدة، والوقت المخصص للراحة كافٍ.', kind: 'comment' as const, at: iso(T, 9) },
    { id: id('cm'), target: { kind: 'doc' as const, id: docs.find((d) => d.tripId === 't8' && d.kind === 'initial')!.id }, authorId: 'u10', text: 'ممكن نضيف لقاء عن القيادة والطبيعة مع ضيف من الطائف.', kind: 'suggestion' as const, at: iso(T, 8) },
    { id: id('cm'), target: { kind: 'task' as const, id: tasks.find((t) => t.title === 'تجهيز تقرير منتصف البرنامج')!.id }, authorId: LEADER_ID, text: 'أضف مقارنة القبلي بالبعدي لكل رحلة.', kind: 'comment' as const, at: iso(addDays(T, -2)) },
  ];

  return {
    version: DB_VERSION,
    seededAt: new Date().toISOString(),
    persons,
    capacityRules: structuredClone(defaultCapacityRules),
    accounts: buildAccounts(persons, iso(addDays(T, -60))),
    // تفويض مؤقت لمسؤول اللجنة الإعلامية بتحرير الموقع (مثال وثيقة القرارات)
    tempGrants: [{ id: 'gr1', personId: 's6', permission: 'edit_site', grantedBy: LEADER_ID, at: iso(addDays(T, -50)), expiresAt: addDays(T, 40) }],
    groups,
    formation: { status: 'published', publishAt: iso(addDays(T, -45), 20), publishedAt: iso(addDays(T, -45), 20) },
    transfers: [{ id: 'tr1', personId: 'u12', fromGroupId: 'g1', toGroupId: 'g2', by: LEADER_ID, at: iso(addDays(T, -35)), reason: 'تعارض في مواعيد الدراسة' }],
    facilitatorNotes: [
      { id: 'fn1', participantId: 'u12', authorId: 's1', groupIdAtTime: 'g1', text: 'هادئ ويحتاج تشجيعاً للمشاركة. أداؤه في الورشة كان ممتازاً.', at: iso(addDays(T, -40)) },
      { id: 'fn2', participantId: 'u12', authorId: 's2', groupIdAtTime: 'g2', text: 'تأقلم سريعاً مع المجموعة الجديدة.', at: iso(addDays(T, -20)) },
      { id: 'fn3', participantId: 'u4', authorId: 's1', groupIdAtTime: 'g1', text: 'متحمس للتنسيقات، مناسب لتولي ملف السكن في الرحلة الخارجية.', at: iso(addDays(T, -10)) },
      { id: 'fn4', participantId: 'u15', authorId: 's3', groupIdAtTime: 'g3', text: 'يتأخر أحياناً عن اللقاءات، تحدثت معه بلطف.', at: iso(addDays(T, -8)) },
    ],
    adminMessages: [
      { id: 'am1', fromId: 'u5', text: 'السلام عليكم، متى يُعلن تشكيل المجموعات؟', at: iso(addDays(T, -50)), reply: { byId: LEADER_ID, text: 'وعليكم السلام، بعد اللقاء التطويري الأول بإذن الله.', at: iso(addDays(T, -50), 14) } },
      { id: 'am2', fromId: 'u17', text: 'عندي اختبار يوم اللقاء القادم، هل يُحتسب غياباً؟', at: iso(addDays(T, -48)) },
    ],
    committees,
    memberships,
    memberRequests: [{ id: 'mr1', committeeId: 'c_media', personId: 'u13', requestedBy: 's2', note: 'لديه خبرة في التصوير والمونتاج', status: 'pending', at: iso(addDays(T, -1)) }],
    chat: [
      { id: 'ch1', committeeId: 'c_media', authorId: 's2', text: 'يا شباب، رحلة قُباء اليوم. سلمان عليك التوثيق.', at: iso(T, 6) },
      { id: 'ch2', committeeId: 'c_media', authorId: 's4', text: 'أبشر، الكاميرا جاهزة.', at: iso(T, 6, 20) },
      { id: 'ch3', committeeId: 'c_media', authorId: 'u9', text: 'جهزت قالب التغريدة.', at: iso(T, 7) },
      { id: 'ch4', committeeId: 'c_fin', authorId: 's1', text: 'الدفعة الثانية لقُباء بعد بداية الرحلة.', at: iso(T, 7) },
      { id: 'ch5', committeeId: 'c_fin', authorId: 's3', text: 'تمام، وفواتير لقاء الخطة الشخصية أراجعها الليلة.', at: iso(T, 7, 30) },
      { id: 'ch6', committeeId: 'c_gen', authorId: LEADER_ID, text: 'تذكير: اجتماع الإدارة الأسبوعي الخميس.', at: iso(addDays(T, -1)) },
    ],
    tasks,
    taskTemplates,
    trips,
    docs,
    actualSchedule: actual,
    focusMeetings,
    slots,
    individualMeetings,
    personalPlans,
    surveys,
    materials,
    materialViews,
    budgetCategories: defaultBudgetCategories,
    programBudget,
    budgetRequests,
    audit,
    meetings,
    custodies,
    invoices,
    fees,
    attendance,
    manualPoints: [],
    notifications,
    comments,
    trackingComments: [
      { id: 'tc1', name: 'أبو عمر (ولي أمر)', text: 'جزاكم الله خيراً على هذا الجهد المبارك.', at: iso(addDays(T, -10)), status: 'visible' },
      { id: 'tc2', name: 'زائر', text: 'متى التسجيل للدفعة القادمة؟', at: iso(addDays(T, -1)), status: 'pending' },
    ],
    settings,
  };
}
