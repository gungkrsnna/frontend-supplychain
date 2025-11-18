// src/pages/kitchen/DoughMaker.tsx
import React, { useMemo } from "react";
import { useKitchen } from "../../context/KitchenContext";
import { useNavigate } from "react-router-dom";

/**
 * DoughMakerPage (TSX)
 * - shows product metadata (sku, category, beratPerUnit)
 * - lets operator input produced units per product
 * - shows total produced weight (produced * beratPerUnit) and remaining (units + weight)
 */

export default function DoughMakerPage(): JSX.Element {
  const { state, setState, saveToStorage } = useKitchen();
  const navigate = useNavigate();
  const loc = state.activeLocation ?? state.locations[0] ?? null;
  if (!loc) return <div className="p-6">No location selected.</div>;

  const rows = state.dough[loc] ?? [];

  // helper: map productName -> beratPerUnit & sku & category from targets (if available)
  const productMeta = useMemo(() => {
    const map = new Map<string, { beratPerUnit?: number; sku?: string; category?: string }>();
    const targets = state.targets?.products ?? [];
    for (const p of targets) {
      const name = p.productName;
      // p may contain beratPerUnit or sku in extended payload; we attempt to read them
      const berat = (p as any).beratPerUnit ?? (p as any).weightPerUnit ?? undefined;
      const sku = (p as any).sku ?? undefined;
      const category = (p as any).category ?? undefined;
      map.set(name, { beratPerUnit: berat, sku, category });
    }
    return map;
  }, [state.targets]);

  const setProduced = (productName: string, value: number) => {
    setState((s) => {
      const copy = { ...s };
      copy.dough = { ...copy.dough };
      copy.dough[loc] = copy.dough[loc].map((r: any) =>
        r.productName === productName ? { ...r, produced: Math.max(0, Math.floor(value)) } : r
      );
      copy.lastUpdatedAt = new Date().toISOString();
      return copy;
    });
  };

  // utility to format numbers
  const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString("en-US") : "-");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Dough Maker — {loc}</h2>
        <div>
          <button
            className="px-3 py-1 bg-slate-600 text-white rounded mr-2"
            onClick={() => navigate("/kitchen")}
          >
            Back
          </button>
          <button
            className="px-3 py-1 bg-green-600 text-white rounded"
            onClick={() => {
              saveToStorage();
              alert("Saved");
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left">Product</th>
              <th className="p-2 border text-left">SKU</th>
              <th className="p-2 border text-left">Category</th>
              <th className="p-2 border text-right">Berat / Unit (g)</th>
              <th className="p-2 border text-right">Target (unit)</th>
              <th className="p-2 border text-right">Produced (unit)</th>
              <th className="p-2 border text-right">Total Berat Produced (g)</th>
              <th className="p-2 border text-right">Remain (unit)</th>
              <th className="p-2 border text-right">Remain (g)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const meta = productMeta.get(r.productName) ?? {};
              const beratPerUnit =
                typeof meta.beratPerUnit === "number" ? meta.beratPerUnit : (typeof r.beratPerUnit === "number" ? r.beratPerUnit : undefined);
              const sku = meta.sku ?? r.sku ?? "";
              const category = meta.category ?? r.category ?? "";
              const produced = Number(r.produced ?? 0);
              const target = Number(r.target ?? 0);
              const remainUnits = Math.max(0, target - produced);
              const totalProducedWeight = typeof beratPerUnit === "number" ? produced * beratPerUnit : undefined;
              const remainWeight = typeof beratPerUnit === "number" ? remainUnits * beratPerUnit : undefined;

              return (
                <tr key={r.productName} className="hover:bg-gray-50">
                  <td className="p-2 border">{r.productName}</td>
                  <td className="p-2 border">{sku}</td>
                  <td className="p-2 border">{category}</td>
                  <td className="p-2 border text-right">{beratPerUnit ?? "-"}</td>
                  <td className="p-2 border text-right">{fmt(target)}</td>

                  <td className="p-2 border text-right">
                    <input
                      type="number"
                      min={0}
                      value={produced}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setProduced(r.productName, Number.isNaN(v) ? 0 : v);
                      }}
                      className="w-28 px-2 py-1 border rounded text-right"
                    />
                  </td>

                  <td className="p-2 border text-right">{totalProducedWeight !== undefined ? fmt(totalProducedWeight) : "-"}</td>
                  <td className="p-2 border text-right">{fmt(remainUnits)}</td>
                  <td className="p-2 border text-right">{remainWeight !== undefined ? fmt(remainWeight) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
