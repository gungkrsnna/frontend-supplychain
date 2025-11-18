// src/utils/computeKitchenTargets.ts
export type Row = any;

export function computeKitchenTargets(rows: Row[], meta: { target_date: string; note?: string; status?: string }) {
  // mapping kolom -> lokasi (sesuaikan bila perlu)
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

  const products: Record<string, {
    productName: string;
    totals: Record<string, number>;
    grandTotal: number;
    rawRows: Row[];
  }> = {};

  for (const r of rows) {
    const name = r.user?.name ?? `product-${r.id}`;
    if (!products[name]) {
      products[name] = { productName: name, totals: {}, grandTotal: 0, rawRows: [] };
    }
    const prod = products[name];
    prod.rawRows.push(r);

    let rowSum = 0;
    for (const key of Object.keys(keyToLocation)) {
      const loc = keyToLocation[key];
      const n = Number(r[key] ?? 0);
      const safe = Number.isNaN(n) ? 0 : n;
      prod.totals[loc] = (prod.totals[loc] ?? 0) + safe;
      rowSum += safe;
    }
    prod.grandTotal += rowSum;
  }

  // summary per lokasi
  const summaryPerLocation: Record<string, number> = {};
  for (const p of Object.values(products)) {
    for (const [loc, val] of Object.entries(p.totals)) {
      summaryPerLocation[loc] = (summaryPerLocation[loc] ?? 0) + val;
    }
  }

  return {
    meta: { ...meta },
    products: Object.values(products),
    summaryPerLocation,
  };
}
