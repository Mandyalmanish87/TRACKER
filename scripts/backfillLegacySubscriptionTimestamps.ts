/**
 * ==============================================================================
 * TRAKIFY — Administrative One-Time Backfill Script: Legacy Subscription Timestamps
 *
 * PURPOSE:
 *   Converts legacy ISO 8601 string dates in user_subscriptions/{userId}.current_period_end
 *   into native Firestore `period_end_timestamp` values.
 *
 * SAFETY INVARIANTS:
 *   1. DEFAULTS TO DRY RUN: Never writes to Firestore unless explicit `--apply` flag is passed.
 *   2. PRESERVES EXACT INSTANT: Maintains exact milliseconds, seconds, minutes, and hours.
 *      Never rounds to midnight, never truncates, and never grants extra days.
 *   3. NO OVERWRITES: Never overwrites an existing native `period_end_timestamp`.
 *   4. ZERO PRIVILEGE CREEP: Preserves status, plan tiers, and duration.
 *      Expired records retain their original past timestamp (access remains stopped).
 *   5. VALIDATION: Malformed, non-ISO, or unparseable dates are logged for manual review.
 *   6. MINIMAL DELTA: Updates ONLY `period_end_timestamp`.
 *   7. PAGINATION: Safe, cursor-based pagination with max 500 documents per batch.
 *   8. CONCURRENCY SAFETY: Every write enforces an update-time precondition.
 *      If a document changed since read, it is skipped as a concurrency conflict.
 *   9. IDEMPOTENT & RETRY-SAFE: Interrupted runs can be retried safely.
 *  10. ZERO SECRET LEAKAGE: Never prints or logs credentials or service-account JSON.
 *
 * USAGE:
 *   Dry run (default):
 *     npx tsx scripts/backfillLegacySubscriptionTimestamps.ts --confirm-project=tracker-e8e6f
 *   Apply writes:
 *     npx tsx scripts/backfillLegacySubscriptionTimestamps.ts --confirm-project=tracker-e8e6f --apply
 *   Custom page size:
 *     npx tsx scripts/backfillLegacySubscriptionTimestamps.ts --confirm-project=tracker-e8e6f --apply --page-size=250
 * ==============================================================================
 */

import * as crypto from 'crypto';

export interface SubscriptionRecordLike {
  id: string; // userId or document ID
  user_id?: string;
  status?: string;
  plan_tier?: string;
  planId?: string;
  current_period_end?: any;
  currentPeriodEnd?: any;
  period_end_timestamp?: any;
  [key: string]: any;
}

export interface NativeTimestampRep {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
  toMillis: () => number;
  isoString: string;
}

export type BackfillEvaluationResult =
  | {
      action: 'backfill';
      userId: string;
      rawExpiryField: string;
      originalValue: string;
      targetDate: Date;
      targetTimestamp: NativeTimestampRep;
      isExpired: boolean;
      status: string;
      planTier: string;
    }
  | {
      action: 'skip_already_has_timestamp';
      userId: string;
      existingTimestamp: any;
    }
  | {
      action: 'skip_no_expiry_field';
      userId: string;
    }
  | {
      action: 'invalid_date_format';
      userId: string;
      rawValue: any;
      error: string;
    };

export interface BackfillSummary {
  dryRun: boolean;
  totalScanned: number;
  eligibleToBackfill: number;
  activeEligible: number;
  expiredEligible: number;
  skippedExistingTimestamp: number;
  skippedNoExpiry: number;
  invalidRecords: Array<{ userId: string; rawValue: any; error: string }>;
  appliedWrites: number;
  planTierDistribution: Record<string, number>;
}

export interface FirestoreDocumentSnapshotLike {
  id: string;
  data: () => SubscriptionRecordLike | undefined;
  updateTime?: any; // Firestore Timestamp object or ISO 8601 string
  ref?: any;
  rawDoc?: any;
}

export interface FirestorePaginationSourceLike {
  fetchPage(params: {
    pageSize: number;
    startAfterDoc?: FirestoreDocumentSnapshotLike | null;
  }): Promise<{
    docs: FirestoreDocumentSnapshotLike[];
    lastDoc: FirestoreDocumentSnapshotLike | null;
    hasMore: boolean;
  }>;

  updatePeriodEndTimestamp(params: {
    doc: FirestoreDocumentSnapshotLike;
    targetTimestamp: NativeTimestampRep;
  }): Promise<{
    status: 'success' | 'concurrency_conflict' | 'error';
    error?: string;
  }>;
}

