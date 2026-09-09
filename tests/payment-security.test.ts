import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateTapPaymentAtomically,
  resolveTapPlan,
  validateTapPayment,
} from '../src/lib/billing/tap';

const payment = {
  providerPaymentId: 'chg_123',
  userId: 'user_1',
  planId: 'enterprise',
  interval: 'year',
  amountHalala: 899_900,
  currency: 'SAR',
};
const provider = {
  providerId: 'chg_123',
  providerStatus: 'CAPTURED',
  providerAmount: 8999,
  providerCurrency: 'SAR',
  metadata: { userId: 'user_1', plan: 'enterprise', interval: 'year' },
};

test('server catalog is authoritative and maps enterprise checkout to business entitlement', () => {
  assert.deepEqual(resolveTapPlan('enterprise', 'year'), {
    checkoutPlanId: 'enterprise',
    entitlementPlanId: 'business',
    interval: 'year',
    amountHalala: 899_900,
    currency: 'SAR',
  });
  assert.equal(resolveTapPlan('unknown', 'month'), null);
  assert.equal(resolveTapPlan('growth', 'week'), null);
});

test('valid captured payment passes all integrity checks', () => {
  assert.equal(validateTapPayment({ ...provider, payment, expectedUserId: 'user_1' }).ok, true);
});

for (const [name, override, reason] of [
  ['unknown payment id', { providerId: 'chg_other' }, 'payment_id'],
  ['wrong amount', { providerAmount: 1 }, 'amount'],
  ['wrong currency', { providerCurrency: 'USD' }, 'currency'],
  [
    'wrong plan mapping',
    { metadata: { userId: 'user_1', plan: 'growth', interval: 'year' } },
    'metadata',
  ],
  ['failed transaction', { providerStatus: 'FAILED' }, 'status'],
] as const) {
  test(`${name} is rejected`, () => {
    assert.deepEqual(validateTapPayment({ ...provider, ...override, payment }), {
      ok: false,
      reason,
    });
  });
}

test('payment owned by another user is rejected', () => {
  assert.deepEqual(
    validateTapPayment({ ...provider, payment, expectedUserId: 'user_2' }),
    { ok: false, reason: 'ownership' }
  );
});

test('exact and concurrent duplicates activate only once', async () => {
  let status = 'pending';
  let mutations = 0;
  const claim = () =>
    activateTapPaymentAtomically({
      db: {
        batch: async () => {
          if (status !== 'pending') return [{ meta: { changes: 0 } }];
          status = 'captured';
          mutations += 1;
          return [{ meta: { changes: 1 } }];
        },
      },
      paymentId: 'payment_1',
      providerPaymentId: 'chg_123',
      userId: 'user_1',
      entitlementPlanId: 'business',
      interval: 'year',
      now: 100,
      expiresAt: 200,
      token: 'claim-token',
    });

  const results = await Promise.all([claim(), claim(), claim()]);
  assert.equal(mutations, 1);
  assert.equal(results.filter((value) => value === 'activated').length, 1);
  assert.equal(results.filter((value) => value === 'duplicate').length, 2);
  assert.equal(await claim(), 'duplicate');
});

test('a charge cannot activate a different subscription', async () => {
  let calls = 0;
  const result = await activateTapPaymentAtomically({
    db: {
      batch: async () => {
        calls += 1;
        return [{ meta: { changes: 0 } }];
      },
    },
    paymentId: 'payment_other',
    providerPaymentId: 'chg_123',
    userId: 'user_1',
    entitlementPlanId: 'business',
    interval: 'year',
    now: 100,
    expiresAt: 200,
    token: 'claim-token',
  });
  assert.equal(result, 'duplicate');
  assert.equal(calls, 1);
});