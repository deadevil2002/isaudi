import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { getCurrentUser } from '@/lib/auth/utils';
import { resolveReportForUser } from '@/lib/reports/ownership';
import {
  REQUEST_BODY_LIMITS,
  RequestBodyTooLargeError,
  readJsonWithLimit,
  requestTooLargeResponse,
} from '@/lib/security/request-size';
import { OpenAIChatError, requestOpenAIChat } from '@/lib/ai/openai-chat';
import { getRuntimeString } from '@/lib/runtime/environment';
import { getDb } from '@/lib/db/client';
import { AI_CHAT_MAX_TOKENS, AI_CHAT_MESSAGE_MAX_LENGTH } from '@/lib/ai/chat-guard';
import {
  answerDeterministicQuestion,
  buildFocusedChatContext,
  buildStructuredChatMessages,
  classifyAiQuestion,
  compactContextFromReport,
} from '@/lib/ai/analysis-context';
import {
  AI_CHAT_RESPONSE_FORMAT,
  parseAiChatResponse,
} from '@/lib/ai/contracts';
import {
  finalizeAiUsage,
  reserveAiUsage,
  type AiUsageMetering,
} from '@/lib/ai/usage-ledger';

const AI_UNAVAILABLE_MESSAGE =
  'عذراً، الخدمة الذكية غير متاحة حالياً. يرجى المحاولة لاحقاً.';

function sourceHashFromReport(reportJson: string): string | null {
  try {
    const value = JSON.parse(reportJson) as {
      snapshot?: { sourceHash?: unknown };
    };
    return typeof value.snapshot?.sourceHash === 'string'
      ? value.snapshot.sourceHash
      : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let releaseAiReservation: (() => Promise<void>) | null = null;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: unknown;
    try {
      body = await readJsonWithLimit(req, REQUEST_BODY_LIMITS.analysis);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) return requestTooLargeResponse();
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const record = body && typeof body === 'object'
      ? body as Record<string, unknown>
      : {};
    const message = record.message;
    const requestedReportId =
      typeof record.reportId === 'string' && record.reportId.trim()
        ? record.reportId.trim()
        : null;

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }
    const normalizedMessage = message.trim();
    if (normalizedMessage.length > AI_CHAT_MESSAGE_MAX_LENGTH) {
      return NextResponse.json(
        { error: 'الرسالة طويلة جداً. يرجى اختصارها والمحاولة مجدداً.' },
        { status: 400 }
      );
    }
    if (user.plan === 'free' && (user.freeReportsUsed || 0) >= 2) {
      return NextResponse.json(
        { error: 'Free limit reached. Upgrade to continue.' },
        { status: 403 }
      );
    }

    const report = await resolveReportForUser(
      dbService,
      user.id,
      requestedReportId
    );
    if (!report) {
      return NextResponse.json(
        { error: 'No report found. Please generate an analysis first.' },
        { status: 404 }
      );
    }

    let context;
    try {
      context = compactContextFromReport(report.reportJson);
    } catch {
      console.error('[analysis/chat] Stored report context is invalid');
      return NextResponse.json(
        { error: 'تعذر قراءة تقريرك حالياً. يرجى إنشاء تحليل جديد.' },
        { status: 422 }
      );
    }

    const classified = classifyAiQuestion(normalizedMessage);
    if (classified === 'factual') {
      const response = answerDeterministicQuestion(normalizedMessage, context);
      if (response) {
        return NextResponse.json({
          reply: response.summary,
          response,
          route: 'deterministic',
          providerUsed: false,
        });
      }
    }
    const complexity = classified === 'deep' ? 'deep' : 'analytical';

    const apiKey = getRuntimeString('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('[analysis/chat] OpenAI configuration missing');
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 503 });
    }

    const db = await getDb();
    const reservationId = randomUUID();
    let reserved: boolean;
    try {
      reserved = await reserveAiUsage({
        db,
        reservationId,
        userId: user.id,
        operation: 'chat',
        plan: user.plan,
      });
    } catch {
      console.error('[analysis/chat] AI quota storage unavailable');
      return NextResponse.json(
        { error: 'الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.' },
        { status: 503 }
      );
    }
    if (!reserved) {
      return NextResponse.json(
        { error: 'تم بلوغ حد استخدام المساعد مؤقتاً. يرجى المحاولة لاحقاً.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
    let aiUsageMetering: AiUsageMetering | undefined;
    releaseAiReservation = () =>
      finalizeAiUsage({
        db,
        reservationId,
        status: 'failed',
        metering: aiUsageMetering,
      });

    try {
      const result = await requestOpenAIChat({
        apiKey,
        messages: buildStructuredChatMessages({
          context: buildFocusedChatContext(context, complexity),
          question: normalizedMessage,
          complexity,
        }),
        responseFormat: AI_CHAT_RESPONSE_FORMAT,
        temperature: 0.2,
        maxTokens: AI_CHAT_MAX_TOKENS,
      });
      aiUsageMetering = {
        model: result.model,
        reportId: report.id,
        sourceHash: sourceHashFromReport(report.reportJson),
        ...result.usage,
      };
      const response = parseAiChatResponse(result.content);
      await finalizeAiUsage({
        db,
        reservationId,
        status: 'succeeded',
        metering: aiUsageMetering,
      });
      releaseAiReservation = null;
      return NextResponse.json({
        reply: response.summary,
        response,
        route: complexity,
        providerUsed: true,
      });
    } catch (error) {
      try {
        const release = releaseAiReservation;
        if (!release) throw new Error('Missing AI usage reservation');
        await release();
        releaseAiReservation = null;
      } catch {
        console.error('[analysis/chat] AI usage reservation could not be finalized');
        return NextResponse.json(
          { error: 'الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.' },
          { status: 503 }
        );
      }
      if (error instanceof OpenAIChatError) {
        console.error('[analysis/chat] OpenAI request failed', {
          kind: error.kind,
          status: error.status,
        });
      } else {
        console.error('[analysis/chat] Structured response validation failed');
      }
      return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 502 });
    }
  } catch {
    if (releaseAiReservation) {
      try {
        await releaseAiReservation();
      } catch {
        console.error('[analysis/chat] Failed to release AI reservation');
      }
    }
    console.error('[analysis/chat] Authentication or data storage unavailable');
    return NextResponse.json(
      { error: 'الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.' },
      { status: 503 }
    );
  }
}
