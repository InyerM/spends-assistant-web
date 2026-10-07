import type { AutomationRule } from '@/types/automation-rule';

type CategoryRule = Pick<
  AutomationRule,
  'rule_type' | 'is_active' | 'priority' | 'condition_logic' | 'conditions' | 'actions'
>;

export function merchantFromForwardedEvidence(rawText: string): string {
  return (
    /\bcompraste\s+\$[\d.,]+\s+en\s+([^\n]{2,100}?)\s+con\s+tu\s+T\./iu
      .exec(rawText)?.[1]
      ?.trim() ??
    /\bcompra\s+en\s+([^\n]{2,100}?)\s+por\s+\$/iu.exec(rawText)?.[1]?.trim() ??
    ''
  );
}

export function categoryFromCurrentRules(
  description: string,
  rawText: string,
  amount: number | null,
  accountId: string | null,
  rules: CategoryRule[],
): string | null {
  const normalizedDescription = description.toLowerCase();
  const normalizedRaw = rawText.toLowerCase();
  for (const rule of [...rules].sort((a, b) => b.priority - a.priority)) {
    if (!rule.is_active || rule.rule_type !== 'general' || !rule.actions.set_category) continue;
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
    if (conditions.description_regex) {
      try {
        if (!new RegExp(conditions.description_regex, 'iu').test(description)) continue;
      } catch {
        continue;
      }
    }
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
    return rule.actions.set_category;
  }
  return null;
}
