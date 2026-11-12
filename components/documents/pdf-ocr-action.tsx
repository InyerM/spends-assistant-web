'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function PdfOcrAction({
  disabled,
  onExtract,
}: {
  disabled: boolean;
  onExtract: () => void;
}): React.ReactElement {
  const t = useTranslations('documents');
  const acknowledgementId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <details className='border-border space-y-3 rounded-lg border p-3 text-sm'>
      <summary className='cursor-pointer font-medium'>{t('optionalOcr')}</summary>
      <p className='text-muted-foreground my-3 max-w-prose'>{t('ocrDisclosure')}</p>
      <div className='mb-3 flex items-start gap-2'>
        <Checkbox
          id={acknowledgementId}
          checked={acknowledged}
          disabled={disabled}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
          className='mt-1'
        />
        <Label htmlFor={acknowledgementId} className='leading-relaxed'>
          {t('ocrAcknowledge')}
        </Label>
      </div>
      <Button
        size='sm'
        variant='outline'
        className='h-auto min-h-9 max-w-full text-center whitespace-normal'
        disabled={disabled || !acknowledged}
        onClick={() => {
          setAcknowledged(false);
          onExtract();
        }}>
        {t('extractOcr')}
      </Button>
    </details>
  );
}
