// Next's internal request URL can differ from the host addressed by the browser in development.
export function hasSameRequestOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin || origin === 'null') return false;
  try {
    const target = new URL(request.url);
    const host = request.headers.get('host');
    if (host) target.host = host;
    return new URL(origin).origin === target.origin;
  } catch {
    return false;
  }
}
