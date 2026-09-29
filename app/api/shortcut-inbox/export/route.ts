import { AuthError, errorResponse, getUserClient } from '@/lib/api/server';

const PAGE_SIZE = 500;

export async function GET(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const items: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('shortcut_inbox_items')
        .select('id,source,external_id,received_at,raw_text,status,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) return errorResponse('Inbox export failed');
      items.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    return Response.json(
      { version: 1, exported_at: new Date().toISOString(), items },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': 'attachment; filename="shortcut-inbox.json"',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (error) {
    return error instanceof AuthError
      ? errorResponse('Unauthorized', 401)
      : errorResponse('Inbox export failed');
  }
}
