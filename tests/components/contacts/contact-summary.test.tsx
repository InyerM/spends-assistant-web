import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { expect, it, vi } from 'vitest';
import messages from '@/messages/es.json';
import { ContactSummary } from '@/components/contacts/contact-summary';
const contact = {
  id: 'contact',
  identity_kind: 'merchant',
  display_name: 'Example shop',
  custom_name: null,
  name: 'Example shop',
  movement_count: 50,
};
vi.mock('@/lib/api/queries/contacts.queries', () => ({
  useContactSummary: () => ({ data: { items: [contact], count: 200, scan: { scanned: 1717 } } }),
}));
it('shows the global catalog summary with labeled counts and opens the ranked contact', () => {
  const onSelect = vi.fn();
  render(
    <NextIntlClientProvider locale='es' messages={messages}>
      <ContactSummary onSelect={onSelect} />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText('200')).toBeVisible();
  expect(screen.getByText('1717')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Example shop.*50 movimientos/ }));
  expect(onSelect).toHaveBeenCalledWith(contact);
});
