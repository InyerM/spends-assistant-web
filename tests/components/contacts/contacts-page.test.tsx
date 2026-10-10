import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContactsPage from '@/app/(dashboard)/contacts/page';
import messages from '@/messages/es.json';

vi.mock('@/lib/api/queries/contacts.queries', () => ({
  useContacts: () => ({
    data: {
      items: [
        {
          id: 'contact',
          identity_kind: 'account',
          identity_value: '001234567890',
          display_name: '001234567890',
          custom_name: null,
          name: '001234567890',
          movement_count: 1,
          last_activity: '2026-10-09',
        },
      ],
      count: 1,
      scan: { total: 3, scanned: 3, unresolved: 2 },
    },
    isLoading: false,
    isError: false,
  }),
  scanContacts: vi.fn(),
}));
vi.mock('@/components/contacts/contact-detail-dialog', () => ({
  ContactDetailDialog: () => <div role='dialog'>Contact history</div>,
}));

describe('Contacts directory', () => {
  afterEach(cleanup);
  it('opens a contact by keyboard-compatible control and keeps scan details behind disclosure', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale='es' messages={messages}>
          <ContactsPage />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText('1 movimiento')).toBeVisible();
    expect(screen.getByText(/2 sin destinatario/).closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: /Cuenta de destino •7890/ }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.queryByText('001234567890')).not.toBeInTheDocument();
  });
});
