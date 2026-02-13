import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportTransactionsCsv } from '@/lib/utils/export';
import { createMockTransaction } from '@/tests/__test-helpers__/factories';

describe('exportTransactionsCsv', () => {
  beforeEach(() => {
    // Mock URL methods
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:test'),
      revokeObjectURL: vi.fn(),
    });
  });

  it('includes correct CSV headers', () => {
    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: mockClick,
      set href(_: string) {},
      set download(_: string) {},
    } as unknown as HTMLElement);

    const blobContent: string[] = [];
    vi.stubGlobal(
      'Blob',
      class {
        constructor(parts: string[]) {
          blobContent.push(...parts);
        }
      },
    );

    exportTransactionsCsv([createMockTransaction()]);

    const csv = blobContent[0];
    const headers = csv.split('\n')[0];
    expect(headers).toBe(
      'date,time,type,amount,description,notes,category_id,account_id,payment_method,source',
    );
  });

  it('escapes quotes in description', () => {
    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: mockClick,
      set href(_: string) {},
      set download(_: string) {},
    } as unknown as HTMLElement);

    const blobContent: string[] = [];
    vi.stubGlobal(
      'Blob',
      class {
        constructor(parts: string[]) {
          blobContent.push(...parts);
        }
      },
    );

    const tx = createMockTransaction({ description: 'He said "hello"' });
    exportTransactionsCsv([tx]);

    const csv = blobContent[0];
    const row = csv.split('\n')[1];
    expect(row).toContain('"He said ""hello"""');
  });

  it('handles null fields', () => {
    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: mockClick,
      set href(_: string) {},
      set download(_: string) {},
    } as unknown as HTMLElement);

    const blobContent: string[] = [];
    vi.stubGlobal(
      'Blob',
      class {
        constructor(parts: string[]) {
          blobContent.push(...parts);
        }
      },
    );

    const tx = createMockTransaction({ notes: null, payment_method: null });
    exportTransactionsCsv([tx]);

    const csv = blobContent[0];
    const row = csv.split('\n')[1];
    expect(row).toContain('""'); // null notes
  });

  it('triggers download', () => {
    const mockClick = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: mockClick,
      set href(_: string) {},
      set download(_: string) {},
    } as unknown as HTMLElement);

    vi.stubGlobal('Blob', class {});

    exportTransactionsCsv([createMockTransaction()]);
    expect(mockClick).toHaveBeenCalled();
  });
});
