import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePeriodSelector } from '@/hooks/use-period-selector';

describe('usePeriodSelector', () => {
  function renderPeriod(dateFrom = '2024-06-01', dateTo = '2024-06-30', onChange = vi.fn()) {
    return {
      ...renderHook(() => usePeriodSelector({ dateFrom, dateTo, onChange })),
      onChange,
    };
  }

  describe('initialization', () => {
    it('detects month mode from date range', () => {
      const { result } = renderPeriod('2024-06-01', '2024-06-30');
      expect(result.current.mode).toBe('month');
    });

    it('detects year mode from date range', () => {
      const { result } = renderPeriod('2024-01-01', '2024-12-31');
      expect(result.current.mode).toBe('year');
    });

    it('detects week mode from date range', () => {
      // 2024-01-01 is Monday, 2024-01-07 is Sunday
      const { result } = renderPeriod('2024-01-01', '2024-01-07');
      expect(result.current.mode).toBe('week');
    });
  });

  describe('handlePrev', () => {
    it('navigates to previous month in month mode', () => {
      const { result, onChange } = renderPeriod('2024-06-01', '2024-06-30');
      act(() => result.current.handlePrev());
      expect(onChange).toHaveBeenCalledWith('2024-05-01', '2024-05-31');
    });

    it('navigates to previous week in week mode', () => {
      const { result, onChange } = renderPeriod('2024-01-08', '2024-01-14');
      act(() => result.current.handlePrev());
      expect(onChange).toHaveBeenCalledWith('2024-01-01', '2024-01-07');
    });

    it('navigates to previous year in year mode', () => {
      const { result, onChange } = renderPeriod('2024-01-01', '2024-12-31');
      act(() => result.current.handlePrev());
      expect(onChange).toHaveBeenCalledWith('2023-01-01', '2023-12-31');
    });

    it('does nothing in custom mode', () => {
      const { result, onChange } = renderPeriod('2024-01-15', '2024-02-20');
      act(() => result.current.handlePrev());
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('handleNext', () => {
    it('navigates to next month in month mode', () => {
      const { result, onChange } = renderPeriod('2024-06-01', '2024-06-30');
      act(() => result.current.handleNext());
      expect(onChange).toHaveBeenCalledWith('2024-07-01', '2024-07-31');
    });

    it('navigates to next week in week mode', () => {
      const { result, onChange } = renderPeriod('2024-01-01', '2024-01-07');
      act(() => result.current.handleNext());
      expect(onChange).toHaveBeenCalledWith('2024-01-08', '2024-01-14');
    });

    it('navigates to next year in year mode', () => {
      const { result, onChange } = renderPeriod('2024-01-01', '2024-12-31');
      act(() => result.current.handleNext());
      expect(onChange).toHaveBeenCalledWith('2025-01-01', '2025-12-31');
    });
  });

  describe('handleMonthPick', () => {
    it('selects a month and calls onChange', () => {
      const { result, onChange } = renderPeriod('2024-06-01', '2024-06-30');
      act(() => result.current.handleMonthPick(0)); // January
      // pickerYear defaults to the year from dateFrom (2024)
      expect(onChange).toHaveBeenCalledWith('2024-01-01', '2024-01-31');
      expect(result.current.mode).toBe('month');
    });
  });

  describe('handleYearPick', () => {
    it('selects a year and calls onChange', () => {
      const { result, onChange } = renderPeriod('2024-01-01', '2024-12-31');
      act(() => result.current.handleYearPick(2023));
      expect(onChange).toHaveBeenCalledWith('2023-01-01', '2023-12-31');
      expect(result.current.mode).toBe('year');
    });
  });

  describe('handleWeekPick', () => {
    it('selects a week containing the given day', () => {
      const { result, onChange } = renderPeriod('2024-06-01', '2024-06-30');
      // Pick a Wednesday in January 2024 -> week should be Mon-Sun
      act(() => result.current.handleWeekPick(new Date(2024, 0, 3))); // Jan 3 is Wednesday
      expect(onChange).toHaveBeenCalledWith('2024-01-01', '2024-01-07');
      expect(result.current.mode).toBe('week');
    });
  });

  describe('handleCustomApply', () => {
    it('applies custom date range', () => {
      const { result, onChange } = renderPeriod('2024-06-01', '2024-06-30');

      // Set custom dates via the popover state
      act(() => result.current.setCustomFrom('2024-03-01'));
      act(() => result.current.setCustomTo('2024-04-15'));
      act(() => result.current.handleCustomApply());

      expect(onChange).toHaveBeenCalledWith('2024-03-01', '2024-04-15');
      expect(result.current.mode).toBe('custom');
    });

    it('does not apply when from > to', () => {
      const { result, onChange } = renderPeriod('2024-06-01', '2024-06-30');

      act(() => result.current.setCustomFrom('2024-05-01'));
      act(() => result.current.setCustomTo('2024-03-01'));
      act(() => result.current.handleCustomApply());

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('handleReset', () => {
    it('resets to current month', () => {
      const { result, onChange } = renderPeriod('2024-01-01', '2024-12-31');
      act(() => result.current.handleReset());
      expect(onChange).toHaveBeenCalled();
      expect(result.current.mode).toBe('month');
    });
  });

  describe('calendar grid computation', () => {
    it('calDays contains days for the month grid', () => {
      const { result } = renderPeriod('2024-06-01', '2024-06-30');
      // Calendar grid for June 2024 should have days
      expect(result.current.calDays.length).toBeGreaterThanOrEqual(28);
      expect(result.current.calDays.length % 7).toBe(0);
    });

    it('weeks is calDays grouped into rows of 7', () => {
      const { result } = renderPeriod('2024-06-01', '2024-06-30');
      for (const week of result.current.weeks) {
        expect(week).toHaveLength(7);
      }
      expect(result.current.weeks.length * 7).toBe(result.current.calDays.length);
    });

    it('years contains 12 year entries around decade', () => {
      const { result } = renderPeriod('2024-06-01', '2024-06-30');
      expect(result.current.years).toHaveLength(12);
    });
  });

  describe('label', () => {
    it('returns a non-empty label string', () => {
      const { result } = renderPeriod('2024-06-01', '2024-06-30');
      expect(result.current.label).toBeTruthy();
      expect(typeof result.current.label).toBe('string');
    });
  });

  describe('popover state', () => {
    it('exposes popoverTab and setPopoverTab', () => {
      const { result } = renderPeriod('2024-06-01', '2024-06-30');
      expect(result.current.popoverTab).toBe('month');
      act(() => result.current.setPopoverTab('week'));
      expect(result.current.popoverTab).toBe('week');
    });

    it('exposes pickerYear and setPickerYear', () => {
      const { result } = renderPeriod('2024-06-01', '2024-06-30');
      expect(result.current.pickerYear).toBe(2024);
      act(() => result.current.setPickerYear(2023));
      expect(result.current.pickerYear).toBe(2023);
    });
  });
});
