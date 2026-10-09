import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnottoWordmark } from '@/components/layout/anotto-wordmark';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import pt from '@/messages/pt.json';

describe('Anotto customer identity', () => {
  it('identifies the product in full and collapsed navigation', () => {
    const { rerender } = render(<AnottoWordmark />);
    expect(screen.getByLabelText('Anotto')).toHaveTextContent('anotto');
    rerender(<AnottoWordmark compact />);
    expect(screen.getByLabelText('Anotto')).toBeVisible();
    expect(screen.queryByText('anotto')).not.toBeInTheDocument();
  });

  it('can animate the same mark inside the sidebar wordmark', () => {
    const { container } = render(<AnottoWordmark animated />);
    expect(container.querySelector('svg.anotto-loading-mark')).toBeInTheDocument();
  });

  it.each([en, es, pt])('provides localized authentication and navigation labels', (messages) => {
    expect(messages.auth).toMatchObject({ productName: 'Anotto' });
    expect(messages.auth).toHaveProperty('signIn');
    expect(messages.nav).toHaveProperty('collapseSidebar');
  });
});
