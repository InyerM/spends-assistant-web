import { cn } from '@/lib/utils';

export function AnottoMark({
  animated = false,
  className,
}: {
  animated?: boolean;
  className?: string;
}): React.ReactElement {
  return (
    <svg
      aria-hidden='true'
      viewBox='-1 -1 30 30'
      className={cn('text-brand h-7 w-7 shrink-0', animated && 'anotto-loading-mark', className)}
      fill='currentColor'>
      <g transform='rotate(-13 13.5 13.5)'>
        <rect x='3' y='12' width='5' height='14' rx='2.5' />
        <rect x='11' y='4' width='5' height='22' rx='2.5' />
        <rect x='19' y='9' width='5' height='17' rx='2.5' />
      </g>
    </svg>
  );
}

export function AnottoWordmark({
  compact = false,
  animated = false,
  className,
}: {
  compact?: boolean;
  animated?: boolean;
  className?: string;
}): React.ReactElement {
  return (
    <span
      aria-label='Anotto'
      className={cn('text-foreground inline-flex items-center gap-3', className)}>
      <AnottoMark animated={animated} />
      {!compact && (
        <span aria-hidden='true' className='text-[27px] font-extrabold tracking-[-0.055em]'>
          anotto<span className='text-brand'>.</span>
        </span>
      )}
    </span>
  );
}
