import {
  automationRuleInputError,
  ruleMatchingCompatibility,
} from '@/lib/automation/rule-validation';
import type { NextRequest } from 'next/server';
import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient();

    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return errorResponse(error.message, 404);
    const state = ruleMatchingCompatibility(data.conditions);
    return jsonResponse(state.requires_review ? { ...data, matching_compatibility: state } : data);
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to fetch automation rule');
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient(request);
    const { data: existing, error: lookupError } = await supabase
      .from('automation_rules')
      .select('managed_account_id,conditions')
      .eq('id', id)
      .single();
    if (lookupError) return errorResponse('Automation rule not found', 404);
    if (existing.managed_account_id)
      return errorResponse('Managed account rules are updated through account identifiers', 409);

    const input: unknown = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return Response.json(
        { error: 'Invalid automation rule', code: 'AUTOMATION_REGEX_REVIEW_REQUIRED' },
        { status: 400 },
      );
    const body = input as Record<string, unknown>;
    const sameDisabledExpression =
      body.is_active === false &&
      (!Object.hasOwn(body, 'conditions') ||
        (body.conditions &&
          typeof body.conditions === 'object' &&
          !Array.isArray(body.conditions) &&
          (body.conditions as Record<string, unknown>).description_regex ===
            (existing.conditions as Record<string, unknown> | null)?.description_regex));
    const inputError = automationRuleInputError({
      ...body,
      conditions: body.conditions ?? existing.conditions,
    });
    if (inputError && !sameDisabledExpression) return Response.json(inputError, { status: 400 });

    const { data, error } = await supabase
      .from('automation_rules')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) return errorResponse(error.message, 400);
    return jsonResponse(data);
  } catch (error) {
    if (error instanceof AuthError)
      return errorResponse(
        error.status === 403 ? 'Invalid request origin' : 'Unauthorized',
        error.status === 403 ? 403 : 401,
      );
    return errorResponse('Failed to update automation rule');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const { id } = await params;
    const { supabase } = await getUserClient(_request);
    const { data: existing, error: lookupError } = await supabase
      .from('automation_rules')
      .select('managed_account_id')
      .eq('id', id)
      .single();
    if (lookupError) return errorResponse('Automation rule not found', 404);
    if (existing.managed_account_id)
      return errorResponse('Managed account rules are updated through account identifiers', 409);

    const { error } = await supabase.from('automation_rules').delete().eq('id', id);

    if (error) return errorResponse(error.message, 400);
    return jsonResponse({ success: true });
  } catch (error) {
    if (error instanceof AuthError)
      return errorResponse(
        error.status === 403 ? 'Invalid request origin' : 'Unauthorized',
        error.status === 403 ? 403 : 401,
      );
    return errorResponse('Failed to delete automation rule');
  }
}
