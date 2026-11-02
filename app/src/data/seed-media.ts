// بيانات المركز الإعلامي التجريبية: ستة قوالب، وثلاثة موجزات (مسودة، ومعتمد برابط متابعة بحالات مختلفة، وأسبوعي فيه تغيير معلّق)،
// ورابطان (قراءة، ومتابعة)، وفواتير إضافية. الرمزان التجريبيان ثابتان ليُجرَّب الرابط، وفي المنصة الحقيقية الرمز عشوائي ولا يُخزَّن.
import { sha256Hex } from '@/domain/crypto';
import { addDays } from '@/domain/dates';
import { applyExec, contentHash, emptySections, freezeBrief, newBriefFromTemplate, tokenHash, weekStartOf } from '@/domain/media';
import type { Attachment, BriefSection, BriefSectionKey, DB, MediaBrief, MediaPriority, MediaTemplate } from '@/domain/types';

/** رمزا الرابطين التجريبيين: /brief/<الرمز> */
export const MEDIA_DEMO_TOKENS = {
  read: 'sq-read-4f9k2m7x1c8v3b6n0z5l9a2s7d4h1j8q',
  track: 'sq-trck-7d2h9s4a1f6g3k8l0z5x2c7v4b1n9m6q',
};

type Shot = [string, MediaPriority];
const sec = (bodies: Partial<Record<BriefSectionKey, string>>, hide: BriefSectionKey[] = []): BriefSection[] =>
  emptySections().map((s) => ({ ...s, body: bodies[s.key] ?? '', visible: s.visible && !hide.includes(s.key) }));
const shots = (list: Shot[]) => list.map(([title, priority]) => ({ title, priority, required: priority !== 'extra' }));
const iv = (who: string, questions: string[], required = true) => ({ who, questions, required });
const dv = (title: string, type: string, spec: string, dueOffsetDays: number, required = true) => ({ title, type, spec, dueOffsetDays, required });

