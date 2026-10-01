import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WealthRecordControls } from '@/components/wealth/wealth-record-controls';

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      key,
}));

describe('manual wealth record controls', () => {
  it('edits a label without changing event amounts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'record-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const onChanged = vi.fn();
    render(
      <WealthRecordControls
        kind='investment'
        id='record-1'
        name='BTC'
        hasEvents
        archived={false}
        onChanged={onChanged}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'editName' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'name' }), {
      target: { value: 'Bitcoin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/investments/record-1',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ action: 'rename', label: 'Bitcoin' });
    expect(onChanged).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'delete' })).not.toBeInTheDocument();
  });

  it('asks for confirmation before deleting an empty record', () => {
    render(
      <WealthRecordControls
        kind='loan'
        id='record-2'
        name='Draft loan'
        hasEvents={false}
        archived={false}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(screen.getByText('deleteWarning')).toBeInTheDocument();
  });
});
