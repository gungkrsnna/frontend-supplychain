// src/pages/Kitchen/Topping.tsx
import React from "react";
import { useKitchen } from "../../context/KitchenContext";
import { useNavigate } from "react-router-dom";

export default function ToppingPage(): JSX.Element {
  const { state, setState, saveToStorage } = useKitchen();
  const navigate = useNavigate();
  const loc = state.activeLocation ?? state.locations[0] ?? null;
  if (!loc) return <div className="p-6">No location active.</div>;

  const rows = state.topping[loc] ?? [];

  const setTopping = (productName: string, field: keyof typeof rows[number], value: number) => {
    setState((s) => {
      const copy = { ...s };
      copy.topping = { ...copy.topping };
      copy.topping[loc] = copy.topping[loc].map((r) => (r.productName === productName ? { ...r, [field]: Math.max(0, Math.floor(value)) } : r));
      copy.lastUpdatedAt = new Date().toISOString();
      return copy;
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Topping — {loc}</h2>
        <div>
          <button className="px-3 py-1 bg-slate-600 text-white rounded mr-2" onClick={() => navigate("/kitchen")}>Back</button>
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => { saveToStorage(); alert("Saved"); }}>Save</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left">Product</th>
              <th className="p-2 border text-right">SFG Topping</th>
              <th className="p-2 border text-right">FG Topping</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productName} className="hover:bg-gray-50">
                <td className="p-2 border">{r.productName}</td>
                <td className="p-2 border text-right">
                  <input type="number" value={r.sfgTopping} min={0} onChange={(e) => setTopping(r.productName, "sfgTopping", Number(e.target.value))} className="w-24 px-2 py-1 border rounded text-right" />
                </td>
                <td className="p-2 border text-right">
                  <input type="number" value={r.fgTopping} min={0} onChange={(e) => setTopping(r.productName, "fgTopping", Number(e.target.value))} className="w-24 px-2 py-1 border rounded text-right" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
