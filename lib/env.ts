import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const clientEnv = clientEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NODE_ENV: process.env.NODE_ENV,
});

if (!clientEnv.success) {
  throw new Error('Invalid client environment variables');
}

let serverEnv: z.infer<typeof serverEnvSchema> | null = null;
if (typeof window === 'undefined') {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    throw new Error('Invalid server environment variables');
  }
  serverEnv = parsed.data;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: clientEnv.data.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: clientEnv.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NODE_ENV: clientEnv.data.NODE_ENV,
  isDevelopment: clientEnv.data.NODE_ENV === 'development',
  isProduction: clientEnv.data.NODE_ENV === 'production',
  isTest: clientEnv.data.NODE_ENV === 'test',
  ...(serverEnv ?? {}),
} as const;
