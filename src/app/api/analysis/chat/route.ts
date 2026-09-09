import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/db/service';
import { getCurrentUser } from '@/lib/auth/utils';
import {
  REQUEST_BODY_LIMITS,
  RequestBodyTooLargeError,
  readJsonWithLimit,
  requestTooLargeResponse,
} from '@/lib/security/request-size';
import {
  OpenAIChatError,
  requestOpenAIChat,
} from '@/lib/ai/openai-chat';
import { getRuntimeString } from '@/lib/runtime/environment';
import { getDb } from '@/lib/db/client';
import {
  AI_CHAT_MAX_TOKENS,
  AI_CHAT_MESSAGE_MAX_LENGTH,
  boundedReportContext,
  consumeAiChatQuota,
} from '@/lib/ai/chat-guard';

const AI_UNAVAILABLE_MESSAGE =
  'عذراً، الخدمة الذكية غير متاحة حالياً. يرجى المحاولة لاحقاً.';

export async function POST(req: NextRequest) {
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
    const message =
      body && typeof body === 'object' && 'message' in body
        ? (body as { message?: unknown }).message
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

    // Check limits
    if (user.plan === 'free' && (user.freeReportsUsed || 0) >= 2) {
      return NextResponse.json({ error: 'Free limit reached. Upgrade to continue.' }, { status: 403 });
    }

    // Get Report Context
    const latestReport = await dbService.getLatestReport(user.id);
    if (!latestReport) {
      return NextResponse.json({ error: 'No report found. Please generate an analysis first.' }, { status: 404 });
    }

    let reportContext: string;
    try {
      reportContext = boundedReportContext(latestReport.reportJson);
    } catch {
      console.error('[analysis/chat] Stored report context is invalid');
      return NextResponse.json(
        { error: 'تعذر قراءة تقريرك حالياً. يرجى إنشاء تحليل جديد.' },
        { status: 422 }
      );
    }

    // Prepare System Prompt with Context
    const systemPrompt = `
      You are a helpful Saudi ecommerce assistant.
      You have access to the following analysis report of the user's store:
      ${reportContext}
      
      Answer the user's questions based on this report.
      Speak in professional but friendly Arabic.
      Keep answers concise and actionable.
    `;

    const apiKey = getRuntimeString('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('[analysis/chat] OpenAI configuration missing');
      return NextResponse.json(
        { error: AI_UNAVAILABLE_MESSAGE },
        { status: 503 }
      );
    }

    try {
      const db = await getDb();
      const quota = await consumeAiChatQuota({
        db,
        userId: user.id,
        plan: user.plan,
      });
      if (!quota.allowed) {
        return NextResponse.json(
          { error: 'تم بلوغ حد استخدام المساعد مؤقتاً. يرجى المحاولة لاحقاً.' },
          {
            status: 429,
            headers: { 'Retry-After': String(quota.retryAfterSeconds) },
          }
        );
      }
      const reply = await requestOpenAIChat({
        apiKey,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: normalizedMessage },
        ],
        temperature: 0.7,
        maxTokens: AI_CHAT_MAX_TOKENS,
      });
      return NextResponse.json({ reply });
    } catch (error) {
      if (!(error instanceof OpenAIChatError)) {
        console.error('[analysis/chat] Quota storage unavailable');
        return NextResponse.json(
          { error: 'الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.' },
          { status: 503 }
        );
      }
      const diagnostic =
        { kind: error.kind, status: error.status };
      console.error('[analysis/chat] OpenAI request failed', diagnostic);
      return NextResponse.json(
        { error: AI_UNAVAILABLE_MESSAGE },
        { status: 502 }
      );
    }
  } catch {
    console.error('[analysis/chat] Authentication or data storage unavailable');
    return NextResponse.json(
      { error: 'الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.' },
      { status: 503 }
    );
  }
}
