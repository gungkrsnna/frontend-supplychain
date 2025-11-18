// src/utils/computeKitchenTargetsWithRecipes.ts
import { ProductRecipe } from "../data/recipes";

type Row = any;

export function computeKitchenTargetsWithRecipes(
  rows: Row[],
  recipes: ProductRecipe[],
  meta: { target_date: string; note?: string; status?: string }
) {
  // mapping kolom -> lokasi (sama seperti sebelumnya)
  const keyToLocation: Record<string, string> = {
    projectName: "dalung",
    team: "tabanan",
    budget: "pakerisan",
    status: "mm",
    plusone: "jimbaran",
    plustwo: "sesetan",
    plusthree: "ayani",
    plusfour: "batubulan",
  };

  // helper: cari recipe by productName (exact match)
  const recipeMap = new Map<string, ProductRecipe>();
  for (const r of recipes) recipeMap.set(r.productName, r);

  // Produk aggregated per lokasi (jumlah unit)
  const products: Record<string, { productName: string; totals: Record<string, number>; grandTotal: number }> = {};

  // Bahan teragregasi per kategori
  const materials = {
    dough: {} as Record<string, { qty: number; unit: string }>,       // name -> { qty (g/pcs), unit }
    filling: {} as Record<string, { qty: number; unit: string }>,
    topping: {} as Record<string, { qty: number; unit: string }>,
    rawMaterials: {} as Record<string, { qty: number; unit: string }>,
  };

  for (const r of rows) {
    const name = r.user?.name ?? `product-${r.id}`;
    if (!products[name]) products[name] = { productName: name, totals: {}, grandTotal: 0 };

    // for each mapped numeric key, accumulate per location
    let rowSum = 0;
    for (const key of Object.keys(keyToLocation)) {
      const loc = keyToLocation[key];
      const n = Number(r[key] ?? 0);
      const safe = Number.isNaN(n) ? 0 : n;
      products[name].totals[loc] = (products[name].totals[loc] ?? 0) + safe;
      rowSum += safe;
    }
    products[name].grandTotal += rowSum;

    // Now convert this row's totals into ingredient needs using recipe (per product)
    const recipe = recipeMap.get(name);
    if (!recipe) continue; // jika tidak ada recipe, skip bahan kalkulasi

    // For every location value for this product, multiply by recipe amounts
    for (const [loc, qtyUnits] of Object.entries(products[name].totals)) {
      // NOTE: products[name].totals is cumulative across rows; to avoid double counting we should
      // instead compute per-row contribution. Simpler approach: compute based on current row's values:
      // read value directly from r for each mapped key and compute based on that; so change:
    }
  }

  // The block above attempted to use aggregated totals but to avoid double-counting,
  // we'll compute materials directly from each input row:
  // reset materials and recompute:
  materials.dough = {};
  materials.filling = {};
  materials.topping = {};
  materials.rawMaterials = {};

  for (const r of rows) {
    const name = r.user?.name ?? `product-${r.id}`;
    const recipe = recipeMap.get(name);
    if (!recipe) continue;

    // For each mapped key -> location, get units from row and compute ingredient needs
    for (const [key, loc] of Object.entries(keyToLocation)) {
      const units = Number(r[key] ?? 0);
      if (!units || units <= 0) continue;

      const multiply = (componentList: ProductRecipe[keyof ProductRecipe] | undefined, targetBucket: Record<string, { qty: number; unit: string }>) => {
        if (!componentList || componentList.length === 0) return;
        for (const comp of componentList as any[]) {
          const add = (targetBucket[comp.name] = targetBucket[comp.name] ?? { qty: 0, unit: comp.unit ?? "g" });
          add.qty += units * Number(comp.perUnit ?? 0);
        }
      };

      // calculate
      multiply(recipe.dough, materials.dough);
      multiply(recipe.filling, materials.filling);
      multiply(recipe.topping, materials.topping);
      multiply(recipe.rawMaterials, materials.rawMaterials);
    }
  }

  // Recompute product-level totals (per product aggregated across locations)
  const productList = Object.keys(products).map((pName) => {
    // compute totals by scanning rows: sum across mapped keys per product
    const totals: Record<string, number> = {};
    let grand = 0;
    for (const r of rows.filter((x) => (x.user?.name ?? `product-${x.id}`) === pName)) {
      for (const [key, loc] of Object.entries(keyToLocation)) {
        const n = Number(r[key] ?? 0);
        const safe = Number.isNaN(n) ? 0 : n;
        totals[loc] = (totals[loc] ?? 0) + safe;
        grand += safe;
      }
    }
    return { productName: pName, totals, grandTotal: grand };
  });

  // summary per location
  const summaryPerLocation: Record<string, number> = {};
  for (const p of productList) {
    for (const [loc, val] of Object.entries(p.totals)) {
      summaryPerLocation[loc] = (summaryPerLocation[loc] ?? 0) + val;
    }
  }

  return {
    meta,
    products: productList,
    summaryPerLocation,
    materials, // dough, filling, topping, rawMaterials aggregated
  };
}
