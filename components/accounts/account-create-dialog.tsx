'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
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
import type { AccountType } from '@/types';

const accountTypes: { value: AccountType; labelKey: string }[] = [
  { value: 'checking', labelKey: 'checking' },
  { value: 'savings', labelKey: 'savings' },
  { value: 'credit_card', labelKey: 'creditCard' },
  { value: 'cash', labelKey: 'cash' },
  { value: 'investment', labelKey: 'investment' },
  { value: 'crypto', labelKey: 'crypto' },
  { value: 'credit', labelKey: 'credit' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['checking', 'savings', 'credit_card', 'cash', 'investment', 'crypto', 'credit']),
  institution: z.string().optional(),
  last_four: z
    .string()
    .regex(/^\d{4}$/, 'Must be exactly 4 digits')
    .or(z.literal(''))
    .optional(),
  currency: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AccountCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountCreateDialog({
  open,
  onOpenChange,
}: AccountCreateDialogProps): React.ReactElement {
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
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

  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        type: 'checking',
        institution: '',
        last_four: '',
        currency: 'COP',
        color: '',
        icon: '',
      });
    }
  }, [open, form]);

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      const payload = {
        ...values,
        last_four: values.last_four?.trim() || null,
      };
      await createMutation.mutateAsync(payload);
      toast.success(t('accountCreated'));
      onOpenChange(false);
    } catch {
      toast.error(t('failedToCreate'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{t('newAccount')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('namePlaceholder')} {...field} />
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
                      {accountTypes.map((at) => (
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
              name='last_four'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('lastFour')}</FormLabel>
                  <FormControl>
                    <Input placeholder='1234' maxLength={4} inputMode='numeric' {...field} />
                  </FormControl>
                  <FormDescription>{t('lastFourDescription')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
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
