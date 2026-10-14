'use client';
import { useTranslations } from 'next-intl';
import {
  ChartColumn,
  Wallet,
  Bell,
  Users,
  Target,
  List,
  PieChart,
  Inbox,
  Files,
} from 'lucide-react';
import type { DashboardWidget } from '@/lib/planning';
export function WidgetPreview({ id }: { id: DashboardWidget }): React.ReactElement {
  const t = useTranslations('dashboardWidgets');
  const Icon =
    id === 'reviewInbox'
      ? Inbox
      : id === 'reviewDocuments'
        ? Files
        : id === 'accounts'
          ? Wallet
          : id === 'alerts'
            ? Bell
            : id === 'contacts'
              ? Users
              : id === 'goals'
                ? Target
                : id === 'recent'
                  ? List
                  : id === 'categories'
                    ? PieChart
                    : ChartColumn;
  return (
    <div
      className='bg-background flex h-20 items-center gap-3 overflow-hidden rounded-lg px-3'
      aria-label={t(id)}>
      <Icon className='text-primary size-6 shrink-0' aria-hidden='true' />
      <div className='flex h-12 flex-1 items-end gap-1.5' aria-hidden='true'>
        {[35, 60, 45, 85, 70].map((height, index) => (
          <span
            key={index}
            style={{ height: `${height}%` }}
            className='bg-primary/25 w-full rounded-t-sm'
          />
        ))}
      </div>
    </div>
  );
}
