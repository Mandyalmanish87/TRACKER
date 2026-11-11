/**
 * Small Firestore data client used while service modules are being migrated
 * from PostgREST-style queries. It speaks directly to Firebase SDKs.
 */
import {
  collection, doc, documentId, getDoc, getDocs, limit, onSnapshot, orderBy,
  query, where, writeBatch, QueryConstraint,
} from 'firebase/firestore';
import { firebaseService } from './firebaseService';

type Filter = { field: string; op: '==' | 'in' | '!=' | 'is' | '<' | '<=' | '>' | '>='; value: unknown };
type Sort = { field: string; ascending: boolean };
type Row = Record<string, any>;

function clean(value: any): any {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, clean(v)]));
  }
  return value;
}

function deterministicId(table: string, row: Row): string | undefined {
  if (row.id) return String(row.id);
  const parts: Record<string, string[]> = {
    class_members: ['workspace_id', 'user_id'],
    class_attendance_records: ['workspace_id', 'user_id', 'occurrence_key'],
    class_message_reactions: ['message_id', 'user_id', 'emoji'],
    class_saved_messages: ['workspace_id', 'user_id', 'message_id'],
    user_trackers: ['user_id'],
  };
  const key = parts[table];
  if (['class_profiles', 'user_subscriptions', 'admin_users'].includes(table) && row.user_id) return String(row.user_id);
  if (!key?.every((field) => row[field] !== undefined)) return undefined;
  return key.map((field) => encodeURIComponent(String(row[field]))).join('__');
}

class FirestoreTableQuery implements PromiseLike<{ data: any; error: any }> {
  private filters: Filter[] = [];
  private sorts: Sort[] = [];
  private maxRows?: number;
  private offsetRows?: number;
  private operation: 'read' | 'insert' | 'upsert' | 'update' | 'delete' = 'read';
  private payload: any;
  private singleMode: 'single' | 'maybe' | null = null;

  constructor(private table: string) {}
  select(_columns = '*') { return this; }
  eq(field: string, value: unknown) { this.filters.push({ field, op: '==', value }); return this; }
  neq(field: string, value: unknown) { this.filters.push({ field, op: '!=', value }); return this; }
  lt(field: string, value: unknown) { this.filters.push({ field, op: '<', value }); return this; }
  lte(field: string, value: unknown) { this.filters.push({ field, op: '<=', value }); return this; }
  gt(field: string, value: unknown) { this.filters.push({ field, op: '>', value }); return this; }
  gte(field: string, value: unknown) { this.filters.push({ field, op: '>=', value }); return this; }
  is(field: string, value: unknown) { this.filters.push({ field, op: 'is', value }); return this; }
  in(field: string, value: unknown[]) { this.filters.push({ field, op: 'in', value }); return this; }
  order(field: string, options?: { ascending?: boolean }) { this.sorts.push({ field, ascending: options?.ascending !== false }); return this; }
  limit(count: number) { this.maxRows = count; return this; }
  range(from: number, to: number) { this.offsetRows = from; this.maxRows = Math.max(0, to - from + 1); return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  insert(payload: any) { this.operation = 'insert'; this.payload = payload; return this; }
  upsert(payload: any) { this.operation = 'upsert'; this.payload = payload; return this; }
  update(payload: Row) { this.operation = 'update'; this.payload = payload; return this; }
  delete() { this.operation = 'delete'; return this; }

  private makeQuery(db: NonNullable<ReturnType<typeof firebaseService.getFirestore>>) {
    const constraints: QueryConstraint[] = [];
    for (const filter of this.filters) {
      const field = filter.field === 'id' ? documentId() : filter.field;
      if (filter.op === 'is') constraints.push(where(field, '==', filter.value));
      else constraints.push(where(field, filter.op as any, filter.value));
    }
    for (const sort of this.sorts) constraints.push(orderBy(sort.field === 'id' ? documentId() : sort.field, sort.ascending ? 'asc' : 'desc'));
    if (this.maxRows !== undefined && !this.offsetRows) constraints.push(limit(this.maxRows));
    return query(collection(db, this.table), ...constraints);
  }

  private async getTargetSnapshots(db: NonNullable<ReturnType<typeof firebaseService.getFirestore>>) {
    const idFilter = this.filters.find((filter) => filter.field === 'id' && (filter.op === '==' || filter.op === 'in'));
    if (!idFilter) return (await getDocs(this.makeQuery(db))).docs;
    const ids = idFilter.op === 'in' ? idFilter.value as unknown[] : [idFilter.value];
    const snapshots = await Promise.all(ids.map((id) => getDoc(doc(db, this.table, String(id)))));
    return snapshots.filter((snap) => snap.exists() && this.filters.every((filter) => {
      if (filter.field === 'id') return true;
      const value = snap.get(filter.field);
      if (filter.op === 'in') return (filter.value as unknown[]).includes(value);
      if (filter.op === 'is' || filter.op === '==') return value === filter.value;
      if (filter.op === '!=') return value !== filter.value;
      if (filter.op === '<') return value < (filter.value as any);
      if (filter.op === '<=') return value <= (filter.value as any);
      if (filter.op === '>') return value > (filter.value as any);
      if (filter.op === '>=') return value >= (filter.value as any);
      return true;
    }));
  }

  private async readRows() {
    const db = firebaseService.getFirestore();
    if (!db) throw new Error('Firebase Firestore is not configured.');
    const userFilter = this.filters.find((filter) => filter.field === 'user_id' && filter.op === '==');
    if (userFilter && ['user_subscriptions', 'admin_users', 'class_profiles'].includes(this.table)) {
      const snap = await getDoc(doc(db, this.table, String(userFilter.value)));
      if (!snap.exists()) return [];
      const row: Row = { ...snap.data(), id: snap.data().id || snap.id };
      if (this.filters.every((filter) => filter.op === '==' ? row[filter.field] === filter.value : filter.op === 'is' ? row[filter.field] === filter.value : true)) return [row];
      return [];
    }
    const docs = await this.getTargetSnapshots(db);
    const allRows: Row[] = docs.map((item) => { const data = item.data() || {}; return { ...data, id: data.id || item.id }; });
    const start = this.offsetRows || 0;
    return allRows.slice(start, this.maxRows === undefined ? undefined : start + this.maxRows);
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const db = firebaseService.getFirestore();
    if (!db) return { data: null, error: { message: 'Firebase Firestore is not configured.' } };
    try {
      let rows: Row[] = [];
      if (this.operation === 'read') {
        rows = await this.readRows();
      } else if (this.operation === 'insert' || this.operation === 'upsert') {
        const input = Array.isArray(this.payload) ? this.payload : [this.payload];
        const pending: Array<{ ref: ReturnType<typeof doc>; data: Row }> = [];
        for (const raw of input) {
          const row = clean(raw || {});
          const id = deterministicId(this.table, row);
          const docRef = id ? doc(db, this.table, id) : doc(collection(db, this.table));
          const next = { ...row, id: row.id || docRef.id };
          pending.push({ ref: docRef, data: next });
          rows.push(next);
        }
        for (let start = 0; start < pending.length; start += 400) {
          const batch = writeBatch(db);
          pending.slice(start, start + 400).forEach(({ ref: docRef, data }) => batch.set(docRef, data, { merge: this.operation === 'upsert' }));
          await batch.commit();
        }
      } else {
        const snapshots = await this.getTargetSnapshots(db);
        for (let start = 0; start < snapshots.length; start += 400) {
          const batch = writeBatch(db);
          snapshots.slice(start, start + 400).forEach((item) => {
            if (this.operation === 'delete') batch.delete(item.ref);
            else batch.update(item.ref, clean(this.payload || {}));
            if (this.operation === 'update') { const data = item.data() || {}; rows.push({ ...data, ...clean(this.payload || {}), id: data.id || item.id }); }
          });
          await batch.commit();
        }
      }
      if (this.singleMode) {
        if (rows.length === 0 && this.singleMode === 'single') return { data: null, error: { message: 'Expected one record, but found none.' } };
        if (rows.length > 1) return { data: null, error: { message: `Expected one record, found ${rows.length}.` } };
        return { data: rows[0] || null, error: null };
      }
      return { data: rows, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error?.message || 'Firebase request failed.', code: error?.code } };
    }
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled || undefined, onrejected || undefined);
  }
}

