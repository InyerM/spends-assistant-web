import { describe, expect, it } from 'vitest';
import { resolveSettingsSection } from '@/lib/settings-navigation';

describe('settings navigation', () => {
  it.each([
    ['profile', 'account'],
    ['security', 'account'],
    ['ai-processing', 'preferences'],
    ['email-forwarding', 'connections'],
    ['api-keys', 'connections'],
    ['subscription', 'plan'],
    ['help', 'help'],
  ])('keeps the existing %s deep link in the %s group', (tab, group) => {
    expect(resolveSettingsSection(tab)).toBe(group);
  });

  it('uses the account group for unknown or missing tabs', () => {
    expect(resolveSettingsSection(null)).toBe('account');
    expect(resolveSettingsSection('unknown')).toBe('account');
  });
});
