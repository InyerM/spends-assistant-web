'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function InboxAction({
  help,
  children,
}: {
  help: string;
  children: React.ReactElement;
}): React.ReactElement {
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className='max-w-64' sideOffset={6}>
          {help}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
