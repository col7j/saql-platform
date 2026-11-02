// الصلاحيات (شاشة مركزية للقائد العام ومساعده): تعيين الصفات ومنح الصلاحيات للجان وسحبها. مسؤول التقنية لا يمنح صلاحيات برنامج
import { FINANCE_PERMS } from '@/domain/finance';
import { MEDIA_PERMS } from '@/domain/media';
import type { Committee } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Card, Notice, PageHeader, Select } from '@/ui';
import { Link } from 'react-router-dom';

const catalogOf = (c: Committee): { key: string; label: string }[] => (c.kind === 'finance' ? FINANCE_PERMS : MEDIA_PERMS).map((p) => ({ key: p.key, label: p.label }));

export default function PermissionsPage() {
  const db = useDB();
  const me = useMe();
  const canWrite = me.isGeneralLeader || me.isAssistant;
  const facilitators = db.groups.map((g) => g.facilitatorId).filter((x): x is string => !!x);
  return (
    <div className="space-y-4">
      <PageHeader title="الصلاحيات" subtitle="تعيين الصفات ومنح الصلاحيات للجان وسحبها. كل تغيير يُسجَّل في السجل المركزي" />
      {!canWrite && <Notice>عرض للقراءة فقط.</Notice>}
      <Card title="مندوب الجمعية" subtitle="ميسّر واحد يصدر الخطابات، ويجوز تحويل الصفة لآخر">
        <Select value={db.settings.societyDelegateId ?? ''} disabled={!canWrite} onChange={(e) => e.target.value && act(() => repos.letters.assignDelegate(e.target.value), 'عُيّن المندوب')}
          options={[{ value: '', label: 'اختر ميسّراً' }, ...facilitators.map((id) => ({ value: id, label: personName(db, id) }))]} aria-label="مندوب الجمعية" />
      </Card>
      {db.committees.filter((c) => c.kind === 'finance' || c.kind === 'media').map((c) => {
        const cat = catalogOf(c);
        const ceiling = c.grantedPerms ?? cat.map((p) => p.key);
        const members = db.memberships.filter((m) => m.committeeId === c.id);
        return (
          <Card key={c.id} title={c.name} subtitle={c.kind === 'media' ? 'تحدد هنا سقف ما تملكه اللجنة، ويمنح مسؤول التقنية أعضاءها من «الإعدادات» ضمن هذا السقف' : 'ما منحته للجنة (سقف)، ثم ما يملكه كل عضو ضمنه. وتفويض مسؤول اللجنة داخلها يبقى ضمن هذا السقف'}>
            <div className="mb-3 flex flex-wrap gap-3">
              {cat.map((p) => (
                <label key={p.key} className="flex min-h-[36px] items-center gap-1.5 text-sm">
                  <input type="checkbox" disabled={!canWrite} checked={ceiling.includes(p.key)} onChange={(e) => act(() => repos.permissions.setCommitteeCeiling(c.id, e.target.checked ? [...ceiling, p.key] : ceiling.filter((x) => x !== p.key)), 'حُدِّث سقف اللجنة')} />
                  {p.label}
                </label>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-ink-500"><th className="px-2 py-1 text-start font-medium">العضو</th>{cat.map((p) => <th key={p.key} className="px-2 py-1 text-start font-medium">{p.label}</th>)}</tr></thead>
                <tbody>
                  {members.map((m) => {
                    const has = (k: string) => m.role === 'leader' || (c.kind === 'finance' ? (m.financePerms ?? []) : (m.mediaPerms ?? [])).includes(k as never);
                    return (
                      <tr key={m.id} className="border-t border-ink-100">
                        <td className="px-2 py-1">{personName(db, m.personId)} {m.role === 'leader' && <Badge tone="blue">مسؤول</Badge>}</td>
                        {cat.map((p) => (
                          <td key={p.key} className="px-2 py-1">
                            <input type="checkbox" aria-label={`${p.label} — ${personName(db, m.personId)}`} disabled={!canWrite || c.kind === 'media' || m.role === 'leader' || !ceiling.includes(p.key)} checked={has(p.key)} onChange={(e) => act(() => repos.permissions.setMemberPerm(c.id, m.personId, p.key, e.target.checked), e.target.checked ? 'مُنحت الصلاحية' : 'سُحبت الصلاحية')} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
      <Card title="صلاحيات مؤقتة وصفات أخرى">
        <p className="text-sm text-ink-600">الصلاحيات المؤقتة (تحرير الموقع، تصنيفات الجدول) وقواعد تعارض الصفات وتشكيل اللجان من <Link className="text-brand-700 underline" to="/app/people">الأشخاص</Link>.</p>
      </Card>
    </div>
  );
}
