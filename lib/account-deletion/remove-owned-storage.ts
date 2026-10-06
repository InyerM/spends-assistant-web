import type { SupabaseClient } from '@supabase/supabase-js';

const buckets = ['documents', 'imports'] as const;
const pageSize = 100;
const maxPages = 100;

export async function removeOwnedStorage(admin: SupabaseClient, userId: string): Promise<void> {
  for (const bucket of buckets) {
    const storage = admin.storage.from(bucket);
    for (let page = 0; page < maxPages; page += 1) {
      const { data, error } = await storage.list(userId, { limit: pageSize });
      if (error) throw new Error('Storage listing failed');
      if (data.length === 0) break;
      const paths = data.map(({ name }) => `${userId}/${name}`);
      if (paths.some((path) => path.endsWith('/'))) throw new Error('Nested storage path');
      const { error: removalError } = await storage.remove(paths);
      if (removalError) throw new Error('Storage removal failed');
      if (page === maxPages - 1) throw new Error('Storage cleanup exceeded page limit');
    }
  }
}
