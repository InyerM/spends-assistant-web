import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForwardedEmailEvidence } from '@/components/transactions/forwarded-email-evidence';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      senderUnverified: 'Unverified sender',
      securityNoticeOmitted: 'Security content omitted',
    };
    return translations[key] ?? key;
  },
}));

describe('ForwardedEmailEvidence', () => {
  it('localizes a redacted security notice while retaining its unverified sender', () => {
    render(
      <ForwardedEmailEvidence
        source='forwarded_email'
        rawText={'From (unverified): security@bank.example\n\n[security_notice]'}
      />,
    );
    expect(screen.getByText('Unverified sender')).toBeInTheDocument();
    expect(screen.getByText('security@bank.example')).toBeInTheDocument();
    expect(screen.getByText('Security content omitted')).toBeInTheDocument();
    expect(screen.queryByText('[security_notice]')).not.toBeInTheDocument();
  });
});
