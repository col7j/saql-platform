// البيانات التجريبية الكاملة. التواريخ نسبية لتاريخ اليوم حتى تبقى الحالات منطقية.
import { addDays, dateTime, todayISO } from '@/domain/dates';
import { hashPassword, sha256Hex } from '@/domain/crypto';
import { closureChecks, tasksFromTemplates } from '@/domain/workflow';
import type {
  Attachment, Attendance, AuditEntry, BudgetRequest, Contract, Custody, DirectSpend, EditRequest, FeeRecord, Meeting, DB, FocusMeeting, IndividualMeeting, AvailabilitySlot, LifeAspect, Material, Notification, ProgramNeed, SpendForm, SpendLine, WalletEntry,
  PersonalPlan, Survey, Task,
} from '@/domain/types';
import { defaultBudgetCategories, defaultCapacityRules, defaultProgramBudget, defaultSettings, defaultTaskTemplates } from './defaults';
import { buildAccounts, buildCommittees, buildGroups, buildPeople, LEADER_ID } from './seed-people';
import { buildTrips } from './seed-trips';

export const DB_VERSION = 11;

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
  // حضور الرحلة بحالاته (مبكر/في الوقت/متأخر/غائب)، والتركيز ولقاءات الرحلة حاضر/غائب
  const mark = (eventKind: Attendance['eventKind'], eventId: string, personId: string, present: boolean, byId: string, when: string, sessionId?: string) => {
    const roll = rand();
    const status: Attendance['status'] = !present ? 'absent' : eventKind !== 'trip' ? 'present' : roll < 0.25 ? 'early' : roll < 0.8 ? 'on_time' : 'late';
    attendance.push({ id: id('at'), eventKind, eventId, sessionId, personId, status, present, byId, at: when });
  };
  const absentPlan = new Set(['u6', 'u12', 'u18', 'u24']); // لم يحضروا لقاء الخطة الشخصية: خططهم مقفلة
  for (const t of trips.filter((x) => ['t1', 't2', 't3'].includes(x.id))) {
    participants.forEach((p) => {
      const present = t.id === 't2' ? !absentPlan.has(p.id) : rand() > 0.12;
      mark('trip', t.id, p.id, present, t.id === 't3' ? 'u2' : 's7', iso(t.startDate, 9));
    });
  }
  // لقاءات الرحلات المنفذة (تصنيفات يلزمها تحضير): يسجّلها مسؤول التحضير
  for (const t of trips.filter((x) => ['t1', 't2', 't3'].includes(x.id))) {
    const prep = new Set(settings.scheduleCategories.filter((c) => c.requiresPrep).map((c) => c.id));
    (t.schedule.plans[0]?.items ?? []).filter((i) => i.sessionId && prep.has(i.categoryId)).forEach((i) =>
      participants.forEach((p) => {
        const wasThere = attendance.find((a) => a.eventKind === 'trip' && a.eventId === t.id && a.personId === p.id)?.present;
        mark('trip_session', t.id, p.id, !!wasThere && rand() > 0.08, t.id === 't3' ? 'u2' : 's7', iso(t.startDate, 12), i.sessionId);
      }));
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
  // الاستبيان العام القبلي: يظهر أول دخول، وأجابه من أكمل ملفه
  surveys.push({ id: 'sv_prog', title: 'الاستبيان العام القبلي', context: { kind: 'program' }, phase: 'pre', mandatory: true, opensAt: iso(addDays(T, -60)), createdBy: LEADER_ID, questions: [{ id: 'sv_prog_q1', text: 'إلى أي حد تعرف مهارات القيادة؟', type: 'scale', isGeneral: true }, { id: 'sv_prog_q2', text: 'أكثر ما تتوقع أن تستفيده', type: 'choice', options: ['الرحلات', 'لقاءات التركيز', 'اللقاءات الفردية', 'الخطة الشخصية'], isGeneral: true }, { id: 'sv_prog_q3', text: 'ما الذي تريد تطويره في نفسك؟', type: 'text', isGeneral: true }],
    responses: participants.filter((p) => p.profileCompletedAt).map((p, k) => ({ id: id('rs'), personId: p.id, answers: { sv_prog_q1: String(2 + (k % 3)), sv_prog_q2: ['الرحلات', 'الخطة الشخصية', 'لقاءات التركيز'][k % 3], sv_prog_q3: 'الثقة في الإلقاء' }, at: iso(addDays(T, -55)) })) });

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
  // الموازنة العامة معتمدة ومقفلة منذ بداية البرنامج (تعديلها بطلب للقائد العام)
  const programBudget = { ...defaultProgramBudget(), setupDone: true, setupAt: iso(addDays(T, -59)) };
  const att = (name: string, type = 'image/jpeg'): Attachment => ({ name, type, size: 80000 + name.length * 997, hash: sha256Hex(`seed:${name}`) });
  const wallet: WalletEntry[] = [];
  const wout = (kind: WalletEntry['kind'], amount: number, file: string, daysAgo: number, ref?: WalletEntry['ref'], by = 's5') => {
    const e: WalletEntry = { id: id('we'), kind, amount, at: iso(addDays(T, -daysAgo)), byId: by, attachment: att(file), ref };
    wallet.push(e);
    return e;
  };
  wallet.push({ id: 'we_dep1', kind: 'deposit', amount: 30000, at: iso(addDays(T, -58)), byId: 's5', attachment: att('حوالة-الجمعية-1.jpg'), source: 'جمعية البرنامج (الدفعة الأولى)' });
  wallet.push({ id: 'we_dep2', kind: 'deposit', amount: 15000, at: iso(addDays(T, -20)), byId: 's5', attachment: att('حوالة-الجمعية-2.jpg'), source: 'جمعية البرنامج (الدفعة الثانية)', note: 'لتغطية الرحلات الخارجية' });

  const budgetRequests: BudgetRequest[] = [];
  const reqEv = (byId: string, action: BudgetRequest['history'][number]['action'], daysAgo: number, note?: string) => ({ at: iso(addDays(T, -daysAgo)), byId, action, note });
  const req = (r: Partial<BudgetRequest> & Pick<BudgetRequest, 'ownerKind' | 'ownerId' | 'spendKind' | 'requestedBy' | 'amount' | 'allocated' | 'status'>, history: BudgetRequest['history']) => {
    const full: BudgetRequest = { id: id('br'), detailed: !!r.lines?.length, lines: [], history, submittedAt: history[0]?.at, ...r };
    budgetRequests.push(full);
    return full.id;
  };
  const per = programBudget.focus.perItem;
  const tripReq = (tripId: string, by: string, kind: 'internal_trip' | 'external_trip', allocated: number, status: BudgetRequest['status'], history: BudgetRequest['history']) => {
    const lines = budgets[tripId];
    return req({ ownerKind: 'trip', ownerId: tripId, spendKind: kind, requestedBy: by, lines, amount: lines.reduce((s, l) => s + l.qty * l.price, 0), allocated, status }, history);
  };
  // رحلات فريق العمل للقائد العام مباشرة، ورحلات المجموعات: الميسّر ثم القائد العام
  const rT1 = tripReq('t1', 's2', 'internal_trip', 3500, 'approved', [reqEv('s2', 'submit', 66), reqEv(LEADER_ID, 'leader_approve', 65)]);
  const rT2 = tripReq('t2', 's3', 'internal_trip', 3500, 'approved', [reqEv('s3', 'submit', 42), reqEv(LEADER_ID, 'leader_approve', 41)]);
  const rT3 = tripReq('t3', 'u1', 'internal_trip', 3500, 'approved', [reqEv('u1', 'submit', 28), reqEv('s1', 'facilitator_approve', 27), reqEv(LEADER_ID, 'leader_approve', 26)]);
  const rT4 = tripReq('t4', 'u7', 'internal_trip', 3500, 'approved', [reqEv('u7', 'submit', 13), reqEv('s2', 'facilitator_approve', 12), reqEv(LEADER_ID, 'leader_approve', 11)]);
  tripReq('t5', 'u13', 'internal_trip', 3500, 'approved', [reqEv('u13', 'submit', 5), reqEv('s3', 'facilitator_approve', 4), reqEv(LEADER_ID, 'leader_approve', 2)]);
  tripReq('t6', 'u19', 'internal_trip', 3500, 'pending_facilitator', [reqEv('u19', 'submit', 1)]);
  tripReq('t7', 'u1', 'external_trip', programBudget.externalTrip.perItem, 'pending_leader', [reqEv('u1', 'submit', 2, 'السكن في العُلا أغلى من المتوقع'), reqEv('s1', 'facilitator_approve', 1)]);
  const rUmrah = req({ ownerKind: 'focus', ownerId: 'f_g1_5', spendKind: 'focus', requestedBy: 's1', amount: 1440, allocated: programBudget.umrahPerGroup, status: 'approved' }, [reqEv('s1', 'submit', 24), reqEv('s5', 'finance_approve', 23)]);
  const rF23 = req({ ownerKind: 'focus', ownerId: 'f_g2_3', spendKind: 'focus', requestedBy: 's2', amount: 150, allocated: per, status: 'approved' }, [reqEv('s2', 'submit', 9), reqEv('s1', 'finance_approve', 8)]);
  req({ ownerKind: 'focus', ownerId: 'f_g1_4', spendKind: 'focus', requestedBy: 's1', amount: 150, allocated: per, status: 'approved' }, [reqEv('s1', 'submit', 3), reqEv('s5', 'finance_approve', 2)]);
  req({ ownerKind: 'focus', ownerId: 'f_g4_5', spendKind: 'focus', requestedBy: 's4', amount: 140, allocated: per, status: 'pending_finance', note: 'ضيافة ومطبوعات للورشة' }, [reqEv('s4', 'submit', 0)]);
  req({ ownerKind: 'focus', ownerId: 'f_g3_5', spendKind: 'focus', requestedBy: 's3', amount: 1860, allocated: programBudget.umrahPerGroup, status: 'pending_leader', note: 'باص أكبر لأن عدد الحضور 14 مع المرافقين' }, [reqEv('s3', 'submit', 1)]);
  req({ ownerKind: 'focus', ownerId: 'f_g2_4', spendKind: 'focus', requestedBy: 's2', amount: 400, allocated: per, status: 'rejected' }, [reqEv('s2', 'submit', 5), reqEv('p_lead', 'leader_reject', 4, 'مكافأة الضيف الخارجي لا تُصرف من لقاءات التركيز. أعد الطلب بالضيافة فقط.')]);

  const custodies: Custody[] = [];
  const spendForms: SpendForm[] = [];
  const custody = (cid: string, requestId: string | undefined, ownerKind: Custody['ownerKind'], ownerId: string, spendKind: Custody['spendKind'], recipient: string, approved: number, transfers: [number, number][], status: Custody['status'], createdAgo: number, extra: Partial<Custody> = {}) => {
    const c: Custody = {
      id: cid, requestId, ownerKind, ownerId, spendKind, recipientId: recipient, approved, status, createdAt: iso(addDays(T, -createdAgo)), createdBy: 's5',
      transfers: transfers.map(([amount, ago], i) => ({ id: id('ct'), amount, at: iso(addDays(T, -ago)), byId: 's5', walletEntryId: wout('custody_transfer', amount, `إيصال-${cid}-${i + 1}.jpg`, ago, { custodyId: cid }).id })),
      ...extra,
    };
    custodies.push(c);
    return c;
  };
  type L = [categoryId: string | undefined, item: string, amount: number, status: SpendLine['status'], custom?: string, note?: string];
  const form = (custodyId: string, by: string, vendor: string, serial: string | undefined, ago: number, lines: L[], file?: string) => {
    const f: SpendForm = {
      id: id('sf'), custodyId, uploadedBy: by, at: iso(addDays(T, -ago)), vendor, serial, invoiceDate: addDays(T, -ago), proofKind: 'invoice', attachment: att(file ?? `فاتورة-${custodyId}-${spendForms.length}.jpg`),
      lines: lines.map(([categoryId, item, amount, status, custom, note]) => ({ id: id('sl'), categoryId, customCategory: custom, item, amount, status, reviewNote: note, reviewedBy: status === 'pending' ? undefined : 's5', reviewedAt: status === 'pending' ? undefined : iso(addDays(T, -ago + 1)) })),
    };
    spendForms.push(f);
    return f;
  };
  const closedTrip = (cid: string, requestId: string, tripId: string, recipient: string, d: string, ago: number) => {
    custody(cid, requestId, 'trip', tripId, 'internal_trip', recipient, 3240, [[3240, ago]], 'closed', ago + 1, { closedAt: iso(addDays(d, 9)), closedBy: 's5', closeRequestedAt: iso(addDays(d, 5)) });
    form(cid, recipient, 'مؤسسة النقل الذهبي', `${cid}-101`, ago - 6, [['bc_transport', 'باص كوستر', 1000, 'accepted']]);
    form(cid, recipient, 'مطعم الطيبين', `${cid}-102`, ago - 6, [['bc_food', 'غداء الرحلة', 1080, 'accepted']]);
    form(cid, recipient, 'محمصة المدينة', `${cid}-103`, ago - 6, [['bc_hosting', 'قهوة وتمر', 200, 'accepted'], ['bc_food', 'ماء ووجبات خفيفة', 80, 'accepted']]);
    form(cid, recipient, 'المحاضر', `${cid}-104`, ago - 6, [['bc_guests', 'مكافأة المحاضر', 500, 'accepted']], `إيصال-مكافأة-${cid}.jpg`);
  };
  // اللقاء التطويري الأول: فائض 80 أُرجع بإيصال
  closedTrip('cu_t1', rT1, 't1', 's2', addDays(T, -52), 58);
  form('cu_t1', 's2', 'متنزه الملك فهد', 'cu_t1-105', 52, [['bc_tickets', 'رسوم دخول', 300, 'accepted']]);
  const c1 = custodies.find((c) => c.id === 'cu_t1')!;
  const ret = att('إيصال-فائض-cu_t1.jpg');
  const r1 = wout('surplus_return', 80, 'إيصال-فائض-cu_t1.jpg', 46, { custodyId: 'cu_t1' });
  Object.assign(c1, { surplusReturn: { attachment: ret, at: iso(addDays(T, -47)) }, settlement: { kind: 'surplus', amount: 80, method: 'transfer', attachment: ret, at: iso(addDays(T, -46)), byId: 's5', walletEntryId: r1.id } });
  // رحلة أُحُد الداخلية: عجز 60 سُوّي من خارج العهدة ويتحمّله صاحبها
  closedTrip('cu_t3', rT3, 't3', 'u1', addDays(T, -16), 24);
  form('cu_t3', 'u1', 'حديقة الملك فهد', 'cu_t3-105', 17, [['bc_tickets', 'رسوم دخول', 440, 'accepted']]);
  Object.assign(custodies.find((c) => c.id === 'cu_t3')!, { settlement: { kind: 'deficit', amount: 60, method: 'external', bearer: 'holder', attachment: att('إقرار-تسوية-cu_t3.jpg'), note: 'تجاوز اتفق عليه قائد المجموعة', at: iso(addDays(T, -8)), byId: 's5' } });
  // لقاء الخطة الشخصية: قيد الإغلاق، وبندان بانتظار المراجعة
  custody('cu_t2', rT2, 'trip', 't2', 'internal_trip', 's3', 3240, [[3240, 36]], 'closing', 37, { closeRequestedAt: iso(addDays(T, -2)) });
  form('cu_t2', 's3', 'مؤسسة النقل الذهبي', 'T2-55', 34, [['bc_transport', 'نقل المشاركين', 1000, 'accepted']]);
  form('cu_t2', 's3', 'مطعم الطيبين', undefined, 33, [['bc_food', 'غداء', 1150, 'pending'], ['bc_guests', 'مكافأة المدرب', 500, 'pending']]);
  // الرحلة الجارية: دفعة أولى 2000 والباقي مؤجّل، وبند مرفوض، وبند «غير موجود»، وتكرار صورة، واحتمال تجزئة
  custody('cu_t4', rT4, 'trip', 't4', 'internal_trip', 'u7', 3240, [[2000, 6]], 'active', 7);
  form('cu_t4', 'u7', 'مؤسسة النقل الذهبي', 'A-7731', 5, [['bc_transport', 'عربون الباص', 500, 'accepted']], 'عربون-الباص.jpg');
  form('cu_t4', 'u7', 'تموينات الرحاب', 'R-118', 2, [['bc_hosting', 'قهوة وتمر', 180, 'accepted'], ['bc_food', 'وجبات خفيفة', 110, 'rejected', undefined, 'الفاتورة لا تظهر فيها الكمية: أعد رفعها في نموذج جديد']]);
  form('cu_t4', 'u7', 'تموينات الرحاب', 'R-121', 1, [['bc_food', 'ماء', 95, 'pending']]);
  form('cu_t4', 'u7', 'تموينات الرحاب', undefined, 1, [['bc_hosting', 'أكواب وصحون', 120, 'pending']]);
  form('cu_t4', 'u7', 'مؤسسة النقل الذهبي', 'A-7731', 0, [[undefined, 'إيجار مكبر صوت', 150, 'pending', 'معدات صوتية'], ['bc_tickets', 'رسوم دخول', 170, 'pending']], 'عربون-الباص.jpg');
  // عهدة لقاء العمرة: مغلقة بلا فائض ولا عجز
  custody('cu_umrah', rUmrah, 'focus', 'f_g1_5', 'focus', 's1', 1440, [[1440, 21]], 'closed', 22, { closedAt: iso(addDays(T, -12)), closedBy: 's5', closeRequestedAt: iso(addDays(T, -14)) });
  form('cu_umrah', 's1', 'مؤسسة النقل الذهبي', 'U-901', 18, [['bc_transport', 'باص كوستر', 1200, 'accepted'], ['bc_food', 'إفطار', 240, 'accepted']]);
  // لقاء تركيز: صرف أكثر من رصيد العهدة (يُقبل ويُسجَّل عجزاً)
  custody('cu_f22', rF23, 'focus', 'f_g2_3', 'focus', 's2', 150, [[150, 5]], 'active', 6);
  form('cu_f22', 's2', 'محمصة المدينة', 'M-44', 3, [['bc_hosting', 'ضيافة اللقاء', 165, 'pending']]);

  // ── احتياجات البرنامج والصرف المباشر والعقود ──
  const programNeeds: ProgramNeed[] = [
    { id: 'nd1', title: 'المطبوعات والهوية', description: 'دروع وشعارات ولوحات', createdBy: 's5', at: iso(addDays(T, -50)) },
    { id: 'nd2', title: 'مستلزمات المقر', description: 'قرطاسية وضيافة دائمة', createdBy: 's5', at: iso(addDays(T, -40)) },
  ];
  custody('cu_nd2', undefined, 'need', 'nd2', 'program_needs', LEADER_ID, 1200, [[1200, 30]], 'active', 30);
  form('cu_nd2', LEADER_ID, 'مكتبة جرير', 'J-5510', 25, [['bc_print', 'قرطاسية', 320, 'accepted']]);
  const directSpends: DirectSpend[] = [];
  const direct = (allocations: DirectSpend['allocations'], vendor: string, serial: string, ago: number, lines: [string, string, number][]) => {
    const total = lines.reduce((s, l) => s + l[2], 0);
    const dsId = id('ds');
    const e = wout('direct_spend', total, `فاتورة-مباشر-${dsId}.jpg`, ago, { directSpendId: dsId });
    directSpends.push({ id: dsId, allocations, vendor, serial, invoiceDate: addDays(T, -ago), proofKind: 'invoice', attachment: e.attachment, lines: lines.map(([categoryId, item, amount]) => ({ id: id('dl'), categoryId, item, amount })), total, byId: 's5', at: iso(addDays(T, -ago)), walletEntryId: e.id });
  };
  // اللقاء الافتتاحي: أُنشئ بأثر رجعي ويُصرف عليه مباشرة
  direct([{ ownerKind: 'event', ownerId: 'ev_open', amount: 2400 }], 'قاعة الملتقى', 'Q-118', 59, [['bc_hosting', 'إيجار القاعة والضيافة', 2400]]);
  direct([{ ownerKind: 'trip', ownerId: 't4', amount: 800 }], 'شركة الرحلات المتحدة', 'U-3301', 4, [['bc_transport', 'حافلة إضافية', 800]]);
  // مصروف مشترك (سكن) موزّع على رحلتين خارجيتين، والفاتورة مرة واحدة
  direct([{ ownerKind: 'trip', ownerId: 't7', amount: 3500 }, { ownerKind: 'trip', ownerId: 't8', amount: 2500 }], 'فندق الريف', 'H-2207', 3, [['bc_housing', 'حجز سكن مشترك', 6000]]);
  const contracts: Contract[] = [{
    id: 'ctr1', needId: 'nd1', vendor: 'مطبعة المدينة', title: 'دروع ولوحات البرنامج', total: 5000, createdBy: 's5', at: iso(addDays(T, -45)),
    payments: [
      { id: 'cp1', amount: 2500, dueDate: addDays(T, -30), paidAt: iso(addDays(T, -30)), byId: 's5', attachment: att('فاتورة-مطبعة-1.jpg'), walletEntryId: wout('contract_payment', 2500, 'فاتورة-مطبعة-1.jpg', 30, { contractId: 'ctr1', paymentId: 'cp1' }).id },
      { id: 'cp2', amount: 2500, dueDate: addDays(T, 10) },
    ],
  }];
  // طلب تعديل سجل معتمد بانتظار القائد العام
  const lineT1 = spendForms.find((f) => f.custodyId === 'cu_t1')!.lines[0];
  const editRequests: EditRequest[] = [{
    id: 'er1', target: { kind: 'spend_line', formId: spendForms.find((f) => f.custodyId === 'cu_t1')!.id, lineId: lineT1.id }, patch: { amount: 950 },
    summary: `باص كوستر (اللقاء التطويري الأول): المبلغ 1000 ← 950 ر.س`, reason: 'خصم لاحق من المورد بعد الاعتماد', requestedBy: 's5', at: iso(addDays(T, -1)), status: 'pending',
  }];

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

  // الرسوم: مسدد، جزئي، غير مسدد، واستثناء يُعتبر سداداً
  const fees: FeeRecord[] = participants.map((p, i) => {
    const amount = settings.feeAmount;
    if (i % 11 === 5) return { personId: p.id, amount, status: 'paid', paidAmount: amount, exemption: 'جمعية البر: تكفّلت بالرسوم', updatedAt: iso(addDays(T, -50)) };
    if (i % 7 === 3) return { personId: p.id, amount, status: 'partial', paidAmount: 250, note: 'يكمل الباقي الشهر القادم', updatedAt: iso(addDays(T, -40)) };
    if (i % 5 === 4) return { personId: p.id, amount, status: 'unpaid', paidAmount: 0 };
    return { personId: p.id, amount, status: 'paid', paidAmount: amount, updatedAt: iso(addDays(T, -58 + i)) };
  });

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
    notifications.push({ id: id('nt'), toId, type, title, link, at: new Date(nowDate.getTime() - hoursAgo * 3600000).toISOString(), read });
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
    { id: id('cm'), target: { kind: 'doc' as const, id: docs.find((d) => d.tripId === 't7' && d.kind === 'schedule')!.id }, authorId: 'u3', text: 'أقترح نقل زيارة المعالم للصباح الباكر بسبب الحر.', kind: 'suggestion' as const, at: iso(addDays(T, -1), 20) },
    { id: id('cm'), target: { kind: 'doc' as const, id: docs.find((d) => d.tripId === 't7' && d.kind === 'schedule')!.id }, authorId: 's2', text: 'فكرة جيدة، والوقت المخصص للراحة كافٍ.', kind: 'comment' as const, at: iso(T, 9) },
    { id: id('cm'), target: { kind: 'doc' as const, id: docs.find((d) => d.tripId === 't8' && d.kind === 'document')!.id }, authorId: 'u10', text: 'ممكن نضيف لقاء عن القيادة والطبيعة مع ضيف من الطائف.', kind: 'suggestion' as const, at: iso(T, 8) },
    { id: id('cm'), target: { kind: 'task' as const, id: tasks.find((t) => t.title === 'تجهيز تقرير منتصف البرنامج')!.id }, authorId: LEADER_ID, text: 'أضف مقارنة القبلي بالبعدي لكل رحلة.', kind: 'comment' as const, at: iso(addDays(T, -2)) },
  ];

  const db: DB = {
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
    tasks,
    taskTemplates,
    trips,
    // الافتتاحي منتهٍ (أُنشئ بأثر رجعي متخطياً التخطيط والتجهيز)، والختامي مخطَّط
    events: [
      { id: 'ev_open', kind: 'opening', title: 'اللقاء الافتتاحي', date: addDays(T, -60), location: 'قاعة الملتقى · المدينة المنورة', description: 'حفل افتتاح البرنامج وتعريف المشاركين بالمسار.', status: 'done', retroactive: true, attendees: 24, createdBy: LEADER_ID, createdAt: iso(addDays(T, -10)) },
      { id: 'ev_close', kind: 'closing', title: 'اللقاء الختامي وحفل التكريم', date: addDays(T, 145), location: 'قاعة الملتقى · المدينة المنورة', status: 'planned', retroactive: false, createdBy: LEADER_ID, createdAt: iso(addDays(T, -40)) },
    ],
    // تقييم القائد العام الفردي: مرة واحدة لمن اختارهم
    leaderEvaluations: ['u1', 'u7', 'u13'].map((pid, i) => ({ participantId: pid, scores: { leadership: 16 - i, teamwork: 13, responsibility: 12 + i, communication: 12, growth: 13, creativity: 15 - i * 2 }, byId: LEADER_ID, at: iso(addDays(T, -5 + i)) })),
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
    wallet,
    custodies,
    spendForms,
    directSpends,
    programNeeds,
    contracts,
    editRequests,
    fees,
    attendance,
    manualPoints: [],
    notifications,
    comments,
    trackingComments: [
      { id: 'tc1', entityId: 'sp1', name: 'جمعية البر بالمدينة', text: 'جزاكم الله خيراً على هذا الجهد المبارك.', at: iso(addDays(T, -10)), status: 'visible' },
      { id: 'tc2', entityId: 'sp2', name: 'شركة النخيل', text: 'تقرير رحلة أُحُد مميز، ونتطلع للرحلات الخارجية.', at: iso(addDays(T, -1)), status: 'pending' },
    ],
    // جهات رابط الداعم: كلمة مرور لكل جهة (الكلمات التجريبية في ASSUMPTIONS)
    supporters: ([['sp1', 'جمعية البر بالمدينة', 'supporter', 'albir2026', true, true], ['sp2', 'شركة النخيل', 'partner', 'nakheel2026', true, false], ['sp3', 'مؤسسة الأثر', 'supporter', 'athar2026', false, false]] as const).map(([sid, name, kind, pw, active, primary], i) => ({
      id: sid, name, kind, salt: sid, passwordHash: hashPassword(pw, sid), active, primary, logo: undefined, placement: 'above' as const, orientation: i === 1 ? 'vertical' as const : 'horizontal' as const, order: i + 1, createdAt: iso(addDays(T, -58)),
    })),
    supporterAccess: { failed: 0 },
    finalFiles: [],
    settings,
  };
  // الرحلات التي اكتملت متطلباتها في البيانات التجريبية تُغلق بعد نهايتها بثلاثة أيام
  db.trips.filter((t) => closureChecks(db, t).every((c) => c.ok)).forEach((t) => Object.assign(t, { closedAt: iso(addDays(t.endDate, 3)), closedBy: LEADER_ID }));
  return db;
}
