'use client';

import { completeOnboardingStep } from '@/lib/onboarding-flow';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateAccount } from '@/lib/api/mutations/account.mutations';
import { ACCOUNT_TYPES } from '@/lib/utils/account-translations';
import { AccountIdentifierEditor } from './account-identifier-editor';
import { primarySuffix } from '@/lib/accounts/identifiers';
import type { Account, AccountIdentifier } from '@/types/account';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['checking', 'savings', 'credit_card', 'cash', 'investment', 'crypto', 'credit']),
  institution: z.string().optional(),
  last_four: z
    .string()
    .regex(/^\d{4}$/, 'Must be exactly 4 digits')
    .or(z.literal(''))
    .optional(),
  currency: z.enum(['COP', 'USD']),
  color: z.string().optional(),
  icon: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AccountCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIdentifier?: AccountIdentifier;
  initialCurrency?: string;
  onCreated?: (account: Account) => void;
}

export function AccountCreateDialog({
  open,
  onOpenChange,
  initialIdentifier,
  initialCurrency = 'COP',
  onCreated,
}: AccountCreateDialogProps): React.ReactElement {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const [identifiers, setIdentifiers] = useState<AccountIdentifier[]>([]);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setIdentifiers(initialIdentifier ? [initialIdentifier] : []);
  }
  const createMutation = useCreateAccount();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      type: 'checking',
      institution: '',
      last_four: '',
      currency: 'COP',
      color: '',
      icon: '',
    },
  });
  const accountType = useWatch({ control: form.control, name: 'type' });

  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        type: initialIdentifier?.kind === 'credit_card' ? 'credit_card' : 'checking',
        institution: '',
        last_four: initialIdentifier?.last_four ?? '',
        currency: initialCurrency === 'USD' ? 'USD' : 'COP',
        color: '',
        icon: '',
      });
    }
  }, [open, form, initialIdentifier?.kind, initialIdentifier?.last_four, initialCurrency]);

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      const payload = {
        ...values,
        last_four: primarySuffix({ type: values.type, last_four: null, identifiers }),
        identifiers,
      };
      const created = await createMutation.mutateAsync(payload);
      onCreated?.(created);
      toast.success(t('accountCreated'));
      completeOnboardingStep('account');
      onOpenChange(false);
    } catch {
      toast.error(t('failedToCreate'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card max-h-[90dvh] overflow-y-auto sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{t('newAccount')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            data-guide='account-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input
                      data-guide='account-name'
                      placeholder={t('namePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='type'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('type')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('type')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((at) => (
                        <SelectItem key={at.value} value={at.value}>
                          {t(at.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='institution'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('institution')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('institutionPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='currency'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('currency')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='COP'>COP · {t('pesos')}</SelectItem>
                      <SelectItem value='USD'>USD · {t('dollars')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AccountIdentifierEditor
              value={identifiers}
              onChange={setIdentifiers}
              accountType={accountType}
            />
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='icon'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>{t('icon')}</FormLabel>
                    <FormControl>
                      <Input placeholder='💳' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='color'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>{t('color')}</FormLabel>
                    <FormControl>
                      <ColorPicker value={field.value ?? ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className='flex justify-end gap-3 pt-4'>
              <Button type='button' variant='outline' onClick={(): void => onOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type='submit' disabled={createMutation.isPending}>
                {createMutation.isPending ? tCommon('saving') : tCommon('create')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
