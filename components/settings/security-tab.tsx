'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useSessions, useRevokeSession } from '@/hooks/use-sessions';
import { useProfile } from '@/hooks/use-profile';
import { supabaseClient } from '@/lib/supabase/client';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const deviceIcons: Record<string, LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
};

function getDeviceIcon(deviceType: string | null): LucideIcon {
  return deviceIcons[deviceType ?? ''] ?? Monitor;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SecurityTab(): React.ReactElement {
  const { data: profile } = useProfile();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [closeAllSessions, setCloseAllSessions] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const hasPasswordProvider = profile ? profile.providers.includes('email') : true;
  const isGoogleOnly = profile ? !hasPasswordProvider : false;

  const handleChangePassword = async (): Promise<void> => {
    setShowPasswordConfirm(false);
    setChangingPassword(true);
    try {
      const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
      if (error) throw error;

      if (closeAllSessions) {
        await supabaseClient.auth.signOut({ scope: 'others' });
      }

      toast.success(
        closeAllSessions
          ? 'Password updated and other sessions closed'
          : 'Password updated successfully',
      );
      setNewPassword('');
      setConfirmPassword('');
      setCloseAllSessions(false);
    } catch {
      toast.error('Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePasswordSubmit = (): void => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setShowPasswordConfirm(true);
  };

  const handleRevoke = (id: string): void => {
    revokeSession.mutate(id, {
      onSuccess: () => toast.success('Session revoked'),
      onError: () => toast.error('Failed to revoke session'),
    });
  };

  // Find the most recently active session (likely the current one)
  const currentSessionId = sessions?.length
    ? [...sessions].sort(
        (a, b) => new Date(b.last_active_at).getTime() - new Date(a.last_active_at).getTime(),
      )[0].id
    : null;

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>{isGoogleOnly ? 'Set password' : 'Change password'}</CardTitle>
          <CardDescription>
            {isGoogleOnly
              ? 'Set a password to also sign in with email and password'
              : 'Update your password to keep your account secure'}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='new-password'>{isGoogleOnly ? 'Password' : 'New password'}</Label>
            <Input
              id='new-password'
              type='password'
              value={newPassword}
              onChange={(e): void => setNewPassword(e.target.value)}
              placeholder='At least 8 characters'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='confirm-password'>
              {isGoogleOnly ? 'Confirm password' : 'Confirm new password'}
            </Label>
            <Input
              id='confirm-password'
              type='password'
              value={confirmPassword}
              onChange={(e): void => setConfirmPassword(e.target.value)}
            />
          </div>

          {!isGoogleOnly && (
            <label className='flex items-center gap-2'>
              <Checkbox
                checked={closeAllSessions}
                onCheckedChange={(checked): void => setCloseAllSessions(checked === true)}
              />
              <span className='text-muted-foreground text-sm'>
                Close all other sessions after updating
              </span>
            </label>
          )}

          <Button
            onClick={handlePasswordSubmit}
            disabled={changingPassword || !newPassword || !confirmPassword}>
            {changingPassword ? 'Updating...' : isGoogleOnly ? 'Set password' : 'Update password'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Devices that are currently signed in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-16 w-full' />
              <Skeleton className='h-16 w-full' />
            </div>
          ) : !sessions?.length ? (
            <p className='text-muted-foreground text-sm'>No active sessions recorded.</p>
          ) : (
            <div className='space-y-3'>
              {sessions.map((session) => {
                const Icon = getDeviceIcon(session.device_type);
                const isCurrent = session.id === currentSessionId;
                return (
                  <div
                    key={session.id}
                    className='border-border flex items-center justify-between rounded-lg border p-3'>
                    <div className='flex items-center gap-3'>
                      <Icon className='text-muted-foreground h-5 w-5 shrink-0' />
                      <div>
                        <p className='flex items-center gap-2 text-sm font-medium'>
                          {session.device_name ?? 'Unknown device'}
                          {isCurrent && (
                            <Badge variant='secondary' className='text-xs'>
                              Current
                            </Badge>
                          )}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {session.ip_address && `${session.ip_address} · `}
                          Last active {formatDate(session.last_active_at)}
                        </p>
                      </div>
                    </div>
                    {!isCurrent && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={(): void => handleRevoke(session.id)}
                        disabled={revokeSession.isPending}>
                        Revoke
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPasswordConfirm} onOpenChange={setShowPasswordConfirm}>
        <DialogContent className='border-border bg-card sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>{isGoogleOnly ? 'Set password?' : 'Change password?'}</DialogTitle>
            <DialogDescription>
              {closeAllSessions
                ? 'Your password will be updated and all other sessions will be closed. You will need to sign in again on other devices.'
                : isGoogleOnly
                  ? 'A password will be set for your account. You will be able to sign in with both Google and email/password.'
                  : 'Your password will be updated. Make sure you remember the new password.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={(): void => setShowPasswordConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={(): void => void handleChangePassword()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
