import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const tracePath = resolve('.next/server/app/api/documents/[id]/extract/route.js.nft.json');

// Run after the production build to check the actual function archive inputs.
describe.skipIf(!existsSync(tracePath))('built document OCR function package', () => {
  let files: string[] = [];
  beforeAll(() => {
    const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as { files: string[] };
    files = trace.files.map((file) => resolve(dirname(tracePath), file));
  });

  it('never packages both a directory symlink and files below that symlink', () => {
    const conflicts = files
      .filter((file) => lstatSync(file).isSymbolicLink() && statSync(file).isDirectory())
      .filter((link) => files.some((file) => file.startsWith(`${link}/`)))
      .map((file) => relative(process.cwd(), file));
    expect(conflicts).toEqual([]);
  });

  it('retains the PDF, image and native runtime dependency files', () => {
    for (const dependency of [
      'pdf-lib',
      '@pdf-lib/standard-fonts',
      '@pdf-lib/upng',
      'pako',
      'tslib',
      'sharp',
      'detect-libc',
      'semver',
      '@img/colour',
    ]) {
      expect(
        files.some((file) => file.includes(`/node_modules/${dependency}/`)),
        dependency,
      ).toBe(true);
    }
    expect(files.some((file) => /sharp-[^/]+\.node$/.test(file))).toBe(true);
    expect(files.some((file) => /libvips[^/]*\.(?:so[^/]*|dylib|dll)$/.test(file))).toBe(true);
  });
});
