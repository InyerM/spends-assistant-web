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
import { CategoryFormDialog } from '@/components/categories/category-form-dialog';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { TYPE_BADGE_VARIANT, SPENDING_NATURE_BADGE_VARIANT } from '@/lib/constants/badge-variants';
import type { Category, CategoryType, SpendingNature } from '@/types';

const spendingNatureTooltipKey: Record<SpendingNature, string> = {
  none: 'spendingNatureNoneTooltip',
  want: 'spendingNatureWantTooltip',
  need: 'spendingNatureNeedTooltip',
  must: 'spendingNatureMustTooltip',
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
  const { data: categoryTree, isLoading, isError, refetch } = useAllCategoryTree();
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
      <div className='mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8'>
        <header className='flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <h1 className='text-3xl font-bold tracking-tight'>{t('title')}</h1>
            <p className='text-muted-foreground max-w-2xl text-sm'>{t('subtitle')}</p>
          </div>
          <Button className='min-h-11' onClick={(): void => handleCreate()}>
            <Plus className='mr-2 h-4 w-4' />
            {t('newCategory')}
          </Button>
        </header>
        <div className='bg-card border-border flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between'>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`${tCommon('search')}...`}
            clearLabel={tCommon('reset')}
            className='w-full sm:max-w-sm'
          />
          <div className='flex min-h-11 items-center gap-3'>
            <Switch checked={showHidden} onCheckedChange={setShowHidden} id='show-hidden' />
            <label htmlFor='show-hidden' className='cursor-pointer text-sm'>
              {t('showHidden')}
            </label>
          </div>
        </div>

        {isError ? (
          <div role='alert' className='border-border bg-card space-y-3 rounded-2xl border p-6'>
            <p>{t('loadError')}</p>
            <Button
              variant='outline'
              onClick={(): void => {
                void refetch();
              }}>
              {tCommon('tryAgain')}
            </Button>
          </div>
        ) : isLoading ? (
          <div className='space-y-4'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-16 w-full' />
            ))}
          </div>
        ) : !filteredTree?.length ? (
          <div className='border-border bg-card space-y-3 rounded-2xl border px-6 py-12 text-center'>
            <h2 className='text-lg font-semibold'>
              {search || showHidden || categoryTree?.length
                ? tCommon('noResults')
                : t('noCategories')}
            </h2>
            <p className='text-muted-foreground text-sm'>
              {search || categoryTree?.length
                ? t('noResultsDescription')
                : t('noCategoriesDescription')}
            </p>
            {search || categoryTree?.length ? (
              <Button
                variant='outline'
                onClick={(): void => {
                  setSearch('');
                  setShowHidden(true);
                }}>
                {tCommon('reset')}
              </Button>
            ) : (
              <Button onClick={(): void => handleCreate()}>{t('addFirst')}</Button>
            )}
          </div>
        ) : (
          <div className='space-y-3'>
            {filteredTree.map((parent) => {
              const isExpanded = search.trim().length > 0 || expandedIds.has(parent.id);
              const hasChildren = parent.children.length > 0;
              const displayName = getCategoryDisplayName(parent, locale);

              const parentCardContent = (
                <Card className='border-border bg-card overflow-hidden rounded-2xl shadow-none'>
                  <CardHeader className='flex flex-row flex-wrap items-center gap-2 space-y-0 px-4 py-4 sm:gap-3'>
                    {hasChildren ? (
                      <button
                        onClick={(e): void => {
                          e.stopPropagation();
                          toggleExpanded(parent.id);
                        }}
                        aria-label={`${t('subcategories')} ${displayName}`}
                        aria-expanded={isExpanded}
                        className='text-muted-foreground hover:text-foreground focus-visible:ring-ring flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg focus-visible:ring-2'>
                        {isExpanded ? (
                          <ChevronDown className='h-4 w-4' />
                        ) : (
                          <ChevronRight className='h-4 w-4' />
                        )}
                      </button>
                    ) : (
                      <div className='w-4 shrink-0' />
                    )}

                    <span className='bg-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg'>
                      {parent.icon ?? '📁'}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <CardTitle className='truncate text-base font-medium'>
                        {displayName}
                        {hasChildren ? (
                          <span className='text-muted-foreground ml-2 text-xs tabular-nums'>
                            ({parent.children.length})
                          </span>
                        ) : null}
                        {!parent.is_active ? (
                          <Badge variant='outline' className='ml-2'>
                            {tCommon('disabled')}
                          </Badge>
                        ) : null}
                      </CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className='text-muted-foreground truncate text-xs'>{parent.slug}</p>
                        </TooltipTrigger>
                        <TooltipContent side='top'>{t('slugTooltip')}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Badge variant={TYPE_BADGE_VARIANT[parent.type]} className='shrink-0'>
                      {t(parent.type)}
                    </Badge>
                    {parent.spending_nature && parent.spending_nature !== 'none' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant={SPENDING_NATURE_BADGE_VARIANT[parent.spending_nature]}
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
                    <div className='border-border flex w-full shrink-0 items-center justify-end border-t pt-2 sm:w-auto sm:border-0 sm:pt-0'>
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
                        className='h-11 w-11 cursor-pointer p-0'
                        aria-label={`${t(parent.is_active ? 'hideCategory' : 'showCategory')} ${displayName}`}
                        disabled={updateMutation.isPending}>
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
                        aria-label={`${t('editCategory')} ${displayName}`}
                        className='h-11 w-11 cursor-pointer p-0'>
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
                                aria-label={`${t('deleteCategory')} ${displayName}: ${t('cannotDeleteDefault')}`}
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
                          aria-label={`${t('deleteCategory')} ${displayName}`}
                          className='text-destructive h-11 w-11 cursor-pointer p-0'>
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  {isExpanded && hasChildren && (
                    <CardContent className='pt-0 pb-3'>
                      <div className='border-border space-y-1 border-t pt-2 sm:ml-8'>
                        {parent.children.map((child) => {
                          const childDisplayName = getCategoryDisplayName(child, locale);

                          const childRowContent = (
                            <div className='hover:bg-accent flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 sm:gap-3'>
                              <span>{child.icon ?? '📄'}</span>
                              <div className='min-w-0 flex-1'>
                                <span className='block truncate text-sm'>
                                  {childDisplayName}
                                  {!child.is_active ? (
                                    <span className='text-muted-foreground ml-2 text-xs'>
                                      ({tCommon('disabled')})
                                    </span>
                                  ) : null}
                                </span>
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
                                      variant={SPENDING_NATURE_BADGE_VARIANT[child.spending_nature]}
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
                                aria-label={`${t(child.is_active ? 'hideCategory' : 'showCategory')} ${childDisplayName}`}
                                disabled={updateMutation.isPending}
                                onClick={(): void => handleToggleVisibility(child)}
                                className='h-11 w-11 cursor-pointer p-0'>
                                {child.is_active ? (
                                  <Eye className='h-4 w-4 sm:h-3 sm:w-3' />
                                ) : (
                                  <EyeOff className='text-muted-foreground h-4 w-4 sm:h-3 sm:w-3' />
                                )}
                              </Button>
                              <Button
                                variant='ghost'
                                size='sm'
                                aria-label={`${t('editCategory')} ${childDisplayName}`}
                                onClick={(): void => handleEdit(child)}
                                className='h-11 w-11 cursor-pointer p-0'>
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
                                        aria-label={`${t('deleteCategory')} ${childDisplayName}: ${t('cannotDeleteDefault')}`}
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
                                  aria-label={`${t('deleteCategory')} ${childDisplayName}`}
                                  onClick={(): void => void handleDeleteClick(child)}
                                  className='text-destructive h-11 w-11 cursor-pointer p-0'>
                                  <Trash2 className='h-4 w-4 sm:h-3 sm:w-3' />
                                </Button>
                              )}
                            </div>
                          );

                          return <div key={child.id}>{childRowContent}</div>;
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );

              return <div key={parent.id}>{parentCardContent}</div>;
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
