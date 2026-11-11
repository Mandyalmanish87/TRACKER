import React, { useState, useMemo } from 'react';
import {
  Salad,
  Search,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Scale,
  Save,
  X,
} from 'lucide-react';
import { adminService } from '../../../services/adminService';
import { AdminFoodRecalibrationRecord } from '../../../types/admin';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';
import { Button } from '../../common/Button';

export const AdminNutritionManagerView: React.FC = () => {
  const [foods, setFoods] = useState<AdminFoodRecalibrationRecord[]>(() =>
    adminService.getFoodCatalogForRecalibration()
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Edit / Recalibrate Modal State
  const [editingFood, setEditingFood] = useState<AdminFoodRecalibrationRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editServingSize, setEditServingSize] = useState<number>(100);
  const [editServingUnit, setEditServingUnit] = useState('g');
  const [editCalories, setEditCalories] = useState<number>(0);
  const [editProtein, setEditProtein] = useState<number>(0);
  const [editCarbs, setEditCarbs] = useState<number>(0);
  const [editFat, setEditFat] = useState<number>(0);

  // Add New Food Modal State
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    foods.forEach((f) => {
      if (f.category) set.add(f.category);
    });
    return Array.from(set).sort();
  }, [foods]);

  const filteredFoods = useMemo(() => {
    return foods.filter((f) => {
      const matchSearch =
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === 'all' || f.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [foods, searchQuery, categoryFilter]);

  const handleOpenEdit = (food: AdminFoodRecalibrationRecord) => {
    setEditingFood(food);
    setEditName(food.name);
    setEditCategory(food.category);
    setEditServingSize(food.servingSize || 100);
    setEditServingUnit(food.servingUnit || 'g');
    setEditCalories(food.calories || 0);
    setEditProtein(food.protein || 0);
    setEditCarbs(food.carbs || 0);
    setEditFat(food.fat || 0);
  };

  const handleOpenAddNew = () => {
    setIsAddingNew(true);
    setEditName('');
    setEditCategory('Proteins & Meats');
    setEditServingSize(100);
    setEditServingUnit('g');
    setEditCalories(150);
    setEditProtein(20);
    setEditCarbs(5);
    setEditFat(3);
  };

  const handleSaveRecalibration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    const id = editingFood ? editingFood.id : `food_custom_${Date.now()}`;
    const record: AdminFoodRecalibrationRecord = {
      id,
      name: editName.trim(),
      category: editCategory.trim() || 'General Foods',
      servingSize: Math.max(1, editServingSize),
      servingUnit: editServingUnit.trim() || 'g',
      calories: Math.max(0, editCalories),
      protein: Math.max(0, editProtein),
      carbs: Math.max(0, editCarbs),
      fat: Math.max(0, editFat),
      isCustomOrModified: true,
    };

    adminService.saveRecalibratedFood(record);
    setFoods(adminService.getFoodCatalogForRecalibration());
    setFeedback(`Nutritional values for "${record.name}" successfully recalibrated & saved!`);
    setEditingFood(null);
    setIsAddingNew(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDeleteFood = (food: AdminFoodRecalibrationRecord) => {
    adminService.deleteFoodFromCatalog(food.id);
    setFoods(adminService.getFoodCatalogForRecalibration());
    setFeedback(`Removed "${food.name}" from catalog.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleResetBaseline = () => {
    adminService.resetFoodCatalog();
    setFoods(adminService.getFoodCatalogForRecalibration());
    setFeedback('Restored all nutritional records back to verified baseline catalog.');
    setTimeout(() => setFeedback(null), 3000);
  };

  // Auto-calculated calorie check from macros
  const calculatedKcal = Math.round(editProtein * 4 + editCarbs * 4 + editFat * 9);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Food Database &amp; Nutritional Recalibrator"
        description="Master control over verified nutritional values. Add new food items, adjust calorie and macronutrient allocations, and recalibrate metabolic records across the entire application."
        badge={{ label: `${foods.length} Foods in Catalog`, variant: 'emerald' }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetBaseline}
            className="gap-1.5 !bg-white/5 !text-ivory-300 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Baseline
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddNew}
            className="gap-1.5 !bg-blue-600 hover:!bg-blue-500 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Food Item
          </Button>
        </div>
      </AdminPageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Master Food Catalog"
          value={foods.length}
          subtitle="Verified offline items"
          icon={<Salad className="w-4 h-4" />}
          accentColor="#10B981"
        />
        <AdminStatCard
          title="Recalibrated Items"
          value={foods.filter((f) => f.isCustomOrModified).length}
          subtitle="Admin calibrated macros"
          icon={<Edit3 className="w-4 h-4" />}
          accentColor="#2563EB"
        />
        <AdminStatCard
          title="Food Categories"
          value={categories.length}
          subtitle="Grains, Dairy, Legumes..."
          icon={<Scale className="w-4 h-4" />}
          accentColor="#8B5CF6"
        />
        <AdminStatCard
          title="Database Calibration Status"
          value="Synchronized"
          subtitle="100% Macro Precision"
          icon={<Sparkles className="w-4 h-4" />}
          accentColor="#F59E0B"
        />
      </div>

      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center justify-between shadow-sm animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {feedback}
          </span>
          <button onClick={() => setFeedback(null)} className="font-bold underline ml-2 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ivory-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by food name, ingredient..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-ivory-400/60 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ivory-400">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all" className="bg-[#070B14]">All Categories ({foods.length})</option>
            {categories.map((c) => (
              <option key={c} value={c} className="bg-[#070B14]">{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Food Items Table ── */}
      <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Food Item</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Serving Portion</th>
                <th className="py-3.5 px-4">Calories (kcal)</th>
                <th className="py-3.5 px-4">Macros (P / C / F)</th>
                <th className="py-3.5 px-4">Calibration Status</th>
                <th className="py-3.5 px-4 text-right">Recalibrate Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
              {filteredFoods.slice(0, 50).map((f) => (
                <tr key={f.id} className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-espresso-950 dark:text-white">
                    {f.name}
                  </td>
                  <td className="py-3.5 px-4 text-espresso-600 dark:text-ivory-300">
                    {f.category}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                    {f.servingSize} {f.servingUnit}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-amber-500">
                    {f.calories} kcal
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs">
                    <span className="text-emerald-400 font-semibold">{f.protein}p</span> /{' '}
                    <span className="text-blue-400 font-semibold">{f.carbs}c</span> /{' '}
                    <span className="text-purple-400 font-semibold">{f.fat}f</span>
                  </td>
                  <td className="py-3.5 px-4">
                    {f.isCustomOrModified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Admin Recalibrated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                        Verified Baseline
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEdit(f)}
                        className="gap-1 text-xs py-1 px-2.5 !bg-white/5 !text-white"
                        title="Recalibrate Nutritional Values"
                      >
                        <Edit3 className="w-3 h-3 text-blue-400" />
                        Recalibrate
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFood(f)}
                        className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                        title="Delete Food Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {(editingFood || isAddingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl bg-[#0A0F1D] border border-white/10 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-400" />
                {editingFood ? `Recalibrate: ${editingFood.name}` : 'Add New Food to Catalog'}
              </h3>
              <button
                onClick={() => {
                  setEditingFood(null);
                  setIsAddingNew(false);
                }}
                className="p-1 rounded-lg text-ivory-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecalibration} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-ivory-400 mb-1">Food Item Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Greek Yogurt High Protein"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ivory-400 mb-1">Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="e.g. Dairy & Eggs"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-ivory-400 mb-1">Portion Size</label>
                    <input
                      type="number"
                      min="1"
                      value={editServingSize}
                      onChange={(e) => setEditServingSize(parseFloat(e.target.value) || 100)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-ivory-400 mb-1">Unit</label>
                    <input
                      type="text"
                      value={editServingUnit}
                      onChange={(e) => setEditServingUnit(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Nutritional Values Grid */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-white font-bold">Nutritional Calibration</span>
                  <span className="text-[10px] text-amber-400 font-bold">
                    Macro Energy: ~{calculatedKcal} kcal
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-amber-400 mb-1 font-bold">Calories (kcal)</label>
                    <input
                      type="number"
                      min="0"
                      value={editCalories}
                      onChange={(e) => setEditCalories(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-emerald-400 mb-1 font-bold">Protein (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editProtein}
                      onChange={(e) => setEditProtein(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-blue-400 mb-1 font-bold">Carbs (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editCarbs}
                      onChange={(e) => setEditCarbs(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-purple-400 mb-1 font-bold">Fat (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={editFat}
                      onChange={(e) => setEditFat(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingFood(null);
                    setIsAddingNew(false);
                  }}
                  className="!bg-white/5 !text-ivory-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="gap-1.5 !bg-blue-600 hover:!bg-blue-500 text-white font-bold"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Nutritional Recalibration
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

