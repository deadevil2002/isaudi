import { createBusinessApiRoute, reportsResource } from '@/lib/business-api/handler';

export const dynamic = 'force-dynamic';
export const GET = createBusinessApiRoute({ scope: 'reports:read', endpoint: 'reports.list', resource: reportsResource });
