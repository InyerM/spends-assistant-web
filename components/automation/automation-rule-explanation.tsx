'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/shared/loader';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import { useAutomationExplanation } from '@/lib/api/queries/automation-explanation.queries';
import {
  automationExplanationIdentity,
  type AutomationExplanationDraft,
} from '@/lib/utils/automation-explanation';

export function AutomationRuleExplanation({
  rule,
  initialRule,
  autoLoad = false,
}: {
  rule: AutomationExplanationDraft;
  initialRule?: AutomationExplanationDraft;
  autoLoad?: boolean;
}): React.ReactElement {
  const t = useTranslations('automation');
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [requested, setRequested] = useState<AutomationExplanationDraft | null>(
    initialRule ?? null,
  );
  useEffect(() => {
    if (!autoLoad || !container.current) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '80px' },
    );
    observer.observe(container.current);
    return (): void => observer.disconnect();
  }, [autoLoad]);
  const target = autoLoad ? rule : (requested ?? rule);
  const query = useAutomationExplanation(target, locale, (autoLoad && visible) || !!requested);
  const changed =
    !!requested && automationExplanationIdentity(requested) !== automationExplanationIdentity(rule);
  const valid = !!rule.name.trim() && Object.keys(rule.actions).length > 0;
  return (
    <div ref={container} className='min-w-0 space-y-2 sm:col-span-2'>
      <p className='text-sm font-medium'>{t('explanationTitle')}</p>
      {query.data && (
        <p className='text-muted-foreground text-sm leading-relaxed break-words'>
          {query.data.explanation}
        </p>
      )}
      {query.isFetching && (
        <p role='status' className='text-muted-foreground flex items-center gap-2 text-sm'>
          <InlineLoader />
          {t('explanationLoading')}
        </p>
      )}
      {changed && (
        <p role='status' className='text-brand-secondary text-xs'>
          {t('explanationChanged')}
        </p>
      )}
      {query.error instanceof AiConsentRequiredError ? (
        <AiConsentNotice scope={query.error.scope} />
      ) : (
        query.error && (
          <p role='status' className='text-muted-foreground text-sm'>
            {t('explanationUnavailable')}
          </p>
        )
      )}
      {(!autoLoad || query.error) && (
        <Button
          type='button'
          variant='ai'
          className='max-w-full whitespace-normal'
          disabled={!valid || query.isFetching}
          onClick={() => {
            setRequested(rule);
            if (automationExplanationIdentity(target) === automationExplanationIdentity(rule))
              void query.refetch();
          }}>
          {t(query.data || changed ? 'refreshExplanation' : 'explainRule')}
        </Button>
      )}
      {!autoLoad && <p className='text-muted-foreground text-xs'>{t('explanationOptional')}</p>}
    </div>
  );
}
