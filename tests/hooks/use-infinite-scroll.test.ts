import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import React from 'react';

// Store the IntersectionObserver callback so we can trigger it in tests
let observerCallback: IntersectionObserverCallback | null = null;
let observerDisconnect: ReturnType<typeof vi.fn>;
let observerObserve: ReturnType<typeof vi.fn>;

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe = observerObserve;
  disconnect = observerDisconnect;
  unobserve = vi.fn();
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [] as number[];
  takeRecords = vi.fn().mockReturnValue([]);
}

beforeEach(() => {
  observerCallback = null;
  observerDisconnect = vi.fn();
  observerObserve = vi.fn();

  // Re-assign instance methods since they're per-instance via class fields
  MockIntersectionObserver.prototype.observe = observerObserve;
  MockIntersectionObserver.prototype.disconnect = observerDisconnect;

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWithSentinel(opts: {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}) {
  // Use a component that renders the sentinel div with the ref
  function TestComponent() {
    const ref = useInfiniteScroll(opts);
    return React.createElement('div', { ref, 'data-testid': 'sentinel' });
  }

  return renderHook(() => null, {
    wrapper: ({ children }) =>
      React.createElement(React.Fragment, null, React.createElement(TestComponent), children),
  });
}

describe('useInfiniteScroll', () => {
  it('returns a ref object', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll({
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
      }),
    );
    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('current');
  });

  it('creates an IntersectionObserver when ref is attached to an element', () => {
    const fetchNextPage = vi.fn();
    renderWithSentinel({ fetchNextPage, hasNextPage: true, isFetchingNextPage: false });

    expect(observerCallback).not.toBeNull();
    expect(observerObserve).toHaveBeenCalledTimes(1);
  });

  it('calls fetchNextPage when sentinel is intersecting and hasNextPage is true', () => {
    const fetchNextPage = vi.fn();
    renderWithSentinel({ fetchNextPage, hasNextPage: true, isFetchingNextPage: false });

    expect(observerCallback).not.toBeNull();
    observerCallback!(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not call fetchNextPage when isIntersecting is false', () => {
    const fetchNextPage = vi.fn();
    renderWithSentinel({ fetchNextPage, hasNextPage: true, isFetchingNextPage: false });

    observerCallback!(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('does not call fetchNextPage when hasNextPage is false', () => {
    const fetchNextPage = vi.fn();
    renderWithSentinel({ fetchNextPage, hasNextPage: false, isFetchingNextPage: false });

    observerCallback!(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('does not call fetchNextPage when isFetchingNextPage is true', () => {
    const fetchNextPage = vi.fn();
    renderWithSentinel({ fetchNextPage, hasNextPage: true, isFetchingNextPage: true });

    observerCallback!(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('disconnects the observer on unmount', () => {
    const fetchNextPage = vi.fn();
    const { unmount } = renderWithSentinel({
      fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
    });

    unmount();

    expect(observerDisconnect).toHaveBeenCalled();
  });
});
