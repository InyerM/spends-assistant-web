import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { SecurityTab } from '@/components/settings/security-tab';
import es from '@/messages/es.json';

vi.mock('@/hooks/use-sessions', () => ({
  useSessions: () => ({
    data: [
      {
        id: 'device-1',
        device_name: 'Safari on iOS',
        device_type: 'mobile',
        ip_address: null,
        last_active_at: '2026-10-06T10:00:00Z',
      },
    ],
    isLoading: false,
  }),
  useRemoveDeviceRecord: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { email: 'owner@example.test', providers: ['email'] } }),
}));
vi.mock('@/lib/supabase/client', () => ({ supabaseClient: { auth: {} } }));

afterEach(cleanup);

describe('security device history', () => {
  it('does not describe tracked device metadata as revocable auth sessions', () => {
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <SecurityTab />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Dispositivos recientes')).toBeInTheDocument();
    expect(screen.getByText(/no cierra la sesión/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar del historial' })).toBeInTheDocument();
    expect(screen.queryByText('Actual')).not.toBeInTheDocument();
  });
});
