import { describe, it, expect } from 'vitest';
import {
  isExistingNativeTimestamp,
  parseLegacyExpiryDate,
  createTimestampRepresentation,
  evaluateSubscriptionForBackfill,
  evaluateBackfillBatch,
  executeBackfillRunner,
  createMockBackfillAdapter,
  createRestBackfillAdapter,
  parseAndValidateCliArgs,
  resolveTargetProjectId,
  validateProjectConfirmation,
  MockFirestoreDoc,
  SubscriptionRecordLike,
} from '../scripts/backfillLegacySubscriptionTimestamps';

describe('Administrative Backfill: Legacy Subscription Timestamp Migration', () => {
  const referenceNowMs = new Date('2026-11-09T00:00:00.000Z').getTime();

  // ============================================================================
  // 1. Precise Date Parsing & Millisecond Preservation
  // ============================================================================
  describe('1. Precise Date Parsing & Millisecond Preservation', () => {
    it('accurately parses standard UTC ISO string with milliseconds', () => {
      const raw = '2026-12-15T18:45:30.456Z';
      const result = parseLegacyExpiryDate(raw);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.isoString).toBe('2026-12-15T18:45:30.456Z');
        expect(result.date.getUTCFullYear()).toBe(2026);
        expect(result.date.getUTCMonth()).toBe(11); // 0-indexed: December
        expect(result.date.getUTCDate()).toBe(15);
        expect(result.date.getUTCHours()).toBe(18);
        expect(result.date.getUTCMinutes()).toBe(45);
        expect(result.date.getUTCSeconds()).toBe(30);
        expect(result.date.getUTCMilliseconds()).toBe(456);
      }
    });

    it('accurately parses UTC ISO string without milliseconds and preserves exact seconds', () => {
      const raw = '2026-12-15T18:45:30Z';
      const result = parseLegacyExpiryDate(raw);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.isoString).toBe('2026-12-15T18:45:30.000Z');
        expect(result.date.getUTCMilliseconds()).toBe(0);
        expect(result.date.getUTCSeconds()).toBe(30);
      }
    });

    it('correctly handles and normalizes timezone offsets to exact UTC instant', () => {
      // 2026-12-15T23:30:00+05:30 is 18:00:00 UTC
      const rawWithOffset = '2026-12-15T23:30:00.000+05:30';
      const result = parseLegacyExpiryDate(rawWithOffset);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.date.toISOString()).toBe('2026-12-15T18:00:00.000Z');
      }
    });

    it('preserves exact fractional milliseconds (.999) without truncation or rounding to midnight', () => {
      const raw = '2026-12-31T23:59:59.999Z';
      const result = parseLegacyExpiryDate(raw);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.date.getUTCMilliseconds()).toBe(999);
        const rep = createTimestampRepresentation(result.millis);
        expect(rep.seconds).toBe(Math.floor(result.millis / 1000));
        expect(rep.nanoseconds).toBe(999000000);
      }
    });
  });

  // ============================================================================
  // 2. Malformed & Invalid Date Rejection
  // ============================================================================
  describe('2. Malformed & Invalid Date Handling', () => {
    it('rejects arbitrary non-date string values', () => {
      const invalidStrings = ['not-a-date', 'active', 'null', 'undefined', '2026-99-99T99:99:99Z'];
      for (const str of invalidStrings) {
        const res = parseLegacyExpiryDate(str);
        expect(res.valid).toBe(false);
      }
    });

    it('rejects empty strings and non-string types', () => {
      expect(parseLegacyExpiryDate('')).toMatchObject({ valid: false });
      expect(parseLegacyExpiryDate(null)).toMatchObject({ valid: false });
      expect(parseLegacyExpiryDate(undefined)).toMatchObject({ valid: false });
      expect(parseLegacyExpiryDate(1734288000000)).toMatchObject({ valid: false });
      expect(parseLegacyExpiryDate(true)).toMatchObject({ valid: false });
    });

    it('evaluates record with malformed date as invalid_date_format for manual review', () => {
      const badRecord: SubscriptionRecordLike = {
        id: 'usr_corrupt_101',
        status: 'active',
        plan_tier: 'pro',
        current_period_end: 'CORRUPTED_VALUE_XYZ',
      };

      const evalResult = evaluateSubscriptionForBackfill(badRecord, referenceNowMs);
      expect(evalResult.action).toBe('invalid_date_format');
      if (evalResult.action === 'invalid_date_format') {
        expect(evalResult.userId).toBe('usr_corrupt_101');
        expect(evalResult.rawValue).toBe('CORRUPTED_VALUE_XYZ');
        expect(evalResult.error).toContain('ISO 8601');
      }
    });
  });

  // ============================================================================
  // 3. Skip Conditions: Existing Native Timestamps & Missing Expiry
  // ============================================================================
  describe('3. Skip Conditions', () => {
    it('detects existing native Firestore Timestamp instance with toDate() and skips', () => {
      const d = new Date('2026-12-15T00:00:00Z');
      const mockTimestamp = {
        seconds: 1797292800,
        nanoseconds: 0,
        toDate: () => d,
        toMillis: () => d.getTime(),
      };

      expect(isExistingNativeTimestamp(mockTimestamp)).toBe(true);

      const record: SubscriptionRecordLike = {
        id: 'usr_has_timestamp',
        status: 'active',
        plan_tier: 'paid',
        current_period_end: '2026-12-15T00:00:00.000Z',
        period_end_timestamp: mockTimestamp,
      };

      const evalResult = evaluateSubscriptionForBackfill(record, referenceNowMs);
      expect(evalResult.action).toBe('skip_already_has_timestamp');
      if (evalResult.action === 'skip_already_has_timestamp') {
        expect(evalResult.userId).toBe('usr_has_timestamp');
      }
    });

    it('detects serialized timestamp object (_seconds / nanoseconds) and skips', () => {
      const serializedTs = { _seconds: 1797292800, _nanoseconds: 0 };
      expect(isExistingNativeTimestamp(serializedTs)).toBe(true);

      const record: SubscriptionRecordLike = {
        id: 'usr_serialized_ts',
        status: 'active',
        period_end_timestamp: serializedTs,
      };

      const evalResult = evaluateSubscriptionForBackfill(record, referenceNowMs);
      expect(evalResult.action).toBe('skip_already_has_timestamp');
    });

    it('detects Firestore REST timestampValue object and skips', () => {
      const restTs = { timestampValue: '2026-12-15T00:00:00.000Z' };
      expect(isExistingNativeTimestamp(restTs)).toBe(true);

      const record: SubscriptionRecordLike = {
        id: 'usr_rest_ts',
        status: 'active',
        period_end_timestamp: restTs,
      };

      const evalResult = evaluateSubscriptionForBackfill(record, referenceNowMs);
      expect(evalResult.action).toBe('skip_already_has_timestamp');
    });

    it('skips record when current_period_end field is completely missing (e.g. free user)', () => {
      const freeRecord: SubscriptionRecordLike = {
        id: 'usr_free_student',
        status: 'free',
        plan_tier: 'free',
      };

      const evalResult = evaluateSubscriptionForBackfill(freeRecord, referenceNowMs);
      expect(evalResult.action).toBe('skip_no_expiry_field');
    });
  });

  // ============================================================================
  // 4. Eligible Records (Active vs Expired) & Zero Privilege Creep
  // ============================================================================
  describe('4. Eligible Records & Zero Privilege Creep', () => {
    it('evaluates active unexpired pro record as eligible for backfill', () => {
      // Expiry is December 2026, relative to November 2026
      const record: SubscriptionRecordLike = {
        id: 'usr_unexpired_pro',
        status: 'active',
        plan_tier: 'pro',
        current_period_end: '2026-12-25T14:20:00.000Z',
      };

      const evalResult = evaluateSubscriptionForBackfill(record, referenceNowMs);
      expect(evalResult.action).toBe('backfill');
      if (evalResult.action === 'backfill') {
        expect(evalResult.userId).toBe('usr_unexpired_pro');
        expect(evalResult.isExpired).toBe(false);
        expect(evalResult.planTier).toBe('pro');
        expect(evalResult.targetTimestamp.isoString).toBe('2026-12-25T14:20:00.000Z');
      }
    });

    it('evaluates expired legacy record accurately without granting access or altering status', () => {
      // Expiry is October 2026, relative to November 2026
      const record: SubscriptionRecordLike = {
        id: 'usr_expired_cohort',
        status: 'active', // Might still have active in document before expiration check
        plan_tier: 'cohort',
        current_period_end: '2026-10-15T00:00:00.000Z',
      };

      const evalResult = evaluateSubscriptionForBackfill(record, referenceNowMs);
      expect(evalResult.action).toBe('backfill');
      if (evalResult.action === 'backfill') {
        expect(evalResult.userId).toBe('usr_expired_cohort');
        expect(evalResult.isExpired).toBe(true);
        // Preserves exact past timestamp (when rules compare request.time < timestamp, it will fail!)
        expect(evalResult.targetTimestamp.isoString).toBe('2026-10-15T00:00:00.000Z');
        expect(evalResult.targetTimestamp.toMillis()).toBeLessThan(referenceNowMs);
      }
    });

    it('supports camelCase currentPeriodEnd as well as snake_case', () => {
      const record: SubscriptionRecordLike = {
        id: 'usr_camel_case',
        status: 'active',
        plan_tier: 'paid',
        currentPeriodEnd: '2026-12-10T09:00:00.000Z',
      };

      const evalResult = evaluateSubscriptionForBackfill(record, referenceNowMs);
      expect(evalResult.action).toBe('backfill');
      if (evalResult.action === 'backfill') {
        expect(evalResult.rawExpiryField).toBe('currentPeriodEnd');
      }
    });
  });

  // ============================================================================
  // 5. Batch Evaluation & Dry Run by Default
  // ============================================================================
  describe('5. Batch Evaluation & Dry Run by Default', () => {
    const mockBatch: SubscriptionRecordLike[] = [
      // 1. Unexpired Pro
      { id: 'usr_1', status: 'active', plan_tier: 'pro', current_period_end: '2026-12-01T12:00:00Z' },
      // 2. Unexpired Cohort
      { id: 'usr_2', status: 'active', plan_tier: 'cohort', current_period_end: '2026-12-15T15:30:00.500Z' },
      // 3. Expired Pro
      { id: 'usr_3', status: 'active', plan_tier: 'pro', current_period_end: '2026-10-01T00:00:00Z' },
      // 4. Already has timestamp
      {
        id: 'usr_4',
        status: 'active',
        plan_tier: 'paid',
        current_period_end: '2026-12-01T00:00:00Z',
        period_end_timestamp: { seconds: 1796083200, nanoseconds: 0 },
      },
      // 5. Free user (no expiry)
      { id: 'usr_5', status: 'free', plan_tier: 'free' },
      // 6. Corrupt date
      { id: 'usr_6', status: 'active', plan_tier: 'pro', current_period_end: 'invalid-date-string' },
    ];

    it('defaults to DRY RUN when isApply is omitted or false', () => {
      const { summary } = evaluateBackfillBatch(mockBatch, referenceNowMs, false);

      expect(summary.dryRun).toBe(true);
      expect(summary.totalScanned).toBe(6);
      expect(summary.eligibleToBackfill).toBe(3); // usr_1, usr_2, usr_3
      expect(summary.activeEligible).toBe(2);      // usr_1, usr_2
      expect(summary.expiredEligible).toBe(1);     // usr_3
      expect(summary.skippedExistingTimestamp).toBe(1); // usr_4
      expect(summary.skippedNoExpiry).toBe(1);           // usr_5
      expect(summary.invalidRecords.length).toBe(1);     // usr_6
      expect(summary.invalidRecords[0].userId).toBe('usr_6');
      expect(summary.appliedWrites).toBe(0);             // DRY RUN: ZERO writes applied!
      expect(summary.planTierDistribution).toEqual({
        pro: 2,
        cohort: 1,
      });
    });

    it('computes appliedWrites equal to eligible count when isApply is true', () => {
      const { summary } = evaluateBackfillBatch(mockBatch, referenceNowMs, true);

      expect(summary.dryRun).toBe(false);
      expect(summary.appliedWrites).toBe(3);
    });
  });

  // ============================================================================
  // 6. Paginated Runner & Firestore Concurrency Safety (Mocked)
  // ============================================================================
  describe('6. Paginated Runner & Firestore Concurrency Safety (Mocked)', () => {
    it('paginates over multiple collection pages using startAfter without missing documents', async () => {
      // 1,200 documents across 3 pages (500, 500, 200)
      const mockDocs: MockFirestoreDoc[] = Array.from({ length: 1200 }, (_, i) => {
        const id = `user_${String(i + 1).padStart(4, '0')}`;
        return {
          id,
          data: {
            id,
            status: 'active',
            plan_tier: 'pro',
            current_period_end: '2026-12-31T23:59:59.000Z',
          },
          updateTime: '2026-11-01T00:00:00.000Z',
        };
      });

      const adapter = createMockBackfillAdapter(mockDocs);
      const pageHistory: Array<{ pageIndex: number; totalScanned: number }> = [];

      const summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 500,
        isApply: false, // DRY RUN
        nowMs: referenceNowMs,
        onPageComplete: (pageIndex, currentSummary) => {
          pageHistory.push({ pageIndex, totalScanned: currentSummary.totalScanned });
        },
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(summary.pagesProcessed).toBe(3);
      expect(summary.totalScanned).toBe(1200);
      expect(summary.eligible).toBe(1200);
      expect(summary.updated).toBe(0); // DRY RUN = 0 writes!
      expect(pageHistory).toEqual([
        { pageIndex: 1, totalScanned: 500 },
        { pageIndex: 2, totalScanned: 1000 },
        { pageIndex: 3, totalScanned: 1200 },
      ]);
    });

    it('handles empty collection gracefully without errors', async () => {
      const adapter = createMockBackfillAdapter([]);
      const summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 500,
        isApply: false,
        nowMs: referenceNowMs,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(summary.pagesProcessed).toBe(1);
      expect(summary.totalScanned).toBe(0);
      expect(summary.eligible).toBe(0);
      expect(summary.updated).toBe(0);
      expect(summary.skipped).toBe(0);
      expect(summary.concurrencyConflicts).toBe(0);
    });

    it('executes in DRY RUN mode with zero writes attempted or applied', async () => {
      const mockDocs: MockFirestoreDoc[] = [
        {
          id: 'usr_dry_1',
          data: { id: 'usr_dry_1', status: 'active', current_period_end: '2026-12-15T00:00:00Z' },
          updateTime: '2026-11-01T00:00:00Z',
        },
        {
          id: 'usr_dry_2',
          data: { id: 'usr_dry_2', status: 'active', current_period_end: '2026-12-20T00:00:00Z' },
          updateTime: '2026-11-01T00:00:00Z',
        },
      ];

      const adapter = createMockBackfillAdapter(mockDocs);
      const summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 500,
        isApply: false, // Explicit dry run
        nowMs: referenceNowMs,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(summary.dryRun).toBe(true);
      expect(summary.eligible).toBe(2);
      expect(summary.updated).toBe(0);
      expect(adapter.getUpdateCalls().length).toBe(0); // ZERO write calls to adapter!
      // In-store documents must be untouched
      expect(adapter.getDocs()[0].data.period_end_timestamp).toBeUndefined();
      expect(adapter.getDocs()[1].data.period_end_timestamp).toBeUndefined();
    });

    it('executes conditional writes successfully in --apply mode with exact preconditions', async () => {
      const mockDocs: MockFirestoreDoc[] = [
        {
          id: 'usr_apply_1',
          data: { id: 'usr_apply_1', status: 'active', plan_tier: 'pass_30d', current_period_end: '2026-12-15T12:00:00.000Z' },
          updateTime: '2026-11-01T10:00:00.000Z',
        },
        {
          id: 'usr_apply_2',
          data: { id: 'usr_apply_2', status: 'active', plan_tier: 'pass_180d', current_period_end: '2027-05-15T08:30:00.500Z' },
          updateTime: '2026-11-01T11:00:00.000Z',
        },
      ];

      const adapter = createMockBackfillAdapter(mockDocs);
      const summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 500,
        isApply: true, // Live writes enabled
        nowMs: referenceNowMs,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(summary.dryRun).toBe(false);
      expect(summary.eligible).toBe(2);
      expect(summary.updated).toBe(2);
      expect(summary.concurrencyConflicts).toBe(0);

      const calls = adapter.getUpdateCalls();
      expect(calls.length).toBe(2);
      // Preconditions must strictly match read updateTimes
      expect(calls[0].preconditionUpdateTime).toBe('2026-11-01T10:00:00.000Z');
      expect(calls[1].preconditionUpdateTime).toBe('2026-11-01T11:00:00.000Z');

      // Documents in store must now contain native period_end_timestamp
      const docsInStore = adapter.getDocs();
      expect(docsInStore[0].data.period_end_timestamp.seconds).toBe(1797336000);
      expect(docsInStore[1].data.period_end_timestamp.nanoseconds).toBe(500000000);
    });

    it('detects and skips documents modified between read and write as concurrency conflicts', async () => {
      const mockDocs: MockFirestoreDoc[] = [
        {
          id: 'usr_safe_1',
          data: { id: 'usr_safe_1', status: 'active', current_period_end: '2026-12-15T00:00:00Z' },
          updateTime: '2026-11-01T00:00:00Z',
        },
        {
          id: 'usr_conflict_2',
          data: { id: 'usr_conflict_2', status: 'active', current_period_end: '2026-12-20T00:00:00Z' },
          updateTime: '2026-11-01T00:00:00Z',
        },
        {
          id: 'usr_safe_3',
          data: { id: 'usr_safe_3', status: 'active', current_period_end: '2026-12-25T00:00:00Z' },
          updateTime: '2026-11-01T00:00:00Z',
        },
      ];

      const adapter = createMockBackfillAdapter(mockDocs);

      // Simulate concurrent update on usr_conflict_2 between read and write
      // (e.g. user bought a new pass while scan was running)
      const originalUpdate = adapter.updatePeriodEndTimestamp.bind(adapter);
      adapter.updatePeriodEndTimestamp = async (params) => {
        if (params.doc.id === 'usr_conflict_2') {
          // Concurrent worker modified the document in Firestore!
          adapter.simulateConcurrentUpdate(
            'usr_conflict_2',
            { current_period_end: '2027-01-20T00:00:00Z', lastVerifiedPayment: 'pay_concurrent_999' },
            '2026-11-08T20:00:00Z' // Modified updateTime in store!
          );
        }
        return originalUpdate(params);
      };

      const summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 500,
        isApply: true,
        nowMs: referenceNowMs,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(summary.totalScanned).toBe(3);
      expect(summary.eligible).toBe(3);
      expect(summary.updated).toBe(2); // Only usr_safe_1 and usr_safe_3
      expect(summary.concurrencyConflicts).toBe(1); // usr_conflict_2 was skipped!
      expect(summary.concurrencyConflictIds).toContain('usr_conflict_2');

      // Crucial: The concurrent modification in store must NOT have been overwritten
      const conflictingDoc = adapter.getDocs().find((d) => d.id === 'usr_conflict_2');
      expect(conflictingDoc?.data.current_period_end).toBe('2027-01-20T00:00:00Z');
      expect(conflictingDoc?.data.lastVerifiedPayment).toBe('pay_concurrent_999');
    });

    it('skips documents that already have a native timestamp without making write calls', async () => {
      const mockDocs: MockFirestoreDoc[] = [
        {
          id: 'usr_has_ts_obj',
          data: {
            id: 'usr_has_ts_obj',
            status: 'active',
            current_period_end: '2026-12-15T00:00:00Z',
            period_end_timestamp: { _seconds: 1797292800, _nanoseconds: 0 },
          },
          updateTime: '2026-11-01T00:00:00Z',
        },
        {
          id: 'usr_has_ts_rest',
          data: {
            id: 'usr_has_ts_rest',
            status: 'active',
            current_period_end: '2026-12-15T00:00:00Z',
            period_end_timestamp: { timestampValue: '2026-12-15T00:00:00Z' },
          },
          updateTime: '2026-11-01T00:00:00Z',
        },
      ];

      const adapter = createMockBackfillAdapter(mockDocs);
      const summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 500,
        isApply: true,
        nowMs: referenceNowMs,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(summary.totalScanned).toBe(2);
      expect(summary.eligible).toBe(0);
      expect(summary.skipped).toBe(2);
      expect(summary.skippedExistingTimestamp).toBe(2);
      expect(summary.updated).toBe(0);
      expect(adapter.getUpdateCalls().length).toBe(0);
    });

    it('handles expired legacy subscriptions without granting extra days or active access', async () => {
      const mockDocs: MockFirestoreDoc[] = [
        {
          id: 'usr_expired_legacy',
          data: {
            id: 'usr_expired_legacy',
            status: 'active', // Legacy active status before expiration check
            plan_tier: 'cohort',
            current_period_end: '2026-10-01T14:15:30.250Z', // In the past relative to referenceNowMs
          },
          updateTime: '2026-11-01T00:00:00Z',
        },
      ];

      const adapter = createMockBackfillAdapter(mockDocs);
      const summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 500,
        isApply: true,
        nowMs: referenceNowMs,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(summary.eligible).toBe(1);
      expect(summary.expiredEligible).toBe(1);
      expect(summary.activeEligible).toBe(0);
      expect(summary.updated).toBe(1);

      const updated = adapter.getDocs()[0];
      // Original past instant preserved exactly
      expect(updated.data.period_end_timestamp.seconds).toBe(1790864130);
      expect(updated.data.period_end_timestamp.nanoseconds).toBe(250000000);
      expect(updated.data.period_end_timestamp.toMillis()).toBeLessThan(referenceNowMs);
      // Status remains unchanged
      expect(updated.data.status).toBe('active');
    });

    it('records malformed expiry dates as invalid without attempting writes', async () => {
      const mockDocs: MockFirestoreDoc[] = [
        {
          id: 'usr_corrupt_date',
          data: {
            id: 'usr_corrupt_date',
            status: 'active',
            current_period_end: 'MALFORMED_NON_ISO_DATE',
          },
          updateTime: '2026-11-01T00:00:00Z',
        },
      ];

      const adapter = createMockBackfillAdapter(mockDocs);
      const summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 500,
        isApply: true,
        nowMs: referenceNowMs,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(summary.totalScanned).toBe(1);
      expect(summary.eligible).toBe(0);
      expect(summary.invalid).toBe(1);
      expect(summary.invalidRecords[0].userId).toBe('usr_corrupt_date');
      expect(summary.invalidRecords[0].rawValue).toBe('MALFORMED_NON_ISO_DATE');
      expect(summary.updated).toBe(0);
      expect(adapter.getUpdateCalls().length).toBe(0);
    });

    it('safely supports retry after an interrupted run without double-updating records', async () => {
      const mockDocs: MockFirestoreDoc[] = [
        { id: 'usr_1', data: { id: 'usr_1', status: 'active', current_period_end: '2026-12-01T00:00:00Z' }, updateTime: '2026-11-01T00:00:00Z' },
        { id: 'usr_2', data: { id: 'usr_2', status: 'active', current_period_end: '2026-12-02T00:00:00Z' }, updateTime: '2026-11-01T00:00:00Z' },
        { id: 'usr_3', data: { id: 'usr_3', status: 'active', current_period_end: '2026-12-03T00:00:00Z' }, updateTime: '2026-11-01T00:00:00Z' },
        { id: 'usr_4', data: { id: 'usr_4', status: 'active', current_period_end: '2026-12-04T00:00:00Z' }, updateTime: '2026-11-01T00:00:00Z' },
      ];

      const adapter = createMockBackfillAdapter(mockDocs);

      // Run 1: Interrupted after 1 page of 2 items
      const run1Summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 2,
        maxPages: 1, // Simulates interruption after first page
        isApply: true,
        nowMs: referenceNowMs,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(run1Summary.totalScanned).toBe(2);
      expect(run1Summary.updated).toBe(2);
      expect(adapter.getUpdateCalls().length).toBe(2);

      // Run 2: Full retry across entire collection
      const run2Summary = await executeBackfillRunner({
        source: adapter,
        pageSize: 2,
        isApply: true,
        nowMs: referenceNowMs,
        logger: { log: () => {}, warn: () => {}, error: () => {} },
      });

      expect(run2Summary.totalScanned).toBe(4);
      // First 2 records are skipped because they already have native timestamps from Run 1!
      expect(run2Summary.skippedExistingTimestamp).toBe(2);
      // Only the remaining 2 records are updated
      expect(run2Summary.updated).toBe(2);
      expect(run2Summary.eligible).toBe(2);

      // All 4 documents in store now have native timestamps
      const finalDocs = adapter.getDocs();
      for (const d of finalDocs) {
        expect(d.data.period_end_timestamp).toBeDefined();
        expect(d.data.period_end_timestamp.seconds).toBeGreaterThan(0);
      }
    });

    it('verifies REST adapter includes currentDocument.updateTime precondition and handles HTTP 412', async () => {
      let capturedCommitPayload: any = null;

      // Mock global fetch for this unit test
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (url: any, init?: any): Promise<Response> => {
          const urlStr = String(url);
          if (urlStr.includes(':runQuery')) {
            return new Response(
              JSON.stringify([
                {
                  document: {
                    name: 'projects/test-project/databases/(default)/documents/user_subscriptions/user_rest_1',
                    fields: {
                      current_period_end: { stringValue: '2026-12-31T00:00:00Z' },
                      status: { stringValue: 'active' },
                    },
                    updateTime: '2026-11-01T15:30:00.123456Z',
                  },
                },
              ]),
              { status: 200 }
            );
          }

          if (urlStr.includes(':commit')) {
            capturedCommitPayload = JSON.parse(init?.body as string);
            // Simulate 412 Precondition Failed
            return new Response(JSON.stringify({ error: 'Precondition Failed' }), { status: 412 });
          }

          return new Response(JSON.stringify({}), { status: 200 });
        };

        const restAdapter = createRestBackfillAdapter({
          projectId: 'test-project',
          getAccessToken: async () => 'mock-test-token',
        });

        const page = await restAdapter.fetchPage({ pageSize: 10 });
        expect(page.docs.length).toBe(1);
        expect(page.docs[0].id).toBe('user_rest_1');
        expect(page.docs[0].updateTime).toBe('2026-11-01T15:30:00.123456Z');

        const updateRes = await restAdapter.updatePeriodEndTimestamp({
          doc: page.docs[0],
          targetTimestamp: createTimestampRepresentation(1798675200000),
        });

        // Must report concurrency_conflict on HTTP 412
        expect(updateRes.status).toBe('concurrency_conflict');
        // Commit payload must include currentDocument.updateTime
        expect(capturedCommitPayload.writes[0].currentDocument).toEqual({
          updateTime: '2026-11-01T15:30:00.123456Z',
        });
        // Update mask must contain ONLY period_end_timestamp
        expect(capturedCommitPayload.writes[0].updateMask.fieldPaths).toEqual(['period_end_timestamp']);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // ============================================================================
  // 7. Operational Safety Hardening & Strict CLI Validation
  // ============================================================================
  describe('7. Operational Safety Hardening & Strict CLI Validation', () => {
    it('1. rejects invalid page-size values (zero, negative, non-integer, and >500)', () => {
      const invalidSizes = [
        '0',
        '-1',
        '-50',
        'abc',
        '12.5',
        '501',
        '1000',
        'NaN',
        '',
      ];

      for (const size of invalidSizes) {
        const result = parseAndValidateCliArgs([`--page-size=${size}`]);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toMatch(/Invalid --page-size/i);
        }
      }
    });

    it('accepts valid page-size integers between 1 and 500', () => {
      const validSizes = [1, 50, 250, 500];

      for (const size of validSizes) {
        const result = parseAndValidateCliArgs([`--page-size=${size}`]);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.options.pageSize).toBe(size);
        }
      }
    });

    it('2. rejects unknown, unrecognized, or conflicting arguments', () => {
      const invalidArgSets = [
        ['--unknown-flag'],
        ['--force'],
        ['-f'],
        ['--dry-run'], // Already default; explicit --dry-run flag is disallowed to prevent confusion
        ['--confirm-project=tracker-e8e6f', '--invalid'],
        ['random_string'],
      ];

      for (const args of invalidArgSets) {
        const result = parseAndValidateCliArgs(args);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toMatch(/Unknown or conflicting CLI argument/i);
        }
      }
    });

    it('3. rejects missing project confirmation before connecting', () => {
      const result = validateProjectConfirmation(undefined, 'tracker-e8e6f');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toMatch(/Missing --confirm-project flag/i);
        expect(result.error).toContain('tracker-e8e6f');
      }
    });

    it('4. rejects incorrect project confirmation with mismatch error', () => {
      const result = validateProjectConfirmation('wrong-project-123', 'tracker-e8e6f');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toMatch(/Project confirmation mismatch/i);
        expect(result.error).toContain('wrong-project-123');
        expect(result.error).toContain('tracker-e8e6f');
      }
    });

    it('5. accepts exact matching project confirmation', () => {
      const result = validateProjectConfirmation('tracker-e8e6f', 'tracker-e8e6f');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.projectId).toBe('tracker-e8e6f');
      }
    });

    it('6. preserves dry-run as the default when only project confirmation is supplied', () => {
      const result = parseAndValidateCliArgs(['--confirm-project=tracker-e8e6f']);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.options.isApply).toBe(false);
        expect(result.options.pageSize).toBe(500);
        expect(result.options.confirmProject).toBe('tracker-e8e6f');
      }
    });

    it('7. requires explicit --apply flag separately to enable live writes', () => {
      // With --apply
      const withApply = parseAndValidateCliArgs(['--confirm-project=tracker-e8e6f', '--apply']);
      expect(withApply.valid).toBe(true);
      if (withApply.valid) {
        expect(withApply.options.isApply).toBe(true);
      }

      // Without --apply (even with custom page size)
      const withoutApply = parseAndValidateCliArgs(['--confirm-project=tracker-e8e6f', '--page-size=250']);
      expect(withoutApply.valid).toBe(true);
      if (withoutApply.valid) {
        expect(withoutApply.options.isApply).toBe(false);
        expect(withoutApply.options.pageSize).toBe(250);
      }
    });

    it('resolves project ID from service account or environment without silent hardcoded fallback', () => {
      // From serviceAccount object
      expect(resolveTargetProjectId({ project_id: 'my-custom-prod' })).toBe('my-custom-prod');

      // From environment variable
      const oldEnv = process.env.FIREBASE_PROJECT_ID;
      try {
        process.env.FIREBASE_PROJECT_ID = 'env-project-456';
        expect(resolveTargetProjectId({})).toBe('env-project-456');

        // Missing both -> returns null (never silently selects hardcoded project)
        delete process.env.FIREBASE_PROJECT_ID;
        expect(resolveTargetProjectId({})).toBeNull();
      } finally {
        if (oldEnv) process.env.FIREBASE_PROJECT_ID = oldEnv;
      }
    });
  });
});
