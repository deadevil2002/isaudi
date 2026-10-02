import {
  APPROVED_EXPECTED_WRITES,
  RELEASE_NAMES,
  applyReleasePlanLocally,
  buildReleasePlan,
  createProductionRehearsalDatabase,
  inspectLocalDatabase,
  verifyFinalReleaseState,
  watchedCounts,
} from './lib/production-release-core.mjs';

const db = createProductionRehearsalDatabase();

try {
  const before = inspectLocalDatabase(db);
  const beforeCounts = watchedCounts(before);
  const firstPlan = buildReleasePlan(before);
  applyReleasePlanLocally(db, firstPlan);

  const after = inspectLocalDatabase(db);
  verifyFinalReleaseState(after);
  const afterCounts = watchedCounts(after);
  if (JSON.stringify(beforeCounts) !== JSON.stringify(afterCounts)) {
    throw new Error('Local rehearsal changed source business row counts');
  }

  const secondPlan = buildReleasePlan(after);
  if (secondPlan.steps.length !== 0 || secondPlan.writeBudget.total !== 0) {
    throw new Error('Second rehearsal was not idempotent');
  }

  console.log(JSON.stringify({
    mode: 'local-rehearsal',
    success: true,
    releaseSteps: firstPlan.steps.map((step) => ({
      name: step.name,
      kind: step.kind,
      skipped: Boolean(step.skipped),
      indexCount: step.indexNames?.length ?? null,
    })),
    expectedSequence: RELEASE_NAMES,
    expectedWrites: firstPlan.writeBudget,
    approvedExpectedWrites: APPROVED_EXPECTED_WRITES,
    integrity: after.integrity,
    foreignKeyViolations: after.foreignKeyViolations,
    aggregateMismatches: after.aggregateMismatches,
    sourceCountsPreserved: true,
    secondRunOperations: secondPlan.steps.length,
    workerDeploymentIncluded: false,
    productionTouched: false,
  }, null, 2));
} finally {
  db.close();
}
