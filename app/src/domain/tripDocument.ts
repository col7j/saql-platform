// وثيقة الرحلة (الرئيسي 3): بنيتها بيانات (db.settings.docTemplate)، ومحتواها يُحفظ في حقول وثيقتي الرحلة.
// الخطة المبدئية = الأقسام 1 إلى 4، والتفصيلية = 5 إلى 10. الجدول الزمني والموازنة يُعرضان ضمنها بلا تكرار.
import { linesTotal } from './finance';
import type { BudgetLine, DB, DocKind, DocSectionDef, ID, Trip, TripDoc } from './types';

export type DocRow = Record<string, string> & { id: string };

const T2: DocSectionDef['tripTypes'] = ['internal', 'external'];
const EXT: DocSectionDef['tripTypes'] = ['external'];

export function defaultDocTemplate(): DocSectionDef[] {
  return [
    { id: 'identity', title: 'هوية الرحلة', stage: 'initial', kind: 'fields', tripTypes: T2, fields: [
      { key: 'title', label: 'عنوان الرحلة' }, { key: 'slogan', label: 'الشعار اللفظي (مثل: رفقة وأثر)' }, { key: 'destination', label: 'الوجهة' },
      { key: 'departure', label: 'تاريخ الانطلاق' }, { key: 'returnDate', label: 'تاريخ العودة' },
    ] },
    { id: 'justification', title: 'المبررات', stage: 'initial', kind: 'fields', tripTypes: T2, fields: [
      { key: 'whyPlace', label: 'لماذا هذه الوجهة؟', long: true }, { key: 'whyDate', label: 'لماذا هذا التاريخ؟', long: true },
    ] },
    { id: 'transport', title: 'المواصلات', stage: 'initial', kind: 'fields', tripTypes: T2, fields: [
      { key: 'transportType', label: 'نوع المواصلات' }, { key: 'whyTransport', label: 'لماذا هذا النوع؟', long: true },
    ] },
    { id: 'goals', title: 'أهداف الرحلة', stage: 'initial', kind: 'goals', tripTypes: T2 },
    { id: 'activities', title: 'أنشطة الرحلة', stage: 'detailed', kind: 'table', tripTypes: T2, columns: [
      { key: 'goal', label: 'الهدف', type: 'goal' }, { key: 'activity', label: 'النشاط' }, { key: 'desc', label: 'شرح مبسط' }, { key: 'count', label: 'العدد', type: 'number' },
      { key: 'prep', label: 'التجهيزات' }, { key: 'place', label: 'المكان' }, { key: 'cost', label: 'التكلفة التقديرية', type: 'number' }, { key: 'budgetLine', label: 'بند الميزانية (اختياري)', type: 'text' },
    ] },
    { id: 'approvals', title: 'الموافقات', stage: 'detailed', kind: 'table', tripTypes: T2, columns: [
      { key: 'name', label: 'الموافقة' }, { key: 'desc', label: 'شرح مبسط' }, { key: 'authority', label: 'الجهة' }, { key: 'done', label: 'تمت؟', type: 'yesno' },
      { key: 'reason', label: 'السبب إن لم تتم' }, { key: 'owner', label: 'المسؤول', type: 'person' }, { key: 'due', label: 'الموعد', type: 'date' },
    ] },
    { id: 'housing', title: 'السكن', stage: 'detailed', kind: 'table', tripTypes: EXT, columns: [
      { key: 'type', label: 'النوع' }, { key: 'location', label: 'الموقع' }, { key: 'units', label: 'عدد الوحدات', type: 'number' }, { key: 'equipment', label: 'التجهيزات' },
      { key: 'facilities', label: 'المرافق' }, { key: 'why', label: 'لماذا اختير؟' },
    ] },
    { id: 'families', title: 'وسائل التواصل مع أسر المستفيدين', stage: 'detailed', kind: 'table', tripTypes: EXT, columns: [
      { key: 'method', label: 'الوسيلة' }, { key: 'desc', label: 'شرح مبسط' },
    ] },
    { id: 'health', title: 'التجهيزات الصحية', stage: 'detailed', kind: 'table', tripTypes: T2, columns: [
      { key: 'item', label: 'التجهيز' }, { key: 'owner', label: 'المسؤول', type: 'person' }, { key: 'purpose', label: 'الغرض' },
    ] },
    { id: 'schedule_budget', title: 'الجدول الزمني والموازنة التفصيلية', stage: 'detailed', kind: 'embed', tripTypes: T2 },
  ];
}

