import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/api/server', () => ({
  getUserClient: vi.fn(),
  AuthError: class extends Error {},
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/pdf-text', () => ({
  readPdfText: vi.fn(),
  PdfTextError: class extends Error {
    constructor(public code: string) {
      super(code);
    }
  },
}));
import { getUserClient, AuthError } from '@/lib/api/server';
import { readPdfText } from '@/lib/pdf-text';
import { GET, POST } from '@/app/api/documents/[id]/inspect/route';
const id = '00000000-0000-4000-8000-000000000001';
const context = { params: Promise.resolve({ id }) };
const doc = {
  file_path: 'owner/example.pdf',
  mime_type: 'application/pdf',
  document_type: 'statement',
};
const download = vi.fn(),
  createSignedUrl = vi.fn(),
  eq = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  doc.file_path = 'owner/example.pdf';
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq,
    is: vi
      .fn()
      .mockResolvedValue({ data: [{ id: 'a', is_active: true, last_four: '2651' }], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: doc, error: null }),
  };
  eq.mockReturnValue(chain);
  vi.mocked(getUserClient).mockResolvedValue({
    userId: 'owner',
    supabase: {
      from: () => chain,
      storage: { from: () => ({ download, createSignedUrl }) },
    } as never,
  });
  download.mockResolvedValue({
    data: { arrayBuffer: async (): Promise<ArrayBuffer> => new ArrayBuffer(8) },
    error: null,
  });
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: 'https://example.com/short-lived.pdf' },
    error: null,
  });
  vi.mocked(readPdfText).mockResolvedValue({
    pages: ['Cuenta *2651\nPeriodo: 01/09/2026 al 30/09/2026'],
  });
});
it('uses owner-scoped storage, returns grounded suggestions, and never includes the password in results', async () => {
  const response = await POST(
    new Request('https://my.anotto.app/api/inspect', {
      method: 'POST',
      body: JSON.stringify({ password: 'example-key' }),
    }),
    context,
  );
  expect(response.status).toBe(200);
  expect(eq).toHaveBeenCalledWith('user_id', 'owner');
  expect(readPdfText).toHaveBeenCalledWith(expect.any(Uint8Array), 'example-key');
  const body = await response.text();
  expect(body).not.toContain('example-key');
  expect(JSON.parse(body).hints.account_id).toBe('a');
  expect(
    (await GET(new Request('https://my.anotto.app/api/inspect'), context)).headers.get(
      'Cache-Control',
    ),
  ).toBe('private, no-store');
  expect(createSignedUrl).toHaveBeenCalledWith('owner/example.pdf', 300);
});
it('rejects foreign storage paths and unauthenticated readers', async () => {
  doc.file_path = 'someone-else/example.pdf';
  expect((await GET(new Request('https://my.anotto.app/api/inspect'), context)).status).toBe(404);
  expect(createSignedUrl).not.toHaveBeenCalled();
  vi.mocked(getUserClient).mockRejectedValue(new AuthError('No session'));
  expect(
    (
      await POST(
        new Request('https://my.anotto.app/api/inspect', { method: 'POST', body: '{}' }),
        context,
      )
    ).status,
  ).toBe(401);
  expect(download).not.toHaveBeenCalled();
});
