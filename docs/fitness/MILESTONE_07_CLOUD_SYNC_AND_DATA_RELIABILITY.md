# Milestone 07: Cloud Synchronization, Private Storage & Data Reliability

**Document ID:** `FITNESS-M07-CLOUD-SYNC`  
**Parent Specification:** [`FITNESS_MASTER_SPEC.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/fitness/FITNESS_MASTER_SPEC.md)  
**Target Directory:** `docs/fitness/`  

---

## 1. Milestone Name
**Milestone 07 — Supabase Cloud Sync, Private Photo Bucket Security & Offline Data Reliability**

---

## 2. Objective
Establish an enterprise-grade, privacy-first cloud synchronization and storage architecture for all fitness data. Integrate with the existing `user_trackers` Supabase table; provide dedicated Row-Level Security (RLS) migrations; create a private Supabase Storage bucket (`user-fitness-photos`) with strict authenticated access policies and short-lived signed URLs; implement bidirectional offline conflict resolution with deletion tombstones; and build comprehensive JSON export, import, and backup verification utilities.

---

## 3. Why This Milestone Exists
Students use multiple devices (laptop in the library, phone in the gym). Without seamless cloud synchronization, workouts logged on a phone will not reflect on the laptop dashboard. Moreover, progress photos require private, secure cloud backup that prevents data loss if a browser clears local storage, while guaranteeing that no unauthorized third party or peer student can access sensitive photos.

---

## 4. Repository Areas to Inspect
1. **Existing Cloud Sync Service:** [`src/services/cloudSyncService.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/services/cloudSyncService.ts) (handles `fetchCloudDataDetailed`, `pushCloudData`, `SyncTombstone`, `user_trackers`).
2. **Auth Service & Supabase Client:** [`src/services/authService.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/services/authService.ts) (`getSupabaseClient`, `isSupabaseConfigured`).
3. **Database Migrations:** [`supabase/migrations/20261020_user_trackers_schema.sql`](file:///c:/Users/mandy/Downloads/TRACKER/supabase/migrations/20261020_user_trackers_schema.sql).
4. **Storage & Serialization:** [`src/services/storage.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/services/storage.ts).

---

## 5. Existing Functionality to Preserve
1. **Offline-First Resilience:** If Supabase credentials are missing or the device is offline, the entire fitness system must work locally without network errors or blocking dialogs.
2. **Strict User Isolation:** `auth.uid() = user_id` must remain the absolute RLS boundary.
3. **Existing Tombstone Engine:** Cross-device deletion sync in `cloudSyncService.ts` must be extended, not replaced.
4. **No Service-Role Key Exposure:** All client operations must use the standard anonymous key with user JWT. Never embed service-role keys in frontend code.

---

## 6. Features Included in Milestone 07

### 6.1 Supabase Schema Evolution & RLS
- **Fitness Schema Migration (`supabase/migrations/20261110_fitness_ecosystem_schema.sql`):**
  - Verify and extend the `public.user_trackers` JSONB store to support the complete fitness payload (`workoutSessions`, `exerciseLibrary`, `bodyMeasurements`, `sleepRecoveryLogs`, `cardioSessions`, `mealPlans`, `hydrationLogs`).
  - Add optional indexed metadata columns or dedicated tables if high-frequency querying is required.
  - Enforce strict Row Level Security (RLS):
    ```sql
    -- Users can only read and write their own tracker
    create policy "Users can only access their own fitness tracker"
      on public.user_trackers
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
    ```

### 6.2 Private Progress Photo Storage Bucket
- **Supabase Storage Configuration:**
  - Create a private, non-public bucket named `user-fitness-photos`.
  - Folder hierarchy: `user-fitness-photos/{user_id}/{photo_id}.webp`.
  - Storage RLS Policy:
    ```sql
    create policy "Allow authenticated upload to own folder"
      on storage.objects for insert
      with check (
        bucket_id = 'user-fitness-photos' 
        and auth.uid()::text = (storage.foldername(name))[1]
      );

    create policy "Allow authenticated download from own folder"
      on storage.objects for select
      using (
        bucket_id = 'user-fitness-photos' 
        and auth.uid()::text = (storage.foldername(name))[1]
      );

    create policy "Allow authenticated delete from own folder"
      on storage.objects for delete
      using (
        bucket_id = 'user-fitness-photos' 
        and auth.uid()::text = (storage.foldername(name))[1]
      );
    ```
- **Zero Public URLs:** Photos are never served over public CDN URLs. The client requests temporary signed URLs:
  `supabase.storage.from('user-fitness-photos').createSignedUrl(path, 60)` with a 60-second expiration.

### 6.3 Bidirectional Offline Conflict Resolution & Tombstones
- **Tombstone Sync for New Collections:**
  - When an exercise, workout, food entry, or measurement is deleted offline, record a tombstone in `state.tombstones`:
    `{ id: 'item-123', collection: 'workoutSessions', deletedAt: '2026-11-02T12:00:00Z' }`.
  - Upon reconnection, remote items matching tombstones are purged, preventing deleted records from resurrecting.
- **Last-Write-Wins Timestamp Resolution:**
  - Every fitness entity contains an `updatedAt` ISO timestamp.
  - Merge conflicts resolve cleanly: newer local edits override older cloud state; newer cloud additions merge into local state.

