'use client';

import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { DocumentRejectReasonSelect } from '@/components/documents/document-review-selects';

interface Props {
  count: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string, detail?: string) => void;
}

export function DocumentRejectDialog({
  count,
  busy,
  onClose,
  onConfirm,
}: Props): React.ReactElement {
  const t = useTranslations('documents');
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const requiresDetail = reason === 'other';
  const canConfirm =
    !!reason && (!requiresDetail || !!detail.trim()) && detail.trim().length <= 500;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('rejectReason')}</DialogTitle>
          <DialogDescription>{t('confirmRejectSelectedHint', { count })}</DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <DocumentRejectReasonSelect
            value={reason}
            disabled={busy}
            onChange={(value) => {
              setReason(value);
              setDetail('');
            }}
          />
          {requiresDetail && (
            <div className='space-y-1.5'>
              <label htmlFor='document-rejection-detail' className='text-sm font-medium'>
                {t('otherReasonDetail')}
              </label>
              <Textarea
                id='document-rejection-detail'
                aria-label={t('otherReasonDetail')}
                maxLength={500}
                value={detail}
                disabled={busy}
                onChange={(event) => setDetail(event.target.value)}
                placeholder={t('otherReasonPlaceholder')}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' disabled={busy} onClick={onClose}>
            {t('cancelReview')}
          </Button>
          <Button
            variant='destructive'
            disabled={busy || !canConfirm}
            onClick={() => onConfirm(reason, requiresDetail ? detail.trim() : undefined)}>
            {t('confirmReject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