export const defaultSuggestedGoals = () => ({
  educational: [
    'تعزيز جوانب عجلة الحياة', 'تطبيق مهارة التخطيط والتنظيم', 'ممارسة القيادة الفاعلة وتحفيز الجهود الجماعية', 'التدرّب على إدارة الصراعات', 'ممارسة حل المشكلات واتخاذ القرارات',
  ],
  social: ['تقوية الروابط بين المشاركين', 'بناء روح الفريق', 'التعرّف على بيئات جديدة وتواصل مع المجتمع'],
});

/** أقسام الوثيقة لرحلة ومرحلة: من نسخة الرحلة إن وُجدت (وإلا من الإعدادات)، مع إخفاء ما لا يخص نوعها */
export function sectionsFor(db: DB, trip: Trip, stage?: DocSectionDef['stage']): DocSectionDef[] {
  const all = trip.docTemplate ?? db.settings.docTemplate;
  return all.filter((s) => s.tripTypes.includes(trip.type) && (!stage || s.stage === stage));
}
export const docKindStage = (k: DocKind): DocSectionDef['stage'] | null => (k === 'document' ? 'initial' : k === 'detailed' ? 'detailed' : null);

// ───────────── القيم داخل حقول الوثيقة ─────────────
export function rowsOf(fields: Record<string, string>, sectionId: string): DocRow[] {
  try {
    const v = JSON.parse(fields[`tbl:${sectionId}`] ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export const withRows = (fields: Record<string, string>, sectionId: string, rows: DocRow[]) => ({ ...fields, [`tbl:${sectionId}`]: JSON.stringify(rows) });
export function goalsOf(fields: Record<string, string>): { educational: string[]; social: string[] } {
  try {
    const v = JSON.parse(fields['goals'] ?? '{}');
    return { educational: v.educational ?? [], social: v.social ?? [] };
  } catch {
    return { educational: [], social: [] };
  }
}
export const withGoals = (fields: Record<string, string>, g: { educational: string[]; social: string[] }) => ({ ...fields, goals: JSON.stringify(g) });

/** ربط النشاط ببند الميزانية: تُقرأ التكلفة من الميزانية فلا تتكرر الأرقام. يعيد التكلفة الفعلية للصف */
export function activityCost(lines: BudgetLine[] | undefined, row: DocRow): number {
  const linked = row.budgetLine ? lines?.find((l) => l.id === row.budgetLine) : undefined;
  return linked ? linked.qty * linked.price : Number(row.cost) || 0;
}
export const activitiesTotal = (lines: BudgetLine[] | undefined, rows: DocRow[]) => rows.reduce((s, r) => s + activityCost(lines, r), 0);

/** نواقص قسم قبل الرفع (رسالة لكل نقص) */
export function sectionGaps(def: DocSectionDef, doc: TripDoc): string[] {
  if (def.kind === 'fields') return (def.fields ?? []).filter((f) => !(doc.fields[f.key] ?? '').trim()).map((f) => `${def.title}: ${f.label}`);
  if (def.kind === 'goals') {
    const g = goalsOf(doc.fields);
    return g.educational.length + g.social.length ? [] : [`${def.title}: اختر هدفاً واحداً على الأقل`];
  }
  if (def.kind === 'table') return rowsOf(doc.fields, def.id).length ? [] : [`${def.title}: أضف صفاً واحداً على الأقل`];
  return [];
}
export const docGaps = (db: DB, trip: Trip, doc: TripDoc): string[] => {
  const stage = docKindStage(doc.kind);
  return stage ? sectionsFor(db, trip, stage).flatMap((s) => sectionGaps(s, doc)) : [];
};

/** التنسيقات للرحلة الخارجية: عرض متابعة للموافقات والسكن (بمسؤولها وموعدها وحالتها) بلا تكرار بيانات */
export function coordinationView(db: DB, trip: Trip, doc: TripDoc | undefined, nameOf: (id: ID) => string) {
  const rows = doc ? { approvals: rowsOf(doc.fields, 'approvals'), housing: rowsOf(doc.fields, 'housing') } : { approvals: [], housing: [] };
  return {
    approvals: rows.approvals.map((r) => ({ name: r.name, authority: r.authority, owner: r.owner ? nameOf(r.owner) : '—', due: r.due, done: r.done === 'yes', reason: r.reason })),
    housing: rows.housing.map((r) => ({ type: r.type, location: r.location, units: r.units })),
    transport: trip.coordinations.find((c) => c.key === 'transport'),
    hosting: trip.coordinations.find((c) => c.key === 'hosting'),
  };
}
export { linesTotal };