export function defaultMediaTemplates(at: string): MediaTemplate[] {
  const t = (id: string, name: string, description: string, sections: BriefSection[], s: Shot[], interviews: MediaTemplate['interviews'], deliverables: MediaTemplate['deliverables']): MediaTemplate =>
    ({ id, name, description, kind: 'both', sections, shots: shots(s), interviews, deliverables, updatedAt: at });
  return [
    t('mt_weekly', 'لقاء أسبوعي', 'تغطية خفيفة للقاءات التركيز والاجتماعات الدورية: لقطات سريعة ومقطع واحد.',
      sec({
        goals: 'توثيق اللقاء بما يُظهر الفكرة المطروحة وتفاعل الحضور، لمحتوى قصير يُنشر خلال يومين.',
        visual: 'إضاءة طبيعية قدر الإمكان، وخلفية نظيفة بلا مواد منتهية الصلاحية. اللقطات أفقية للصور وعمودية للمقطع القصير.',
        onsite: 'عبارة أو اثنتان من كلام المقدّم تصلح عنواناً للمنشور، وصورة جماعية في الختام.',
        partners: 'لا شعارات شركاء في اللقاءات الأسبوعية إلا إن ذُكر خلاف ذلك في الملاحظات.',
        notes: 'لا يُنشر وجه مشارك طلب عدم التصوير. يُراجع المسؤول الإعلامي المنشور قبل رفعه.',
      }, ['interviews', 'partners']),
      [['لقطة عامة للقاعة قبل البدء', 'must'], ['المقدّم أثناء الحديث', 'must'], ['تفاعل الحضور والأسئلة', 'important'], ['الصورة الجماعية في الختام', 'important'], ['تفاصيل المكان والمواد', 'extra']],
      [], [dv('مجلد صور اللقاء', 'مجلد صور', 'JPG عالي الجودة، من 15 إلى 25 صورة مختارة', 1), dv('مقطع ملخص قصير', 'فيديو', 'عمودي 9:16، مدة 30 إلى 45 ثانية، MP4', 2, false)]),
    t('mt_internal_trip', 'رحلة داخلية', 'رحلة ليوم واحد داخل المدينة: تغطية يوم كامل بجدول مفصّل ومقابلات وملخص مرئي.',
      sec({
        goals: 'إبراز التجربة القيادية في الرحلة لا الموقع وحده: كيف تعلّم المشاركون وتصرفوا، مع نقل أجواء الفريق.',
        visual: 'ألوان الهوية حاضرة في اللقطات الجماعية (الزي أو اللافتات). تفضَّل اللقطات الواسعة للمكان واللقطات القريبة للتفاعل، وتُجنَّب لقطات الظهر وحدها.',
        onsite: 'مقطعان لا يزيدان عن 15 ثانية لكل مشارك يقول فيه أبرز ما تعلّمه، ولقطة للمحاضر وهو يشرح، واقتباس يصلح للتغريدة.',
        partners: 'يظهر شعار الجهة الراعية في لقطة الافتتاح، ولا يُغطّي الشعار الوجوه.',
        notes: 'تُراعى أوقات الصلاة في الجدول فلا يُصوَّر أثناءها. أي طلب من المحاضر بعدم التصوير يُحترم فوراً.',
      }, ['partners']),
      [['وصول الحافلة ونزول المشاركين', 'must'], ['اللقاء التمهيدي مع فريق الرحلة', 'must'], ['المحاضر أثناء الشرح', 'must'], ['نشاط جماعي في الموقع', 'important'], ['المشاركون أثناء الوجبة', 'extra'], ['الصورة الجماعية في الموقع', 'must'], ['لقطة الختام وكلمة الشكر', 'important']],
      [iv('قائد الرحلة', ['ما الهدف الذي أردتم تحقيقه من الرحلة؟', 'ما الذي تغيّر في خطتكم أثناء التنفيذ ولماذا؟']), iv('مشارك من المجموعة المنفذة', ['ما أهم موقف تعلّمت منه اليوم؟', 'ماذا ستطبّق منه في مجموعتك؟'], false)],
      [dv('مجلد صور الرحلة', 'مجلد صور', 'JPG عالي الجودة، حد أدنى 40 صورة مختارة', 1), dv('فيديو ملخص الرحلة', 'فيديو', 'أفقي 16:9، من دقيقة إلى دقيقتين، MP4 1080p مع ترجمة', 3), dv('تغريدة التغطية', 'نص وصورة', 'صورة 1200×675 ونص لا يتجاوز 280 حرفاً', 0)]),
    t('mt_external_trip', 'رحلة خارجية', 'رحلة عدة أيام خارج المدينة: تغطية يومية مع نشرة ختامية وتنسيق مع الشركاء.',
      sec({
        goals: 'توثيق الرحلة يوماً بيوم لقصة متصلة: الانطلاق، والمحطات، واللحظات القيادية، والعودة. وإنتاج نشرة تعرض الأثر لا الأنشطة فقط.',
        visual: 'لقطات جوية أو بانورامية للمواقع إن سمحت الأنظمة، ولقطات قريبة للتفاعل. تُحفظ المواد يومياً قبل النوم في المجلد المشترك.',
        onsite: 'يومية قصيرة (مقطع عمودي) في نهاية كل يوم، وصورة واحدة على الأقل لكل مشارك، وتسجيل صوتي لأجمل ما قيل.',
        partners: 'يظهر شعار الراعي في لقطة الافتتاح ولوحة الختام، وتُرسل نسخة من المواد للراعي قبل النشر لمراجعتها.',
        notes: 'لا تصوير في الأماكن التي يمنع التصوير فيها. تُنسَّق التصاريح مسبقاً مع منسق الرحلة. يُراعى حفظ خصوصية المبيت.',
      }),
      [['الانطلاق ووداع الأهالي', 'must'], ['الوصول للوجهة', 'must'], ['المواقع الرئيسية (لقطات واسعة)', 'must'], ['المحاضر أو المرشد أثناء الشرح', 'must'], ['أنشطة المجموعات', 'important'], ['المشاركون أثناء الراحة والوجبات', 'extra'], ['صورة جماعية لكل مجموعة', 'must'], ['لقطة العودة والختام', 'important']],
      [iv('قائد فريق الرحلة', ['كيف تقيّمون الرحلة مقارنة بخطتكم؟', 'ما أبرز التحديات وكيف تعاملتم معها؟']), iv('محاضر أو مرشد الرحلة', ['ما الرسالة التي أردت أن يخرج بها المشاركون؟'], false), iv('مشاركان من مجموعتين مختلفتين', ['ما أجمل لحظة في الرحلة؟', 'ما القرار الذي ستتخذه بعد هذه التجربة؟'])],
      [dv('مجلد صور الرحلة', 'مجلد صور', 'JPG عالي الجودة، حد أدنى 80 صورة مختارة مرتبة باليوم', 2), dv('فيديو ملخص الرحلة', 'فيديو', 'أفقي 16:9، من دقيقتين إلى 3، MP4 1080p مع ترجمة', 5), dv('يومية الرحلة', 'مقاطع قصيرة', 'عمودي 9:16، 30 ثانية لكل يوم', 1, false), dv('نشرة الرحلة', 'PDF', 'A4 عربي، من 4 إلى 6 صفحات بهوية صقل', 7), dv('تغريدة التغطية', 'نص وصورة', 'صورة 1200×675 ونص لا يتجاوز 280 حرفاً', 0)]),
    t('mt_ceremony', 'حفل', 'الحفل الافتتاحي أو الختامي أو التكريم: تغطية رسمية بكاميرات متعددة وحضور الشركاء.',
      sec({
        goals: 'تغطية رسمية تليق بالحفل: لحظات التكريم، وكلمات الضيوف، وحضور الشركاء، مع مقطع يصلح للعرض لاحقاً.',
        visual: 'كاميرتان على الأقل: واحدة ثابتة على المنصة والأخرى متحركة بين الحضور. تُختبر الإضاءة والصوت قبل الحفل بساعة.',
        onsite: 'تسجيل كامل لكلمات الحفل، ولقطة لكل مكرَّم أثناء الاستلام، وبث مباشر قصير للافتتاح إن أُجيز.',
        partners: 'تظهر شعارات الداعمين والشركاء على الشاشة الرئيسية وفي الصورة الجماعية، ويُذكر الراعي الرئيسي في أول منشور.',
        notes: 'يحصل الفريق على جدول الحفل بالدقيقة قبل 24 ساعة. تُوزَّع الأدوار بين المصورين حسب المسؤوليات.',
      }),
      [['مدخل القاعة وتجهيزاتها قبل الحضور', 'important'], ['وصول الضيوف والمكرَّمين', 'must'], ['الافتتاح وكلمة الترحيب', 'must'], ['كل مكرَّم أثناء الاستلام', 'must'], ['كلمة الضيف الرئيسي', 'must'], ['الصورة الجماعية للمكرَّمين', 'must'], ['الشركاء والداعمون', 'important'], ['ردود فعل الحضور', 'extra']],
      [iv('الضيف الرئيسي', ['ما انطباعك عن التجربة؟', 'ما رسالتك للمشاركين؟']), iv('مكرَّم أو مكرَّمة', ['ماذا تعني لك هذه اللحظة؟'], false), iv('ممثل الراعي', ['لماذا دعمتم صقل؟'], false)],
      [dv('صور الحفل', 'مجلد صور', 'JPG عالي الجودة، حد أدنى 100 صورة مختارة', 1), dv('فيديو الحفل الكامل', 'فيديو', 'أفقي 16:9، 1080p، بصوت منقّى', 5), dv('مقطع الحفل الملخص', 'فيديو', 'أفقي 16:9، دقيقتان، مع شعارات الشركاء', 3), dv('تغريدة التغطية', 'نص وصورة', 'صورة 1200×675 ونص لا يتجاوز 280 حرفاً', 0)]),
    t('mt_workshop', 'ورشة', 'ورشة تدريبية قصيرة: تغطية تركّز على المدرّب والتطبيق العملي ومخرجات المشاركين.',
      sec({
        goals: 'إظهار التعلّم العملي: المدرب، والتطبيق، وما أنتجه المشاركون، وليس القاعة وحدها.',
        visual: 'لقطات من زاويتين للمدرب (من الأمام ومن جانب القاعة) ولقطات قريبة للأوراق والشاشة. يُتجنب تصوير الشاشات بما فيها بيانات شخصية.',
        onsite: 'لقطة قبل التمرين وأخرى بعده، ومقطع قصير لمشارك يشرح ما أنتجه، وصورة لأهم شريحة في الورشة.',
        partners: 'يظهر شعار جهة الورشة إن وُجدت في الشريحة الافتتاحية ولقطة المدرب.',
        notes: 'يُستأذن المدرب في التصوير قبل البدء، وتُسلَّم له نسخة من المواد إن طلب.',
      }, ['partners']),
      [['المدرب أثناء الشرح', 'must'], ['تمرين المجموعات', 'must'], ['مشارك يعرض ما أنتجه', 'important'], ['أهم شريحة أو نقطة في الورشة', 'important'], ['صورة جماعية', 'extra']],
      [iv('المدرب', ['ما الفكرة التي تريد أن تبقى مع المشاركين؟', 'كيف قيّمت تفاعلهم؟']), iv('مشارك', ['ما الذي ستطبّقه غداً؟'], false)],
      [dv('صور الورشة', 'مجلد صور', 'JPG، من 25 إلى 40 صورة', 1), dv('مقطع ملخص', 'فيديو', 'عمودي 9:16، 45 ثانية', 2, false)]),
    t('mt_custom', 'قالب مخصص (فارغ)', 'بداية بلا محتوى: كل الأقسام جاهزة وفارغة، تملؤها بحسب الفعالية.', sec({}), [], [], []),
  ];
}

