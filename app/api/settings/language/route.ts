import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';
import { defaultLocale, isValidLocale } from '@/i18n/config';

export async function GET(): Promise<Response> {
  try {
    const { supabase } = await getUserClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const language = (user?.user_metadata.language as string | undefined) ?? defaultLocale;

    return jsonResponse({ language: isValidLocale(language) ? language : defaultLocale });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch language preference');
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const { supabase } = await getUserClient();

    const body = (await request.json()) as { language?: unknown };
    const language = body.language;

    if (!isValidLocale(language)) {
      return errorResponse('Invalid language. Must be one of: en, es, pt', 400);
    }

    const { error } = await supabase.auth.updateUser({
      data: { language },
    });

    if (error) return errorResponse(error.message, 400);

    return jsonResponse({ language });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to update language preference');
  }
}
