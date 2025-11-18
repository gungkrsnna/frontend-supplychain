// src/pages/Kitchen/QCTLReport.tsx
import React, { useMemo } from "react";
import { useKitchen } from "../../context/KitchenContext";
import { useNavigate } from "react-router-dom";

export default function QCTLReport(): JSX.Element {
  const { state, saveToStorage, setState } = useKitchen();
  const navigate = useNavigate();

  const loc = state.activeLocation ?? state.locations[0] ?? null;
  if (!loc) return <div className="p-6">No active location.</div>;

  const dough = state.dough[loc] ?? [];
  const rolling = state.rolling[loc] ?? [];
  const oven = state.oven[loc] ?? [];
  const topping = state.topping[loc] ?? [];

  // build summary rows by product
  const products = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of dough) map.set(d.productName, { productName: d.productName, target: d.target, doughProduced: d.produced });
    for (const r of rolling) {
      const cur = map.get(r.productName) ?? { productName: r.productName, target: r.target };
      cur.starterProduced = r.starterProduced;
      cur.fillingProduced = r.fillingProduced;
      cur.rolledProduced = r.rolledProduced;
      map.set(r.productName, cur);
    }
    for (const o of oven) {
      const cur = map.get(o.productName) ?? { productName: o.productName };
      cur.toOven = o.toOven;
      cur.outOfOven = o.outOfOven;
      cur.reject = o.reject ?? 0;
      map.set(o.productName, cur);
    }
    for (const t of topping) {
      const cur = map.get(t.productName) ?? { productName: t.productName };
      cur.sfg = t.sfgTopping;
      cur.fg = t.fgTopping;
      map.set(t.productName, cur);
    }
    return Array.from(map.values());
  }, [dough, rolling, oven, topping]);

  const markLocationDone = () => {
    setState((s) => ({ ...s, completedLocations: { ...s.completedLocations, [loc]: true }, lastUpdatedAt: new Date().toISOString() }));
    saveToStorage();
    // optional: attach note to lastKitchenTargets (sentAt)
    try {
        const rawT = sessionStorage.getItem("lastKitchenTargets");
        if (rawT) {
        const t = JSON.parse(rawT);
        t.qcCompletedAt = new Date().toISOString();
        sessionStorage.setItem("lastKitchenTargets", JSON.stringify(t));
        }
    } catch {}
    // navigate to delivery note so TL can print
    navigate("/kitchen/delivery-note");
    };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">QC / TL Report — {loc}</h2>
        <div>
          <button className="px-3 py-1 bg-slate-600 text-white rounded mr-2" onClick={() => navigate("/kitchen")}>Back</button>
          <button className="px-3 py-1 bg-green-600 text-white rounded mr-2" onClick={() => { saveToStorage(); alert("Saved"); }}>Save</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={markLocationDone}>Mark Location Done</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left">Product</th>
              <th className="p-2 border text-right">Target</th>
              <th className="p-2 border text-right">Dough</th>
              <th className="p-2 border text-right">Starter</th>
              <th className="p-2 border text-right">Filling</th>
              <th className="p-2 border text-right">Rolled</th>
              <th className="p-2 border text-right">To Oven</th>
              <th className="p-2 border text-right">Out Oven</th>
              <th className="p-2 border text-right">Reject</th>
              <th className="p-2 border text-right">SFG</th>
              <th className="p-2 border text-right">FG</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.productName} className="hover:bg-gray-50">
                <td className="p-2 border">{p.productName}</td>
                <td className="p-2 border text-right">{p.target ?? "-"}</td>
                <td className="p-2 border text-right">{p.doughProduced ?? "-"}</td>
                <td className="p-2 border text-right">{p.starterProduced ?? "-"}</td>
                <td className="p-2 border text-right">{p.fillingProduced ?? "-"}</td>
                <td className="p-2 border text-right">{p.rolledProduced ?? "-"}</td>
                <td className="p-2 border text-right">{p.toOven ?? "-"}</td>
                <td className="p-2 border text-right">{p.outOfOven ?? "-"}</td>
                <td className="p-2 border text-right">{p.reject ?? "-"}</td>
                <td className="p-2 border text-right">{p.sfg ?? "-"}</td>
                <td className="p-2 border text-right">{p.fg ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
