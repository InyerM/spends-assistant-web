import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
export function NotificationWidget({
  title,
  count,
  detail,
  href,
  linkLabel,
  icon: Icon,
  warning = false,
}: {
  title: string;
  count: string | number;
  detail: string;
  href: string;
  linkLabel: string;
  icon: LucideIcon;
  warning?: boolean;
}): React.ReactElement {
  return (
    <Link
      href={href}
      aria-label={`${title} · ${count} · ${linkLabel}`}
      className={`focus-visible:ring-ring flex min-h-20 min-w-0 items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-visible:ring-2 ${warning ? 'border-warning/25 bg-warning/5 hover:bg-warning/10' : 'border-border bg-card hover:bg-card-overlay'}`}>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${warning ? 'bg-warning/10 text-warning' : 'bg-brand/10 text-brand'}`}>
        <Icon className='size-4' aria-hidden='true' />
      </span>
      <div className='min-w-0 flex-1'>
        <h2 className='truncate text-sm font-medium'>{title}</h2>
        <p className='text-muted-foreground truncate text-xs'>{detail}</p>
      </div>
      <span
        role='status'
        aria-atomic='true'
        className={`shrink-0 text-xl font-semibold tabular-nums ${warning ? 'text-warning' : ''}`}>
        <span className='sr-only'>{title}: </span>
        <span>{count}</span>
      </span>
      <ArrowUpRight className='text-muted-foreground size-4 shrink-0' aria-hidden='true' />
    </Link>
  );
}
