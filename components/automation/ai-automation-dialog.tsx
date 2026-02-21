'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles } from 'lucide-react';
import { InlineLoader } from '@/components/shared/loader';
import { useGenerateAutomationRules } from '@/lib/api/mutations/ai-automation.mutations';
import type { CreateAutomationRuleInput } from '@/types';

interface GeneratedRule {
  name: string;
  rule_type: string;
  condition_logic: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  priority?: number;
}

interface AiAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseRule: (rule: CreateAutomationRuleInput, prompt: string) => void;
}

export function AiAutomationDialog({
  open,
  onOpenChange,
  onUseRule,
}: AiAutomationDialogProps): React.ReactElement {
  const t = useTranslations('automation');
  const tCommon = useTranslations('common');
  const [prompt, setPrompt] = useState('');
  const generateMutation = useGenerateAutomationRules();

  const generating = generateMutation.isPending;
  const result = generateMutation.data ?? null;

  function resetState(): void {
    setPrompt('');
    generateMutation.reset();
  }

  function handleClose(next: boolean): void {
    if (!next) resetState();
    onOpenChange(next);
  }

  async function handleGenerate(): Promise<void> {
    if (!prompt.trim()) return;
    try {
      await generateMutation.mutateAsync(prompt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate');
    }
  }

  function handleUseRule(rule: GeneratedRule): void {
    const ruleType = (rule.rule_type || 'general') as 'general' | 'account_detection' | 'transfer';
    const conditionLogic = (rule.condition_logic || 'and') as 'and' | 'or';
    const input: CreateAutomationRuleInput = {
      name: rule.name,
      rule_type: ruleType,
      condition_logic: conditionLogic,
      conditions: rule.conditions as CreateAutomationRuleInput['conditions'],
      actions: rule.actions as CreateAutomationRuleInput['actions'],
      priority: rule.priority ?? 0,
      is_active: true,
    };
    onUseRule(input, prompt);
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='border-border bg-card max-h-[85dvh] overflow-y-auto sm:max-w-[550px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Sparkles className='h-5 w-5' />
            {t('createWithAi')}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <Textarea
            placeholder={t('aiPromptPlaceholder')}
            value={prompt}
            onChange={(e): void => setPrompt(e.target.value)}
            rows={3}
            disabled={generating}
          />

          {!result && (
            <Button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className='w-full cursor-pointer'>
              {generating ? (
                <>
                  <InlineLoader className='mr-2' />
                  {tCommon('generating')}
                </>
              ) : (
                <>
                  <Sparkles className='mr-2 h-4 w-4' />
                  {t('generatePreview')}
                </>
              )}
            </Button>
          )}

          {result && result.rules.length > 0 && (
            <div className='space-y-3'>
              {result.rules.map((rule, index) => (
                <div key={index} className='border-border space-y-2 rounded-lg border p-3'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-medium'>{rule.name}</p>
                    <Badge variant='secondary' className='text-xs'>
                      {rule.rule_type}
                    </Badge>
                  </div>

                  {Object.keys(rule.conditions).length > 0 && (
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs font-medium'>
                        {t('conditions')}
                      </p>
                      <div className='flex flex-wrap gap-1'>
                        {Object.entries(rule.conditions).map(([key, value]) => (
                          <Badge key={key} variant='outline' className='text-xs'>
                            {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(rule.actions).length > 0 && (
                    <div>
                      <p className='text-muted-foreground mb-1 text-xs font-medium'>
                        {t('actions')}
                      </p>
                      <div className='flex flex-wrap gap-1'>
                        {Object.entries(rule.actions).map(([key, value]) => (
                          <Badge key={key} variant='default' className='text-xs'>
                            {key}: {String(value)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    variant='outline'
                    size='sm'
                    className='w-full cursor-pointer'
                    onClick={(): void => handleUseRule(rule)}>
                    {tCommon('select')}
                  </Button>
                </div>
              ))}

              <Button
                variant='outline'
                className='w-full cursor-pointer'
                onClick={(): void => generateMutation.reset()}>
                {tCommon('back')}
              </Button>
            </div>
          )}

          {result && result.rules.length === 0 && (
            <div className='text-muted-foreground py-4 text-center text-sm'>
              {tCommon('noResults')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
