import { createBusinessApiRoute, reportDetailResource } from '@/lib/business-api/handler';

export const dynamic = 'force-dynamic';
export const GET = createBusinessApiRoute({ scope: 'reports:read', endpoint: 'reports.detail', resource: reportDetailResource });
