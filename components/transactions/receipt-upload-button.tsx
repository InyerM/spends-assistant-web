'use client';
import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadDocument } from '@/lib/api/mutations/document.mutations';
export function ReceiptUploadButton({
  onUploaded,
  disabled = false,
}: {
  onUploaded: () => void;
  disabled?: boolean;
}): React.ReactElement {
  const input = useRef<HTMLInputElement>(null),
    router = useRouter(),
    client = useQueryClient(),
    t = useTranslations('transactions');
  const upload = useMutation({
    mutationFn: uploadDocument,
    onSuccess: (document) => {
      void client.invalidateQueries({ queryKey: ['documents'] });
      onUploaded();
      router.push(`/documents#document-${document.id}`);
    },
  });
  return (
    <div className='space-y-1'>
      <input
        ref={input}
        hidden
        type='file'
        accept='image/png,image/jpeg,image/webp,application/pdf'
        aria-label={t('uploadReceipt')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate(file);
          event.target.value = '';
        }}
      />
      <Button
        type='button'
        size='sm'
        variant='ghost'
        disabled={disabled || upload.isPending}
        onClick={() => input.current?.click()}>
        {upload.isPending ? (
          <LoaderCircle className='size-4 animate-spin' />
        ) : (
          <ImagePlus className='size-4' aria-hidden='true' />
        )}
        {t(upload.isPending ? 'uploadingReceipt' : 'uploadReceipt')}
      </Button>
      {upload.error && (
        <p role='alert' className='text-destructive text-xs'>
          {t('receiptUploadFailed')}
        </p>
      )}
    </div>
  );
}
