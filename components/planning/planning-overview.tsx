'use client';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { usePlanning } from '@/lib/api/queries/planning.queries';
export function PlanningOverview(): React.ReactElement | null {
  const t = useTranslations('planning');
  const locale = useLocale();
  const { data } = usePlanning();
  if (!data || (!data.goals.length && !data.schedules.length)) return null;
  return (
    <section className='border-border bg-card space-y-4 rounded-xl border p-5'>
      <div className='flex items-center justify-between gap-4'>
        <h2 className='font-semibold'>{t('title')}</h2>
        <Link className='text-primary text-sm underline-offset-4 hover:underline' href='/planning'>
          {t('edit')}
        </Link>
      </div>
      {data.goals.slice(0, 3).map((goal) => {
        const progress = Math.min(100, (goal.saved_amount / goal.target_amount) * 100);
        return (
          <div key={goal.id} className='space-y-2'>
            <div className='flex justify-between gap-3'>
              <span className='truncate'>{goal.name}</span>
              <span className={progress >= 80 ? 'text-primary' : 'text-muted-foreground'}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className='bg-primary/15 h-2 overflow-hidden rounded-full'>
              <div className='bg-primary h-full' style={{ width: `${progress}%` }} />
            </div>
            {progress >= 100 && <p className='text-primary text-sm'>{t('goalReached')}</p>}
          </div>
        );
      })}
      {data.schedules.slice(0, 3).map((item) => (
        <div
          key={item.id}
          className='border-border flex justify-between gap-3 border-t pt-3 text-sm'>
          <span className='truncate'>{item.name}</span>
          <span className='text-muted-foreground shrink-0'>
            {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
              new Date(`${item.next_due}T12:00:00`),
            )}
          </span>
        </div>
      ))}
    </section>
  );
}
