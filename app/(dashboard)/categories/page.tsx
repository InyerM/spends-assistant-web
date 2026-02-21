'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchInput } from '@/components/shared/search-input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllCategoryTree } from '@/lib/api/queries/category.queries';
import {
  useUpdateCategory,
  useDeleteCategory,
  fetchCategoryWithCounts,
} from '@/lib/api/mutations/category.mutations';
import { SwipeableRow } from '@/components/transactions/swipeable-row';
import { CategoryFormDialog } from '@/components/categories/category-form-dialog';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import type { Category, CategoryType, SpendingNature } from '@/types';

const spendingNatureTooltipKey: Record<SpendingNature, string> = {
  none: 'spendingNatureNoneTooltip',
  want: 'spendingNatureWantTooltip',
  need: 'spendingNatureNeedTooltip',
  must: 'spendingNatureMustTooltip',
};

const typeBadgeVariant: Record<CategoryType, 'destructive' | 'default' | 'secondary'> = {
  expense: 'destructive',
  income: 'default',
  transfer: 'secondary',
};

const spendingNatureBadgeVariant: Record<
  SpendingNature,
  'outline' | 'default' | 'secondary' | 'destructive'
> = {
  none: 'outline',
  want: 'secondary',
  need: 'default',
  must: 'destructive',
};

function getCategoryDisplayName(category: Category, locale: string): string {
  if (category.translations && category.translations[locale]) {
    return category.translations[locale];
  }
  return category.name;
}

