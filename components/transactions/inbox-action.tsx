'use client';

import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function InboxAction({
  help,
  children,
}: {
  help: string;
  children: React.ReactElement;
}): React.ReactElement {
  const t = useTranslations('shortcutInbox');
  return (
    <div className='flex items-center gap-2'>
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent className='max-w-64' sideOffset={6}>
            {help}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='ghost' size='icon-sm' aria-label={t('actionInfo', { action: help })}>
            <Info className='text-muted-foreground size-4' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='max-w-[calc(100vw-2rem)] text-sm' align='start'>
          {help}
        </PopoverContent>
      </Popover>
    </div>
  );
}
