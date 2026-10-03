import { createBusinessApiManagementHandler } from '@/lib/business-api/management';

export const dynamic = 'force-dynamic';
export const GET = createBusinessApiManagementHandler({ action: 'list' });
export const POST = createBusinessApiManagementHandler({ action: 'create' });
