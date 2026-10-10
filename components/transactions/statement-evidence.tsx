'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCheck, AlertTriangle } from 'lucide-react';
import { useStatementProofs } from '@/lib/api/queries/statement.queries';
export function StatementEvidence({
  transactionId,
}: {
  transactionId: string;
}): React.ReactElement | null {
  const t = useTranslations('statementReconciliation');
  const query = useStatementProofs([transactionId]);
  if (query.isError)
    return (
      <p role='status' className='text-muted-foreground text-xs'>
        {t('loadError')}
      </p>
    );
  if (!query.data?.length) return null;
  return (
    <div className='border-border space-y-2 rounded-lg border p-3'>
      {query.data.map((proof) => (
        <Link
          key={proof.id}
          href={`/documents#document-${proof.document_id}`}
          className={`flex min-w-0 items-center gap-2 text-sm hover:underline ${proof.valid ? 'text-success' : 'text-warning'}`}>
          {proof.valid ? (
            <CheckCheck className='size-4 shrink-0' />
          ) : (
            <AlertTriangle className='size-4 shrink-0' />
          )}
          <span className='min-w-0 break-words'>
            {t(proof.valid ? 'reconciled' : 'changed')} · {t('viewStatement')} · {proof.file_name}
          </span>
        </Link>
      ))}
    </div>
  );
}