class FirebaseRealtimeChannel {
  private listeners: Array<() => void> = [];
  private watches: Array<{ table: string; workspaceId?: string }> = [];
  constructor(_name: string) {}
  on(_event: string, filter: { table?: string; filter?: string }, callback: () => void) {
    const workspaceId = filter.filter?.match(/^workspace_id=eq\.(.+)$/)?.[1];
    if (filter.table) this.watches.push({ table: filter.table, workspaceId });
    (this as any).callback = callback;
    return this;
  }
  subscribe() {
    const db = firebaseService.getFirestore();
    if (!db) return this;
    const callback = (this as any).callback as (() => void) | undefined;
    if (!callback) return this;
    for (const watch of this.watches) {
      const constraints = watch.workspaceId ? [where('workspace_id', '==', watch.workspaceId)] : [];
      const stop = onSnapshot(query(collection(db, watch.table), ...constraints), callback, () => {});
      this.listeners.push(stop);
    }
    return this;
  }
  stop() { this.listeners.forEach((stop) => stop()); this.listeners = []; }
}

const channels = new Set<FirebaseRealtimeChannel>();

export const firebaseDataClient: any = {
  from: (table: string) => new FirestoreTableQuery(table),
  async rpc(name: string, args: Row = {}) {
    try {
      const data = await firebaseService.callFunction<{ name: string; args: Row }, any>('trackerRpc', { name, args });
      return { data, error: null };
    } catch (error: any) { return { data: null, error: { message: error?.message || 'Firebase operation failed.', code: error?.code } }; }
  },
  functions: {
    async invoke(name: string, options: { body?: any } = {}) {
      try { return { data: await firebaseService.callFunction<any, any>(name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), options.body), error: null }; }
      catch (error: any) { return { data: null, error: { message: error?.message || 'Firebase function failed.' } }; }
    },
  },
  auth: {
    async getSession() {
      const user = firebaseService.getAuth()?.currentUser || null;
      return { data: { session: user ? { user } : null }, error: null };
    },
    async getUser() {
      const user = firebaseService.getAuth()?.currentUser || null;
      return { data: { user }, error: null };
    },
  },
  channel(name: string) { const channel = new FirebaseRealtimeChannel(name); channels.add(channel); return channel; },
  removeChannel(channel: FirebaseRealtimeChannel) { channel.stop(); channels.delete(channel); return Promise.resolve('ok'); },
};

export function getFirebaseDataClient() {
  return firebaseService.isConfigured ? firebaseDataClient : null;
}
