import type * as WorkerThreads from 'node:worker_threads';
import type { WorkerOptions } from 'node:worker_threads';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { splitPdfForOcr } from '@/lib/pdf-ocr';

const { workerOptions } = vi.hoisted(() => ({ workerOptions: vi.fn() }));
vi.mock('node:worker_threads', async () => {
  const { createRequire } = await import('node:module');
  const actual = createRequire(import.meta.url)('node:worker_threads') as typeof WorkerThreads;
  const Worker = class extends actual.Worker {
    public constructor(source: string, options: WorkerOptions) {
      workerOptions(options);
      super(source, options);
    }
  };
  return { ...actual, Worker, default: { ...actual, Worker } };
});

describe('production-safe OCR worker module contract', () => {
  it('passes only a filesystem search root so the worker resolves native packages outside the bundler', async () => {
    const document = await PDFDocument.create();
    document.addPage();
    const prepared = await splitPdfForOcr(await document.save());
    expect(prepared.pages).toHaveLength(1);
    expect(workerOptions).toHaveBeenCalledTimes(1);
    const options = workerOptions.mock.calls[0][0] as { workerData: Record<string, unknown> };
    expect(Object.keys(options.workerData).sort()).toEqual(['bytes', 'mimeType', 'moduleRoot']);
    expect(options.workerData.moduleRoot).toBe(process.cwd());
    expect(options.workerData.mimeType).toBe('application/pdf');
  });
});
