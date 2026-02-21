import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  className?: string;
  text?: string;
}

export function Loader({ className, text }: LoaderProps): React.ReactElement {
  return (
    <div className='flex flex-col items-center gap-4'>
      <Loader2 className={cn('text-primary h-8 w-8 animate-spin', className)} />
      {text ? <p className='text-muted-foreground text-sm'>{text}</p> : null}
    </div>
  );
}

export function InlineLoader({ className }: { className?: string }): React.ReactElement {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
}
