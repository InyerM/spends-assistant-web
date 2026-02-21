import { useMutation } from '@tanstack/react-query';

async function updateLanguage(language: string): Promise<unknown> {
  const res = await fetch('/api/settings/language', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) {
    const error = (await res.json()) as { error?: string };
    throw new Error(error.error ?? 'Failed to update language');
  }
  return res.json();
}

export function useUpdateLanguage(): ReturnType<typeof useMutation<unknown, Error, string>> {
  return useMutation({ mutationFn: updateLanguage });
}
