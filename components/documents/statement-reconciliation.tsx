'use client';
import { useTranslations } from 'next-intl';
import { useStatementReconciliation } from '@/lib/api/queries/statement.queries';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/shared/loader';
import { StatementCurrencyReview } from './statement-currency-review';
import type { Account } from '@/types';
export function StatementReconciliation({
  documentId,
  accounts,
}: {
  documentId: string;
  accounts: Account[];
}): React.ReactElement {
  const t = useTranslations('statementReconciliation');
  const query = useStatementReconciliation(documentId);
  if (query.isPending) return <InlineLoader />;
  if (query.isError)
    return (
      <div role='alert' className='space-y-2'>
        <p>{t('loadError')}</p>
        <Button variant='outline' onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  return <StatementCurrencyReview documentId={documentId} data={query.data} accounts={accounts} />;
}
