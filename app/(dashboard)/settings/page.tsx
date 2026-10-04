'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileTab } from '@/components/settings/profile-tab';
import { SecurityTab } from '@/components/settings/security-tab';
import { SubscriptionTab } from '@/components/settings/subscription-tab';
import { ApiKeysTab } from '@/components/settings/api-keys-tab';
import { LanguageSelector } from '@/components/settings/language-selector';
import { HelpSection } from '@/components/settings/help-section';
import { DangerZoneSection } from '@/components/settings/danger-zone-section';
import { EmailForwardingTab } from '@/components/settings/email-forwarding-tab';
import { useUserSettings } from '@/hooks/use-user-settings';
import { User, Shield, CreditCard, Key, LifeBuoy, Mail } from 'lucide-react';

const VALID_TABS = [
  'profile',
  'security',
  'subscription',
  'email-forwarding',
  'api-keys',
  'help',
] as const;
type TabValue = (typeof VALID_TABS)[number];

function isValidTab(value: string | null): value is TabValue {
  return VALID_TABS.includes(value as TabValue);
}

export default function SettingsPage(): React.ReactElement {
  const t = useTranslations('settings');
  const emailT = useTranslations('emailForwarding');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: userSettings } = useUserSettings();

  const tabParam = searchParams.get('tab');
  const tab: TabValue = isValidTab(tabParam) ? tabParam : 'profile';
  const showApiKeys = userSettings?.show_api_keys === true;

  const handleTabChange = useCallback(
    (value: string): void => {
      router.replace(`/settings?tab=${value}`, { scroll: false });
    },
    [router],
  );

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8'>
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList variant='line' className='scrollbar-none w-full overflow-x-auto'>
          <TabsTrigger value='profile' aria-label={t('profile')}>
            <User className='h-4 w-4' />
            <span className='hidden sm:inline'>{t('profile')}</span>
          </TabsTrigger>
          <TabsTrigger value='security' aria-label={t('security')}>
            <Shield className='h-4 w-4' />
            <span className='hidden sm:inline'>{t('security')}</span>
          </TabsTrigger>
          <TabsTrigger value='subscription' aria-label={t('subscription')}>
            <CreditCard className='h-4 w-4' />
            <span className='hidden sm:inline'>{t('subscription')}</span>
          </TabsTrigger>
          <TabsTrigger value='email-forwarding' aria-label={emailT('tab')}>
            <Mail className='h-4 w-4' />
            <span className='hidden sm:inline'>{emailT('tab')}</span>
          </TabsTrigger>
          {showApiKeys && (
            <TabsTrigger value='api-keys' aria-label={t('apiKeys')}>
              <Key className='h-4 w-4' />
              <span className='hidden sm:inline'>{t('apiKeys')}</span>
            </TabsTrigger>
          )}
          <TabsTrigger value='help' aria-label={t('help')}>
            <LifeBuoy className='h-4 w-4' />
            <span className='hidden sm:inline'>{t('help')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='profile' className='mt-6'>
          <div className='space-y-6'>
            <ProfileTab />
            <LanguageSelector />
            <DangerZoneSection />
          </div>
        </TabsContent>

        <TabsContent value='security' className='mt-6'>
          <SecurityTab />
        </TabsContent>

        <TabsContent value='subscription' className='mt-6'>
          <SubscriptionTab />
        </TabsContent>

        <TabsContent value='email-forwarding' className='mt-6'>
          <EmailForwardingTab />
        </TabsContent>

        {showApiKeys && (
          <TabsContent value='api-keys' className='mt-6'>
            <ApiKeysTab />
          </TabsContent>
        )}

        <TabsContent value='help' className='mt-6'>
          <HelpSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
