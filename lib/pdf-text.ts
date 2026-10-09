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
      let text = ''; let lastY;
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue;
        const y = item.transform?.[5];
        if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 2) text += '\n';
        text += item.str + (item.hasEOL ? '\n' : ' '); lastY = y;
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
