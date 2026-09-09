import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_GENERATION_MAX_TOKENS,
  aiUsageCeilings,
  runGenerationProvider,
} from '../src/lib/ai/usage-ledger';

test('generation ceilings are plan-specific and include hourly, daily, and concurrency limits', () => {
  const free = aiUsageCeilings('generate', 'free');
  const paid = aiUsageCeilings('generate', 'pro');

  assert.deepEqual(free, { hourly: 2, daily: 2, concurrent: 1 });
  assert.deepEqual(paid, { hourly: 6, daily: 24, concurrent: 1 });
  assert.equal(AI_GENERATION_MAX_TOKENS, 600);
});

test('duplicate generation returns stored work without reservation or provider call', async () => {
  let reservations = 0;
  let providerCalls = 0;
  const result = await runGenerationProvider({
    duplicate: 'stored-report',
    entitled: true,
    reserve: async () => {
      reservations += 1;
      return true;
    },
    finalize: async () => undefined,
    provider: async () => {
      providerCalls += 1;
      return 'new-report';
    },
  });

  assert.deepEqual(result, { kind: 'duplicate', value: 'stored-report' });
  assert.equal(reservations, 0);
  assert.equal(providerCalls, 0);
});

test('exhausted entitlement blocks reservation and provider calls', async () => {
  let reservations = 0;
  let providerCalls = 0;
  const result = await runGenerationProvider({
    entitled: false,
    reserve: async () => {
      reservations += 1;
      return true;
    },
    finalize: async () => undefined,
    provider: async () => {
      providerCalls += 1;
      return 'new-report';
    },
  });

  assert.deepEqual(result, { kind: 'entitlement_exhausted' });
  assert.equal(reservations, 0);
  assert.equal(providerCalls, 0);
});

test('quota storage failure fails closed without calling provider', async () => {
  let providerCalls = 0;
  const result = await runGenerationProvider({
    entitled: true,
    reserve: async () => {
      throw new Error('database unavailable');
    },
    finalize: async () => undefined,
    provider: async () => {
      providerCalls += 1;
      return 'new-report';
    },
  });

  assert.deepEqual(result, { kind: 'storage_unavailable' });
  assert.equal(providerCalls, 0);
});

test('provider reservations are finalized for both success and failure', async () => {
  const statuses: string[] = [];
  const success = await runGenerationProvider({
    entitled: true,
    reserve: async () => true,
    finalize: async (status) => {
      statuses.push(status);
    },
    provider: async () => 'report',
  });
  const failure = await runGenerationProvider({
    entitled: true,
    reserve: async () => true,
    finalize: async (status) => {
      statuses.push(status);
    },
    provider: async () => {
      throw new Error('provider failed');
    },
  });

  assert.equal(success.kind, 'completed');
  assert.equal(failure.kind, 'provider_failed');
  assert.deepEqual(statuses, ['succeeded', 'failed']);
});

test('concurrency reservation permits only one simultaneous provider call', async () => {
  let activeLease = false;
  let providerCalls = 0;
  let releaseProvider: (() => void) | undefined;
  const providerBarrier = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  const run = () =>
    runGenerationProvider({
      entitled: true,
      reserve: async () => {
        if (activeLease) return false;
        activeLease = true;
        return true;
      },
      finalize: async () => {
        activeLease = false;
      },
      provider: async () => {
        providerCalls += 1;
        await providerBarrier;
        return 'new-report';
      },
    });

  const attempts = [run(), run(), run(), run()];
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(providerCalls, 1);
  releaseProvider?.();
  const results = await Promise.all(attempts);
  assert.equal(
    results.filter((result) => result.kind === 'completed').length,
    1
  );
  assert.equal(
    results.filter((result) => result.kind === 'quota_exhausted').length,
    3
  );
});