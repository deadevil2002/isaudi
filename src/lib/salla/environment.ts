import { getRuntimeString } from '@/lib/runtime/environment';

interface SallaEnvironment {
  SALLA_CLIENT_ID?: string;
  SALLA_CLIENT_SECRET?: string;
  SALLA_REDIRECT_URL?: string;
  SALLA_WEBHOOK_SECRET?: string;
}

export function getSallaEnvironment(): SallaEnvironment {
  return {
    SALLA_CLIENT_ID: getRuntimeString('SALLA_CLIENT_ID'),
    SALLA_CLIENT_SECRET: getRuntimeString('SALLA_CLIENT_SECRET'),
    SALLA_REDIRECT_URL: getRuntimeString('SALLA_REDIRECT_URL'),
    SALLA_WEBHOOK_SECRET: getRuntimeString('SALLA_WEBHOOK_SECRET'),
  };
}