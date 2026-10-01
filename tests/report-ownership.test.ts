import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  resolveReportForUser,
  type OwnedReportLookup,
} from '../src/lib/reports/ownership';

interface TestReport {
  id: string;
  userId: string;
  reportJson: string;
}

class FakeReports implements OwnedReportLookup<TestReport> {
  constructor(private readonly reports: TestReport[]) {}

  async getLatestReport(userId: string) {
    return this.reports.find((report) => report.userId === userId) ?? null;
  }

  async getReportForUser(userId: string, reportId: string) {
    return (
      this.reports.find(
        (report) => report.id === reportId && report.userId === userId
      ) ?? null
    );
  }

  async updateReportJsonForUser(
    userId: string,
    reportId: string,
    reportJson: string
  ) {
    const report = await this.getReportForUser(userId, reportId);
    if (report) report.reportJson = reportJson;
  }
}

const userAReport = {
  id: 'report-a',
  userId: 'user-a',
  reportJson: '{"owner":"a"}',
};
const userBReport = {
  id: 'report-b',
  userId: 'user-b',
  reportJson: '{"owner":"b"}',
};

test('a user can resolve their own report by ID', async () => {
  const reports = new FakeReports([userAReport, userBReport]);

  const report = await resolveReportForUser(reports, 'user-a', 'report-a');

  assert.equal(report?.id, 'report-a');
});

test('a cross-tenant report ID is indistinguishable from a missing ID', async () => {
  const reports = new FakeReports([userAReport, userBReport]);

  const crossTenant = await resolveReportForUser(
    reports,
    'user-b',
    'report-a'
  );
  const missing = await resolveReportForUser(
    reports,
    'user-b',
    'report-missing'
  );

  assert.equal(crossTenant, null);
  assert.equal(missing, null);
});

test('the default report remains scoped to the authenticated user', async () => {
  const reports = new FakeReports([userAReport, userBReport]);

  const report = await resolveReportForUser(reports, 'user-b', null);

  assert.equal(report?.id, 'report-b');
});

test('scoped updates cannot overwrite another user report', async () => {
  const reports = new FakeReports([
    { ...userAReport },
    { ...userBReport },
  ]);

  await reports.updateReportJsonForUser(
    'user-b',
    'report-a',
    '{"overwritten":true}'
  );

  const ownerView = await reports.getReportForUser('user-a', 'report-a');
  assert.equal(ownerView?.reportJson, '{"owner":"a"}');
});

test('an owner can still update and read their report', async () => {
  const reports = new FakeReports([
    { ...userAReport },
    { ...userBReport },
  ]);

  await reports.updateReportJsonForUser(
    'user-a',
    'report-a',
    '{"updated":true}'
  );

  const ownerView = await reports.getReportForUser('user-a', 'report-a');
  assert.equal(ownerView?.reportJson, '{"updated":true}');
});

test('deferred dashboard report details remain authenticated, owner-scoped, and private', async () => {
  const [route, dashboardData, dashboardClient] = await Promise.all([
    readFile(new URL('../src/app/api/reports/detail/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/lib/dashboard/data.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/(authenticated)/dashboard/dashboard-client.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(route, /getCurrentUser\(\)/);
  assert.match(route, /getDashboardReportForUser\(user\.id, reportId\)/);
  assert.match(route, /private, no-store/);
  assert.match(dashboardData, /WHERE id = \? AND userId = \?/);
  assert.match(dashboardClient, /IntersectionObserver/);
  assert.match(dashboardClient, /dynamic\(/);
  assert.match(dashboardClient, /api\/reports\/detail\?reportId=/);
});
