'use client';

import { useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { useAllCategories } from '@/lib/api/queries/category.queries';
import { useCreateCategory, useUpdateCategory } from '@/lib/api/mutations/category.mutations';
import { slugify } from '@/lib/utils/slugify';
import { Info } from 'lucide-react';
import type { Category, CategoryType } from '@/types';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  type: z.enum(['expense', 'income', 'transfer']),
  parent_id: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  spending_nature: z.enum(['none', 'want', 'need', 'must']).optional(),
});

type FormValues = z.infer<typeof formSchema>;

function getCategoryDisplayName(category: Category, locale: string): string {
  if (category.translations && category.translations[locale]) {
    return category.translations[locale];
  }
  return category.name;
}

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCategory?: Category | null;
  /** Pre-filled parent ID when creating a subcategory */
  defaultParentId?: string;
  /** Pre-filled type when creating a subcategory */
  defaultType?: CategoryType;
  onSuccess?: () => void;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  editingCategory,
  defaultParentId,
  defaultType,
  onSuccess,
}: CategoryFormDialogProps): React.ReactElement {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { data: allCategories } = useAllCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      type: 'expense',
      parent_id: undefined,
      icon: '',
      color: '',
      spending_nature: 'none',
    },
  });

  const watchName = useWatch({ control: form.control, name: 'name' });

  const generateUniqueSlug = useCallback(
    (name: string): string => {
      const base = slugify(name);
      if (!base) return '';
      const existingSlugs = new Set(
        (allCategories ?? [])
          .filter((c) => !editingCategory || c.id !== editingCategory.id)
          .map((c) => c.slug),
      );
      if (!existingSlugs.has(base)) return base;
      let i = 2;
      while (existingSlugs.has(`${base}-${i}`)) i++;
      return `${base}-${i}`;
    },
    [allCategories, editingCategory],
  );

  useEffect(() => {
    if (!editingCategory && watchName) {
      form.setValue('slug', generateUniqueSlug(watchName));
    }
  }, [watchName, editingCategory, form, generateUniqueSlug]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editingCategory) {
        form.reset({
          name: editingCategory.name,
          slug: editingCategory.slug,
          type: editingCategory.type,
          parent_id: editingCategory.parent_id ?? undefined,
          icon: editingCategory.icon ?? '',
          color: editingCategory.color ?? '',
          spending_nature: editingCategory.spending_nature ?? 'none',
        });
      } else {
        form.reset({
          name: '',
          slug: '',
          type: defaultType ?? 'expense',
          parent_id: defaultParentId ?? undefined,
          icon: '',
          color: '',
          spending_nature: 'none',
        });
      }
    }
  }, [open, editingCategory, defaultParentId, defaultType, form]);

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      const payload = {
        ...values,
        parent_id: values.parent_id === 'none' ? undefined : values.parent_id,
      };
      if (editingCategory) {
        await updateMutation.mutateAsync({ id: editingCategory.id, ...payload });
        toast.success(t('categoryUpdated'));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t('categoryCreated'));
      }
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error(editingCategory ? t('failedToUpdate') : t('failedToCreate'));
    }
  }

  const parentCategories = allCategories?.filter((c) => !c.parent_id) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card max-h-[85dvh] overflow-y-auto sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{editingCategory ? t('editCategory') : t('newCategory')}</DialogTitle>
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
                      <SelectItem value='expense'>{t('expense')}</SelectItem>
                      <SelectItem value='income'>{t('income')}</SelectItem>
                      <SelectItem value='transfer'>{t('transfer')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='parent_id'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel>{t('parent')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? 'none'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('noneTopLevel')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='none'>{t('noneTopLevel')}</SelectItem>
                      {parentCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon ?? ''} {getCategoryDisplayName(cat, locale)}
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
              name='spending_nature'
              render={({ field }): React.ReactElement => (
                <FormItem>
                  <FormLabel className='inline-flex items-center gap-1.5'>
                    {t('spendingNature')}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type='button'
                          className='text-muted-foreground hover:text-foreground inline-flex cursor-help'
                          tabIndex={-1}>
                          <Info className='h-3.5 w-3.5' />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side='top' className='max-w-64'>
                        {t('spendingNatureHelp')}
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? 'none'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='none'>
                        {tCommon('none')} - {t('spendingNatureNoneTooltip')}
                      </SelectItem>
                      <SelectItem value='want'>
                        {t('want')} - {t('spendingNatureWantTooltip')}
                      </SelectItem>
                      <SelectItem value='need'>
                        {t('need')} - {t('spendingNatureNeedTooltip')}
                      </SelectItem>
                      <SelectItem value='must'>
                        {t('must')} - {t('spendingNatureMustTooltip')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                      <Input placeholder='🍔' {...field} />
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
              <Button type='submit' disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? tCommon('saving')
                  : editingCategory
                    ? tCommon('update')
                    : tCommon('create')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
