// الأشخاص والمجموعات واللجان في البيانات التجريبية
import { hashPassword } from '@/domain/crypto';
import type { Account, Committee, CommitteeMembership, Group, Person } from '@/domain/types';

export const LEADER_ID = 'p_lead';
export const TECH_LEAD_ID = 's6';
/** كلمة مرور كل الحسابات التجريبية (تظهر في صفحة الدخول) */
export const DEMO_PASSWORD = 'saql2026';

const staffRaw: [string, string, string][] = [
  ['s1', 'خالد العمري', 'ميسّر مجموعة أُحُد · عضو اللجنة المالية'],
  ['s2', 'فيصل الجهني', 'ميسّر مجموعة قُباء · عضو اللجنة الإعلامية'],
  ['s3', 'أنس المطيري', 'ميسّر مجموعة سَلع · عضو اللجنة المالية'],
  ['s4', 'سلمان الأحمدي', 'ميسّر مجموعة العقيق · عضو اللجنة الإعلامية'],
  ['s5', 'ماجد الصاعدي', 'مسؤول المالية'],
  ['s6', 'طارق السهلي', 'مسؤول اللجنة التقنية · مسؤول اللجنة الإعلامية'],
  ['s7', 'عادل الرفاعي', 'متابع الرحلات · عضو اللجنة التقنية'],
];

const participantNames = [
  'عمر الحربي', 'يوسف الرحيلي', 'عبدالرحمن السناني', 'إبراهيم الجهني', 'سعد المحمدي', 'محمد الأنصاري',
  'أحمد العوفي', 'مهند الصبحي', 'بدر الشريف', 'ريان القرشي', 'نواف الزهراني', 'حمزة البلوي',
  'زياد العتيبي', 'مشعل الغامدي', 'تركي السلمي', 'عبدالعزيز الحازمي', 'ياسر الشهري', 'معاذ اليوبي',
  'عبدالإله الفايدي', 'سلطان الردادي', 'راكان المغامسي', 'هشام البدراني', 'وليد التميمي', 'أسامة العنزي',
];
const universities = ['الجامعة الإسلامية', 'جامعة طيبة', 'جامعة طيبة', 'الجامعة الإسلامية', 'كليات الريان', 'جامعة طيبة'];
const majors = ['هندسة برمجيات', 'إدارة أعمال', 'شريعة', 'طب', 'محاسبة', 'علوم حاسب', 'لغة عربية', 'هندسة مدنية', 'صيدلة', 'نظم معلومات'];

export function buildPeople(): Person[] {
  const leader: Person = { id: LEADER_ID, name: 'عبدالله الحربي', kind: 'staff', isGeneralLeader: true, email: 'leader@saql.example', phone: '0550000001', title: 'القائد العام للبرنامج' };
  const staff: Person[] = staffRaw.map(([id, name, title], i) => ({ id, name, kind: 'staff', email: `${id}@saql.example`, phone: `05500000${10 + i}`, title }));
  const participants: Person[] = participantNames.map((name, i) => ({
    id: `u${i + 1}`,
    name,
    kind: 'participant',
    email: `u${i + 1}@student.example`,
    phone: `05611${String(1000 + i)}`,
    university: universities[i % universities.length],
    major: majors[i % majors.length],
    // أكملوا ملفاتهم أول دخول، إلا الأخير (لتجربة أول دخول)
    ...(i < participantNames.length - 1 ? { bank: { iban: `SA03800000006080101${String(67500 + i).padStart(5, '0')}`, bankName: ['الراجحي', 'الأهلي', 'الإنماء'][i % 3] }, profileCompletedAt: new Date(Date.now() - 55 * 86400000).toISOString() } : {}),
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
    const memberIds = Array.from({ length: 6 }, (_, k) => `u${gi * 6 + k + 1}`);
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
    { ...m('c_fin', 's1', 'member', true), financePerms: ['view_budget', 'approve_within', 'review_invoices'] },
    { ...m('c_fin', 's3', 'member', false), financePerms: [] }, // بلا صلاحيات مفوّضة: لا يرى أزرار الصرف
    m('c_media', 's6', 'leader', false),
    m('c_media', 's2', 'member', false),
    m('c_media', 's4', 'member', false),
    m('c_media', 'u9', 'member', false), // مشارك ضمن الإعلامية بموافقة القائد العام
    m('c_tech', 's6', 'leader', false),
    m('c_tech', 's7', 'member', false),
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
