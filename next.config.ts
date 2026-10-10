import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/documents/*/inspect': [
      './node_modules/pdfjs-dist/legacy/build/**',
      './node_modules/@napi-rs/canvas/**',
      './node_modules/.pnpm/@napi-rs+canvas-*/node_modules/@napi-rs/canvas-*/**',
    ],
    '/api/documents/*/extract': [
      './node_modules/pdfjs-dist/legacy/build/**',
      './node_modules/@napi-rs/canvas/**',
      './node_modules/.pnpm/@napi-rs+canvas-*/node_modules/@napi-rs/canvas-*/**',
    ],
  },
};

export default withNextIntl(nextConfig);
