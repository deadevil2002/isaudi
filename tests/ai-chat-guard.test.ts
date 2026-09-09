import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_CHAT_CONTEXT_MAX_BYTES,
  AI_CHAT_MAX_TOKENS,
  AI_CHAT_MESSAGE_MAX_LENGTH,
  aiChatLimitForPlan,
  boundedReportContext,
  consumeAiChatQuota,
} from '../src/lib/ai/chat-guard';

test('AI input and output budgets are strict and finite', () => {
  assert.equal(AI_CHAT_MESSAGE_MAX_LENGTH, 2_000);
  assert.equal(AI_CHAT_MAX_TOKENS, 400);
  assert.ok(AI_CHAT_CONTEXT_MAX_BYTES <= 24_000);
});

test('report context is validly serialized and bounded by bytes', () => {
  const context = boundedReportContext(
    JSON.stringify({ summary: 'س'.repeat(30_000) })
  );
  assert.ok(
    new TextEncoder().encode(context).byteLength <= AI_CHAT_CONTEXT_MAX_BYTES
  );
  assert.match(context, /تم اختصار سياق التقرير/);
  assert.equal(boundedReportContext('{"safe":true}'), '{"safe":true}');
  assert.throws(() => boundedReportContext('{invalid'));
});

test('atomic quota allows only the plan limit under concurrent requests', async () => {
  const counts = new Map<string, number>();
  let queue = Promise.resolve();
  const db = {
    prepare() {
      return {
        async run() {
          return {};
        },
        async get(userId: unknown, windowStart: unknown, _expires: unknown, limit: unknown) {
          let row: { count: number } | null = null;
          queue = queue.then(() => {
            const key = `${userId}:${windowStart}`;
            const count = counts.get(key) ?? 0;
            if (count < Number(limit)) {
              counts.set(key, count + 1);
              row = { count: count + 1 };
            }
          });
          await queue;
          return row;
        },
      };
    },
  };
  const limit = aiChatLimitForPlan('free');
  const attempts = await Promise.all(
    Array.from({ length: limit + 5 }, () =>
      consumeAiChatQuota({
        db,
        userId: 'user-1',
        plan: 'free',
        now: 1_800_000_000_000,
      })
    )
  );

  assert.equal(attempts.filter((result) => result.allowed).length, limit);
  assert.equal(attempts.filter((result) => !result.allowed).length, 5);
});