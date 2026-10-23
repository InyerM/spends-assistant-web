export const workerConfig = {
  url: process.env.WORKER_URL ?? '',
  apiKey: process.env.WORKER_API_KEY ?? '',
  inboxAnalysisEnabled: process.env.WORKER_INBOX_ANALYSIS_ENABLED !== 'false',
} as const;
