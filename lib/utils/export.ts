import type { Transaction } from '@/types';

export function exportTransactionsCsv(transactions: Transaction[]): void {
  const headers = [
    'date',
    'time',
    'type',
    'amount',
    'description',
    'notes',
    'category_id',
    'account_id',
    'payment_method',
    'source',
  ];

  const rows = transactions.map((tx) =>
    [
      tx.date,
      tx.time,
      tx.type,
      String(tx.amount),
      `"${tx.description.replace(/"/g, '""')}"`,
      `"${(tx.notes ?? '').replace(/"/g, '""')}"`,
      tx.category_id ?? '',
      tx.account_id,
      tx.payment_method ?? '',
      tx.source,
    ].join(','),
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
