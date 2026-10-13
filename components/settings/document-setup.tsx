'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Files } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
export function DocumentSetup(): React.ReactElement {
  const t = useTranslations('settingsHub');
  const router = useRouter();
  const { data, isPending } = usePlanning();
  const save = useSavePlanning();
  return (
    <Card>
      <CardContent className='space-y-4 p-6'>
        <Files className='text-brand size-8' aria-hidden='true' />
        <h2 className='text-xl font-semibold'>{t('rows.documents.title')}</h2>
        <p className='text-muted-foreground text-sm'>{t('documentSetup')}</p>
        {save.error && (
          <p role='alert' className='text-destructive text-sm'>
            {t('setupError')}
          </p>
        )}
        <Button
          disabled={isPending || !data || save.isPending}
          onClick={() =>
            save.mutate(
              {
                request_id: crypto.randomUUID(),
                payload: { action: 'preferences', preferences: { documents_enabled: true } },
              },
              { onSuccess: () => router.push('/documents') },
            )
          }>
          {t('activateDocuments')}
        </Button>
      </CardContent>
    </Card>
  );
}
