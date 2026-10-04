'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAccounts } from '@/lib/api/queries/account.queries';
import {
  prepareBroadForwardingQuery,
  providersForAccounts,
} from '@/lib/email-forwarding/sender-catalog';

export function EmailSenderGuide(): React.ReactElement {
  const t = useTranslations('emailForwarding');
  const { data: accounts = [] } = useAccounts();
  const [keywordsInput, setKeywordsInput] = useState('bancolombia');
  const [addressesInput, setAddressesInput] = useState('');
  const [copied, setCopied] = useState(false);
  const prepared = prepareBroadForwardingQuery(keywordsInput, addressesInput);

  async function copyQuery(): Promise<void> {
    if (!prepared.query) return;
    try {
      await navigator.clipboard.writeText(prepared.query);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      className='border-border space-y-4 rounded-lg border p-3 sm:p-4'
      aria-labelledby='sender-guide-title'>
      <div className='space-y-1'>
        <h4 id='sender-guide-title' className='text-sm font-semibold'>
          {t('senderGuideTitle')}
        </h4>
        <p className='text-muted-foreground text-sm leading-relaxed'>
          {t('senderGuideDescription')}
        </p>
      </div>

      <details className='border-border bg-muted/20 rounded-md border p-3'>
        <summary className='cursor-pointer text-sm font-medium'>
          {t('senderGuideCatalogTitle')}
        </summary>
        <div className='space-y-3 pt-3'>
          <p className='text-muted-foreground text-xs leading-relaxed'>{t('senderGuideVerify')}</p>
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
                <code className='block text-xs break-all select-all'>
                  {provider.discoveryQuery}
                </code>
                {provider.exampleSender && (
                  <p className='text-muted-foreground text-xs break-all'>
                    {t('senderGuideExample')}: {provider.exampleSender}
                  </p>
                )}
                {provider.sourceUrl && (
                  <a
                    className='text-brand inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline'
                    href={provider.sourceUrl}
                    target='_blank'
                    rel='noopener noreferrer'>
                    {t('senderGuideSource')} <ExternalLink className='size-3' aria-hidden='true' />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </details>

      <div className='space-y-2'>
        <Label htmlFor='sender-guide-keywords'>{t('senderGuideKeywords')}</Label>
        <Textarea
          id='sender-guide-keywords'
          autoComplete='off'
          rows={3}
          value={keywordsInput}
          onChange={(event) => {
            setKeywordsInput(event.target.value);
            setCopied(false);
          }}
          placeholder={'bancolombia\nlulobank'}
        />
        <p className='text-muted-foreground text-xs leading-relaxed'>
          {t('senderGuideKeywordsHint')}
        </p>
      </div>

      <details className='border-border rounded-md border p-3'>
        <summary className='cursor-pointer text-sm font-medium'>
          {t('senderGuideExactAddressesTitle')}
        </summary>
        <div className='space-y-2 pt-3'>
          <Label htmlFor='sender-guide-addresses'>{t('senderGuideAddresses')}</Label>
          <Textarea
            id='sender-guide-addresses'
            autoComplete='off'
            rows={3}
            value={addressesInput}
            onChange={(event) => {
              setAddressesInput(event.target.value);
              setCopied(false);
            }}
            placeholder={'avisos@banco.example\nnotificaciones@lulobank.com'}
          />
          <p className='text-muted-foreground text-xs'>{t('senderGuideAddressesHint')}</p>
        </div>
      </details>

      <div className='space-y-2'>
        <p className='text-muted-foreground text-xs' aria-live='polite'>
          {prepared.invalidEntries.length
            ? t('senderGuideInvalidEntries')
            : prepared.query
              ? t('senderGuidePasteInSearch')
              : t('senderGuideAddressesHint')}
        </p>
        <p className='text-muted-foreground text-xs leading-relaxed'>
          {t('senderGuideMixedContent')}
        </p>
        {prepared.query && (
          <code className='bg-muted/70 block max-h-28 overflow-y-auto rounded-md p-3 text-xs leading-relaxed break-all select-all'>
            {prepared.query}
          </code>
        )}
        <Button
          variant='outline'
          size='sm'
          onClick={() => void copyQuery()}
          disabled={!prepared.query}>
          {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
          {copied ? t('copied') : t('senderGuideCopyQuery')}
        </Button>
      </div>
    </section>
  );
}
