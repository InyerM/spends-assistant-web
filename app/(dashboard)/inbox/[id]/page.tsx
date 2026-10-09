import { EmailInbox } from '@/components/transactions/email-inbox';

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  return <EmailInbox itemId={id} />;
}
