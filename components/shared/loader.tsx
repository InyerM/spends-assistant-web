import { useTranslations } from 'next-intl';
import { AnottoMark } from '@/components/layout/anotto-wordmark';
import { cn } from '@/lib/utils';

interface LoaderProps {
  className?: string;
  text?: string;
}

export function Loader({ className, text }: LoaderProps): React.ReactElement {
  const t = useTranslations('common');
  return (
    <div className='flex flex-col items-center gap-4' role='status' aria-live='polite'>
      <AnottoMark animated className={cn('h-8 w-8', className)} />
      {text ? (
        <p className='text-muted-foreground text-sm'>{text}</p>
      ) : (
        <span className='sr-only'>{t('loading')}</span>
      )}
    </div>
  );
}

export function InlineLoader({ className }: { className?: string }): React.ReactElement {
  const t = useTranslations('common');
  return (
    <span role='status' aria-label={t('loading')} className='inline-flex items-center'>
      <AnottoMark animated className={cn('h-4 w-4', className)} />
    </span>
  );
}
