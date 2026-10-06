import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMerchantSuggestion } from '@/lib/api/queries/merchant-suggestion.queries';

describe('useMerchantSuggestion', () => {
  it('requests only merchant identity once the review has no existing category', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ category_id: 'shopping-id', source: 'ai' }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }): React.ReactElement => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ enabled }) => useMerchantSuggestion('AMAZON.COM', enabled, 'shopping-id'),
      { initialProps: { enabled: false }, wrapper },
    );
    expect(result.current.data).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() =>
      expect(result.current.data).toEqual({ category_id: 'shopping-id', source: 'ai' }),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('/api/merchant-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant: 'AMAZON.COM' }),
    });
  });
});
