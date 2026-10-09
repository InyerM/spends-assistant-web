'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SENDER_PROVIDERS } from '@/lib/email-forwarding/sender-catalog';
import { useEmailSenders } from '@/lib/api/queries/email-senders.queries';

export function EmailSenderReview({
  inboxId,
  sender,
  detectedBank,
}: {
  inboxId: string;
  sender: string;
  detectedBank: string | null;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const { query, confirm } = useEmailSenders();
  const confirmed = query.data?.find((item) => item.sender_address === sender.trim().toLowerCase());
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState(detectedBank ?? '');
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState(false);
  const openDialog = (): void => {
    const name = confirmed?.bank_name ?? detectedBank ?? '';
    setBankName(name);
    setCustom(Boolean(name && !SENDER_PROVIDERS.some((provider) => provider.name === name)));
    setError(false);
    setOpen(true);
  };
  const save = async (): Promise<void> => {
    setError(false);
    try {
      await confirm.mutateAsync({ inboxId, bankName: bankName.trim() });
      setOpen(false);
    } catch {
      setError(true);
    }
  };
  return (
    <>
      {confirmed ? (
        <Badge variant='outline' className='border-success/30 bg-success/10 text-success'>
          <ShieldCheck className='mr-1 size-3' />
          {t('senderConfirmed', { bank: confirmed.bank_name })}
        </Badge>
      ) : detectedBank ? (
        <Badge variant='secondary'>{t('bankDetected', { bank: detectedBank })}</Badge>
      ) : null}
      <span className='min-w-0 font-medium break-all'>{sender}</span>
      {!confirmed && <span className='text-muted-foreground'>{t('senderUnverified')}</span>}
      <Button variant='outline' size='sm' className='ml-auto' onClick={openDialog}>
        <ShieldCheck className='size-4' />
        {t(confirmed ? 'changeConfirmedBank' : 'verifySender')}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value): void => {
          if (!confirm.isPending) setOpen(value);
        }}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('verifySender')}</DialogTitle>
            <DialogDescription>{t('confirmSenderDescription')}</DialogDescription>
          </DialogHeader>
          <p className='bg-muted rounded-lg p-3 text-sm font-medium break-all'>{sender}</p>
          <div className='space-y-2'>
            <label className='text-sm font-medium' htmlFor={`sender-bank-${inboxId}`}>
              {t('senderBankLabel')}
            </label>
            <Select
              value={custom ? 'other' : bankName}
              onValueChange={(value): void => {
                setCustom(value === 'other');
                setBankName(value === 'other' ? '' : value);
              }}
              disabled={confirm.isPending}>
              <SelectTrigger
                id={`sender-bank-${inboxId}`}
                className='w-full'
                aria-label={t('senderBankLabel')}>
                <SelectValue placeholder={t('chooseSenderBank')} />
              </SelectTrigger>
              <SelectContent>
                {SENDER_PROVIDERS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.name}>
                    {provider.name}
                  </SelectItem>
                ))}
                <SelectItem value='other'>{t('otherSenderBank')}</SelectItem>
              </SelectContent>
            </Select>
            {custom && (
              <Input
                value={bankName}
                maxLength={80}
                aria-label={t('customSenderBank')}
                placeholder={t('customSenderBank')}
                disabled={confirm.isPending}
                onChange={(event): void => setBankName(event.target.value)}
              />
            )}
          </div>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            {t('manualSenderConfirmationHint')}
          </p>
          {error && (
            <p role='alert' className='text-destructive text-sm'>
              {t('senderConfirmFailed')}
            </p>
          )}
          <DialogFooter>
            <Button
              variant='outline'
              disabled={confirm.isPending}
              onClick={(): void => setOpen(false)}>
              {t('cancelSenderConfirmation')}
            </Button>
            <Button
              disabled={confirm.isPending || bankName.trim().length < 2}
              onClick={(): void => void save()}>
              {t(confirm.isPending ? 'confirmingSender' : 'confirmSender')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
