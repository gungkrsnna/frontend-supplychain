// src/pages/central/CentralInventoryPage.tsx
import React, { useCallback, useEffect, useRef, useState, useContext } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import { useNavigate, useParams } from "react-router-dom";
import AddCentralModal from "./components/AddCentralModal";
import TransferToStoreModal from "./components/TransferToStoreModal";
import { AuthContext } from "../../context/AuthContext";

type InventoryItem = {
  id?: number | string | null;
  item_id?: number | string | null;
  product_name?: string | null;
  product_code?: string | null;
  qty?: number | null;
  unit?: string | null;
  min_stock?: number | null;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  is_production?: boolean | null;
  measurements?: any[];
  breakdown?: { remainder: number; breakdown: Array<{ id: number; count: number; name: string; perBase: number }> };
  breakdownString?: string;
  raw?: any;
};

type ItemModelType = {
  id: number;
  code?: string;
  name: string;
  uom?: { id: number; name: string } | null;
  is_production?: boolean | number | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

function clone<T>(v: T) {
  return JSON.parse(JSON.stringify(v)) as T;
}

function breakdownMeasurementsGreedy(totalBaseUnits: number, measurements?: any[]) {
  if (!measurements || !Array.isArray(measurements) || measurements.length === 0) {
    return { remainder: totalBaseUnits, breakdown: [] };
  }

  // normalize: prefer value_in_base, fallback to value, fallback to 1
  const ms = measurements
    .map(m => ({ ...m, valBase: Number(m?.value_in_base ?? m?.value ?? 1) }))
    .filter(m => !Number.isNaN(m.valBase) && m.valBase > 0);

  // sort descending by valBase (largest measurement first)
  ms.sort((a, b) => b.valBase - a.valBase);

  let remaining = Number(totalBaseUnits);
  const breakdown: Array<{ id: number; count: number; name: string; perBase: number }> = [];

  for (const m of ms) {
    if (remaining <= 0) {
      breakdown.push({ id: m.id, count: 0, name: m.uom?.name ?? m.unit_name ?? `m${m.id}`, perBase: m.valBase });
      continue;
    }
    const count = Math.floor(remaining / m.valBase); // integer greedy
    breakdown.push({ id: m.id, count, name: m.uom?.name ?? m.unit_name ?? `m${m.id}`, perBase: m.valBase });
    remaining = remaining - count * m.valBase;
  }

  return { remainder: remaining, breakdown };
}


// ----------------- START: UOM loader helper -----------------
let _uomCache: Record<number,string> | null = null;

/**
 * loadUoms(apiBase, fetchOpts)
 * - meng-cache hasilnya di _uomCache agar tidak panggil berulang
 * - fetchOpts bisa berupa RequestInit (mis. getFetchOptions())
 */
async function loadUoms(apiBase: string, fetchOpts?: RequestInit) {
  try {
    if (_uomCache && Object.keys(_uomCache).length > 0) return _uomCache;
    const url = `${apiBase.replace(/\/$/,"")}/api/uoms`;
    const res = await fetch(url, fetchOpts || {});
    if (!res.ok) {
      // jika endpoint tidak ada, return empty object (fallback)
      console.warn("loadUoms: non-ok response", res.status);
      _uomCache = {};
      return _uomCache;
    }
    const json = await res.json();
    const rows = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
    const map: Record<number,string> = {};
    for (const r of rows) {
      const id = Number(r.id);
      map[id] = r.name ?? r.label ?? String(r.id);
    }
    _uomCache = map;
    return _uomCache;
  } catch (err) {
    console.warn("loadUoms failed", err);
    _uomCache = _uomCache ?? {};
    return _uomCache;
  }
}
// ----------------- END: UOM loader helper -----------------


export default function CentralInventoryPage(): JSX.Element {
  const { user } = useContext(AuthContext);
  const { centralId: paramCentralId } = useParams();
  const navigate = useNavigate();

  const centralIdRaw = paramCentralId ?? user?.store_id ?? user?.centralId ?? user?.central_id ?? import.meta.env.VITE_DEFAULT_CENTRAL_ID ?? 0;
  const centralId = Number.isNaN(Number(centralIdRaw)) ? 0 : Number(centralIdRaw);

  const [central, setCentral] = useState<any | null>(null);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<InventoryItem[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef(0);

  const [filterMode, setFilterMode] = useState<"all" | "production" | "non-production">("all");

  // modal & search state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState<any | null>(null);

  // helper convert measurements -> enriched measurements with uomName & perBase
  // helper convert measurements -> enriched measurements with uomName & perBase
  function enrichMeasurements(rawMeasurements = [], uomMap: Record<number,string> = {}) {
    return (rawMeasurements || []).map((m:any) => {
      const id = Number(m.id);
      const uomId = Number(m.uom_id ?? m.uom?.id ?? 0);
      const uomName = m.uom?.name ?? uomMap[uomId] ?? (uomId ? `uom:${uomId}` : null);
      const perBase = Number(m.value_in_base ?? m.value_in_grams ?? m.value ?? 1);
      return { ...m, id, uom_id: uomId, uomName, perBase, raw: m };
    });
  }


  // existing breakdown helper (greedy) — gunakan perBase from enriched measurement
  function breakdownMeasurementsGreedy(totalBaseUnits:number, measurements?:any[]) {
    if (!measurements || !measurements.length) return { remainder: totalBaseUnits, breakdown: [] };
    const ms = measurements
      .map(m => ({ ...m, valBase: Number(m.perBase ?? m.value ?? 1) }))
      .filter(m => !Number.isNaN(m.valBase) && m.valBase > 0)
      .sort((a,b) => b.valBase - a.valBase);

    let remaining = Number(totalBaseUnits);
    const breakdown = [];
    for (const m of ms) {
      const count = remaining <= 0 ? 0 : Math.floor(remaining / m.valBase);
      breakdown.push({ id: m.id, count, name: m.uomName ?? (m.uomName ? m.uomName : `m${m.id}`), perBase: m.valBase, measurement: m });
      remaining -= count * m.valBase;
    }
    return { remainder: remaining, breakdown };
  }

  const getFetchOptions = useCallback((opts?: { method?: string; body?: any }) => {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts?.body) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return {
      method: opts?.method ?? "GET",
      headers,
      credentials: token ? "omit" : "include",
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    } as RequestInit;
  }, []);

  const markDirtyIfChanged = useCallback((next: InventoryItem[]) => {
    try {
      const s = JSON.stringify(initialSnapshot || []);
      const n = JSON.stringify(next || []);
      setDirty(s !== n);
    } catch { setDirty(true); }
  }, [initialSnapshot]);

  const fetchCentralById = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/central/${id}`, getFetchOptions());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const c = json?.data ?? json;
      setCentral(c ? { id: c.id, name: c.name ?? `Central ${c.id}`, address: c.address } : { id });
    } catch (err: any) {
      console.error("fetchCentralById error", err);
      setCentral(null);
    }
  }, [getFetchOptions]);

    // cache uom map in state (load once)
    const [uomMapState, setUomMapState] = useState<Record<number,string> | null>(null);
    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const map = await loadUoms(API_BASE, getFetchOptions());
          if (mounted) setUomMapState(map || {});
        } catch (e) {
          if (mounted) setUomMapState({});
          console.warn("loadUoms failed", e);
        }
      })();
      return () => { mounted = false; };
    // getFetchOptions is stable via useCallback, safe to include
    }, [getFetchOptions]);

  const fetchInventory = useCallback(async (id: number | string | null) => {
    setLoading(true);
    setError(null);
    if (!id) {
      setAllInventory([]);
      setInventory([]);
      setInitialSnapshot(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/central/${id}/items`, getFetchOptions());
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json();
      let items: any[] = [];
      if (Array.isArray(json)) items = json;
      else if (Array.isArray(json.data)) items = json.data;
      else if (Array.isArray(json.items)) items = json.items;
      else items = [];

      // load uom map here (inside async)
    // prefer previously-loaded uom map from state; if not ready, load now
let uomMap = uomMapState ?? null;
if (!uomMap || Object.keys(uomMap).length === 0) {
  try {
    uomMap = await loadUoms(API_BASE, getFetchOptions());
    // update state so future fetches reuse it
    setUomMapState(uomMap || {});
  } catch (e) {
    uomMap = {};
    console.warn("fallback loadUoms failed", e);
  }
}


    const mapped = (items || []).map((r) => {
      const rawQty = r.quantity ?? r.qty ?? r.stock ?? 0;
      const itemRel = r.item ?? r.Item ?? null;
      const uomName = itemRel?.uom?.name ?? itemRel?.uom_name ?? null;
      const isProd = (itemRel && (itemRel.is_production === 1 || itemRel.is_production === true)) || r.is_production === 1 || r.is_production === true;

      // measurements: prefer relation or r.measurements
      const rawMeasurements = itemRel?.measurements ?? r.measurements ?? [];
      const measurements = enrichMeasurements(rawMeasurements, uomMap);

      const qtyBase = Number(rawQty); // assume rawQty is already base units
      const breakdownObj = breakdownMeasurementsGreedy(qtyBase, measurements);

      // build readable breakdown string only with counts > 0
      const breakdownString = (breakdownObj.breakdown || [])
        .filter(b => Number(b.count) > 0)
        .map(b => {
          const label = b.name ?? (b.measurement?.uomName ?? `m${b.id}`);
          return `${b.count} ${label}`;
        })
        .join(" • ");

      return {
    id: r.id ?? (itemRel ? `item-${itemRel.id}` : null),
    item_id: r.item_id ?? (itemRel ? itemRel.id : null),
    product_name: (r.product_name ?? itemRel?.name ?? r.item_name ?? `Item #${r.item_id ?? r.id}`),
    product_code: itemRel?.code ?? r.product_code ?? null,
    qty: Number(qtyBase),
    unit: r.unit ?? uomName ?? null,
    min_stock: Number(r.min_stock ?? itemRel?.min_stock ?? 0),
    note: r.note ?? null,
    createdAt: r.createdAt ?? r.created_at ?? null,
    updatedAt: r.updatedAt ?? r.updated_at ?? null,
    is_production: isProd,
    measurements,
    breakdown: breakdownObj,
    breakdownString,
    raw: r
  };
});

      // setelah const mapped = ...
      console.log("DEBUG: fetched central items count:", mapped.length);
      console.table(mapped.map(it => ({
        id: it.id,
        item_id: it.item_id,
        name: it.product_name,
        qty: it.qty,
        measurements_count: Array.isArray(it.measurements) ? it.measurements.length : 0,
        measurements_sample: Array.isArray(it.measurements) ? it.measurements.slice(0,2) : []
      })));


      setAllInventory(mapped);
      // setelah setAllInventory(mapped);
      console.debug("DEBUG: fetched central items count:", mapped.length);
      mapped.forEach(m => {
        console.debug("DBG item:", { id: m.item_id ?? m.id, name: m.product_name, qty: m.qty, measurements_count: (m.measurements||[]).length, measurements_sample: (m.measurements||[]).slice(0,2) });
      });

      const shown = applyFilter(mapped, filterMode);
      setInventory(shown);
      setInitialSnapshot(clone(mapped));
      setDirty(false);
      keyRef.current += 1;
    } catch (err: any) {
      console.error("fetchInventory error:", err);
      setError(err?.message || "Gagal memuat inventory");
      setAllInventory([]);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, [getFetchOptions, applyFilter, filterMode]);


  useEffect(() => {
    fetchCentralById(centralId);
    fetchInventory(centralId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centralId]);

  useEffect(() => {
    setInventory(applyFilter(allInventory, filterMode));
  }, [allInventory, filterMode, applyFilter]);

  function applyFilter(list: InventoryItem[], mode: "all" | "production" | "non-production") {
    if (!list) return [];
    if (mode === "all") return list;
    if (mode === "production") return list.filter(it => it.is_production === true);
    return list.filter(it => !it.is_production);
  }

  const handleDeleteItem = useCallback((id: any) => {
    const nextAll = allInventory.filter(it => String(it.id) !== String(id));
    setAllInventory(nextAll);
    setInventory(applyFilter(nextAll, filterMode));
    markDirtyIfChanged(nextAll);
  }, [allInventory, markDirtyIfChanged, filterMode]);

  // transfer modal open
  const openTransferModal = (row: any) => {
    setSelectedItemForTransfer(row);
    setShowTransferModal(true);
  };

  // counts
  const totalCount = allInventory.length;
  const productionCount = allInventory.filter(it => it.is_production === true).length;
  const nonProductionCount = allInventory.filter(it => !it.is_production).length;

  return (
    <>
      <PageMeta title={`Inventory - Central ${central ? central.name ?? central.id : centralId}`} description={`Inventory Central`} />
      <PageBreadcrumb pageTitle={`Inventory Central`} />

      <div className="space-y-6">
        <ComponentCard title={""}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Show:</label>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as "all" | "production" | "non-production")}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="all">All ({totalCount})</option>
                  <option value="production">Production ({productionCount})</option>
                  <option value="non-production">Non-Production ({nonProductionCount})</option>
                </select>
              </div>

              <button
                className="px-3 py-1 bg-gray-100 rounded"
                onClick={() => { fetchCentralById(centralId); fetchInventory(centralId); }}
                disabled={loading}
              >
                Refresh
              </button>

              <button
                className="px-3 py-1 bg-green-600 text-white rounded"
                onClick={() => setShowAddModal(true)}
                disabled={loading}
              >
                Add Item
              </button>
            </div>
          </div>

          {showAddModal && (
            <AddCentralModal
              open={showAddModal}
              onClose={() => setShowAddModal(false)}
              centralId={centralId}
              apiBase={API_BASE}
              fetchJson={async (url: string, opts?: RequestInit) => {
                const base = API_BASE.replace(/\/$/, "");
                let finalUrl = String(url || "");
                if (/^\/api/i.test(finalUrl) || !/^https?:\/\//i.test(finalUrl)) {
                  finalUrl = `${base}${finalUrl.startsWith("/") ? "" : "/"}${finalUrl}`;
                }
                const merged = { ...(opts || {}), headers: { ...(opts && (opts as any).headers), ...(getFetchOptions().headers) } } as RequestInit;
                const res = await fetch(finalUrl, merged);
                const ct = res.headers.get("content-type") || "";
                if (!res.ok) {
                  const txt = await res.text();
                  throw new Error(txt || `HTTP ${res.status}`);
                }
                return ct.includes("application/json") ? res.json() : res.text();
              }}
              onSaved={() => fetchInventory(centralId)}
            />
          )}

          <div className="border rounded p-3 bg-white">
            {loading ? <div className="text-sm text-gray-500">Loading inventory...</div> :
              error ? <div className="text-sm text-red-600">Error: {error}</div> :
                inventory.length === 0 ? <div className="text-sm text-gray-500">Tidak ada inventory untuk central ini.</div> :
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
  <thead>
    <tr>
      <th className="text-left p-2 w-[45%]">Product</th>
      <th className="text-left p-2 w-[12%]">Qty</th>
      <th className="text-left p-2 w-[18%]">Note</th>
      <th className="text-left p-2 w-[12%]">Type</th>
      <th className="text-left p-2 w-[13%]">Actions</th>
    </tr>
  </thead>
  <tbody>
    {inventory.map(it => (
      <tr key={String(it.id)} className="border-t">
        <td className="p-2 align-top">
          <div className="font-medium truncate max-w-full" title={it.product_name}>{it.product_name}</div>
          {it.product_code && <div className="text-xs text-gray-400 truncate" title={it.product_code}>{it.product_code}</div>}
        </td>

        <td className="p-2 align-top text-left">
          <div className="font-medium">{it.qty}</div>

          {it.breakdownString && it.breakdownString.length > 0 ? (
            <div className="text-xs text-gray-500 mt-1 truncate" style={{ maxWidth: 140 }} title={it.breakdownString}>
              {it.breakdownString}
            </div>
          ) : (
            <div className="text-xs text-gray-500 mt-1 truncate">{it.qty} {it.unit ?? ""}</div>
          )}
        </td>

        <td className="p-2 align-top">
          <div className="text-xs text-gray-700 truncate" style={{ maxWidth: 220 }} title={it.note || ""}>{it.note || "-"}</div>
        </td>

        <td className="p-2 align-top">
          {it.is_production ? (
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">Production</span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800 rounded">Non-Production</span>
          )}
        </td>

        <td className="p-2 align-top">
          <div className="flex gap-1">
            <button className="px-2 py-0.5 text-xs bg-indigo-600 text-white rounded" onClick={() => openTransferModal(it)}>Transfer</button>
            <button className="px-2 py-0.5 text-xs bg-red-500 text-white rounded" onClick={() => handleDeleteItem(it.id)}>Delete</button>
          </div>
        </td>
      </tr>
    ))}
  </tbody>
</table>

                  </div>
            }
          </div>
        </ComponentCard>
      </div>

      <TransferToStoreModal
        open={showTransferModal}
        item={selectedItemForTransfer}
        onClose={() => { setShowTransferModal(false); setSelectedItemForTransfer(null); }}
        onSubmit={async (payload) => {
          if (!centralId || Number.isNaN(centralId) || centralId <= 0) { return; }
          if (!selectedItemForTransfer) { return; }
          const itemId = selectedItemForTransfer.item_id ?? selectedItemForTransfer.Item?.id;
          const body = {
            store_id: payload.storeId,
            item_id: itemId,
            qty: payload.quantity,
            measurement_id: payload.measurementId ?? null,
            note: payload.note ?? null,
            reference: payload.reference ?? null
          };

          // optimistic update: reduce central stock locally (converted not applied here)
          const converted = Number(payload.quantity || 0);
          const delta = -converted;
          const oldRow = allInventory.find(it => (it.item_id ?? it.id) === itemId);
          const oldStock = Number(oldRow?.qty ?? oldRow?.stock ?? 0);
          const newStock = oldStock + delta;
          setAllInventory(prev => prev.map(it => ((it.item_id ?? it.id) === itemId ? { ...it, qty: newStock } : it)));
          setInventory(prev => prev.map(it => ((it.item_id ?? it.id) === itemId ? { ...it, qty: newStock } : it)));

          try {
            const res = await fetch(`${API_BASE}/api/central/${centralId}/transfer-to-store`, getFetchOptions({ method: "POST", body }));
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setShowTransferModal(false);
            setSelectedItemForTransfer(null);
            setTimeout(() => fetchInventory(centralId), 300);
          } catch (err) {
            console.error("transfer failed", err);
            setTimeout(() => fetchInventory(centralId), 300);
            throw err;
          }
        }}
      />
    </>
  );
}