export default function CategoriesPage(): React.ReactElement {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { data: categoryTree, isLoading } = useAllCategoryTree();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>();
  const [defaultType, setDefaultType] = useState<CategoryType | undefined>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<{
    transaction_count: number;
    children_count: number;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [search, setSearch] = useState('');

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
    setDefaultParentId(parentId);
    setDefaultType(type);
    setDialogOpen(true);
  };

  const handleEdit = (category: Category): void => {
    setEditingCategory(category);
    setDefaultParentId(undefined);
    setDefaultType(undefined);
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
      toast.success(t('categoryDeleted'));
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch {
      toast.error(t('failedToDelete'));
    }
  };

  const handleToggleVisibility = (category: Category): void => {
    updateMutation.mutate(
      { id: category.id, is_active: !category.is_active } as { id: string; is_active: boolean },
      {
        onError: () => {
          toast.error(t('failedToUpdate'));
        },
      },
    );
  };

  // Filter tree based on showHidden toggle and search
  const filteredTree = useMemo(() => {
    let tree = categoryTree;
    if (!tree) return tree;

    // Visibility filter
    if (!showHidden) {
      tree = tree
        .map((parent) => ({
          ...parent,
          children: parent.children.filter((child) => child.is_active),
        }))
        .filter((parent) => parent.is_active);
    }

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      tree = tree
        .map((parent) => {
          const parentName = getCategoryDisplayName(parent, locale).toLowerCase();
          const matchingChildren = parent.children.filter((child) => {
            const childName = getCategoryDisplayName(child, locale).toLowerCase();
            return childName.includes(q) || child.slug.includes(q);
          });
          // Include parent if it matches or has matching children
          if (parentName.includes(q) || parent.slug.includes(q)) {
            return parent; // show all children when parent matches
          }
          if (matchingChildren.length > 0) {
            return { ...parent, children: matchingChildren };
          }
          return null;
        })
        .filter(Boolean) as typeof tree;
    }

    return tree;
  }, [categoryTree, showHidden, search, locale]);

  return (
    <TooltipProvider>
      <div className='space-y-4 p-4 sm:space-y-6 sm:p-6'>
        <div className='space-y-3 sm:space-y-0'>
          {/* Mobile: search full-width */}
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`${tCommon('search')}...`}
            className='sm:hidden'
          />

          {/* Toggle + button row (mobile), search + toggle + button row (desktop) */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              {/* Desktop: search inline */}
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={`${tCommon('search')}...`}
                className='hidden max-w-[320px] min-w-[180px] flex-1 sm:block'
              />
              <Switch checked={showHidden} onCheckedChange={setShowHidden} id='show-hidden' />
              <label
                htmlFor='show-hidden'
                className='text-muted-foreground cursor-pointer text-sm whitespace-nowrap'>
                {t('showHidden')}
              </label>
            </div>
            <Button className='cursor-pointer' onClick={(): void => handleCreate()}>
              <Plus className='h-4 w-4 sm:mr-2' />
              <span className='hidden sm:inline'>{t('newCategory')}</span>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className='space-y-4'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-16 w-full' />
            ))}
          </div>
        ) : (
          <div className='space-y-2'>
            {filteredTree?.map((parent) => {
              const isExpanded = expandedIds.has(parent.id);
              const hasChildren = parent.children.length > 0;
              const displayName = getCategoryDisplayName(parent, locale);

              const parentCardContent = (
                <Card className={`border-border bg-card ${!parent.is_active ? 'opacity-50' : ''}`}>
                  <CardHeader className='flex flex-row items-center gap-2 space-y-0 py-3 sm:gap-3'>
                    {hasChildren ? (
                      <button
                        onClick={(e): void => {
                          e.stopPropagation();
                          toggleExpanded(parent.id);
                        }}
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
                    <div className='min-w-0 flex-1'>
                      <CardTitle className='truncate text-base font-medium'>
                        {displayName}
                      </CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className='text-muted-foreground truncate text-xs'>{parent.slug}</p>
                        </TooltipTrigger>
                        <TooltipContent side='top'>{t('slugTooltip')}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Badge
                      variant={typeBadgeVariant[parent.type]}
                      className='hidden shrink-0 sm:inline-flex'>
                      {parent.type}
                    </Badge>
                    {parent.spending_nature && parent.spending_nature !== 'none' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={spendingNatureBadgeVariant[parent.spending_nature]}
                            className='hidden shrink-0 cursor-default text-xs sm:inline-flex'>
                            {t(parent.spending_nature)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t(spendingNatureTooltipKey[parent.spending_nature])}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {parent.is_default && (
                      <Badge variant='outline' className='hidden shrink-0 text-xs sm:inline-flex'>
                        {t('isDefault')}
                      </Badge>
                    )}
                    {parent.color && (
                      <div
                        className='hidden h-4 w-4 shrink-0 rounded-full sm:block'
                        style={{ backgroundColor: parent.color }}
                      />
                    )}
                    <div className='flex shrink-0 items-center'>
                      {/* Add subcategory - only on top-level categories */}
                      {!parent.parent_id && (
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={(e): void => {
                            e.stopPropagation();
                            handleCreate(parent.id, parent.type);
                          }}
                          className='h-9 w-9 cursor-pointer p-0'
                          title={t('addSubcategory')}>
                          <Plus className='h-4 w-4' />
                        </Button>
                      )}
                      {/* Visibility toggle */}
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={(e): void => {
                          e.stopPropagation();
                          handleToggleVisibility(parent);
                        }}
                        className='hidden h-9 w-9 cursor-pointer p-0 sm:flex'
                        title={t('hideCategory')}>
                        {parent.is_active ? (
                          <Eye className='h-4 w-4' />
                        ) : (
                          <EyeOff className='text-muted-foreground h-4 w-4' />
                        )}
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={(e): void => {
                          e.stopPropagation();
                          handleEdit(parent);
                        }}
                        className='hidden h-9 w-9 cursor-pointer p-0 sm:flex'>
                        <Pencil className='h-4 w-4' />
                      </Button>
                      {/* Delete button: hidden for default categories */}
                      {parent.is_default ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className='hidden sm:inline-flex'>
                              <Button
                                variant='ghost'
                                size='sm'
                                disabled
                                className='text-muted-foreground hidden h-9 w-9 p-0 sm:flex'>
                                <Trash2 className='h-4 w-4' />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('cannotDeleteDefault')}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={(e): void => {
                            e.stopPropagation();
                            void handleDeleteClick(parent);
                          }}
                          className='text-destructive hidden h-9 w-9 cursor-pointer p-0 sm:flex'>
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  {isExpanded && hasChildren && (
                    <CardContent className='pt-0 pb-3'>
                      <div className='ml-4 space-y-1 sm:ml-8'>
                        {parent.children.map((child) => {
                          const childDisplayName = getCategoryDisplayName(child, locale);

                          const childRowContent = (
                            <div
                              className={`hover:bg-card-overlay flex items-center gap-2 rounded-lg px-3 py-2 sm:gap-3 ${!child.is_active ? 'opacity-50' : ''}`}>
                              <span>{child.icon ?? '📄'}</span>
                              <div className='min-w-0 flex-1'>
                                <span className='block truncate text-sm'>{childDisplayName}</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <p className='text-muted-foreground hidden truncate text-xs sm:block'>
                                      {child.slug}
                                    </p>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('slugTooltip')}</TooltipContent>
                                </Tooltip>
                              </div>
                              {child.spending_nature && child.spending_nature !== 'none' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant={spendingNatureBadgeVariant[child.spending_nature]}
                                      className='hidden shrink-0 cursor-default text-xs sm:inline-flex'>
                                      {t(child.spending_nature)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {t(spendingNatureTooltipKey[child.spending_nature])}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {child.is_default && (
                                <Badge
                                  variant='outline'
                                  className='hidden shrink-0 text-xs sm:inline-flex'>
                                  {t('isDefault')}
                                </Badge>
                              )}
                              {/* Visibility toggle */}
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={(): void => handleToggleVisibility(child)}
                                className='hidden h-9 w-9 cursor-pointer p-0 sm:flex sm:h-7 sm:w-7'>
                                {child.is_active ? (
                                  <Eye className='h-4 w-4 sm:h-3 sm:w-3' />
                                ) : (
                                  <EyeOff className='text-muted-foreground h-4 w-4 sm:h-3 sm:w-3' />
                                )}
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={(): void => handleEdit(child)}
                                className='hidden h-9 w-9 cursor-pointer p-0 sm:flex sm:h-7 sm:w-7'>
                                <Pencil className='h-4 w-4 sm:h-3 sm:w-3' />
                              </Button>
                              {child.is_default ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className='hidden sm:inline-flex'>
                                      <Button
                                        variant='ghost'
                                        size='sm'
                                        disabled
                                        className='text-muted-foreground hidden h-9 w-9 p-0 sm:flex sm:h-7 sm:w-7'>
                                        <Trash2 className='h-4 w-4 sm:h-3 sm:w-3' />
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{t('cannotDeleteDefault')}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={(): void => void handleDeleteClick(child)}
                                  className='text-destructive hidden h-9 w-9 cursor-pointer p-0 sm:flex sm:h-7 sm:w-7'>
                                  <Trash2 className='h-4 w-4 sm:h-3 sm:w-3' />
                                </Button>
                              )}
                            </div>
                          );

                          return (
                            <div key={child.id}>
                              {/* Desktop: regular row */}
                              <div className='hidden sm:block'>{childRowContent}</div>
                              {/* Mobile: swipeable row */}
                              <div className='sm:hidden'>
                                <SwipeableRow
                                  onEdit={(): void => handleEdit(child)}
                                  onDelete={
                                    child.is_default
                                      ? undefined
                                      : (): void => void handleDeleteClick(child)
                                  }>
                                  {childRowContent}
                                </SwipeableRow>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );

              return (
                <div key={parent.id}>
                  {/* Desktop: regular card */}
                  <div className='hidden sm:block'>{parentCardContent}</div>
                  {/* Mobile: swipeable card */}
                  <div className='sm:hidden'>
                    <SwipeableRow
                      onEdit={(): void => handleEdit(parent)}
                      onDelete={
                        parent.is_default ? undefined : (): void => void handleDeleteClick(parent)
                      }>
                      {parentCardContent}
                    </SwipeableRow>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <CategoryFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingCategory={editingCategory}
          defaultParentId={defaultParentId}
          defaultType={defaultType}
        />

        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={t('deleteCategory')}
          description={
            <div className='text-muted-foreground space-y-1 text-sm'>
              {deleteInfo ? (
                <>
                  {deleteInfo.transaction_count > 0 && (
                    <p>{t('linkedTransactions', { count: deleteInfo.transaction_count })}</p>
                  )}
                  {deleteInfo.children_count > 0 && (
                    <p>{t('childCategories', { count: deleteInfo.children_count })}</p>
                  )}
                  <p>{tCommon('actionCannotBeUndone')}</p>
                </>
              ) : (
                <p>{t('loadingCategoryInfo')}</p>
              )}
            </div>
          }
          confirmText={deleteTarget?.name ?? ''}
          onConfirm={(): void => void handleDeleteConfirm()}
          isPending={deleteMutation.isPending}
        />
      </div>
    </TooltipProvider>
  );
}
