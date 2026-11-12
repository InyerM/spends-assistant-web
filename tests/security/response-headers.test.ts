import { expect, it } from 'vitest';
import config from '@/next.config';
it('sets compatible framing, MIME and reference headers without blocking resource loading', async () => {
  const entries = await config.headers?.();
  const headers = entries?.find((entry) => entry.source === '/:path*')?.headers;
  expect(headers).toEqual(
    expect.arrayContaining([
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ]),
  );
  expect(headers?.find((header) => header.key === 'Content-Security-Policy')?.value).not.toMatch(
    /(?:default|script|font|connect|frame)-src|sandbox/,
  );
});
