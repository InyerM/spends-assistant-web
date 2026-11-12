import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthInitializer } from '@/providers/auth-initializer';

const auth = vi.hoisted(() => ({ initialize: vi.fn(async () => {}), isAuthenticated: true }));
vi.mock('@/store/auth-store', () => ({ useAuthStore: { getState: () => auth } }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('initializes once after client commit and tracks the authenticated session once', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  expect(renderToString(<AuthInitializer>Ready</AuthInitializer>)).toContain('Ready');
  expect(auth.initialize).not.toHaveBeenCalled();
  render(
    <StrictMode>
      <AuthInitializer>Ready</AuthInitializer>
    </StrictMode>,
  );
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/settings/sessions/track', { method: 'POST' }),
  );
  expect(auth.initialize).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
