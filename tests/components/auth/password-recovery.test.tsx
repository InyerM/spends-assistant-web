import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
import ResetPasswordPage from '@/app/(auth)/reset-password/page';
import es from '@/messages/es.json';

const requestPasswordReset = vi.fn();
const completePasswordReset = vi.fn();
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ requestPasswordReset, completePasswordReset }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(Page: () => React.ReactElement): void {
  render(
    <NextIntlClientProvider locale='es' messages={es}>
      <Page />
    </NextIntlClientProvider>,
  );
}

describe('password recovery pages', () => {
  it('requests a recovery link and shows a non-enumerating confirmation', async () => {
    requestPasswordReset.mockResolvedValue(undefined);
    renderPage(ForgotPasswordPage);

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('person@example.com'));
    expect(screen.getByRole('status')).toHaveTextContent('Si existe una cuenta');
  });

  it('requires matching passwords before finishing recovery', async () => {
    renderPage(ResetPasswordPage);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'new-password-123' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'different-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden');
    expect(completePasswordReset).not.toHaveBeenCalled();
  });

  it('updates the password and provides a sign-in link after the auth store signs out', async () => {
    completePasswordReset.mockResolvedValue(undefined);
    renderPage(ResetPasswordPage);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
      target: { value: 'new-password-123' },
    });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'new-password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

    await waitFor(() => expect(completePasswordReset).toHaveBeenCalledWith('new-password-123'));
    expect(screen.getByRole('status')).toHaveTextContent('Contraseña actualizada');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
  });
});
