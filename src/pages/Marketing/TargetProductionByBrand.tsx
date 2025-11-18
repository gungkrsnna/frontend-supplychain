// src/pages/TargetMatrixPage.tsx
import React, { useMemo, useState } from "react";

/**
 * TargetMatrixPage.tsx
 * - Top columns = stores (cabangs)
 * - Left rows = products / menu
 * - Cells editable numbers (targets)
 *
 * Tailwind classes used. If you don't use Tailwind, replace classes with your own CSS.
 */

type Store = { id: number; name: string; code?: string; address?: string };
type Product = { id: number; name: string; sku?: string; uom?: string };

export default function TargetMatrixPage(): JSX.Element {
  // --- Dummy data (ganti sesuai kebutuhan) ---
  const defaultStores: Store[] = [
    { id: 1, name: "RG - Toko A", code: "RG-A" },
    { id: 2, name: "RG - Toko B", code: "RG-B" },
    { id: 3, name: "RG - Toko C", code: "RG-C" },
    { id: 4, name: "RG - Toko D", code: "RG-D" },
  ];

  const defaultProducts: Product[] = [
    { id: 101, name: "Roti Goolung Original", sku: "RG-OR" },
    { id: 102, name: "Roti Goolung Coklat", sku: "RG-CH" },
    { id: 103, name: "Roti Goolung Keju", sku: "RG-JE" },
    { id: 104, name: "Roti Goolung Pisang", sku: "RG-PI" },
    { id: 105, name: "Roti Goolung Kismis", sku: "RG-KI" },
  ];

  // initialize matrix: map key `${productId}_${storeId}` -> number
  const makeInitialMatrix = (prods: Product[], stores: Store[], base = 20) => {
    const m: Record<string, number> = {};
    prods.forEach((p, pi) => {
      stores.forEach((s, si) => {
        // some variation for realism
        const val = base + (pi * 5) + (si * 2);
        m[`${p.id}_${s.id}`] = val;
      });
    });
    return m;
  };

  const [stores] = useState<Store[]>(defaultStores);
  const [products] = useState<Product[]>(defaultProducts);
  const [matrix, setMatrix] = useState<Record<string, number>>(() => makeInitialMatrix(defaultProducts, defaultStores, 20));

  const [selectedStoreQuick, setSelectedStoreQuick] = useState<number | "">("");
  const [quickValueStore, setQuickValueStore] = useState<number>(0);
  const [selectedProductQuick, setSelectedProductQuick] = useState<number | "">("");
  const [quickValueProduct, setQuickValueProduct] = useState<number>(0);

  // helper key
  const mk = (prodId: number, storeId: number) => `${prodId}_${storeId}`;

  // cell change
  function handleCellChange(prodId: number, storeId: number, v: string) {
    const n = Number(v || 0);
    setMatrix((prev) => ({ ...prev, [mk(prodId, storeId)]: Number.isNaN(n) ? 0 : n }));
  }

  // quick fill column (store)
  function applyQuickFillStore() {
    if (selectedStoreQuick === "") return;
    const sid = Number(selectedStoreQuick);
    setMatrix((prev) => {
      const copy = { ...prev };
      products.forEach((p) => {
        copy[mk(p.id, sid)] = Number(quickValueStore) || 0;
      });
      return copy;
    });
  }

  // quick fill row (product)
  function applyQuickFillProduct() {
    if (selectedProductQuick === "") return;
    const pid = Number(selectedProductQuick);
    setMatrix((prev) => {
      const copy = { ...prev };
      stores.forEach((s) => {
        copy[mk(pid, s.id)] = Number(quickValueProduct) || 0;
      });
      return copy;
    });
  }

  function resetMatrix() {
    setMatrix(makeInitialMatrix(products, stores, 0));
  }

  // export CSV (rows = product, columns = stores)
  function exportCSV() {
    const header = ["Product / Store", ...stores.map((s) => s.name)];
    const rows = products.map((p) => {
      const cells = stores.map((s) => String(matrix[mk(p.id, s.id)] ?? ""));
      return [p.name, ...cells];
    });

    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `targets-matrix-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // computed summaries (optional)
  const totalsPerStore = useMemo(() => {
    const t: Record<number, number> = {};
    stores.forEach((s) => {
      let sum = 0;
      products.forEach((p) => { sum += Number(matrix[mk(p.id, s.id)] ?? 0); });
      t[s.id] = sum;
    });
    return t;
  }, [matrix, stores, products]);

  const totalsPerProduct = useMemo(() => {
    const t: Record<number, number> = {};
    products.forEach((p) => {
      let sum = 0;
      stores.forEach((s) => { sum += Number(matrix[mk(p.id, s.id)] ?? 0); });
      t[p.id] = sum;
    });
    return t;
  }, [matrix, stores, products]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Target Matrix — per Cabang × Menu</h1>

      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex gap-3 items-center">
          <div className="text-sm text-gray-600">Quick fill per cabang:</div>
          <select value={selectedStoreQuick} onChange={(e) => setSelectedStoreQuick(e.target.value === "" ? "" : Number(e.target.value))} className="border px-2 py-1 rounded">
            <option value="">-- pilih cabang --</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="number" value={quickValueStore} onChange={(e) => setQuickValueStore(Number(e.target.value || 0))} className="w-24 border px-2 py-1 rounded" placeholder="target" />
          <button onClick={applyQuickFillStore} className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600">Apply</button>
        </div>

        <div className="flex gap-3 items-center">
          <div className="text-sm text-gray-600">Quick fill per menu:</div>
          <select value={selectedProductQuick} onChange={(e) => setSelectedProductQuick(e.target.value === "" ? "" : Number(e.target.value))} className="border px-2 py-1 rounded">
            <option value="">-- pilih menu --</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" value={quickValueProduct} onChange={(e) => setQuickValueProduct(Number(e.target.value || 0))} className="w-24 border px-2 py-1 rounded" placeholder="target" />
          <button onClick={applyQuickFillProduct} className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600">Apply</button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button onClick={exportCSV} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Export CSV</button>
        <button onClick={resetMatrix} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Reset</button>
        <div className="ml-4 text-sm text-gray-600">Total per cabang di header (sum)</div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left border-r sticky left-0 bg-gray-50 z-10">Menu \ Cabang</th>
              {stores.map((s) => (
                <th key={s.id} className="px-3 py-2 text-right border-r">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.code ?? ""}</div>
                  <div className="text-sm font-semibold text-indigo-600 mt-1">Σ {totalsPerStore[s.id] ?? 0}</div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="even:bg-gray-50">
                <td className="px-3 py-2 font-medium w-64 sticky left-0 bg-white border-r z-0">{p.name}</td>

                {stores.map((s) => {
                  const key = mk(p.id, s.id);
                  const val = matrix[key] ?? 0;
                  return (
                    <td key={key} className="px-3 py-2 text-right border-r">
                      <input
                        type="number"
                        min={0}
                        value={val}
                        onChange={(e) => handleCellChange(p.id, s.id, e.target.value)}
                        className="w-20 px-2 py-1 border rounded text-right"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* footer: totals per product */}
            <tr className="bg-gray-100">
              <td className="px-3 py-2 font-semibold">TOTAL per Menu</td>
              {stores.map((s) => <td key={`f_${s.id}`} className="px-3 py-2 text-right font-semibold">{/* blank, totals shown per store header */}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Tips: klik sel untuk ubah target, gunakan Quick fill untuk mengisi banyak sel sekaligus, export CSV untuk unduh.
      </div>
    </div>
  );
}
