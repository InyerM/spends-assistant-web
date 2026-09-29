import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import ShortcutInboxPage from '@/app/(dashboard)/transactions/shortcut-inbox/page';

const { useTranslations } = vi.hoisted(() => {
  const translate = (key: string): string =>
    ({
      title: 'Shortcut inbox',
      markNonTransaction: 'Mark non-transaction',
      dismiss: 'Dismiss',
      exportJson: 'Export JSON',
    })[key] ?? key;
  return { useTranslations: vi.fn(() => translate) };
});

vi.mock('next-intl', () => ({ useTranslations }));

describe('Shortcut inbox review page', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows private intake text with reversible review actions and no confirmation action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            {
              id: 'item-1',
              source: 'sms-shortcut',
              external_id: null,
              received_at: '2026-09-29T10:00:00Z',
              raw_text: 'Synthetic private message',
              status: 'pending',
              created_at: '2026-09-29T10:01:00Z',
            },
          ],
          count: 1,
        }),
      ),
    );
    render(<ShortcutInboxPage />);
    await waitFor(() => expect(screen.getByText('Synthetic private message')).toBeInTheDocument());
    expect(useTranslations).toHaveBeenCalledWith('shortcutInbox');
    expect(screen.getByRole('button', { name: 'Mark non-transaction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm transaction/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export JSON' })).toHaveAttribute(
      'href',
      '/api/shortcut-inbox/export',
    );
  });
});
