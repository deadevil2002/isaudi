import { createBusinessApiRoute, accountResource } from '@/lib/business-api/handler';

export const dynamic = 'force-dynamic';
export const GET = createBusinessApiRoute({ scope: 'account:read', endpoint: 'account', resource: accountResource });
