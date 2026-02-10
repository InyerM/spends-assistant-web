'use client';

import { type ReactNode, useState } from 'react';
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
  confirmLabel = 'Delete',
  onConfirm,
  isPending = false,
}: ConfirmDeleteDialogProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
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
            Type <span className='text-foreground font-semibold'>{confirmText}</span> to confirm.
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
            Cancel
          </Button>
          <Button
            variant='destructive'
            disabled={!isMatch || isPending}
            onClick={onConfirm}
            className='cursor-pointer'>
            {isPending ? 'Deleting...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
