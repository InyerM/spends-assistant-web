'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
interface Props {
  busy: boolean;
  incorrect: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
}
export function PdfPasswordDialog({
  busy,
  incorrect,
  onClose,
  onSubmit,
}: Props): React.ReactElement {
  const t = useTranslations('documents');
  const [password, setPassword] = useState('');
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}>
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{t('pdfPasswordTitle')}</DialogTitle>
          <DialogDescription>{t('pdfPasswordDescription')}</DialogDescription>
        </DialogHeader>
        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            if (password && !busy) {
              onSubmit(password);
              setPassword('');
            }
          }}>
          <label className='block space-y-2 text-sm'>
            <span>{t('pdfPasswordLabel')}</span>
            <Input
              type='password'
              value={password}
              maxLength={128}
              autoComplete='off'
              autoCorrect='off'
              spellCheck={false}
              autoFocus
              required
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {incorrect ? (
            <p role='alert' className='text-destructive text-sm'>
              {t('pdfErrors.PDF_PASSWORD_INCORRECT')}
            </p>
          ) : null}
          <DialogFooter>
            <Button type='button' variant='outline' disabled={busy} onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type='submit' variant='ai' disabled={busy || !password}>
              {busy ? t('extracting') : t('pdfUnlock')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
