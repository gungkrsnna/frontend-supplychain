// src/pages/TargetProductionNextDay.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";

type Store = { id: number; name: string; [k: string]: any };
type Product = { id: number; item_id?: number; name: string; sku?: string; unit?: string; inventory_qty?: number; is_production?: boolean; [k: string]: any };
type ProductionOrder = {
  id?: number;
  store_id: number;
  product_id: number; // this is the frontend's product id (we also keep item_id on Product)
  date: string;
  qty: number;
  [k: string]: any;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

function formatDateISO(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function getTomorrowDate() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return t;
}

/** detect brand from email domain */
function detectBrandFromEmail(email: string | undefined | null): string | null {
  if (!email) return null;
  const domain = String(email).split("@")[1]?.toLowerCase() || "";
  if (domain.includes("99creations.com")) return "99 Creations";
  if (domain.includes("rotigoolung.com")) return "Roti Goolung";
  if (domain.includes("panina.com")) return "Panina";
  return null;
}

const BRAND_STORE_KEYWORDS: Record<string, string[]> = {
  "99 Creations": ["99 Creations"],
  "Roti Goolung": ["Roti Goolung"],
  "Panina": ["Panina"],
};

export default function TargetProductionPlan(): JSX.Element {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userBrand, setUserBrand] = useState<string | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | "">("");
  const [loadingStores, setLoadingStores] = useState(false);
  const [errorStores, setErrorStores] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [errorProducts, setErrorProducts] = useState<string | null>(null);

  const [date, setDate] = useState<string>(formatDateISO(getTomorrowDate()));
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [errorOrders, setErrorOrders] = useState<string | null>(null);
  const [isAlreadyCreated, setIsAlreadyCreated] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  


  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({}); // key `${storeId}_${productId}`
  const [saving, setSaving] = useState(false);

  // NEW: inventory map per store+product
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({}); // key `${storeId}_${productId}` -> qty

  // NEW: target per store (global), default 100
  const [targetPerStore, setTargetPerStore] = useState<number>(100);

  // current user id (read once from localStorage)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const user = JSON.parse(raw);
      const email = user?.email ?? null;
      setUserEmail(email);
      setUserBrand(detectBrandFromEmail(email));
      const uid = Number(user?.id ?? null);
      setCurrentUserId(!Number.isNaN(uid) ? uid : null);
    } catch {
      // ignore
    }
  }, []);

  // fetch stores
  const fetchStores = useCallback(async () => {
    setLoadingStores(true);
    setErrorStores(null);
    try {
      const res = await fetch(`${API_BASE}/api/store`);
      if (!res.ok) throw new Error(`Failed to load stores (${res.status})`);
      const json = await res.json();
      const data = Array.isArray(json?.data) ? json.data : json;
      setStores(data || []);
    } catch (err: any) {
      setErrorStores(err.message || "Failed to load stores");
    } finally {
      setLoadingStores(false);
    }
  }, []);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const storesForSelectedBrand = useMemo(() => {
    if (!selectedBrand || selectedBrand === "__ALL__") return stores;
    const keywords = BRAND_STORE_KEYWORDS[selectedBrand] ?? [];
    return stores.filter(s => keywords.some(k => String(s.name ?? "").toLowerCase().includes(k.toLowerCase())));
  }, [stores, selectedBrand]);

  // fetch inventories for all stores in brand (parallel), build:
  // - union product list (unique ids)
  // - inventoryMap (per store+product)
  const fetchInventoriesForBrand = useCallback(async (storesList: Store[]) => {
    if (!storesList || storesList.length === 0) {
      setProducts([]); setOrders([]); setInventoryMap({}); return;
    }
    setLoadingProducts(true);
    setErrorProducts(null);
    setLoadingOrders(true);
    setErrorOrders(null);

    try {
      const calls = storesList.map(s => fetch(`${API_BASE}/api/store/${s.id}/inventory?in_production=true`)
        .then(async r => {
          if (!r.ok) return [];
          const j = await r.json();
          return Array.isArray(j?.data) ? j.data : j;
        })
        .catch(() => []));
      const results = await Promise.all(calls);

      // build inventoryMap and product union
      const invMap: Record<string, number> = {};
      const productSet = new Map<number, Product>();

      results.forEach((arr, idx) => {
        const sid = storesList[idx].id;
        (arr || []).forEach((it: any) => {
          // use item.id as canonical id when available (items table)
          const pid = Number(it.item?.id ?? it.product?.id ?? it.product_id ?? it.item_id ?? it.id);
          if (!pid) return;
          const qty = Number(it.quantity ?? it.qty ?? it.inventory_qty ?? 0);
          invMap[`${sid}_${pid}`] = qty;
          if (!productSet.has(pid)) {
            const name = it.item?.name ?? it.product?.name ?? it.name ?? `Item ${pid}`;
            const sku = it.item?.code ?? it.product?.sku ?? it.sku;
            const unit = it.item?.uom?.name ?? it.product?.unit ?? it.unit;
            // store item_id explicitly so we can send correct field when POST
            productSet.set(pid, { id: pid, item_id: pid, name, sku, unit });
          }
        });
      });

      const prods = Array.from(productSet.values());
      setProducts(prods);
      setInventoryMap(invMap);
    } catch (err: any) {
      console.warn("fetchInventoriesForBrand failed", err);
      setErrorProducts(err.message || "Failed to load inventories");
      setProducts([]);
      setInventoryMap({});
    } finally {
      setLoadingProducts(false);
      setLoadingOrders(false);
    }
  }, []);

  // fetch orders for all stores in brand (parallel)
  const fetchOrdersForBrand = useCallback(async (storesList: Store[], dateStr: string) => {
    if (!storesList || storesList.length === 0) { 
      setOrders([]); 
      setDirtyMap({}); 
      setIsViewOnly(false);
      return; 
    }

    setLoadingOrders(true);
    setErrorOrders(null);
    try {
      const calls = storesList.map(s => fetch(`${API_BASE}/api/production-orders?storeId=${s.id}&date=${encodeURIComponent(dateStr)}`)
        .then(async r => {
          if (!r.ok) return [];
          const j = await r.json();
          return Array.isArray(j?.data) ? j.data : j;
        }).catch(()=>[]));
      const results = await Promise.all(calls);

      const all: ProductionOrder[] = [];
      results.forEach((arr, idx) => {
        const sid = storesList[idx].id;
        (arr || []).forEach((o: any) => {
          all.push({
            ...o,
            store_id: Number(o.store_id ?? sid),
            product_id: Number(o.product_id ?? o.item_id ?? o.item?.id ?? o.product_id),
            qty: Number(o.qty ?? o.quantity ?? 0)
          });
        });
      });

      setOrders(all);
      setDirtyMap({});

      // ✅ Cek apakah sudah ada data
      const hasExisting = all.some(o => !!o.id);
      setIsAlreadyCreated(hasExisting);
      setIsViewOnly(hasExisting); // ⛔️ otomatis aktifkan mode view only jika sudah ada data

    } catch (err: any) {
      setErrorOrders(err.message || "Failed to load production orders");
      setOrders([]);
      setIsAlreadyCreated(false);
      setIsViewOnly(false);
    } finally {
      setLoadingOrders(false);
    }
  }, []);


  // combined fetch
  const fetchProductsAndOrdersForBrand = useCallback(async (brandStores: Store[], dateStr: string) => {
    await fetchInventoriesForBrand(brandStores);
    await fetchOrdersForBrand(brandStores, dateStr);
  }, [fetchInventoriesForBrand, fetchOrdersForBrand]);

  // refetch when brand or date changes
  useEffect(() => {
    if (!selectedBrand) {
      setProducts([]); setOrders([]); setInventoryMap({});
      return;
    }
    const brandStores = storesForSelectedBrand;
    fetchProductsAndOrdersForBrand(brandStores, date);
  }, [selectedBrand, storesForSelectedBrand, date, fetchProductsAndOrdersForBrand]);

  // ordersMap keyed by `${storeId}_${productId}`
  const ordersMap = useMemo(() => {
    const m: Record<string, ProductionOrder> = {};
    (orders || []).forEach(o => { m[`${o.store_id}_${o.product_id}`] = o; });
    return m;
  }, [orders]);

  // compute default qty to produce for a cell: max(0, targetPerStore - inventory_qty_of_store_product)
  function computeDefaultQty(storeId: number, productId: number) {
    const inv = inventoryMap[`${storeId}_${productId}`] ?? 0;
    const need = Math.max(0, Math.round(targetPerStore) - Math.round(inv));
    return need;
  }

  // cell change handlers (no notes)
  function handleCellQtyChange(storeId: number, productId: number, value: string) {
    const qty = Number(value || 0);
    const key = `${storeId}_${productId}`;
    setOrders(prev => {
      const existing = prev.find(p => p.store_id === storeId && p.product_id === productId);
      if (existing) {
        return prev.map(p => (p.store_id === storeId && p.product_id === productId) ? { ...p, qty } : p);
      } else {
        return [...prev, { store_id: storeId, product_id: productId, date, qty } as ProductionOrder];
      }
    });
    setDirtyMap(prev => ({ ...prev, [key]: true }));
  }

  // save dirty items (create/update per store+product)
  async function handleSaveAll() {
    const brandStores = storesForSelectedBrand;
    if (!selectedBrand || brandStores.length === 0) {
      alert("Pilih brand yang memiliki cabang.");
      return;
    }
    if (!currentUserId) {
      alert("User tidak terdeteksi (user_id diperlukan). Silakan login ulang.");
      return;
    }

    // 🔑 ambil token sekali di awal
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Token tidak ditemukan. Silakan login ulang.");
      return;
    }

    setSaving(true);
    try {
      const created: any[] = [];
      const updated: any[] = [];

      let keysToProcess = Object.keys(dirtyMap).filter(k => dirtyMap[k]);
      if (keysToProcess.length === 0) {
        const candidates: string[] = [];
        for (const p of products) {
          for (const s of brandStores) {
            const key = `${s.id}_${p.id}`;
            const existing = ordersMap[key];
            const tmp = orders.find(o => o.store_id === s.id && o.product_id === p.id);
            const desiredQty =
              (existing && typeof existing.qty === "number") ? existing.qty :
              (tmp && typeof tmp.qty === "number") ? tmp.qty :
              computeDefaultQty(s.id, p.id);
            if (Number(desiredQty) > 0) candidates.push(key);
          }
        }
        keysToProcess = Array.from(new Set(candidates));
        console.info("Auto keysToProcess (no edits):", keysToProcess);
      }

      for (const key of keysToProcess) {
        const [sidStr, pidStr] = key.split("_");
        const sid = Number(sidStr);
        const pid = Number(pidStr);
        if (Number.isNaN(sid) || Number.isNaN(pid)) continue;

        const existing = ordersMap[key];
        const o = orders.find(x => x.store_id === sid && x.product_id === pid);
        const qty = o ? Number(o.qty ?? 0) : computeDefaultQty(sid, pid);

        const productObj = products.find(pr => pr.id === pid);
        const item_id = Number(productObj?.item_id ?? productObj?.id ?? pid);

        const payload = {
          store_id: sid,
          item_id,
          quantity: qty,
          request_category_id: 1,
          date,
        };

        if (existing && existing.id) {
          // ✅ UPDATE
          const res = await fetch(`${API_BASE}/api/daily-production/${existing.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Update failed for store ${sid} item ${item_id}: ${res.status} ${text}`);
          }
          const json = await res.json();
          updated.push(json?.data ?? json);
        } else {
          // ✅ CREATE
          const res = await fetch(`${API_BASE}/api/daily-production`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            let errBody = text;
            try { const ej = JSON.parse(text); errBody = ej?.message ?? JSON.stringify(ej); } catch (e) {}
            throw new Error(`Create failed for store ${sid} item ${item_id}: ${res.status} ${errBody}`);
          }
          const json = await res.json();
          created.push(json?.data ?? json);
        }
      }

      await fetchOrdersForBrand(brandStores, date);
      setDirtyMap({});
      alert(`Sukses. Created: ${created.length}, Updated: ${updated.length}`);
    } catch (err: any) {
      console.error("SaveAll error:", err);
      alert(err?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }


  function handleRefresh() {
    if (!selectedBrand) return;
    fetchProductsAndOrdersForBrand(storesForSelectedBrand, date);
  }

  // UI (same as before, notes removed)
  return (
    <>
      <PageMeta title="Target Production - Next Day" description="Create production plan for next day" />

      {isAlreadyCreated && (
        <div className="mb-4 p-3 rounded bg-green-100 border border-green-400 text-green-700">
          Target produksi untuk <strong>{selectedBrand}</strong> pada tanggal <strong>{date}</strong> sudah dibuat.
        </div>
      )}


      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Production Plan — Next Day</h1>
          <p className="text-sm text-gray-500">Buat target produksi untuk hari esok per brand (grid per cabang).</p>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs text-gray-600">Brand</label>
            {loadingStores ? (
              <div className="px-3 py-2 border rounded bg-gray-50">Loading...</div>
            ) : errorStores ? (
              <div className="text-sm text-red-600">{errorStores}</div>
            ) : (
              <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="px-3 py-2 border rounded">
                <option value="">-- pilih brand --</option>
                <option value="__ALL__">All Stores</option>
                {Object.keys(BRAND_STORE_KEYWORDS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600">Target per branch</label>
            <input type="number" min={0} value={targetPerStore} onChange={(e)=> setTargetPerStore(Number(e.target.value || 0))} className="px-3 py-2 border rounded w-28" />
          </div>

          <div>
            <label className="block text-xs text-gray-600">Date</label>
            <input type="date" value={date} onChange={(e)=> setDate(e.target.value)} className="px-3 py-2 border rounded" />
          </div>

          <div className="flex items-end gap-2">
            <button onClick={handleRefresh} className="px-3 py-2 bg-gray-100 rounded">Refresh</button>
            <button onClick={handleSaveAll} disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-3">Products — plan for {date}</h2>

        {loadingProducts || loadingOrders ? (
          <div className="py-12 text-center text-gray-500">Loading...</div>
        ) : errorProducts ? (
          <div className="py-6 text-red-600">{errorProducts}</div>
        ) : errorOrders ? (
          <div className="py-6 text-red-600">{errorOrders}</div>
        ) : products.length === 0 ? (
          <div className="py-6 text-gray-600">No products for this brand.</div>
        ) : storesForSelectedBrand.length === 0 ? (
          <div className="py-6 text-gray-600">No stores for this brand.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2 text-xs text-gray-600">No</th>
                  <th className="px-3 py-2 text-xs text-gray-600">Product</th>
                  {storesForSelectedBrand.map(s => <th key={s.id} className="px-3 py-2 text-xs text-gray-600">{s.name}</th>)}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {products.map((p, idx) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{p.name}</td>
                    {storesForSelectedBrand.map(s => {
                      const key = `${s.id}_${p.id}`;
                      const existing = ordersMap[key];
                      const defaultQty = computeDefaultQty(s.id, p.id);
                      const tmp = orders.find(o => o.store_id === s.id && o.product_id === p.id);
                      const value = existing ? existing.qty ?? 0 : (tmp ? tmp.qty ?? 0 : defaultQty);
                      return (
                        <td key={key} className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={value}
                            disabled={!!existing?.id} // ⛔ disable input jika sudah tersimpan
                            onChange={(e) => handleCellQtyChange(s.id, p.id, e.target.value)}
                            className={`px-2 py-1 border rounded w-20 ${
                              existing?.id ? "bg-gray-100 text-gray-400 cursor-not-allowed" :
                              dirtyMap[key] ? "border-yellow-400" : ""
                            }`}
                          />

                          {/* Info kecil di bawah input */}
                          {existing?.id ? (
                            <div className="text-xs text-green-600 mt-1">✔ Saved</div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-1">Inv: {inventoryMap[key] ?? 0}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
