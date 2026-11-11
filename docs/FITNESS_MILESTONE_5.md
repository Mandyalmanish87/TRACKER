# Fitness Milestone 5: Complete Nutrition System (Cronometer & MacroFactor Style)

## 1. Scope
Significantly expand the Nutrition section into a comprehensive nutritional analytics platform inspired by Cronometer and MacroFactor:
- Professional Nutrition Dashboard Overview: 4 prominent macro cards (Calories, Protein, Carbohydrates, Fat) with numerical consumed/target/remaining stats, non-overflowing progress bars, and historical comparison.
- Daily Food Diary with 6 dedicated meal slots (Breakfast, Morning Snack, Lunch, Evening Snack, Dinner, Custom Meals) with itemized foods, quantities, macros, and meal totals.
- Offline Food Database with Indian and international foods, packaged items, and raw/cooked ingredients with proportional nutrient scaling across all serving units.
- Complete Micronutrient Dashboard (Cronometer-style):
  - Full Vitamins: A, C, D, E, K, B1 (Thiamine), B2 (Riboflavin), B3 (Niacin), B5 (Pantothenic Acid), B6, B7 (Biotin), B9 (Folate), B12.
  - Full Minerals: Calcium, Iron, Magnesium, Zinc, Potassium, Sodium, Phosphorus, Selenium, Copper, Manganese, Iodine.
  - Other Nutrients: Dietary Fiber, Omega-3, Omega-6, Cholesterol, Saturated Fat, Trans Fat, Added Sugar, Caffeine.
- Nutrient Balance Dashboard: Vital nutritional ratios (Omega 6:3, Sodium:Potassium, Calcium:Magnesium, Zinc:Copper) and electrolyte balance indicators.
- Dedicated Hydration Tracker: Daily water log (ml, L, oz), progress ring, quick-add buttons (+250ml, +500ml), and hydration history.
- Calorie and Macro Goal System: Configurable goals (Maintain, Lose, Gain, Build Muscle, Custom) with Mifflin-St Jeor BMR/TDEE calculations or manual overrides.
- Body Weight and Circumference Tracker: Daily weight logging, 7-day moving averages, BMI, body fat percentage, lean body mass, and tape measurements (waist, chest, hips, neck, arms, thighs, calves).
- Weekly Meal Planner and Recipe Builder: Create multi-ingredient recipes with serving-size calculations and assign meals to Monday - Sunday calendar days.

## 2. Existing Files Inspected
- `src/components/views/NutritionView.tsx`: Core nutrition tabs and state.
- `src/components/nutrition/FoodDiary.tsx`: Daily meals logging.
- `src/components/nutrition/MacroDonutChart.tsx`: Macro donut visualization.
- `src/components/nutrition/MealPlanningView.tsx`: Meal prep planner.
- `src/components/nutrition/WeightTracker.tsx`: Weight logging and moving averages.
- `src/data/foodCatalogue.ts`: Offline database of foods.

## 3. Files to Create
- `src/components/nutrition/CronometerMicronutrientDashboard.tsx`: Comprehensive micronutrient dashboard with horizontal gauges, RDA percentage fulfillment, and nutrient category filters.
- `src/components/nutrition/NutrientBalanceDashboard.tsx`: Nutrient ratio cards (Omega 6:3, Na:K, Ca:Mg, Zn:Cu) with source value inspection.
- `src/components/nutrition/HydrationTrackerCard.tsx`: Dedicated hydration widget with quick-add increments, container presets, and history.
- `src/components/nutrition/RecipeBuilderModal.tsx`: Modal for building custom multi-ingredient recipes with auto-scaled per-serving nutrition.
- `src/utils/micronutrientReferenceData.ts`: Dietary reference intakes (DRI/RDA) for all vitamins, minerals, and fatty acids with configurable targets.
- `docs/FITNESS_MILESTONE_5.md`: This milestone specification.

## 4. Files to Modify
- `src/components/views/NutritionView.tsx`: Integrate the Cronometer-style micronutrient dashboard, nutrient balance cards, hydration tracker, and recipe builder.
- `src/types/fitness.ts`: Expand `MicronutrientProfile` to include full trace minerals (Selenium, Copper, Manganese, Iodine, Biotin, Pantothenic acid) and fatty acid ratios.

## 5. Implementation Details
### Nutrient Scaling Algorithm
- Every food item stores base nutrients per `servingSize` in `servingUnit`.
- When logging `quantity` in any supported unit (g, ml, piece, cup, tbsp, serving):
  - `scaleFactor = (quantity * unitConversion) / baseServingSize`
  - All 30+ macro- and micronutrients are multiplied by `scaleFactor`.
  - Missing nutrients remain `undefined` (treated as unknown, never fabricated or assumed 0).

### Nutrient Ratio Derivation
- *Sodium to Potassium Ratio*: Ideal range ~1:1 to 1:2. High sodium with low potassium triggers balanced intake advice.
- *Omega-6 to Omega-3 Ratio*: Evaluated when dietary fat breakdown is available (ideal range ~2:1 to 4:1).
- *Calcium to Magnesium Ratio*: Target range ~2:1.

## 6. Dependencies
- Native React and Lucide icons.

## 7. Acceptance Criteria
- [x] Four macro cards at the top show consumed, target, remaining, and percentage without visual overflow.
- [x] Daily food diary supports Breakfast, Morning Snack, Lunch, Evening Snack, Dinner, and Custom Meals.
- [x] Micronutrient dashboard tracks all specified vitamins, minerals, and other nutrients with RDA targets.
- [x] Nutrient balance cards show Omega 6:3, Na:K, Ca:Mg, and Zn:Cu ratios with source values.
- [x] Hydration tracker allows logging in ml, L, and oz with daily targets.
- [x] Weight and body composition tracking calculates BMI, body fat %, and tape circumferences.
- [x] Recipe builder scales nutrition per serving accurately.

## 8. Tests
- Tests in `tests/advancedNutritionMicrosAndBalance.test.tsx` and `tests/nutrition.test.ts` verifying nutrient scaling, ratio calculations, and diary persistence.

## 9. Completion Checklist
- [x] Cronometer-style micronutrient dashboard implemented.
- [x] Nutrient balance dashboard created.
- [x] Hydration tracker card created.
- [x] Recipe builder modal implemented.
- [x] NutritionView updated with all new sections.

