import { headers } from 'next/headers';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';
import { UAParser } from 'ua-parser-js';

export async function POST(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') ?? '';
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    const browserName = browser.name ?? 'Unknown';
    const osName = os.name ?? 'Unknown';
    const deviceType = device.type ?? 'desktop';
    const deviceName = `${browserName} on ${osName}`;

    // Upsert: update if same user+device+browser combo, otherwise insert
    const { data: existing } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('device_name', deviceName)
      .eq('browser', browserName)
      .eq('os', osName)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from('user_sessions')
        .update({
          last_active_at: new Date().toISOString(),
          ip_address: ip,
        })
        .eq('id', (existing[0] as { id: string }).id);
    } else {
      await supabase.from('user_sessions').insert({
        user_id: userId,
        device_name: deviceName,
        device_type: deviceType,
        browser: browserName,
        os: osName,
        ip_address: ip,
      });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to track session');
  }
}
