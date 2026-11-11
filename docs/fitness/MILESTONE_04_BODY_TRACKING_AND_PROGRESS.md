# Milestone 04: Body Tracking, Composition & Progress Photos

**Document ID:** `FITNESS-M04-BODY-TRACKING`  
**Parent Specification:** [`FITNESS_MASTER_SPEC.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/fitness/FITNESS_MASTER_SPEC.md)  
**Target Directory:** `docs/fitness/`  

---

## 1. Milestone Name
**Milestone 04 — Comprehensive Body Measurements, Body Composition & Private Progress Photo Vault**

---

## 2. Objective
Extend body tracking beyond basic scale weight into a comprehensive anthropometric system: track 10 circumference sites (Waist, Chest, Hips, Neck, Left/Right Arms, Left/Right Thighs, Calves, Shoulders) in metric/imperial units; implement the U.S. Navy circumference body composition engine (body fat %, lean mass, fat mass, waist-to-height ratio); and build a private, local-first Progress Photo Vault with ghost overlay, side-by-side comparison, and strict privacy controls.

---

## 3. Why This Milestone Exists
Scale weight alone is a misleading metric for fitness progress, especially for resistance training students who may gain muscle while losing fat (body recomposition). Anthropometric measurements and visual progress photos provide definitive proof of physical change. Because progress photos are highly sensitive personal data, they require dedicated private local storage and privacy protection.

---

## 4. Repository Areas to Inspect
1. **Existing Weight Tracker:** [`src/components/nutrition/WeightTracker.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/nutrition/WeightTracker.tsx).
2. **Existing Weight Log Actions:** [`src/context/AppContext.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/context/AppContext.tsx) (`logWeight`, `deleteWeightLog`).
3. **Existing Trend Calculation:** [`src/utils/nutritionCalculators.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/utils/nutritionCalculators.ts) (`evaluateWeightTrend`).
4. **Existing Types:** `src/types/fitness.ts` and `src/types/index.ts` (`WeightLogEntry`, `BodyMeasurementEntry`, `ProgressPhotoEntry`).

---

## 5. Existing Functionality to Preserve
1. **Existing Scale Weight History:** All records in `state.weightLogs` must remain preserved and visible in charts.
2. **Existing 2-Week Trend Alerts:** The linear regression trend in `evaluateWeightTrend` must continue functioning.
3. **Offline Operation:** All measurements and photos must be fully accessible and loggable offline.
4. **No External Photo Uploads:** Photos must never be uploaded to third-party CDNs, external fitness APIs, or public servers.

---

## 6. Features Included in Milestone 04

### 6.1 Multi-Site Circumference Tracking
- **10 Anthropometric Measurement Sites:**
  1. Waist (at narrowest point or navel level)
  2. Chest (at nipple line)
  3. Hips (at widest gluteal point)
  4. Neck (below larynx)
  5. Left Bicep / Upper Arm (flexed)
  6. Right Bicep / Upper Arm (flexed)
  7. Left Thigh (mid-quad)
  8. Right Thigh (mid-quad)
  9. Calves (widest gastrocnemius point)
  10. Shoulders (circumference across deltoids)
- **Measurement Mechanics:**
  - Support centimeters (cm) and inches (in) with automatic unit conversion.
  - Per-site measurement history table and progression charts.
  - Date and notes attached to each measurement session.

### 6.2 Body Composition Engine
- **U.S. Navy Circumference Formula:**
  - *For Men:*
    $$\text{Body Fat } \% = 86.010 \times \log_{10}(\text{waist} - \text{neck}) - 70.041 \times \log_{10}(\text{height}) + 36.76$$
  - *For Women:*
    $$\text{Body Fat } \% = 163.205 \times \log_{10}(\text{waist} + \text{hips} - \text{neck}) - 97.684 \times \log_{10}(\text{height}) - 78.387$$
  *(All measurements in centimeters).*
