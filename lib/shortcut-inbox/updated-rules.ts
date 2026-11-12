import {
  assertAutomationRuleSet,
  matchesAutomationRegex,
  assertAutomationMatchInput,
} from '@/lib/automation/regex';
import type { AutomationRule } from '@/types/automation-rule';

type CategoryRule = Pick<
  AutomationRule,
  'rule_type' | 'is_active' | 'priority' | 'condition_logic' | 'conditions' | 'actions'
> & { id?: string };

export function merchantFromForwardedEvidence(rawText: string): string {
  return (
    /\bcompraste\s+\$[\d.,]+\s+en\s+([^\n]{2,100}?)\s+con\s+tu\s+T\./iu
      .exec(rawText)?.[1]
      ?.trim() ??
    /\bcompra\s+en\s+([^\n]{2,100}?)\s+por\s+\$/iu.exec(rawText)?.[1]?.trim() ??
    ''
  );
}

export function categoryDecisionFromCurrentRules(
  description: string,
  rawText: string,
  amount: number | null,
  accountId: string | null,
  rules: CategoryRule[],
): { matched: boolean; categoryId: string | null; ruleId: string | null } {
  assertAutomationRuleSet(rules.filter((rule) => rule.is_active));
  assertAutomationMatchInput(description, rawText);
  const normalizedDescription = description.toLowerCase();
  const normalizedRaw = rawText.toLowerCase();
  for (const rule of [...rules].sort(
    (a, b) => b.priority - a.priority || (a.id ?? '').localeCompare(b.id ?? ''),
  )) {
    if (!rule.is_active || rule.rule_type !== 'general' || rule.actions.set_category === undefined)
      continue;
    const { conditions } = rule;
    if (
      conditions.description_contains?.length &&
      !(rule.condition_logic === 'and'
        ? conditions.description_contains.every((term) =>
            normalizedDescription.includes(term.toLowerCase()),
          )
        : conditions.description_contains.some((term) =>
            normalizedDescription.includes(term.toLowerCase()),
          ))
    )
      continue;
    if (
      conditions.raw_text_contains?.length &&
      !(rule.condition_logic === 'and'
        ? conditions.raw_text_contains.every((term) => normalizedRaw.includes(term.toLowerCase()))
        : conditions.raw_text_contains.some((term) => normalizedRaw.includes(term.toLowerCase())))
    )
      continue;
    if (!matchesAutomationRegex(conditions.description_regex, description)) continue;
    if (conditions.amount_equals !== undefined && conditions.amount_equals !== amount) continue;
    if (
      conditions.amount_between &&
      (amount === null ||
        amount < conditions.amount_between[0] ||
        amount > conditions.amount_between[1])
    )
      continue;
    if (conditions.from_account && conditions.from_account !== accountId) continue;
    if (conditions.source && !conditions.source.includes('forwarded_email')) continue;
    if (conditions.to_account || conditions.category) continue;
    return { matched: true, categoryId: rule.actions.set_category, ruleId: rule.id ?? null };
  }
  return { matched: false, categoryId: null, ruleId: null };
}

export function categoryFromCurrentRules(
  description: string,
  rawText: string,
  amount: number | null,
  accountId: string | null,
  rules: CategoryRule[],
): string | null {
  return categoryDecisionFromCurrentRules(description, rawText, amount, accountId, rules)
    .categoryId;
}
