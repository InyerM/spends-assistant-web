import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChatHistory } from '@/components/chat/chat-history';
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), paged: false }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/api/queries/financial-chat-history.queries', () => ({
  useChatHistory: (page: number) => ({
    data: {
      data: [
        {
          id: 'one',
          question: 'How was my spending?',
          answer: '<script>not executable</script>',
          month: '2026-10',
          insufficient_context: false,
          citation_ids: [
            'transaction:11111111-1111-4111-8111-111111111111',
            'document:../../private',
            'https://evil.example',
          ],
        },
      ],
      hasMore: mocks.paged && page === 0,
    },
  }),
  useDeleteChat: () => ({ mutate: mocks.mutate, isPending: false, isError: false }),
}));
describe('saved financial chat review', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    mocks.paged = false;
  });
  it('keeps saved answers collapsed and renders model text safely', () => {
    render(<ChatHistory />);
    expect(screen.getByText('How was my spending?').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('<script>not executable</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
  it('renders only fixed validated source links', () => {
    render(<ChatHistory />);
    const link = screen.getByRole('link', { name: 'sourceTypes.transaction', hidden: true });
    expect(link).toHaveAttribute('href', '/transactions/11111111-1111-4111-8111-111111111111');
    expect(screen.getAllByRole('link', { hidden: true })).toHaveLength(1);
  });
  it('returns to the preceding page when its last entry is deleted', () => {
    mocks.paged = true;
    mocks.mutate.mockImplementation((_id: string, options: { onSuccess: () => void }) =>
      options.onSuccess(),
    );
    render(<ChatHistory />);
    fireEvent.click(screen.getByRole('button', { name: 'older' }));
    expect(screen.getByRole('button', { name: 'newer' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'deleteChat' }));
    const buttons = screen.getAllByRole('button', { name: 'deleteChat' });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByRole('button', { name: 'newer' })).toBeDisabled();
  });
  it('requires confirmation before permanent deletion', () => {
    render(<ChatHistory />);
    fireEvent.click(screen.getByRole('button', { name: 'deleteChat' }));
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(mocks.mutate).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole('button', { name: 'deleteChat' });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(mocks.mutate).toHaveBeenCalledWith(
      'one',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
