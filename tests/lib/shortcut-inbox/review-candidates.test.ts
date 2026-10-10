import { describe, expect, it } from 'vitest';
import { reviewCandidateSuggestions } from '@/lib/shortcut-inbox/candidates';

describe('authoritative creation review suggestions', () => {
  it('exposes every returned match without inventing a signal or confirming a duplicate', () => {
    expect(
      reviewCandidateSuggestions({
        status: 'review_required',
        candidate_count: 1,
        candidates: [
          {
            id: 'owned-match',
            date: '2026-09-24',
            amount: '15900.00',
            description: 'Subscription',
            source: 'web',
          },
        ],
      }),
    ).toEqual([
      {
        id: 'owned-match',
        date: '2026-09-24',
        amount: 15900,
        description: 'Subscription',
        source: 'web',
        type: '',
        strength: 'possible',
        signals: [],
      },
    ]);
  });
});
