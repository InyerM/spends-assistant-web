import { describe, expect, it } from 'vitest';
import {
  categoryFromCurrentRules,
  merchantFromForwardedEvidence,
} from '@/lib/shortcut-inbox/updated-rules';

const rule = {
  rule_type: 'general' as const,
  is_active: true,
  priority: 100,
  condition_logic: 'or' as const,
  conditions: { description_contains: ['TIENDAS ARA'] },
  actions: { set_category: 'groceries' },
};

describe('current category rules', () => {
  it('uses the latest active merchant rule on every review', () => {
    expect(
      merchantFromForwardedEvidence('Compraste $25.000 en TIENDAS ARA con tu T.Deb *9989'),
    ).toBe('TIENDAS ARA');
    expect(
      categoryFromCurrentRules('TIENDAS ARA', 'purchase at TIENDAS ARA', 25000, null, [rule]),
    ).toBe('groceries');
    expect(
      categoryFromCurrentRules('TIENDAS ARA', '', 25000, null, [{ ...rule, is_active: false }]),
    ).toBeNull();
  });

  it('respects account and amount conditions', () => {
    const conditional = { ...rule, conditions: { from_account: 'a', amount_equals: 25000 } };
    expect(categoryFromCurrentRules('Merchant', '', 25000, 'b', [conditional])).toBeNull();
    expect(categoryFromCurrentRules('Merchant', '', 25000, 'a', [conditional])).toBe('groceries');
  });
});

it('stops on an explicit high-priority clear and distinguishes it from no match', async () => {
  const { categoryDecisionFromCurrentRules } = await import('@/lib/shortcut-inbox/updated-rules');
  expect(
    categoryDecisionFromCurrentRules('TIENDAS ARA', '', 1, null, [
      { ...rule, id: 'high', actions: { set_category: null } },
      { ...rule, id: 'low', priority: 1 },
    ]),
  ).toEqual({ matched: true, categoryId: null, ruleId: 'high' });
});
it('breaks category priority ties by ID in either input order', () => {
  const rules = [
    { ...rule, id: 'a', actions: { set_category: 'a' } },
    { ...rule, id: 'b', actions: { set_category: 'b' } },
  ];
  for (const input of [rules, [...rules].reverse()])
    expect(categoryFromCurrentRules('TIENDAS ARA', '', 1, null, input)).toBe('a');
});
