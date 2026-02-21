import { useMutation } from '@tanstack/react-query';

interface GeneratedRule {
  name: string;
  rule_type: string;
  condition_logic: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  priority?: number;
}

interface GenerateRulesResponse {
  rules: GeneratedRule[];
  prompt: string;
}

async function generateAutomationRules(prompt: string): Promise<GenerateRulesResponse> {
  const res = await fetch('/api/automation-rules/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Generation failed' }));
    throw new Error((data as { error: string }).error || 'Failed to generate rules');
  }

  return res.json() as Promise<GenerateRulesResponse>;
}

export function useGenerateAutomationRules(): ReturnType<
  typeof useMutation<GenerateRulesResponse, Error, string>
> {
  return useMutation({
    mutationFn: generateAutomationRules,
  });
}
