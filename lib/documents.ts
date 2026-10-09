import { z } from 'zod';

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  'image/png': (b) => [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v),
  'image/jpeg': (b) => b[0] === 255 && b[1] === 216 && b[2] === 255,
  'image/webp': (b) =>
    String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
};

export function validateDocumentImage(
  name: string,
  mimeType: string,
  bytes: Uint8Array,
): string | null {
  if (!name.trim() || !Object.hasOwn(signatures, mimeType))
    return 'Choose a PNG, JPEG, or WebP image';
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) return 'Image must be 5 MB or less';
  if (!signatures[mimeType](bytes)) return 'Image content does not match its type';
  return null;
}

export function validateDocumentFile(
  name: string,
  mimeType: string,
  bytes: Uint8Array,
): string | null {
  if (mimeType !== 'application/pdf') return validateDocumentImage(name, mimeType, bytes);
  if (!name.trim() || name.length > 255 || !name.toLowerCase().endsWith('.pdf'))
    return 'Choose a valid PDF document';
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES)
    return 'Document must be 5 MB or less';
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-')
    return 'PDF content does not match its type';
  return null;
}

const observationSchema = z.object({
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  occurred_at: z.string().nullable(),
  description: z.string(),
  counterparty: z.string().nullable(),
  reference: z.string().nullable(),
  source_excerpt: z.string(),
  confidence: z.number().min(0).max(1),
});

const extractionSchema = z.object({
  draft: z.object({
    document_type: z.enum(['receipt', 'bank_screenshot', 'sms_screenshot', 'statement', 'other']),
    observations: z.array(observationSchema).max(500),
  }),
  model: z.string(),
  usage: z.unknown(),
});

export type Extraction = z.infer<typeof extractionSchema>;

export function parseExtraction(value: unknown): Extraction | null {
  const parsed = extractionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
