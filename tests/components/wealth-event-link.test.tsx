import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WealthEventLink } from '@/components/wealth/wealth-event-link';

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      key,
}));

describe('reviewed wealth event links', () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });
  it('shows the exact transaction link and requires review before changing it', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.startsWith('/api/transactions?')
            ? {
                data: [
                  {
                    id: 'tx-2',
                    date: '2026-09-29',
                    amount: 1200,
                    type: 'expense',
                    description: 'Loan payment',
                  },
                ],
              }
            : { unchanged: false },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onChanged = vi.fn();
    render(
      <WealthEventLink
        kind='loan_event'
        eventType='payment'
        eventId='event-1'
        date='2026-09-29'
        transactionId='tx-1'
        onChanged={onChanged}
      />,
    );
    expect(screen.getByRole('link', { name: 'viewTransaction' })).toHaveAttribute(
      'href',
      '/transactions/tx-1',
    );
    await user.click(screen.getByRole('button', { name: 'changeLink' }));
    await user.click(screen.getByRole('combobox', { name: 'selectTransaction' }));
    await user.click(await screen.findByRole('option', { name: /Loan payment/ }));
    expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
    await user.click(screen.getByLabelText('checked'));
    await user.click(screen.getByRole('button', { name: 'confirmLink' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/wealth-links',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const body = JSON.parse(
      fetchMock.mock.calls.find(([url]) => url === '/api/wealth-links')?.[1]?.body as string,
    );
    expect(body).toEqual({
      kind: 'loan_event',
      event_id: 'event-1',
      transaction_id: 'tx-2',
      reviewed: true,
    });
    expect(onChanged).toHaveBeenCalledOnce();
  });
});
