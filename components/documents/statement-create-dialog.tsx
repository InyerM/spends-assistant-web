'use client';
import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { StatementAnalysisFeedback } from './statement-analysis-feedback';
import { isCardPayment } from '@/lib/category-review';
import { AiFieldStatus } from '@/components/shared/ai-field-status';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import { Plus, Sparkles } from 'lucide-react';
import {
  useAnalyzeStatementMovement,
  useCreateStatementTransaction,
} from '@/lib/api/mutations/statement.mutations';
import { useCategories } from '@/lib/api/queries/category.queries';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { DocumentAccountSelect } from './document-review-selects';
import { buildCategoryItems } from '@/lib/utils/select-items';
import { InlineLoader } from '@/components/shared/loader';
import type { StatementRow } from '@/lib/statement-reconciliation';
import type { Account } from '@/types';
export function StatementCreateDialog({
  documentId,
  row,
  accounts,
  account,
  disabled,
}: {
  documentId: string;
  row: StatementRow;
  accounts: Account[];
  account: string;
  disabled: boolean;
}): React.ReactElement {
  const t = useTranslations('statementReconciliation'),
    locale = useLocale();
  const [open, setOpen] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [description, setDescription] = useState(row.description ?? ''),
    [category, setCategory] = useState(''),
    [transfer, setTransfer] = useState(false),
    [other, setOther] = useState(''),
    [resolution, setResolution] = useState<'unconfirmed' | 'transfer' | 'refund' | 'other'>(
      'unconfirmed',
    ),
    [key] = useState(() => crypto.randomUUID());
  const categories = useCategories(),
    create = useCreateStatementTransaction(documentId);
  const analyze = useAnalyzeStatementMovement(documentId, row.id, account, locale);
  const categoryEdited = useRef(false),
    descriptionEdited = useRef(false);
  function runAnalysis(): void {
    analyze.mutate(undefined, {
      onSuccess: (result) => {
        if (!categoryEdited.current && result.category_id) setCategory(result.category_id);
        if (!descriptionEdited.current && result.description) setDescription(result.description);
      },
    });
  }
  const own = accounts.find((a) => a.id === account);
  const amount = row.amount ?? 0;
  const cardPayment =
    amount > 0 &&
    own?.type === 'credit_card' &&
    (isCardPayment(own.type, row.description ?? '') || analyze.data?.kind === 'own_transfer');
  function resolvePayment(choice: 'transfer' | 'refund' | 'other'): void {
    setResolution(choice);
    if (choice === 'refund' && !descriptionEdited.current) setDescription(t('refundDescription'));
    setTransfer(choice === 'transfer');
    categoryEdited.current = true;
    setCategory(
      choice === 'refund' ? (categories.data?.find((c) => c.slug === 'refunds')?.id ?? '') : '',
    );
  }

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          if (!analyze.data && !analyze.isPending) runAnalysis();
        }}>
        <Plus className='size-4' />
        {t('createMissing')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!create.isPending) setOpen(value);
        }}>
        <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('createMissing')}</DialogTitle>
            <DialogDescription>{t('createHint')}</DialogDescription>
          </DialogHeader>
          <div className='bg-muted space-y-1 rounded-lg p-3 text-sm'>
            <p>{own?.name}</p>
            <p>{row.occurred_at_text}</p>
            <p className={amount > 0 ? 'text-success' : 'text-destructive'}>
              {new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: row.currency ?? 'COP',
              }).format(amount)}
            </p>
            <p className='text-muted-foreground text-xs'>{t('statementSource')}</p>
          </div>
          <div className='flex items-center justify-between gap-2'>
            <Button
              size='sm'
              variant='ai'
              disabled={analyze.isPending || create.isPending}
              onClick={runAnalysis}>
              <Sparkles className='size-4' />
              {t('analyzeMovement')}
            </Button>
          </div>
          <StatementAnalysisFeedback
            pending={analyze.isPending}
            result={analyze.data}
            cardPayment={cardPayment}
            disabled={create.isPending}
            resolution={resolution}
            onResolve={resolvePayment}
          />
          {analyze.error instanceof AiConsentRequiredError ? (
            <AiConsentNotice scope={analyze.error.scope} />
          ) : (
            analyze.error && (
              <p role='status' className='text-muted-foreground text-xs'>
                {t('analysisOptional')}
              </p>
            )
          )}
          <label
            className={`space-y-1 text-sm ${analyze.isPending || analyze.data?.description ? 'ai-field' : ''}`}
            data-ai-state={
              analyze.isPending ? 'analyzing' : analyze.data?.description ? 'suggested' : undefined
            }>
            <span className='flex flex-wrap items-center justify-between gap-2'>
              {t('description')}
              {(analyze.isPending || analyze.data?.description) && (
                <AiFieldStatus state={analyze.isPending ? 'analyzing' : 'suggested'} />
              )}
            </span>
            <Input
              value={description}
              disabled={create.isPending}
              onChange={(event) => {
                descriptionEdited.current = true;
                setDescription(event.target.value);
              }}
              maxLength={500}
            />
          </label>
          <label className='flex items-center gap-2 text-sm'>
            <Checkbox
              checked={transfer}
              disabled={create.isPending}
              onCheckedChange={(value) => {
                setTransfer(value === true);
                if (cardPayment) setResolution(value === true ? 'transfer' : 'unconfirmed');
                categoryEdited.current = true;
                setCategory('');
              }}
            />
            {t('ownTransfer')}
          </label>
          {transfer ? (
            <DocumentAccountSelect
              value={other}
              onChange={setOther}
              accounts={accounts.filter(
                (a) =>
                  a.id !== account && a.is_active && !a.deleted_at && a.currency === row.currency,
              )}
              label={t('otherAccount')}
              disabled={create.isPending}
            />
          ) : (
            <div
              className={analyze.isPending || analyze.data?.category_id ? 'ai-field' : 'space-y-1'}
              data-ai-state={
                analyze.isPending
                  ? 'analyzing'
                  : analyze.data?.category_id
                    ? 'suggested'
                    : undefined
              }>
              <span className='flex flex-wrap items-center justify-between gap-2 text-sm'>
                {t('category')}
                {(analyze.isPending || analyze.data?.category_id) && (
                  <AiFieldStatus
                    state={
                      analyze.isPending
                        ? 'analyzing'
                        : analyze.data.source === 'automation'
                          ? 'automation'
                          : 'suggested'
                    }
                  />
                )}
              </span>
              <SearchableSelect
                ariaLabel={t('category')}
                value={category}
                onValueChange={(value) => {
                  categoryEdited.current = true;
                  setCategory(value);
                }}
                placeholder={t('category')}
                disabled={create.isPending}
                items={buildCategoryItems(
                  categories.data ?? [],
                  amount > 0 ? 'income' : 'expense',
                  {
                    locale: locale as 'en' | 'es' | 'pt',
                    allPrefix: (name) => name,
                  },
                )}
              />
            </div>
          )}
          {transfer &&
            !accounts.some(
              (a) =>
                a.id !== account && a.is_active && !a.deleted_at && a.currency === row.currency,
            ) && <p className='text-muted-foreground text-xs'>{t('otherCurrencyTransferHint')}</p>}
          <label className='flex items-start gap-2 text-sm'>
            <Checkbox
              checked={confirmed}
              disabled={create.isPending}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            {t('createConfirmation')}
          </label>
          {create.error && (
            <p role='alert' className='text-destructive text-sm'>
              {t(
                create.error.message === 'POSSIBLE_DUPLICATE' ? 'createDuplicate' : 'createFailed',
              )}
            </p>
          )}
          <div className='flex justify-end gap-2'>
            <Button variant='ghost' disabled={create.isPending} onClick={() => setOpen(false)}>
              {t('cancelCreate')}
            </Button>
            <Button
              disabled={
                create.isPending ||
                analyze.isPending ||
                !confirmed ||
                !description.trim() ||
                (transfer && !other) ||
                (cardPayment && resolution === 'unconfirmed')
              }
              onClick={() =>
                create.mutate(
                  {
                    request_id: key,
                    observation_id: row.id,
                    category_id: transfer ? null : category || null,
                    description: description.trim(),
                    transfer_account_id: transfer ? other : null,
                  },
                  { onSuccess: () => setOpen(false) },
                )
              }>
              {create.isPending && <InlineLoader />}
              {t('createAndReconcile')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
