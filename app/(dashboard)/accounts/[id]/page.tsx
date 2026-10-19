'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Trash2, Check, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccount, useAccounts } from '@/lib/api/queries/account.queries';
import { useDeleteAccount } from '@/lib/api/mutations/account.mutations';
import { AccountEditDialog } from '@/components/accounts/account-edit-dialog';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { EnableCurrency } from '@/components/accounts/enable-currency';
import { AccountOverview } from '@/components/accounts/account-overview';
import { AccountRecords } from '@/components/accounts/account-records';
import { groupAccounts } from '@/lib/accounts/currency-groups';
import { formatCurrency } from '@/lib/utils/formatting';
export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const { id } = use(params);
  const t = useTranslations('accounts'),
    common = useTranslations('common'),
    locale = useLocale(),
    router = useRouter();
  const query = useAccount(id);
  const { data: accounts } = useAccounts();
  const [active, setActive] = useState<string | null>(null);
  const [edit, setEdit] = useState(false),
    [remove, setRemove] = useState(false);
  const deletion = useDeleteAccount();
  const account = query.data;
  const group = groupAccounts(accounts ?? []).find((g) => g.ledgers.some((a) => a.id === id));
  const ledgers = group?.ledgers ?? (account ? [account] : []);
  const selected = ledgers.find((a) => a.id === (active ?? id)) ?? account;
  const root = group?.account ?? account;
  if (query.isLoading)
    return (
      <div className='mx-auto max-w-7xl p-6'>
        <Skeleton className='h-96 w-full' />
      </div>
    );
  if (!selected || !root) return <p className='p-6'>{t('accountNotFound')}</p>;
  return (
    <div className='mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8'>
      <Link
        href='/accounts'
        className='text-muted-foreground inline-flex items-center gap-2 text-sm'>
        <ArrowLeft className='size-4' />
        {t('title')}
      </Link>
      <header className='flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0'>
          <h1 className='text-2xl font-semibold tracking-tight wrap-anywhere'>{root.name}</h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            {[root.institution, root.last_four ? `•••• ${root.last_four}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => setEdit(true)}>
            <Pencil className='size-4' />
            {common('edit')}
          </Button>
          {!selected.is_default && (
            <Button
              variant='ghost'
              size='icon'
              aria-label={common('delete')}
              onClick={() => setRemove(true)}>
              <Trash2 className='text-muted-foreground size-4' />
            </Button>
          )}
        </div>
      </header>
      <section className='border-border bg-card space-y-5 rounded-xl border p-5 sm:p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div role='group' aria-label={t('balanceCurrency')} className='flex flex-wrap gap-2'>
            {ledgers.map((a) => (
              <Button
                key={a.id}
                size='sm'
                variant='outline'
                aria-pressed={selected.id === a.id}
                className={
                  selected.id === a.id
                    ? 'border-success bg-success/15 text-success dark:border-success dark:bg-success/15 dark:text-success font-semibold'
                    : ''
                }
                onClick={() => setActive(a.id)}>
                {selected.id === a.id && <Check className='size-4' />}
                {a.currency}
              </Button>
            ))}
          </div>
          {['COP', 'USD']
            .filter((c) => !ledgers.some((a) => a.currency === c))
            .map((currency) => (
              <EnableCurrency
                key={currency}
                account={root}
                currency={currency}
                onEnabled={(a) => setActive(a.id)}
              />
            ))}
        </div>
        <div className='min-w-0'>
          <p className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Wallet className='size-4' />
            {t('currentBalance')} · {selected.currency}
          </p>
          <p
            className={`mt-2 text-2xl font-semibold tracking-tight wrap-anywhere tabular-nums sm:text-3xl ${selected.balance < 0 ? 'text-destructive' : 'text-success'}`}>
            {formatCurrency(selected.balance, selected.currency, locale)}
          </p>
          <p className='text-muted-foreground mt-2 text-xs'>{t('separateBalances')}</p>
        </div>
      </section>
      <AccountOverview key={selected.id} account={selected} />
      <AccountRecords account={selected} />
      <AccountEditDialog account={selected} open={edit} onOpenChange={setEdit} />
      <ConfirmDeleteDialog
        open={remove}
        onOpenChange={setRemove}
        title={t('deleteAccount')}
        description={<p>{t('deleteAccountConfirm', { name: selected.name })}</p>}
        confirmText={selected.name}
        isPending={deletion.isPending}
        onConfirm={async () => {
          try {
            await deletion.mutateAsync(selected.id);
            toast.success(t('accountDeleted'));
            router.push('/accounts');
          } catch {
            toast.error(t('failedToDelete'));
          }
        }}
      />
    </div>
  );
}
