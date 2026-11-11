/**
 * One-time Supabase Postgres/Auth export -> Firebase Auth/Firestore import.
 * Run from an environment with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * GOOGLE_APPLICATION_CREDENTIALS (or ADC), and FIREBASE_PROJECT_ID configured.
 * Defaults to a dry run. Pass --apply only after reviewing the summary.
 */
import { applicationDefault, initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const apply = process.argv.includes('--apply');
if (!supabaseUrl || !supabaseKey || !projectId) {
  throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and FIREBASE_PROJECT_ID before running this migration.');
}

if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();
const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

const tables = [
  'user_trackers', 'class_workspaces', 'class_members', 'class_profiles', 'class_join_requests',
  'class_channels', 'class_timetable_rules', 'class_timetable_overrides', 'class_attendance_records',
  'class_messages', 'class_message_reactions', 'class_saved_messages', 'class_notifications',
  'user_subscriptions', 'admin_users', 'admin_audit_logs', 'payment_webhook_events',
];

async function getUsers() {
  const users = [];
  for (let page = 1; page <= 1000; page++) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers });
    if (!response.ok) throw new Error(`Supabase Auth export failed (${response.status}).`);
    const body = await response.json();
    const batch = Array.isArray(body) ? body : body.users || [];
    users.push(...batch);
    if (batch.length < 1000) break;
  }
  return users;
}

async function getTableRows(table) {
  const output = [];
  for (let offset = 0; offset < 10_000_000; offset += 1000) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1000&offset=${offset}`, { headers });
    if (response.status === 404 || response.status === 400) {
      const message = await response.text();
      if (/does not exist|schema cache/i.test(message)) return [];
      throw new Error(`Could not export ${table} (${response.status}): ${message}`);
    }
    if (!response.ok) throw new Error(`Could not export ${table} (${response.status}).`);
    const rows = await response.json();
    output.push(...rows);
    if (rows.length < 1000) break;
  }
  return output;
}

const legacyUsers = await getUsers();
const uidMap = new Map();
const unmapped = [];
for (const user of legacyUsers) {
  if (!user.email) { unmapped.push(user.id); continue; }
  try {
    uidMap.set(user.id, (await auth.getUserByEmail(user.email)).uid);
  } catch {
    unmapped.push(user.email);
  }
}

function mapUid(value) {
  if (typeof value !== 'string' || !value) return value;
  return uidMap.get(value) || value;
}
function encode(value) { return encodeURIComponent(String(value)); }
function documentId(table, row) {
  switch (table) {
    case 'user_trackers': case 'class_profiles': case 'user_subscriptions': case 'admin_users': return mapUid(row.user_id);
    case 'class_members': case 'class_join_requests': return `${row.workspace_id}__${mapUid(row.user_id)}`;
    case 'class_attendance_records': return [row.workspace_id, mapUid(row.user_id), row.occurrence_key].map(encode).join('__');
    case 'class_message_reactions': return [row.message_id, mapUid(row.user_id), row.emoji].map(encode).join('__');
    case 'class_saved_messages': return [row.workspace_id, mapUid(row.user_id), row.message_id].map(encode).join('__');
    default: return String(row.id || row.event_id || '');
  }
}
function remapValue(value) {
  if (Array.isArray(value)) return value.map(remapValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapValue(item)]));
  if (typeof value !== 'string') return value;
  try {
    const url = new URL(value);
    if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/')) return null;
  } catch {}
  if (/^(user-fitness-photos|classspace-avatars)\//.test(value)) return null;
  return value;
}
function remapRow(row) {
  const next = remapValue(row);
  for (const field of ['user_id', 'created_by', 'sender_id', 'reviewed_by', 'actor_id']) {
    if (next[field]) next[field] = mapUid(next[field]);
  }
  if (next.data && typeof next.data === 'object') delete next.data.progressPhotos;
  return next;
}

const exported = new Map();
for (const table of tables) exported.set(table, await getTableRows(table));
if (unmapped.length) {
  console.error(`No matching Firebase Auth accounts for ${unmapped.length} legacy users:`);
  console.error(unmapped.slice(0, 50).join('\n'));
  throw new Error('No records were written. Each legacy user must first sign in to Firebase using the same email, then rerun.');
}

const missingIds = [];
for (const [table, rows] of exported) {
  for (const row of rows) if (!documentId(table, row)) missingIds.push(`${table}: ${row.id || '(no id)'}`);
}
if (missingIds.length) throw new Error(`Export contains ${missingIds.length} records without a stable ID; no records were written.`);

console.log(`${apply ? 'APPLY MODE' : 'DRY RUN'} — exported row counts:`);
for (const [table, rows] of exported) console.log(`${table}: ${rows.length}`);
console.log(`Mapped Firebase accounts: ${uidMap.size}`);
if (!apply) {
  console.log('Dry run complete. Review counts, configure a Firestore backup, then rerun with --apply.');
  process.exit(0);
}

for (const [table, rows] of exported) {
  for (let start = 0; start < rows.length; start += 400) {
    const batch = db.batch();
    rows.slice(start, start + 400).forEach((row) => {
      const id = documentId(table, row);
      batch.set(db.collection(table).doc(id), remapRow(row), { merge: true });
    });
    await batch.commit();
  }
}

// Rebuild the private join-code lookup index from migrated workspaces.
for (const row of exported.get('class_workspaces') || []) {
  if (row.join_code) await db.collection('class_join_codes').doc(String(row.join_code).toUpperCase()).set({ workspace_id: row.id });
}
console.log('Firestore import finished. Source Supabase records were not modified.');
