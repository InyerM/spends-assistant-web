import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useExpenseCategoryQueue } from '@/lib/api/queries/expense-category-review.queries';
import {
  useAnalyzeExpenseCategories,
  useApplyExpenseCategory,
} from '@/lib/api/mutations/expense-category-review.mutations';
import type {
  ExpenseReviewChanges,
  ExpenseReviewResult,
  ExpenseReviewRow,
} from '@/types/expense-category-review';
interface Filters {
  scope: 'uncategorized' | 'all';
  search: string;
  page: number;
}
interface ExpenseCategoryReviewState {
  filters: Filters;
  changeFilters: (patch: Partial<Filters>) => void;
  selected: string[];
  toggle: (id: string) => void;
  reviews: Record<string, ExpenseReviewResult | undefined>;
  choices: Record<string, string | undefined>;
  setChoice: (id: string, value: string) => void;
  queue: ReturnType<typeof useExpenseCategoryQueue>;
  analysis: ReturnType<typeof useAnalyzeExpenseCategories>;
  save: ReturnType<typeof useApplyExpenseCategory>;
  busy: boolean;
  analyze: () => void;
  apply: (row: ExpenseReviewRow, changes: ExpenseReviewChanges) => void;
}
export function useExpenseCategoryReview(): ExpenseCategoryReviewState {
  const locale = useLocale(),
    t = useTranslations('expenseCategoryReview');
  const [filters, setFilters] = useState<Filters>({ scope: 'uncategorized', search: '', page: 1 });
  const [selected, setSelected] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Record<string, ExpenseReviewResult | undefined>>({});
  const [choices, setChoices] = useState<Record<string, string | undefined>>({});
  const queue = useExpenseCategoryQueue(filters),
    analysis = useAnalyzeExpenseCategories(),
    save = useApplyExpenseCategory();
  const busy = analysis.isPending || save.isPending;
  function changeFilters(patch: Partial<Filters>): void {
    if (busy) return;
    setFilters((prev) => ({ ...prev, page: 1, ...patch }));
    setSelected([]);
    save.reset();
  }
  function toggle(id: string): void {
    if (busy) return;
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length < 5
          ? [...prev, id]
          : prev,
    );
  }
  function analyze(): void {
    if (busy || !selected.length) return;
    analysis.mutate(
      { ids: selected, locale },
      {
        onSuccess: (results) => {
          setReviews((prev) => ({
            ...prev,
            ...Object.fromEntries(results.map((row) => [row.id, row])),
          }));
          setChoices((prev) => {
            const next = { ...prev };
            for (const row of results) next[row.id] = undefined;
            return next;
          });
          setSelected([]);
        },
      },
    );
  }
  function apply(row: ExpenseReviewRow, changes: ExpenseReviewChanges): void {
    if (busy || !Object.keys(changes).length) return;
    save.mutate(
      { row, changes },
      {
        onSuccess: () => {
          setReviews((prev) => {
            const next = { ...prev };
            next[row.id] = undefined;
            return next;
          });
          toast.success(t('saved'));
        },
      },
    );
  }
  return {
    filters,
    changeFilters,
    selected,
    toggle,
    reviews,
    choices,
    setChoice: (id: string, value: string): void =>
      setChoices((prev) => ({ ...prev, [id]: value })),
    queue,
    analysis,
    save,
    busy,
    analyze,
    apply,
  };
}