- **Calculated Composition Breakdown:**
  - Fat Mass (kg): $\text{Weight} \times \left(\frac{\text{Body Fat } \%}{100}\right)$
  - Lean Mass (kg): $\text{Weight} - \text{Fat Mass}$
  - Waist-to-Height Ratio (WHtR): $\frac{\text{Waist (cm)}}{\text{Height (cm)}}$ (with standard reference brackets: $<0.5$ healthy, $\ge 0.5$ increased cardiovascular risk).
- **Measurement Provenance Labels:**
  Every displayed metric must feature an explicit provenance badge:
  - `[Calculated: Navy Method]`
  - `[Manually Entered]`
  - `[Measured Scale Weight]`

### 6.3 Private Progress Photo Vault
- **Photo Categories:**
  - Front Pose
  - Side Pose
  - Back Pose
  - Custom Category
- **Local-First Privacy Architecture:**
  - Photos are compressed on the client canvas (max 1600px, WebP format, quality 0.85).
  - Stored locally in **IndexedDB** as binary `Blob` objects under a private database `tracker_photo_vault`.
  - Photos are never stored in `localStorage` (preventing quota exhaustion).
- **Privacy Controls:**
  - **Privacy Blocker / Privacy Blur:** Optional toggle requiring a single tap or PIN code to reveal photos.
  - Quick "Hide Photos" button.
- **Visual Comparison Tools:**
  - **Side-by-Side Comparison:** Compare any two dates with synchronized zoom and scale weight tags.
  - **Ghost Overlay / Alignment Guide:** Semi-transparent overlay of a previous photo on the camera viewfinder to ensure consistent distance and angle.
  - **Before & After Slider:** Interactive split slider showing transformation over time.

---

## 7. Features Explicitly Excluded
- Cloud synchronization of photos to Supabase Storage (reserved for M07).
- Public social media sharing integrations.
- Wearable Bluetooth scale syncing (all scale entries are user-entered).

---

## 8. Dependencies on Earlier Milestones
- **Requires Milestone 00** for consolidated types.

---

## 9. Data Model Requirements
Use `BodyMeasurementEntry`, `BodyCompositionEntry`, and `ProgressPhotoEntry` from `src/types/fitness.ts`.  
Ensure `AppContext` exposes:
```typescript
interface AppContextType {
  // ... existing fields ...
  bodyMeasurements: BodyMeasurementEntry[];
  bodyCompositions: BodyCompositionEntry[];
  progressPhotos: ProgressPhotoEntry[];
  logBodyMeasurement: (entry: Omit<BodyMeasurementEntry, 'id' | 'createdAt'>) => void;
  deleteBodyMeasurement: (id: string) => void;
  saveProgressPhoto: (category: ProgressPhotoEntry['category'], photoBlob: Blob, notes?: string) => Promise<string>;
  deleteProgressPhoto: (id: string) => Promise<void>;
}
```

---

## 10. UI Requirements
1. **Body OS Navigation Tab:** Accessible within the Personal Space sub-navigation strip or as a dedicated section in Nutrition/Gym.
2. **Circumference Entry Sheet:** Interactive human silhouette where clicking a body part (e.g., Waist or Bicep) opens its numerical input field.
3. **Body Composition Card:** Gauge showing Body Fat % with lean mass vs fat mass breakdown bars and provenance badges.
4. **Progress Photo Gallery & Comparator:** Clean grid showing Front/Side/Back thumbnails, with an interactive "Compare Two Dates" split slider.

---

## 11. Business Logic Requirements
- **Navy Body Fat Safety Validation:**
  - Requires valid height ($50\text{--}250\text{ cm}$), neck ($20\text{--}60\text{ cm}$), waist ($40\text{--}200\text{ cm}$), and hips ($50\text{--}220\text{ cm}$ for females).
  - If $\text{waist} \le \text{neck}$, the logarithm is undefined; the validator safely returns `null` with a helpful validation message: *"Waist circumference must be greater than neck circumference."*
