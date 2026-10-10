import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TimePicker } from '@/components/ui/time-picker';
vi.mock('@/hooks/use-user-settings', () => ({
  useUserSettings: () => ({ data: { hour_format: '24h' } }),
}));
it('shows unknown review times as blank rather than fabricated midnight', () => {
  render(<TimePicker value='' onChange={vi.fn()} allowEmpty />);
  expect(screen.getByLabelText('Hours')).toHaveValue('');
  expect(screen.getByLabelText('Minutes')).toHaveValue('');
});
