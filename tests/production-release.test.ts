import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  AI_OBSERVABILITY_COLUMNS,
  AI_METERING_COLUMNS,
  APPROVED_EXPECTED_WRITES,
  EXECUTION_APPROVAL,
  HARDENING_INDEX_NAMES,
  RELEASE_IDENTITY,
  RELEASE_NAMES,
  applyReleasePlanLocally,
  assertExecutionApproval,
  assertIdentity,
  buildReleasePlan,
  createProductionRehearsalDatabase,
  inspectLocalDatabase,
  normalizeSchemaSql,
  verifyFinalReleaseState,
  watchedCounts,
} from '../scripts/lib/production-release-core.mjs';

function withDatabase(run: (db: ReturnType<typeof createProductionRehearsalDatabase>) => void, auditRows = 0) {
  const db = createProductionRehearsalDatabase({ auditRows });
  try {
    run(db);
  } finally {
    db.close();
  }
}

test('release plan is exact, ledger-safe, and explicitly skips historical 0014', () => {
  withDatabase((db) => {
    const plan = buildReleasePlan(inspectLocalDatabase(db));
    assert.deepEqual(plan.steps.map((step) => step.name), RELEASE_NAMES);
    assert.deepEqual(plan.steps.slice(1, 6).map((step) => step.kind), Array(5).fill('ledger_reconciliation'));
    const skipped = plan.steps[6];
    assert.equal(skipped.name, '0014_how_it_works_video.sql');
    assert.equal(skipped.kind, 'explicit_skip');
    assert.equal(skipped.skipped, true);
    assert.doesNotMatch(skipped.sql, /CREATE\s+TABLE/i);
    assert.equal(plan.workerDeploymentIncluded, false);
    assert.equal(plan.writeBudget.total, APPROVED_EXPECTED_WRITES);
    assert.equal(plan.steps.at(-1)?.name, '0019_admin_observability.sql');
  });
});

test('production baseline fixture matches the canonical store connection index definitions', () => {
  withDatabase((db) => {
    const state = inspectLocalDatabase(db);
    assert.equal(
      state.objects['index:idx_store_connections_user_status']?.sql,
      normalizeSchemaSql('CREATE INDEX idx_store_connections_user_status ON store_connections(userId, status)'),
    );
    assert.equal(
      state.objects['index:idx_store_connections_user_platform']?.sql,
      normalizeSchemaSql('CREATE INDEX idx_store_connections_user_platform ON store_connections(userId, platform)'),
    );
  });
});

test('release identity rejects wrong account, D1, and Worker', () => {
  assert.doesNotThrow(() => assertIdentity({ ...RELEASE_IDENTITY, mode: 'production' }));
  assert.throws(() => assertIdentity({ ...RELEASE_IDENTITY, mode: 'production', accountId: 'wrong' }), /accountId/);
  assert.throws(() => assertIdentity({ ...RELEASE_IDENTITY, mode: 'production', databaseId: 'wrong' }), /databaseId/);
  assert.throws(() => assertIdentity({ ...RELEASE_IDENTITY, mode: 'production', worker: 'wrong' }), /worker/);
});

test('production execution requires exact approval and a fresh Time Travel bookmark', () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  const valid = {
    execute: true,
    approval: EXECUTION_APPROVAL,
    bookmark: 'fresh-bookmark-marker',
    bookmarkCapturedAt: '2026-10-02T11:55:00Z',
    now,
  };
  assert.doesNotThrow(() => assertExecutionApproval(valid));
  assert.throws(() => assertExecutionApproval({ ...valid, approval: '' }), /approval/);
  assert.throws(() => assertExecutionApproval({ ...valid, bookmark: '' }), /bookmark/);
  assert.throws(() => assertExecutionApproval({ ...valid, bookmarkCapturedAt: '2026-10-02T11:40:00Z' }), /not fresh/);
});

test('unexpected schema and unexpected ledger state are rejected', () => {
  withDatabase((db) => {
    db.exec('ALTER TABLE ai_usage_ledger ADD COLUMN unexpected_release_column TEXT');
    assert.throws(() => buildReleasePlan(inspectLocalDatabase(db)), /ai_usage_ledger differs/);
  });
  withDatabase((db) => {
    db.prepare('INSERT INTO d1_migrations(name) VALUES (?)').run('unexpected.sql');
    assert.throws(() => buildReleasePlan(inspectLocalDatabase(db)), /exact ordered prefix/);
  });
});

