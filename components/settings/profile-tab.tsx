'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { supabaseClient } from '@/lib/supabase/client';

export function ProfileTab(): React.ReactElement {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const [displayName, setDisplayName] = useState<string | null>(null);

  const currentName = displayName ?? profile?.display_name ?? '';

  const handleSave = (): void => {
    updateProfile.mutate(
      { display_name: currentName },
      {
        onSuccess: () => toast.success('Profile updated'),
        onError: () => toast.error('Failed to update profile'),
      },
    );
  };

  const handleLinkGoogle = async (): Promise<void> => {
    try {
      const { error } = await supabaseClient.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/settings` },
      });
      if (error) throw error;
    } catch {
      toast.error('Failed to link Google account');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-4 w-48' />
        </CardHeader>
        <CardContent className='space-y-4'>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
        </CardContent>
      </Card>
    );
  }

  const initials = profile ? profile.email.slice(0, 2).toUpperCase() : '?';
  const hasGoogle = profile ? profile.providers.includes('google') : false;

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center gap-4'>
            <Avatar size='lg'>
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? ''} />
              )}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className='text-foreground font-medium'>
                {profile?.display_name ?? 'No name set'}
              </p>
              <p className='text-muted-foreground text-sm'>{profile?.email}</p>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='display-name'>Display name</Label>
            <Input
              id='display-name'
              value={currentName}
              onChange={(e): void => setDisplayName(e.target.value)}
              placeholder='Enter your name'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='email'>Email</Label>
            <Input id='email' value={profile?.email ?? ''} disabled />
          </div>

          <Button onClick={handleSave} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked accounts</CardTitle>
          <CardDescription>Connect third-party accounts for easier sign-in</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between'>
            <div>
              <p className='font-medium'>Google</p>
              <p className='text-muted-foreground text-sm'>
                {hasGoogle ? 'Connected' : 'Not connected'}
              </p>
            </div>
            {!hasGoogle && (
              <Button variant='outline' onClick={(): void => void handleLinkGoogle()}>
                Link Google
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
