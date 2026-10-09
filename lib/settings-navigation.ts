export type SettingsSection = 'account' | 'preferences' | 'connections' | 'plan' | 'help';

const legacyTabs: Record<string, SettingsSection> = {
  account: 'account',
  profile: 'account',
  security: 'account',
  preferences: 'preferences',
  'ai-processing': 'preferences',
  connections: 'connections',
  'email-forwarding': 'connections',
  'api-keys': 'connections',
  plan: 'plan',
  subscription: 'plan',
  help: 'help',
};

export function resolveSettingsSection(tab: string | null): SettingsSection {
  return tab ? (legacyTabs[tab] ?? 'account') : 'account';
}
