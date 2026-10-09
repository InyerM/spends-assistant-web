'use client';

import { useCallback, useEffect } from 'react';
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
import { AiConsentTab } from '@/components/settings/ai-consent-tab';
import { useUserSettings } from '@/hooks/use-user-settings';
import { User, SlidersHorizontal, Plug, Gauge, LifeBuoy } from 'lucide-react';
import { resolveSettingsSection } from '@/lib/settings-navigation';

export default function SettingsPage(): React.ReactElement {
  const t = useTranslations('settings');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: userSettings } = useUserSettings();

  const tabParam = searchParams.get('tab');
  const section = resolveSettingsSection(tabParam);
  const showApiKeys = userSettings?.show_api_keys === true;

  useEffect(() => {
    const targetId = {
      security: 'settings-security',
      'ai-processing': 'settings-ai-processing',
      'api-keys': 'settings-api-keys',
    }[tabParam ?? ''];
    const target = targetId ? document.getElementById(targetId) : null;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'start' });
    }
  }, [tabParam, showApiKeys]);

  const handleTabChange = useCallback(
    (value: string): void => {
      router.replace(`/settings?tab=${value}`, { scroll: false });
    },
    [router],
  );

  return (
    <div className='mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8'>
      <h1 className='font-display text-3xl font-semibold tracking-tight'>{t('title')}</h1>
      <Tabs value={section} onValueChange={handleTabChange}>
        <TabsList className='bg-card grid h-auto w-full grid-cols-2 gap-2 rounded-xl p-2 group-data-[orientation=horizontal]/tabs:h-auto sm:grid-cols-3 lg:grid-cols-5'>
          <TabsTrigger value='account' className='h-11 min-w-0 gap-2 rounded-lg px-2 text-sm'>
            <User className='size-4' />
            <span>{t('accountGroup')}</span>
          </TabsTrigger>
          <TabsTrigger value='preferences' className='h-11 min-w-0 gap-2 rounded-lg px-2 text-sm'>
            <SlidersHorizontal className='size-4' />
            <span>{t('preferences')}</span>
          </TabsTrigger>
          <TabsTrigger value='connections' className='h-11 min-w-0 gap-2 rounded-lg px-2 text-sm'>
            <Plug className='size-4' />
            <span>{t('connections')}</span>
          </TabsTrigger>
          <TabsTrigger value='plan' className='h-11 min-w-0 gap-2 rounded-lg px-2 text-sm'>
            <Gauge className='size-4' />
            <span>{t('subscription')}</span>
          </TabsTrigger>
          <TabsTrigger value='help' className='h-11 min-w-0 gap-2 rounded-lg px-2 text-sm'>
            <LifeBuoy className='size-4' />
            <span>{t('help')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='account' className='mt-6'>
          <div className='space-y-6'>
            <ProfileTab />
            <section id='settings-security' className='scroll-mt-8'>
              <SecurityTab />
            </section>
            <DangerZoneSection />
          </div>
        </TabsContent>

        <TabsContent value='preferences' className='mt-6 space-y-6'>
          <LanguageSelector />
          <section id='settings-ai-processing' className='scroll-mt-8'>
            <AiConsentTab />
          </section>
        </TabsContent>

        <TabsContent value='plan' className='mt-6'>
          <SubscriptionTab />
        </TabsContent>

        <TabsContent value='connections' className='mt-6 space-y-6'>
          <EmailForwardingTab />
          {showApiKeys && (
            <section id='settings-api-keys' className='scroll-mt-8'>
              <ApiKeysTab />
            </section>
          )}
        </TabsContent>

        <TabsContent value='help' className='mt-6'>
          <HelpSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
