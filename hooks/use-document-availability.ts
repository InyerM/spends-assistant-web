'use client';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useDocuments } from '@/lib/api/queries/document.queries';
import { documentModuleEnabled } from '@/lib/workspace-navigation';
export function useDocumentAvailability(): boolean {
  const { data: planning } = usePlanning();
  const { data: documents } = useDocuments();
  return documentModuleEnabled(planning?.preferences ?? {}, documents?.length ?? 0);
}
