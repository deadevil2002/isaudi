export type SallaConnectionStatus =
  | 'pending'
  | 'connected'
  | 'disconnected'
  | 'uninstalled';

export interface SallaConnection {
  merchantId: string;
  userId: string | null;
  status: SallaConnectionStatus;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: number | null;
  scopes: string | null;
  tokenVersion: number;
  refreshState: 'idle' | 'in_progress' | 'uncertain';
  refreshAttemptId: string | null;
  refreshAttemptStartedAt: number | null;
  refreshLockToken: string | null;
  refreshLockExpiresAt: number | null;
}

export interface SallaAuthorizer {
  id: string | null;
  email: string;
  name: string | null;
  role: string | null;
}

export type SallaConnectState =
  | 'before_install'
  | 'waiting_for_link'
  | 'reconnect_required'
  | 'connected'
  | 'disconnected';