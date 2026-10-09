import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentReviewFields } from '@/components/documents/document-review-fields';
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/ui/date-picker', () => ({ DatePicker: () => <div /> }));
vi.mock('@/components/ui/time-picker', () => ({ TimePicker: () => <div /> }));
vi.mock('@/components/shared/searchable-select', () => ({ SearchableSelect: () => <div /> }));
vi.mock('@/components/documents/document-review-selects', () => ({
  DocumentAccountSelect: () => <div />,
}));

describe('document suggested fields', () => {
  it('distinguishes extracted suggestions and removes their treatment when the owner edits', () => {
    const onChange = vi.fn();
    const draft = {
      date: '2026-10-09',
      time: '12:00',
      amount: '12000',
      description: 'Extracted merchant',
      currency: 'COP',
      type: 'expense' as const,
      accountId: '',
      categoryId: '',
      destinationAccountId: '',
    };
    render(
      <DocumentReviewFields
        draft={draft}
        accounts={[]}
        categories={[]}
        disabled={false}
        onChange={onChange}
        suggestedFields={['description', 'amount']}
      />,
    );
    const description = screen.getByRole('textbox', { name: 'transactionDescription' });
    expect(description.closest('.ai-field')).toHaveAttribute('data-ai-state', 'suggested');
    fireEvent.change(description, { target: { value: 'Owner description' } });
    expect(onChange).toHaveBeenCalledWith({ description: 'Owner description' });
    expect(description.closest('.ai-field')).toBeNull();
    expect(
      screen.getByRole('spinbutton', { name: 'transactionAmount' }).closest('.ai-field'),
    ).toBeTruthy();
  });
});
