'use client';

import { useState, useEffect, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryTree, useCategories } from '@/lib/api/queries/category.queries';
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  fetchCategoryWithCounts,
} from '@/lib/api/mutations/category.mutations';
import { slugify } from '@/lib/utils/slugify';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { Category, CategoryType } from '@/types';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  type: z.enum(['expense', 'income', 'transfer']),
  parent_id: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const typeBadgeVariant: Record<CategoryType, 'destructive' | 'default' | 'secondary'> = {
  expense: 'destructive',
  income: 'default',
  transfer: 'secondary',
};

export default function CategoriesPage(): React.ReactElement {
  const { data: categoryTree, isLoading } = useCategoryTree();
  const { data: allCategories } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<{
    transaction_count: number;
    children_count: number;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      type: 'expense',
      parent_id: undefined,
      icon: '',
      color: '',
    },
  });

  const watchName = form.watch('name');

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

  const toggleExpanded = (id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = (parentId?: string, type?: CategoryType): void => {
    setEditingCategory(null);
    form.reset({
      name: '',
      slug: '',
      type: type ?? 'expense',
      parent_id: parentId ?? undefined,
      icon: '',
      color: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = (category: Category): void => {
    setEditingCategory(category);
    form.reset({
      name: category.name,
      slug: category.slug,
      type: category.type,
      parent_id: category.parent_id ?? undefined,
      icon: category.icon ?? '',
      color: category.color ?? '',
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = async (category: Category): Promise<void> => {
    setDeleteTarget(category);
    setDeleteInfo(null);
    setDeleteDialogOpen(true);
    try {
      const counts = await fetchCategoryWithCounts(category.id);
      setDeleteInfo({
        transaction_count: counts.transaction_count,
        children_count: counts.children_count,
      });
    } catch {
      setDeleteInfo({ transaction_count: 0, children_count: 0 });
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Category deleted');
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete category');
    }
  };

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      if (editingCategory) {
        await updateMutation.mutateAsync({ id: editingCategory.id, ...values });
        toast.success('Category updated');
      } else {
        await createMutation.mutateAsync(values);
        toast.success('Category created');
      }
      setDialogOpen(false);
    } catch {
      toast.error(editingCategory ? 'Failed to update category' : 'Failed to create category');
    }
  }

  const parentCategories = allCategories?.filter((c) => !c.parent_id) ?? [];

  return (
    <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
      <div className='flex items-center justify-between'>
        <div className='min-w-0'>
          <h2 className='text-foreground text-xl font-bold sm:text-2xl'>Categories</h2>
          <p className='text-muted-foreground hidden text-sm sm:block'>
            Organize your transactions by category
          </p>
        </div>
        <Button className='cursor-pointer' onClick={(): void => handleCreate()}>
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>New Category</span>
        </Button>
      </div>

      {isLoading ? (
        <div className='space-y-4'>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </div>
      ) : (
        <div className='space-y-2'>
          {categoryTree?.map((parent) => {
            const isExpanded = expandedIds.has(parent.id);
            const hasChildren = parent.children.length > 0;

            return (
              <Card
                key={parent.id}
                className='border-border bg-card cursor-pointer sm:cursor-default'
                onClick={(): void => {
                  if (window.innerWidth < 640) handleEdit(parent);
                }}>
                <CardHeader className='flex flex-row items-center gap-2 space-y-0 py-3 sm:gap-3'>
                  {hasChildren ? (
                    <button
                      onClick={(): void => toggleExpanded(parent.id)}
                      className='text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center'>
                      {isExpanded ? (
                        <ChevronDown className='h-4 w-4' />
                      ) : (
                        <ChevronRight className='h-4 w-4' />
                      )}
                    </button>
                  ) : (
                    <div className='w-4 shrink-0' />
                  )}

                  <span className='shrink-0 text-lg'>{parent.icon ?? '📁'}</span>
                  <CardTitle className='min-w-0 flex-1 truncate text-base font-medium'>
                    {parent.name}
                  </CardTitle>
                  <Badge
                    variant={typeBadgeVariant[parent.type]}
                    className='hidden shrink-0 sm:inline-flex'>
                    {parent.type}
                  </Badge>
                  {parent.color && (
                    <div
                      className='hidden h-4 w-4 shrink-0 rounded-full sm:block'
                      style={{ backgroundColor: parent.color }}
                    />
                  )}
                  <div className='flex shrink-0 items-center'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(): void => handleCreate(parent.id, parent.type)}
                      className='h-9 w-9 cursor-pointer p-0'
                      title='Add subcategory'>
                      <Plus className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(): void => handleEdit(parent)}
                      className='hidden h-9 w-9 cursor-pointer p-0 sm:flex'>
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={(): void => void handleDeleteClick(parent)}
                      className='text-destructive hidden h-9 w-9 cursor-pointer p-0 sm:flex'>
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && hasChildren && (
                  <CardContent className='pt-0 pb-3'>
                    <div className='ml-4 space-y-1 sm:ml-8'>
                      {parent.children.map((child) => (
                        <div
                          key={child.id}
                          className='hover:bg-card-overlay flex items-center gap-2 rounded-lg px-3 py-2 sm:gap-3'>
                          <span>{child.icon ?? '📄'}</span>
                          <span className='min-w-0 flex-1 truncate text-sm'>{child.name}</span>
                          <span className='text-muted-foreground hidden text-xs sm:inline'>
                            {child.slug}
                          </span>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={(): void => handleEdit(child)}
                            className='h-9 w-9 cursor-pointer p-0 sm:h-7 sm:w-7'>
                            <Pencil className='h-4 w-4 sm:h-3 sm:w-3' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={(): void => void handleDeleteClick(child)}
                            className='text-destructive h-9 w-9 cursor-pointer p-0 sm:h-7 sm:w-7'>
                            <Trash2 className='h-4 w-4 sm:h-3 sm:w-3' />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='border-border bg-card sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder='Category name' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='slug'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='category-slug'
                        {...field}
                        readOnly
                        className='text-muted-foreground bg-muted'
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
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select type' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='expense'>Expense</SelectItem>
                        <SelectItem value='income'>Income</SelectItem>
                        <SelectItem value='transfer'>Transfer</SelectItem>
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
                    <FormLabel>Parent Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? 'none'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='None (top level)' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='none'>None (top level)</SelectItem>
                        {parentCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.icon ?? ''} {cat.name}
                          </SelectItem>
                        ))}
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
                      <FormLabel>Icon</FormLabel>
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
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Input type='color' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='flex justify-end gap-3 pt-4'>
                <Button type='button' variant='outline' onClick={(): void => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type='submit'
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingCategory
                      ? 'Update'
                      : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title='Delete Category'
        description={
          <div className='text-muted-foreground space-y-1 text-sm'>
            {deleteInfo ? (
              <>
                {deleteInfo.transaction_count > 0 && (
                  <p>
                    {deleteInfo.transaction_count} linked transaction
                    {deleteInfo.transaction_count !== 1 ? 's' : ''} will be uncategorized.
                  </p>
                )}
                {deleteInfo.children_count > 0 && (
                  <p>
                    {deleteInfo.children_count} child categor
                    {deleteInfo.children_count !== 1 ? 'ies' : 'y'} will also be deleted.
                  </p>
                )}
                <p>This action cannot be undone.</p>
              </>
            ) : (
              <p>Loading category info...</p>
            )}
          </div>
        }
        confirmText={deleteTarget?.name ?? ''}
        onConfirm={(): void => void handleDeleteConfirm()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
