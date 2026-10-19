'use client';
import { NotificationWidget } from './notification-widget';
import { AlertTriangle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useMonthlyBudgets } from '@/lib/api/queries/budget.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { Locale } from '@/i18n/config';
export function MoneyAlerts(): React.ReactElement | null {
  const t = useTranslations('dashboardWidgets');
  const locale = useLocale();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const { data: planning } = usePlanning();
  const goals = (planning?.goals ?? []).filter(
    (goal) => goal.saved_amount / goal.target_amount >= 0.8,
  );
  const { data: categories } = useCategories();
  const { data } = useMonthlyBudgets(month);
  const alerts = (data ?? []).filter((budget) => budget.threshold !== 'none');
  if (!alerts.length && !goals.length) return null;
  const first = alerts.at(0);
  const category = categories?.find((entry) => entry.id === first?.category_id);
  return (
    <NotificationWidget
      title={t('alerts')}
      count={alerts.length + goals.length}
      detail={
        first
          ? `${category ? getCategoryName(category, locale as Locale) : t('budgets')} · ${t(first.threshold === '100' ? 'budgetExceededShort' : 'budgetNearShort')}`
          : t('goalAlertsShort')
      }
      href={alerts.length ? '/budgets' : '/planning'}
      linkLabel={t('reviewViewMore')}
      icon={AlertTriangle}
      warning
    />
  );
}
