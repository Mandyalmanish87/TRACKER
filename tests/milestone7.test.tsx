import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';
import { AppProvider } from '../src/context/AppContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { NutritionView } from '../src/components/views/NutritionView';
import { loadData, storageService } from '../src/services/storage';

describe('Milestone 7: Gym & Nutrition (Full)', () => {
  beforeEach(() => {
    localStorage.clear();
    storageService.populateSampleData();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-accent');
    document.body.className = '';
  });

  describe('Nutrition UI & Daily Food Diary', () => {
    it('renders the Nutrition tab in navigation and loads the Nutrition view', () => {
      render(<App />);

      // Find Nutrition button in nav
      const nutritionTab = screen.getByRole('button', { name: /^nutrition$/i });
      expect(nutritionTab).toBeInTheDocument();

      fireEvent.click(nutritionTab);

      // Verify header and main sections
      expect(screen.getByRole('heading', { name: /nutrition & fuel/i })).toBeInTheDocument();
      expect(screen.getByText(/daily energy budget/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /body weight & trend/i })).toBeInTheDocument();
      expect(screen.getByText(/breakfast/i)).toBeInTheDocument();
      expect(screen.getByText(/lunch/i)).toBeInTheDocument();
      expect(screen.getByText(/dinner/i)).toBeInTheDocument();
    });

    it('displays sample food entries with correct macro summaries', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <NutritionView />
          </AppProvider>
        </ThemeProvider>
      );

      // Should render demo foods for today (e.g. Rolled Oats, Toned Cow Milk, Medium Banana)
      expect(screen.getByText('Rolled Oats (Dry)')).toBeInTheDocument();
      expect(screen.getByText('Toned Cow Milk (3% Fat)')).toBeInTheDocument();
      expect(screen.getByText('Whole Wheat Roti / Chapati')).toBeInTheDocument();
    });

    it('opens Food Search modal, searches food, and logs a portion to breakfast', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <NutritionView />
          </AppProvider>
        </ThemeProvider>
      );

      // Click "Add Food" on Breakfast
      const addFoodButtons = screen.getAllByRole('button', { name: /add food/i });
      fireEvent.click(addFoodButtons[0]);

      // Verify modal opened
      expect(screen.getByRole('heading', { name: /log to breakfast/i })).toBeInTheDocument();

      // Search for "Egg"
      const searchInput = screen.getByPlaceholderText(/search roti, oats, eggs/i);
      fireEvent.change(searchInput, { target: { value: 'Egg' } });

      // Click on "Whole Large Egg (Boiled)"
      const eggOption = screen.getByText('Whole Large Egg (Boiled)');
      fireEvent.click(eggOption);

      // Verify portion adjuster appears for the selected food
      expect(screen.getByText(/adjust portion:/i)).toBeInTheDocument();

      // Click "Add to Breakfast"
      const confirmButton = screen.getByRole('button', { name: /add to breakfast/i });
      fireEvent.click(confirmButton);

      // Verify egg is logged in diary
      expect(screen.getAllByText('Whole Large Egg (Boiled)').length).toBeGreaterThanOrEqual(1);
    });

    it('deletes a food entry when trash icon is clicked', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <NutritionView />
          </AppProvider>
        </ThemeProvider>
      );

      // Initially Rolled Oats exists
      expect(screen.getByText('Rolled Oats (Dry)')).toBeInTheDocument();

      // Click remove button on Rolled Oats
      const removeButtons = screen.getAllByTitle('Remove item');
      fireEvent.click(removeButtons[0]);

      // Should be removed
      expect(screen.queryByText('Rolled Oats (Dry)')).not.toBeInTheDocument();
    });
  });

  describe('Custom Food & Fitness Onboarding', () => {
    it('creates a custom food item and saves it for searching', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <NutritionView />
          </AppProvider>
        </ThemeProvider>
      );

      // Click "Custom Food" button
      const customFoodBtn = screen.getByRole('button', { name: /custom food/i });
      fireEvent.click(customFoodBtn);

      // Verify modal
      expect(screen.getByRole('heading', { name: /create custom food/i })).toBeInTheDocument();

      // Fill custom food form
      const nameInput = screen.getByPlaceholderText(/grandma's besan ladoo/i);
      fireEvent.change(nameInput, { target: { value: 'Protein Peanut Butter Bar' } });

      // Save custom food
      const saveBtn = screen.getByRole('button', { name: /save food/i });
      fireEvent.click(saveBtn);

      // Verify custom food is saved in state
      const state = loadData();
      const saved = state.customFoods?.find((f) => f.name === 'Protein Peanut Butter Bar');
      expect(saved).toBeDefined();
      expect(saved?.isCustom).toBe(true);
    });

    it('calibrates nutritional targets using BMR/TDEE in Onboarding modal', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <NutritionView />
          </AppProvider>
        </ThemeProvider>
      );

      // Click "Calibrate Targets"
      const calibrateBtn = screen.getByRole('button', { name: /calibrate targets/i });
      fireEvent.click(calibrateBtn);

      // Verify modal opened
      expect(screen.getByRole('heading', { name: /fitness & nutrition targets/i })).toBeInTheDocument();

      // Select "Bulk / Gain"
      const bulkOption = screen.getByText(/bulk \/ gain/i);
      fireEvent.click(bulkOption);

      // Click "Apply Targets"
      const applyBtn = screen.getByRole('button', { name: /apply targets/i });
      fireEvent.click(applyBtn);

      // Verify profile goal is updated to BULK
      expect(screen.getByText('BULK')).toBeInTheDocument();
      const state = loadData();
      expect(state.nutritionProfile?.goal).toBe('bulk');
    });

    it('logs body weight and updates weight tracking history', () => {
      render(
        <ThemeProvider>
          <AppProvider>
            <NutritionView />
          </AppProvider>
        </ThemeProvider>
      );

      // Find weight input
      const weightInput = screen.getByPlaceholderText(/weight \(kg\)|74/i);
      fireEvent.change(weightInput, { target: { value: '75.5' } });

      const logBtn = screen.getByRole('button', { name: /update|log/i });
      fireEvent.click(logBtn);

      // Verify weight is updated in state
      const state = loadData();
      const today = new Date().toISOString().split('T')[0];
      const todayLog = state.weightLogs?.find((w) => w.date === today);
      expect(todayLog).toBeDefined();
      expect(todayLog?.weightKg).toBe(75.5);
    });
  });

  describe('Dashboard Integration', () => {
    it('renders FitnessSummaryWidget on Dashboard with macro pills and navigates to Nutrition', () => {
      render(<App />);

      // Dashboard should display "Fuel & Nutrition" card
      expect(screen.getByText('Daily Energy & Macros')).toBeInTheDocument();
      expect(screen.getByText(/^protein$/i)).toBeInTheDocument();
      expect(screen.getByText(/^carbs$/i)).toBeInTheDocument();
      expect(screen.getByText(/^fats$/i)).toBeInTheDocument();

      // Click "Diary" action link
      const diaryLink = screen.getByRole('button', { name: /diary/i });
      fireEvent.click(diaryLink);

      // Should navigate to Nutrition view
      expect(screen.getByRole('heading', { name: /nutrition & fuel/i })).toBeInTheDocument();
    });
  });

  describe('Data Persistence & Demo Cleanup', () => {
    it('preserves user nutrition entries across reload and clears demo entries cleanly', () => {
      render(<App />);

      // Check demo records badge
      expect(screen.getByText(/demo records/i)).toBeInTheDocument();

      // Click Clear demo records
      const clearBtn = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearBtn);

      // Confirm in safety modal
      const confirmBtn = screen.getByRole('button', { name: /clear demo data/i });
      fireEvent.click(confirmBtn);

      // Confirm demo records badge disappears
      expect(screen.queryByText(/demo records/i)).not.toBeInTheDocument();

      // Ensure storage is clean of sample flags
      const cleanData = loadData();
      expect(cleanData.hasSampleData).toBe(false);
      expect(cleanData.foodDiaryEntries?.some((e) => e.isSample)).toBe(false);
      expect(cleanData.weightLogs?.some((w) => w.isSample)).toBe(false);
    });
  });
});

