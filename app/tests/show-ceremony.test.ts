/// <reference types="vite/client" />
// حفل «صقل 7»: هيكل الفقرات والمدد، «من أنا؟»، شبكة الأسماء، الاتفاقيات، التدشين، الخصوصية، والأوامر
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ceremonyConfig } from '@/show/ceremony/defaults';
import { PROGRAM_SLIDES, programSegments } from '@/show/ceremony/program';
import { agenda, agendaIndex, agreementAt, agreementSteps, emptyTiming, mergeEntries, parseCsv, parsePasted, rosterGrid, rosterPages, shuffled, spentOf, tick, totalMinutes, whoAt, whoHint, whoNext, whoReveal, whoSkip, whoStepCount } from '@/show/ceremony/logic';
import { next, sortSegments, stepCount } from '@/show/nav';
import { exportConfig, parseConfig } from '@/show/storage';
import { buildBundle, readBundle } from '@/show/transfer/bundle';
import { parseCommand } from '@/show/remote/protocol';
import { commandToMessage, messageToState } from '@/show/remote/display';
import type { ShowConfig, WhoAmISettings } from '@/show/model';

const who: WhoAmISettings = {
  heading: 'من أنا؟',
  entries: [
    { id: 'a', name: 'أحمد', group: 'أحد', fact: 'يحفظ أسماء النجوم', hints: ['يحب الليل', 'يقرأ كثيراً'] },
    { id: 'b', name: 'خالد', fact: 'طبخ لعشرين شخصاً', hints: [] },
    { id: 'c', name: 'سعد', fact: 'مُتخطّى', hints: [], skip: true },
    { id: 'd', name: 'فهد', fact: 'سافر وحده', hints: ['تلميح'] },
  ],
};

describe('هيكل الحفل', () => {
  const cfg = ceremonyConfig();
  const list = sortSegments(cfg.segments);
  it('الفقرات العشر بمددها: 59 دقيقة، والاتفاقيات بعد كلمة الجمعية مباشرة', () => {
    const items = agenda(list);
    expect(items.map((a) => a.title)).toEqual([
      'المقدمة والترحيب بالحضور', 'تلاوة آيات من القرآن الكريم', 'عرض فيديو', 'التعريف بالبرنامج', 'تدشين المنصة الإلكترونية',
      'فقرة التعارف «من أنا؟»', 'كلمة الجمعية', 'توقيع اتفاقيات التعاون', 'التقاط الصورة الجماعية', 'كيكة تدشين النسخة السابعة', 'الختام والشكر',
    ]);
    expect(totalMinutes(items)).toBe(59);
    expect(items.map((a) => a.minutes)).toEqual([3, 3, 5, 10, 5, 15, 5, 0, 5, 5, 3]);
  });
  it('التعريف بالبرنامج 11 شريحة أصلية قابلة للتعديل بنفس النصوص والتشكيل', () => {
    const prog = list.filter((s) => s.id.startsWith('c_prog'));
    expect(prog).toHaveLength(11);
    expect(PROGRAM_SLIDES).toHaveLength(11);
    const text = JSON.stringify(prog);
    for (const t of ['هلا بك في', 'صَقَلَ', 'الشيءَ: جَلّاه، وأزال عنه الصدأَ والكَدَر', '«انتقينا معادنَ نفيسة»', 'القائدَ الإنسان', 'مع الفريق', 'تعلُّم', 'سفرتان خارج المدينة', 'حفل الختام وحصاد الرحلة', 'يُكوِّن', 'بنسخةٍ أفضلَ من نفسه'])
      expect(text, t).toContain(t);
    // لا صور مستوردة من pptx: كلها نصوص وأشكال
    expect(prog.every((s) => s.type === 'slide' && s.settings.elements.every((e) => e.type === 'text' || e.type === 'shape'))).toBe(true);
    // الشرائح 5–8 بناء تدريجي
    for (const i of [4, 5, 6, 7]) expect(stepCount(prog[i]), prog[i].title).toBeGreaterThan(2);
  });
  it('التدشين ثم فيديو ثم الديمو، ثم «من أنا؟» وشبكة الأسماء', () => {
    const i = list.findIndex((s) => s.type === 'launch');
    expect(list.slice(i, i + 3).map((s) => s.type)).toEqual(['launch', 'slide', 'demo']);
    expect(JSON.stringify(list[i + 1])).toContain('"video"');
    const w = list.findIndex((s) => s.type === 'whoami');
    expect(list[w + 1].type).toBe('roster');
  });
  it('show.json في المستودع مطابق للعرض الافتراضي وبلا أي بيانات شخصية', () => {
    const repo = parseConfig(readFileSync('public/show.json', 'utf8'));
    expect(repo.segments.length).toBe(cfg.segments.length);
    const raw = readFileSync('public/show.json', 'utf8');
    expect(raw).not.toMatch(/"(personId|fact|hints)"/);
    expect(repo.segments.find((s) => s.type === 'whoami')!.settings).toMatchObject({ entries: [] });
    expect(repo.segments.find((s) => s.type === 'roster')!.settings).toMatchObject({ people: [] });
  });
  it('المدد لا تدخل في أي شريحة', () => {
    const slides = JSON.stringify(list.map((s) => s.settings));
    expect(slides).not.toMatch(/دقيقة|دقائق|\b59\b/);
  });
});

