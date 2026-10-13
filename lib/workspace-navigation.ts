export function documentModuleEnabled(
  preferences: Record<string, unknown>,
  documentCount: number,
): boolean {
  return preferences.documents_enabled === true || documentCount > 0;
}
export function workspacePathActive(pathname: string, href: string): boolean {
  if (pathname.startsWith('/transactions/shortcut-inbox')) return href === '/inbox';
  return pathname === href || pathname.startsWith(href + '/');
}
