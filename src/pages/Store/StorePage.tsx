import React, { useEffect, useMemo, useState } from "react";

/**
 * StorePage.tsx
 * - route: /store
 * - pilih cabang (store) lalu tampilkan inventory produk untuk cabang itu
 * - inline edit 'ready' (number)
 * - cari produk, reset seed, randomize (untuk testing), export CSV
 *
 * Note: uses localStorage key "inv_prototype_v1". If you already used the prior App example,
 * this will read the same storage so state is shared.
 */

/* ---------------- Types & Seed (same as prototype) ---------------- */
type Branch = { id: string; code: string; name: string };
type Product = { id: string; sku?: string; name: string };
type InventoryRow = {
  id: string; // branch_product
  branchId: string;
  productId: string;
  ready: number;
};

const BRANCHES: Branch[] = [
  { id: "dalung", code: "DALUNG", name: "Dalung" },
  { id: "tabanan", code: "TABANAN", name: "Tabanan" },
  { id: "pakerisan", code: "PAKERISAN", name: "Pakerisan" },
  { id: "mm", code: "MM", name: "MM" },
  { id: "jimbaran", code: "JIMBARAN", name: "Jimbaran" },
  { id: "sesetan", code: "SESETAN", name: "Sesetan" },
  { id: "ayani", code: "AYANI", name: "Ayani" },
  { id: "batubulan", code: "BATUBULAN", name: "Batubulan" },
];

const PRODUCTS: Product[] = [
  { id: "milkbun", sku: "ROTI-MILK-BUN", name: "Milk Bun" },
  { id: "beeffloss", sku: "ROTI-BEEF-FLOSS", name: "Beef Floss" },
  { id: "mentai", sku: "ROTI-MENTAI", name: "Mentai" },
  { id: "almond", sku: "ROTI-ALMOND", name: "Almond Butter" },
  { id: "lotusbiscoff", sku: "ROTI-LOTUS-BISCOFF", name: "Lotus Biscoff" },
];

const TARGET_PER_STORE_DEFAULT = 100;
const LS_KEY = "inv_prototype_v1";

/* ---------------- Helpers ---------------- */
function seedInventory(defaultQty = TARGET_PER_STORE_DEFAULT): InventoryRow[] {
  const rows: InventoryRow[] = [];
  for (const b of BRANCHES) {
    for (const p of PRODUCTS) {
      rows.push({
        id: `${b.id}_${p.id}`,
        branchId: b.id,
        productId: p.id,
        ready: defaultQty,
      });
    }
  }
  return rows;
}

