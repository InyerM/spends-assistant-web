'use client';
import Link from 'next/link';
import { CheckCheck, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { StatementProof } from '@/lib/statement-reconciliation';
export function StatementEvidenceLink({
  proof,
}: {
  proof: StatementProof;
}): React.ReactElement | null {
  const t = useTranslations('statementReconciliation');
  if (!proof.document_id) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/documents#document-${proof.document_id}`}
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md sm:size-8 ${proof.valid ? 'text-success' : 'text-warning'}`}
            aria-label={t('viewStatementEvidence')}>
            {proof.valid ? <CheckCheck className='size-4' /> : <AlertTriangle className='size-4' />}
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          {t(proof.valid ? 'reconciled' : 'changed')} · {proof.file_name}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function findStatementProof(
  proofs: StatementProof[] | undefined,
  transactionId: string,
): StatementProof | undefined {
  return (
    proofs?.find((proof) => proof.transaction_id === transactionId && proof.valid) ??
    proofs?.find((proof) => proof.transaction_id === transactionId)
  );
}
