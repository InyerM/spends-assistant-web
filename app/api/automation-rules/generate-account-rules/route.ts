import { getUserClient, AuthError, jsonResponse, errorResponse } from '@/lib/api/server';
import type { Account } from '@/types';

interface GeneratedRule {
  user_id: string;
  name: string;
  is_active: boolean;
  priority: number;
  rule_type: 'account_detection';
  condition_logic: 'and';
  conditions: { raw_text_contains: string[] };
  actions: { set_account: string };
}

function generateAccountDetectionRules(userId: string, accounts: Account[]): GeneratedRule[] {
  const rules: GeneratedRule[] = [];

  for (const account of accounts) {
    if (account.type === 'cash') continue;
    if (!account.is_active) continue;

    const keywords: string[] = [];
    if (account.institution) keywords.push(account.institution);
    if (account.last_four) keywords.push(account.last_four);
    if (keywords.length === 0) continue;

    rules.push({
      user_id: userId,
      name: `Account: ${account.name}`,
      is_active: true,
      priority: 100,
      rule_type: 'account_detection',
      condition_logic: 'and',
      conditions: { raw_text_contains: keywords },
      actions: { set_account: account.id },
    });
  }

  return rules;
}

export async function POST(): Promise<Response> {
  try {
    const { supabase, userId } = await getUserClient();

    // Fetch active accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null);

    if (accountsError) return errorResponse(accountsError.message, 400);

    const rules = generateAccountDetectionRules(userId, accounts as Account[]);

    if (rules.length === 0) {
      return jsonResponse({
        message: 'No rules to generate. Ensure accounts have institution or last_four set.',
        created: 0,
        data: [],
      });
    }

    // Delete existing account_detection rules first
    const { error: deleteError } = await supabase
      .from('automation_rules')
      .delete()
      .eq('user_id', userId)
      .eq('rule_type', 'account_detection');

    if (deleteError) return errorResponse(deleteError.message, 400);

    // Insert new rules
    const { data: created, error: insertError } = await supabase
      .from('automation_rules')
      .insert(rules)
      .select();

    if (insertError) return errorResponse(insertError.message, 400);

    return jsonResponse(
      {
        message: `Generated ${created.length} account detection rules`,
        created: created.length,
        data: created,
      },
      201,
    );
  } catch (error) {
    if (error instanceof AuthError) return errorResponse('Unauthorized', 401);
    return errorResponse('Failed to generate account rules');
  }
}
