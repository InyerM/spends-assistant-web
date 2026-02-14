'use client';

import { useState, useEffect, useCallback } from 'react';
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

interface ApiKey {
  id: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface NewKeyResponse extends ApiKey {
  key: string;
}

export function ApiKeysTab(): React.ReactElement {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchKeys = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/api-keys');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = (await res.json()) as ApiKey[];
      setKeys(data);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  async function handleCreate(): Promise<void> {
    setCreating(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || 'Default' }),
      });
      if (!res.ok) throw new Error('Failed to create');
      const data = (await res.json()) as NewKeyResponse;
      setNewKey(data.key);
      setDialogOpen(true);
      setNewKeyName('');
      void fetchKeys();
    } catch {
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      const res = await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('API key deleted');
      void fetchKeys();
    } catch {
      toast.error('Failed to delete API key');
    }
  }

  function handleCopy(): void {
    if (newKey) {
      void navigator.clipboard.writeText(newKey);
      toast.success('Copied to clipboard');
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Manage API keys for the Cloudflare Worker backend. Keys are used to authenticate
            requests from external services.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex gap-2'>
            <Input
              placeholder='Key name (e.g. "My Worker")'
              value={newKeyName}
              onChange={(e): void => setNewKeyName(e.target.value)}
            />
            <Button onClick={(): void => void handleCreate()} disabled={creating}>
              {creating ? 'Creating...' : 'Generate Key'}
            </Button>
          </div>

          {loading ? (
            <p className='text-muted-foreground text-sm'>Loading...</p>
          ) : keys.length === 0 ? (
            <p className='text-muted-foreground text-sm'>No API keys yet.</p>
          ) : (
            <div className='space-y-2'>
              {keys.map((key) => (
                <div
                  key={key.id}
                  className='border-border flex items-center justify-between rounded-lg border p-3'>
                  <div>
                    <p className='font-medium'>{key.name}</p>
                    <p className='text-muted-foreground text-xs'>
                      Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at &&
                        ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={(): void => void handleDelete(key.id)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy this key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <code className='bg-muted block rounded p-3 text-sm break-all'>{newKey}</code>
            <Button onClick={handleCopy} className='w-full'>
              Copy to Clipboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
