import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { MAX_DOCUMENT_BYTES } from '@/lib/documents';

export class PdfOcrError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'PdfOcrError';
  }
}

export interface OcrPage {
  pageNumber: number;
  pdfBase64: string;
  sha256: string;
}
export interface PreparedOcrPdf {
  sourceSha256: string;
  pages: OcrPage[];
}

// Isolated parsing never evaluates PDF actions, JavaScript, or network resources.
const source = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { createHash } = require('node:crypto');
(async () => {
  try {
    const { PDFDocument, PDFName, PDFDict, PDFArray } = require(workerData.modulePath);
    let pdf;
    if (workerData.mimeType === 'application/pdf') {
      pdf = await PDFDocument.load(workerData.bytes, { updateMetadata: false, throwOnInvalidObject: true });
    } else {
      const sharp = require(workerData.sharpPath);
      const image = sharp(Buffer.from(workerData.bytes), {limitInputPixels:16000000, sequentialRead:true, failOn:'warning'});
      const metadata = await image.metadata();
      const expected = {'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'}[workerData.mimeType];
      if (!expected || metadata.format !== expected || (metadata.pages ?? 1) !== 1) throw {code:'PDF_UNSUPPORTED'};
      const canonical = await image.rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).flatten({background:'#ffffff'}).jpeg({quality:85}).timeout({seconds:10}).toBuffer();
      pdf = await PDFDocument.create();
      const embedded = await pdf.embedJpg(canonical);
      const page = pdf.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded,{x:0,y:0,width:embedded.width,height:embedded.height});
    }
    if (pdf.isEncrypted) throw { code: 'PDF_OCR_ENCRYPTED' };
    const count = pdf.getPageCount();
    if (count < 1 || count > 5) throw { code: 'PDF_LIMIT_EXCEEDED' };
    const pages = []; let total = 0;
    for (let index = 0; index < count; index++) {
      const sourcePage = pdf.getPage(index);
      const allowedPageKeys = new Set(['Type','Parent','Resources','MediaBox','CropBox','BleedBox','TrimBox','ArtBox','Rotate','Contents','UserUnit','Group']);
      for (const key of sourcePage.node.keys()) {
        if (!allowedPageKeys.has(key.decodeText())) sourcePage.node.delete(key);
      }
      const pagePdf = await PDFDocument.create();
      const [page] = await pagePdf.copyPages(pdf, [index]);
      pagePdf.addPage(page);
      let copiedPages = 0;
      const visited = new Set();
      const inspect = (object) => {
        if (!object || visited.has(object)) return;
        visited.add(object);
        if (object instanceof PDFArray) { for (const child of object.asArray()) inspect(child); return; }
        const dictionary = object instanceof PDFDict ? object : object.dict;
        if (!(dictionary instanceof PDFDict)) return;
        if (dictionary !== object && visited.has(dictionary)) return;
        visited.add(dictionary);
        const type = dictionary.get(PDFName.of('Type'))?.toString();
        if (type === '/Page') copiedPages++;
        if (['/EmbeddedFile','/Filespec','/Annot'].includes(type) || ['EF','JS','JavaScript','AA','OpenAction','Launch'].some(key => dictionary.has(PDFName.of(key)))) throw {code:'PDF_UNSUPPORTED'};
        for (const child of dictionary.values()) inspect(child);
      };
      for (const [, object] of pagePdf.context.enumerateIndirectObjects()) inspect(object);
      if (copiedPages !== 1) throw {code:'PDF_UNSUPPORTED'};
      const bytes = await pagePdf.save({ useObjectStreams: false });
      total += bytes.length;
      if (bytes.length > 1048576 || total > 5242880) throw { code: 'PDF_LIMIT_EXCEEDED' };
      pages.push({ pageNumber: index + 1, pdfBase64: Buffer.from(bytes).toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    parentPort.postMessage({ pages });
  } catch (error) {
    const code = error?.message?.includes('encrypted') ? 'PDF_OCR_ENCRYPTED' : ['PDF_OCR_ENCRYPTED', 'PDF_LIMIT_EXCEEDED'].includes(error?.code) ? error.code : 'PDF_UNSUPPORTED';
    parentPort.postMessage({ error: code });
  }
})();
`;

export async function splitPdfForOcr(input: Uint8Array): Promise<PreparedOcrPdf> {
  return prepareOcrDocument(input, 'application/pdf');
}

export async function prepareImageForOcr(
  input: Uint8Array,
  mimeType: string,
): Promise<PreparedOcrPdf> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType))
    throw new PdfOcrError('PDF_UNSUPPORTED');
  return prepareOcrDocument(input, mimeType);
}

async function prepareOcrDocument(input: Uint8Array, mimeType: string): Promise<PreparedOcrPdf> {
  if (input.length > MAX_DOCUMENT_BYTES) throw new PdfOcrError('PDF_TOO_LARGE');
  if (
    input.length === 0 ||
    (mimeType === 'application/pdf' && Buffer.from(input.subarray(0, 5)).toString() !== '%PDF-')
  )
    throw new PdfOcrError('PDF_UNSUPPORTED');
  const bytes = Uint8Array.from(input);
  const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
  const requireModule = createRequire(import.meta.url);
  const modulePath = requireModule.resolve('pdf-lib');
  const sharpPath = mimeType === 'application/pdf' ? null : requireModule.resolve('sharp');
  return new Promise((resolve, reject) => {
    const worker = new Worker(source, {
      eval: true,
      execArgv: [],
      workerData: { bytes, modulePath, mimeType, sharpPath },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (reply: { pages?: OcrPage[]; error?: string }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      if (reply.pages) resolve({ sourceSha256, pages: reply.pages });
      else reject(new PdfOcrError(reply.error ?? 'PDF_UNSUPPORTED'));
    };
    const timeout = setTimeout(() => finish({ error: 'PDF_TIMEOUT' }), 20_000);
    worker.once('message', finish);
    worker.once('error', () => finish({ error: 'PDF_UNSUPPORTED' }));
    worker.once('exit', () => finish({ error: 'PDF_UNSUPPORTED' }));
  });
}