export interface BackfillExecutionSummary {
  dryRun: boolean;
  totalScanned: number;
  eligible: number;
  activeEligible: number;
  expiredEligible: number;
  updated: number;
  skipped: number;
  skippedExistingTimestamp: number;
  skippedNoExpiry: number;
  invalid: number;
  invalidRecords: Array<{ userId: string; rawValue: any; error: string }>;
  concurrencyConflicts: number;
  concurrencyConflictIds: string[];
  pagesProcessed: number;
  planTierDistribution: Record<string, number>;
}

export interface BackfillRunnerOptions {
  source: FirestorePaginationSourceLike;
  isApply?: boolean;
  pageSize?: number;
  nowMs?: number;
  maxPages?: number;
  onPageComplete?: (pageIndex: number, pageSummary: BackfillExecutionSummary) => void;
  logger?: {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

/**
 * Checks whether a value already represents a native Firestore Timestamp.
 */
export function isExistingNativeTimestamp(value: any): boolean {
  if (!value) return false;
  // Firestore Admin SDK Timestamp instance or emulator object
  if (typeof value.toDate === 'function' || typeof value.toMillis === 'function') {
    return true;
  }
  // Serialized Firestore timestamp object (_seconds / nanoseconds)
  if (typeof value === 'object' && typeof value._seconds === 'number') {
    return true;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return true;
  }
  // Firestore REST representation { timestampValue: "..." }
  if (typeof value === 'object' && typeof value.timestampValue === 'string') {
    return true;
  }
  return false;
}

/**
 * Parses a raw date string or value with strict ISO 8601 validation.
 * Preserves exact milliseconds without rounding or timezone distortion.
 */
export function parseLegacyExpiryDate(rawDate: any):
  | { valid: true; date: Date; millis: number; isoString: string }
  | { valid: false; error: string } {
  if (rawDate === undefined || rawDate === null || rawDate === '') {
    return { valid: false, error: 'Empty or missing date value' };
  }

  if (typeof rawDate !== 'string') {
    return { valid: false, error: `Expected string date, received type: ${typeof rawDate}` };
  }

  const trimmed = rawDate.trim();

  // Basic ISO 8601 / RFC 3339 shape check: YYYY-MM-DD...
  const isoPattern = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  if (!isoPattern.test(trimmed)) {
    return { valid: false, error: `String does not conform to ISO 8601 format: "${trimmed}"` };
  }

  const parsed = new Date(trimmed);
  const time = parsed.getTime();

  if (isNaN(time)) {
    return { valid: false, error: `Invalid Date evaluation for: "${trimmed}"` };
  }

  // Reject nonsensical years (e.g. year 0000 or > year 3000)
  const fullYear = parsed.getUTCFullYear();
  if (fullYear < 2000 || fullYear > 3000) {
    return { valid: false, error: `Unrealistic calendar year (${fullYear}) in date: "${trimmed}"` };
  }

  return {
    valid: true,
    date: parsed,
    millis: time,
    isoString: parsed.toISOString(),
  };
}

/**
 * Creates a native Firestore-compatible timestamp representation.
 */
export function createTimestampRepresentation(millis: number): NativeTimestampRep {
  const seconds = Math.floor(millis / 1000);
  const nanoseconds = (millis % 1000) * 1000000;
  const d = new Date(millis);
  return {
    seconds,
    nanoseconds,
    toDate: () => d,
    toMillis: () => millis,
    isoString: d.toISOString(),
  };
}

/**
 * Pure evaluator: evaluates a single subscription record for backfill suitability.
 */
export function evaluateSubscriptionForBackfill(
  record: SubscriptionRecordLike,
  nowMs: number = Date.now()
): BackfillEvaluationResult {
  const userId = record.id || record.user_id || 'unknown_user';

  // 1. Check if record already has a valid native period_end_timestamp
  if (isExistingNativeTimestamp(record.period_end_timestamp)) {
    return {
      action: 'skip_already_has_timestamp',
      userId,
      existingTimestamp: record.period_end_timestamp,
    };
  }

  // 2. Identify candidate legacy date field (current_period_end or camelCase variant)
  const rawDateField =
    record.current_period_end !== undefined
      ? 'current_period_end'
      : record.currentPeriodEnd !== undefined
      ? 'currentPeriodEnd'
      : null;

  if (!rawDateField) {
    return {
      action: 'skip_no_expiry_field',
      userId,
    };
  }

  const rawDateValue = record[rawDateField];

  // 3. Strict parsing & validation
  const parsed = parseLegacyExpiryDate(rawDateValue);
  if (!parsed.valid) {
    return {
      action: 'invalid_date_format',
      userId,
      rawValue: rawDateValue,
      error: parsed.error,
    };
  }

  const targetTimestamp = createTimestampRepresentation(parsed.millis);
  const isExpired = parsed.millis <= nowMs;
  const status = record.status || 'free';
  const planTier = record.plan_tier || record.planId || 'unknown';

  return {
    action: 'backfill',
    userId,
    rawExpiryField: rawDateField,
    originalValue: String(rawDateValue),
    targetDate: parsed.date,
    targetTimestamp,
    isExpired,
    status,
    planTier,
  };
}

/**
 * Batch evaluator: evaluates an array of records and computes the summary.
 */
export function evaluateBackfillBatch(
  records: SubscriptionRecordLike[],
  nowMs: number = Date.now(),
  isApply: boolean = false
): { evaluations: BackfillEvaluationResult[]; summary: BackfillSummary } {
  const evaluations: BackfillEvaluationResult[] = [];
  const planTierDistribution: Record<string, number> = {};
  const invalidRecords: Array<{ userId: string; rawValue: any; error: string }> = [];

  let eligibleToBackfill = 0;
  let activeEligible = 0;
  let expiredEligible = 0;
  let skippedExistingTimestamp = 0;
  let skippedNoExpiry = 0;

  for (const record of records) {
    const res = evaluateSubscriptionForBackfill(record, nowMs);
    evaluations.push(res);

    switch (res.action) {
      case 'backfill':
        eligibleToBackfill++;
        if (res.isExpired) {
          expiredEligible++;
        } else {
          activeEligible++;
        }
        planTierDistribution[res.planTier] = (planTierDistribution[res.planTier] || 0) + 1;
        break;
      case 'skip_already_has_timestamp':
        skippedExistingTimestamp++;
        break;
      case 'skip_no_expiry_field':
        skippedNoExpiry++;
        break;
      case 'invalid_date_format':
        invalidRecords.push({
          userId: res.userId,
          rawValue: res.rawValue,
          error: res.error,
        });
        break;
    }
  }

  const summary: BackfillSummary = {
    dryRun: !isApply,
    totalScanned: records.length,
    eligibleToBackfill,
    activeEligible,
    expiredEligible,
    skippedExistingTimestamp,
    skippedNoExpiry,
    invalidRecords,
    appliedWrites: isApply ? eligibleToBackfill : 0,
    planTierDistribution,
  };

  return { evaluations, summary };
}

/**
 * Helper to decode Firestore REST fields dictionary into plain JS object.
 */
export function decodeRestFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  if (!fields || typeof fields !== 'object') return result;

  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) {
      result[key] = val.stringValue;
    } else if (val.integerValue !== undefined) {
      result[key] = parseInt(val.integerValue, 10);
    } else if (val.doubleValue !== undefined) {
      result[key] = val.doubleValue;
    } else if (val.booleanValue !== undefined) {
      result[key] = val.booleanValue;
    } else if (val.timestampValue !== undefined) {
      result[key] = { timestampValue: val.timestampValue };
    } else if (val.nullValue !== undefined) {
      result[key] = null;
    } else if (val.mapValue?.fields) {
      result[key] = decodeRestFields(val.mapValue.fields);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Core Execution Engine:
 * Paginates through Firestore collection, evaluates records, and conditionally applies
 * updates with an update-time precondition.
 */
export async function executeBackfillRunner(
  options: BackfillRunnerOptions
): Promise<BackfillExecutionSummary> {
  const isApply = options.isApply ?? false;
  const rawPageSize = options.pageSize ?? 500;
  // Maximum 500 documents per read page as required
  const pageSize = Math.min(Math.max(1, rawPageSize), 500);
  const nowMs = options.nowMs ?? Date.now();
  const logger = options.logger ?? console;

  const summary: BackfillExecutionSummary = {
    dryRun: !isApply,
    totalScanned: 0,
    eligible: 0,
    activeEligible: 0,
    expiredEligible: 0,
    updated: 0,
    skipped: 0,
    skippedExistingTimestamp: 0,
    skippedNoExpiry: 0,
    invalid: 0,
    invalidRecords: [],
    concurrencyConflicts: 0,
    concurrencyConflictIds: [],
    pagesProcessed: 0,
    planTierDistribution: {},
  };

  let lastDoc: FirestoreDocumentSnapshotLike | null = null;
  let pageIndex = 0;
  const maxPages = options.maxPages ?? Infinity;

  while (pageIndex < maxPages) {
    pageIndex++;
    const pageResult = await options.source.fetchPage({ pageSize, startAfterDoc: lastDoc });
    const docs = pageResult.docs || [];
    summary.pagesProcessed++;

    if (docs.length === 0) {
      break;
    }

    for (const doc of docs) {
      summary.totalScanned++;
      const data = doc.data() || { id: doc.id };
      const recordToEval: SubscriptionRecordLike = {
        id: doc.id,
        ...data,
      };

      const evalRes = evaluateSubscriptionForBackfill(recordToEval, nowMs);

      switch (evalRes.action) {
        case 'backfill': {
          summary.eligible++;
          if (evalRes.isExpired) {
            summary.expiredEligible++;
          } else {
            summary.activeEligible++;
          }
          summary.planTierDistribution[evalRes.planTier] =
            (summary.planTierDistribution[evalRes.planTier] || 0) + 1;

          if (!isApply) {
            // DRY RUN: log candidate update without issuing write
            logger.log(
              `[DRY RUN] Document ${doc.id} eligible: "${evalRes.originalValue}" -> ${evalRes.targetTimestamp.isoString} (precondition updateTime: ${typeof doc.updateTime === 'object' ? JSON.stringify(doc.updateTime) : doc.updateTime}). No write executed.`
            );
          } else {
            // APPLY: Write conditional update enforcing update-time precondition
            const writeResult = await options.source.updatePeriodEndTimestamp({
              doc,
              targetTimestamp: evalRes.targetTimestamp,
            });

            if (writeResult.status === 'success') {
              summary.updated++;
            } else if (writeResult.status === 'concurrency_conflict') {
              summary.concurrencyConflicts++;
              summary.concurrencyConflictIds.push(doc.id);
              logger.warn(
                `[CONCURRENCY CONFLICT] Document ${doc.id} was modified after read. Update skipped to avoid overwriting newer subscription.`
              );
            } else {
              logger.error(
                `[WRITE ERROR] Failed updating document ${doc.id}: ${writeResult.error || 'Unknown error'}`
              );
            }
          }
          break;
        }

        case 'skip_already_has_timestamp': {
          summary.skipped++;
          summary.skippedExistingTimestamp++;
          break;
        }

        case 'skip_no_expiry_field': {
          summary.skipped++;
          summary.skippedNoExpiry++;
          break;
        }

        case 'invalid_date_format': {
          summary.invalid++;
          summary.invalidRecords.push({
            userId: evalRes.userId,
            rawValue: evalRes.rawValue,
            error: evalRes.error,
          });
          logger.warn(
            `[INVALID DATE] Document ${doc.id} has malformed date "${evalRes.rawValue}": ${evalRes.error}. Skipped for manual review.`
          );
          break;
        }
      }
    }

    if (options.onPageComplete) {
      options.onPageComplete(pageIndex, { ...summary });
    }

    lastDoc = pageResult.lastDoc || docs[docs.length - 1];

    if (!pageResult.hasMore || docs.length < pageSize) {
      break;
    }
  }

  return summary;
}

/**
 * Mock Firestore Adapter for offline unit tests.
 * Accurately simulates document snapshots, `startAfter` pagination, and conditional writes.
 */
export interface MockFirestoreDoc {
  id: string;
  data: SubscriptionRecordLike;
  updateTime: string; // ISO string representing doc version
}

export function createMockBackfillAdapter(initialDocs: MockFirestoreDoc[]) {
  // Deep copy docs for test isolation
  const store: MockFirestoreDoc[] = initialDocs.map((d) => ({
    id: d.id,
    data: JSON.parse(JSON.stringify(d.data)),
    updateTime: d.updateTime,
  }));

  const updateCalls: Array<{
    id: string;
    targetIso: string;
    preconditionUpdateTime: any;
  }> = [];

  const adapter: FirestorePaginationSourceLike & {
    getDocs: () => MockFirestoreDoc[];
    getUpdateCalls: () => typeof updateCalls;
    simulateConcurrentUpdate: (id: string, newData?: Partial<SubscriptionRecordLike>, newUpdateTime?: string) => void;
  } = {
    async fetchPage({ pageSize, startAfterDoc }) {
      let startIndex = 0;
      if (startAfterDoc) {
        const found = store.findIndex((d) => d.id === startAfterDoc.id);
        if (found !== -1) {
          startIndex = found + 1;
        }
      }

      const pageItems = store.slice(startIndex, startIndex + pageSize);
      const docs: FirestoreDocumentSnapshotLike[] = pageItems.map((item) => ({
        id: item.id,
        data: () => ({ ...item.data }),
        updateTime: item.updateTime,
      }));

      const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
      const hasMore = startIndex + pageSize < store.length;

      return {
        docs,
        lastDoc,
        hasMore,
      };
    },

    async updatePeriodEndTimestamp({ doc, targetTimestamp }) {
      updateCalls.push({
        id: doc.id,
        targetIso: targetTimestamp.isoString,
        preconditionUpdateTime: doc.updateTime,
      });

      const current = store.find((d) => d.id === doc.id);
      if (!current) {
        return { status: 'error', error: 'Document not found' };
      }

      // Check update-time precondition:
      // If doc in store was updated since it was read, fail precondition!
      if (current.updateTime !== doc.updateTime) {
        return {
          status: 'concurrency_conflict',
          error: `Precondition failed: current updateTime "${current.updateTime}" !== expected "${doc.updateTime}"`,
        };
      }

      // Update ONLY period_end_timestamp
      current.data.period_end_timestamp = {
        seconds: targetTimestamp.seconds,
        nanoseconds: targetTimestamp.nanoseconds,
        toDate: targetTimestamp.toDate,
        toMillis: targetTimestamp.toMillis,
      };
      // Advance updateTime
      current.updateTime = new Date().toISOString();

      return { status: 'success' };
    },

    getDocs: () => store,
    getUpdateCalls: () => updateCalls,
    simulateConcurrentUpdate: (id, newData, newUpdateTime) => {
      const target = store.find((d) => d.id === id);
      if (target) {
        if (newData) {
          Object.assign(target.data, newData);
        }
        target.updateTime = newUpdateTime || new Date(Date.now() + 1000).toISOString();
      }
    },
  };

  return adapter;
}

/**
 * Concrete Adapter for Firebase Admin SDK.
 * Uses query snapshots, startAfter cursor, and update precondition { lastUpdateTime }.
 */
export function createAdminSdkBackfillAdapter(firestoreDb: any): FirestorePaginationSourceLike {
  return {
    async fetchPage({ pageSize, startAfterDoc }) {
      let query = firestoreDb.collection('user_subscriptions')
        .orderBy('__name__')
        .limit(pageSize);

      if (startAfterDoc?.rawDoc) {
        query = query.startAfter(startAfterDoc.rawDoc);
      } else if (startAfterDoc?.id) {
        query = query.startAfter(startAfterDoc.id);
      }

      const snap = await query.get();
      const docs: FirestoreDocumentSnapshotLike[] = snap.docs.map((d: any) => ({
        id: d.id,
        data: () => d.data(),
        updateTime: d.updateTime,
        ref: d.ref,
        rawDoc: d,
      }));

      const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
      return {
        docs,
        lastDoc,
        hasMore: docs.length === pageSize,
      };
    },

    async updatePeriodEndTimestamp({ doc, targetTimestamp }) {
      try {
        if (!doc.ref || typeof doc.ref.update !== 'function') {
          return { status: 'error', error: 'Missing Firestore DocumentReference' };
        }

        if (!doc.updateTime) {
          return { status: 'error', error: `Missing updateTime precondition for document ${doc.id}` };
        }

        // Firebase Admin SDK Timestamp representation
        const adminTimestamp = {
          seconds: targetTimestamp.seconds,
          nanoseconds: targetTimestamp.nanoseconds,
          toDate: targetTimestamp.toDate,
          toMillis: targetTimestamp.toMillis,
        };

        // Update ONLY period_end_timestamp with strict update-time precondition
        await doc.ref.update(
          { period_end_timestamp: adminTimestamp },
          { lastUpdateTime: doc.updateTime }
        );

        return { status: 'success' };
      } catch (err: any) {
        const isPreconditionFailed =
          err?.code === 9 ||
          err?.code === 'failed-precondition' ||
          String(err?.message || '').toLowerCase().includes('precondition') ||
          String(err?.message || '').toLowerCase().includes('failed_precondition');

        if (isPreconditionFailed) {
          return { status: 'concurrency_conflict', error: err.message };
        }
        return { status: 'error', error: err?.message || String(err) };
      }
    },
  };
}

/**
 * Concrete Adapter for Firestore REST API.
 * Uses REST query pagination and documents:commit with currentDocument.updateTime.
 */
export function createRestBackfillAdapter(params: {
  projectId: string;
  getAccessToken: () => Promise<string>;
}): FirestorePaginationSourceLike {
  return {
    async fetchPage({ pageSize, startAfterDoc }) {
      const token = await params.getAccessToken();
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${params.projectId}/databases/(default)/documents:runQuery`;

      const structuredQuery: Record<string, any> = {
        from: [{ collectionId: 'user_subscriptions' }],
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
        limit: pageSize,
      };

      if (startAfterDoc?.id) {
        structuredQuery.startAt = {
          values: [
            {
              referenceValue: `projects/${params.projectId}/databases/(default)/documents/user_subscriptions/${startAfterDoc.id}`,
            },
          ],
          before: false, // before: false translates to startAfter
        };
      }

      const res = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ structuredQuery }),
      });

      if (!res.ok) {
        throw new Error(`Firestore REST query failed with status ${res.status}: ${await res.text()}`);
      }

      const queryResults = await res.json();
      const docs: FirestoreDocumentSnapshotLike[] = [];

      for (const item of queryResults) {
        if (!item.document) continue;
        const raw = item.document;
        const nameParts = raw.name.split('/');
        const docId = decodeURIComponent(nameParts[nameParts.length - 1]);
        const fields = decodeRestFields(raw.fields || {});

        docs.push({
          id: docId,
          data: () => fields,
          updateTime: raw.updateTime, // RFC 3339 string
          rawDoc: raw,
        });
      }

      const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
      return {
        docs,
        lastDoc,
        hasMore: docs.length === pageSize,
      };
    },

    async updatePeriodEndTimestamp({ doc, targetTimestamp }) {
      const token = await params.getAccessToken();
      const commitUrl = `https://firestore.googleapis.com/v1/projects/${params.projectId}/databases/(default)/documents:commit`;

      if (!doc.updateTime) {
        return { status: 'error', error: `Missing updateTime precondition for document ${doc.id}` };
      }

      const docName = `projects/${params.projectId}/databases/(default)/documents/user_subscriptions/${encodeURIComponent(doc.id)}`;

      // Update ONLY period_end_timestamp, enforced by updateMask and currentDocument.updateTime
      const write = {
        update: {
          name: docName,
          fields: {
            period_end_timestamp: {
              timestampValue: targetTimestamp.isoString,
            },
          },
        },
        updateMask: {
          fieldPaths: ['period_end_timestamp'],
        },
        currentDocument: {
          updateTime: doc.updateTime,
        },
      };

      const res = await fetch(commitUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ writes: [write] }),
      });

      if (res.status === 412) {
        return {
          status: 'concurrency_conflict',
          error: 'HTTP 412 Precondition Failed: Document was modified in Firestore since read.',
        };
      }

      if (!res.ok) {
        return {
          status: 'error',
          error: `REST commit failed with HTTP ${res.status}: ${await res.text()}`,
        };
      }

      return { status: 'success' };
    },
  };
}

