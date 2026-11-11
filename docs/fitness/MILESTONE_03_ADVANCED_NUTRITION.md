# Milestone 03: Advanced Micronutrients, Local Barcode & Meal Planning

**Document ID:** `FITNESS-M03-ADVANCED-NUTRITION`  
**Parent Specification:** [`FITNESS_MASTER_SPEC.md`](file:///c:/Users/mandy/Downloads/TRACKER/docs/fitness/FITNESS_MASTER_SPEC.md)  
**Target Directory:** `docs/fitness/`  

---

## 1. Milestone Name
**Milestone 03 — Advanced Micronutrient Profiling, Local Barcode Engine & Weekly Meal Planner**

---

## 2. Objective
Elevate the existing Milestone 7 nutrition suite into a clinical-grade dietary tracking system without external APIs. Support 20+ vitamins and minerals (represented as unknown when missing rather than silently zeroed); expand the offline Indian and global food catalogue with raw vs. cooked metrics; add an application-owned local barcode scanner and database; build a multi-day Meal Planning Calendar with recipe integration and prep reminders; and implement smart, user-approved calorie and macro target recalibrations.

---

## 3. Why This Milestone Exists
Student athletes and fitness enthusiasts frequently suffer from nutritional blindspots (such as iron, zinc, or magnesium deficiencies common in student mess diets) that calories and macros alone cannot reveal. Furthermore, meal prep in college requires planning meals in advance to align with busy class schedules. Milestone 03 provides the micronutrient depth, meal preparation foresight, and local barcode scanning needed for optimal nutrition.

---

## 4. Repository Areas to Inspect
1. **Existing Nutrition View:** [`src/components/views/NutritionView.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/views/NutritionView.tsx).
2. **Existing Food Components:**
   - [`src/components/nutrition/FoodDiary.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/nutrition/FoodDiary.tsx)
   - [`src/components/nutrition/FoodSearchModal.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/nutrition/FoodSearchModal.tsx)
   - [`src/components/nutrition/CustomFoodModal.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/nutrition/CustomFoodModal.tsx)
   - [`src/components/nutrition/MacroDonutChart.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/nutrition/MacroDonutChart.tsx)
   - [`src/components/nutrition/NutritionAnalytics.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/nutrition/NutritionAnalytics.tsx)
3. **Existing Calculators:** [`src/utils/nutritionCalculators.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/utils/nutritionCalculators.ts).
4. **Food Catalogue:** [`src/data/foodCatalogue.ts`](file:///c:/Users/mandy/Downloads/TRACKER/src/data/foodCatalogue.ts) (783 existing food entries).
5. **Dashboard Widget:** [`src/components/dashboard/FitnessSummaryWidget.tsx`](file:///c:/Users/mandy/Downloads/TRACKER/src/components/dashboard/FitnessSummaryWidget.tsx).

---

## 5. Existing Functionality to Preserve
1. **Existing Food Logs:** All user entries in `state.foodDiaryEntries` must remain intact with identical date formatting (`YYYY-MM-DD`).
2. **Existing Custom Foods & Recipes:** `state.customFoods` and `state.recipes` must remain fully backward-compatible.
3. **Mifflin–St Jeor & TDEE Engine:** Existing formulas in `nutritionCalculators.ts` must remain the mathematical baseline.
4. **52-Week Heatmap & 7-Day Analytics:** `NutritionAnalytics.tsx` must continue rendering historical adherence seamlessly.
5. **Macro Consistency Check:** The `deriveMacroTargets` invariant $(P \times 4 + C \times 4 + F \times 9 = \text{Target Calories} \pm 5 \text{ kcal})$ must strictly hold.

---

## 6. Features Included in Milestone 03

### 6.1 Comprehensive Micronutrient Tracking
- **20+ Specific Micronutrients:**
  - *Minerals:* Sodium (mg), Potassium (mg), Calcium (mg), Iron (mg), Magnesium (mg), Zinc (mg), Phosphorus (mg).
  - *Vitamins:* Vitamin A (IU), Vitamin B1 (Thiamine, mg), Vitamin B2 (Riboflavin, mg), Vitamin B3 (Niacin, mg), Vitamin B6 (mg), Vitamin B9 (Folate, mcg), Vitamin B12 (mcg), Vitamin C (mg), Vitamin D (IU), Vitamin E (mg), Vitamin K (mcg).
  - *Fats & Lipids:* Saturated fat (g), Monounsaturated fat (g), Polyunsaturated fat (g), Trans fat (g), Cholesterol (mg).
  - *Carbohydrate breakdown:* Dietary Fiber (g), Total Sugars (g).
- **The "Missing is Unknown, Not Zero" Rule:** If a food item lacks data for a micronutrient (e.g., Vitamin B12 is undefined on a generic local apple), the UI displays `—` (unknown) with an informational tooltip. It is **never** counted as 0mg in deficiency calculations.
- **Recommended Dietary Allowance (RDA) Reference Targets:** Informational daily reference ranges based on standard guidelines.
- **Informational Nutrient Status Badges:** Display "On Target", "Below Reference", or "Above Reference" badges. Disclaimers explicitly state: *"Informational dietary reference only; does not constitute a clinical diagnosis."*

### 6.2 Deep Indian Food Catalogue & Raw/Cooked Distinctions
- **Catalogue Expansion:** Deepen `src/data/foodCatalogue.ts` with authentic student-friendly staples:
  - Roti, Phulka, Plain Paratha, Aloo/Gobi/Paneer Paratha.
  - Dals: Toor Dal, Moong Dal (Yellow & Green), Chana Dal, Masoor Dal, Dal Makhani.
  - Curries: Rajma Masala, Chole, Paneer Bhurji, Palak Paneer, Egg Curry, Chicken Curry.
  - Breakfast & Snacks: Poha, Upma, Idli, Plain/Masala Dosa, Sambar, Sattu Drink (sweet & salty), Boiled Eggs, Curd/Dahi, Paneer raw.
  - Student Mess & Canteen: Mess Dal (diluted), Mess Thali, College Canteen Samosa, Bread Pakora.
- **Raw vs. Cooked Metrics:**
  - Clear toggle for raw vs. cooked state (e.g., 100g raw rice = ~360 kcal, 100g cooked rice = ~130 kcal; 100g raw chicken breast = 120 kcal, 100g cooked = 165 kcal).
  - Built-in hydration/yield factor converter.

### 6.3 Local Offline Barcode Lookup
- **Zero External API Barcode System:**
  - Uses the browser's native `BarcodeDetector` API (or a bundled local JS barcode parsing library for fallback) to read camera frames directly on-device.
  - Resolves against an offline database: `src/data/barcodeDatabase.json` containing common Indian and global packaged foods (packaged oats, peanut butter, whey protein, bread, milk, curd, eggs).
- **Custom Barcode Assignment:** When a user scans an unmapped barcode, allow them to link it to any catalogue or custom food item. This mapping is saved to `state.customBarcodes` locally for instant future scans.

### 6.4 Weekly Meal Planning Calendar
- **Meal Prep & Plan Architecture:**
  - Plan meals up to 7 days in advance across all meal slots (`breakfast`, `lunch`, `dinner`, `snacks`, `pre_workout`, `post_workout`).
  - Recipe-based meal planning: log a batch recipe (e.g., "Rajma Curry 4 servings") and distribute 1 serving across multiple days.
  - Meal prep reminders: optional reminders in DayOS (e.g., "Prep Oats & Soak Almonds at 21:00").
- **Planned vs. Actual Delta Tracker:**
  - Side-by-side comparison on the day view: Planned Calories/Macros vs. Actual Consumed Calories/Macros with variance indicators ($\pm \text{kcal}$).
  - One-click "Log as Planned" button to copy planned meals directly into the actual food diary.

### 6.5 Smart Nutrition Targets & Adaptive Recalibration
- **Adaptive TDEE Tracking:**
  - Analyzes 14-day rolling average calorie intake against 14-day weight change rate to determine true empirical TDEE:
    $$\text{Empirical TDEE} = \text{Avg Daily Calories} - \left(\frac{\Delta \text{Weight (kg)} \times 7700}{14}\right)$$
- **User-Approved Target Recalibration:**
  - When weight trends plateau on a cut or bulk, surface a prominent suggestion card:
    *"Your 14-day weight trend has plateaued. We recommend adjusting daily targets from 2,200 kcal to 2,050 kcal (-150 kcal). Accept / Decline / Modify."*
  - **Strict Constraint:** The system must never automatically mutate user targets without explicit user confirmation.

---

## 7. Features Explicitly Excluded
- Resistance workout set tracking (covered in M01 & M02).
- Body circumference tracking (reserved for M04).
- Third-party nutrition API queries (OpenFoodFacts API, Nutritionix, etc. are prohibited; all data is local).

---

## 8. Dependencies on Earlier Milestones
- **Requires Milestone 00** for consolidated types and schema migrations.

---

## 9. Data Model Requirements
Use `FoodItem`, `CustomFood`, `Recipe`, `FoodDiaryEntry`, `MicronutrientProfile`, `LocalBarcodeMapping`, and `MealPlanDay` from `src/types/fitness.ts`.  
Ensure `AppContext` exposes:
```typescript
interface AppContextType {
  // ... existing fields ...
  mealPlans: MealPlanDay[];
  customBarcodes: LocalBarcodeMapping[];
  addMealPlanItem: (date: string, item: MealPlanDay['plannedMeals'][0]) => void;
  removeMealPlanItem: (date: string, itemIndex: number) => void;
  copyPlannedToActualDiary: (date: string) => void;
  registerBarcodeMapping: (barcode: string, foodId: string) => void;
  applySmartTargetRecalibration: (newCalories: number, newMacros: MacroTargets) => void;
}
```

---

## 10. UI Requirements
1. **Micronutrient Drawer / Modal:** Accessible from `NutritionView.tsx`, displaying vitamins, minerals, and healthy fats progress bars against RDA reference values.
2. **Raw vs. Cooked Indicator:** Clear toggle pill in `FoodSearchModal.tsx` displaying the weight conversion multiplier.
3. **Local Barcode Scanner Modal:** Camera viewfinder with instant offline barcode detection and manual numeric barcode entry fallback.
4. **Meal Planning Tab:** Toggle alongside `Diary` and `Analytics` tabs in `NutritionView.tsx`, featuring a 7-day calendar strip and planned vs. actual macro summary.
5. **Smart Recalibration Alert Card:** Interactive prompt with "Apply Recommendation" and "Dismiss" buttons.

---

## 11. Business Logic Requirements
- **Nutrient Aggregation Engine:**
  ```typescript
  export function aggregateNutrients(
    entries: FoodDiaryEntry[], 
    catalogue: FoodItem[]
  ): DailyNutrientTotals;
  ```
  Must track `knownCount` vs `missingCount` for each micronutrient to correctly handle undefined values.
- **RDA Guidance Calculations:** Informational reference values:
  - Vitamin C: 90 mg (men), 75 mg (women).
  - Iron: 8 mg (men), 18 mg (women).
  - Calcium: 1,000 mg.
  - Potassium: 3,400 mg.
  - Zinc: 11 mg.

---

## 12. Persistence Requirements
- Store `state.mealPlans` and `state.customBarcodes` in `localStorage` under `tracker_user_data_${userId}`.
- Update `sanitizeEntityArray` in `storage.ts` to sanitize and preserve meal plans and custom barcodes during data cleanups.

---

## 13. Edge Cases
1. **Camera Permission Denied:** Display friendly error with an immediate manual barcode input field (`Enter 12 or 13-digit barcode`).
2. **Missing Micronutrient in Recipe:** When a recipe combines foods where some have Vitamin D and others are unknown, compute the known total and display an asterisk: `*Partial data (2 of 4 ingredients unlisted)`.
3. **Extreme Target Reductions:** Prevent the smart recalibration engine from recommending daily targets below the 1,200 kcal safety floor.
4. **Daylight Savings / Timezones:** All meal plan entries use strict local `YYYY-MM-DD` string keys.

---

## 14. Error Handling
- Safe handling of corrupted barcode inputs (non-numeric characters stripped).
- Graceful fallback for non-existent recipe ingredients (display item name from snapshot rather than crashing).

---

## 15. Testing Requirements
Create `tests/milestone03AdvancedNutrition.test.tsx`:
- Test calculating total micronutrients and verify missing micronutrients are represented as unknown.
- Test scaling nutrients with raw vs. cooked conversion factors.
- Test looking up a packaged food via offline barcode mapping.
- Test linking an unknown barcode to a custom food and verifying subsequent lookup succeeds.
- Test creating a weekly meal plan and verifying planned vs. actual delta calculations.
- Test "Copy Planned to Actual" functionality.
- Test that smart target recalibration requires explicit user approval and honors the 1,200 kcal safety floor.
- Run `tests/nutrition.test.ts` to verify existing Mifflin–St Jeor calculations remain 100% compliant.

---

## 16. Acceptance Criteria
1. 20+ micronutrients are visible with RDA reference lines and unknown-state disclaimers.
2. Offline barcode scanner scans and matches local items without network requests.
3. 7-day Meal Planning tab allows scheduling meals and copying them to the food diary.
4. Indian food catalogue includes mess staples, raw/cooked distinctions, and custom edits.
5. All tests in `tests/milestone03AdvancedNutrition.test.tsx` pass.
6. Zero regressions in DayOS, Nutrition, or academic components.

---

## 17. Completion Checklist
- [ ] Expand `src/data/foodCatalogue.ts` with authentic Indian foods and micronutrient data.
- [ ] Implement `src/data/barcodeDatabase.json` with local offline barcodes.
- [ ] Create `BarcodeScannerModal` with camera and manual entry fallback.
- [ ] Create `MicronutrientAnalytics` drawer with RDA reference charts.
- [ ] Build `MealPlanningView` with 7-day calendar and planned vs. actual comparison.
- [ ] Implement smart adaptive TDEE and recalibration engine in `src/utils/smartNutritionEngine.ts`.
- [ ] Author `tests/milestone03AdvancedNutrition.test.tsx`.
- [ ] Run `npx tsc --noEmit` and confirm 0 errors.

---

## 18. Regression Risks
- **Risk:** Expanding `FoodItem` properties might cause legacy items in `foodDiaryEntries` to lack micronutrient fields.
  - **Mitigation:** All new micronutrient fields in `FoodItem` and `FoodDiaryEntry` are optional (`?`); aggregation logic treats absent fields as unknown.

---

## 19. Instructions for the Next Milestone
Proceed to **Milestone 04 (`MILESTONE_04_BODY_TRACKING_AND_PROGRESS.md`)** to implement body circumference tracking (10 sites), Navy body composition formulas, and the private progress photo comparison vault.

