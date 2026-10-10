import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MAX_DOCUMENT_BYTES } from '@/lib/documents';

export type PdfTextErrorCode =
  | 'PDF_PASSWORD_REQUIRED'
  | 'PDF_PASSWORD_INCORRECT'
  | 'PDF_NO_TEXT'
  | 'PDF_TOO_LARGE'
  | 'PDF_LIMIT_EXCEEDED'
  | 'PDF_UNSUPPORTED'
  | 'PDF_TIMEOUT';
export class PdfTextError extends Error {
  public constructor(public readonly code: PdfTextErrorCode) {
    super(code);
    this.name = 'PdfTextError';
  }
}
interface PdfTextResult {
  pages: string[];
}
interface WorkerReply {
  pages?: string[];
  error?: PdfTextErrorCode;
}

// This fixed program parses bytes only. PDF scripts, forms and actions are never executed.
const workerSource = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  let task;
  try {
    const { getDocument } = await import(workerData.moduleUrl);
    task = getDocument({ data: new Uint8Array(workerData.bytes), password: workerData.password,
      isEvalSupported: false, disableFontFace: true, enableXfa: false, useWasm: false,
      useWorkerFetch: false, stopAtErrors: true, verbosity: 0, maxImageSize: 0 });
    const pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > 10) throw { code: 'PDF_LIMIT_EXCEEDED' };
    const pages = []; let total = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const positioned = content.items.filter(item => typeof item.str === 'string').map((item, index) => ({ item, index, x: item.transform?.[4] ?? 0, y: item.transform?.[5] ?? 0 }));
      positioned.sort((a, b) => b.y - a.y || a.x - b.x || a.index - b.index);
      const rows = [];
      for (const entry of positioned) {
        const row = rows[rows.length - 1];
        if (row && Math.abs(row.y - entry.y) <= 2) row.items.push(entry);
        else rows.push({ y: entry.y, items: [entry] });
      }
      let text = '';
      for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x || a.index - b.index);
        let line = ''; let previous;
        for (const entry of row.items) {
          const fragment = entry.item.str;
          const gap = previous ? entry.x - previous.x - (previous.item.width ?? 0) : Infinity;
          const numericContinuation = /[0-9.,]$/.test(line) && /^[0-9.,]+$/.test(fragment) && gap <= 2 && gap >= -1;
          line += (line && !numericContinuation ? ' ' : '') + fragment;
          previous = entry;
        }
        if (line.trim()) text += line.trim() + '\n';
        if (text.length > 20000) throw { code: 'PDF_LIMIT_EXCEEDED' };
      }
      text = text.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
      total += text.length;
      if (total > 40000) throw { code: 'PDF_LIMIT_EXCEEDED' };
      if (text.length < 20) throw { code: 'PDF_NO_TEXT' };
      pages.push(text); page.cleanup();
    }
    parentPort.postMessage({ pages });
  } catch (error) {
    const code = error?.name === 'PasswordException'
      ? (error.code === 2 ? 'PDF_PASSWORD_INCORRECT' : 'PDF_PASSWORD_REQUIRED')
      : ['PDF_LIMIT_EXCEEDED','PDF_NO_TEXT'].includes(error?.code) ? error.code : 'PDF_UNSUPPORTED';
    parentPort.postMessage({ error: code });
  } finally { if (task) await task.destroy().catch(() => {}); }
})().catch(() => parentPort.postMessage({ error: 'PDF_UNSUPPORTED' }));
`;

/** Local parsing is isolated so malformed/compressed PDFs cannot monopolize the request process. */
export async function readPdfText(bytes: Uint8Array, password?: string): Promise<PdfTextResult> {
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new PdfTextError('PDF_TOO_LARGE');
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-')
    throw new PdfTextError('PDF_UNSUPPORTED');
  const moduleUrl = pathToFileURL(
    join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.mjs'),
  ).href;
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(workerSource, {
      eval: true,
      execArgv: [],
      workerData: { bytes, password, moduleUrl },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    const finish = (reply: WorkerReply): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      if (reply.error) reject(new PdfTextError(reply.error));
      else if (reply.pages) resolve({ pages: reply.pages });
      else reject(new PdfTextError('PDF_UNSUPPORTED'));
    };
    const timeout = setTimeout(() => finish({ error: 'PDF_TIMEOUT' }), 20_000);
    worker.once('message', finish);
    worker.once('error', () => finish({ error: 'PDF_UNSUPPORTED' }));
    worker.once('exit', () => {
      if (!settled) finish({ error: 'PDF_UNSUPPORTED' });
    });
  });
}
