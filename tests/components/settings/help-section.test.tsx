import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { HelpSection } from '@/components/settings/help-section';
import es from '@/messages/es.json';

const { appSettings } = vi.hoisted(() => ({ appSettings: vi.fn() }));

vi.mock('@/hooks/use-app-settings', () => ({ useAppSettings: appSettings }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('help center', () => {
  it('answers the six common questions and links to the relevant app screens', () => {
    appSettings.mockReturnValue({ data: {} });
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <HelpSection />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('¿Cómo confirmo el reenvío de Gmail?')).toBeInTheDocument();
    expect(screen.getByText('¿Por qué un correo sigue pendiente?')).toBeInTheDocument();
    expect(screen.getByText('¿Qué hago si una transacción ya existe?')).toBeInTheDocument();
    expect(screen.getByText('¿Cómo reviso un comprobante?')).toBeInTheDocument();
    expect(screen.getByText('¿Por qué el saldo de una cuenta puede diferir?')).toBeInTheDocument();
    expect(screen.getByText('¿Dónde consulto la eliminación de mi cuenta?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurar reenvío' })).toHaveAttribute(
      'href',
      '/settings?tab=email-forwarding',
    );
    expect(screen.getByRole('link', { name: 'Ver documentos' })).toHaveAttribute(
      'href',
      '/documents',
    );
    expect(screen.getByRole('link', { name: 'Política de privacidad (borrador)' })).toHaveAttribute(
      'href',
      'https://anotto-landing.vercel.app/privacy/',
    );
    expect(screen.getByRole('link', { name: 'Términos de uso (borrador)' })).toHaveAttribute(
      'href',
      'https://anotto-landing.vercel.app/terms/',
    );
    expect(screen.queryByRole('link', { name: 'Escribir a soporte' })).not.toBeInTheDocument();
  });

  it('shows only a configured support address', () => {
    appSettings.mockReturnValue({ data: { support_email: 'verified@example.com' } });
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <HelpSection />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('link', { name: 'Escribir a soporte' })).toHaveAttribute(
      'href',
      'mailto:verified@example.com',
    );
  });
});
