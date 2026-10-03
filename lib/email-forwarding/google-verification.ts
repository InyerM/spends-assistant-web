export function googleVerificationUrl(message: string | null): string | null {
  if (!message) return null;
  for (const match of message.matchAll(/https:\/\/[^\s<>"']+/gi)) {
    try {
      const candidate = new URL(match[0].replace(/[.,;!?)]*$/, ''));
      if (
        candidate.protocol === 'https:' &&
        !candidate.username &&
        !candidate.password &&
        ['mail-settings.google.com', 'mail.google.com'].includes(candidate.hostname) &&
        candidate.pathname.startsWith('/mail/')
      ) {
        return candidate.toString();
      }
    } catch {
      // Ignore malformed links in the received message.
    }
  }
  return null;
}
