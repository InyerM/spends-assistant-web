import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ForwardedEmailEvidence } from '@/components/transactions/forwarded-email-evidence';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      senderUnverified: 'Unverified sender',
      securityNoticeOmitted: 'Security content omitted',
      subject: 'Subject',
      showFullMessage: 'Show full message',
      hideFullMessage: 'Hide full message',
    };
    return translations[key] ?? key;
  },
}));

afterEach(cleanup);

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

  it('renders a decoded subject and keeps long legal text behind a disclosure', () => {
    render(
      <ForwardedEmailEvidence
        source='forwarded_email'
        rawText={
          'From (unverified): notices@bank.example\n\nCompra realizada\n\nCompraste en SHEIN por $188,165.52\n\nOrigen tarjeta de cr&eacute;dito &#8226;8456\n\nFecha 5 de octubre de 2026\n\nHora 12:24 p.m.\n\nSi no reconoces este movimiento, comunícate con soporte.\n\n© 2026 Lulo bank. Información legal.'
        }
      />,
    );
    expect(screen.getByText('Compra realizada')).toBeInTheDocument();
    expect(screen.getByText(/crédito •8456/u)).toBeInTheDocument();
    expect(screen.queryByText(/Información legal/u)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show full message' }));
    expect(screen.getByText(/Información legal/u)).toBeInTheDocument();
  });

  it('collapses a long single-spaced bank template after the transaction details', () => {
    render(
      <ForwardedEmailEvidence
        source='forwarded_email'
        rawText={
          'From (unverified): notices@bank.example\n\nCompra realizada\n\nRealizaste una compra en Demo Store por $121,000\nOrigen tarjeta de crédito •8456\nFecha 5 de octubre de 2026\nHora 12:24 p.m.\nSi no reconoces este movimiento visita la ayuda.\n© 2026 Banco. Información legal.'
        }
      />,
    );
    expect(screen.getByText('Hora 12:24 p.m.')).toBeInTheDocument();
    expect(screen.queryByText(/Información legal/u)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show full message' }));
    expect(screen.getByText(/Información legal/u)).toBeInTheDocument();
  });
});
