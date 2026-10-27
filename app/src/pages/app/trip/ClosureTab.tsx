// الإغلاق والتقييم: نماذج الفريق، الإغلاق المالي، التقرير، تقييم كل فريق العمل للرحلة، وبنود المالية
import { useState } from 'react';
import { isFinanceOwner } from '@/domain/finance';
import { tripTeamLeaderId } from '@/domain/permissions';
import { fmtDateTime } from '@/domain/dates';
import { closeDeadline, closureChecks, isApproved, staffRatingCount, tripCloseBlock, tripHasEnded } from '@/domain/workflow';
import type { Trip } from '@/domain/types';
import { act, repos, useDB, useMe, useScores } from '@/state/store';
import { Badge, Button, Card, Checklist, Field, Icons, Input, Notice, Stars, Textarea } from '@/ui';

export default function ClosureTab({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const scores = useScores();
  const isLead = tripTeamLeaderId(db, trip) === me.person.id;
  const finOwner = isFinanceOwner(db, me.person.id);
  const mine = trip.evaluation.staffRatings[me.person.id];
  const ratings = Object.entries(trip.evaluation.staffRatings);
  const count = staffRatingCount(db, trip);
  const [forms, setForms] = useState({ teamEvalForm: trip.closure.teamEvalForm ?? '', experienceForm: trip.closure.experienceForm ?? '', publicReport: trip.closure.publicReport ?? '' });
  const [rating, setRating] = useState({ score: 8, note: '' });
  const groupScore = trip.executor.kind === 'group' ? scores.groups.find((g) => g.groupId === (trip.executor as { groupId: string }).groupId) : undefined;
  const tripScore = groupScore?.[trip.type].trips.find((t) => t.tripId === trip.id);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="نماذج الفريق">
          <div className="grid gap-3">
            <Field label="نموذج تقييم فريق العمل"><Textarea disabled={!isLead} rows={3} value={forms.teamEvalForm} onChange={(e) => setForms({ ...forms, teamEvalForm: e.target.value })} placeholder="كيف كان أداء الفريق؟ ما الذي نجح وما الذي تعثر؟" /></Field>
            <Field label="نموذج إغلاق التجربة"><Textarea disabled={!isLead} rows={3} value={forms.experienceForm} onChange={(e) => setForms({ ...forms, experienceForm: e.target.value })} placeholder="ما الذي تعلمناه من التجربة؟" /></Field>
            {isLead && <div><Button onClick={() => act(() => repos.trips.updateClosure(trip.id, { teamEvalForm: forms.teamEvalForm || undefined, experienceForm: forms.experienceForm || undefined }), 'حُفظت النماذج')}>احفظ النماذج</Button></div>}
          </div>
        </Card>

        <Card title="التقرير العام" subtitle="يُصدَّر بعد اعتماد التقرير الختامي، ويراه المشاركون والإدارة ويظهر في رابط المتابعة">
          {!isApproved(db, trip.id, 'final_report') && <Notice tone="orange">التقرير الختامي (وثيقة الرحلة) لم يُعتمد بعد. ارفعه من تبويب الوثائق ليمر بدورة الاعتماد.</Notice>}
          <Field label="نص التقرير العام" className="mt-3"><Textarea disabled={!(isLead || me.isLeader) || !isApproved(db, trip.id, 'final_report')} rows={4} value={forms.publicReport} onChange={(e) => setForms({ ...forms, publicReport: e.target.value })} placeholder="الحضور، وما تم، وأبرز اللحظات (بدون بيانات شخصية أو مالية)" /></Field>
          {(isLead || me.isLeader) && isApproved(db, trip.id, 'final_report') && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => act(() => repos.trips.updateClosure(trip.id, { publicReport: forms.publicReport }), 'صُدّر التقرير العام')} icon={<Icons.Megaphone className="h-4 w-4" />}>صدّر التقرير العام</Button>
              <Button variant="secondary" onClick={() => act(() => repos.trips.updateClosure(trip.id, { photos: [...trip.closure.photos, `ph_${Date.now()}`] }), 'أُضيفت صورة')} icon={<Icons.ImagePlus className="h-4 w-4" />}>أضف صورة عامة ({trip.closure.photos.length})</Button>
            </div>
          )}
        </Card>

        <MediaCard trip={trip} />
        <Card title="تقييم الرحلة" subtitle={`يقيّمها كل فريق العمل (من 10) ويُجمع المتوسط مع النقاط التلقائية ونقاط المالية · ${count.rated} من ${count.staff}، والإغلاق بعد ${count.needed} على الأقل`}>
          {me.isStaff && (mine ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm">قيّمتها <b className="num">{mine.score}</b> من 10{mine.note ? ` · ${mine.note}` : ''}</p>
          ) : !tripHasEnded(trip) ? <Notice>يُفتح التقييم بعد انتهاء الرحلة.</Notice> : (
            <div className="grid gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-[110px_1fr_auto]">
              <Input className="num" type="number" min={0} max={10} step={0.5} value={rating.score} onChange={(e) => setRating({ ...rating, score: +e.target.value })} aria-label="التقييم من 10" />
              <Input placeholder="ملاحظة (اختياري)" value={rating.note} onChange={(e) => setRating({ ...rating, note: e.target.value })} />
              <Button onClick={() => act(() => repos.trips.rateTrip(trip.id, rating.score, rating.note || undefined), 'حُفظ تقييمك')}>قيّم الرحلة</Button>
            </div>
          ))}
          {me.isLeader && ratings.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">{ratings.map(([pid, r]) => <li key={pid} className="flex justify-between"><span>{db.persons.find((p) => p.id === pid)?.name}{r.note ? <span className="text-xs text-ink-500"> · {r.note}</span> : null}</span><b className="num">{r.score}</b></li>)}</ul>
          )}
          {trip.executor.kind === 'group' && (
            <div className="mt-5">
              <div className="mb-2 text-sm font-bold">بنود المسؤول المالي (من 5) <span className="text-xs font-normal text-ink-500">يحددها ويقيّم بها وحده، وتظهر في المنصة</span></div>
              <div className="space-y-1">
                {db.settings.finance.evalItems.map((i) => (
                  <div key={i.key} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-1.5 text-sm">
                    <span>{i.name}</span>
                    <Stars value={trip.evaluation.finance[i.key]} onChange={finOwner ? (v) => act(() => repos.trips.rateTripFinance(trip.id, i.key, v)) : undefined} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="متطلبات الإغلاق" subtitle={`أقصى موعد للإغلاق ${fmtDateTime(closeDeadline(db, trip, 'trip'))}، وبعده تخسر المجموعة نقاط البند`}>
          <Checklist items={closureChecks(db, trip)} />
          {trip.closedAt ? <div className="mt-3"><Notice tone="green">أُغلقت الرحلة {fmtDateTime(trip.closedAt)}.</Notice></div> : (isLead || me.isLeader) && (
            <div className="mt-3">
              <Button className="w-full" disabled={!!tripCloseBlock(db, trip)} onClick={() => act(() => repos.trips.close(trip.id), 'أُغلقت الرحلة')}>أغلق الرحلة</Button>
              {tripCloseBlock(db, trip) && <p className="mt-1 text-xs text-ink-400">{tripCloseBlock(db, trip)}</p>}
            </div>
          )}
        </Card>
        {tripScore && (
          <Card title="نتيجة الرحلة للمجموعة" subtitle="تُحسب حياً من نشاط المنصة">
            <div className="space-y-2">
              {tripScore.items.map((i) => (
                <div key={i.key} className="text-sm">
                  <div className="flex justify-between"><span>{i.name}</span><span className="num font-medium">{i.points} / {i.maxPoints}</span></div>
                  {i.detail && <div className="text-xs text-ink-400">{i.detail}</div>}
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

/** التوثيق: رابط الدرايف والتغريدات يرفعها مسؤول اللجنة الإعلامية، وتظهر في رابط الداعم بعد الإغلاق واعتماد التقرير */
function MediaCard({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const isMediaHead = me.committees.some((c) => c.committee.kind === 'media' && c.role === 'leader');
  const [drive, setDrive] = useState(trip.closure.driveLink ?? '');
  const [tweets, setTweets] = useState((trip.closure.tweets ?? []).join('\n'));
  void db;
  return (
    <Card title="التوثيق الإعلامي" subtitle="يرفعه مسؤول اللجنة الإعلامية">
      <div className="grid gap-3">
        <Field label="رابط درايف التوثيق"><Input dir="ltr" disabled={!isMediaHead} value={drive} onChange={(e) => setDrive(e.target.value)} /></Field>
        <Field label="روابط التغريدات (رابط في كل سطر)"><Textarea dir="ltr" disabled={!isMediaHead} rows={2} value={tweets} onChange={(e) => setTweets(e.target.value)} /></Field>
        {isMediaHead && <div><Button onClick={() => act(() => repos.trips.updateClosure(trip.id, { driveLink: drive || undefined, tweets: tweets.split('\n').map((x) => x.trim()).filter(Boolean) }), 'حُفظ التوثيق')}>احفظ التوثيق</Button></div>}
      </div>
    </Card>
  );
}
