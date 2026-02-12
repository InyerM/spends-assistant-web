'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildAccountItems, buildCategoryItems } from '@/lib/utils/select-items';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import {
  useCreateAutomationRule,
  useUpdateAutomationRule,
} from '@/lib/api/mutations/automation.mutations';
import type {
  AutomationRule,
  AutomationRuleConditions,
  AutomationRuleActions,
  CreateAutomationRuleInput,
} from '@/types';

function InfoTip({ text }: { text: string }): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          className='text-muted-foreground hover:text-foreground inline-flex cursor-help'
          tabIndex={-1}>
          <Info className='h-3.5 w-3.5' />
        </button>
      </TooltipTrigger>
      <TooltipContent side='top' className='max-w-56'>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  is_active: z.boolean(),
  priority: z.number().int(),
  match_phone: z.string().optional(),
  transfer_to_account_id: z.string().optional(),
  prompt_text: z.string().optional(),
  description_contains: z.string().optional(),
  description_regex: z.string().optional(),
  raw_text_contains: z.string().optional(),
  amount_min: z.number().optional(),
  amount_max: z.number().optional(),
  source: z.string().optional(),
  set_type: z.string().optional(),
  set_category: z.string().optional(),
  set_account: z.string().optional(),
  auto_reconcile: z.boolean(),
  add_note: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AutomationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: AutomationRule | null;
}

function getDefaults(rule?: AutomationRule | null): FormValues {
  if (!rule) {
    return {
      name: '',
      is_active: true,
      priority: 0,
      match_phone: '',
      transfer_to_account_id: undefined,
      prompt_text: '',
      description_contains: '',
      description_regex: '',
      raw_text_contains: '',
      amount_min: undefined,
      amount_max: undefined,
      source: '',
      set_type: undefined,
      set_category: undefined,
      set_account: undefined,
      auto_reconcile: false,
      add_note: '',
    };
  }
  return {
    name: rule.name,
    is_active: rule.is_active,
    priority: rule.priority,
    match_phone: rule.match_phone ?? '',
    transfer_to_account_id: rule.transfer_to_account_id ?? undefined,
    prompt_text: rule.prompt_text ?? '',
    description_contains: rule.conditions.description_contains?.join(', ') ?? '',
    description_regex: rule.conditions.description_regex ?? '',
    raw_text_contains: rule.conditions.raw_text_contains?.join(', ') ?? '',
    amount_min: rule.conditions.amount_between?.[0],
    amount_max: rule.conditions.amount_between?.[1],
    source: rule.conditions.source?.join(', ') ?? '',
    set_type: rule.actions.set_type ?? undefined,
    set_category: rule.actions.set_category ?? undefined,
    set_account: rule.actions.set_account ?? undefined,
    auto_reconcile: rule.actions.auto_reconcile ?? false,
    add_note: rule.actions.add_note ?? '',
  };
}

