import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { DangerZoneSection } from '@/components/settings/danger-zone-section';
import es from '@/messages/es.json';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/hooks/use-app-settings', () => ({
  useAppSettings: () => ({ data: { support_email: 'support@spendsapp.com' } }),
}));
vi.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({ data: { email: 'synthetic@example.test' } }),
}));
vi.mock('@/lib/api/mutations/account-deletion.mutations', () => ({
  useDeleteUserAccount: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/lib/supabase/client', () => ({ supabaseClient: { auth: { signOut: vi.fn() } } }));
afterEach(cleanup);
it('separates destructive actions and links to the published retention policy', () => {
  render(
    <NextIntlClientProvider locale='es' messages={es}>
      <DangerZoneSection />
    </NextIntlClientProvider>,
  );
  const deletion = screen.getByRole('button', { name: 'Eliminar mi cuenta' });
  const support = screen.getByRole('link', { name: /Contactar Soporte/ });
  expect(support).toHaveAttribute('href', 'mailto:support@anotto.app');
  expect(deletion.parentElement).toBe(support.parentElement);
  expect(deletion.parentElement).toHaveClass('gap-3', 'flex-wrap');
  expect(
    screen.getByRole('link', { name: 'Consulta cómo conservamos y eliminamos los datos.' }),
  ).toHaveAttribute('href', 'https://anotto.app/privacy/#conservacion');
});
