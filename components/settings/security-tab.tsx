'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import { Eye, EyeOff, Monitor, Smartphone, Tablet } from 'lucide-react';
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
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { data: profile } = useProfile();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const revokeSession = useRevokeSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [closeAllSessions, setCloseAllSessions] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasPasswordProvider = profile ? profile.providers.includes('email') : true;
  const isGoogleOnly = profile ? !hasPasswordProvider : false;

  const handleChangePassword = async (): Promise<void> => {
    setShowPasswordConfirm(false);
    setChangingPassword(true);
    try {
      // If user has a password provider, verify current password first
      if (hasPasswordProvider && currentPassword) {
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email: profile?.email ?? '',
          password: currentPassword,
        });
        if (signInError) {
          toast.error(t('failedToUpdatePassword'));
          setChangingPassword(false);
          return;
        }
      }

      const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
      if (error) throw error;

      if (closeAllSessions) {
        await supabaseClient.auth.signOut({ scope: 'others' });
      }

      toast.success(
        closeAllSessions ? t('passwordUpdatedAndSessionsClosed') : t('passwordUpdatedSuccessfully'),
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCloseAllSessions(false);
    } catch {
      toast.error(t('failedToUpdatePassword'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePasswordSubmit = (): void => {
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordsDoNotMatch'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('passwordMinLength'));
      return;
    }
    setShowPasswordConfirm(true);
  };

  const handleRevoke = (id: string): void => {
    revokeSession.mutate(id, {
      onSuccess: () => toast.success(t('sessionRevoked')),
      onError: () => toast.error(t('failedToRevokeSession')),
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
          <CardTitle>{isGoogleOnly ? t('setPassword') : t('changePassword')}</CardTitle>
          <CardDescription>
            {isGoogleOnly ? t('setPasswordDescription') : t('changePasswordDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {hasPasswordProvider && (
            <div className='space-y-2'>
              <Label htmlFor='current-password'>{t('currentPassword')}</Label>
              <div className='relative'>
                <Input
                  id='current-password'
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e): void => setCurrentPassword(e.target.value)}
                  className='pr-10'
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='absolute top-1/2 right-3 h-auto -translate-y-1/2 p-0'
                  onClick={(): void => setShowCurrentPassword((prev) => !prev)}
                  tabIndex={-1}>
                  {showCurrentPassword ? (
                    <EyeOff className='text-muted-foreground h-4 w-4' />
                  ) : (
                    <Eye className='text-muted-foreground h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className='space-y-2'>
            <Label htmlFor='new-password'>{isGoogleOnly ? t('password') : t('newPassword')}</Label>
            <div className='relative'>
              <Input
                id='new-password'
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e): void => setNewPassword(e.target.value)}
                placeholder={t('atLeast8Characters')}
                className='pr-10'
              />
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='absolute top-1/2 right-3 h-auto -translate-y-1/2 p-0'
                onClick={(): void => setShowNewPassword((prev) => !prev)}
                tabIndex={-1}>
                {showNewPassword ? (
                  <EyeOff className='text-muted-foreground h-4 w-4' />
                ) : (
                  <Eye className='text-muted-foreground h-4 w-4' />
                )}
              </Button>
            </div>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='confirm-password'>
              {isGoogleOnly ? t('confirmPassword') : t('confirmNewPassword')}
            </Label>
            <div className='relative'>
              <Input
                id='confirm-password'
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e): void => setConfirmPassword(e.target.value)}
                className='pr-10'
              />
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='absolute top-1/2 right-3 h-auto -translate-y-1/2 p-0'
                onClick={(): void => setShowConfirmPassword((prev) => !prev)}
                tabIndex={-1}>
                {showConfirmPassword ? (
                  <EyeOff className='text-muted-foreground h-4 w-4' />
                ) : (
                  <Eye className='text-muted-foreground h-4 w-4' />
                )}
              </Button>
            </div>
          </div>

          {!isGoogleOnly && (
            <label className='flex items-center gap-2'>
              <Checkbox
                checked={closeAllSessions}
                onCheckedChange={(checked): void => setCloseAllSessions(checked === true)}
              />
              <span className='text-muted-foreground text-sm'>
                {t('closeAllSessionsAfterUpdating')}
              </span>
            </label>
          )}

          <Button
            onClick={handlePasswordSubmit}
            disabled={
              changingPassword ||
              !newPassword ||
              !confirmPassword ||
              (hasPasswordProvider && !currentPassword)
            }>
            {changingPassword
              ? t('updatingPassword')
              : isGoogleOnly
                ? t('setPassword')
                : t('updatePassword')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('activeSessions')}</CardTitle>
          <CardDescription>{t('activeSessionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-16 w-full' />
              <Skeleton className='h-16 w-full' />
            </div>
          ) : !sessions?.length ? (
            <p className='text-muted-foreground text-sm'>{t('noActiveSessions')}</p>
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
                          {session.device_name ?? t('unknownDevice')}
                          {isCurrent && (
                            <Badge variant='secondary' className='text-xs'>
                              {t('current')}
                            </Badge>
                          )}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {session.ip_address && `${session.ip_address} · `}
                          {t('lastActive', { date: formatDate(session.last_active_at) })}
                        </p>
                      </div>
                    </div>
                    {!isCurrent && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={(): void => handleRevoke(session.id)}
                        disabled={revokeSession.isPending}>
                        {t('revoke')}
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
            <DialogTitle>
              {isGoogleOnly ? t('setPasswordConfirm') : t('changePasswordConfirm')}
            </DialogTitle>
            <DialogDescription>
              {closeAllSessions
                ? t('closeSessionsConfirmDescription')
                : isGoogleOnly
                  ? t('setPasswordConfirmDescription')
                  : t('changePasswordConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={(): void => setShowPasswordConfirm(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={(): void => void handleChangePassword()}>{tc('confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
