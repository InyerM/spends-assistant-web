'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NotificationPreferences } from '@/components/settings/notification-preferences';
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
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsHub } from '@/components/settings/settings-hub';
import { DocumentSetup } from '@/components/settings/document-setup';
import { resolveSettingsSection } from '@/lib/settings-navigation';

export default function SettingsPage(): React.ReactElement {
  const t = useTranslations('settings');
  const searchParams = useSearchParams();
  const { data: userSettings } = useUserSettings();

  const tabParam = searchParams.get('tab');
  const section = resolveSettingsSection(tabParam);
  const showApiKeys = userSettings?.show_api_keys === true || tabParam === 'api-keys';

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

  return (
    <div className='mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8'>
      <h1 className='font-display text-3xl font-semibold tracking-tight'>{t('title')}</h1>
      {!tabParam ? (
        <SettingsHub />
      ) : tabParam === 'documents' ? (
        <>
          <Button asChild variant='ghost'>
            <Link href='/settings'>
              <ArrowLeft className='size-4' />
              {t('title')}
            </Link>
          </Button>
          <DocumentSetup />
        </>
      ) : (
        <>
          <Button asChild variant='ghost'>
            <Link href='/settings'>
              <ArrowLeft className='size-4' />
              {t('title')}
            </Link>
          </Button>
          <div>
            {section === 'account' && (
              <section className='mt-6'>
                <div className='space-y-6'>
                  <ProfileTab />
                  <section id='settings-security' className='scroll-mt-8'>
                    <SecurityTab />
                  </section>
                  <DangerZoneSection />
                </div>
              </section>
            )}

            {section === 'preferences' && (
              <section className='mt-6 space-y-6'>
                <LanguageSelector />
                <NotificationPreferences />
                <section id='settings-ai-processing' className='scroll-mt-8'>
                  <AiConsentTab />
                </section>
              </section>
            )}

            {section === 'plan' && (
              <section className='mt-6'>
                <SubscriptionTab />
              </section>
            )}

            {section === 'connections' && (
              <section className='mt-6 space-y-6'>
                <EmailForwardingTab />
                {showApiKeys && (
                  <section id='settings-api-keys' className='scroll-mt-8'>
                    <ApiKeysTab />
                  </section>
                )}
              </section>
            )}

            {section === 'help' && (
              <section className='mt-6'>
                <HelpSection />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
