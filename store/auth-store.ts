import { create } from 'zustand';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabaseClient } from '@/lib/supabase/client';

export interface AuthState {
  supabaseUser: SupabaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthActions {
  setSupabaseUser: (user: SupabaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordReset: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  supabaseUser: null,
  isLoading: true,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,

  setSupabaseUser: (user): void =>
    set({
      supabaseUser: user,
      isAuthenticated: !!user,
    }),

  setLoading: (loading): void => set({ isLoading: loading }),

  signUp: async (email, password): Promise<void> => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;

      const signedInUser = data.session?.user ?? null;
      set({
        supabaseUser: signedInUser,
        isAuthenticated: !!signedInUser,
        isLoading: false,
      });
    } catch (error) {
      set({ ...initialState, isLoading: false });
      throw error;
    }
  },

  signInWithPassword: async (email, password): Promise<void> => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      set({
        supabaseUser: data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ ...initialState, isLoading: false });
      throw error;
    }
  },

  signInWithGoogle: async (): Promise<void> => {
    set({ isLoading: true });
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  requestPasswordReset: async (email): Promise<void> => {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/recovery`,
    });
    if (error) throw error;
  },

  completePasswordReset: async (password): Promise<void> => {
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    await useAuthStore.getState().signOut();
  },

  signOut: async (): Promise<void> => {
    set({ isLoading: true });
    try {
      const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
      if (error) throw error;
      set({ ...initialState, isLoading: false });
    } catch {
      set({ ...initialState, isLoading: false });
    }
  },

  initialize: async (): Promise<void> => {
    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      set({
        supabaseUser: user,
        isAuthenticated: !!user,
        isLoading: false,
      });

      supabaseClient.auth.onAuthStateChange((_event, session) => {
        const newUser = session?.user ?? null;

        set({
          supabaseUser: newUser,
          isAuthenticated: !!newUser,
        });

        if (!newUser) {
          set({ ...initialState, isLoading: false });
        }
      });
    } catch {
      set({ ...initialState, isLoading: false });
    }
  },
}));

export const useAuthUser = (): SupabaseUser | null => useAuthStore((state) => state.supabaseUser);
