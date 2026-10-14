import React, { useState } from 'react';

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDate = (value: string, amount: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return formatDate(date);
};

// Simple in‑memory types for the preview
interface FoodEntry {
  id: string;
  meal: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
  name: string;
  serving: string; // e.g. "1 cup"
  calories: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
}

type Goal = 'bulk' | 'cut' | 'maintain';

type Sex = 'male' | 'female';

export const NutritionView: React.FC = () => {
  // --- onboarding state ---
  const [goal, setGoal] = useState<Goal>('maintain');
  const [age, setAge] = useState<number>(30);
  const [sex, setSex] = useState<Sex>('male');
  const [heightCm, setHeightCm] = useState<number>(170);
  const [weightKg, setWeightKg] = useState<number>(70);
  const [activity, setActivity] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very' >('moderate');
  const [calcDone, setCalcDone] = useState(false);

  // results
  const [bmi, setBmi] = useState<number | null>(null);
  const [tdee, setTdee] = useState<number | null>(null);
  const [macroTargets, setMacroTargets] = useState<{protein: number; carbs: number; fat: number} | null>(null);

  // --- food diary ---
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [entries, setEntries] = useState<FoodEntry[]>([]);

  // Helper: activity multiplier
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very: 1.9,
  };

  const calculate = () => {
    // BMI
    const bmiVal = weightKg / ((heightCm / 100) ** 2);
    setBmi(Number(bmiVal.toFixed(1)));
    // BMR (Mifflin–St Jeor)
    const bmr = sex === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    // TDEE
    const tdeeVal = Math.round(bmr * activityMultipliers[activity]);
    // Goal adjustment
    const surplus = goal === 'bulk' ? 300 : goal === 'cut' ? -300 : 0;
    const targetCal = Math.max(1200, tdeeVal + surplus); // safety floor
    setTdee(targetCal);
    // Macro split (Protein 25%, Fat 25%, Carbs 50%) – simple example
    const protein = Math.round((0.25 * targetCal) / 4);
    const fat = Math.round((0.25 * targetCal) / 9);
    const carbs = Math.round((0.5 * targetCal) / 4);
    setMacroTargets({ protein, carbs, fat });
    setCalcDone(true);
  };

  const addDemoFood = () => {
    const newEntry: FoodEntry = {
      id: `food-${Date.now()}`,
      meal: 'Breakfast',
      name: 'Oats with Milk',
      serving: '1 bowl',
      calories: 350,
      protein: 15,
      carbs: 55,
      fat: 7,
    };
    setEntries((prev) => [...prev, newEntry]);
  };

  const dailyTotals = entries.reduce(
    (acc, cur) => {
      acc.calories += cur.calories;
      acc.protein += cur.protein;
      acc.carbs += cur.carbs;
      acc.fat += cur.fat;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const prevDay = () => setSelectedDate((d) => shiftDate(d, -1));
  const nextDay = () => setSelectedDate((d) => shiftDate(d, 1));

  return (
    <div className="space-y-8 pb-20">
      {/* ---- Onboarding ---- */}
      <section className="border p-4 rounded-xl bg-white dark:bg-espresso-850 shadow-subtle">
        <h2 className="font-serif text-2xl mb-4 text-espresso-950 dark:text-ivory-50">Nutrition Onboarding</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-espresso-700 dark:text-espresso-300 mb-1">Goal</label>
            <div className="flex gap-2">
              {['bulk', 'cut', 'maintain'].map((g) => (
                <label key={g} className="inline-flex items-center">
                  <input
                    type="radio"
                    name="goal"
                    value={g}
                    checked={goal === g}
                    onChange={() => setGoal(g as Goal)}
                    className="form-radio h-4 w-4 text-terracotta-600"
                  />
                  <span className="ml-2 capitalize text-espresso-800 dark:text-ivory-100">{g}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso-700 dark:text-espresso-300 mb-1">Age (years)</label>
            <input
              type="number"
              min={1}
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="w-full rounded border-gray-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso-700 dark:text-espresso-300 mb-1">Sex</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
              className="w-full rounded border-gray-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 p-2"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso-700 dark:text-espresso-300 mb-1">Height (cm)</label>
            <input
              type="number"
              min={30}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              className="w-full rounded border-gray-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso-700 dark:text-espresso-300 mb-1">Weight (kg)</label>
            <input
              type="number"
              min={10}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className="w-full rounded border-gray-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-espresso-700 dark:text-espresso-300 mb-1">Activity level</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value as any)}
              className="w-full rounded border-gray-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-950 p-2"
            >
              <option value="sedentary">Sedentary (little or no exercise)</option>
              <option value="light">Light (1–3 days/week)</option>
              <option value="moderate">Moderate (3–5 days/week)</option>
              <option value="active">Active (6–7 days/week)</option>
              <option value="very">Very active (hard training daily)</option>
            </select>
          </div>
        </div>
        <button
          onClick={calculate}
          className="mt-4 px-4 py-2 bg-terracotta-600 hover:bg-terracotta-700 text-white rounded"
        >
          Calculate
        </button>
        {calcDone && (
          <div className="mt-4 p-4 border-t border-ivory-300 dark:border-espresso-800">
            <p className="text-sm text-espresso-800 dark:text-ivory-100">
              <strong>BMI:</strong> {bmi} ({bmi && bmi < 18.5 ? 'Underweight' : bmi && bmi < 25 ? 'Normal' : bmi && bmi < 30 ? 'Overweight' : 'Obese'})
            </p>
            <p className="text-sm text-espresso-800 dark:text-ivory-100">
              <strong>Estimated daily calories:</strong> {tdee} kcal (estimates only)
            </p>
            {macroTargets && (
              <p className="text-sm text-espresso-800 dark:text-ivory-100">
                <strong>Macro targets (g):</strong> {macroTargets.protein} P / {macroTargets.carbs} C / {macroTargets.fat} F
              </p>
            )}
          </div>
        )}
      </section>

      {/* ---- Daily Nutrition Dashboard ---- */}
      <section className="border p-4 rounded-xl bg-white dark:bg-espresso-850 shadow-subtle">
        <h2 className="font-serif text-2xl mb-4 text-espresso-950 dark:text-ivory-50">Daily Nutrition</h2>
        <div className="flex items-center gap-4 mb-4">
          <button onClick={prevDay} className="px-2 py-1 bg-ivory-200 dark:bg-espresso-700 rounded">←</button>
          <span className="font-medium text-espresso-800 dark:text-ivory-100">{selectedDate}</span>
          <button onClick={nextDay} className="px-2 py-1 bg-ivory-200 dark:bg-espresso-700 rounded">→</button>
        </div>
        {calcDone ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-ivory-50 dark:bg-espresso-950 rounded">
              <p className="text-sm text-espresso-700 dark:text-espresso-300">Target Calories</p>
              <p className="text-xl font-serif text-espresso-950 dark:text-ivory-50">{tdee} kcal</p>
            </div>
            <div className="p-3 bg-ivory-50 dark:bg-espresso-950 rounded">
              <p className="text-sm text-espresso-700 dark:text-espresso-300">Consumed</p>
              <p className="text-xl font-serif text-espresso-950 dark:text-ivory-50">{dailyTotals.calories} kcal</p>
            </div>
            <div className="p-3 bg-ivory-50 dark:bg-espresso-950 rounded">
              <p className="text-sm text-espresso-700 dark:text-espresso-300">Remaining</p>
              <p className="text-xl font-serif text-espresso-950 dark:text-ivory-50">{(tdee ?? 0) - dailyTotals.calories} kcal</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-espresso-600 dark:text-espresso-300 italic">Calculate your targets above to see daily numbers.</p>
        )}
        {/* Macro donut – simple SVG placeholder */}
        {macroTargets && (
          <div className="flex items-center justify-center mt-4">
            <svg viewBox="0 0 32 32" className="w-32 h-32">
              <circle r="16" cx="16" cy="16" fill="#e2e8f0" />
              {/* Protein slice */}
              <path
                d="M16 16 L16 0 A16 16 0 0 1 31.2 12.8 z"
                fill="#4ade80" // green
              />
              {/* Carbs slice */}
              <path
                d="M16 16 L31.2 12.8 A16 16 0 0 1 22.6 30.9 z"
                fill="#60a5fa" // blue
              />
              {/* Fat slice */}
              <path
                d="M16 16 L22.6 30.9 A16 16 0 0 1 0 16 z"
                fill="#f87171" // red
              />
            </svg>
            <div className="ml-4 text-sm">
              <p><span className="font-medium">Protein:</span> {macroTargets.protein} g</p>
              <p><span className="font-medium">Carbs:</span> {macroTargets.carbs} g</p>
              <p><span className="font-medium">Fat:</span> {macroTargets.fat} g</p>
            </div>
          </div>
        )}
      </section>

      {/* ---- Food Diary ---- */}
      <section className="border p-4 rounded-xl bg-white dark:bg-espresso-850 shadow-subtle">
        <h2 className="font-serif text-2xl mb-4 text-espresso-950 dark:text-ivory-50">Food Diary</h2>
        <button
          onClick={addDemoFood}
          className="mb-4 px-3 py-1 bg-terracotta-600 hover:bg-terracotta-700 text-white rounded"
        >
          + Add Demo Food
        </button>
        {entries.length === 0 ? (
          <p className="text-sm text-espresso-600 dark:text-espresso-300 italic">No food logged for this day.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="p-2 border rounded bg-ivory-50 dark:bg-espresso-950">
                <div className="flex justify-between">
                  <span className="font-medium text-espresso-950 dark:text-ivory-100">{e.meal}: {e.name}</span>
                  <span className="text-sm text-espresso-700 dark:text-espresso-300">{e.calories} kcal</span>
                </div>
                <div className="text-xs text-espresso-600 dark:text-espresso-400 mt-1">
                  {e.protein} P / {e.carbs} C / {e.fat} F
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
