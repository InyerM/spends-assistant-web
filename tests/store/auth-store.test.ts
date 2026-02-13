import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignInWithPassword = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  supabaseClient: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

describe('useAuthStore', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    // Reset module to get fresh store
    vi.resetModules();
  });

  it('has correct initial state', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    const state = useAuthStore.getState();
    expect(state.supabaseUser).toBeNull();
    expect(state.isLoading).toBe(true);
    expect(state.isAuthenticated).toBe(false);
  });

  it('setSupabaseUser updates user and auth status', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    useAuthStore.getState().setSupabaseUser(mockUser as never);

    const state = useAuthStore.getState();
    expect(state.supabaseUser).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('setSupabaseUser with null clears auth', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    useAuthStore.getState().setSupabaseUser({ id: 'user-1' } as never);
    useAuthStore.getState().setSupabaseUser(null);

    const state = useAuthStore.getState();
    expect(state.supabaseUser).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setLoading updates loading state', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    useAuthStore.getState().setLoading(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('signInWithPassword sets user on success', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    mockSignInWithPassword.mockResolvedValue({ data: { user: mockUser }, error: null });

    await useAuthStore.getState().signInWithPassword('test@test.com', 'pass');

    const state = useAuthStore.getState();
    expect(state.supabaseUser).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('signInWithPassword throws and resets on error', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new Error('Invalid credentials'),
    });

    await expect(
      useAuthStore.getState().signInWithPassword('bad@test.com', 'wrong'),
    ).rejects.toThrow('Invalid credentials');

    const state = useAuthStore.getState();
    expect(state.supabaseUser).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('signOut resets state', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    mockSignOut.mockResolvedValue({ error: null });

    useAuthStore.setState({ supabaseUser: { id: 'user-1' } as never, isAuthenticated: true });
    await useAuthStore.getState().signOut();

    const state = useAuthStore.getState();
    expect(state.supabaseUser).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('signOut resets state even on error', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    mockSignOut.mockResolvedValue({ error: new Error('Signout failed') });

    useAuthStore.setState({ supabaseUser: { id: 'user-1' } as never, isAuthenticated: true });
    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().supabaseUser).toBeNull();
  });

  it('initialize loads user and sets up listener', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.supabaseUser).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it('initialize handles no user', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().supabaseUser).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('initialize handles error gracefully', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    mockGetUser.mockRejectedValue(new Error('Network error'));

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().supabaseUser).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('signInWithGoogle calls signInWithOAuth', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    await useAuthStore.getState().signInWithGoogle();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    );
  });

  it('signInWithGoogle throws on error', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    mockSignInWithOAuth.mockResolvedValue({ error: new Error('OAuth error') });

    await expect(useAuthStore.getState().signInWithGoogle()).rejects.toThrow('OAuth error');
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('onAuthStateChange callback updates user', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    const mockUser = { id: 'user-1' };
    let authCallback: (event: string, session: unknown) => void = () => {};

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    await useAuthStore.getState().initialize();

    // Simulate user session change
    const newUser = { id: 'user-2', email: 'new@test.com' };
    authCallback('SIGNED_IN', { user: newUser });

    expect(useAuthStore.getState().supabaseUser).toEqual(newUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('onAuthStateChange callback handles sign out', async () => {
    const { useAuthStore } = await import('@/store/auth-store');
    const mockUser = { id: 'user-1' };
    let authCallback: (event: string, session: unknown) => void = () => {};

    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockOnAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    await useAuthStore.getState().initialize();

    // Simulate sign out (null session)
    authCallback('SIGNED_OUT', null);

    expect(useAuthStore.getState().supabaseUser).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('useAuthUser selector returns supabase user', async () => {
    const { useAuthStore, useAuthUser } = await import('@/store/auth-store');
    const mockUser = { id: 'user-1' };
    useAuthStore.setState({ supabaseUser: mockUser as never });

    // Test that the selector is defined (it's a hook, needs React context to actually run)
    expect(useAuthUser).toBeDefined();
  });
});
