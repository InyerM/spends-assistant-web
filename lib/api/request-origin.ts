const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

export function hasSameRequestOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin || origin === 'null' || !/^https?:\/\/[^/?#\\]+$/iu.test(origin)) return false;
  try {
    const source = new URL(origin);
    if (
      !['https:', 'http:'].includes(source.protocol) ||
      source.username ||
      source.password ||
      source.pathname !== '/' ||
      source.search ||
      source.hash ||
      /[\s,]/u.test(origin)
    )
      return false;
    const target = new URL(request.url);
    const host = request.headers.get('host');
    // Next's local listener URL may differ from its loopback browser address.
    if (host && LOOPBACK_HOSTS.has(target.hostname)) {
      const localTarget = new URL(`${target.protocol}//${host}`);
      if (
        LOOPBACK_HOSTS.has(localTarget.hostname) &&
        !localTarget.username &&
        !localTarget.password &&
        localTarget.pathname === '/' &&
        !localTarget.search &&
        !localTarget.hash
      )
        target.host = localTarget.host;
    }
    return source.origin === target.origin;
  } catch {
    return false;
  }
}
