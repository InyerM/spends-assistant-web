import { useRef, useState } from 'react';
import { decideDocumentObservation } from '@/lib/api/mutations/document.mutations';
import type { DocumentSuggestionGroup } from '@/lib/api/queries/document.queries';
import {
  selectBulkReconciliation,
  type BulkReconciliationMatch,
  type BulkReconciliationRow,
} from '@/lib/document-bulk-reconciliation';

interface BulkReconciliationResult {
  eligible: BulkReconciliationMatch[];
  preview: BulkReconciliationMatch[] | null;
  busy: boolean;
  failed: number;
  completed: number;
  refreshFailed: boolean;
  openPreview: () => void;
  closePreview: () => void;
  confirm: () => Promise<void>;
}

export function useDocumentBulkReconciliation({
  documentId,
  rows,
  suggestions,
  onRefresh,
  disabled,
  onBusyChange,
}: {
  documentId: string;
  rows: BulkReconciliationRow[];
  suggestions: DocumentSuggestionGroup[];
  onRefresh: () => Promise<void>;
  disabled: boolean;
  onBusyChange?: (busy: boolean) => void;
}): BulkReconciliationResult {
  const [preview, setPreview] = useState<BulkReconciliationMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const running = useRef(false);
  const keys = useRef(new Map<string, string>());
  const eligible = selectBulkReconciliation(rows, suggestions).filter(
    (match) => !saved.includes(match.observationId),
  );

  async function confirm(): Promise<void> {
    if (!preview || disabled || running.current) return;
    const current = new Map(
      eligible.map((match) => [match.observationId, match.candidate.transaction_id]),
    );
    const matches = preview.filter(
      (match) => current.get(match.observationId) === match.candidate.transaction_id,
    );
    running.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setFailed(0);
    setCompleted(0);
    setRefreshFailed(false);
    try {
      for (const match of matches) {
        const identity = `${documentId}:${match.observationId}:${match.candidate.transaction_id}`;
        const key = keys.current.get(identity) ?? crypto.randomUUID();
        keys.current.set(identity, key);
        try {
          await decideDocumentObservation({
            documentId,
            observationId: match.observationId,
            transactionId: match.candidate.transaction_id,
            action: 'accept',
            key,
          });
          setSaved((previous) => [...previous, match.observationId]);
          setCompleted((previous) => previous + 1);
        } catch {
          setFailed((previous) => previous + 1);
        }
      }
      setPreview(null);
      try {
        await onRefresh();
      } catch {
        setRefreshFailed(true);
      }
    } finally {
      running.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return {
    eligible,
    preview,
    busy,
    failed,
    completed,
    refreshFailed,
    openPreview: (): void => {
      if (!disabled && !running.current) setPreview(eligible);
    },
    closePreview: (): void => {
      if (!running.current) setPreview(null);
    },
    confirm,
  };
}
