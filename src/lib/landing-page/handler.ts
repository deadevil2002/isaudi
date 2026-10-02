import { getCurrentUser } from '@/lib/auth/utils';
import {
  REQUEST_BODY_LIMITS,
  RequestBodyTooLargeError,
  readJsonWithLimit,
  requestTooLargeResponse,
} from '@/lib/security/request-size';
import {
  analyzeVerifiedLandingPage,
  LandingPageAnalysisUnavailableError,
} from './service';

type HandlerUser = { id: string };

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export function createLandingPageAnalysisHandler(options: {
  getUser?: () => Promise<HandlerUser | null>;
  analyze?: typeof analyzeVerifiedLandingPage;
} = {}) {
  return async function POST(request: Request): Promise<Response> {
    const user = await (options.getUser ?? getCurrentUser)();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    let body: unknown;
    try {
      body = await readJsonWithLimit(request, REQUEST_BODY_LIMITS.json);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return requestTooLargeResponse();
      return json({ error: 'Invalid request' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Invalid request' }, 400);
    }
    const record = body as Record<string, unknown>;
    if (
      Object.keys(record).some((key) => key !== 'merchantId') ||
      typeof record.merchantId !== 'string' ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(record.merchantId)
    ) {
      return json({ error: 'Invalid merchant selector' }, 400);
    }

    try {
      const result = await (options.analyze ?? analyzeVerifiedLandingPage)({
        userId: user.id,
        merchantId: record.merchantId,
      });
      return json({ analysis: result });
    } catch (error) {
      if (error instanceof LandingPageAnalysisUnavailableError) {
        const status = error.reason === 'verified_storefront_unavailable' ? 404 : 422;
        return json({
          error: 'analysis_unavailable',
          reason: error.reason,
          ...(error.httpStatus == null ? {} : { httpStatus: error.httpStatus }),
        }, status);
      }
      console.error('[landing-page/analyze] Request failed');
      return json({ error: 'analysis_unavailable', reason: 'internal' }, 503);
    }
  };
}
