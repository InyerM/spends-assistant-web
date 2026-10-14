'use client';
import ShortcutInboxPage from '@/app/(dashboard)/transactions/shortcut-inbox/page';
export function EmailInbox({ itemId }: { itemId?: string }): React.ReactElement {
  return <ShortcutInboxPage source='all' itemId={itemId} />;
}
