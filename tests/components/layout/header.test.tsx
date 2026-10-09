import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Header } from '@/components/layout/header';
vi.mock('next/navigation', () => ({
  usePathname: () => '/inbox/11111111-1111-4111-8111-111111111111',
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/notifications/notification-center', () => ({
  NotificationCenter: () => null,
}));
afterEach(cleanup);
it('keeps the email navigation title on the original-email detail route', () => {
  render(<Header />);
  expect(screen.getByRole('heading', { name: 'emailInbox' })).toBeInTheDocument();
});
