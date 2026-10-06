import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = new URL(request.url).searchParams.get('code');
  const invalidLinkUrl = new URL('/forgot-password?error=invalid-link', request.url);
  if (!code) return NextResponse.redirect(invalidLinkUrl);

  const response = NextResponse.redirect(new URL('/reset-password', request.url));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll(): { name: string; value: string }[] {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
        ): void {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options as Record<string, unknown>);
          }
        },
      },
    },
  );

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(invalidLinkUrl);
  } catch {
    return NextResponse.redirect(invalidLinkUrl);
  }

  return response;
}
