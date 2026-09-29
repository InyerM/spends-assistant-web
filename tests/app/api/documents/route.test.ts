import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/documents/route';

const { getUserClient, upload, remove, insert, select, eq, order } = vi.hoisted(() => ({
  getUserClient: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock('@/lib/api/server', () => ({
  getUserClient,
  AuthError: class AuthError extends Error {},
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  errorResponse: (error: string, status = 500) => Response.json({ error }, { status }),
}));

const supabase = {
  storage: { from: () => ({ upload, remove }) },
  from: () => ({ insert, select, order }),
};

describe('/api/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserClient.mockResolvedValue({ supabase, userId: 'user-1' });
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    insert.mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: 'doc-1' }, error: null }) }),
    });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ order });
    order.mockResolvedValue({ data: [], error: null });
  });

  it('rejects spoofed image content before storage', async () => {
    const file = {
      name: 'receipt.png',
      type: 'image/png',
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    };
    const response = await POST({ formData: async () => ({ get: () => file }) } as never);
    expect(response.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads an image under the user ID and creates a document row', async () => {
    const file = {
      name: 'receipt.png',
      type: 'image/png',
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]).buffer,
    };
    const response = await POST({ formData: async () => ({ get: () => file }) } as never);
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
    expect(upload.mock.calls[0][0]).toMatch(/^user-1\//);
    expect(insert.mock.calls[0][0]).toMatchObject({
      user_id: 'user-1',
      status: 'uploaded',
      mime_type: 'image/png',
    });
  });

  it('lists only the signed-in user documents', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
