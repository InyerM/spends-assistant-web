'use client';
import Link from 'next/link';
import { savedChatSource } from '@/lib/utils/financial-chat-source';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useChatHistory, useDeleteChat } from '@/lib/api/queries/financial-chat-history.queries';

export function ChatHistory(): React.ReactElement {
  const t = useTranslations('financialChat');
  const [page, setPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const history = useChatHistory(page);
  const deletion = useDeleteChat();
  return (
    <section className='space-y-4' aria-label={t('history')}>
      <div>
        <h2 className='text-xl font-semibold'>{t('history')}</h2>
        <p className='text-muted-foreground mt-1 text-sm'>{t('historyDescription')}</p>
      </div>
      {history.isPending ? <p role='status'>{t('historyLoading')}</p> : null}
      {history.isError ? (
        <div role='alert' className='text-destructive text-sm'>
          {t('historyError')}
          <Button variant='ghost' onClick={() => void history.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {history.data?.data.length === 0 ? (
        <p className='text-muted-foreground text-sm'>{t('historyEmpty')}</p>
      ) : null}
      {history.data?.data.map((entry) => (
        <article key={entry.id} className='border-border bg-card rounded-xl border p-5'>
          <details>
            <summary className='cursor-pointer text-sm font-medium break-words'>
              {entry.question}
              <span className='text-muted-foreground ml-3 text-xs'>{entry.month}</span>
            </summary>
            <p className='mt-4 text-sm leading-7 break-words whitespace-pre-wrap'>
              {entry.insufficient_context ? t('insufficientContext') : entry.answer}
            </p>
            <p className='text-muted-foreground mt-3 text-xs'>{t('savedAnswerNotice')}</p>
            <ul className='mt-3 flex flex-wrap gap-3' aria-label={t('sources')}>
              {entry.citation_ids.map((id) => {
                const source = savedChatSource(id);
                return source ? (
                  <li key={id}>
                    <Link
                      href={source.href}
                      className='text-brand text-sm underline underline-offset-2'>
                      {t(`sourceTypes.${source.type}`)}
                    </Link>
                  </li>
                ) : null;
              })}
            </ul>
          </details>
          <Button
            variant='ghost'
            className='text-destructive mt-3'
            onClick={() => setDeletingId(entry.id)}>
            {t('deleteChat')}
          </Button>
        </article>
      ))}
      {page > 0 || history.data?.hasMore ? (
        <div className='flex items-center gap-3'>
          <Button
            variant='outline'
            disabled={page === 0 || history.isFetching}
            onClick={() => setPage((value) => value - 1)}>
            {t('newer')}
          </Button>
          <Button
            variant='outline'
            disabled={!history.data?.hasMore || history.isFetching}
            onClick={() => setPage((value) => value + 1)}>
            {t('older')}
          </Button>
        </div>
      ) : null}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open && !deletion.isPending) setDeletingId(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteChat')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteChatDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          {deletion.isError ? (
            <p role='alert' className='text-destructive text-sm'>
              {t('deleteError')}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={deletion.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deletingId)
                  deletion.mutate(deletingId, {
                    onSuccess: () => {
                      setDeletingId(null);
                      if (page > 0 && history.data?.data.length === 1)
                        setPage((value) => value - 1);
                    },
                  });
              }}>
              {t('deleteChat')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