export function AutomationForm({
  open,
  onOpenChange,
  rule,
}: AutomationFormProps): React.ReactElement {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const createMutation = useCreateAutomationRule();
  const updateMutation = useUpdateAutomationRule();
  const isEditing = !!rule;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults(rule),
  });

  useEffect(() => {
    if (open) {
      form.reset(getDefaults(rule));
    }
  }, [open, rule, form]);

  function buildPayload(values: FormValues): CreateAutomationRuleInput {
    const conditions: AutomationRuleConditions = {};
    if (values.description_contains?.trim()) {
      conditions.description_contains = values.description_contains
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (values.description_regex?.trim()) {
      conditions.description_regex = values.description_regex.trim();
    }
    if (values.raw_text_contains?.trim()) {
      conditions.raw_text_contains = values.raw_text_contains
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (values.amount_min !== undefined && values.amount_max !== undefined) {
      conditions.amount_between = [values.amount_min, values.amount_max];
    }
    if (values.source?.trim()) {
      conditions.source = values.source
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const actions: AutomationRuleActions = {};
    if (values.set_type && values.set_type !== 'none') {
      actions.set_type = values.set_type as 'expense' | 'income' | 'transfer';
    }
    if (values.set_category && values.set_category !== 'none') {
      actions.set_category = values.set_category;
    }
    if (values.set_account && values.set_account !== 'none') {
      actions.set_account = values.set_account;
    }
    if (values.auto_reconcile) {
      actions.auto_reconcile = true;
    }
    if (values.add_note?.trim()) {
      actions.add_note = values.add_note.trim();
    }
    if (values.transfer_to_account_id && values.transfer_to_account_id !== 'none') {
      actions.link_to_account = values.transfer_to_account_id;
    }

    return {
      name: values.name,
      is_active: values.is_active,
      priority: values.priority,
      match_phone: values.match_phone?.trim() || undefined,
      transfer_to_account_id: values.transfer_to_account_id || undefined,
      prompt_text: values.prompt_text?.trim() || undefined,
      conditions,
      actions,
    };
  }

  async function onSubmit(values: FormValues): Promise<void> {
    try {
      const payload = buildPayload(values);
      if (isEditing) {
        await updateMutation.mutateAsync({ id: rule.id, ...payload });
        toast.success('Rule updated');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Rule created');
      }
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? 'Failed to update rule' : 'Failed to create rule');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='border-border bg-card max-h-[90vh] overflow-y-auto sm:max-w-[550px]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Rule' : 'New Rule'}</DialogTitle>
        </DialogHeader>

        <TooltipProvider>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }): React.ReactElement => (
                    <FormItem className='col-span-2 sm:col-span-1'>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder='Rule name' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='priority'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel className='inline-flex items-center gap-1.5'>
                        Priority
                        <InfoTip text='Higher values run first. Multiple rules can match the same transaction.' />
                      </FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          {...field}
                          onChange={(e): void => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='is_active'
                render={({ field }): React.ReactElement => (
                  <FormItem className='flex items-center gap-3'>
                    <FormLabel>Active</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='match_phone'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>Match Phone</FormLabel>
                    <FormControl>
                      <Input placeholder='Phone number to match' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='prompt_text'
                render={({ field }): React.ReactElement => (
                  <FormItem>
                    <FormLabel>AI Prompt</FormLabel>
                    <FormControl>
                      <Textarea placeholder='Custom prompt text for AI...' rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='border-border space-y-3 rounded-lg border p-3'>
                <p className='text-sm font-medium'>Conditions</p>
                <FormField
                  control={form.control}
                  name='description_contains'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel className='inline-flex items-center gap-1.5'>
                        Description Contains
                        <InfoTip text='Matches against the AI-parsed transaction description. Comma-separated keywords, any match triggers the rule.' />
                      </FormLabel>
                      <FormControl>
                        <Input placeholder='nequi, daviplata' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='description_regex'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>Description Regex</FormLabel>
                      <FormControl>
                        <Input placeholder='Pattern...' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='raw_text_contains'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel className='inline-flex items-center gap-1.5'>
                        Raw Text Contains
                        <InfoTip text='Matches against the original SMS/message text before AI parsing. Use for bank-specific terms like account numbers (*2651).' />
                      </FormLabel>
                      <FormControl>
                        <Input placeholder='*2651, bancolombia' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className='grid grid-cols-2 gap-4'>
                  <FormField
                    control={form.control}
                    name='amount_min'
                    render={({ field }): React.ReactElement => (
                      <FormItem>
                        <FormLabel>Amount Min</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            placeholder='0'
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e): void =>
                              field.onChange(e.target.value ? e.target.valueAsNumber : undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='amount_max'
                    render={({ field }): React.ReactElement => (
                      <FormItem>
                        <FormLabel>Amount Max</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            placeholder='0'
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e): void =>
                              field.onChange(e.target.value ? e.target.valueAsNumber : undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name='source'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>Source (comma-separated)</FormLabel>
                      <FormControl>
                        <Input placeholder='telegram, email, sms-shortcut' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='border-border space-y-3 rounded-lg border p-3'>
                <p className='text-sm font-medium'>Actions</p>
                <FormField
                  control={form.control}
                  name='set_type'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>Set Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value ?? 'none'}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='None' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='none'>None</SelectItem>
                          <SelectItem value='expense'>Expense</SelectItem>
                          <SelectItem value='income'>Income</SelectItem>
                          <SelectItem value='transfer'>Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='set_category'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>Set Category</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value ?? 'none'}
                          onValueChange={field.onChange}
                          placeholder='None'
                          searchPlaceholder='Search categories...'
                          items={[
                            { value: 'none', label: 'None' },
                            ...buildCategoryItems(categories ?? []),
                          ]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='set_account'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel className='inline-flex items-center gap-1.5'>
                        Set Account
                        <InfoTip text='Override the source account. Useful when the AI picks the wrong account from SMS.' />
                      </FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value ?? 'none'}
                          onValueChange={field.onChange}
                          placeholder='None'
                          searchPlaceholder='Search accounts...'
                          items={[
                            { value: 'none', label: 'None' },
                            ...buildAccountItems(accounts ?? []),
                          ]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='transfer_to_account_id'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel className='inline-flex items-center gap-1.5'>
                        Transfer To Account
                        <InfoTip text='Link matched transactions to a destination account, creating a transfer pair.' />
                      </FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value ?? 'none'}
                          onValueChange={field.onChange}
                          placeholder='None'
                          searchPlaceholder='Search accounts...'
                          items={[
                            { value: 'none', label: 'None' },
                            ...buildAccountItems(accounts ?? []),
                          ]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='auto_reconcile'
                  render={({ field }): React.ReactElement => (
                    <FormItem className='flex items-center gap-3'>
                      <FormLabel>Auto Reconcile</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='add_note'
                  render={({ field }): React.ReactElement => (
                    <FormItem>
                      <FormLabel>Add Note</FormLabel>
                      <FormControl>
                        <Input placeholder='Note to add...' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='flex justify-end gap-3 pt-4'>
                <Button type='button' variant='outline' onClick={(): void => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type='submit'
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : isEditing
                      ? 'Update'
                      : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
