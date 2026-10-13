import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DictationButton } from '@/components/transactions/dictation-button';
const mocks = vi.hoisted(() => ({ finish: vi.fn(), busy: vi.fn() }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/hooks/use-voice-draft', () => ({
  useVoiceDraft: () => ({
    start: vi.fn(),
    finish: mocks.finish,
    recording: true,
    acquiring: false,
    pending: false,
    error: null,
    relevance: null,
    completed: false,
  }),
}));
it('reports active dictation so analysis can wait and releases that state on unmount', () => {
  const view = render(<DictationButton value='' onChange={vi.fn()} onBusyChange={mocks.busy} />);
  expect(mocks.busy).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'stop' }));
  expect(mocks.finish).toHaveBeenCalled();
  view.unmount();
  expect(mocks.busy).toHaveBeenLastCalledWith(false);
});
