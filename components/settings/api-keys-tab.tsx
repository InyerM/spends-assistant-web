'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApiKeys } from '@/lib/api/queries/api-key.queries';
import { useCreateApiKey, useDeleteApiKey } from '@/lib/api/mutations/api-key.mutations';

export function ApiKeysTab(): React.ReactElement {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { data: keys, isLoading: loading } = useApiKeys();
  const createMutation = useCreateApiKey();
  const deleteMutation = useDeleteApiKey();
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleCreate(): Promise<void> {
    try {
      const data = await createMutation.mutateAsync(newKeyName);
      setNewKey(data.key);
      setDialogOpen(true);
      setNewKeyName('');
    } catch {
      toast.error(t('failedToCreateApiKey'));
    }
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('apiKeyDeleted'));
    } catch {
      toast.error(t('failedToDeleteApiKey'));
    }
  }

  function handleCopy(): void {
    if (newKey) {
      void navigator.clipboard.writeText(newKey);
      toast.success(t('copiedToClipboard'));
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('apiKeysTitle')}</CardTitle>
          <CardDescription>{t('apiKeysDescription')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex gap-2'>
            <Input
              placeholder={t('keyNamePlaceholder')}
              value={newKeyName}
              onChange={(e): void => setNewKeyName(e.target.value)}
            />
            <Button onClick={(): void => void handleCreate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? t('creatingKey') : t('generateKey')}
            </Button>
          </div>

          {loading ? (
            <p className='text-muted-foreground text-sm'>{t('loadingKeys')}</p>
          ) : !keys || keys.length === 0 ? (
            <p className='text-muted-foreground text-sm'>{t('noApiKeys')}</p>
          ) : (
            <div className='space-y-2'>
              {keys.map((key) => (
                <div
                  key={key.id}
                  className='border-border flex items-center justify-between rounded-lg border p-3'>
                  <div>
                    <p className='font-medium'>{key.name}</p>
                    <p className='text-muted-foreground text-xs'>
                      {t('createdDate', {
                        date: new Date(key.created_at).toLocaleDateString(),
                      })}
                      {key.last_used_at &&
                        ` · ${t('lastUsedDate', { date: new Date(key.last_used_at).toLocaleDateString() })}`}
                    </p>
                  </div>
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={(): void => void handleDelete(key.id)}>
                    {tc('delete')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='border-border bg-card'>
          <DialogHeader>
            <DialogTitle>{t('apiKeyCreated')}</DialogTitle>
            <DialogDescription>{t('apiKeyCreatedDescription')}</DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <code className='bg-muted block rounded p-3 text-sm break-all'>{newKey}</code>
            <Button onClick={handleCopy} className='w-full'>
              {t('copyToClipboard')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
