import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { readPdfText, PdfTextError } from '@/lib/pdf-text';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/documents/[id]/extract/route';

const { getUserClient, getAdminClient, fetchMock, documentQuery, download, rpc, adminRpc } =
  vi.hoisted(() => ({
    getUserClient: vi.fn(),
    getAdminClient: vi.fn(),
    fetchMock: vi.fn(),
    documentQuery: vi.fn(),
    download: vi.fn(),
    rpc: vi.fn(),
    adminRpc: vi.fn(),
  }));

vi.mock('@/lib/api/server', () => ({
  getUserClient,
  getAdminClient,
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));
vi.mock('@/lib/pdf-text', () => ({
  readPdfText: vi.fn(),
  PdfTextError: class PdfTextError extends Error {
    constructor(public code: string) {
      super(code);
    }
  },
}));
vi.mock('@/lib/config', () => ({ workerConfig: { url: 'https://worker.test' } }));

describe('POST /api/documents/[id]/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DOCUMENT_PDF_OCR_ENABLED', 'false');
    vi.stubEnv('DOCUMENT_PDF_OCR_PROXY_SECRET', '');
    vi.stubGlobal('fetch', fetchMock);
    documentQuery.mockResolvedValue({
      data: {
        id: 'doc-1',
        file_path: 'user-1/image.png',
        mime_type: 'image/png',
        status: 'uploaded',
      },
      error: null,
    });
    download.mockResolvedValue({
      data: { arrayBuffer: async () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer },
      error: null,
    });
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'claim_document_extraction'
          ? { data: '11111111-1111-4111-8111-111111111111', error: null }
          : { data: 1, error: null },
      ),
    );
    adminRpc.mockResolvedValue({ data: 1, error: null });
    getAdminClient.mockReturnValue({ rpc: adminRpc });
    getUserClient.mockResolvedValue({
      userId: 'user-1',
      supabase: {
        auth: { getSession: async () => ({ data: { session: { access_token: 'jwt-1' } } }) },
        storage: { from: () => ({ download }) },
        rpc,
        from: () => ({
          select: () => ({ eq: () => ({ eq: () => ({ single: documentQuery }) }) }),
        }),
      },
    });
  });

  it('locally splits private PDF pages and completes review drafts with original page provenance', async () => {
    vi.stubEnv('DOCUMENT_PDF_OCR_ENABLED', 'true');
    vi.stubEnv('DOCUMENT_PDF_OCR_PROXY_SECRET', 'local-test-proxy-secret');
    documentQuery.mockResolvedValueOnce({
      data: { file_path: 'user-1/statement.pdf', mime_type: 'application/pdf', status: 'uploaded' },
    });
    const pdf = await PDFDocument.create();
    pdf.addPage([600, 800]);
    pdf.addPage([600, 800]);
    const bytes = await pdf.save();
    download.mockResolvedValueOnce({
      data: { arrayBuffer: async () => bytes.buffer },
      error: null,
    });
    const observation = {
      amount: -12,
      currency: 'USD',
      occurred_at: '2026-11-12',
      description: 'Synthetic purchase',
      counterparty: null,
      reference: null,
      source_excerpt: 'Synthetic purchase 12',
      confidence: 0.8,
      source_page: 2,
    };
    fetchMock.mockResolvedValueOnce(
      Response.json({
        draft: { document_type: 'statement', observations: [observation] },
        model: 'deepseek/deepseek-v3.2',
        pageCount: 2,
        pathway: 'cloud-pdf-mistral-ocr',
        requiresReview: true,
      }),
    );
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ strategy: 'mistral_ocr' }),
      }) as never,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://worker.test/documents/extract-pdf-ocr');
    expect(init.headers['X-Document-OCR-Proxy-Secret']).toBe('local-test-proxy-secret');
    const payload = JSON.parse(String(init.body)) as {
      pages: { pageNumber: number; pdfBase64: string }[];
      documentId: string;
      claimToken: string;
      sourceSha256: string;
      password?: string;
    };
    expect(payload.pages.map((page: { pageNumber: number }) => page.pageNumber)).toEqual([1, 2]);
    expect(payload.documentId).toBe('doc-1');
    expect(payload.claimToken).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload.password).toBeUndefined();
    for (const page of payload.pages)
      expect((await PDFDocument.load(page.pdfBase64)).getPageCount()).toBe(1);
    expect(readPdfText).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith(
      'complete_document_extraction_server',
      expect.objectContaining({
        p_page_count: 2,
        p_source_sha256: payload.sourceSha256,
        p_pathway: 'cloud-pdf-mistral-ocr',
        p_observations: [expect.objectContaining({ source_page: 2 })],
      }),
    );
  });
  it('sends a canonical image PDF through optional OCR and preserves receipt classification', async () => {
    vi.stubEnv('DOCUMENT_PDF_OCR_ENABLED', 'true');
    vi.stubEnv('DOCUMENT_PDF_OCR_PROXY_SECRET', 'test-secret');
    const bytes = await sharp({
      create: { width: 30, height: 20, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    download.mockResolvedValueOnce({
      data: { arrayBuffer: async () => Uint8Array.from(bytes).buffer },
      error: null,
    });
    fetchMock.mockResolvedValueOnce(
      Response.json({
        draft: { document_type: 'receipt', observations: [] },
        model: 'deepseek/deepseek-v3.2',
        pageCount: 1,
        pathway: 'cloud-pdf-mistral-ocr',
        requiresReview: true,
      }),
    );
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ strategy: 'mistral_ocr' }),
      }) as never,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(200);
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as {
      pages: { pdfBase64: string }[];
    };
    expect(payload.pages).toHaveLength(1);
    expect((await PDFDocument.load(payload.pages[0].pdfBase64)).getPageCount()).toBe(1);
    expect(adminRpc).toHaveBeenCalledWith(
      'complete_document_extraction_server',
      expect.objectContaining({ p_document_type: 'receipt', p_page_count: 1 }),
    );
  });
  it('rejects OCR password input before reading or claiming an original', async () => {
    vi.stubEnv('DOCUMENT_PDF_OCR_ENABLED', 'true');
    vi.stubEnv('DOCUMENT_PDF_OCR_PROXY_SECRET', 'local-test-proxy-secret');
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ strategy: 'mistral_ocr', password: 'private' }),
      }) as never,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('preserves an allowlisted OCR budget error without saving drafts', async () => {
    vi.stubEnv('DOCUMENT_PDF_OCR_ENABLED', 'true');
    vi.stubEnv('DOCUMENT_PDF_OCR_PROXY_SECRET', 'local-test-proxy-secret');
    documentQuery.mockResolvedValueOnce({
      data: { file_path: 'user-1/statement.pdf', mime_type: 'application/pdf', status: 'uploaded' },
    });
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    download.mockResolvedValueOnce({
      data: { arrayBuffer: async () => bytes.buffer },
      error: null,
    });
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { code: 'CLOUD_PDF_BUDGET_EXCEEDED', error: 'sensitive upstream body' },
        { status: 429 },
      ),
    );
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ strategy: 'mistral_ocr' }),
      }) as never,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      code: 'CLOUD_PDF_BUDGET_EXCEEDED',
      error: 'Optional PDF OCR failed',
    });
    expect(adminRpc).not.toHaveBeenCalledWith(
      'complete_document_extraction_server',
      expect.anything(),
    );
  });
  it('blocks explicit cloud OCR when capability is disabled before claiming or dispatching', async () => {
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ strategy: 'mistral_ocr' }),
      }) as never,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects unknown strategies rather than treating them as local extraction', async () => {
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ strategy: 'other' }),
      }) as never,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('parses the owner PDF locally and forwards only extracted text to the Worker', async () => {
    documentQuery.mockResolvedValueOnce({
      data: {
        id: 'doc-1',
        file_path: 'user-1/statement.pdf',
        mime_type: 'application/pdf',
        status: 'uploaded',
      },
      error: null,
    });
    vi.mocked(readPdfText).mockResolvedValueOnce({ pages: ['Bancolombia COP 42000'] });
    fetchMock.mockResolvedValueOnce(
      Response.json({
        draft: { document_type: 'statement', observations: [] },
        model: 'nano',
        usage: null,
      }),
    );
    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ password: 'synthetic-test-password' }),
      }) as never,
      { params: Promise.resolve({ id: 'doc-1' }) },
    );
    expect(response.status).toBe(200);
    expect(readPdfText).toHaveBeenCalledWith(expect.any(Buffer), 'synthetic-test-password');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://worker.test/documents/extract-text');
    expect(JSON.parse(String(init.body))).toEqual({ pages: ['Bancolombia COP 42000'] });
    expect(String(init.body)).not.toContain('password');
    expect(adminRpc).toHaveBeenCalledWith(
      'complete_document_extraction_server',
      expect.objectContaining({ p_document_type: 'statement' }),
    );
  });
  it('returns a password-required code without any upstream AI request', async () => {
    documentQuery.mockResolvedValueOnce({
      data: {
        id: 'doc-1',
        file_path: 'user-1/statement.pdf',
        mime_type: 'application/pdf',
        status: 'uploaded',
      },
      error: null,
    });
    vi.mocked(readPdfText).mockRejectedValueOnce(new PdfTextError('PDF_PASSWORD_REQUIRED'));
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'PDF_PASSWORD_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith(
      'fail_document_extraction_server',
      expect.objectContaining({ p_error_code: 'PDF_PASSWORD_REQUIRED' }),
    );
  });
  it('passes the JWT and saves observations as pending drafts', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        draft: {
          document_type: 'receipt',
          observations: [
            {
              amount: 1000,
              currency: 'COP',
              occurred_at: null,
              description: 'Coffee',
              counterparty: null,
              reference: null,
              source_excerpt: 'Coffee 1000',
              confidence: 0.8,
            },
          ],
        },
        model: 'qwen',
        usage: {},
      }),
    );
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-1');
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
    expect(rpc.mock.calls[0]).toEqual(['claim_document_extraction', { p_document_id: 'doc-1' }]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(adminRpc.mock.calls[0][0]).toBe('complete_document_extraction_server');
    expect(adminRpc.mock.calls[0][1].p_owner_id).toBe('user-1');
    expect(adminRpc.mock.calls[0][1].p_claim_token).toBe('11111111-1111-4111-8111-111111111111');
    expect(adminRpc.mock.calls[0][1].p_observations[0]).toMatchObject({
      description: 'Coffee',
    });
    expect(JSON.stringify(adminRpc.mock.calls[0][1])).not.toContain('transaction_id');
    expect(JSON.stringify(adminRpc.mock.calls[0][1])).not.toContain('usage');
  });

  it('passes the verified mobile Bearer token to the Worker without a browser session', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ draft: { document_type: 'receipt', observations: [] }, model: 'qwen' }),
    );
    getUserClient.mockResolvedValueOnce({
      userId: 'user-1',
      accessToken: 'mobile-jwt',
      supabase: {
        auth: { getSession: async () => ({ data: { session: null } }) },
        storage: { from: () => ({ download }) },
        rpc,
        from: () => ({
          select: () => ({ eq: () => ({ eq: () => ({ single: documentQuery }) }) }),
        }),
      },
    });
    const request = new Request('https://anotto.app/api/documents/doc-1/extract', {
      method: 'POST',
      headers: { Authorization: 'Bearer mobile-jwt' },
    });

    const response = await POST(request as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });

    expect(response.status).toBe(200);
    expect(getUserClient).toHaveBeenCalledWith(request);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer mobile-jwt');
  });

  it('returns the image consent requirement and releases the extraction claim', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { code: 'AI_CONSENT_REQUIRED', scope: 'document_images', version: 'external-ai-v1' },
        { status: 428 },
      ),
    );
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(428);
    expect(await response.json()).toMatchObject({
      code: 'AI_CONSENT_REQUIRED',
      scope: 'document_images',
    });
    expect(adminRpc).toHaveBeenCalledWith(
      'fail_document_extraction_server',
      expect.objectContaining({
        p_error_code: 'AI_CONSENT_REQUIRED',
      }),
    );
    expect(adminRpc).not.toHaveBeenCalledWith(
      'complete_document_extraction_server',
      expect.anything(),
    );
  });

  it('rejects extraction of another user document', async () => {
    documentQuery.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'other' }),
    });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(getAdminClient).not.toHaveBeenCalled();
  });

  it('returns conflict before download or Worker call when another extraction holds the claim', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(409);
    expect(download).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(getAdminClient).not.toHaveBeenCalled();
  });

  it('starts only one Worker request for simultaneous extraction attempts', async () => {
    let claims = 0;
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'claim_document_extraction'
          ? { data: ++claims === 1 ? '11111111-1111-4111-8111-111111111111' : null, error: null }
          : { data: 0, error: null },
      ),
    );
    fetchMock.mockResolvedValue(
      Response.json({
        draft: { document_type: 'other', observations: [] },
        model: 'qwen',
        usage: {},
      }),
    );
    const context = { params: Promise.resolve({ id: 'doc-1' }) };
    const responses = await Promise.all([
      POST(new Request('http://localhost') as never, context),
      POST(new Request('http://localhost') as never, context),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('marks the claimed document failed if the private image cannot be downloaded', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(400);
    expect(adminRpc).toHaveBeenCalledWith('fail_document_extraction_server', {
      p_document_id: 'doc-1',
      p_owner_id: 'user-1',
      p_claim_token: '11111111-1111-4111-8111-111111111111',
      p_error_code: 'DOWNLOAD_FAILED',
    });
  });

  it('leaves no extracted result when atomic completion fails', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        draft: { document_type: 'other', observations: [] },
        model: 'qwen',
        usage: {},
      }),
    );
    adminRpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'complete_document_extraction_server'
          ? { data: null, error: { message: 'database unavailable' } }
          : { data: true, error: null },
      ),
    );
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(500);
    expect(adminRpc).toHaveBeenCalledWith(
      'fail_document_extraction_server',
      expect.objectContaining({
        p_error_code: 'PERSISTENCE_FAILED',
      }),
    );
  });

  it('marks malformed Worker JSON as an invalid response', async () => {
    fetchMock.mockResolvedValue(new Response('{bad json', { status: 200 }));
    const response = await POST(new Request('http://localhost') as never, {
      params: Promise.resolve({ id: 'doc-1' }),
    });
    expect(response.status).toBe(502);
    expect(adminRpc).toHaveBeenCalledWith(
      'fail_document_extraction_server',
      expect.objectContaining({
        p_error_code: 'INVALID_RESPONSE',
      }),
    );
  });

  it('does not complete or fail a newer claim when a stale Worker response arrives', async () => {
    const tokenA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tokenB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    let claims = 0;
    rpc.mockImplementation((name: string) => {
      if (name === 'claim_document_extraction') {
        claims += 1;
        return Promise.resolve({ data: claims === 1 ? tokenA : tokenB, error: null });
      }
      return Promise.resolve({ data: null, error: { message: 'Unexpected user RPC' } });
    });
    adminRpc.mockImplementation((name: string, args: { p_claim_token?: string }) => {
      return Promise.resolve(
        args.p_claim_token === tokenB
          ? { data: 0, error: null }
          : { data: null, error: { message: 'Claim was replaced' } },
      );
    });
    const workerResult = () =>
      Response.json({
        draft: { document_type: 'other', observations: [] },
        model: 'qwen',
        usage: {},
      });
    let resolveOldWorker: (response: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOldWorker = resolve;
          }),
      )
      .mockImplementationOnce(async () => workerResult());

    const context = { params: Promise.resolve({ id: 'doc-1' }) };
    const oldRequest = POST(new Request('http://localhost') as never, context);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const newerResponse = await POST(new Request('http://localhost') as never, context);
    expect(newerResponse.status).toBe(200);
    resolveOldWorker(workerResult());
    const staleResponse = await oldRequest;
    expect(staleResponse.status).toBe(500);
    expect(adminRpc).toHaveBeenCalledWith(
      'complete_document_extraction_server',
      expect.objectContaining({ p_claim_token: tokenB }),
    );
    expect(adminRpc).toHaveBeenCalledWith(
      'complete_document_extraction_server',
      expect.objectContaining({ p_claim_token: tokenA }),
    );
    expect(adminRpc).toHaveBeenCalledWith(
      'fail_document_extraction_server',
      expect.objectContaining({ p_claim_token: tokenA }),
    );
    expect(adminRpc).not.toHaveBeenCalledWith(
      'fail_document_extraction_server',
      expect.objectContaining({ p_claim_token: tokenB }),
    );
  });
});
