import { getCloudflareContext } from '@opennextjs/cloudflare';

function getD1FromContext(): any | null {
  try {
    const ctx = getCloudflareContext();
    return (ctx as any)?.env?.DB ?? (ctx as any)?.context?.env?.DB ?? null;
  } catch {
    return null;
  }
}

function createD1Adapter(d1: any): any {
  return {
    prepare(sql: string) {
      return {
        get: async (...params: any[]) => d1.prepare(sql).bind(...params).first(),
        all: async (...params: any[]) => d1.prepare(sql).bind(...params).all(),
        run: async (...params: any[]) => d1.prepare(sql).bind(...params).run(),
      };
    },
  };
}

export async function getDb(): Promise<any> {
  const d1 = getD1FromContext();
  if (!d1) {
    throw new Error('D1 binding DB is not available in this runtime');
  }
  return createD1Adapter(d1);
}

export const DB_PATH = process.env.DB_PATH || '';

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
