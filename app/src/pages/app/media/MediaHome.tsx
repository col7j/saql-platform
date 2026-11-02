// الرئيسية: «المطلوب الآن» ببطاقات قليلة تقول ماذا يلزم
import { Link } from 'react-router-dom';
import { mediaTodos } from '@/domain/media';
import { useDB } from '@/state/store';
import { Empty, Icons, LinkButton, cx } from '@/ui';

const bar = { red: 'bg-bad-500', orange: 'bg-accent-500', blue: 'bg-brand-600' } as const;

export default function MediaHome() {
  const db = useDB();
  const todos = mediaTodos(db);
  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">المطلوب الآن</h2>
      {todos.length === 0 ? <Empty title="لا شيء ينتظرك" text="كل الفعاليات القادمة لها موجز، ولا تغييرات معلّقة." icon={<Icons.PartyPopper className="h-7 w-7" />} /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {todos.map((t) => (
            <li key={t.id} className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-ink-100 bg-white p-4 ps-5 shadow-card">
              <span className={cx('absolute inset-y-0 start-0 w-1.5', bar[t.tone])} />
              <div className="min-w-0 flex-1"><div className="font-medium text-ink-900">{t.title}</div>{t.hint && <div className="text-xs text-ink-500">{t.hint}</div>}</div>
              <LinkButton to={t.to} variant={t.tone === 'red' ? 'primary' : 'secondary'} size="sm">{t.cta}</LinkButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export { Link };
