'use client';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { DashboardControls } from './dashboard-controls';
import { CustomChartBuilder } from './custom-chart-builder';
export function DashboardEditor(): React.ReactElement {
  const t = useTranslations('dashboardWidgets');
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size='sm' variant='outline'>
          <SlidersHorizontal className='size-4' aria-hidden='true' />
          {t('editView')}
        </Button>
      </SheetTrigger>
      <SheetContent className='w-full sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>{t('editView')}</SheetTitle>
          <SheetDescription>{t('editorHint')}</SheetDescription>
        </SheetHeader>
        <div className='min-h-0 overflow-y-auto px-5 pb-8'>
          <DashboardControls />
          <div className='border-border mt-6 border-t pt-6'>
            <CustomChartBuilder />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
