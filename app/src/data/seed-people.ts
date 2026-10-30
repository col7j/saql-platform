// الأشخاص والمجموعات واللجان في البيانات التجريبية
import { hashPassword } from '@/domain/crypto';
import type { Account, Committee, CommitteeMembership, Group, Person } from '@/domain/types';

export const LEADER_ID = 'p_lead';
export const TECH_LEAD_ID = 's6';
/** كلمة مرور كل الحسابات التجريبية (تظهر في صفحة الدخول) */
export const DEMO_PASSWORD = 'saql2026';

const staffRaw: [string, string, string][] = [
  ['s1', 'أنس طلال الأحمدي', 'ميسّر مجموعة أُحُد'],
  ['s2', 'محمد دبور', 'ميسّر مجموعة قُباء'],
  ['s3', 'عثمان وائل الشريف', 'ميسّر مجموعة سَلع'],
  ['s4', 'هود الشنقيطي', 'ميسّر مجموعة العقيق'],
  ['s5', 'حمزة النهادي', 'مسؤول اللجنة المالية'],
  ['s6', 'محمد الحاج', 'مسؤول اللجنة الإعلامية والتقنية'],
  ['s7', 'أحمد عمران', 'متابع الرحلات'],
];

/** المشاركون: u1..u24 ست لكل مجموعة كما كانت، ثم u25..u28 واحد لكل مجموعة (سبعة في كل مجموعة) */
const participantNames = [
  'أحمد منير أحمد حامد', 'أصيل نايف الجهني', 'عبدالعزيز محمد الأنصاري', 'عبدالله ناير معيض الرشيدي', 'الليث عبدالرحمن الخالد', 'محمد عمر الحربي',
  'براء عبدالهادي حمدي', 'محمود يحيى الحاج', 'حسان محمد عالم', 'أحمد محمد بارود', 'عبادة بن صلاح قطب', 'محمد ناصر الشريف',
  'عبدالعزيز عيسى الحاج', 'عمر عيسى الحاج', 'عبدالرحمن وليد الأحمدي', 'سليمان عبده لعبان', 'حامد محمد سرور', 'الفيصل عامر الحوراني',
  'يامن إبراهيم الهندي', 'يحيى محمد أبولبن', 'محمد سالم باوزير', 'عبدالسلام عبدالشكور عبدالله', 'زياد محمد بن محفوظ', 'معتز خالد الأنصاري',
  'عثمان عبدالرحمن الخالد', 'عبدالرحمن عبدالله الموسى', 'محمد رائد الجاروشة', 'البراء بشير شيخ النجارين',
];
/** المشارك الذي لم يكمل ملفه بعد (لتجربة أول دخول) */
const ONBOARDING_ID = 'u24';
const universities = ['الجامعة الإسلامية', 'جامعة طيبة', 'جامعة طيبة', 'الجامعة الإسلامية', 'كليات الريان', 'جامعة طيبة'];
const majors = ['هندسة برمجيات', 'إدارة أعمال', 'شريعة', 'طب', 'محاسبة', 'علوم حاسب', 'لغة عربية', 'هندسة مدنية', 'صيدلة', 'نظم معلومات'];

export function buildPeople(): Person[] {
  const leader: Person = { id: LEADER_ID, name: 'أحمد يحيى الحاج', kind: 'staff', isGeneralLeader: true, email: 'leader@saql.example', phone: '0550000001', title: 'القائد العام للبرنامج' };
  const staff: Person[] = staffRaw.map(([id, name, title], i) => ({ id, name, kind: 'staff', email: `${id}@saql.example`, phone: `05500000${10 + i}`, title }));
  const participants: Person[] = participantNames.map((name, i) => ({
    id: `u${i + 1}`,
    name,
    kind: 'participant',
    email: `u${i + 1}@student.example`,
    phone: `05611${String(1000 + i)}`,
    university: universities[i % universities.length],
    major: majors[i % majors.length],
    // أكملوا ملفاتهم أول دخول، إلا واحداً (لتجربة أول دخول)
    ...(`u${i + 1}` !== ONBOARDING_ID ? { bank: { iban: `SA03800000006080101${String(67500 + i).padStart(5, '0')}`, bankName: ['الراجحي', 'الأهلي', 'الإنماء'][i % 3] }, profileCompletedAt: new Date(Date.now() - 55 * 86400000).toISOString() } : {}),
  }));
  return [leader, ...staff, ...participants];
}

