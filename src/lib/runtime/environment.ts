import { getCloudflareContext } from '@opennextjs/cloudflare';

export type RuntimeEnvironment = Record<string, unknown>;

export function getRuntimeEnvironment(): RuntimeEnvironment {
  let workerEnv: RuntimeEnvironment = {};
  try {
    const context = getCloudflareContext() as unknown as {
      env?: RuntimeEnvironment;
      context?: { env?: RuntimeEnvironment };
    };
    workerEnv = context.env ?? context.context?.env ?? {};
  } catch {
    workerEnv = {};
  }

  return workerEnv;
}

export function getRuntimeString(name: string): string | undefined {
  const workerValue = getRuntimeEnvironment()[name];
  if (typeof workerValue === 'string' && workerValue.trim()) {
    return workerValue.trim();
  }

  const nodeValue =
    typeof process !== 'undefined' ? process.env[name] : undefined;
  return typeof nodeValue === 'string' && nodeValue.trim()
    ? nodeValue.trim()
    : undefined;
}