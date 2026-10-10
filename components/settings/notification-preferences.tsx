'use client';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import { inAppPreferences, IN_APP_NOTIFICATION_GROUPS } from '@/lib/notification-preferences';
export function NotificationPreferences(): React.ReactElement {
  const t = useTranslations('notificationPreferences');
  const { data, isPending, error } = usePlanning();
  const save = useSavePlanning();
  const preferences = inAppPreferences(data?.preferences.in_app_notifications);
  return (
    <section className='border-border bg-card rounded-xl border p-5'>
      <h2 className='font-semibold'>{t('title')}</h2>
      <p className='text-muted-foreground mt-1 text-sm'>{t('hint')}</p>
      <div className='divide-border mt-4 divide-y'>
        {IN_APP_NOTIFICATION_GROUPS.map((group) => (
          <label
            key={group}
            className='flex cursor-pointer items-center justify-between gap-4 py-3'>
            <span>
              <span className='block text-sm font-medium'>{t(`${group}.title`)}</span>
              <span className='text-muted-foreground text-xs'>{t(`${group}.hint`)}</span>
            </span>
            <Checkbox
              checked={preferences[group]}
              disabled={isPending || Boolean(error) || save.isPending}
              onCheckedChange={(value) =>
                save.mutate({
                  request_id: crypto.randomUUID(),
                  payload: {
                    action: 'preferences',
                    preferences: {
                      in_app_notifications: { ...preferences, [group]: value === true },
                    },
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      <p className='text-muted-foreground mt-3 text-xs'>{t('required')}</p>
      {(error || save.error) && (
        <p role='alert' className='text-destructive mt-2 text-sm'>
          {t('error')}
        </p>
      )}
    </section>
  );
}
