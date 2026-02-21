import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAiParse } from '@/hooks/use-ai-parse';
import { parseDateString, parseTimeString, buildFieldsFromParse } from '@/lib/utils/ai-parse';

// --- Pure utility function tests ---

describe('parseDateString', () => {
  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(parseDateString('25/12/2024')).toBe('2024-12-25');
  });

  it('converts DD/MM/YY to YYYY-MM-DD with 20xx prefix', () => {
    expect(parseDateString('01/06/24')).toBe('2024-06-01');
  });

  it('pads single-digit day and month', () => {
    expect(parseDateString('5/3/2024')).toBe('2024-03-05');
  });

  it('returns original string when not 3 parts', () => {
    expect(parseDateString('2024-12-25')).toBe('2024-12-25');
    expect(parseDateString('invalid')).toBe('invalid');
  });
});

describe('parseTimeString', () => {
  it('adds seconds when only HH:mm is given', () => {
    expect(parseTimeString('14:30')).toBe('14:30:00');
  });

  it('returns original when already HH:mm:ss', () => {
    expect(parseTimeString('14:30:45')).toBe('14:30:45');
  });

  it('returns original when unexpected format', () => {
    expect(parseTimeString('2pm')).toBe('2pm');
  });
});

describe('buildFieldsFromParse', () => {
  const mockGetCurrentTimes = { date: '2024-06-15', time: '10:30:00' };

  it('builds form fields from parsed result', () => {
    const result = {
      parsed: {
        amount: 50000,
        description: 'Lunch',
        category: 'Food',
        original_date: '15/06/2024',
        original_time: '12:30',
        confidence: 95,
      },
      resolved: {
        account_id: 'a1',
        category_id: 'c1',
        type: 'expense',
        notes: 'some notes',
      },
      applied_rules: [],
    };

    const fields = buildFieldsFromParse(result, mockGetCurrentTimes);
    expect(fields).toEqual({
      date: '2024-06-15',
      time: '12:30:00',
      amount: 50000,
      description: 'Lunch',
      type: 'expense',
      account_id: 'a1',
      category_id: 'c1',
      transfer_to_account_id: undefined,
      notes: 'some notes',
    });
  });

  it('uses current date/time when original_date/time is null', () => {
    const result = {
      parsed: {
        amount: 10000,
        description: 'Coffee',
        category: 'Food',
        original_date: null,
        original_time: null,
        confidence: 80,
      },
      resolved: {
        account_id: 'a1',
      },
      applied_rules: [],
    };

    const fields = buildFieldsFromParse(result, mockGetCurrentTimes);
    expect(fields.date).toBe('2024-06-15');
    expect(fields.time).toBe('10:30:00');
  });

  it('defaults type to expense when not provided', () => {
    const result = {
      parsed: {
        amount: 5000,
        description: 'Test',
        category: 'Misc',
        confidence: 70,
      },
      resolved: {},
      applied_rules: [],
    };

    const fields = buildFieldsFromParse(result, mockGetCurrentTimes);
    expect(fields.type).toBe('expense');
  });

  it('handles transfer type with transfer_to_account_id', () => {
    const result = {
      parsed: {
        amount: 100000,
        description: 'Transfer savings',
        category: 'Transfers',
        confidence: 90,
        type: 'transfer',
      },
      resolved: {
        account_id: 'a1',
        transfer_to_account_id: 'a2',
        type: 'transfer',
      },
      applied_rules: [],
    };

    const fields = buildFieldsFromParse(result, mockGetCurrentTimes);
    expect(fields.type).toBe('transfer');
    expect(fields.transfer_to_account_id).toBe('a2');
  });
});

// --- Hook state machine tests ---

