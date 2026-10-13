'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { SETTINGS_MODULE_GROUPS } from '@/lib/settings-modules';
export function SettingsHub(): React.ReactElement {
  const t = useTranslations('settingsHub');
  return (
    <div className='space-y-6'>
      {SETTINGS_MODULE_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`settings-${group.id}`}>
          <h2
            id={`settings-${group.id}`}
            className='text-muted-foreground mb-2 px-1 text-sm font-medium'>
            {t(`groups.${group.id}`)}
          </h2>
          <div className='bg-card border-border divide-border divide-y overflow-hidden rounded-2xl border'>
            {group.rows.map((row) => (
              <Link
                key={row.id}
                href={row.href}
                className='hover:bg-card-overlay focus-visible:ring-ring flex min-h-16 items-center gap-4 px-5 py-4 focus-visible:ring-2'>
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-medium'>{t(`rows.${row.id}.title`)}</span>
                  <span className='text-muted-foreground mt-1 block text-xs'>
                    {t(`rows.${row.id}.description`)}
                  </span>
                </span>
                <ChevronRight
                  className='text-muted-foreground size-4 shrink-0'
                  aria-hidden='true'
                />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