test('0015 creates only the 19 missing verified indexes', () => {
  withDatabase((db) => {
    const step = buildReleasePlan(inspectLocalDatabase(db)).steps.find((item) => item.name.startsWith('0015_'));
    assert.ok(step);
    assert.equal(step.indexNames?.length, 19);
    assert.equal(HARDENING_INDEX_NAMES.length, 22);
    assert.equal(step.indexNames?.includes('idx_order_items_report'), false);
    assert.equal(step.indexNames?.includes('idx_store_connections_user_platform'), false);
    assert.equal(step.indexNames?.includes('idx_store_connections_user_status'), false);
  });
});

test('complete local release preserves rows and verifies bridge, aggregates, YouTube, and metering', () => {
  withDatabase((db) => {
    const before = inspectLocalDatabase(db);
    const beforeCounts = watchedCounts(before);
    const plan = buildReleasePlan(before);
    applyReleasePlanLocally(db, plan);
    const after = inspectLocalDatabase(db);

    assert.equal(verifyFinalReleaseState(after), true);
    assert.deepEqual(watchedCounts(after), beforeCounts);
    assert.equal(after.aggregateMismatches, 0);
    assert.equal(after.foreignKeyViolations, 0);
    assert.equal(after.quickCheck, 'ok');
    assert.equal(after.counts.user_runtime_summaries, 13);
    assert.equal(after.counts.runtime_admin_summary, 1);
    assert.equal(Object.keys(after.objects).filter((key) => key.startsWith('trigger:runtime_')).length, 16);
    const columns = after.columns as Record<string, Array<{ name: string }>>;
    assert.deepEqual(columns.how_it_works_video.map((column) => column.name), [
      'id', 'youtube_video_id', 'youtube_url', 'enabled', 'updated_by', 'created_at', 'updated_at',
    ]);
    assert.deepEqual(columns.ai_usage_ledger.map((column) => column.name), AI_OBSERVABILITY_COLUMNS);
    assert.equal(after.counts.admin_observability_summary, 1);
    assert.equal(after.counts.admin_plan_summary, 5);
    assert.equal(Object.keys(after.objects).filter((key) => key === 'trigger:admin_ai_usage_finalize' || key.startsWith('trigger:admin_obs_')).length, 27);
    assert.ok(AI_METERING_COLUMNS.every((name) => AI_OBSERVABILITY_COLUMNS.includes(name)));
    assert.equal(after.objects['table:how_it_works_video']?.sql.includes('stream_uid'), false);

    const second = buildReleasePlan(after);
    assert.equal(second.steps.length, 0);
    assert.equal(second.writeBudget.total, 0);
  }, 2);
});

test('audit bridge preserves history and supports both Worker insert contracts without duplicates', () => {
  withDatabase((db) => {
    applyReleasePlanLocally(db, buildReleasePlan(inspectLocalDatabase(db)));
    db.prepare(`INSERT INTO admin_audit_log
      (id,adminUserId,adminEmail,action,targetType,targetId,metadata,createdAt)
      VALUES (?,?,?,?,?,?,?,?)`).run('legacy-worker', 'retired', 'retired@example.test', 'legacy', 'report', 'report-1', '{}', 10);
    db.prepare(`INSERT INTO admin_audit_log
      (id,admin_id,action,target_type,target_id,metadata_json,created_at)
      VALUES (?,?,?,?,?,?,?)`).run('current-worker', null, 'current', 'report', 'report-2', '{}', 11);
    db.prepare(`INSERT INTO admin_audit_log
      (id,adminUserId,adminEmail,action,createdAt) VALUES (?,?,?,?,?)`)
      .run('legacy-worker', 'retired', 'retired@example.test', 'duplicate', 12);

    const legacy = db.prepare('SELECT * FROM admin_audit_log WHERE id=?').get('legacy-worker') as Record<string, unknown>;
    const current = db.prepare('SELECT * FROM admin_audit_log WHERE id=?').get('current-worker') as Record<string, unknown>;
    assert.equal(legacy.created_at, 10);
    assert.equal(legacy.target_type, 'report');
    assert.equal(current.createdAt, 11);
    assert.equal(current.targetType, 'report');
    assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM admin_audit_log WHERE id='legacy-worker'`).get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM admin_audit_log_legacy_20261001').get().count, 2);
  }, 2);
});

test('write budget aborts when production cardinality materially exceeds approval', () => {
  withDatabase((db) => {
    const insert = db.prepare(`INSERT INTO products
      (id,userId,platform,externalId,title,sku,priceHalala,inventory,category,createdAt,updatedAt,reportId)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (let index = 0; index < 500; index += 1) {
      insert.run(`budget-product-${index}`, 'user-0', 'synthetic', `budget-${index}`, 'Budget', `budget-${index}`, 1, 1, 'test', 1, 1, null);
    }
    assert.throws(() => buildReleasePlan(inspectLocalDatabase(db)), /exceed approved maximum/);
  });
});

