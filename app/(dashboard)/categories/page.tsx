'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategoryTree, useCategories } from '@/lib/api/queries/category.queries';
import { useCreateCategory, useUpdateCategory } from '@/lib/api/mutations/category.mutations';
import { Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
    <div className='space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-foreground text-2xl font-bold'>Categories</h2>
          <p className='text-muted-foreground text-sm'>Organize your transactions by category</p>
        </div>
        <Button onClick={(): void => handleCreate()}>
          <Plus className='mr-2 h-4 w-4' />
          New Category
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
              <Card key={parent.id} className='border-border bg-card'>
                <CardHeader className='flex flex-row items-center gap-3 space-y-0 py-3'>
                  {hasChildren ? (
                    <button
                      onClick={(): void => toggleExpanded(parent.id)}
                      className='text-muted-foreground hover:text-foreground cursor-pointer'>
                      {isExpanded ? (
                        <ChevronDown className='h-4 w-4' />
                      ) : (
                        <ChevronRight className='h-4 w-4' />
                      )}
                    </button>
                  ) : (
                    <div className='w-4' />
                  )}

                  <span className='text-lg'>{parent.icon ?? '📁'}</span>
                  <CardTitle className='flex-1 text-base font-medium'>{parent.name}</CardTitle>
                  <Badge variant={typeBadgeVariant[parent.type]}>{parent.type}</Badge>
                  {parent.color && (
                    <div
                      className='h-4 w-4 rounded-full'
                      style={{ backgroundColor: parent.color }}
                    />
                  )}
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={(): void => handleCreate(parent.id, parent.type)}
                    className='h-8 w-8 p-0'
                    title='Add subcategory'>
                    <Plus className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={(): void => handleEdit(parent)}
                    className='h-8 w-8 p-0'>
                    <Pencil className='h-4 w-4' />
                  </Button>
                </CardHeader>

                {isExpanded && hasChildren && (
                  <CardContent className='pt-0 pb-3'>
                    <div className='ml-8 space-y-1'>
                      {parent.children.map((child) => (
                        <div
                          key={child.id}
                          className='hover:bg-card-overlay flex items-center gap-3 rounded-lg px-3 py-2'>
                          <span>{child.icon ?? '📄'}</span>
                          <span className='flex-1 text-sm'>{child.name}</span>
                          <span className='text-muted-foreground text-xs'>{child.slug}</span>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={(): void => handleEdit(child)}
                            className='h-7 w-7 p-0'>
                            <Pencil className='h-3 w-3' />
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
                      <Input placeholder='category-slug' {...field} />
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
    </div>
  );
}
