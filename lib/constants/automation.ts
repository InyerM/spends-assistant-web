import type { RuleType } from '@/types';

export const RULE_TYPE_KEYS: Record<RuleType, string> = {
  general: 'general',
  account_detection: 'accountDetection',
  transfer: 'transferRule',
};