test('release mechanism contains no automatic Worker deployment', () => {
  const runner = readFileSync(path.join(process.cwd(), 'scripts', 'production-release.mjs'), 'utf8');
  const rehearsal = readFileSync(path.join(process.cwd(), 'scripts', 'rehearse-production-release.mjs'), 'utf8');
  const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  assert.doesNotMatch(runner, /wrangler\s+deploy|cf:deploy/);
  assert.doesNotMatch(rehearsal, /wrangler\s+deploy|cf:deploy/);
  assert.doesNotMatch(packageJson.scripts['d1:release:production:execute'], /deploy/);
  assert.equal(packageJson.scripts.deploy, undefined);
  assert.equal(packageJson.scripts.release, undefined);
});

test('remote migration apply uses supported Wrangler arguments and fails closed without retry', () => {
  const runner = readFileSync(path.join(process.cwd(), 'scripts', 'production-release.mjs'), 'utf8');
  const applyFunction = runner.match(
    /function applyRemoteMigrationStep\(step\) \{[\s\S]*?\n\}\n\nfunction assertSourceCountsPreserved/,
  )?.[0];
  const executionLoop = runner.match(
    /const appliedSteps = \[\];[\s\S]*?const finalState = inspectRemoteState\(\);/,
  )?.[0];

  assert.ok(applyFunction);
  assert.match(applyFunction, /'d1',\s*'migrations',\s*'apply'/);
  assert.match(applyFunction, /RELEASE_IDENTITY\.database/);
  assert.match(applyFunction, /'--remote'/);
  assert.match(applyFunction, /'--config',\s*configPath/);
  assert.match(applyFunction, /'--profile',\s*RELEASE_IDENTITY\.profile/);
  assert.doesNotMatch(applyFunction, /'--yes'/);
  assert.match(runner, /CI: 'true'/);
  assert.match(runner, /assertExecutionApproval\(/);
  assert.match(runner, /execFileSync\(/);
  assert.ok(executionLoop);
  assert.equal(executionLoop.match(/applyRemoteMigrationStep\(step\)/g)?.length, 1);
  assert.ok(executionLoop.indexOf('applyRemoteMigrationStep(step)') < executionLoop.indexOf('appliedSteps.push(step.name)'));
  assert.doesNotMatch(executionLoop, /catch|retry/i);
});

test('Production verification uses supported D1 checks and retains targeted invariants', () => {
  const runner = readFileSync(path.join(process.cwd(), 'scripts', 'production-release.mjs'), 'utf8');
  const core = readFileSync(path.join(process.cwd(), 'scripts', 'lib', 'production-release-core.mjs'), 'utf8');

  assert.doesNotMatch(runner, /PRAGMA integrity_check/);
  assert.match(runner, /PRAGMA quick_check/);
  assert.match(runner, /PRAGMA foreign_key_check/);
  assert.match(core, /runtime aggregate mismatches/);
  assert.match(core, /runtime user summary count does not match users/);
  assert.match(core, /audit backup count does not match the compatibility table/);
  assert.doesNotMatch(runner, /time-travel\s+restore|wrangler\s+deploy/i);
  assert.ok(runner.indexOf('const initialState = inspectRemoteState()') < runner.indexOf('const plan = buildReleasePlan(initialState)'));
});

test('release resumes from verified 0016 state with only 0017 through 0019', () => {
  withDatabase((db) => {
    const initialPlan = buildReleasePlan(inspectLocalDatabase(db));
    applyReleasePlanLocally(db, { ...initialPlan, steps: initialPlan.steps.slice(0, 9) });

    const partialState = inspectLocalDatabase(db);
    const beforeCounts = watchedCounts(partialState);
    const resumePlan = buildReleasePlan(partialState);
    assert.deepEqual(resumePlan.steps.map((step) => step.name), RELEASE_NAMES.slice(9));
    assert.equal(resumePlan.writeBudget.total, 2_582);
    assert.equal(resumePlan.writeBudget.priorEstimatedWrites, 8_580);
    assert.equal(resumePlan.writeBudget.cumulativeEstimatedWrites, APPROVED_EXPECTED_WRITES);
    assert.equal(partialState.quickCheck, 'ok');
    assert.equal(partialState.foreignKeyViolations, 0);
    assert.equal(partialState.aggregateMismatches, 0);

    applyReleasePlanLocally(db, resumePlan);
    const finalState = inspectLocalDatabase(db);
    assert.equal(verifyFinalReleaseState(finalState), true);
    assert.deepEqual(watchedCounts(finalState), beforeCounts);
    const idempotentPlan = buildReleasePlan(finalState);
    assert.equal(idempotentPlan.steps.length, 0);
    assert.equal(idempotentPlan.writeBudget.total, 0);
  });
});
