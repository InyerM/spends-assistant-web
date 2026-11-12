import {
  assertAutomationRuleSet,
  AutomationMatchingReviewRequiredError,
  inspectAutomationRegex,
  MAX_AUTOMATION_RULES,
  type AutomationRegexCompatibility,
} from './regex';

export function ruleMatchingCompatibility(conditions: unknown): AutomationRegexCompatibility {
  if (conditions === undefined || conditions === null) return inspectAutomationRegex(undefined);
  if (typeof conditions !== 'object' || Array.isArray(conditions)) return inspectAutomationRegex(0);
  return inspectAutomationRegex((conditions as Record<string, unknown>).description_regex);
}

export function automationRuleInputError(input: unknown): {
  error: string;
  code: string;
  reason: string;
} | null {
  const rules = Array.isArray(input) ? input : [input];
  if (rules.length > MAX_AUTOMATION_RULES)
    return {
      error: 'Automation matching requires review',
      code: 'AUTOMATION_MATCHING_REVIEW_REQUIRED',
      reason: 'rule_limit',
    };
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule))
      return {
        error: 'Invalid automation rule',
        code: 'AUTOMATION_REGEX_REVIEW_REQUIRED',
        reason: 'invalid_type',
      };
    const state = ruleMatchingCompatibility((rule as Record<string, unknown>).conditions);
    if (state.requires_review)
      return {
        error: 'Automation expression requires review',
        code: 'AUTOMATION_REGEX_REVIEW_REQUIRED',
        reason: state.reason ?? 'unsupported_syntax',
      };
  }
  try {
    assertAutomationRuleSet(rules);
  } catch (error) {
    if (error instanceof AutomationMatchingReviewRequiredError)
      return { error: error.message, code: error.code, reason: error.reason };
    throw error;
  }
  return null;
}
