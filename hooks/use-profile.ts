import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  providers: string[];
  created_at: string;
}

export const profileKeys = {
  all: ['profile'] as const,
  detail: () => [...profileKeys.all, 'detail'] as const,
};

async function fetchProfile(): Promise<UserProfile> {
  const res = await fetch('/api/settings/profile');
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json() as Promise<UserProfile>;
}

async function updateProfile(input: { display_name?: string }): Promise<UserProfile> {
  const res = await fetch('/api/settings/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to update profile');
  }
  return res.json() as Promise<UserProfile>;
}

export function useProfile(): ReturnType<typeof useQuery<UserProfile>> {
  return useQuery({
    queryKey: profileKeys.detail(),
    queryFn: fetchProfile,
  });
}

export function useUpdateProfile(): ReturnType<
  typeof useMutation<UserProfile, Error, { display_name?: string }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}
