/**
 * Standard Dietary Reference Intakes (DRI / RDA) for adult individuals.
 * Used for Cronometer-style micronutrient tracking and percentage fulfillment gauges.
 */

export interface NutrientReferenceTarget {
  key: string;
  name: string;
  category: 'vitamins' | 'minerals' | 'lipids_other';
  standardTarget: number;
  unit: string;
  isUpperLimit?: boolean; // e.g. Sodium, Trans fat, Cholesterol
  description: string;
}

export const MICRONUTRIENT_REFERENCE_TARGETS: NutrientReferenceTarget[] = [
  // --- VITAMINS ---
  {
    key: 'vitaminAIU',
    name: 'Vitamin A',
    category: 'vitamins',
    standardTarget: 3000,
    unit: 'IU',
    description: 'Immune defense, visual health, and cellular integrity.',
  },
  {
    key: 'vitaminCMg',
    name: 'Vitamin C',
    category: 'vitamins',
    standardTarget: 90,
    unit: 'mg',
    description: 'Collagen synthesis, immune function, and iron absorption.',
  },
  {
    key: 'vitaminDIU',
    name: 'Vitamin D',
    category: 'vitamins',
    standardTarget: 800,
    unit: 'IU',
    description: 'Bone density, testosterone modulation, and calcium homeostasis.',
  },
  {
    key: 'vitaminEMg',
    name: 'Vitamin E',
    category: 'vitamins',
    standardTarget: 15,
    unit: 'mg',
    description: 'Fat-soluble antioxidant protecting cellular membrane lipids.',
  },
  {
    key: 'vitaminKMcg',
    name: 'Vitamin K',
    category: 'vitamins',
    standardTarget: 120,
    unit: 'mcg',
    description: 'Blood coagulation and bone matrix mineralization.',
  },
  {
    key: 'vitaminB1Mg',
    name: 'Vitamin B1 (Thiamine)',
    category: 'vitamins',
    standardTarget: 1.2,
    unit: 'mg',
    description: 'Carbohydrate and branch-chain amino acid metabolism.',
  },
  {
    key: 'vitaminB2Mg',
    name: 'Vitamin B2 (Riboflavin)',
    category: 'vitamins',
    standardTarget: 1.3,
    unit: 'mg',
    description: 'FAD cofactor in cellular mitochondrial respiration.',
  },
  {
    key: 'vitaminB3Mg',
    name: 'Vitamin B3 (Niacin)',
    category: 'vitamins',
    standardTarget: 16,
    unit: 'mg',
    description: 'NAD/NADP cofactor for ATP generation and DNA repair.',
  },
  {
    key: 'vitaminB6Mg',
    name: 'Vitamin B6 (Pyridoxine)',
    category: 'vitamins',
    standardTarget: 1.7,
    unit: 'mg',
    description: 'Amino acid metabolism and neurotransmitter biosynthesis.',
  },
  {
    key: 'vitaminB9Mcg',
    name: 'Vitamin B9 (Folate)',
    category: 'vitamins',
    standardTarget: 400,
    unit: 'mcg',
    description: 'Nucleic acid synthesis and red blood cell production.',
  },
  {
    key: 'vitaminB12Mcg',
    name: 'Vitamin B12 (Cobalamin)',
    category: 'vitamins',
    standardTarget: 2.4,
    unit: 'mcg',
    description: 'Neurological function, myelin maintenance, and DNA synthesis.',
  },

  // --- MINERALS ---
  {
    key: 'calciumMg',
    name: 'Calcium',
    category: 'minerals',
    standardTarget: 1000,
    unit: 'mg',
    description: 'Muscular excitation-contraction coupling and skeletal structure.',
  },
  {
    key: 'ironMg',
    name: 'Iron',
    category: 'minerals',
    standardTarget: 18,
    unit: 'mg',
    description: 'Hemoglobin oxygen transport and mitochondrial enzyme activity.',
  },
  {
    key: 'magnesiumMg',
    name: 'Magnesium',
    category: 'minerals',
    standardTarget: 420,
    unit: 'mg',
    description: 'Over 300 enzymatic reactions, ATP synthesis, and muscular relaxation.',
  },
  {
    key: 'zincMg',
    name: 'Zinc',
    category: 'minerals',
    standardTarget: 11,
    unit: 'mg',
    description: 'Endocrine health, immune defense, and protein translation.',
  },
  {
    key: 'potassiumMg',
    name: 'Potassium',
    category: 'minerals',
    standardTarget: 3400,
    unit: 'mg',
    description: 'Intracellular fluid balance, membrane potential, and cardiac rhythm.',
  },
  {
    key: 'sodiumMg',
    name: 'Sodium',
    category: 'minerals',
    standardTarget: 2300,
    unit: 'mg',
    isUpperLimit: true,
    description: 'Extracellular osmotic pressure and nerve impulse transmission.',
  },
  {
    key: 'phosphorusMg',
    name: 'Phosphorus',
    category: 'minerals',
    standardTarget: 700,
    unit: 'mg',
    description: 'Bone mineralization and high-energy phosphate bonds (ATP/CP).',
  },

  // --- OTHER NUTRIENTS & LIPIDS ---
  {
    key: 'fiberGrams',
    name: 'Dietary Fiber',
    category: 'lipids_other',
    standardTarget: 38,
    unit: 'g',
    description: 'Gut microbiome nourishment, glycemic regulation, and motility.',
  },
  {
    key: 'saturatedFatGrams',
    name: 'Saturated Fat',
    category: 'lipids_other',
    standardTarget: 20,
    unit: 'g',
    isUpperLimit: true,
    description: 'Recommended upper limit (<10% of total daily energy).',
  },
  {
    key: 'cholesterolMg',
    name: 'Cholesterol',
    category: 'lipids_other',
    standardTarget: 300,
    unit: 'mg',
    isUpperLimit: true,
    description: 'Steroid hormone precursor and cell membrane constituent.',
  },
  {
    key: 'sugarGrams',
    name: 'Free / Added Sugars',
    category: 'lipids_other',
    standardTarget: 36,
    unit: 'g',
    isUpperLimit: true,
    description: 'Recommended limit for metabolic and dental health.',
  },
];

export function calculateElectrolyteRatios(input: {
  sodium: number;
  potassium: number;
  calcium: number;
  magnesium: number;
}) {
  const naToKRatio = input.potassium > 0 ? Number((input.sodium / input.potassium).toFixed(2)) : 0;
  const caToMgRatio = input.magnesium > 0 ? Number((input.calcium / input.magnesium).toFixed(2)) : 0;
  return {
    naToKRatio,
    isNaKOptimal: naToKRatio <= 1.0,
    caToMgRatio,
    isCaMgOptimal: caToMgRatio >= 1.5 && caToMgRatio <= 2.5,
  };
}