describe('useAiParse', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with ai-prompt step', () => {
    const { result } = renderHook(() => useAiParse());
    expect(result.current.step).toBe('ai-prompt');
    expect(result.current.aiText).toBe('');
    expect(result.current.isParsing).toBe(false);
    expect(result.current.parseResult).toBeNull();
    expect(result.current.limitReached).toBe(false);
    expect(result.current.skippedReason).toBeNull();
  });

  it('updates aiText via setAiText', () => {
    const { result } = renderHook(() => useAiParse());
    act(() => result.current.setAiText('some text'));
    expect(result.current.aiText).toBe('some text');
  });

  it('handleCreateManually transitions to form step', () => {
    const { result } = renderHook(() => useAiParse());
    act(() => result.current.handleCreateManually());
    expect(result.current.step).toBe('form');
    expect(result.current.parseResult).toBeNull();
  });

  it('resetToPrompt transitions back to ai-prompt', () => {
    const { result } = renderHook(() => useAiParse());
    act(() => result.current.handleCreateManually());
    expect(result.current.step).toBe('form');

    act(() => result.current.resetToPrompt());
    expect(result.current.step).toBe('ai-prompt');
    expect(result.current.aiText).toBe('');
    expect(result.current.parseResult).toBeNull();
  });

  it('handleParse does nothing when aiText is empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useAiParse());

    await act(async () => {
      await result.current.handleParse();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handleParse sets limitReached on 429 with PARSE_LIMIT_REACHED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Limit reached', code: 'PARSE_LIMIT_REACHED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAiParse());
    act(() => result.current.setAiText('some text'));

    await act(async () => {
      await result.current.handleParse();
    });

    expect(result.current.limitReached).toBe(true);
    expect(result.current.step).toBe('ai-prompt');
  });

  it('handleParse sets skippedReason when response status is skipped', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'skipped', reason: 'spending_summary' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAiParse());
    act(() => result.current.setAiText('your balance is 1000'));

    await act(async () => {
      await result.current.handleParse();
    });

    expect(result.current.skippedReason).toBe('spending_summary');
    expect(result.current.step).toBe('ai-prompt');
  });

  it('handleParse transitions to ai-result on successful parse', async () => {
    const mockResult = {
      parsed: {
        amount: 50000,
        description: 'Lunch',
        category: 'Food',
        confidence: 95,
      },
      resolved: { account_id: 'a1', category_id: 'c1' },
      applied_rules: [],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAiParse());
    act(() => result.current.setAiText('Lunch 50k'));

    await act(async () => {
      await result.current.handleParse();
    });

    expect(result.current.step).toBe('ai-result');
    expect(result.current.parseResult).toEqual(mockResult);
    expect(result.current.isParsing).toBe(false);
  });

  it('handleEditInForm transitions from ai-result to form and returns fields', async () => {
    const mockResult = {
      parsed: {
        amount: 50000,
        description: 'Lunch',
        category: 'Food',
        confidence: 95,
        original_date: '15/06/2024',
        original_time: '12:30',
      },
      resolved: { account_id: 'a1', category_id: 'c1', type: 'expense' },
      applied_rules: [],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAiParse());
    act(() => result.current.setAiText('Lunch 50k'));

    await act(async () => {
      await result.current.handleParse();
    });

    let fields: ReturnType<typeof result.current.handleEditInForm>;
    act(() => {
      fields = result.current.handleEditInForm();
    });

    expect(result.current.step).toBe('form');
    expect(fields!).toEqual(
      expect.objectContaining({
        amount: 50000,
        description: 'Lunch',
        account_id: 'a1',
        category_id: 'c1',
      }),
    );
  });

  it('aiSource is populated after handleEditInForm', async () => {
    const mockResult = {
      parsed: {
        amount: 50000,
        description: 'Lunch',
        category: 'Food',
        confidence: 95,
      },
      resolved: { account_id: 'a1' },
      applied_rules: [],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAiParse());
    act(() => result.current.setAiText('Lunch 50k'));

    await act(async () => {
      await result.current.handleParse();
    });

    act(() => {
      result.current.handleEditInForm();
    });

    expect(result.current.aiSource).toEqual(
      expect.objectContaining({
        raw_text: 'Lunch 50k',
        confidence: 95,
      }),
    );
  });

  it('clearSkippedReason clears the skipped reason', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'skipped', reason: 'otp_code' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useAiParse());
    act(() => result.current.setAiText('Your OTP is 1234'));

    await act(async () => {
      await result.current.handleParse();
    });

    expect(result.current.skippedReason).toBe('otp_code');

    act(() => result.current.clearSkippedReason());
    expect(result.current.skippedReason).toBeNull();
  });
});
