'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AI_CONSENT_SCOPES, type AiConsentScope } from '@/lib/ai-consent';
import { useAiConsent } from '@/lib/api/queries/ai-consent.queries';
import { useUpdateAiConsent } from '@/lib/api/mutations/ai-consent.mutations';

const labels: Record<AiConsentScope, { title: string; description: string }> = {
  financial_text: { title: 'financialText', description: 'financialTextDescription' },
  document_images: { title: 'documentImages', description: 'documentImagesDescription' },
  forwarded_email: { title: 'forwardedEmail', description: 'forwardedEmailDescription' },
};

export function AiConsentTab(): React.ReactElement {
  const t = useTranslations('aiConsent');
  const query = useAiConsent();
  const mutation = useUpdateAiConsent();

  return (
    <Card>
      <CardHeader className='space-y-2'>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Sparkles className='text-brand size-5' aria-hidden='true' />
          {t('title')}
        </CardTitle>
        <CardDescription className='max-w-prose leading-relaxed'>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        <div className='bg-muted/60 space-y-2 rounded-lg p-4 text-sm leading-relaxed'>
          <p>{t('providerDisclosure')}</p>
          <p>{t('revocationDisclosure')}</p>
        </div>
        {query.isPending && (
          <p role='status' className='text-muted-foreground text-sm'>
            {t('loading')}
          </p>
        )}
        {query.isError && (
          <div role='alert' className='space-y-2'>
            <p className='text-destructive text-sm'>{t('loadError')}</p>
            <Button size='sm' variant='outline' onClick={() => void query.refetch()}>
              {t('retry')}
            </Button>
          </div>
        )}
        {query.data &&
          AI_CONSENT_SCOPES.map((scope) => (
            <div
              key={scope}
              className='border-border flex items-start justify-between gap-4 border-t pt-4'>
              <div className='space-y-1'>
                <Label htmlFor={`ai-consent-${scope}`} className='text-sm font-medium'>
                  {t(labels[scope].title)}
                </Label>
                <p
                  id={`ai-consent-description-${scope}`}
                  className='text-muted-foreground max-w-prose text-sm leading-relaxed'>
                  {t(labels[scope].description)}
                </p>
              </div>
              <Switch
                id={`ai-consent-${scope}`}
                aria-label={t(labels[scope].title)}
                aria-describedby={`ai-consent-description-${scope}`}
                checked={query.data.consents[scope]}
                disabled={mutation.isPending}
                onCheckedChange={(granted) => mutation.mutate({ scope, granted })}
              />
            </div>
          ))}
        {mutation.isError && (
          <p role='alert' className='text-destructive text-sm'>
            {t('saveError')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
