export const OPENAI_CHAT_MODEL = 'gpt-4o-mini';
export const OPENAI_TIMEOUT_MS = 15_000;

export type OpenAIChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type OpenAIUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
};

export type OpenAIChatResult = {
  content: string;
  model: string;
  usage: OpenAIUsage;
};

export type OpenAIResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        strict: true;
        schema: Record<string, unknown>;
      };
    };

export class OpenAIChatError extends Error {
  constructor(
    public readonly kind: 'timeout' | 'network' | 'provider' | 'invalid_response',
    public readonly status: number | null = null
  ) {
    super(`OpenAI chat request failed: ${kind}`);
    this.name = 'OpenAIChatError';
  }
}

export async function requestOpenAIChat(input: {
  apiKey: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: OpenAIResponseFormat;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<OpenAIChatResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? OPENAI_TIMEOUT_MS
  );

  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          messages: input.messages,
          ...(input.temperature === undefined
            ? {}
            : { temperature: input.temperature }),
          ...(input.maxTokens === undefined
            ? {}
            : { max_tokens: input.maxTokens }),
          ...(input.responseFormat
            ? { response_format: input.responseFormat }
            : {}),
        }),
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new OpenAIChatError('timeout');
    }
    throw new OpenAIChatError('network');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new OpenAIChatError('provider', response.status);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new OpenAIChatError('invalid_response', response.status);
  }

  const content =
    data &&
    typeof data === 'object' &&
    'choices' in data &&
    Array.isArray((data as { choices?: unknown }).choices)
      ? (data as { choices: Array<{ message?: { content?: unknown } }> })
          .choices[0]?.message?.content
      : null;
  if (typeof content !== 'string' || !content.trim()) {
    throw new OpenAIChatError('invalid_response', response.status);
  }

  const record = data as {
    model?: unknown;
    usage?: {
      prompt_tokens?: unknown;
      completion_tokens?: unknown;
      total_tokens?: unknown;
      prompt_tokens_details?: {
        cached_tokens?: unknown;
        cache_write_tokens?: unknown;
      };
    };
  };
  const numberOrZero = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.trunc(value)
      : 0;
  const inputTokens = numberOrZero(record.usage?.prompt_tokens);
  const outputTokens = numberOrZero(record.usage?.completion_tokens);
  const reportedTotal = numberOrZero(record.usage?.total_tokens);

  return {
    content: content.trim(),
    model:
      typeof record.model === 'string' && record.model.trim()
        ? record.model.trim()
        : OPENAI_CHAT_MODEL,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: reportedTotal || inputTokens + outputTokens,
      cachedInputTokens: numberOrZero(
        record.usage?.prompt_tokens_details?.cached_tokens
      ),
      cacheWriteTokens: numberOrZero(
        record.usage?.prompt_tokens_details?.cache_write_tokens
      ),
    },
  };
}
