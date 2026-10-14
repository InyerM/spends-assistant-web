'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Wallet, Plus, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { AccountCreateDialog } from '@/components/accounts/account-create-dialog';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useUpdateAccount } from '@/lib/api/mutations/account.mutations';
import { buildAccountItems } from '@/lib/utils/select-items';
import {
  unrecognizedSourceAccount,
  withSourceIdentifier,
} from '@/lib/shortcut-inbox/unrecognized-account';
function UnrecognizedAccountActions({
  rawText,
  onSelected,
}: {
  rawText: string;
  onSelected?: (id: string) => void;
}): React.ReactElement | null {
  const t = useTranslations('shortcutInbox'),
    transactionT = useTranslations('transactions');
  const { data: accounts, isPending, isError } = useAccounts();
  const update = useUpdateAccount();
  const [open, setOpen] = useState(false),
    [linking, setLinking] = useState(false),
    [selected, setSelected] = useState('');
  const suggestion = unrecognizedSourceAccount(rawText, accounts ?? []);
  if (isPending || isError || !suggestion) return null;
  const eligible = accounts.filter(
    (account) =>
      account.is_active &&
      !account.deleted_at &&
      (!suggestion.currency || account.currency === suggestion.currency) &&
      (suggestion.kind === 'credit_card'
        ? account.type === 'credit_card'
        : ['checking', 'savings'].includes(account.type)),
  );
  const identifier = {
    kind: suggestion.kind,
    last_four: suggestion.last_four,
    is_active: true,
    is_primary: true,
  };
  const account = eligible.find((item) => item.id === selected);
  return (
    <section className='border-brand/25 bg-brand/5 space-y-2 rounded-xl border p-3'>
      <div className='flex items-start gap-2'>
        <Wallet aria-hidden='true' className='text-brand mt-0.5 size-4 shrink-0' />
        <div className='min-w-0'>
          <h3 className='text-sm font-medium'>
            {t('unknownAccount.title', { suffix: suggestion.last_four })}
          </h3>
          <p className='text-muted-foreground mt-1 text-xs'>{t('unknownAccount.hint')}</p>
        </div>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button type='button' size='sm' variant='outline' onClick={() => setOpen(true)}>
          <Plus className='size-4' />
          {t('unknownAccount.create')}
        </Button>
        {eligible.length > 0 && (
          <Button type='button' size='sm' variant='ghost' onClick={() => setLinking(!linking)}>
            <Link2 className='size-4' />
            {t('unknownAccount.link')}
          </Button>
        )}
      </div>
      {linking && (
        <div className='space-y-2'>
          <SearchableSelect
            ariaLabel={t('unknownAccount.choose')}
            placeholder={t('unknownAccount.choose')}
            searchPlaceholder={transactionT('searchAccounts')}
            value={selected}
            items={buildAccountItems(eligible)}
            onValueChange={setSelected}
          />
          <p className='text-muted-foreground text-xs'>
            {t('unknownAccount.confirm', {
              suffix: suggestion.last_four,
              name: account?.name ?? '—',
            })}
          </p>
          {update.error && (
            <p role='alert' className='text-destructive text-xs'>
              {t('unknownAccount.error')}
            </p>
          )}
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={!account || update.isPending}
            onClick={() => {
              if (!account) return;
              update.mutate(
                {
                  id: account.id,
                  identifiers: withSourceIdentifier(account, suggestion),
                },
                { onSuccess: () => onSelected?.(account.id) },
              );
            }}>
            {t('unknownAccount.confirmLink')}
          </Button>
        </div>
      )}
      <AccountCreateDialog
        open={open}
        onOpenChange={setOpen}
        initialIdentifier={identifier}
        initialCurrency={suggestion.currency ?? 'COP'}
        onCreated={(created) => onSelected?.(created.id)}
      />
    </section>
  );
}

export function UnrecognizedAccountNotice({
  rawText,
  onSelected,
}: {
  rawText: string;
  onSelected?: (id: string) => void;
}): React.ReactElement | null {
  if (!unrecognizedSourceAccount(rawText, [])) return null;
  return <UnrecognizedAccountActions rawText={rawText} onSelected={onSelected} />;
}
