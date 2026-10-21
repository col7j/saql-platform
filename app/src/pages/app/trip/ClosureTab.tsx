// الإغلاق (قسم 6.10) والتقييم: نماذج الفريق، الإغلاق المالي، التقرير، تقييم المتابع والقائد العام
import { useState } from 'react';
import { canTrackTrip, tripTeamLeaderId } from '@/domain/permissions';
import { closureChecks, isApproved } from '@/domain/workflow';
import type { Trip } from '@/domain/types';
import { act, repos, useDB, useMe, useScores } from '@/state/store';
import { Badge, Button, Card, Checklist, Field, Icons, Input, Notice, Stars, Textarea } from '@/ui';

export default function ClosureTab({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const scores = useScores();
  const isLead = tripTeamLeaderId(db, trip) === me.person.id;
  const isTracker = canTrackTrip(db, me.person.id, trip);
  const canEval = isTracker || me.isLeader;
  const [forms, setForms] = useState({ teamEvalForm: trip.closure.teamEvalForm ?? '', experienceForm: trip.closure.experienceForm ?? '', publicReport: trip.closure.publicReport ?? '' });
  const [ev, setEv] = useState({ trackerScore: trip.evaluation.trackerScore ?? 0, trackerNote: trip.evaluation.trackerNote ?? '', leaderScore: trip.evaluation.leaderScore ?? 0, leaderNote: trip.evaluation.leaderNote ?? '' });
  const manualItems = db.settings.evaluationItems.filter((i) => i.scope === 'group' && i.enabled && (i.mode === 'manual' || i.mode === 'mixed') && i.key !== 'trip_eval');
  const groupScore = trip.executor.kind === 'group' ? scores.groups.find((g) => g.groupId === (trip.executor as { groupId: string }).groupId) : undefined;
  const tripScore = groupScore?.[trip.type].trips.find((t) => t.tripId === trip.id);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="نماذج الفريق">
          <div className="grid gap-3">
            <Field label="نموذج تقييم فريق العمل"><Textarea disabled={!isLead} rows={3} value={forms.teamEvalForm} onChange={(e) => setForms({ ...forms, teamEvalForm: e.target.value })} placeholder="كيف كان أداء الفريق؟ ما الذي نجح وما الذي تعثر؟" /></Field>
            <Field label="نموذج إغلاق التجربة"><Textarea disabled={!isLead} rows={3} value={forms.experienceForm} onChange={(e) => setForms({ ...forms, experienceForm: e.target.value })} placeholder="ما الذي تعلمناه من التجربة؟" /></Field>
            {isLead && <div><Button onClick={() => act(() => repos.trips.updateClosure(trip.id, { teamEvalForm: forms.teamEvalForm || undefined, experienceForm: forms.experienceForm || undefined }), 'حُفظت النماذج')}>حفظ النماذج</Button></div>}
          </div>
        </Card>

        <Card title="التقرير العام" subtitle="يُصدَّر بعد اعتماد التقرير الختامي، ويراه المشاركون والإدارة ويظهر في رابط المتابعة">
          {!isApproved(db, trip.id, 'final_report') && <Notice tone="orange">التقرير الختامي (وثيقة الرحلة) لم يُعتمد بعد. ارفعه من تبويب الوثائق ليمر بدورة الاعتماد.</Notice>}
          <Field label="نص التقرير العام" className="mt-3"><Textarea disabled={!(isLead || me.isLeader) || !isApproved(db, trip.id, 'final_report')} rows={4} value={forms.publicReport} onChange={(e) => setForms({ ...forms, publicReport: e.target.value })} placeholder="الحضور، وما تم، وأبرز اللحظات (بدون بيانات شخصية أو مالية)" /></Field>
          {(isLead || me.isLeader) && isApproved(db, trip.id, 'final_report') && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => act(() => repos.trips.updateClosure(trip.id, { publicReport: forms.publicReport }), 'صُدّر التقرير العام')} icon={<Icons.Megaphone className="h-4 w-4" />}>تصدير التقرير العام</Button>
              <Button variant="secondary" onClick={() => act(() => repos.trips.updateClosure(trip.id, { photos: [...trip.closure.photos, `ph_${Date.now()}`] }), 'أُضيفت صورة')} icon={<Icons.ImagePlus className="h-4 w-4" />}>إضافة صورة عامة ({trip.closure.photos.length})</Button>
            </div>
          )}
        </Card>

        <Card title="تقييم الرحلة" subtitle="المتابع يقيّم، والقائد العام يقيّم، ومنهما تخرج نتيجة الرحلة للمجموعة">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-ink-100 p-3">
              <div className="mb-2 text-sm font-bold">تقييم متابع الرحلات (من 10)</div>
              <Input type="number" min={0} max={10} step={0.5} disabled={!isTracker} value={ev.trackerScore} onChange={(e) => setEv({ ...ev, trackerScore: +e.target.value })} />
              <Textarea className="mt-2" disabled={!isTracker} rows={2} placeholder="ملاحظات" value={ev.trackerNote} onChange={(e) => setEv({ ...ev, trackerNote: e.target.value })} />
              {isTracker && <Button size="sm" className="mt-2" onClick={() => act(() => repos.trips.evaluate(trip.id, { trackerScore: ev.trackerScore, trackerNote: ev.trackerNote }), 'حُفظ تقييم المتابع')}>حفظ</Button>}
            </div>
            <div className="rounded-2xl border border-ink-100 p-3">
              <div className="mb-2 text-sm font-bold">تقييم القائد العام (من 10)</div>
              <Input type="number" min={0} max={10} step={0.5} disabled={!me.isLeader} value={ev.leaderScore} onChange={(e) => setEv({ ...ev, leaderScore: +e.target.value })} />
              <Textarea className="mt-2" disabled={!me.isLeader} rows={2} placeholder="ملاحظات" value={ev.leaderNote} onChange={(e) => setEv({ ...ev, leaderNote: e.target.value })} />
              {me.isLeader && <Button size="sm" className="mt-2" onClick={() => act(() => repos.trips.evaluate(trip.id, { leaderScore: ev.leaderScore, leaderNote: ev.leaderNote }), 'حُفظ تقييم القائد العام')}>حفظ</Button>}
            </div>
          </div>
          {trip.executor.kind === 'group' && (
            <div className="mt-5">
              <div className="mb-2 text-sm font-bold">بنود التقييم الجماعي اليدوية (من 5)</div>
              <div className="space-y-3">
                {manualItems.map((item) => (
                  <div key={item.key} className="rounded-xl bg-ink-50 p-3">
                    <div className="mb-1 text-xs font-bold text-ink-600">{item.name}</div>
                    {(item.subItems?.length ? item.subItems.filter((s) => s.key !== 'all_presented' && !(s.key === 'housing' && trip.type === 'internal')) : [{ key: '', name: item.name, weight: 1 }]).map((s) => {
                      const k = s.key ? `${item.key}.${s.key}` : item.key;
                      return (
                        <div key={k} className="flex items-center justify-between py-1 text-sm">
                          <span>{s.name}</span>
                          <Stars value={trip.evaluation.manual[k]} onChange={canEval ? (v) => repos.trips.evaluate(trip.id, { manual: { [k]: v } }) : undefined} />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="متطلبات الإغلاق"><Checklist items={closureChecks(db, trip)} /></Card>
        {tripScore && (
          <Card title="نتيجة الرحلة للمجموعة" subtitle="تُحسب حياً من نشاط المنصة">
            <div className="space-y-2">
              {tripScore.items.map((i) => (
                <div key={i.key} className="text-sm">
                  <div className="flex justify-between"><span>{i.name}</span><span className="num font-medium">{i.points} / {i.maxPoints}</span></div>
                  {i.detail && <div className="text-[11px] text-ink-400">{i.detail}</div>}
                </div>
              ))}
              <div className="flex justify-between border-t border-ink-100 pt-2 font-bold"><span>المجموع</span><span className="num">{tripScore.items.reduce((s, i) => s + i.points, 0).toFixed(2)}</span></div>
            </div>
            <Badge tone="green" className="mt-2">النقاط كسب فقط، لا خصم</Badge>
          </Card>
        )}
      </div>
    </div>
  );
}
