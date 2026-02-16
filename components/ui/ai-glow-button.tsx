import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type AiGlowButtonVariant = 'inline' | 'fab';

interface AiGlowButtonProps {
  onClick: () => void;
  className?: string;
  variant?: AiGlowButtonVariant;
}

export function AiGlowButton({
  onClick,
  className,
  variant = 'inline',
}: AiGlowButtonProps): React.ReactElement {
  const isFab = variant === 'fab';

  return (
    <div className={cn('group relative', className)}>
      <button
        type='button'
        onClick={onClick}
        className={cn(
          'relative inline-flex cursor-pointer items-center justify-center p-px',
          'leading-6 font-semibold text-white shadow-lg',
          'transition-transform duration-300 ease-in-out',
          'hover:scale-105 active:scale-95',
          isFab ? 'h-14 w-14 rounded-full' : 'h-9 gap-1.5 rounded-md px-2.5 sm:h-8',
        )}>
        {/* Gradient border: always visible on FAB, hover-only on desktop inline */}
        <span
          className={cn(
            'absolute inset-0 p-[2px]',
            'bg-gradient-to-r from-teal-400 via-blue-500 to-purple-500',
            'transition-opacity duration-500',
            isFab ? 'rounded-full opacity-100' : 'rounded-md opacity-0 group-hover:opacity-100',
          )}
        />
        {/* Inner background matching app design tokens */}
        <span
          className={cn(
            'bg-card relative z-10 inline-flex items-center justify-center gap-1.5',
            isFab ? 'h-full w-full rounded-full' : 'h-full w-full rounded-md px-2',
          )}>
          <Sparkles className={cn('relative z-10 text-white', isFab ? 'h-6 w-6' : 'h-4 w-4')} />
          {!isFab && <span className='relative z-10 text-sm text-white'>AI</span>}
        </span>
      </button>
    </div>
  );
}