### 6.4 Comprehensive Data Export, Backup & Privacy Purge
- **Full JSON Export:** Single-click export under Settings: *"Export Complete Fitness & Study Data (JSON)"*.
- **Selective Fitness Export:** Export CSV/JSON summaries specifically for workout logs, body measurements, or nutrition history.
- **GDPR / Privacy "Delete All Fitness Data":**
  - Purges local IndexedDB photo blobs.
  - Purges local storage keys.
  - Sends authenticated deletion requests to Supabase Storage and `user_trackers`.

---

## 7. Features Explicitly Excluded
- Public social profile sharing or community leaderboards.
- Direct wearable cloud syncing (Garmin Connect, Strava API, etc. are excluded).

---

## 8. Dependencies on Earlier Milestones
- **Requires Milestone 00 through Milestone 06** to ensure all fitness models are finalized before locking sync schemas.

---

## 9. Data Model Requirements
Update `src/types/fitness.ts` with sync metadata:
```typescript
export interface FitnessSyncStatus {
  lastSyncedAt?: string;
  isSyncing: boolean;
  pendingChangesCount: number;
  syncError?: string;
  storageUsageBytes?: number;
}
```
Update `cloudSyncService.ts` to include fitness collections in its serialization and tombstone handling.

---

## 10. UI Requirements
1. **Sync Status Pill in Settings / Header:** Cloud icon showing "Synced", "Syncing...", "Offline (Changes Saved Locally)", or "Sync Error".
2. **Data Management Section in Settings:**
   - "Backup & Export Data" (JSON download).
   - "Restore Data from Backup" (file picker with schema validation).
   - "Clear All Fitness Records" (requires typing `DELETE FITNESS DATA` in confirmation modal).
3. **Photo Sync Progress Indicator:** Visual upload progress indicator when backing up progress photos to the private bucket.

---

## 11. Business Logic Requirements
- **Photo Sync Worker:**
  ```typescript
  export async function syncPendingPhotosToCloud(
    userId: string,
    photos: ProgressPhotoEntry[]
  ): Promise<void>;
  ```
  Iterates un-synced photos, reads binary blob from IndexedDB, uploads to Supabase storage, and updates photo record with cloud path.
- **Idempotent Merge Utility:**
  ```typescript
  export function mergeFitnessAppState(
    local: AppStateData, 
    remote: AppStateData
  ): AppStateData;
  ```

---

## 12. Persistence Requirements
- Pending offline sync items stored in `localStorage` under `tracker_pending_fitness_sync_${userId}`.
- All cloud sync operations must be retry-safe (idempotent).

---

## 13. Edge Cases
1. **Supabase Unconfigured:** When `.env` lacks credentials, `cloudSyncService` immediately returns `{ status: 'unconfigured' }` without console errors, allowing seamless guest/local use.
2. **Network Dropout Mid-Upload:** Photos upload one by one with retry logic; interrupted uploads resume from the failed photo without re-uploading completed items.
3. **Simultaneous Multi-Device Edits:** Last-write-wins at the item level; editing a workout on Mobile and logging a meal on Laptop merges both records without overwriting either.
4. **Exceeded Storage Bucket Quota:** If storage upload fails due to quota, keep local IndexedDB copy safe and notify user gracefully.

---

## 14. Error Handling
- Safe handling of expired JWTs (automatic refresh via Supabase client).
- Validation check before restoring JSON backups: verify `schemaVersion` and validate structure before replacing `localStorage`.

---

## 15. Testing Requirements
Create `tests/milestone07CloudSyncAndReliability.test.tsx`:
- Test offline-to-online sync transition with mock Supabase responses.
- Test tombstone deletion preventing resurrection of deleted workouts across sync cycles.
- Test last-write-wins conflict resolution between local and remote fitness entries.
- Test private photo bucket path resolution: verifies that user A cannot access user B's storage path.
- Test exporting complete fitness state to JSON and restoring it with 100% data fidelity.
- Test that unconfigured Supabase gracefully maintains local-only mode without throwing unhandled promise rejections.

---

## 16. Acceptance Criteria
1. Complete fitness state syncs seamlessly to Supabase `user_trackers` when authenticated.
2. Progress photos upload to private Supabase storage bucket `user-fitness-photos` under strict user-folder RLS.
3. Photos are accessible only via temporary signed URLs.
4. Offline operations merge cleanly upon reconnection without data loss or duplication.
5. All tests in `tests/milestone07CloudSyncAndReliability.test.tsx` pass.
6. Zero regressions in existing academic or classSpace cloud sync.

---

## 17. Completion Checklist
- [ ] Author `supabase/migrations/20261110_fitness_ecosystem_schema.sql` with RLS policies.
- [ ] Configure `user-fitness-photos` private storage bucket policies in SQL.
- [ ] Implement `syncPendingPhotosToCloud` in `src/services/fitnessPhotoSync.ts`.
- [ ] Expand `cloudSyncService.ts` to serialize all new fitness collections and tombstones.
- [ ] Build Data Export & Restore modals in Settings.
- [ ] Author `tests/milestone07CloudSyncAndReliability.test.tsx`.
- [ ] Run `npx tsc --noEmit` and confirm 0 errors.

---

## 18. Regression Risks
- **Risk:** Large progress photo payloads causing `user_trackers` JSONB column to exceed row size limits.
  - **Mitigation:** Photo binary data is strictly saved to Supabase Storage; only the short string path (`user_id/photo_id.webp`) is stored in the database.

---

## 19. Instructions for the Next Milestone
Proceed to **Milestone 08 (`MILESTONE_08_POLISH_TESTING_AND_RELEASE.md`)** for end-to-end testing, accessibility hardening, performance optimizations, and final release verification.

