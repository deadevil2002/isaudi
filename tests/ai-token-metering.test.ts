import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { finalizeAiUsage } from '../src/lib/ai/usage-ledger';

test('AI usage finalization records model and all provider token counters in one write', async () => {
  let sql = '';
  let params: unknown[] = [];
  const db = {
    prepare(statement: string) {
      sql = statement;
      return {
        get: async (...values: unknown[]) => {
          params = values;
          return { id: 'usage-1' };
        },
        run: async () => undefined,
      };
    },
  };

  await finalizeAiUsage({
    db,
    reservationId: 'usage-1',
    status: 'succeeded',
    now: 1234,
    metering: {
      model: 'gpt-4o-mini',
      reportId: 'report-1',
      sourceHash: 'source-hash',
      inputTokens: 200,
      outputTokens: 80,
      totalTokens: 280,
      cachedInputTokens: 128,
      cacheWriteTokens: 64,
    },
  });

  assert.match(sql, /input_tokens = \?/);
  assert.match(sql, /cached_input_tokens = \?/);
  assert.match(sql, /cache_write_tokens = \?/);
  assert.deepEqual(params, [
    'succeeded', 1234, 1234, 'gpt-4o-mini', 'report-1', 'source-hash',
    200, 80, 280, 128, 64, 'usage-1',
  ]);
});

test('metering migration stores only bounded accounting fields, never prompts or secrets', async () => {
  const migration = await readFile(
    new URL('../migrations/0018_ai_usage_metering.sql', import.meta.url),
    'utf8'
  );
  for (const column of [
    'model', 'report_id', 'source_hash', 'input_tokens', 'output_tokens',
    'total_tokens', 'cached_input_tokens', 'cache_write_tokens',
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN ${column}`));
  }
  assert.doesNotMatch(migration, /prompt|api_key|content/i);
});
