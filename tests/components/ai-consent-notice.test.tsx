import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiConsentNotice } from '@/components/ai-consent-notice';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('AiConsentNotice', () => {
  it('links to the AI permissions tab', () => {
    render(<AiConsentNotice scope='document_images' />);
    expect(screen.getByText('requiredDocumentImages')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'reviewPermissions' })).toHaveAttribute(
      'href',
      '/settings?tab=ai-processing',
    );
  });
});
