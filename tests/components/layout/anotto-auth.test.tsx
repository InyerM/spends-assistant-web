import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import LoginPage from '@/app/(auth)/login/page';
import RegisterPage from '@/app/(auth)/register/page';
import es from '@/messages/es.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isLoading: false,
    isAuthenticated: false,
    signInWithPassword: vi.fn(),
    signInWithGoogle: vi.fn(),
    signUp: vi.fn(),
  }),
}));

afterEach(cleanup);

describe('localized Anotto authentication', () => {
  it.each([LoginPage, RegisterPage])(
    'renders Spanish labels and an accessible password toggle',
    (Page) => {
      render(
        <NextIntlClientProvider locale='es' messages={es}>
          <Page />
        </NextIntlClientProvider>,
      );
      expect(screen.getByLabelText('Anotto')).toBeVisible();
      const password = screen.getByLabelText('Contraseña');
      expect(password).toHaveAttribute('type', 'password');
      const reveal = screen.getAllByRole('button', { name: 'Mostrar contraseña' })[0];
      expect(reveal).toHaveClass('h-11', 'w-11');
      fireEvent.click(reveal);
      expect(password).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('autocomplete', 'email');
    },
  );
  it.each([LoginPage, RegisterPage])(
    'attaches validation state and its message to the password input',
    async (Page) => {
      render(
        <NextIntlClientProvider locale='es' messages={es}>
          <Page />
        </NextIntlClientProvider>,
      );
      fireEvent.change(screen.getByLabelText('Correo electrónico'), {
        target: { value: 'person@example.com' },
      });
      fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'abc' } });
      fireEvent.click(
        screen.getByRole('button', {
          name: Page === LoginPage ? 'Iniciar sesión' : 'Crear cuenta',
        }),
      );
      const message = await screen.findByText(es.auth.shortPassword);
      const password = screen.getByLabelText('Contraseña');
      expect(password).toHaveAttribute('aria-invalid', 'true');
      expect(password.getAttribute('aria-describedby')?.split(' ')).toContain(message.id);
    },
  );

  it('attaches mismatch validation to the confirm password input', async () => {
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <RegisterPage />
      </NextIntlClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'person@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    const message = await screen.findByText(es.auth.passwordMismatch);
    const password = screen.getByLabelText('Confirmar contraseña');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password.getAttribute('aria-describedby')?.split(' ')).toContain(message.id);
  });

  it('offers password recovery from the login screen', () => {
    render(
      <NextIntlClientProvider locale='es' messages={es}>
        <LoginPage />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