export function buildGroups(): Group[] {
  const defs: [string, string, string, string][] = [
    ['g1', 'مجموعة أُحُد', '#00708c', 's1'],
    ['g2', 'مجموعة قُباء', '#f79845', 's2'],
    ['g3', 'مجموعة سَلع', '#2fa37b', 's3'],
    ['g4', 'مجموعة العقيق', '#6b6fc9', 's4'],
  ];
  return defs.map(([id, name, color, fac], gi) => {
    const memberIds = [...Array.from({ length: 6 }, (_, k) => `u${gi * 6 + k + 1}`), `u${25 + gi}`];
    return { id, name, color, facilitatorId: fac, leaderId: memberIds[0], memberIds };
  });
}

export function buildCommittees(): { committees: Committee[]; memberships: CommitteeMembership[] } {
  const committees: Committee[] = [
    {
      id: 'c_fin', name: 'اللجنة المالية', kind: 'finance', description: 'البنود والعهد والفواتير والرسوم والتحليل المالي.',
      kpis: [
        { id: 'k1', title: 'صرف العهد في وقتها', target: 11, taskTag: 'custody_issue' },
        { id: 'k2', title: 'إغلاق مالي لكل رحلة', target: 11, taskTag: 'custody_close' },
      ],
    },
    {
      id: 'c_media', name: 'اللجنة الإعلامية', kind: 'media', description: 'التوثيق والتغطية والنشرات.',
      kpis: [
        { id: 'k3', title: 'ملف توثيق لكل رحلة', target: 11, taskTag: 'doc_file' },
        { id: 'k4', title: 'تغريدة لكل رحلة', target: 11, taskTag: 'tweet' },
        { id: 'k5', title: 'نشرة لكل رحلة خارجية', target: 5, taskTag: 'newsletter' },
      ],
    },
    { id: 'c_tech', name: 'اللجنة التقنية', kind: 'tech', description: 'المستخدمون وكلمات المرور، وفتح قفل الإعدادات.', kpis: [] },
    { id: 'c_gen', name: 'لجنة الإدارة العامة', kind: 'general', description: 'كل أعضاء فريق العمل.', kpis: [] },
  ];
  let n = 0;
  const m = (committeeId: string, personId: string, role: 'leader' | 'member', canSeeFinance: boolean): CommitteeMembership => ({ id: `cm_${++n}`, committeeId, personId, role, canSeeFinance });
  const memberships: CommitteeMembership[] = [
    // مسؤول المالية بلا أي صفة ثانية (قواعد التعارض في defaults.ts)
    { ...m('c_fin', 's5', 'leader', true), financePerms: ['view_budget', 'manage_categories', 'approve_within', 'disburse', 'review_invoices', 'close_custody'] },
    // الميسّرون ميسّرون فقط، ومتابع الرحلات بلا لجنة
    m('c_media', 's6', 'leader', false),
    m('c_media', 'u9', 'member', false), // مشارك ضمن الإعلامية بموافقة القائد العام
    m('c_tech', 's6', 'leader', false),
    m('c_gen', LEADER_ID, 'leader', false),
    ...['s1', 's2', 's3', 's4', 's5', 's6', 's7'].map((id) => m('c_gen', id, 'member', false)),
  ];
  return { committees, memberships };
}

/** حساب لكل شخص: اسم الدخول من البريد، وكلمة المرور التجريبية الموحّدة */
export function buildAccounts(persons: Person[], at: string): Account[] {
  return persons.map((p) => ({
    personId: p.id,
    username: p.email.split('@')[0].toLowerCase(),
    salt: p.id,
    passwordHash: hashPassword(DEMO_PASSWORD, p.id),
    mustChangePassword: false,
    disabled: false,
    updatedAt: at,
    updatedBy: TECH_LEAD_ID,
  }));
}