- **IndexedDB Photo Store:**
  Implement `src/utils/photoStorage.ts`:
  ```typescript
  export async function storePhotoLocally(photoId: string, blob: Blob): Promise<void>;
  export async function retrievePhotoLocally(photoId: string): Promise<string | null>; // Returns Object URL
  export async function deletePhotoLocally(photoId: string): Promise<void>;
  ```

---

## 12. Persistence Requirements
- Numerical records (`bodyMeasurements`, `bodyCompositions`, `progressPhotos` metadata) persist in `localStorage` under `tracker_user_data_${userId}`.
- Image binary blobs persist in IndexedDB (`tracker_photo_vault` store).
- Sanitizers in `storage.ts` preserve measurement and photo metadata across demo data cleanups.

---

## 13. Edge Cases
1. **IndexedDB Unavailable (Private Browsing Quota Exceeded):** Catch error, display graceful toast: *"Browser storage restricted. Cannot save high-res photo in private window."*
2. **Missing Neck or Waist Measurement:** Gracefully omit Navy calculation while keeping scale weight and single circumferences saved.
3. **Extreme Body Fat Calculations:** Clamp output to realistic bounds ($3\%\text{--}65\%$).
4. **Large Image Upload (Camera RAW / 50MB):** Canvas compressor automatically downsizes image to max 1600px width/height and compresses to WebP before storing.

---

## 14. Error Handling
- Safe handling of camera capture failure.
- Modal confirmation before permanent deletion of any progress photo.

---

## 15. Testing Requirements
Create `tests/milestone04BodyTracking.test.tsx`:
- Test Navy body fat formula for male inputs with known verified results (e.g., Height: 180cm, Neck: 38cm, Waist: 84cm = ~15.2% BF).
- Test Navy body fat formula for female inputs (Height: 165cm, Neck: 32cm, Waist: 70cm, Hips: 95cm).
- Test waist-to-height ratio (WHtR) calculation and risk category assignment.
- Test client-side canvas compression downscaling images over 2000px.
- Test IndexedDB storage, retrieval, and deletion of photo blobs using a mock store.
- Test privacy toggle blurring photos when active.
- Verify existing `WeightTracker.tsx` continues to function.

---

## 16. Acceptance Criteria
1. Users can log all 10 body circumference measurements in cm or inches.
2. Navy body fat % and lean/fat mass are calculated with clear provenance badges.
3. Progress photos can be captured/uploaded, tagged (Front/Side/Back), and compared side-by-side.
4. Photos are stored locally in IndexedDB without blowing up `localStorage` limits.
5. All tests in `tests/milestone04BodyTracking.test.tsx` pass.
6. Zero regressions in DayOS, WeightTracker, or academic tests.

---

## 17. Completion Checklist
- [ ] Implement `src/utils/bodyComposition.ts` with Navy formulas and WHtR calculations.
- [ ] Implement `src/utils/photoStorage.ts` with IndexedDB binary blob store.
- [ ] Build `BodyCircumferenceForm` with interactive human silhouette.
- [ ] Build `BodyCompositionCard` with provenance badges.
- [ ] Build `ProgressPhotoVault` with before/after comparator and ghost overlay.
- [ ] Author `tests/milestone04BodyTracking.test.tsx`.
- [ ] Run `npx tsc --noEmit` and confirm 0 errors.

---

## 18. Regression Risks
- **Risk:** Storing photos as base64 in `state.progressPhotos` exceeds the 5MB `localStorage` limit.
  - **Mitigation:** Photo metadata alone (IDs, dates, notes) lives in `state.progressPhotos`. The actual image binary data is strictly isolated to IndexedDB.

---

## 19. Instructions for the Next Milestone
Proceed to **Milestone 05 (`MILESTONE_05_RECOVERY_SLEEP_AND_ACTIVITY.md`)** to implement sleep tracking, localized muscle soreness scoring, and cardio activity logging.

