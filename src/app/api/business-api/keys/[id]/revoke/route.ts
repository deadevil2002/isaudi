import { createBusinessApiManagementHandler } from '@/lib/business-api/management';

export const dynamic = 'force-dynamic';
export const POST = createBusinessApiManagementHandler({ action: 'revoke' });
