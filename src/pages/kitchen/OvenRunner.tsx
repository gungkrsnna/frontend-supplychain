// src/pages/Kitchen/OvenRunner.tsx
import React from "react";
import { useKitchen } from "../../context/KitchenContext";
import { useNavigate } from "react-router-dom";

export default function OvenRunnerPage(): JSX.Element {
  const { state, setState, saveToStorage } = useKitchen();
  const navigate = useNavigate();
  const loc = state.activeLocation ?? state.locations[0] ?? null;
  if (!loc) return <div className="p-6">No location active.</div>;

  const rows = state.oven[loc] ?? [];

  const setOven = (productName: string, field: keyof typeof rows[number], value: number) => {
    setState((s) => {
      const copy = { ...s };
      copy.oven = { ...copy.oven };
      copy.oven[loc] = copy.oven[loc].map((r) => (r.productName === productName ? { ...r, [field]: Math.max(0, Math.floor(value)) } : r));
      copy.lastUpdatedAt = new Date().toISOString();
      return copy;
    });
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Oven Runner — {loc}</h2>
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
              <th className="p-2 border text-right">To Oven</th>
              <th className="p-2 border text-right">Out of Oven</th>
              <th className="p-2 border text-right">Reject</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.productName} className="hover:bg-gray-50">
                <td className="p-2 border">{r.productName}</td>
                <td className="p-2 border text-right">
                  <input type="number" value={r.toOven} min={0} onChange={(e) => setOven(r.productName, "toOven", Number(e.target.value))} className="w-20 px-2 py-1 border rounded text-right" />
                </td>
                <td className="p-2 border text-right">
                  <input type="number" value={r.outOfOven} min={0} onChange={(e) => setOven(r.productName, "outOfOven", Number(e.target.value))} className="w-20 px-2 py-1 border rounded text-right" />
                </td>
                <td className="p-2 border text-right">
                  <input type="number" value={r.reject ?? 0} min={0} onChange={(e) => setOven(r.productName, "reject", Number(e.target.value))} className="w-20 px-2 py-1 border rounded text-right" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
