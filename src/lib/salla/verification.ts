import {
  listOrders,
  listProducts,
  verificationErrorForRead,
  type ReadClientOptions,
  type SallaListResult,
  type SallaPagination,
} from './client';
import { getSallaConnectionForUser } from './repository';
import type { SallaConnection } from './types';

export interface VerificationOperation {
  ok: boolean;
  count?: number;
  pagination?: SallaPagination;
  error?: string;
}

export interface SallaVerificationResult {
  connected: true;
  products: VerificationOperation;
  orders: VerificationOperation;
}

export class SallaVerificationPreconditionError extends Error {
  constructor() {
    super('Salla connection unavailable');
    this.name = 'SallaVerificationPreconditionError';
  }
}

interface VerificationOptions extends ReadClientOptions {
  getConnection?: (userId: string) => Promise<SallaConnection | undefined>;
  readProducts?: (
    userId: string,
    options?: ReadClientOptions
  ) => Promise<SallaListResult>;
  readOrders?: (
    userId: string,
    options?: ReadClientOptions
  ) => Promise<SallaListResult>;
}

function projectSuccess(result: SallaListResult): VerificationOperation {
  if (
    !Number.isSafeInteger(result.count) ||
    result.count < 0 ||
    !Array.isArray(result.records)
  ) {
    return { ok: false, error: 'Unable to read Salla data' };
  }
  return {
    ok: true,
    count: result.count,
    pagination: {
      currentPage: result.pagination.currentPage,
      totalPages: result.pagination.totalPages,
      total: result.pagination.total,
    },
  };
}

function projectFailure(error: unknown): VerificationOperation {
  return {
    ok: false,
    error: verificationErrorForRead(error),
  };
}

function isUsableConnection(
  connection: SallaConnection | undefined,
  userId: string
): connection is SallaConnection {
  return Boolean(
    connection &&
    connection.userId === userId &&
    connection.status === 'connected' &&
    connection.accessTokenEncrypted &&
    connection.refreshTokenEncrypted
  );
}

/**
 * Verify the authenticated user's already-claimed connection.  This function
 * never accepts a merchant identifier and never returns provider records.
 */
export async function verifySallaConnection(
  userId: string,
  options: VerificationOptions = {}
): Promise<SallaVerificationResult> {
  const getConnection = options.getConnection || getSallaConnectionForUser;
  let connection: SallaConnection | undefined;
  try {
    connection = await getConnection(userId);
  } catch {
    throw new SallaVerificationPreconditionError();
  }
  if (!isUsableConnection(connection, userId)) {
    throw new SallaVerificationPreconditionError();
  }

  const clientOptions: ReadClientOptions = {
    fetcher: options.fetcher,
    now: options.now,
    resolveAccessToken: options.resolveAccessToken,
    refreshRejectedToken: options.refreshRejectedToken,
  };
  const readProducts = options.readProducts || listProducts;
  const readOrders = options.readOrders || listOrders;
  const [products, orders] = await Promise.all([
    readProducts(userId, clientOptions)
      .then(projectSuccess)
      .catch(projectFailure),
    readOrders(userId, clientOptions)
      .then(projectSuccess)
      .catch(projectFailure),
  ]);

  return {
    connected: true,
    products,
    orders,
  };
}