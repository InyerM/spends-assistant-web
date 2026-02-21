export function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}

export function findNameById(items: { id: string; name: string }[], id: string): string {
  return items.find((item) => item.id === id)?.name ?? '';
}
