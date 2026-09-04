import { getCloudflareContext } from '@opennextjs/cloudflare';

interface SallaEnvironment {
  SALLA_CLIENT_ID?: string;
  SALLA_CLIENT_SECRET?: string;
  SALLA_REDIRECT_URL?: string;
  SALLA_WEBHOOK_SECRET?: string;
}

export function getSallaEnvironment(): SallaEnvironment {
  let workerEnv: SallaEnvironment = {};

  try {
    const context = getCloudflareContext() as unknown as {
      env?: SallaEnvironment;
      context?: { env?: SallaEnvironment };
    };
    workerEnv = context.env ?? context.context?.env ?? {};
  } catch {
    workerEnv = {};
  }

  return {
    SALLA_CLIENT_ID:
      workerEnv.SALLA_CLIENT_ID || process.env.SALLA_CLIENT_ID,
    SALLA_CLIENT_SECRET:
      workerEnv.SALLA_CLIENT_SECRET || process.env.SALLA_CLIENT_SECRET,
    SALLA_REDIRECT_URL:
      workerEnv.SALLA_REDIRECT_URL || process.env.SALLA_REDIRECT_URL,
    SALLA_WEBHOOK_SECRET:
      workerEnv.SALLA_WEBHOOK_SECRET || process.env.SALLA_WEBHOOK_SECRET,
  };
}