import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPENAI_CHAT_MODEL,
  OpenAIChatError,
  requestOpenAIChat,
} from '../src/lib/ai/openai-chat';

test('OpenAI chat returns validated text and uses the supported model', async () => {
  let requestBody: Record<string, unknown> = {};
  const reply = await requestOpenAIChat({
    apiKey: 'test-key',
    messages: [{ role: 'user', content: 'مرحبا' }],
    maxTokens: 400,
    fetchImpl: async (_url, init) => {
      const parsed: unknown = JSON.parse(String(init?.body));
      assert.ok(typeof parsed === 'object' && parsed !== null);
      requestBody = parsed as Record<string, unknown>;
      return Response.json({
        choices: [{ message: { content: '  إجابة مفيدة  ' } }],
      });
    },
  });

  assert.equal(reply, 'إجابة مفيدة');
  assert.equal(requestBody.model, OPENAI_CHAT_MODEL);
  assert.equal(requestBody.max_tokens, 400);
});

test('OpenAI chat rejects provider failures without exposing response bodies', async () => {
  await assert.rejects(
    requestOpenAIChat({
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'مرحبا' }],
      fetchImpl: async () =>
        new Response('secret provider detail', { status: 429 }),
    }),
    (error: unknown) =>
      error instanceof OpenAIChatError &&
      error.kind === 'provider' &&
      error.status === 429 &&
      !error.message.includes('secret provider detail')
  );
});

test('OpenAI chat rejects malformed successful responses', async () => {
  await assert.rejects(
    requestOpenAIChat({
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'مرحبا' }],
      fetchImpl: async () => Response.json({ choices: [] }),
    }),
    (error: unknown) =>
      error instanceof OpenAIChatError &&
      error.kind === 'invalid_response'
  );
});