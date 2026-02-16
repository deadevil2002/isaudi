import { getCloudflareContext } from '@opennextjs/cloudflare';

function getD1FromContext(): any | null {
  try {
    const ctx = getCloudflareContext();
    return (ctx as any)?.env?.DB ?? (ctx as any)?.context?.env?.DB ?? null;
  } catch {
    return null;
  }
}

function waitFor<T>(promise: Promise<T>): T {
  if (typeof SharedArrayBuffer === 'undefined' || typeof Atomics === 'undefined') {
    throw new Error('Async wait is not supported in this runtime');
  }
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  let result: T | undefined;
  let error: any;
  promise
    .then((value) => {
      result = value;
      Atomics.store(view, 0, 1);
      Atomics.notify(view, 0);
    })
    .catch((err) => {
      error = err;
      Atomics.store(view, 0, 1);
      Atomics.notify(view, 0);
    });
  while (Atomics.load(view, 0) === 0) {
    Atomics.wait(view, 0, 0, 50);
  }
  if (error) throw error;
  return result as T;
}

function createD1Adapter(d1: any): any {
  return {
    prepare(sql: string) {
      return {
        get: (...params: any[]) => {
          return waitFor(d1.prepare(sql).bind(...params).first());
        },
        all: (...params: any[]) => {
          return waitFor(d1.prepare(sql).bind(...params).all());
        },
        run: (...params: any[]) => {
          return waitFor(d1.prepare(sql).bind(...params).run());
        },
      };
    },
  };
}

export function getSqliteDb(): any {
  const d1 = getD1FromContext();
  if (d1) {
    return createD1Adapter(d1);
  }
  throw new Error('D1 not available — run in Cloudflare environment');
}

export const db = new Proxy({} as any, {
  get(_target, prop) {
    return (getSqliteDb() as any)[prop];
  },
});

// Kept for backwards compatibility with existing imports
export const DB_PATH = '';

export interface User {
  id: string;
  email: string;
  plan: string;
  planExpiresAt: number | null;
  createdAt: number;
  freeReportsUsed?: number;
  email_verified?: number;
  email_verified_at?: number | null;
  email_verify_token?: string | null;
  email_verify_token_expires_at?: number | null;
}

export interface Report {
  id: string;
  userId: string;
  storeId?: string;
  reportJson: string;
  createdAt: number;
}

export interface OTPCode {
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
  createdAt: number;
}

export interface Session {
  sessionId: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  interval: 'month' | 'year';
  status: 'active' | 'expired' | 'pending' | 'canceled';
  startedAt: number;
  expiresAt: number;
  createdAt: number;
}

export interface Payment {
  id: string;
  userId: string;
  provider: string;
  providerPaymentId: string | null;
  amountHalala: number;
  currency: string;
  status: string;
  createdAt: number;
  rawJson?: string;
}

export interface StoreConnection {
  id: string;
  userId: string;
  platform: 'salla' | 'csv';
  status: 'connected' | 'disconnected';
  storeName?: string;
  storeUrl?: string;
  accessTokenEncrypted?: string;
  refreshTokenEncrypted?: string;
  tokenExpiresAt?: number;
  createdAt: number;
}

export interface Product {
  id: string;
  userId: string;
  platform: string;
  externalId?: string;
  title: string;
  sku: string;
  priceHalala: number;
  inventory: number;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export interface Order {
  id: string;
  userId: string;
  platform: string;
  externalId?: string;
  totalHalala: number;
  status: string;
  itemsCount: number;
  createdAt: number;
}
