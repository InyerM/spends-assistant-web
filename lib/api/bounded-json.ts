export class RequestBodyError extends Error {
  public constructor(
    message: string,
    public readonly status: 400 | 413,
  ) {
    super(message);
  }
}

/** Bound actual streamed bytes before JSON parsing; Content-Length is not trusted. */
export async function readBoundedJson(
  request: Request,
  maxBytes: number,
  allowEmpty = false,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) {
    if (allowEmpty) return {};
    throw new RequestBodyError('Invalid JSON', 400);
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new RequestBodyError('Request too large', 413);
      }
      chunks.push(value);
    }
    if (!size && allowEmpty) return {};
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    } catch {
      throw new RequestBodyError('Invalid JSON', 400);
    }
  } finally {
    reader.releaseLock();
  }
}
