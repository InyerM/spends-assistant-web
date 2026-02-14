'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileTab } from '@/components/settings/profile-tab';
import { SecurityTab } from '@/components/settings/security-tab';
import { SubscriptionTab } from '@/components/settings/subscription-tab';
import { ApiKeysTab } from '@/components/settings/api-keys-tab';
import { User, Shield, CreditCard, Key } from 'lucide-react';

export default function SettingsPage(): React.ReactElement {
  return (
    <div className='mx-auto max-w-2xl space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <h1 className='text-xl font-bold sm:text-2xl'>Settings</h1>

      <Tabs defaultValue='profile'>
        <TabsList variant='line' className='scrollbar-none w-full overflow-x-auto'>
          <TabsTrigger value='profile'>
            <User className='h-4 w-4' />
            <span className='hidden sm:inline'>Profile</span>
          </TabsTrigger>
          <TabsTrigger value='security'>
            <Shield className='h-4 w-4' />
            <span className='hidden sm:inline'>Security</span>
          </TabsTrigger>
          <TabsTrigger value='subscription'>
            <CreditCard className='h-4 w-4' />
            <span className='hidden sm:inline'>Subscription</span>
          </TabsTrigger>
          <TabsTrigger value='api-keys'>
            <Key className='h-4 w-4' />
            <span className='hidden sm:inline'>API Keys</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='profile' className='mt-6'>
          <ProfileTab />
        </TabsContent>

        <TabsContent value='security' className='mt-6'>
          <SecurityTab />
        </TabsContent>

        <TabsContent value='subscription' className='mt-6'>
          <SubscriptionTab />
        </TabsContent>

        <TabsContent value='api-keys' className='mt-6'>
          <ApiKeysTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
