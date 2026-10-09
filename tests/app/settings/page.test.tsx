import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/app/(dashboard)/settings/page';

const navigation = vi.hoisted(() => ({ tab: 'security', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams({ tab: navigation.tab }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/hooks/use-user-settings', () => ({
  useUserSettings: () => ({ data: { show_api_keys: true } }),
}));
vi.mock('@/components/settings/profile-tab', () => ({ ProfileTab: () => <p>Profile details</p> }));
vi.mock('@/components/settings/security-tab', () => ({
  SecurityTab: () => <p>Security details</p>,
}));
vi.mock('@/components/settings/subscription-tab', () => ({
  SubscriptionTab: () => <p>Plan details</p>,
}));
vi.mock('@/components/settings/api-keys-tab', () => ({ ApiKeysTab: () => <p>API details</p> }));
vi.mock('@/components/settings/language-selector', () => ({
  LanguageSelector: () => <p>Language details</p>,
}));
vi.mock('@/components/settings/help-section', () => ({ HelpSection: () => <p>Help details</p> }));
vi.mock('@/components/settings/danger-zone-section', () => ({
  DangerZoneSection: () => <p>Delete account details</p>,
}));
vi.mock('@/components/settings/email-forwarding-tab', () => ({
  EmailForwardingTab: () => <p>Email details</p>,
}));
vi.mock('@/components/settings/ai-consent-tab', () => ({
  AiConsentTab: () => <p>AI details</p>,
}));

describe('grouped settings', () => {
  afterEach(cleanup);
  beforeEach(() => {
    navigation.tab = 'security';
    navigation.replace.mockClear();
  });

  it('keeps the old security link in the account group', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('tab', { name: 'accountGroup' })).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(screen.getByText('Profile details')).toBeVisible();
    expect(screen.getByText('Security details')).toBeVisible();
    expect(screen.getByText('Delete account details')).toBeVisible();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('shows forwarding and API keys together for an old email link', () => {
    navigation.tab = 'email-forwarding';
    render(<SettingsPage />);
    expect(screen.getByRole('tab', { name: 'connections' })).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(screen.getByText('Email details')).toBeVisible();
    expect(screen.getByText('API details')).toBeVisible();
  });
});
