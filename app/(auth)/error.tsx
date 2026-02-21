'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className='flex min-h-[50vh] flex-col items-center justify-center gap-4'>
      <h2 className='text-lg font-semibold'>Something went wrong</h2>
      <button
        onClick={reset}
        className='bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm'>
        Try again
      </button>
    </div>
  );
}
