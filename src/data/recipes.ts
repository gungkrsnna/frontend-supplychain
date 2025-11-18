// src/data/recipes.ts
export type RecipeComponent = { name: string; perUnit: number; unit?: "g" | "pcs" | "ml" };
export type ProductRecipe = {
  productName: string;
  dough?: RecipeComponent[];       // contoh: [{name: "Plain Dough", perUnit: 80, unit: "g"}]
  filling?: RecipeComponent[];     // contoh: [{name: "Milk Butter Filling", perUnit: 30, unit: "g"}]
  topping?: RecipeComponent[];     // contoh: [{name: "Sesame", perUnit: 2, unit: "g"}]
  rawMaterials?: RecipeComponent[];// contoh: [{name: "Chocolate Chips", perUnit: 5, unit: "g"}]
};

const exampleRecipes: ProductRecipe[] = [
  {
    productName: "Milk Bun",
    dough: [{ name: "Plain Dough", perUnit: 80, unit: "g" }],
    filling: [{ name: "Milk Butter", perUnit: 30, unit: "g" }],
    topping: [{ name: "Sesame", perUnit: 2, unit: "g" }],
    rawMaterials: [{ name: "Yeast", perUnit: 2, unit: "g" }],
  },
  {
    productName: "Beef Floss",
    dough: [{ name: "Plain Dough", perUnit: 85, unit: "g" }],
    filling: [{ name: "Beef Floss", perUnit: 25, unit: "g" }],
    topping: [{ name: "Mayonnaise", perUnit: 5, unit: "g" }],
    rawMaterials: [{ name: "Yeast", perUnit: 2, unit: "g" }],
  },
  {
    productName: "Mentai",
    dough: [{ name: "Plain Dough", perUnit: 90, unit: "g" }],
    filling: [{ name: "Mentai Sauce", perUnit: 35, unit: "g" }],
    topping: [{ name: "Nori Flakes", perUnit: 1, unit: "g" }],
    rawMaterials: [{ name: "Salt", perUnit: 1, unit: "g" }],
  },
  // ... tambahkan resep produk lain sesuai kebutuhan ...
];

export default exampleRecipes;
