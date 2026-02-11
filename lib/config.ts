export const workerConfig = {
  url: process.env.WORKER_URL ?? '',
  apiKey: process.env.WORKER_API_KEY ?? '',
} as const;
