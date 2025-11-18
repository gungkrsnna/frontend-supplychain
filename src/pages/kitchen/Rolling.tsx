// src/pages/Kitchen/Rolling.tsx
import React from "react";
import { useKitchen } from "../../context/KitchenContext";
import { useNavigate } from "react-router-dom";

export default function RollingPage(): JSX.Element {
  const { state, setState, saveToStorage } = useKitchen();
  const navigate = useNavigate();
  const loc = state.activeLocation ?? state.locations[0] ?? null;
  if (!loc) return <div className="p-6">No location active.</div>;

  // Use dough produced as base if available
  const doughRows = state.dough[loc] ?? [];
  const rollingRows = state.rolling[loc] ?? [];

  const setRollValue = (productName: string, field: keyof typeof rollingRows[number], value: number) => {
    setState((s) => {
      const copy = { ...s };
      copy.rolling = { ...copy.rolling };
      copy.rolling[loc] = copy.rolling[loc].map((r) => (r.productName === productName ? { ...r, [field]: Math.max(0, Math.floor(value)) } : r));
      copy.lastUpdatedAt = new Date().toISOString();
      return copy;
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Rolling — {loc}</h2>
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
              <th className="p-2 border text-right">Dough Produced</th>
              <th className="p-2 border text-right">Starter Produced</th>
              <th className="p-2 border text-right">Filling Produced</th>
              <th className="p-2 border text-right">Rolled Produced</th>
            </tr>
          </thead>
          <tbody>
            {rollingRows.map((r) => {
              const doughProduced = (doughRows.find((d) => d.productName === r.productName)?.produced) ?? 0;
              return (
                <tr key={r.productName} className="hover:bg-gray-50">
                  <td className="p-2 border">{r.productName}</td>
                  <td className="p-2 border text-right">{doughProduced}</td>
                  <td className="p-2 border text-right">
                    <input type="number" value={r.starterProduced} min={0} onChange={(e) => setRollValue(r.productName, "starterProduced", Number(e.target.value))} className="w-20 px-2 py-1 border rounded text-right" />
                  </td>
                  <td className="p-2 border text-right">
                    <input type="number" value={r.fillingProduced} min={0} onChange={(e) => setRollValue(r.productName, "fillingProduced", Number(e.target.value))} className="w-20 px-2 py-1 border rounded text-right" />
                  </td>
                  <td className="p-2 border text-right">
                    <input type="number" value={r.rolledProduced} min={0} onChange={(e) => setRollValue(r.productName, "rolledProduced", Number(e.target.value))} className="w-20 px-2 py-1 border rounded text-right" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
