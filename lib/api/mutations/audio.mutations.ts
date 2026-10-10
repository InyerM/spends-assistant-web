import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useTranscribeAudio(): ReturnType<
  typeof useMutation<string, Error, { data: string; format: string; language: string }>
> {
  const client = useQueryClient();
  return useMutation({
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['usage'] });
    },
    mutationFn: async (input) => {
      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok)
        throw new Error(
          response.status === 428 ? 'consent' : response.status === 429 ? 'quota' : 'service',
        );
      const result = (await response.json()) as { text: string };
      return result.text;
    },
  });
}