/**
 * Generates an OAuth2 access token for Google APIs from service-account credentials.
 * Never logs or prints credentials.
 */
export async function generateGoogleOAuthTokenNode(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/datastore',
    iat: now,
    exp: now + 3600,
  };

  const base64UrlEncode = (obj: any) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const unsignedJwt = `${base64UrlEncode(header)}.${base64UrlEncode(claimSet)}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedJwt);
  sign.end();
  const signature = sign.sign(serviceAccount.private_key, 'base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google OAuth token exchange failed with HTTP status ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

export interface ParsedCliOptions {
  isApply: boolean;
  pageSize: number;
  confirmProject?: string;
}

export type CliParseResult =
  | {
      valid: true;
      options: ParsedCliOptions;
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Strict CLI argument parsing and validation.
 * Rejects zero, negative, non-integer, and out-of-range page sizes.
 * Rejects unknown or conflicting CLI arguments.
 * Preserves dry-run as the default.
 */
export function parseAndValidateCliArgs(args: string[]): CliParseResult {
  let isApply = false;
  let pageSize = 500;
  let confirmProject: string | undefined;

  for (const arg of args) {
    if (arg === '--apply') {
      isApply = true;
    } else if (arg.startsWith('--page-size=')) {
      const valStr = arg.slice('--page-size='.length).trim();
      if (!/^\d+$/.test(valStr)) {
        return {
          valid: false,
          error: `Invalid --page-size: "${valStr}". Must be an integer between 1 and 500.`,
        };
      }
      const val = parseInt(valStr, 10);
      if (val < 1 || val > 500) {
        return {
          valid: false,
          error: `Invalid --page-size: ${val}. Must be an integer between 1 and 500.`,
        };
      }
      pageSize = val;
    } else if (arg.startsWith('--confirm-project=')) {
      const val = arg.slice('--confirm-project='.length).trim();
      if (!val) {
        return {
          valid: false,
          error: 'Invalid --confirm-project: project ID cannot be empty.',
        };
      }
      confirmProject = val;
    } else if (arg === '--help' || arg === '-h') {
      return {
        valid: false,
        error: 'HELP_REQUESTED',
      };
    } else {
      return {
        valid: false,
        error: `Unknown or conflicting CLI argument: "${arg}". Allowed arguments: --apply, --page-size=<1..500>, --confirm-project=<PROJECT_ID>`,
      };
    }
  }

  return {
    valid: true,
    options: {
      isApply,
      pageSize,
      confirmProject,
    },
  };
}

/**
 * Resolves the target Firebase project ID from credentials or environment.
 * Does NOT silently fall back to a hardcoded default.
 */
export function resolveTargetProjectId(serviceAccount?: any): string | null {
  const saProjectId = serviceAccount?.project_id;
  if (typeof saProjectId === 'string' && saProjectId.trim()) {
    return saProjectId.trim();
  }
  const envProjectId = process.env.FIREBASE_PROJECT_ID;
  if (typeof envProjectId === 'string' && envProjectId.trim()) {
    return envProjectId.trim();
  }
  return null;
}

/**
 * Validates that the operator explicitly confirmed the resolved project ID.
 * Aborts if confirmation is missing or mismatched.
 */
export function validateProjectConfirmation(
  confirmedProjectId: string | undefined,
  resolvedProjectId: string | null
): { valid: true; projectId: string } | { valid: false; error: string } {
  if (!resolvedProjectId) {
    return {
      valid: false,
      error:
        'Target Firebase project ID could not be determined. Please ensure your service account credential contains a "project_id" or set FIREBASE_PROJECT_ID in the environment.',
    };
  }

  if (!confirmedProjectId) {
    return {
      valid: false,
      error: `Safety guard failure: Missing --confirm-project flag. You must explicitly confirm the target project ID by passing: --confirm-project=${resolvedProjectId}`,
    };
  }

  if (confirmedProjectId !== resolvedProjectId) {
    return {
      valid: false,
      error: `Safety guard failure: Project confirmation mismatch! Confirmed project "${confirmedProjectId}" does not match resolved project "${resolvedProjectId}". Execution aborted to prevent operations on unintended environment.`,
    };
  }

  return {
    valid: true,
    projectId: resolvedProjectId,
  };
}

/**
 * Standalone CLI runner entrypoint.
 * Safely parses CLI flags, enforces DRY RUN by default, checks credentials without exposure,
 * requires explicit project confirmation, and executes pagination batches.
 */
export async function runBackfillCli(customArgs?: string[]) {
  const args = customArgs ?? process.argv.slice(2);

  console.log('==============================================================================');
  console.log('TRAKIFY — Administrative Subscription Timestamp Backfill Runner');
  console.log('Target Collection: user_subscriptions');
  console.log('==============================================================================\n');

  // 1. Strict CLI argument parsing & validation
  const parsed = parseAndValidateCliArgs(args);
  if (!parsed.valid) {
    if (parsed.error === 'HELP_REQUESTED') {
      console.log('Usage:');
      console.log('  Dry Run (default):');
      console.log('    npx tsx scripts/backfillLegacySubscriptionTimestamps.ts --confirm-project=<PROJECT_ID>');
      console.log('  Apply writes:');
      console.log('    npx tsx scripts/backfillLegacySubscriptionTimestamps.ts --confirm-project=<PROJECT_ID> --apply');
      console.log('  Custom batch size (1..500):');
      console.log('    npx tsx scripts/backfillLegacySubscriptionTimestamps.ts --confirm-project=<PROJECT_ID> --page-size=250');
      return;
    }
    console.error(`CLI Argument Error: ${parsed.error}`);
    process.exitCode = 1;
    return;
  }

  const { isApply, pageSize, confirmProject } = parsed.options;

  console.log(`MODE:      ${isApply ? '*** APPLY (LIVE WRITES ENABLED) ***' : '[DRY RUN] (Safe simulation; no writes)'}`);
  console.log(`PAGE SIZE: ${pageSize} docs/page`);

  if (!isApply) {
    console.log('Notice: Running in safe DRY RUN mode by default.');
    console.log('To execute real writes to Firestore, re-run with explicit argument: --apply\n');
  }

  // 2. Load service account credentials without printing or exposing them
  const serviceAccountRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!serviceAccountRaw) {
    console.error('[ERROR] No live Firestore credentials provided in environment.');
    console.error('Provide FIREBASE_SERVICE_ACCOUNT_JSON when ready to run on live database.');
    process.exitCode = 1;
    return;
  }

  let serviceAccount: any = null;
  try {
    serviceAccount = JSON.parse(serviceAccountRaw);
  } catch {
    console.error('[ERROR] Failed to parse service-account JSON credential.');
    process.exitCode = 1;
    return;
  }

  // 3. Resolve project ID without hardcoded fallback
  const resolvedProjectId = resolveTargetProjectId(serviceAccount);
  const projectValidation = validateProjectConfirmation(confirmProject, resolvedProjectId);

  if (!projectValidation.valid) {
    console.error(`[PROJECT CONFIRMATION ERROR] ${projectValidation.error}`);
    process.exitCode = 1;
    return;
  }

  const projectId = projectValidation.projectId;
  console.log(`Target Project:    ${projectId}`);
  console.log(`Target Collection: user_subscriptions`);
  console.log('Initializing secure Firestore adapter...\n');

  // Attempt Admin SDK adapter first if available, else REST adapter
  let adapter: FirestorePaginationSourceLike;
  try {
    let admin: any;
    try {
      // Dynamic import to support environments with or without firebase-admin
      admin = require('firebase-admin');
    } catch {
      try {
        admin = require('../functions/node_modules/firebase-admin');
      } catch {
        admin = null;
      }
    }

    if (admin) {
      if (!admin.apps?.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId,
        });
      }
      adapter = createAdminSdkBackfillAdapter(admin.firestore());
    } else {
      let cachedToken: string | null = null;
      let tokenExpiry = 0;
      adapter = createRestBackfillAdapter({
        projectId,
        getAccessToken: async () => {
          const now = Date.now();
          if (!cachedToken || now >= tokenExpiry) {
            cachedToken = await generateGoogleOAuthTokenNode(serviceAccount);
            tokenExpiry = now + 50 * 60 * 1000;
          }
          return cachedToken;
        },
      });
    }
  } catch (initErr: any) {
    console.error('Failed to initialize Firestore adapter:', initErr.message);
    process.exitCode = 1;
    return;
  }

  console.log('Starting paginated scan over collection: user_subscriptions ...');

  const summary = await executeBackfillRunner({
    source: adapter,
    isApply,
    pageSize,
    onPageComplete: (pageIndex, currentSummary) => {
      console.log(
        `[Page ${pageIndex}] Scanned: ${currentSummary.totalScanned} | Eligible: ${currentSummary.eligible} | Updated: ${currentSummary.updated} | Skipped: ${currentSummary.skipped} | Conflicts: ${currentSummary.concurrencyConflicts}`
      );
    },
  });

  console.log('\n==============================================================================');
  console.log('TRAKIFY — Backfill Execution Summary Report');
  console.log('==============================================================================');
  console.log(`Mode:                     ${summary.dryRun ? 'DRY RUN (Simulated)' : 'APPLIED (Live Writes)'}`);
  console.log(`Pages Processed:          ${summary.pagesProcessed}`);
  console.log(`Total Scanned:            ${summary.totalScanned}`);
  console.log(`Total Eligible:           ${summary.eligible} (Active: ${summary.activeEligible}, Expired: ${summary.expiredEligible})`);
  console.log(`Successfully Updated:     ${summary.updated}`);
  console.log(`Skipped Records:          ${summary.skipped} (Has Native Timestamp: ${summary.skippedExistingTimestamp}, No Expiry: ${summary.skippedNoExpiry})`);
  console.log(`Invalid Date Records:     ${summary.invalid}`);
  console.log(`Concurrency Conflicts:    ${summary.concurrencyConflicts}`);
  console.log('Plan Tier Distribution:  ', summary.planTierDistribution);
  if (summary.concurrencyConflicts > 0) {
    console.log(`Conflict Document IDs:    ${summary.concurrencyConflictIds.join(', ')}`);
  }
  console.log('==============================================================================\n');
}

if (process.argv[1]?.endsWith('backfillLegacySubscriptionTimestamps.ts')) {
  runBackfillCli().catch((err) => {
    console.error('Backfill CLI execution failure:', err);
    process.exit(1);
  });
}
