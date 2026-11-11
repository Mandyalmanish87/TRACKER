/**
 * Student Tracker — Offline Local Barcode Detection & Lookup Engine
 * Document ID: FITNESS-M03-ADVANCED-NUTRITION
 *
 * Zero External Network Dependencies:
 * - Built-in offline database from barcodeDatabase.json
 * - Custom user barcode mappings from state.customBarcodes
 * - Native BarcodeDetector API detection with fallback
 */

import builtInBarcodes from '../data/barcodeDatabase.json';
import { LocalBarcodeMapping, FoodItem } from '../types';

export interface BarcodeMatchResult {
  found: boolean;
  barcode: string;
  foodId?: string;
  foodName?: string;
  brand?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  servingSize?: number;
  servingUnit?: string;
  isCustomMapping?: boolean;
}

/**
 * Searches for a food item by scanned barcode string.
 * Checks user custom mappings first, then falls back to offline built-in database.
 */
export function lookupBarcode(
  scannedCode: string,
  customBarcodes: LocalBarcodeMapping[] = [],
  catalogFoods: FoodItem[] = []
): BarcodeMatchResult {
  if (!scannedCode || typeof scannedCode !== 'string') {
    return { found: false, barcode: '' };
  }

  const cleanCode = scannedCode.trim().replace(/[^0-9]/g, '');

  // 1. Check custom user mappings first
  const customMatch = (customBarcodes || []).find((b) => b.barcode === cleanCode);
  if (customMatch) {
    const linkedFood = catalogFoods.find((f) => f.id === customMatch.foodId);
    return {
      found: true,
      barcode: cleanCode,
      foodId: customMatch.foodId,
      foodName: linkedFood?.name || 'Custom Mapped Item',
      brand: customMatch.brand,
      calories: linkedFood?.calories,
      protein: linkedFood?.protein,
      carbs: linkedFood?.carbs,
      fat: linkedFood?.fat,
      servingSize: linkedFood?.servingSize,
      servingUnit: linkedFood?.servingUnit,
      isCustomMapping: true,
    };
  }

  // 2. Check offline built-in database
  const builtIn = (builtInBarcodes as any[]).find((b) => b.barcode === cleanCode);
  if (builtIn) {
    return {
      found: true,
      barcode: cleanCode,
      foodId: builtIn.foodId,
      foodName: builtIn.foodName,
      brand: builtIn.brand,
      calories: builtIn.calories,
      protein: builtIn.protein,
      carbs: builtIn.carbs,
      fat: builtIn.fat,
      servingSize: builtIn.servingSize,
      servingUnit: builtIn.servingUnit,
      isCustomMapping: false,
    };
  }

  return { found: false, barcode: cleanCode };
}