describe('«من أنا؟»', () => {
  it('الخطوات: بداية، ثم لكل مشارك معلومة وتلميحاته وكشف، والمتخطّى لا يظهر', () => {
    expect(whoStepCount(who)).toBe(1 + (2 + 2) + (0 + 2) + (1 + 2));
    expect(whoAt(who, 0)).toMatchObject({ kind: 'intro', total: 3 });
    expect(whoAt(who, 1)).toMatchObject({ kind: 'fact', index: 0, hintsShown: 0 });
    expect(whoAt(who, 3)).toMatchObject({ kind: 'fact', index: 0, hintsShown: 2 });
    expect(whoAt(who, 4)).toMatchObject({ kind: 'reveal', index: 0 });
  });
  it('التالي يكشف ثم ينتقل، والتلميح يعرض التالي، والتخطي ينتقل بلا كشف', () => {
    expect(whoNext(who, 0)).toBe(1);
    expect(whoNext(who, 1)).toBe(4);
    expect(whoNext(who, 4)).toBe(5);
    expect(whoHint(who, 1)).toBe(2);
    expect(whoHint(who, 3)).toBeNull();
    expect(whoHint(who, 5)).toBeNull();
    expect(whoReveal(who, 2)).toBe(4);
    expect(whoSkip(who, 1)).toBe(5);
    expect(whoNext(who, whoStepCount(who) - 1)).toBeNull();
  });
  it('التنقل العام: التالي في «من أنا؟» يكشف، وبعد الأخير الفقرة التالية', () => {
    const cfg: ShowConfig = { schemaVersion: 2, title: '', theme: 'dark', updatedAt: '', segments: [{ id: 'w', type: 'whoami', title: '', order: 0, settings: who }, { id: 'x', type: 'photo', title: '', order: 1, settings: { heading: '', sub: '', seconds: 3 } }] };
    let p = { seg: 0, step: 0 };
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      p = next(cfg, p);
      seen.push(p.seg === 0 ? whoAt(who, p.step).kind : 'next');
    }
    expect(seen).toEqual(['fact', 'reveal', 'fact', 'reveal', 'fact', 'reveal', 'next', 'next']);
  });
  it('السحب من المنصة يبقي المعلومات ويضيف الجدد، والخلط يبقي الجميع', () => {
    let i = 0;
    const merged = mergeEntries([{ id: 'a', personId: 'p1', name: 'قديم', fact: 'معلومة', hints: [] }], [{ personId: 'p1', name: 'أحمد', group: 'أحد' }, { personId: 'p2', name: 'خالد' }], () => `n${i++}`);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ name: 'أحمد', group: 'أحد', fact: 'معلومة' });
    expect(merged[1]).toMatchObject({ personId: 'p2', fact: '' });
    expect(shuffled(who.entries, () => 0.5).map((e) => e.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('لصق قائمة وCSV بالعربية', () => {
    let i = 0;
    const id = () => `x${i++}`;
    expect(parsePasted('أحمد - يحفظ النجوم | يحب الليل\nمعلومة وحدها', id)).toMatchObject([{ name: 'أحمد', fact: 'يحفظ النجوم', hints: ['يحب الليل'] }, { name: '', fact: 'معلومة وحدها' }]);
    const rows = parseCsv('الاسم,المجموعة,المعلومة,تلميح 1\n"أحمد، الأول",أحد,"قال ""نعم""",يقرأ\n', id);
    expect(rows).toMatchObject([{ name: 'أحمد، الأول', group: 'أحد', fact: 'قال "نعم"', hints: ['يقرأ'] }]);
  });
});

describe('شبكة الأسماء والاتفاقيات', () => {
  it('35 اسماً ← 7×5، والزائد صفحات', () => {
    expect(rosterGrid(35)).toEqual({ cols: 7, rows: 5 });
    const people = Array.from({ length: 50 }, (_, i) => ({ name: `اسم ${i}` }));
    expect(rosterPages({ heading: '', source: 'participants', people, perPage: 35 }).map((p) => p.length)).toEqual([35, 15]);
  });
  it('الاتفاقيات: افتتاح، ثم جهة جهة، ثم الشبكة، من 1 إلى 8 جهات', () => {
    for (const n of [1, 4, 8]) {
      const s = { heading: '', hostName: '', parties: Array.from({ length: n }, (_, i) => ({ id: `${i}`, name: `${i}`, title: '', rep: '', repTitle: '' })) };
      expect(agreementSteps(s)).toBe(n + 2);
      expect(agreementAt(s, 0).kind).toBe('intro');
      expect(agreementAt(s, n).kind).toBe('party');
      expect(agreementAt(s, n + 1).kind).toBe('all');
    }
  });
});

describe('ساعة الحفل', () => {
  it('تحسب الزمن الفعلي لكل فقرة وتنتقل معها', () => {
    let t = emptyTiming();
    t = tick(t, '0:أ', 1000);
    t = tick(t, '1:ب', 61_000);
    expect(spentOf(t, '0:أ', 99_000)).toBe(60_000);
    expect(spentOf(t, '1:ب', 91_000)).toBe(30_000);
    t = tick(t, null, 121_000);
    expect(spentOf(t, '1:ب', 500_000)).toBe(60_000);
    expect(t.startedAt).toBe(1000);
  });
  it('الفقرة الحالية من موضع العرض', () => {
    const items = agenda(sortSegments(ceremonyConfig().segments));
    expect(items[agendaIndex(items, 5)].title).toBe('التعريف بالبرنامج');
  });
});

describe('الخصوصية والنقل', () => {
  const cfg: ShowConfig = { ...ceremonyConfig() };
  cfg.segments = cfg.segments.map((s) => (s.type === 'whoami' ? { ...s, settings: who } : s.type === 'roster' ? { ...s, settings: { ...s.settings, people: [{ name: 'أحمد', group: 'أحد' }] } } : s));
  it('تصدير JSON بلا أسماء ولا معلومات، وملف العرض الكامل يحملها كلها', async () => {
    const json = exportConfig(cfg);
    expect(json).not.toContain('يحفظ أسماء النجوم');
    expect(json).not.toContain('أحمد');
    const back = await readBundle(await buildBundle(cfg, []));
    expect(back.config.segments.find((s) => s.type === 'whoami')!.settings).toEqual(who);
    expect(JSON.stringify(back.config)).toContain('أحمد');
  });
  it('القراءة تحفظ كل أنواع الفقرات والفقرات في الجدول', () => {
    const again = parseConfig(exportConfig(cfg, { personal: true }));
    expect(again.segments.map((s) => s.type)).toEqual(cfg.segments.map((s) => s.type));
    expect(again.segments.filter((s) => s.section).length).toBe(11);
    expect(again.segments.find((s) => s.id === 'c_cake')!.settings).toMatchObject({ fx: 'confetti' });
  });
});

describe('أوامر الجوال والحالة', () => {
  it('أوامر الحفل معروفة وتصير رسائل للعرض', () => {
    for (const c of ['hint', 'reveal', 'skip', 'launch', 'photo', 'skipVideo']) {
      expect(parseCommand({ type: c })).toEqual({ type: c });
      expect(commandToMessage({ type: c } as never)).toEqual({ type: 'cue', cue: c });
    }
  });
  it('الحالة للجوال تحمل الوصف والجدول ولا تحمل الإعدادات', () => {
    const st = messageToState({ type: 'state', pos: { seg: 0, step: 0 }, started: true, outline: [{ title: 'أ', type: 'whoami' }], live: { sub: '1 من 3', agenda: [{ title: 'أ', minutes: 3, spent: 0 }], agendaAt: 0 } });
    expect(st?.live).toMatchObject({ sub: '1 من 3' });
    expect(JSON.stringify(st)).not.toContain('segments');
  });
  it('قواعد Firebase تقبل أوامر الحفل', () => {
    const raw = Object.values(import.meta.glob('../firebase/database.rules.json', { query: '?raw', import: 'default', eager: true }))[0] as string;
    expect(JSON.parse(raw).rules.sessions.$key.commands.$cmd['.validate']).toContain('hint|reveal|skip|launch|photo|skipVideo');
  });
  it('شرائح التعريف تُنشأ بمعرّفات فريدة', () => {
    const a = programSegments('x');
    expect(new Set(a.flatMap((s) => s.settings.elements.map((e) => e.id))).size).toBe(a.reduce((n, s) => n + s.settings.elements.length, 0));
  });
});
