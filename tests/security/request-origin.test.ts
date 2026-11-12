import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasSameRequestOrigin } from '@/lib/api/request-origin';

afterEach(() => vi.unstubAllEnvs());
describe('exact mutation request origin', () => {
  it.each(['https://app.example.test', 'https://APP.EXAMPLE.TEST:443'])(
    'accepts equivalent origin %s',
    (origin) => {
      expect(
        hasSameRequestOrigin(
          new Request('https://app.example.test/api/accounts', { headers: { Origin: origin } }),
        ),
      ).toBe(true);
    },
  );
  it.each([
    undefined,
    'null',
    'https://sibling.example.test',
    'https://app.example.test.evil.test',
    'http://app.example.test',
    'https://app.example.test:444',
    'https://app.example.test/path',
    'https://app.example.test?query=1',
    'https://app.example.test#fragment',
    'https://user@app.example.test',
    'https://app.example.test, https://evil.test',
  ])('rejects invalid or foreign source %s', (origin) => {
    const headers = new Headers();
    if (origin !== undefined) headers.set('Origin', origin);
    expect(
      hasSameRequestOrigin(new Request('https://app.example.test/api/accounts', { headers })),
    ).toBe(false);
  });
  it('does not trust a production Host or forwarded header to redefine the target', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(
      hasSameRequestOrigin(
        new Request('https://app.example.test/api/accounts', {
          headers: {
            Origin: 'https://evil.test',
            Host: 'evil.test',
            Forwarded: 'host=evil.test',
            'X-Forwarded-Host': 'evil.test',
          },
        }),
      ),
    ).toBe(false);
  });
  it.each(['development', 'production'])(
    'keeps explicit loopback listener normalization in %s',
    (mode) => {
      vi.stubEnv('NODE_ENV', mode);
      expect(
        hasSameRequestOrigin(
          new Request('http://localhost/api/accounts', {
            headers: { Origin: 'http://127.0.0.1:3027', Host: '127.0.0.1:3027' },
          }),
        ),
      ).toBe(true);
      expect(
        hasSameRequestOrigin(
          new Request('http://localhost/api/accounts', {
            headers: { Origin: 'http://evil.test', Host: 'evil.test' },
          }),
        ),
      ).toBe(false);
    },
  );
});
