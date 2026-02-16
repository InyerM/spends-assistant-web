import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface UserSettings {
  user_id: string;
  hour_format: '12h' | '24h';
  show_api_keys: boolean;
}

const DEFAULTS: Omit<UserSettings, 'user_id'> = {
  hour_format: '12h',
  show_api_keys: false,
};

export const userSettingsKeys = {
  all: ['user-settings'] as const,
  detail: () => [...userSettingsKeys.all, 'detail'] as const,
};

async function fetchUserSettings(): Promise<UserSettings> {
  const res = await fetch('/api/settings/user-settings');
  if (!res.ok) throw new Error('Failed to fetch user settings');
  return res.json() as Promise<UserSettings>;
}

async function updateUserSettings(
  input: Partial<Omit<UserSettings, 'user_id'>>,
): Promise<UserSettings> {
  const res = await fetch('/api/settings/user-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error((error as { error: string }).error || 'Failed to update user settings');
  }
  return res.json() as Promise<UserSettings>;
}

export function useUserSettings(): ReturnType<typeof useQuery<UserSettings>> {
  return useQuery({
    queryKey: userSettingsKeys.detail(),
    queryFn: fetchUserSettings,
    placeholderData: { user_id: '', ...DEFAULTS },
  });
}

export function useUpdateUserSettings(): ReturnType<
  typeof useMutation<UserSettings, Error, Partial<Omit<UserSettings, 'user_id'>>>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(userSettingsKeys.detail(), data);
    },
  });
}
