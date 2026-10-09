'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { TermsAcceptanceGate } from '@/components/guards/terms-acceptance-gate';
import { AnottoWordmark } from '@/components/layout/anotto-wordmark';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { confirmEligibility } from '@/lib/api/mutations/eligibility';
import { useDeleteUserAccount } from '@/lib/api/mutations/account-deletion.mutations';
import { useAuth } from '@/hooks/use-auth';

export default function EligibilityPage(): React.ReactElement {
  const t = useTranslations('auth');
  const settings = useTranslations('settings');
  const router = useRouter();
  const { signOut, user } = useAuth();
  const deletion = useDeleteUserAccount();
  const [adult, setAdult] = useState(false);
  const [colombia, setColombia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function submit(): Promise<void> {
    if (!adult || !colombia || saving) return;
    setSaving(true);
    setError(false);
    try {
      await confirmEligibility();
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  async function leave(): Promise<void> {
    await signOut();
    router.replace('/login');
  }

  return (
    <TermsAcceptanceGate>
      <main className='bg-login-bg text-foreground flex min-h-screen w-full items-center justify-center p-4'>
        <div className='w-full max-w-md'>
          <AnottoWordmark className='mb-8 justify-center' />
          <section className='border-border bg-card rounded-2xl border p-6 sm:p-8'>
            <h1 className='text-2xl font-semibold'>{t('eligibilityTitle')}</h1>
            <p className='text-muted-foreground mt-2 text-sm'>{t('eligibilityDescription')}</p>
            <div className='mt-6 space-y-5'>
              <label className='flex cursor-pointer items-start gap-3 text-sm'>
                <Checkbox
                  checked={adult}
                  onCheckedChange={(value): void => setAdult(value === true)}
                />
                <span>{t('confirmAdult')}</span>
              </label>
              <label className='flex cursor-pointer items-start gap-3 text-sm'>
                <Checkbox
                  checked={colombia}
                  onCheckedChange={(value): void => setColombia(value === true)}
                />
                <span>{t('confirmColombia')}</span>
              </label>
            </div>
            {error && <p className='text-destructive mt-4 text-sm'>{t('eligibilitySaveFailed')}</p>}
            <Button
              className='mt-6 w-full'
              disabled={!adult || !colombia || saving}
              onClick={(): void => void submit()}>
              {saving ? t('eligibilitySaving') : t('eligibilityContinue')}
            </Button>
            <Button
              variant='ghost'
              className='text-muted-foreground mt-2 w-full'
              onClick={(): void => void leave()}>
              {t('backToSignIn')}
            </Button>
            <Button
              variant='ghost'
              className='text-destructive mt-1 w-full'
              disabled={!user}
              onClick={(): void => setDeleteOpen(true)}>
              {settings('deleteAccountButton')}
            </Button>
          </section>
        </div>
        <ConfirmDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={settings('deleteAccountConfirmTitle')}
          description={settings('deleteAccountConfirmDescription')}
          confirmText={user?.email ?? 'DELETE'}
          confirmLabel={settings('deleteAccountButton')}
          isPending={deletion.isPending}
          onConfirm={(): void => {
            deletion.mutate(user?.email ?? 'DELETE', {
              onSuccess: () => void leave(),
              onError: () => toast.error(settings('deleteAccountFailed')),
            });
          }}
        />
      </main>
    </TermsAcceptanceGate>
  );
}
