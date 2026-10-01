import { deleteEmptyWealthRecord, updateWealthRecord } from '@/lib/wealth/manage-record-route';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams): Promise<Response> {
  return updateWealthRecord('loan', request, (await params).id);
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<Response> {
  return deleteEmptyWealthRecord('loan', (await params).id);
}
