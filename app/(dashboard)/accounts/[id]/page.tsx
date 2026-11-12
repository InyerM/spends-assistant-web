'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
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
import { AccountBalanceHero } from '@/components/accounts/account-balance-hero';
export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.ReactElement {
  const { id } = use(params);
  const t = useTranslations('accounts'),
    common = useTranslations('common'),
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
      <div className='space-y-3'>
        <AccountBalanceHero ledgers={ledgers} selectedId={selected.id} onSelect={setActive} />
        {['COP', 'USD']
          .filter((currency) => !ledgers.some((ledger) => ledger.currency === currency))
          .map((currency) => (
            <EnableCurrency
              key={currency}
              account={root}
              currency={currency}
              onEnabled={(ledger) => setActive(ledger.id)}
            />
          ))}
      </div>
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
