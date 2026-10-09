import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPdfText, PdfTextError } from '@/lib/pdf-text';
function samplePdf(text: string, pageCount = 1): Uint8Array {
  const stream = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array(pageCount).fill('3 0 R').join(' ')}] /Count ${pageCount} >>`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600000 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
// Allow the parser's 20-second worker limit to report its own bounded failure under load.
describe('isolated local PDF text extraction', { timeout: 25_000 }, () => {
  it('reads text from the original PDF without external network requests', async () => {
    const result = await readPdfText(samplePdf('Bancolombia COP Compra 42000'));
    expect(result.pages).toEqual(['Bancolombia COP Compra 42000']);
  });
  it('rejects empty/image-only PDFs instead of reporting an empty successful statement', async () => {
    await expect(readPdfText(samplePdf(''))).rejects.toMatchObject({ code: 'PDF_NO_TEXT' });
  });
  it('handles protected PDFs locally and rejects an incorrect password', async () => {
    // Generated synthetic fixture with the non-secret password below; no personal records.
    const bytes = new Uint8Array(readFileSync('tests/fixtures/documents/encrypted-synthetic.pdf'));
    await expect(readPdfText(bytes)).rejects.toMatchObject({ code: 'PDF_PASSWORD_REQUIRED' });
    await expect(readPdfText(bytes, 'wrong')).rejects.toMatchObject({
      code: 'PDF_PASSWORD_INCORRECT',
    });
    expect((await readPdfText(bytes, 'test-password')).pages[0]).toContain('Synthetic Bancolombia');
  });
  it('rejects page and decompressed text overflow instead of silently truncating', async () => {
    await expect(readPdfText(samplePdf('Bancolombia COP Compra 42000', 11))).rejects.toMatchObject({
      code: 'PDF_LIMIT_EXCEEDED',
    });
    await expect(readPdfText(samplePdf('A'.repeat(20001)))).rejects.toMatchObject({
      code: 'PDF_LIMIT_EXCEEDED',
    });
    await expect(readPdfText(samplePdf('A'.repeat(15000), 3))).rejects.toMatchObject({
      code: 'PDF_LIMIT_EXCEEDED',
    });
  });
  it('rejects non-PDF or oversized bytes before starting parsing', async () => {
    await expect(readPdfText(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(PdfTextError);
    await expect(readPdfText(new Uint8Array(5 * 1024 * 1024 + 1))).rejects.toMatchObject({
      code: 'PDF_TOO_LARGE',
    });
  });
});
