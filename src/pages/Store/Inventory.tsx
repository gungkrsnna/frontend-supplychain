// src/pages/inventory/InventoryStore.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import { useNavigate } from "react-router-dom";

type Store = {
  id: number | string;
  name?: string | null;
  branch_code?: string | null;
  address?: string | null;
};

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
  is_production?: boolean | null; // new
};

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

function clone<T>(v: T) {
  return JSON.parse(JSON.stringify(v)) as T;
}

export default function InventoryStore(): JSX.Element {
  const [store, setStore] = useState<Store | null>(null);
  const [storeId, setStoreId] = useState<string | number | null>(null);

  // store all inventory raw (unfiltered) and filtered inventory for UI
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [initialSnapshot, setInitialSnapshot] = useState<InventoryItem[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef(0);
  const navigate = useNavigate();

  // filter: "all" | "production" | "non-production"
  const [filterMode, setFilterMode] = useState<"all" | "production" | "non-production">("all");

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

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ItemModelType[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  type ItemModelType = {
    id: number;
    code?: string;
    name: string;
    uom?: { id: number; name: string } | null;
    is_production?: boolean | number | null;
  };

  const handleSearchItems = useCallback(async (term: string) => {
    setSearchTerm(term);
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/items?search=${encodeURIComponent(term)}`, getFetchOptions());
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      setSearchResults(data?.data ?? data ?? []);
    } catch (err: any) {
      console.error("search items error", err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [getFetchOptions]);

  const generateTmpId = useCallback(() => `tmp-${Date.now()}-${Math.floor(Math.random()*1000)}`, []);
  
  const markDirtyIfChanged = useCallback((next: InventoryItem[]) => {
    try {
      const s = JSON.stringify(initialSnapshot || []);
      const n = JSON.stringify(next || []);
      setDirty(s !== n);
    } catch { setDirty(true); }
  }, [initialSnapshot]);

  const handleSelectItem = useCallback((item: ItemModelType) => {
    const newItem: InventoryItem = {
      id: generateTmpId(),
      item_id: item.id,
      product_name: item.name,
      product_code: item.code ?? null,
      qty: 0,
      unit: item.uom?.name ?? null,
      min_stock: 0,
      note: "",
      is_production: item.is_production === 1 || item.is_production === true ? true : false,
    };
    const nextAll = [newItem, ...allInventory];
    setAllInventory(nextAll);
    // apply current filter mode to new list
    const shown = applyFilter(nextAll, filterMode);
    setInventory(shown);
    setShowAddModal(false);
    markDirtyIfChanged(nextAll);
  }, [generateTmpId, markDirtyIfChanged, allInventory, filterMode]);

  const resolveUserStoreId = useCallback(async (): Promise<string | number | null> => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        try {
          const u = JSON.parse(raw);
          const sid = u?.store_id ?? u?.storeId ?? u?.data?.store_id ?? u?.user?.store_id;
          if (sid) return sid;
        } catch {}
      }

      const token = localStorage.getItem("token");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          if (payload?.store_id) return payload.store_id;
        } catch {}
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${token}` }});
          if (res.ok) {
            const j = await res.json();
            return j?.data?.store_id ?? j?.store_id ?? j?.storeId ?? null;
          }
        } catch {}
      }

      try {
        const res2 = await fetch(`${API_BASE}/api/auth/me`, { method: "GET", credentials: "include", headers: { Accept: "application/json" }});
        if (res2.ok) {
          const j = await res2.json();
          return j?.data?.store_id ?? j?.store_id ?? j?.storeId ?? null;
        }
      } catch (e) {
        console.warn("resolveUserStoreId final fetch failed", e);
      }

      return null;
    } catch (err) {
      console.error("resolveUserStoreId error:", err);
      return null;
    }
  }, []);

  const fetchStoreById = useCallback(async (id: string | number) => {
    try {
      const res = await fetch(`${API_BASE}/api/store/${id}`, getFetchOptions());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const s = json?.data ?? json;
      setStore(s ? { id: s.id, name: s.name ?? s.store_name ?? `Store ${s.id}`, branch_code: s.branch_code, address: s.address } : { id, name: `Store ${id}` });
    } catch (err: any) {
      console.error("fetchStoreById error:", err);
      setError(err?.message || "Gagal memuat data store");
      setStore(null);
    }
  }, [getFetchOptions]);

  // helper to apply current filter mode to a list
  const applyFilter = (list: InventoryItem[], mode: "all" | "production" | "non-production") => {
    if (!list) return [];
    if (mode === "all") return list;
    if (mode === "production") return list.filter(it => it.is_production === true);
    return list.filter(it => !it.is_production);
  };

  const fetchInventory = useCallback(async (id: string | number | null) => {
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
      const res = await fetch(`${API_BASE}/api/store/${id}/inventory`, getFetchOptions());
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const json = await res.json();
      // Normalize result into array of items
      let items: any[] = [];
      if (Array.isArray(json)) items = json;
      else if (Array.isArray(json.data)) items = json.data;
      else if (Array.isArray(json.data?.items)) items = json.data.items;
      else if (Array.isArray(json.items)) items = json.items;
      else if (json?.data && Array.isArray(json.data.rows)) items = json.data.rows;
      else items = [];

      const mapped = (items || []).map((r) => {
        const rawQty = r.quantity ?? r.qty ?? 0;
        const itemRel = r.item ?? r.Item ?? null;
        const uomName = itemRel?.uom?.name ?? itemRel?.uom_name ?? null;

        // determine is_production from itemRel or r.is_production
        const isProd =
          (itemRel && (itemRel.is_production === 1 || itemRel.is_production === true)) ||
          r.is_production === 1 ||
          r.is_production === true
            ? true
            : false;

        return {
          id: r.id ?? (itemRel ? `item-${itemRel.id}` : null),
          item_id: r.item_id ?? (itemRel ? itemRel.id : null),
          product_name: (r.product_name ?? itemRel?.name ?? r.item_name ?? `Item #${r.item_id ?? r.id}`) as string,
          product_code: itemRel?.code ?? r.product_code ?? null,
          qty: Number(rawQty),
          unit: r.unit ?? uomName ?? null,
          min_stock: Number(r.min_stock ?? itemRel?.min_stock ?? 0),
          note: r.note ?? null,
          createdAt: r.createdAt ?? r.created_at ?? null,
          updatedAt: r.updatedAt ?? r.updated_at ?? null,
          is_production: isProd,
        } as InventoryItem;
      });

      // save full list and visible list according to filter
      setAllInventory(mapped);
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
  }, [getFetchOptions, filterMode]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const sid = await resolveUserStoreId();
      if (!mounted) return;
      if (!sid) {
        setStoreId(null);
        setAllInventory([]);
        setInventory([]);
        setError("Akun Anda tidak terikat ke store mana pun. Hubungi admin.");
        return;
      }
      setStoreId(sid);
      await fetchStoreById(sid);
      await fetchInventory(sid);
    })();
    return () => { mounted = false; };
  }, [resolveUserStoreId, fetchStoreById, fetchInventory]);

  // whenever filterMode changes, update visible inventory from allInventory
  useEffect(() => {
    setInventory(applyFilter(allInventory, filterMode));
  }, [allInventory, filterMode]);

  // --- Handlers (simple, local state only) ---
  const handleAddItem = useCallback(() => {
    const tmpId = generateTmpId();
    const newItem: InventoryItem = {
      id: tmpId,
      item_id: null,
      product_name: "",
      product_code: null,
      qty: 0,
      unit: null,
      min_stock: 0,
      note: null,
      is_production: false,
    };
    const nextAll = [newItem, ...allInventory];
    setAllInventory(nextAll);
    setInventory(applyFilter(nextAll, filterMode));
    setEditing(true);
    markDirtyIfChanged(nextAll);
  }, [generateTmpId, allInventory, markDirtyIfChanged, filterMode]);

  const handleChangeItem = useCallback((id: any, field: keyof InventoryItem, value: any) => {
    const nextAll = allInventory.map(it => (String(it.id) === String(id) ? { ...it, [field]: value } : it));
    setAllInventory(nextAll);
    setInventory(applyFilter(nextAll, filterMode));
    markDirtyIfChanged(nextAll);
  }, [allInventory, markDirtyIfChanged, filterMode]);

  const handleDeleteItem = useCallback((id: any) => {
    const nextAll = allInventory.filter(it => String(it.id) !== String(id));
    setAllInventory(nextAll);
    setInventory(applyFilter(nextAll, filterMode));
    markDirtyIfChanged(nextAll);
  }, [allInventory, markDirtyIfChanged, filterMode]);

  const validateInventory = useCallback((data: InventoryItem[]) => {
    // basic validation: product_name non-empty and qty >= 0
    for (const it of data) {
      if (!it.product_name || String(it.product_name).trim() === "") {
        return { ok: false, message: "Nama produk tidak boleh kosong" };
      }
      if (it.qty == null || Number(isNaN(Number(it.qty)))) {
        return { ok: false, message: "Qty harus angka" };
      }
    }
    return { ok: true };
  }, []);

  const handleSave = useCallback(async () => {
    const validation = validateInventory(allInventory);
    if (!validation.ok) {
      setError(validation.message || "Validasi gagal");
      return;
    }
    try {
      setSaving(true);
      setError(null);

      // <-- persist to backend if needed
      // Example:
      // await fetch(`${API_BASE}/api/store/${storeId}/inventory/bulk`, getFetchOptions({ method: "POST", body: allInventory }));

      setInitialSnapshot(clone(allInventory));
      setDirty(false);
      setEditing(false);
    } catch (err: any) {
      console.error("handleSave error:", err);
      setError(err?.message || "Gagal menyimpan inventory");
    } finally {
      setSaving(false);
    }
  }, [allInventory, validateInventory, storeId, getFetchOptions]);

  const handleCancel = useCallback(() => {
    // reset to snapshot (snapshot stores full list)
    setAllInventory(initialSnapshot ? clone(initialSnapshot) : []);
    setInventory(initialSnapshot ? applyFilter(clone(initialSnapshot), filterMode) : []);
    setEditing(false);
    setDirty(false);
    setError(null);
  }, [initialSnapshot, filterMode]);

  // render
  // compute counts for UI helper
  const totalCount = allInventory.length;
  const productionCount = allInventory.filter(it => it.is_production === true).length;
  const nonProductionCount = allInventory.filter(it => !it.is_production).length;

  return (
    <>
      <PageMeta title="Inventory - Roti Goolung" description="Inventory untuk store Anda" />
      <PageBreadcrumb pageTitle="Inventory" />
      <div className="space-y-6">
        <ComponentCard title={store ? `${store.name} ${store.branch_code ? `(${store.branch_code})` : ""}` : "Inventory"}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              {store ? (
                <div className="text-sm text-gray-600">
                  <div><strong>{store.name}</strong></div>
                  {store.address && <div className="text-xs text-gray-500">{store.address}</div>}
                </div>
              ) : (
                <div className="text-sm text-red-600">{error ?? "Loading store..."}</div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Filter dropdown */}
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
                onClick={() => { if (storeId) { fetchStoreById(storeId); fetchInventory(storeId); }}}
                disabled={!storeId || loading}
              >
                Refresh
              </button>
              <button
                className="px-3 py-1 bg-green-600 text-white rounded"
                onClick={() => setShowAddModal(true)}
                disabled={!storeId || loading}
              >
                Add Item
              </button>
            </div>
          </div>

          {showAddModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded shadow-lg w-96 max-w-full p-4">
                <h2 className="text-lg font-semibold mb-2">Add Item</h2>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchItems(e.target.value)}
                  placeholder="Search item..."
                  className="w-full border rounded px-2 py-1 mb-2"
                />
                {searchLoading ? (
                  <div className="text-sm text-gray-500">Loading...</div>
                ) : searchResults.length === 0 ? (
                  <div className="text-sm text-gray-500">No items found</div>
                ) : (
                  <ul className="max-h-60 overflow-y-auto">
                    {searchResults.map(item => (
                      <li
                        key={item.id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleSelectItem(item)}
                      >
                        {item.name} {item.code && <span className="text-xs text-gray-400">({item.code})</span>}
                        {item.uom?.name && <span className="text-xs text-gray-500 ml-2">{item.uom.name}</span>}
                        {item.is_production !== undefined && (
                          <span className="text-xs text-gray-400 ml-3">[{item.is_production ? "Prod" : "Non-Prod"}]</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 text-right">
                  <button className="px-3 py-1 bg-gray-300 rounded" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="border rounded p-3 bg-white">
            {loading ? <div className="text-sm text-gray-500">Loading inventory...</div> :
             error ? <div className="text-sm text-red-600">Error: {error}</div> :
             inventory.length === 0 ? <div className="text-sm text-gray-500">Tidak ada inventory untuk store ini.</div> :
             <div className="overflow-x-auto">
               <table className="w-full text-sm">
                 <thead>
                   <tr>
                     <th className="text-left p-2">Product</th>
                     <th className="text-left p-2">Qty</th>
                     <th className="text-left p-2">Unit</th>
                     <th className="text-left p-2">Min Stock</th>
                     <th className="text-left p-2">Note</th>
                     <th className="text-left p-2">Type</th>
                     <th className="text-left p-2">Actions</th>
                   </tr>
                 </thead>
                 <tbody>
                   {inventory.map(it => (
                     <tr key={String(it.id)} className="border-t">
                       <td className="p-2 align-top w-1/3">
                         {editing ? (
                           <input
                             type="text"
                             value={it.product_name ?? ""}
                             onChange={(e) => handleChangeItem(it.id, "product_name", e.target.value)}
                             placeholder="Nama produk"
                             className="w-full border rounded px-2 py-1"
                           />
                         ) : (
                           <>
                             <div className="font-medium">{it.product_name}</div>
                             {it.product_code && <div className="text-xs text-gray-400">{it.product_code}</div>}
                           </>
                         )}
                       </td>

                       <td className="p-2 align-top w-24">
                         {editing ? (
                           <input
                             type="number"
                             value={it.qty ?? 0}
                             onChange={(e) => handleChangeItem(it.id, "qty", Number(e.target.value))}
                             className="w-full border rounded px-2 py-1"
                           />
                         ) : (
                           <div>{it.qty}</div>
                         )}
                       </td>

                       <td className="p-2 align-top w-24">
                         {editing ? (
                           <input
                             type="text"
                             value={it.unit ?? ""}
                             onChange={(e) => handleChangeItem(it.id, "unit", e.target.value)}
                             className="w-full border rounded px-2 py-1"
                           />
                         ) : (
                           <div>{it.unit || "-"}</div>
                         )}
                       </td>

                       <td className="p-2 align-top w-24">{it.min_stock ?? "-"}</td>
                       <td className="p-2 align-top">{editing ? (
                         <input
                           type="text"
                           value={it.note ?? ""}
                           onChange={(e) => handleChangeItem(it.id, "note", e.target.value)}
                           className="w-full border rounded px-2 py-1"
                         />
                       ) : (
                         <div>{it.note || "-"}</div>
                       )}</td>

                       <td className="p-2 align-top w-36">
                         {it.is_production ? (
                           <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded">Production</span>
                         ) : (
                           <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800 rounded">Non-Production</span>
                         )}
                       </td>

                       <td className="p-2 align-top">
                         <div className="flex gap-2">
                           {editing ? (
                             <>
                               <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={handleSave} disabled={saving}>Save</button>
                               <button className="px-2 py-1 bg-gray-200 rounded" onClick={handleCancel} disabled={saving}>Cancel</button>
                             </>
                           ) : (
                             <>
                               <button className="px-2 py-1 bg-yellow-400 rounded" onClick={() => { setEditing(true); }}>Edit</button>
                               <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => handleDeleteItem(it.id)}>Delete</button>
                             </>
                           )}
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
    </>
  );
}