const att = (name: string): Attachment => ({ name, type: 'image/jpeg', size: 90000 + name.length * 811, hash: sha256Hex(`seed:${name}`) });

/** يُستدعى في نهاية buildSeed بعد تجهيز الرحلات واللقاءات والعهد */
export function seedMedia(db: DB, T: string) {
  const at = (days: number, h = 10) => new Date(`${addDays(T, days)}T${String(h).padStart(2, '0')}:00:00`).toISOString();
  db.mediaTemplates = defaultMediaTemplates(at(-30));
  const tpl = (id: string) => db.mediaTemplates.find((x) => x.id === id)!;
  const head = db.persons.find((p) => p.id === 's6')!;
  const build = (id: string, title: string, scope: Parameters<typeof newBriefFromTemplate>[2], templateId: string): MediaBrief => {
    const { content, kind } = newBriefFromTemplate(db, tpl(templateId), scope);
    content.title = title;
    return { id, kind, status: 'draft', templateId, templateName: tpl(templateId).name, content, internalNotes: '', snapshots: [], execution: {}, createdBy: head.id, createdAt: at(-9), updatedAt: at(-3) };
  };
  const approve = (b: MediaBrief, days: number) => {
    b.snapshots.push({ version: 1, at: at(days), by: head.id, reason: 'first', contentHash: contentHash(b.content), data: freezeBrief(db, b) });
    b.status = 'approved';
  };

  // 1) معتمد: رحلة أُحُد الداخلية (انتهت)، بإصدار 1 ورابط متابعة نشط وحالات لقطات مختلفة
  const t3 = build('mb_t3', 'موجز تغطية: رحلة أُحُد الداخلية', { kind: 'event', ref: { kind: 'trip', id: 't3' } }, 'mt_internal_trip');
  t3.content.sections = t3.content.sections.map((s) => (s.key === 'partners' ? { ...s, visible: false } : s));
  t3.content.contacts = [
    { id: 'bc_1', name: head.name, role: 'مسؤول التغطية الإعلامية', phone: head.phone, authorized: true },
    { id: 'bc_2', name: 'منسق الحافلات', role: 'تنسيق النقل (داخلي)', phone: '0555550199', authorized: false },
  ];
  t3.internalNotes = 'قائد المجموعة يفضّل ألا تُنشر صور المحاضر قبل أن يراجعها. لا يُنشر هذا الكلام خارج المنصة.';
  approve(t3, -16);
  const ev = t3.content.events[0];
  const [s1, s2, s3, s4, s5] = ev.shots;
  const act = (id: string, who: string, p: Parameters<typeof applyExec>[3], days: number) => applyExec(t3, id, who, p, at(days, 18));
  act(s1.id, 'ريان الفريق', { status: 'done', addProof: 'https://drive.google.com/drive/folders/saql-uhud-arrival' }, -15);
  act(s2.id, 'ريان الفريق', { status: 'done' }, -15);
  act(s3.id, 'سامر المصوّر', { status: 'failed', reason: 'تعذّر الدخول للقاعة بسبب إغلاقها أثناء الشرح' }, -15);
  act(s4.id, 'سامر المصوّر', { status: 'in_progress' }, -15);
  act(ev.interviews[0].id, 'ريان الفريق', { status: 'done', addProof: 'https://drive.google.com/file/d/saql-uhud-leader-interview' }, -14);
  const [d1, d2] = t3.content.deliverables;
  applyExec(t3, d1.id, 'ريان الفريق', { status: 'done', addProof: 'https://drive.google.com/drive/folders/saql-uhud-photos' }, at(-15, 20));
  void s5; void d2;

  // 2) مسودة: رحلة سَلع الداخلية القادمة
  const t5 = build('mb_t5', 'موجز تغطية: رحلة سَلع الداخلية', { kind: 'event', ref: { kind: 'trip', id: 't5' } }, 'mt_internal_trip');
  t5.createdAt = at(-2);

  // 3) أسبوعي بفعاليتين: رحلة سَلع ولقاء التركيز في أسبوعها. معتمد، وبعده تغيّر الجدول (تغيير معلّق)
  const trip5 = db.trips.find((t) => t.id === 't5')!;
  const weekStart = weekStartOf(trip5.startDate, db.settings.media.weekStartDay);
  const wk = build('mb_week', `موجز أسبوع ${weekStart}`, { kind: 'week', weekStart, refs: [{ kind: 'trip', id: 't5' }, { kind: 'focus', id: 'f_g1_7' }] }, 'mt_weekly');
  wk.content.title = 'موجز الأسبوع: رحلة سَلع ولقاء التركيز';
  wk.content.events[0].shots = tpl('mt_internal_trip').shots.slice(0, 4).map((s, i) => ({ id: `wk_s${i}`, title: s.title, priority: s.priority, required: s.required }));
  wk.content.events[0].interviews = [{ id: 'wk_i0', who: 'قائد فريق الرحلة', questions: ['ما أهم ما تريد أن يعرفه الجمهور عن الرحلة؟'], required: true }];
  wk.content.events[0].notes = 'الحافلة تتحرك في السابعة صباحاً، فيصل المصوّر قبلها بنصف ساعة.';
  wk.content.events[1].notes = 'لقاء مسائي داخل القاعة، إضاءة صفراء: يلزم رفع الحساسية.';
  wk.content.sections = wk.content.sections.map((s) => (s.key === 'responsibilities' || s.key === 'deadlines' ? { ...s, visible: true } : s.key === 'notes' ? { ...s, visible: false } : s));
  wk.content.responsibilities = [{ id: 'wr_1', task: 'تغطية رحلة سَلع (صور وفيديو)', owner: 'فريق التصوير أ' }, { id: 'wr_2', task: 'تغطية لقاء التركيز', owner: 'فريق التصوير ب' }, { id: 'wr_3', task: 'المونتاج والنشر', owner: 'فريق المونتاج' }];
  wk.content.deadlines = [{ id: 'wd_1', title: 'تسليم صور الرحلة', date: addDays(trip5.startDate, 1) }, { id: 'wd_2', title: 'تسليم المقطع الملخص', date: addDays(trip5.startDate, 3) }];
  wk.content.contacts = [{ id: 'wc_1', name: head.name, role: 'مسؤول التغطية الإعلامية', phone: head.phone, authorized: true }, { id: 'wc_2', name: 'قائد مجموعة سَلع', role: 'جهة داخلية', phone: '0555550123', authorized: false }];
  wk.createdAt = at(-4);
  approve(wk, -3);
  applyExec(wk, 'wk_s0', 'ريان الفريق', { status: 'in_progress' }, at(-1));
  // تغيّر جدول الرحلة بعد الاعتماد: يظهر «تغييرات بانتظار التأكيد»
  const items = trip5.schedule.plans[0]?.items ?? [];
  if (items[1]) { items[1].start = '09:15'; items[1].end = '10:15'; }
  const fm = db.focusMeetings.find((f) => f.id === 'f_g1_7');
  if (fm) fm.location = 'قاعة الاجتماعات الكبرى';

  db.mediaBriefs = [wk, t5, t3];
  // رابطان: قراءة فقط للأسبوعي، ومتابعة تنفيذ لرحلة أُحُد (ينتهي قريباً فيظهر في «المطلوب الآن»)
  db.mediaLinks = [
    { id: 'ml_read', briefId: 'mb_week', kind: 'read', tokenHash: tokenHash(MEDIA_DEMO_TOKENS.read), tokenTail: MEDIA_DEMO_TOKENS.read.slice(-6), createdBy: head.id, createdAt: at(-3), expiresAt: at(14), accessCount: 4, lastAccessAt: at(-1, 15) },
    { id: 'ml_track', briefId: 'mb_t3', kind: 'track', tokenHash: tokenHash(MEDIA_DEMO_TOKENS.track), tokenTail: MEDIA_DEMO_TOKENS.track.slice(-6), createdBy: head.id, createdAt: at(-16), expiresAt: at(2), accessCount: 9, lastAccessAt: at(-1, 21), lastVisitor: 'سامر المصوّر' },
  ];
  db.mediaActivity = [
    { id: 'ma_1', briefId: 'mb_t3', linkId: 'ml_track', itemId: s1.id, itemTitle: s1.title, actor: 'ريان الفريق', action: 'غيّر الحالة إلى «مكتملة»', at: at(-15, 18) },
    { id: 'ma_2', briefId: 'mb_t3', linkId: 'ml_track', itemId: s1.id, itemTitle: s1.title, actor: 'ريان الفريق', action: 'أضاف رابط إثبات', at: at(-15, 18) },
    { id: 'ma_3', briefId: 'mb_t3', linkId: 'ml_track', itemId: s3.id, itemTitle: s3.title, actor: 'سامر المصوّر', action: 'غيّر الحالة إلى «متعذرة» (تعذّر الدخول للقاعة بسبب إغلاقها أثناء الشرح)', at: at(-15, 18) },
  ];

  // فواتير إضافية: عهدة أُحُد (مراجعة وغير مراجعة) وعهدة العمرة
  const inv = (id: string, custodyId: string, who: string, amount: number, days: number, categoryId: string | undefined, description: string, review?: { note: string; days: number }) => {
    const c = db.custodies.find((x) => x.id === custodyId)!;
    db.extraInvoices.push({
      id, custodyId, ownerKind: c.ownerKind, ownerId: c.ownerId, addedBy: who, at: at(days), attachment: att(`إضافية-${id}.jpg`), amount, date: addDays(T, days), categoryId, description,
      review: review ? { by: 's5', at: at(review.days), note: review.note } : undefined,
    });
  };
  inv('xi_1', 'cu_t3', 'u1', 85, -15, 'bc_food', 'مياه ومشروبات اشتريتها بعد إقفال فاتورة الغداء');
  inv('xi_2', 'cu_t3', 'u1', 120, -14, undefined, 'تغليف هدايا المحاضر', { note: 'تُحفظ للاستفادة منها في موازنة الرحلات القادمة', days: -12 });
  inv('xi_3', 'cu_umrah', 's1', 60, -10, 'bc_transport', 'أجرة مواصلة إضافية للمرشد');
}
