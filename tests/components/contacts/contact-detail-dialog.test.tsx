import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContactDetailDialog } from '@/components/contacts/contact-detail-dialog';
import messages from '@/messages/es.json';
const { renameContact } = vi.hoisted(() => ({ renameContact: vi.fn() }));
vi.mock('@/lib/api/queries/contacts.queries', () => ({
  renameContact,
  useContactDetail: () => ({ data: undefined, isLoading: false, isError: false }),
}));
vi.mock('@/lib/api/queries/statement.queries', () => ({
  useStatementProofs: () => ({ data: undefined }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('distinguishes the editable alias from complete immutable evidence and saves only the alias', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale='es' messages={messages}>
        <ContactDetailDialog
          contact={{
            id: 'synthetic-contact',
            identity_kind: 'account',
            identity_value: '001234567890',
            display_name: 'Original bank label',
            custom_name: 'Carolina',
            name: 'Carolina',
            movement_count: 1,
            last_activity: null,
          }}
          onClose={() => {}}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  const input = screen.getByRole('textbox', { name: 'Nombre para identificarlo' });
  expect(input).toHaveValue('Carolina');
  expect(screen.getByText('Identidad original')).toBeVisible();
  expect(screen.getByText('001234567890')).toBeVisible();
  expect(screen.getByText('Original bank label')).toBeVisible();
  expect(input).toHaveAccessibleDescription(/reconocer.*transferencias/i);
  fireEvent.change(input, { target: { value: '  Carolina trabajo  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
  await waitFor(() =>
    expect(renameContact).toHaveBeenCalledWith('synthetic-contact', 'Carolina trabajo'),
  );
  expect(renameContact).toHaveBeenCalledTimes(1);
});
