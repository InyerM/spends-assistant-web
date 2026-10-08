'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeactivateMonthlyBudget } from '@/lib/api/mutations/budget.mutations';

interface BudgetRemoveDialogProps {
  budgetId: string;
  onClose: () => void;
}

export function BudgetRemoveDialog({
  budgetId,
  onClose,
}: BudgetRemoveDialogProps): React.ReactElement {
  const t = useTranslations('budgets');
  const common = useTranslations('common');
  const deactivate = useDeactivateMonthlyBudget();

  function handleDeactivate(): void {
    deactivate.mutate(budgetId, {
      onSuccess: () => {
        onClose();
        toast.success(t('removed'));
      },
      onError: () => toast.error(t('removeFailed')),
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open): void => {
        if (!open) onClose();
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('removeTitle')}</DialogTitle>
          <DialogDescription>{t('removeDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            {common('cancel')}
          </Button>
          <Button variant='destructive' disabled={deactivate.isPending} onClick={handleDeactivate}>
            {common('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
