'use client';

import { type ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmText: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmLabel,
  onConfirm,
  isPending = false,
}: ConfirmDeleteDialogProps): React.ReactElement {
  const tCommon = useTranslations('common');
  const resolvedConfirmLabel = confirmLabel ?? tCommon('delete');
  const [inputValue, setInputValue] = useState('');
  const [prevConfirmText, setPrevConfirmText] = useState(confirmText);

  // Reset input when confirmText changes (pattern recommended by React docs)
  if (confirmText !== prevConfirmText) {
    setPrevConfirmText(confirmText);
    setInputValue('');
  }

  const isMatch = inputValue === confirmText;

  function handleOpenChange(next: boolean): void {
    if (!next) setInputValue('');
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='border-border bg-card sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-2 py-2'>
          <p className='text-muted-foreground text-sm'>
            {tCommon.rich('typeToConfirm', {
              text: confirmText,
              bold: (chunks) => <span className='text-foreground font-semibold'>{chunks}</span>,
            })}
          </p>
          <Input
            value={inputValue}
            onChange={(e): void => setInputValue(e.target.value)}
            placeholder={confirmText}
            autoComplete='off'
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={(): void => handleOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button
            variant='destructive'
            disabled={!isMatch || isPending}
            onClick={onConfirm}
            className='cursor-pointer'>
            {isPending ? tCommon('deleting') : resolvedConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
