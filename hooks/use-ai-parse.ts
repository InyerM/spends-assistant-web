import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { getCurrentColombiaTimes } from '@/lib/utils/date';
import { buildFieldsFromParse, type ParseResponse, type FormFields } from '@/lib/utils/ai-parse';
import type { AppliedRule } from '@/types';

type Step = 'ai-prompt' | 'ai-result' | 'form';

export interface AiSource {
  raw_text: string;
  confidence: number;
  parsed_data: Record<string, unknown>;
  applied_rules?: AppliedRule[];
}

export interface UseAiParseReturn {
  step: Step;
  aiText: string;
  setAiText: (text: string) => void;
  isParsing: boolean;
  parseResult: ParseResponse | null;
  limitReached: boolean;
  skippedReason: string | null;
  aiSource: AiSource | null;
  handleParse: () => Promise<void>;
  handleEditInForm: () => FormFields | null;
  handleCreateManually: () => void;
  resetToPrompt: () => void;
  setStep: (step: Step) => void;
  setParseResult: (result: ParseResponse | null) => void;
  setAiSource: (source: AiSource | null) => void;
  setLimitReached: (reached: boolean) => void;
  setSkippedReason: (reason: string | null) => void;
  clearSkippedReason: () => void;
  buildFields: () => FormFields | null;
}

export function useAiParse(): UseAiParseReturn {
  const [step, setStep] = useState<Step>('ai-prompt');
  const [aiText, setAiText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [skippedReason, setSkippedReason] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<AiSource | null>(null);

  const handleParse = useCallback(async (): Promise<void> => {
    if (!aiText.trim()) return;
    setIsParsing(true);
    setParseResult(null);
    setLimitReached(false);
    setSkippedReason(null);
    try {
      const res = await fetch('/api/transactions/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Parse failed' }));
        const errObj = err as { error: string; code?: string };
        if (res.status === 429 && errObj.code === 'PARSE_LIMIT_REACHED') {
          setLimitReached(true);
          return;
        }
        throw new Error(errObj.error);
      }
      const data = (await res.json()) as ParseResponse & { status?: string; reason?: string };
      if (data.status === 'skipped') {
        setSkippedReason(data.reason ?? 'unknown');
        return;
      }
      setParseResult(data);
      setStep('ai-result');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to parse');
    } finally {
      setIsParsing(false);
    }
  }, [aiText]);

  const buildFields = useCallback((): FormFields | null => {
    if (!parseResult) return null;
    const times = getCurrentColombiaTimes();
    return buildFieldsFromParse(parseResult, times);
  }, [parseResult]);

  const handleEditInForm = useCallback((): FormFields | null => {
    if (!parseResult) return null;
    const fields = buildFields();
    setAiSource({
      raw_text: aiText,
      confidence: parseResult.parsed.confidence,
      parsed_data: parseResult.parsed as unknown as Record<string, unknown>,
      applied_rules: parseResult.applied_rules.length > 0 ? parseResult.applied_rules : undefined,
    });
    setStep('form');
    return fields;
  }, [parseResult, aiText, buildFields]);

  const handleCreateManually = useCallback((): void => {
    setAiSource(null);
    setParseResult(null);
    setStep('form');
  }, []);

  const resetToPrompt = useCallback((): void => {
    setAiText('');
    setParseResult(null);
    setLimitReached(false);
    setSkippedReason(null);
    setAiSource(null);
    setStep('ai-prompt');
  }, []);

  const clearSkippedReason = useCallback((): void => {
    setSkippedReason(null);
  }, []);

  return useMemo(
    () => ({
      step,
      aiText,
      setAiText,
      isParsing,
      parseResult,
      limitReached,
      skippedReason,
      aiSource,
      handleParse,
      handleEditInForm,
      handleCreateManually,
      resetToPrompt,
      setStep,
      setParseResult,
      setAiSource,
      setLimitReached,
      setSkippedReason,
      clearSkippedReason,
      buildFields,
    }),
    [
      step,
      aiText,
      isParsing,
      parseResult,
      limitReached,
      skippedReason,
      aiSource,
      handleParse,
      handleEditInForm,
      handleCreateManually,
      resetToPrompt,
      clearSkippedReason,
      buildFields,
    ],
  );
}
