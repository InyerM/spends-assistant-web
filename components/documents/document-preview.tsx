'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useDocumentPreview } from '@/lib/api/queries/document-preview.queries';
function PreviewContent({
  id,
  name,
  mime,
}: {
  id: string;
  name: string;
  mime: string;
}): React.ReactElement {
  const t = useTranslations('documents');
  const { data, isPending, error } = useDocumentPreview(id);
  return (
    <>
      {isPending && <p role='status'>{t('loading')}</p>}
      {error && (
        <p role='alert' className='text-destructive'>
          {t('previewError')}
        </p>
      )}
      {data && (
        <div className='min-w-0 space-y-3'>
          {mime === 'application/pdf' ? (
            <iframe
              title={name}
              src={data.url}
              referrerPolicy='no-referrer'
              className='h-[65dvh] w-full rounded-lg'
            />
          ) : (
            <Image
              src={data.url}
              alt={name}
              unoptimized
              width={1200}
              height={1600}
              className='max-h-[65dvh] w-full object-contain'
            />
          )}
          <a
            href={data.url}
            target='_blank'
            rel='noopener noreferrer'
            className='text-brand text-sm underline'>
            {t('openOriginal')}
          </a>
        </div>
      )}
    </>
  );
}
export function DocumentPreview({
  id,
  name,
  mime,
}: {
  id: string;
  name: string;
  mime: string;
}): React.ReactElement {
  const t = useTranslations('documents');
  const [open, setOpen] = useState(false);
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size='icon'
              variant='outline'
              aria-label={t('viewDocument')}
              onClick={() => setOpen(true)}>
              <Eye className='size-4' aria-hidden='true' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('viewDocument')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='w-[calc(100%-2rem)] max-w-4xl'>
          <DialogHeader>
            <DialogTitle className='break-all'>{name}</DialogTitle>
            <DialogDescription>{t('previewHint')}</DialogDescription>
          </DialogHeader>
          {open && <PreviewContent id={id} name={name} mime={mime} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
