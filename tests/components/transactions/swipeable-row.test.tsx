import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { SwipeableRow } from '@/components/transactions/swipeable-row';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import pt from '@/messages/pt.json';

describe('transaction swipe action accessibility', () => {
  it.each([
    ['en', en],
    ['es', es],
    ['pt', pt],
  ] as const)('names edit and delete in %s and preserves their callbacks', (locale, messages) => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <SwipeableRow onEdit={onEdit} onDelete={onDelete}>
          <span>Transaction</span>
        </SwipeableRow>
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: messages.transactions.editTransaction }));
    fireEvent.click(screen.getByRole('button', { name: messages.transactions.deleteTransaction }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
