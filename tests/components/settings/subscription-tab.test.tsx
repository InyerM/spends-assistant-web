import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { SubscriptionTab } from '@/components/settings/subscription-tab';
import { UsageIndicator } from '@/components/shared/usage-indicator';
import es from '@/messages/es.json';

const { subscriptionQuery, usageQuery } = vi.hoisted(() => ({
  subscriptionQuery: vi.fn(),
  usageQuery: vi.fn(),
}));

vi.mock('@/hooks/use-subscription', () => ({ useSubscription: subscriptionQuery }));
vi.mock('@/hooks/use-usage', () => ({ useUsage: usageQuery }));

const usage = {
  month: '2026-10',
  ai_parses_used: 12,
  ai_parses_limit: 15,
  transactions_count: 20,
  transactions_limit: 50,
  accounts_count: 2,
  accounts_limit: 4,
  categories_count: 4,
  categories_limit: 10,
  automations_count: 1,
  automations_limit: 10,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('free launch plan and usage', () => {
  it('shows the free, no-charge plan and real usage without an unavailable upgrade', () => {
    subscriptionQuery.mockReturnValue({ data: { plan: 'free' }, isLoading: false });
    usageQuery.mockReturnValue({ data: usage, isLoading: false });

    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <SubscriptionTab />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Anotto es gratis por ahora; no hay cobros.')).toBeInTheDocument();
    expect(screen.getByText('12/15 este mes')).toBeInTheDocument();
    expect(screen.queryByText('Plan Pro')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mejorar a Pro' })).not.toBeInTheDocument();
  });

  it('does not show a Free plan when subscription loading fails', () => {
    subscriptionQuery.mockReturnValue({ isLoading: false, isError: true, refetch: vi.fn() });
    usageQuery.mockReturnValue({ data: usage, isLoading: false, refetch: vi.fn() });
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <SubscriptionTab />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(es.settings.usageUnavailable);
    expect(screen.queryByText('12/15 este mes')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.settings.retryUsage })).toBeVisible();
  });

  it('links high usage to the plan and usage screen instead of an upgrade', () => {
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <UsageIndicator usage={usage} showTransactions />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Análisis IA: 12/15')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver límites' })).toHaveAttribute(
      'href',
      '/settings?tab=subscription',
    );
    expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
  });

  it('shows complimentary Pro access without billing status for an existing Pro record', () => {
    subscriptionQuery.mockReturnValue({
      data: {
        plan: 'pro',
        status: 'past_due',
        current_period_start: '2026-10-01T00:00:00Z',
        current_period_end: '2026-11-01T00:00:00Z',
      },
      isLoading: false,
    });
    usageQuery.mockReturnValue({ data: usage, isLoading: false });

    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <SubscriptionTab />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Anotto no cobra por ahora.')).toBeInTheDocument();
    expect(screen.queryByText('Vencido')).not.toBeInTheDocument();
    expect(screen.queryByText('Período actual')).not.toBeInTheDocument();
  });
});
