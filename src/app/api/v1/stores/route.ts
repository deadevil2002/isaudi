import { createBusinessApiRoute, storesResource } from '@/lib/business-api/handler';

export const dynamic = 'force-dynamic';
export const GET = createBusinessApiRoute({ scope: 'stores:read', endpoint: 'stores', resource: storesResource });
