import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { splitPdfForOcr, prepareImageForOcr } from '@/lib/pdf-ocr';

async function pdf(pages: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let i = 0; i < pages; i++) document.addPage([600, 800]);
  return document.save();
}

describe('trusted bounded PDF OCR preparation', { timeout: 25_000 }, () => {
  it('assigns original page provenance and hashes actual independent single-page bytes', async () => {
    const bytes = await pdf(2);
    const result = await splitPdfForOcr(bytes);
    expect(result.sourceSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2]);
    for (const page of result.pages) {
      const single = Buffer.from(page.pdfBase64, 'base64');
      expect((await PDFDocument.load(page.pdfBase64)).getPageCount()).toBe(1);
      expect(page.sha256).toBe(createHash('sha256').update(single).digest('hex'));
    }
  });
  it('strips page annotations before copying so links and attachments cannot include other pages', async () => {
    const document = await PDFDocument.create();
    const first = document.addPage();
    const second = document.addPage();
    const embedded = document.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Dest: [second.ref, 'Fit'],
      Contents: PDFString.of('SENSITIVE_OTHER_PAGE'),
    });
    first.node.set(
      PDFName.of('Annots'),
      document.context.obj([document.context.register(embedded)]),
    );
    const result = await splitPdfForOcr(await document.save());
    const serialized = Buffer.from(result.pages[0].pdfBase64, 'base64').toString('latin1');
    expect(serialized).not.toContain('SENSITIVE_OTHER_PAGE');
    expect(serialized).not.toContain('/Annots');
    const page = await PDFDocument.load(result.pages[0].pdfBase64);
    expect(page.getPageCount()).toBe(1);
  });
  it('rejects nonvisual resource references that would copy a hidden original page', async () => {
    const document = await PDFDocument.create();
    const first = document.addPage();
    const second = document.addPage();
    first.node.set(PDFName.of('Resources'), document.context.obj({ HiddenPage: second.ref }));
    await expect(splitPdfForOcr(await document.save())).rejects.toMatchObject({
      code: 'PDF_UNSUPPORTED',
    });
  });
  it('rejects executable markers nested inside inline page resource dictionaries', async () => {
    const document = await PDFDocument.create();
    const page = document.addPage();
    page.node.set(
      PDFName.of('Resources'),
      document.context.obj({ Properties: { Unsafe: { JS: PDFString.of('unsafe') } } }),
    );
    await expect(splitPdfForOcr(await document.save())).rejects.toMatchObject({
      code: 'PDF_UNSUPPORTED',
    });
  });
  it('rejects encrypted originals without accepting or forwarding a password', async () => {
    const bytes = readFileSync('tests/fixtures/documents/encrypted-synthetic.pdf');
    await expect(splitPdfForOcr(bytes)).rejects.toMatchObject({ code: 'PDF_OCR_ENCRYPTED' });
  });
  it('rejects page overflow, malformed input and oversized originals', async () => {
    await expect(splitPdfForOcr(await pdf(6))).rejects.toMatchObject({
      code: 'PDF_LIMIT_EXCEEDED',
    });
    await expect(splitPdfForOcr(new TextEncoder().encode('%PDF-broken'))).rejects.toMatchObject({
      code: 'PDF_UNSUPPORTED',
    });
    await expect(splitPdfForOcr(new Uint8Array(5 * 1024 * 1024 + 1))).rejects.toMatchObject({
      code: 'PDF_TOO_LARGE',
    });
  });
});

it('canonicalizes a synthetic PNG into a one-page PDF with original-byte hash', async () => {
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
  const result = await prepareImageForOcr(png, 'image/png');
  expect(result.sourceSha256).toBe(createHash('sha256').update(png).digest('hex'));
  expect((await PDFDocument.load(result.pages[0].pdfBase64)).getPageCount()).toBe(1);
});

it('canonicalizes JPEG and WebP and rejects MIME mismatch and oversized decoded images', async () => {
  const image = sharp({ create: { width: 30, height: 20, channels: 3, background: '#ffffff' } });
  for (const [mime, bytes] of [
    ['image/jpeg', await image.clone().jpeg().toBuffer()],
    ['image/webp', await image.clone().webp().toBuffer()],
  ] as const) {
    const result = await prepareImageForOcr(bytes, mime);
    expect((await PDFDocument.load(result.pages[0].pdfBase64)).getPageCount()).toBe(1);
  }
  const png = await image.png().toBuffer();
  await expect(prepareImageForOcr(png, 'image/jpeg')).rejects.toMatchObject({
    code: 'PDF_UNSUPPORTED',
  });
  const oversized = await sharp({
    create: { width: 4100, height: 4100, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
  await expect(prepareImageForOcr(oversized, 'image/png')).rejects.toMatchObject({
    code: 'PDF_UNSUPPORTED',
  });
});
