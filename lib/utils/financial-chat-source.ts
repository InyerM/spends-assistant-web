export interface SavedChatSource {
  type: 'transaction' | 'account' | 'document';
  href: string;
}
/** Saved identifiers are navigation references, never model-provided URLs. */
export function savedChatSource(identifier: string): SavedChatSource | null {
  const match =
    /^(transaction|account|document):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/iu.exec(
      identifier,
    );
  if (!match) return null;
  const type = match[1].toLowerCase() as SavedChatSource['type'];
  const id = match[2];
  const hrefs = {
    transaction: `/transactions/${id}`,
    account: `/accounts/${id}`,
    document: `/documents#document-${id}`,
  };
  return { type, href: hrefs[type] };
}
