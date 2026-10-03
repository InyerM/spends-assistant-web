'use client';

import { useTranslations } from 'next-intl';

export function ForwardedEmailEvidence({
  source,
  rawText,
}: {
  source: string;
  rawText: string;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  const match =
    source === 'forwarded_email'
      ? /^From \(unverified\): ([^\n]{1,254})\n\n([\s\S]*)$/u.exec(rawText)
      : null;

  const content = match?.[2] ?? rawText;
  const displayContent =
    source === 'forwarded_email' && content === '[security_notice]'
      ? t('securityNoticeOmitted')
      : content;

  if (!match) {
    return (
      <p className='text-foreground text-sm leading-relaxed wrap-break-word whitespace-pre-wrap'>
        {displayContent}
      </p>
    );
  }

  return (
    <div className='space-y-3'>
      <div className='bg-muted/50 flex flex-wrap items-baseline gap-x-2 rounded-md px-3 py-2 text-xs'>
        <span className='text-muted-foreground'>{t('senderUnverified')}</span>
        <span className='font-medium break-all'>{match[1]}</span>
      </div>
      <p className='text-foreground text-sm leading-relaxed wrap-break-word whitespace-pre-wrap'>
        {displayContent}
      </p>
    </div>
  );
}
