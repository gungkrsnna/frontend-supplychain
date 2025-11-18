// src/pages/KitchenProduction.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * KitchenProduction
 * - membaca sessionStorage.lastKitchenTargets
 * - menyimpan progress ke sessionStorage.lastKitchenProduction
 *
 * Struktur lastKitchenTargets yang diharapkan:
 * {
 *   meta: { target_date, note, status },
 *   products: [{ productName, totals: { dalung: 10, tabanan: 5 }, grandTotal }],
 *   summaryPerLocation: { dalung: 100, tabanan: 200 },
 *   materials: { dough: {...}, filling: {...} } // optional
 * }
 */

type TargetsPayload = any;
type ProductionState = {
  // shape: production[location][productName] = producedNumber
  production: Record<string, Record<string, number>>;
  completedLocations: Record<string, boolean>;
  updatedAt: string | null;
};

const STORAGE_KEY_TARGETS = "lastKitchenTargets";
const STORAGE_KEY_PROD = "lastKitchenProduction";

export default function KitchenProductionPage(): JSX.Element {
  const [payload, setPayload] = useState<TargetsPayload | null>(null);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [prodState, setProdState] = useState<ProductionState | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY_TARGETS) : null;
    if (!raw) {
      setPayload(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setPayload(parsed);
      const locations = Object.keys(parsed.summaryPerLocation ?? {});
      setActiveLocation((loc) => loc ?? (locations.length > 0 ? locations[0] : null));
    } catch (err) {
      console.error("Failed parse lastKitchenTargets", err);
      setPayload(null);
    }

    // load existing production state if ada
    const rawProd = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY_PROD) : null;
    if (rawProd) {
      try {
        setProdState(JSON.parse(rawProd));
      } catch {
        setProdState(null);
      }
    } else {
      // init empty later when payload known
      setProdState(null);
    }
  }, []);

  // init empty production state when payload arrives and prodState null
  useEffect(() => {
    if (!payload) return;
    if (prodState) return;

    const prodInit: ProductionState = {
      production: {},
      completedLocations: {},
      updatedAt: null,
    };

    const locations = Object.keys(payload.summaryPerLocation ?? {});

    for (const loc of locations) {
      prodInit.production[loc] = {};
      prodInit.completedLocations[loc] = false;
      for (const p of payload.products ?? []) {
        const productName = p.productName;
        // target per location might not exist (0)
        prodInit.production[loc][productName] = 0;
      }
    }

    setProdState(prodInit);
    // do not persist immediately until user saves
  }, [payload, prodState]);

  const locations = useMemo(() => Object.keys(payload?.summaryPerLocation ?? {}), [payload]);

  const productsForLocation = (loc: string) => {
    if (!payload?.products) return [];
    return payload.products.map((p: any) => ({
      productName: p.productName,
      target: Number(p.totals?.[loc] ?? 0),
      grand: Number(p.grandTotal ?? 0),
    }));
  };

  const setProducedValue = (loc: string, productName: string, value: number) => {
    if (!prodState) return;
    const safe = Number.isNaN(value) ? 0 : Math.max(0, Math.floor(value)); // integer, >=0
    setProdState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, production: { ...prev.production } };
      next.production[loc] = { ...next.production[loc], [productName]: safe };
      next.updatedAt = new Date().toISOString();
      return next;
    });
  };

  const saveProduction = (persistToLocalStorage = true) => {
    if (!prodState) return;
    const toSave = { ...prodState, updatedAt: new Date().toISOString() };
    setProdState(toSave);
    if (persistToLocalStorage) {
      try {
        sessionStorage.setItem(STORAGE_KEY_PROD, JSON.stringify(toSave));
        alert("Progress produksi berhasil disimpan (lokal).");
      } catch (err) {
        console.warn("Gagal menyimpan progress ke sessionStorage", err);
        alert("Gagal menyimpan progress ke storage browser.");
      }
    }
  };

  const markLocationComplete = (loc: string) => {
    if (!prodState) return;
    // optional: validate all produced >= target?
    const products = productsForLocation(loc);
    for (const p of products) {
      const produced = prodState.production[loc]?.[p.productName] ?? 0;
      if (produced < p.target) {
        const ok = window.confirm(`Beberapa produk untuk lokasi "${loc}" belum mencapai target.\nTarget ${p.productName}: ${p.target}, Produced: ${produced}\nTetap tandai lokasi selesai?`);
        if (!ok) return;
        break;
      }
    }

    setProdState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, completedLocations: { ...prev.completedLocations } };
      next.completedLocations[loc] = true;
      next.updatedAt = new Date().toISOString();
      try { sessionStorage.setItem(STORAGE_KEY_PROD, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const exportLocationCSV = (loc: string) => {
    if (!payload || !prodState) return;
    const rows: string[] = [];
    rows.push(["product", "target", "produced", "remaining"].join(","));
    for (const p of productsForLocation(loc)) {
      const produced = prodState.production[loc]?.[p.productName] ?? 0;
      const remaining = Math.max(0, p.target - produced);
      rows.push([`"${p.productName.replace(/"/g, '""')}"`, p.target, produced, remaining].join(","));
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production_${loc}_${payload.meta?.target_date ?? "batch"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetProduction = () => {
    if (!window.confirm("Reset seluruh progress produksi lokal? (tidak bisa dibatalkan)")) return;
    try {
      sessionStorage.removeItem(STORAGE_KEY_PROD);
      // re-init
      setProdState(null);
      alert("Progress produksi di-reset. Silakan reload halaman bila perlu.");
    } catch (err) {
      console.warn(err);
    }
  };

  if (!payload) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">Kitchen Production</h2>
        <div className="mb-4">Tidak ada data target produksi. Pastikan kamu sudah menekan <strong>Process</strong> di halaman Target Production.</div>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => navigate("/")}>Kembali ke Targets</button>
        </div>
      </div>
    );
  }

  if (!prodState) {
    return <div className="p-6">Mempersiapkan data...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Kitchen Production — {payload.meta?.target_date}</h2>
            <div className="text-sm text-gray-600">{payload.meta?.note}</div>
          </div>

          <div className="space-x-2">
            <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => navigate(-1)}>Back</button>
            <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={() => saveProduction(true)}>Save Progress</button>
            <button className="px-3 py-1 bg-yellow-500 text-white rounded" onClick={resetProduction}>Reset Local</button>
          </div>
        </div>
      </div>

      {/* Locations Tabs */}
      <div>
        <div className="flex gap-2 mb-4">
          {locations.map((loc) => {
            const completed = prodState.completedLocations[loc];
            return (
              <button
                key={loc}
                className={`px-3 py-1 rounded ${activeLocation === loc ? "bg-indigo-600 text-white" : "bg-gray-100"}`}
                onClick={() => setActiveLocation(loc)}
              >
                {loc} {completed ? <span className="ml-1 text-xs bg-green-100 text-green-700 px-1 rounded">Done</span> : null}
              </button>
            );
          })}
        </div>

        {/* Active location content */}
        {activeLocation && (
          <div>
            <h3 className="font-semibold mb-2">Lokasi: {activeLocation}</h3>
            <div className="overflow-x-auto border rounded">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 border text-left">Product</th>
                    <th className="p-2 border text-right">Target</th>
                    <th className="p-2 border text-right">Produced</th>
                    <th className="p-2 border text-right">Remain</th>
                  </tr>
                </thead>
                <tbody>
                  {productsForLocation(activeLocation).map((p) => {
                    const curProduced = prodState.production[activeLocation]?.[p.productName] ?? 0;
                    const remain = Math.max(0, p.target - curProduced);
                    const completed = prodState.completedLocations[activeLocation];
                    return (
                      <tr key={p.productName} className="hover:bg-gray-50">
                        <td className="p-2 border">{p.productName}</td>
                        <td className="p-2 border text-right">{p.target}</td>
                        <td className="p-2 border text-right">
                          <input
                            type="number"
                            min={0}
                            max={p.target}
                            value={curProduced}
                            disabled={completed}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              // clamp 0..target
                              const clamped = Number.isNaN(v) ? 0 : Math.max(0, Math.min(p.target, Math.floor(v)));
                              setProducedValue(activeLocation, p.productName, clamped);
                            }}
                            className="w-24 text-right px-2 py-1 border rounded"
                          />
                        </td>
                        <td className="p-2 border text-right">{remain}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                className="px-3 py-1 bg-green-600 text-white rounded"
                onClick={() => saveProduction(true)}
              >
                Save Progress
              </button>

              <button
                className="px-3 py-1 bg-blue-600 text-white rounded"
                onClick={() => exportLocationCSV(activeLocation)}
              >
                Export CSV
              </button>

              {!prodState.completedLocations[activeLocation] ? (
                <button
                  className="px-3 py-1 bg-red-600 text-white rounded"
                  onClick={() => markLocationComplete(activeLocation)}
                >
                  Mark Location Complete
                </button>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded">Location marked complete</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div>
        <h4 className="font-semibold mb-2">Summary (lokal)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 border rounded">
            <h5 className="font-medium mb-2">Targets per location</h5>
            <ul>
              {locations.map((loc) => (
                <li key={loc} className="flex justify-between">
                  <span>{loc}</span>
                  <span>{payload.summaryPerLocation[loc]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 border rounded">
            <h5 className="font-medium mb-2">Produced so far (per location)</h5>
            <ul>
              {locations.map((loc) => {
                const totalProduced = Object.values(prodState.production[loc] ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
                return (
                  <li key={loc} className="flex justify-between">
                    <span>{loc}</span>
                    <span>{totalProduced} / {payload.summaryPerLocation[loc]}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}
