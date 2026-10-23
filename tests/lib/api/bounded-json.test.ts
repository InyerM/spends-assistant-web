import { it, expect, vi } from 'vitest';
import { readBoundedJson } from '@/lib/api/bounded-json';
it('bounds actual streamed bytes independently of caller headers', async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(1025));
    },
    cancel,
  });
  const request = new Request('https://web.example', {
    method: 'POST',
    headers: { 'Content-Length': '1' },
    body: stream,
    duplex: 'half',
  } as RequestInit);
  await expect(readBoundedJson(request, 1024)).rejects.toThrow('Request too large');
  expect(cancel).toHaveBeenCalledOnce();
});
it('parses JSON and rejects malformed data without exposing body content', async () => {
  expect(
    await readBoundedJson(
      new Request('https://web.example', { method: 'POST', body: '{"refresh":true}' }),
      1024,
    ),
  ).toEqual({ refresh: true });
  await expect(
    readBoundedJson(
      new Request('https://web.example', { method: 'POST', body: 'private malformed' }),
      1024,
    ),
  ).rejects.toThrow('Invalid JSON');
});
