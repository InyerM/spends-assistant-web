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
    expect(screen.getByRole('link', { name: 'Ir a configuración' })).toHaveAttribute(
      'href',
      '/settings?tab=account',
    );
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute(
      'href',
      'https://anotto.app/privacy/',
    );
    expect(screen.getByRole('link', { name: 'Términos de uso' })).toHaveAttribute(
      'href',
      'https://anotto.app/terms/',
    );
    expect(screen.getByRole('link', { name: 'Escribir a soporte' })).toHaveAttribute(
      'href',
      'mailto:support@anotto.app',
    );
    expect(screen.getByRole('link', { name: 'Abrir guía externa' })).toHaveAttribute(
      'href',
      'https://anotto.app/#faq',
    );
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

it('replaces obsolete seeded links with the published Anotto destinations', () => {
  appSettings.mockReturnValue({
    data: { support_email: 'support@spendsapp.com', faq_url: 'https://spendsapp.com/faq' },
  });
  render(
    <NextIntlClientProvider locale='es' messages={es}>
      <HelpSection />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole('link', { name: 'Escribir a soporte' })).toHaveAttribute(
    'href',
    'mailto:support@anotto.app',
  );
  expect(screen.getByRole('link', { name: 'Abrir guía externa' })).toHaveAttribute(
    'href',
    'https://anotto.app/#faq',
  );
});
