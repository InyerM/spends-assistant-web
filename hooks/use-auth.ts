import { useAuthStore } from '@/store/auth-store';
import type { AuthStore } from '@/store/auth-store';

interface UseAuthReturn {
  user: AuthStore['supabaseUser'];
  isAuthenticated: AuthStore['isAuthenticated'];
  isLoading: AuthStore['isLoading'];
  signUp: AuthStore['signUp'];
  signInWithPassword: AuthStore['signInWithPassword'];
  signInWithGoogle: AuthStore['signInWithGoogle'];
  signOut: AuthStore['signOut'];
}

export function useAuth(): UseAuthReturn {
  const user = useAuthStore((state) => state.supabaseUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const signUp = useAuthStore((state) => state.signUp);
  const signInWithPassword = useAuthStore((state) => state.signInWithPassword);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signOut = useAuthStore((state) => state.signOut);

  return {
    user,
    isAuthenticated,
    isLoading,
    signUp,
    signInWithPassword,
    signInWithGoogle,
    signOut,
  };
}
