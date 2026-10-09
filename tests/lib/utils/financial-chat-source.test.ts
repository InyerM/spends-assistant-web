import { describe, expect, it } from 'vitest';
import { savedChatSource } from '@/lib/utils/financial-chat-source';
describe('saved chat source navigation', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('constructs internal links for each fixed source type', () => {
    expect(savedChatSource(`transaction:${id}`)?.href).toBe(`/transactions/${id}`);
    expect(savedChatSource(`account:${id}`)?.href).toBe(`/accounts/${id}`);
    expect(savedChatSource(`document:${id}`)?.href).toBe(`/documents#document-${id}`);
  });
  it('rejects model URLs, path traversal and unsupported types', () => {
    for (const value of [
      'https://example.com',
      'transaction:../../settings',
      `user:${id}`,
      'document:javascript:alert(1)',
    ])
      expect(savedChatSource(value)).toBeNull();
  });
});
