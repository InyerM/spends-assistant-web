import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DashboardZone } from '@/components/planning/dashboard-zone';
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);
afterEach(cleanup);
it('previews the target dimensions before committing a widget drop', () => {
  const change = vi.fn();
  const { container } = render(
    <DashboardZone
      zone='overview'
      editing
      items={[
        { id: 'summary', width: 12, height: 2, zone: 'overview' },
        { id: 'reviewInbox', width: 4, height: 2, zone: 'activity' },
      ]}
      onChange={change}
      renderWidget={(id) => <p>{id}</p>}
    />,
  );
  const transfer = {
    types: ['application/x-anotto-widget-reviewInbox'],
    getData: () => 'reviewInbox',
  };
  fireEvent.dragOver(container.querySelector('[data-widget="summary"]')!, {
    dataTransfer: transfer,
  });
  const preview = screen.getByRole('status', { name: 'dropPreview' });
  expect(preview).toHaveAttribute('data-preview-width', '4');
  expect(change).not.toHaveBeenCalled();
  fireEvent.drop(preview, { dataTransfer: transfer });
  expect(change.mock.calls[0][0].map((row: { id: string }) => row.id)).toEqual([
    'reviewInbox',
    'summary',
  ]);
  expect(screen.queryByRole('status', { name: 'dropPreview' })).not.toBeInTheDocument();
});