function csvDownload(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => {
    // escape quotes
    const v = String(c ?? "");
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- Component ---------------- */
export default function StorePage(): JSX.Element {
  // inventory state (shared with other pages via same LS key)
  const [inventory, setInventory] = useState<InventoryRow[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw) as InventoryRow[];
    } catch {}
    return seedInventory();
  });

  // selected branch (from query param? default first)
  const [selectedBranch, setSelectedBranch] = useState<string>(() => BRANCHES[0].id);
  const [search, setSearch] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<number | "">("");
  const [target, setTarget] = useState<number>(TARGET_PER_STORE_DEFAULT);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(inventory));
  }, [inventory]);

  // rows for the selected store
  const rows = useMemo(() => {
    const productMap = new Map(PRODUCTS.map((p) => [p.id, p]));
    return PRODUCTS
      .map((p) => {
        const r = inventory.find((x) => x.branchId === selectedBranch && x.productId === p.id);
        const ready = r?.ready ?? 0;
        return {
          productId: p.id,
          sku: p.sku ?? "",
          name: p.name,
          ready,
          fulfilled: Math.min(ready, target),
          shortfall: Math.max(target - ready, 0),
          surplus: Math.max(ready - target, 0),
          invId: r?.id ?? `${selectedBranch}_${p.id}`,
        };
      })
      .filter((r) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return r.name.toLowerCase().includes(s) || r.sku.toLowerCase().includes(s);
      });
  }, [inventory, selectedBranch, search, target]);

  /* Inline edit handlers */
  function startEdit(invId: string, current: number) {
    setEditingId(invId);
    setEditingValue(current);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditingValue("");
  }
  function commitEdit(invId: string) {
    if (editingValue === "" || isNaN(Number(editingValue))) {
      alert("Masukkan angka valid");
      return;
    }
    const next = inventory.map((r) => r.id === invId ? { ...r, ready: Number(editingValue) } : r);
    setInventory(next);
    setEditingId(null);
    setEditingValue("");
  }

  function handleRandomizeBranch() {
    // randomize ready 0..250 for current branch only
    const next = inventory.map((r) => {
      if (r.branchId !== selectedBranch) return r;
      return { ...r, ready: Math.floor(Math.random() * 251) };
    });
    setInventory(next);
  }

  function handleResetSeed() {
    if (!confirm("Reset semua inventory ke seed (ready=100)?")) return;
    setInventory(seedInventory());
  }

  function handleExportCSV() {
    // columns: productId, sku, name, ready, target, fulfilled, shortfall, surplus, branch
    const header = ["productId", "sku", "name", "ready", "target", "fulfilled", "shortfall", "surplus", "branchId", "branchName"];
    const body = rows.map((r) => [
      r.productId, r.sku, r.name, String(r.ready), String(target), String(r.fulfilled), String(r.shortfall), String(r.surplus), selectedBranch, BRANCHES.find(b => b.id === selectedBranch)?.name ?? ""
    ]);
    csvDownload(`inventory_${selectedBranch}.csv`, [header, ...body]);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Store Inventory — /store</h1>

      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mb-4">
        <div>
          <label className="text-sm block">Pilih Store</label>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="border px-2 py-1 mt-1">
            {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="mt-3 sm:mt-0">
          <label className="text-sm block">Target per store</label>
          <input type="number" value={target} onChange={(e) => setTarget(Math.max(0, Number(e.target.value || 0)))} className="border px-2 py-1 mt-1 w-28" />
        </div>

        <div className="mt-3 sm:mt-0 flex-1">
          <label className="text-sm block">Cari produk</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="nama atau sku" className="border px-2 py-1 mt-1 w-full" />
        </div>

        <div className="mt-3 sm:mt-0 flex gap-2 items-end">
          <button onClick={handleRandomizeBranch} className="px-3 py-1 bg-yellow-400 rounded">Randomize</button>
          <button onClick={handleExportCSV} className="px-3 py-1 bg-blue-600 text-white rounded">Export CSV</button>
          <button onClick={handleResetSeed} className="px-3 py-1 bg-red-500 text-white rounded">Reset Seed</button>
        </div>
      </div>

      <div className="mb-4 text-sm">
        <strong>Store:</strong> {BRANCHES.find(b => b.id === selectedBranch)?.name} &nbsp;
        <span className="ml-4">Products shown: {rows.length}</span>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-3 py-2 border">Product</th>
              <th className="px-3 py-2 border text-right">Ready</th>
              <th className="px-3 py-2 border text-right">Target</th>
              <th className="px-3 py-2 border text-right">Fulfilled</th>
              <th className="px-3 py-2 border text-right">Shortfall</th>
              <th className="px-3 py-2 border text-right">Surplus</th>
              <th className="px-3 py-2 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productId} className="odd:bg-white even:bg-gray-50">
                <td className="px-3 py-2 border">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.sku}</div>
                </td>
                <td className="px-3 py-2 border text-right">
                  {editingId === r.invId ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-20 border px-2 py-1"
                      />
                      <button onClick={() => commitEdit(r.invId)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Save</button>
                      <button onClick={cancelEdit} className="px-2 py-1 bg-gray-200 rounded text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <span>{r.ready}</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 border text-right">{target}</td>
                <td className="px-3 py-2 border text-right">{r.fulfilled}</td>
                <td className="px-3 py-2 border text-right">{r.shortfall > 0 ? <span className="text-red-600">{r.shortfall}</span> : 0}</td>
                <td className="px-3 py-2 border text-right">{r.surplus > 0 ? <span className="text-green-600">{r.surplus}</span> : 0}</td>
                <td className="px-3 py-2 border text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => startEdit(r.invId, r.ready)}
                      className="px-2 py-1 bg-indigo-600 text-white rounded text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        // quick +/- 10
                        const next = inventory.map((iv) => iv.id === r.invId ? { ...iv, ready: Math.max(0, iv.ready + 10) } : iv);
                        setInventory(next);
                      }}
                      className="px-2 py-1 bg-green-200 rounded text-xs"
                      title="+10"
                    >
                      +10
                    </button>
                    <button
                      onClick={() => {
                        const next = inventory.map((iv) => iv.id === r.invId ? { ...iv, ready: Math.max(0, iv.ready - 10) } : iv);
                        setInventory(next);
                      }}
                      className="px-2 py-1 bg-red-200 rounded text-xs"
                      title="-10"
                    >
                      -10
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">No products</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
