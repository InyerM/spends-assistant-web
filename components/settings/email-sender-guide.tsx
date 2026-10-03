'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { exactSenderFilter, providersForAccounts } from '@/lib/email-forwarding/sender-catalog';

export function EmailSenderGuide(): React.ReactElement {
  const t = useTranslations('emailForwarding');
  const { data: accounts = [] } = useAccounts();
  const [address, setAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const filter = exactSenderFilter(address);

  async function copyFilter(): Promise<void> {
    if (!filter) return;
    try {
      await navigator.clipboard.writeText(filter);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <details className='border-border rounded-lg border p-3 sm:p-4'>
      <summary className='cursor-pointer text-sm font-medium'>{t('senderGuideTitle')}</summary>
      <div className='space-y-4 pt-4'>
        <p className='text-muted-foreground text-sm leading-relaxed'>
          {t('senderGuideDescription')}
        </p>
        <ul className='grid gap-2 sm:grid-cols-2'>
          {providersForAccounts(Array.isArray(accounts) ? accounts : []).map((provider) => (
            <li key={provider.id} className='bg-muted/50 min-w-0 space-y-2 rounded-md p-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-sm font-medium'>{provider.name}</span>
                {provider.hasAccount && (
                  <Badge variant='secondary'>{t('senderGuideAccountMatch')}</Badge>
                )}
              </div>
              <p className='text-muted-foreground text-xs'>{t('senderGuideSearch')}</p>
              <code className='block text-xs break-all select-all'>{provider.discoveryQuery}</code>
              {provider.exampleSender && (
                <p className='text-muted-foreground text-xs break-all'>
                  {t('senderGuideExample')}: {provider.exampleSender}
                </p>
              )}
              {provider.sourceUrl && (
                <a
                  className='text-primary inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline'
                  href={provider.sourceUrl}
                  target='_blank'
                  rel='noopener noreferrer'>
                  {t('senderGuideSource')} <ExternalLink className='size-3' aria-hidden='true' />
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className='text-muted-foreground text-xs leading-relaxed'>{t('senderGuideVerify')}</p>
        <div className='space-y-2'>
          <Label htmlFor='sender-guide-exact-address'>{t('senderGuideExactAddress')}</Label>
          <Input
            id='sender-guide-exact-address'
            type='email'
            autoComplete='off'
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setCopied(false);
            }}
            placeholder='avisos@banco.example'
          />
          {filter ? (
            <code className='block text-xs break-all select-all'>{filter}</code>
          ) : (
            <p className='text-muted-foreground text-xs'>{t('senderGuideInvalidAddress')}</p>
          )}
          <Button variant='outline' size='sm' onClick={() => void copyFilter()} disabled={!filter}>
            {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
            {copied ? t('copied') : t('senderGuideCopyFilter')}
          </Button>
        </div>
      </div>
    </details>
  );
}
