'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { decodeEmailEntities } from '@/lib/shortcut-inbox/email-text';
import { detectEmailBank } from '@/lib/email-forwarding/detected-bank';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Link from 'next/link';

export function ForwardedEmailEvidence({
  source,
  rawText,
}: {
  source: string;
  rawText: string;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const [expanded, setExpanded] = useState(false);
  const match =
    source === 'forwarded_email'
      ? /^From \(unverified\): ([^\n]{1,254})\n\n([\s\S]*)$/u.exec(rawText)
      : null;
  if (!match) {
    return (
      <p className='text-foreground text-sm leading-relaxed wrap-break-word whitespace-pre-wrap'>
        {rawText}
      </p>
    );
  }

  const content = decodeEmailEntities(match[2]).replace(/\r\n?/gu, '\n').trim();
  const paragraphs = content
    .split(/\n{2,}/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const subject = paragraphs[0] ?? '';
  const body = paragraphs
    .slice(1)
    .join('\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => index !== 0 || line !== subject);
  const securityNotice = content === '[security_notice]';
  const visible = expanded ? body : body.slice(0, 4);
  const bank = detectEmailBank(rawText);

  return (
    <div className='space-y-4'>
      <div className='bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs'>
        {bank && <Badge variant='secondary'>{t('bankDetected', { bank })}</Badge>}
        <span className='min-w-0 font-medium break-all'>{match[1]}</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground h-auto px-2 py-1 text-xs'>
              {t('senderUnverified')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className='max-w-[calc(100vw-2rem)] space-y-3 text-sm' align='start'>
            <p className='font-medium'>{t('reviewSender')}</p>
            <p className='text-muted-foreground'>{t('bankDetectionHint')}</p>
            <Button asChild variant='outline' size='sm'>
              <Link href='/settings?tab=email-forwarding'>{t('reviewSenderSettings')}</Link>
            </Button>
          </PopoverContent>
        </Popover>
      </div>
      {securityNotice ? (
        <p className='text-foreground text-sm leading-relaxed'>{t('securityNoticeOmitted')}</p>
      ) : (
        <div className='space-y-3'>
          {subject && (
            <div>
              <p className='text-muted-foreground text-xs'>{t('subject')}</p>
              <p className='text-foreground font-medium'>{subject}</p>
            </div>
          )}
          <div className='border-border/70 space-y-2 border-l-2 pl-4'>
            {visible.map((paragraph, index) => (
              <p
                key={`${index}-${paragraph.slice(0, 16)}`}
                className='text-foreground text-sm leading-relaxed wrap-break-word whitespace-pre-wrap'>
                {paragraph}
              </p>
            ))}
          </div>
          {body.length > 4 && (
            <Button variant='ghost' size='sm' onClick={(): void => setExpanded((value) => !value)}>
              {t(expanded ? 'hideFullMessage' : 'showFullMessage')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
