import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TermsAcceptanceGate } from '@/components/guards/terms-acceptance-gate';
const mocks = vi.hoisted(() => ({
  user: { id: 'owner-1', app_metadata: {} } as {
    id: string;
    app_metadata: Record<string, unknown>;
  },
  mutate: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ user: mocks.user, signOut: mocks.signOut }),
}));
vi.mock('@/lib/api/mutations/legal-acceptance.mutations', () => ({
  useAcceptCurrentTerms: () => ({ mutate: mocks.mutate, isPending: false, isError: false }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
afterEach(cleanup);
beforeEach(() => {
  mocks.user = { id: 'owner-1', app_metadata: {} };
  mocks.mutate.mockClear();
});
it('preserves existing accounts without recording an implied acceptance', () => {
  render(
    <TermsAcceptanceGate>
      <button>Private action</button>
    </TermsAcceptanceGate>,
  );
  expect(screen.getByText('Private action')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('blocks application children until explicit acceptance and cannot close with Escape', () => {
  mocks.user = { id: 'owner-1', app_metadata: { anotto_terms_required: true } };
  render(
    <TermsAcceptanceGate>
      <button>Private action</button>
    </TermsAcceptanceGate>,
  );
  expect(screen.queryByText('Private action')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'continue' })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'continue' }));
  expect(mocks.mutate).toHaveBeenCalledOnce();
});

it('requires a fresh acknowledgement when the authenticated owner changes', () => {
  mocks.user = { id: 'owner-1', app_metadata: { anotto_terms_required: true } };
  const view = render(
    <TermsAcceptanceGate>
      <p>Private</p>
    </TermsAcceptanceGate>,
  );
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'continue' })).toBeEnabled();
  mocks.user = { id: 'owner-2', app_metadata: { anotto_terms_required: true } };
  view.rerender(
    <TermsAcceptanceGate>
      <p>Private</p>
    </TermsAcceptanceGate>,
  );
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'continue' })).toBeDisabled();
});
