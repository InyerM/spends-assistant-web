import { useMutation } from '@tanstack/react-query';

async function deleteUserAccount(confirmation: string): Promise<void> {
  const response = await fetch('/api/settings/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation }),
  });
  if (!response.ok) throw new Error('Account deletion failed');
}

export function useDeleteUserAccount(): ReturnType<typeof useMutation<void, Error, string>> {
  return useMutation({ mutationFn: deleteUserAccount });
}
