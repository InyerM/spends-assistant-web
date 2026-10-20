import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocale } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { useExistingTransactionReview } from '@/lib/api/mutations/existing-transaction-review.mutations';
import {
  reviewMetadataPatch,
  type ReviewMetadataField,
  type ReviewMetadataPatch,
  type ReviewMetadataSnapshot,
} from '@/lib/transactions/existing-ai-review';
import type { TransactionFormValues } from '@/lib/transactions/form-draft';
import type { Transaction } from '@/types';
export interface ExistingTransactionAnalysisState {
  mutation: ReturnType<typeof useExistingTransactionReview>;
  snapshot: ReviewMetadataSnapshot | null;
  selected: ReviewMetadataField[];
  setSelected: Dispatch<SetStateAction<ReviewMetadataField[]>>;
  applied: ReviewMetadataPatch;
  reviewed: boolean;
  run: () => void;
  apply: () => void;
  fieldState: (field: string) => 'analyzing' | 'suggested' | undefined;
}
export function useExistingTransactionAnalysis(
  transaction: Transaction | null | undefined,
  form: UseFormReturn<TransactionFormValues>,
  open: boolean,
): ExistingTransactionAnalysisState {
  const locale = useLocale(),
    mutation = useExistingTransactionReview(transaction?.id);
  const [snapshot, setSnapshot] = useState<ReviewMetadataSnapshot | null>(null),
    [selected, setSelected] = useState<ReviewMetadataField[]>([]),
    [applied, setApplied] = useState<ReviewMetadataPatch>({}),
    [reviewed, setReviewed] = useState(false);
  const session = `${transaction?.id ?? ''}:${open}`;
  const [previousSession, setPreviousSession] = useState(session);
  if (previousSession !== session) {
    setPreviousSession(session);
    setSnapshot(null);
    setSelected([]);
    setApplied({});
    setReviewed(false);
  }
  const reset = mutation.reset;
  useEffect(() => {
    reset();
  }, [transaction?.id, open, reset]);
  function read(): ReviewMetadataSnapshot {
    const values = form.getValues();
    return {
      type: values.type,
      account_id: values.account_id,
      description: values.description,
      notes: values.notes ?? '',
      category_id: values.category_id,
    };
  }
  function run(): void {
    const current = read();
    setSnapshot(current);
    setApplied({});
    setReviewed(false);
    mutation.mutate(
      {
        locale,
        type: current.type,
        account_id: current.account_id,
        description: current.description.slice(0, 500),
        notes: current.notes.slice(0, 1500),
      },
      {
        onSuccess: (proposal) => {
          const fields: ReviewMetadataField[] = [
            'description',
            'notes',
            ...(current.type === 'transfer' ? [] : (['category_id'] as const)),
          ];
          setSelected(
            fields.filter(
              (field) => proposal[field] !== null && proposal[field] !== current[field],
            ),
          );
        },
      },
    );
  }
  function apply(): void {
    if (!snapshot || !mutation.data) return;
    const patch = reviewMetadataPatch(snapshot, read(), mutation.data, selected);
    for (const field of selected) {
      const value = patch[field];
      if (value !== undefined)
        form.setValue(field, value, { shouldDirty: true, shouldValidate: true });
    }
    setApplied(patch);
    setReviewed(true);
  }
  function fieldState(field: string): 'analyzing' | 'suggested' | undefined {
    if (
      !transaction ||
      !['description', 'notes', 'category_id'].includes(field) ||
      (field === 'category_id' && (snapshot?.type ?? transaction.type) === 'transfer')
    )
      return;
    if (mutation.isPending) return 'analyzing';
    const key = field as ReviewMetadataField;
    if (applied[key] !== undefined && form.getValues(key) === applied[key]) return 'suggested';
  }
  return { mutation, snapshot, selected, setSelected, applied, reviewed, run, apply, fieldState };
}
