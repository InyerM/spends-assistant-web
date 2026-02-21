'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { locales, type Locale } from '@/i18n/config';
import { getLocaleCookie, setLocaleCookie } from '@/lib/i18n/locale-cookie';
import { useUpdateLanguage } from '@/lib/api/mutations/settings.mutations';

interface LanguageOption {
  value: Locale;
  label: string;
  nativeLabel: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'es', label: 'Spanish', nativeLabel: 'Espanol' },
  { value: 'pt', label: 'Portuguese', nativeLabel: 'Portugues' },
];

export function LanguageSelector(): React.ReactElement {
  const t = useTranslations('settings');
  const [currentLocale] = useState<Locale>(getLocaleCookie);
  const updateLanguage = useUpdateLanguage();

  const isPending = updateLanguage.isPending;

  const handleLanguageChange = (value: string): void => {
    if (!locales.includes(value as Locale)) return;
    const newLocale = value as Locale;

    updateLanguage.mutate(newLocale, {
      onSuccess: () => {
        setLocaleCookie(newLocale);
        toast.success(t('languageUpdated'));
        // Full reload so next-intl picks up the new locale from the cookie on the server
        window.location.reload();
      },
      onError: () => {
        toast.error(t('languageUpdateFailed'));
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Globe className='h-5 w-5' />
          {t('languageLabel')}
        </CardTitle>
        <CardDescription>{t('languageDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          <Label htmlFor='language-select'>{t('languageLabel')}</Label>
          <Select value={currentLocale} onValueChange={handleLanguageChange} disabled={isPending}>
            <SelectTrigger id='language-select' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.nativeLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
