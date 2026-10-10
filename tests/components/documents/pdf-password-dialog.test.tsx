import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PdfPasswordDialog } from '@/components/documents/pdf-password-dialog';
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    namespace === 'common' && key === 'cancel' ? 'Cancelar' : key,
}));
describe('owner PDF password prompt', () => {
  afterEach(cleanup);
  it('uses a protected input, submits only explicitly and clears it immediately', () => {
    const submit = vi.fn();
    render(
      <PdfPasswordDialog busy={false} incorrect={false} onClose={vi.fn()} onSubmit={submit} />,
    );
    const input = screen.getByLabelText('pdfPasswordLabel');
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'synthetic-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'pdfUnlock' }));
    expect(submit).toHaveBeenCalledWith('synthetic-secret');
    expect(input).toHaveValue('');
  });
  it('allows explicitly revealing and hiding the password', () => {
    render(
      <PdfPasswordDialog busy={false} incorrect={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    const input = screen.getByLabelText('pdfPasswordLabel');
    fireEvent.click(screen.getByRole('button', { name: 'showPassword' }));
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'hidePassword' }));
    expect(input).toHaveAttribute('type', 'password');
  });
  it('shows incorrect password feedback and blocks repeated requests while processing', () => {
    render(<PdfPasswordDialog busy incorrect onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('pdfErrors.PDF_PASSWORD_INCORRECT');
    expect(screen.getByRole('button', { name: 'extracting' })).toBeDisabled();
    expect(screen.getByLabelText('pdfPasswordLabel')).toBeDisabled();
  });
});
