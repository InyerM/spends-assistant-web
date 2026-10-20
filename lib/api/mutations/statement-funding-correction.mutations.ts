import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export function useStatementFundingCorrection(
  id: string,
): ReturnType<typeof useMutation<void, Error, { expected_amount: number; actual_amount: number }>> {
  const cache = useQueryClient();
  const attempt = useRef({ body: '', key: '' });
  return useMutation({
    mutationFn: async (input: {
      expected_amount: number;
      actual_amount: number;
    }): Promise<void> => {
      const body = JSON.stringify(input);
      if (attempt.current.body !== body) attempt.current = { body, key: crypto.randomUUID() };
      const response = await fetch(`/api/transactions/${id}/funding-correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key },
        body,
      });
      if (!response.ok) {
        const result = (await response.json()) as { code?: string };
        throw new Error(result.code ?? 'FUNDING_REVIEW_REQUIRED');
      }
    },
    onSuccess: async (): Promise<void> => {
      attempt.current = { body: '', key: '' };
      await Promise.all(
        ['transactions', 'accounts', 'documents', 'dashboard', 'budgets'].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
}
