import { getRuntimeString } from '@/lib/runtime/environment';

export type TapEnvironment = 'production' | 'staging';

const ORIGINS: Record<TapEnvironment, string> = {
  production: 'https://isaudi.ai',
  staging: 'https://isaudi-staging.isaudi-official.workers.dev',
};

export type TapRuntimeConfig = {
  environment: TapEnvironment;
  expectedLiveMode: boolean;
  redirectUrl: string;
  webhookUrl: string;
};

export function resolveTapRuntimeConfig(input?: {
  appEnv?: string;
  appUrl?: string;
}): TapRuntimeConfig {
  const appEnv = input?.appEnv ?? getRuntimeString('APP_ENV');
  const appUrl = input?.appUrl ?? getRuntimeString('APP_URL');
  const environment: TapEnvironment = appEnv === 'staging' ? 'staging' : 'production';
  const origin = ORIGINS[environment];

  if (appEnv && appEnv !== 'staging' && appEnv !== 'production') {
    throw new Error('Unsupported Tap runtime environment');
  }
  if (appUrl && appUrl.replace(/\/+$/, '') !== origin) {
    throw new Error('Tap callback origin does not match the runtime environment');
  }

  return {
    environment,
    expectedLiveMode: environment === 'production',
    redirectUrl: `${origin}/billing?status=processed`,
    webhookUrl: `${origin}/api/billing/tap/webhook`,
  };
}

export function isExpectedTapMode(value: unknown, expectedLiveMode: boolean): boolean {
  return typeof value === 'boolean' && value === expectedLiveMode;
}
