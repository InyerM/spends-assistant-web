import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Account } from '@/types';
import { AccountBalanceHero } from '@/components/accounts/account-balance-hero';
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));
let resize: () => void = () => undefined;
vi.stubGlobal(
  'ResizeObserver',
  class {
    constructor(callback: () => void) {
      resize = callback;
    }
    observe() {}
    disconnect() {}
  },
);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const scrollTo = vi.fn();
Object.defineProperty(HTMLElement.prototype, 'scrollTo', { value: scrollTo, configurable: true });
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn(() => ({ matches: true })),
  configurable: true,
});
const ledgers = [
  { id: 'cop', currency: 'COP', balance: 8450000 },
  { id: 'usd', currency: 'USD', balance: -1240.5 },
] as Account[];
it('keeps native balances separate and selects the ledger through keyboard and pagination', () => {
  const onSelect = vi.fn();
  const view = render(
    <AccountBalanceHero ledgers={ledgers} selectedId='cop' onSelect={onSelect} />,
  );
  const hero = screen.getByRole('region', { name: 'balanceCurrency' });
  expect(screen.getByRole('button', { name: 'balanceCurrency: COP' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.keyDown(hero, { key: 'ArrowRight' });
  expect(onSelect).toHaveBeenLastCalledWith('usd');
  view.rerender(<AccountBalanceHero ledgers={ledgers} selectedId='usd' onSelect={onSelect} />);
  expect(screen.getByRole('button', { name: 'balanceCurrency: USD' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: 'balanceCurrency: COP' }));
  expect(onSelect).toHaveBeenLastCalledWith('cop');
  expect(hero).toHaveTextContent('-$1,240.5');
  expect(hero).toHaveTextContent('8,450,000');
});
it('does not invent navigation for a single ledger', () => {
  render(<AccountBalanceHero ledgers={ledgers.slice(0, 1)} selectedId='cop' onSelect={vi.fn()} />);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});
it('selects the native ledger after a horizontal swipe settles', () => {
  const onSelect = vi.fn();
  const view = render(
    <AccountBalanceHero ledgers={ledgers} selectedId='cop' onSelect={onSelect} />,
  );
  const track = view.container.querySelector('.snap-x') as HTMLDivElement;
  Object.defineProperties(track, { clientWidth: { value: 320 }, scrollLeft: { value: 320 } });
  fireEvent(track, new Event('scrollend', { bubbles: true }));
  expect(onSelect).toHaveBeenCalledWith('usd');
});
it('clamps overscroll and safely ignores an empty ledger collection', () => {
  const onSelect = vi.fn();
  const view = render(
    <AccountBalanceHero ledgers={ledgers} selectedId='cop' onSelect={onSelect} />,
  );
  const track = view.container.querySelector('.snap-x') as HTMLDivElement;
  Object.defineProperties(track, { clientWidth: { value: 320 }, scrollLeft: { value: 9999 } });
  fireEvent(track, new Event('scrollend', { bubbles: true }));
  expect(onSelect).toHaveBeenCalledWith('usd');
  view.rerender(<AccountBalanceHero ledgers={[]} selectedId='' onSelect={onSelect} />);
  fireEvent(track, new Event('scrollend', { bubbles: true }));
  expect(onSelect).toHaveBeenCalledTimes(1);
});
it('falls back to debounced scroll and cancels pending work on unmount', () => {
  vi.useFakeTimers();
  const onSelect = vi.fn();
  const view = render(
    <AccountBalanceHero ledgers={ledgers} selectedId='cop' onSelect={onSelect} />,
  );
  const track = view.container.querySelector('.snap-x') as HTMLDivElement;
  Object.defineProperties(track, { clientWidth: { value: 320 }, scrollLeft: { value: 320 } });
  fireEvent.scroll(track);
  vi.advanceTimersByTime(200);
  expect(onSelect).toHaveBeenCalledWith('usd');
  onSelect.mockClear();
  fireEvent.scroll(track);
  view.unmount();
  vi.advanceTimersByTime(200);
  expect(onSelect).not.toHaveBeenCalled();
  vi.useRealTimers();
});

it('realigns the selected slide after resize and ignores intermediate programmatic positions', () => {
  const onSelect = vi.fn();
  const view = render(
    <AccountBalanceHero ledgers={ledgers} selectedId='cop' onSelect={onSelect} />,
  );
  const track = view.container.querySelector('.snap-x') as HTMLDivElement;
  Object.defineProperties(track, {
    clientWidth: { value: 320, configurable: true },
    scrollLeft: { value: 0, writable: true },
  });
  view.rerender(<AccountBalanceHero ledgers={ledgers} selectedId='usd' onSelect={onSelect} />);
  fireEvent(track, new Event('scrollend', { bubbles: true }));
  expect(onSelect).not.toHaveBeenCalled();
  Object.defineProperty(track, 'clientWidth', { value: 390 });
  resize();
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 390, behavior: 'instant' });
  track.scrollLeft = 320;
  fireEvent(track, new Event('scrollend', { bubbles: true }));
  expect(onSelect).not.toHaveBeenCalled();
  track.scrollLeft = 390;
  fireEvent(track, new Event('scrollend', { bubbles: true }));
  expect(onSelect).not.toHaveBeenCalled();
});
it('keeps keyboard focus on the selected pagination control across eight ledgers', () => {
  const many = Array.from({ length: 8 }, (_, i) => ({
    ...ledgers[0],
    id: `ledger-${i}`,
    currency: ['COP', 'USD', 'EUR', 'GBP', 'BRL', 'CAD', 'JPY', 'MXN'][i],
  }));
  const onSelect = vi.fn();
  render(<AccountBalanceHero ledgers={many} selectedId='ledger-0' onSelect={onSelect} />);
  fireEvent.keyDown(screen.getByRole('region'), { key: 'End' });
  expect(onSelect).toHaveBeenCalledWith('ledger-7');
  expect(screen.getByRole('button', { name: 'balanceCurrency: MXN' })).toHaveFocus();
});
