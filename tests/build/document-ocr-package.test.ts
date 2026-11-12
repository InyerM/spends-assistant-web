import {
  existsSync,
  lstatSync,
  readFileSync,
  statSync,
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readlinkSync,
  symlinkSync,
  rmSync,
  realpathSync,
  readdirSync,
} from 'node:fs';
import { dirname, relative, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const tracePath = resolve('.next/server/app/api/documents/[id]/extract/route.js.nft.json');

// Run after the production build to check the actual function archive inputs.
describe.skipIf(!existsSync(tracePath))('built document OCR function package', () => {
  let files: string[] = [];
  let isolated: string;
  beforeAll(() => {
    const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as { files: string[] };
    files = trace.files.map((file) => resolve(dirname(tracePath), file));
    isolated = mkdtempSync(join(tmpdir(), 'anotto-ocr-package-test-'));
    for (const original of files) {
      const name = relative(process.cwd(), original);
      if (name.startsWith('..')) throw new Error('Function trace escapes project');
      const destination = join(isolated, name);
      mkdirSync(dirname(destination), { recursive: true });
      if (lstatSync(original).isSymbolicLink()) symlinkSync(readlinkSync(original), destination);
      else copyFileSync(original, destination);
    }
  });

  afterAll(() => {
    if (isolated) rmSync(isolated, { recursive: true, force: true });
  });

  it('never packages both a directory symlink and files below that symlink', () => {
    const conflicts = files
      .filter((file) => lstatSync(file).isSymbolicLink() && statSync(file).isDirectory())
      .filter((link) => files.some((file) => file.startsWith(`${link}/`)))
      .map((file) => relative(process.cwd(), file));
    expect(conflicts).toEqual([]);
  });

  it('resolves worker native package names entirely inside the isolated function archive', () => {
    const loadModule = createRequire(join(isolated, 'package.json'));
    for (const dependency of ['pdf-lib', 'sharp']) {
      const resolved = loadModule.resolve(dependency);
      expect(
        relative(realpathSync(isolated), realpathSync(resolved)).startsWith('..'),
        dependency,
      ).toBe(false);
    }
  });

  it('prepares synthetic PDF and PNG with the actual emitted worker and isolated dependencies', async () => {
    const chunks = resolve('.next/server/chunks');
    const chunk = readdirSync(chunks)
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFileSync(join(chunks, name), 'utf8'))
      .find((content) => content.includes('moduleRoot:process.cwd()'));
    const source = chunk?.match(/String\.raw`([\s\S]*?)`/)?.[1];
    if (!source) throw new Error('Missing emitted OCR worker');
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    for (const [mimeType, bytes] of [
      ['application/pdf', await pdf.save()],
      ['image/png', png],
    ] as const) {
      const reply = await new Promise<{ pages?: Array<{ pdfBase64: string }>; error?: string }>(
        (resolveReply, reject) => {
          const worker = new Worker(source, {
            eval: true,
            execArgv: [],
            env: { ...process.env, NODE_PATH: '' },
            workerData: { bytes, moduleRoot: isolated, mimeType },
            resourceLimits: {
              maxOldGenerationSizeMb: 128,
              maxYoungGenerationSizeMb: 32,
              stackSizeMb: 4,
            },
          });
          let settled = false;
          const timer = setTimeout(() => {
            settled = true;
            void worker.terminate();
            reject(new Error('Worker timeout'));
          }, 20000);
          worker.once(
            'message',
            (result: { pages?: Array<{ pdfBase64: string }>; error?: string }) => {
              settled = true;
              clearTimeout(timer);
              void worker.terminate();
              resolveReply(result);
            },
          );
          worker.once('error', (error) => {
            settled = true;
            clearTimeout(timer);
            void worker.terminate();
            reject(error);
          });
          worker.once('exit', () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(new Error('Worker exited before replying'));
            }
          });
        },
      );
      expect(reply.error, mimeType).toBeUndefined();
      expect(reply.pages, mimeType).toHaveLength(1);
      const page = reply.pages?.[0];
      if (!page) throw new Error('Missing prepared OCR page');
      expect((await PDFDocument.load(page.pdfBase64)).getPageCount()).toBe(1);
    }
  }, 45000);

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
