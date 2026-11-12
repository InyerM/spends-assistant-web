import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  headers(): ReturnType<NonNullable<NextConfig['headers']>> {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]);
  },
  serverExternalPackages: ['pdfjs-dist', 'pdf-lib', 'sharp'],
  outputFileTracingIncludes: {
    '/api/documents/*/inspect': [
      './node_modules/pdfjs-dist/legacy/build/**',
      './node_modules/@napi-rs/canvas/**',
      './node_modules/.pnpm/@napi-rs+canvas-*/node_modules/@napi-rs/canvas-*/**',
    ],
    '/api/documents/*/extract': [
      './node_modules/sharp',
      './node_modules/pdfjs-dist/legacy/build/**',
      './node_modules/@napi-rs/canvas/**',
      './node_modules/.pnpm/@napi-rs+canvas-*/node_modules/@napi-rs/canvas-*/**',
    ],
  },
};

export default withNextIntl(nextConfig);
