import '@testing-library/jest-dom/vitest';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.WORKER_URL = 'https://worker.test.dev';
process.env.WORKER_API_KEY = 'test-worker-key';
