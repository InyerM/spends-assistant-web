import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PendingReviewWidget } from '@/components/dashboard/pending-review-widget';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count: number }) =>
    values ? `${key} ${values.count}` : key,
}));
vi.mock('@/lib/api/queries/inbox-pending.queries', () => ({
  usePendingInboxCount: () => ({ data: 3, isError: false }),
}));
vi.mock('@/lib/api/queries/document-pending.queries', () => ({
  usePendingDocumentCount: () => ({ data: 12, isError: false }),
}));
afterEach(cleanup);
it.each([
  ['inbox', 3, '/inbox'],
  ['documents', 12, '/documents'],
] as const)('shows a concrete count and destination for %s', (kind, count, href) => {
  render(<PendingReviewWidget kind={kind} />);
  expect(screen.getByText(String(count))).toBeVisible();
  expect(screen.getByRole('link')).toHaveAttribute('href', href);
});
