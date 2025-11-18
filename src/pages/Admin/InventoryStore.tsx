// src/pages/Inventory/InventoryStore.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import { useNavigate } from "react-router-dom";

type Store = { id: number | string; name: string; branch_code?: string; address?: string; phone?: string };
type InventoryItem = {
  id: string | number;
  inventory_id?: number;
  item_id?: number | null;
  product_name: string;
  qty: number;
  unit?: string;
  min_stock?: number;
  note?: string;
  is_production?: boolean;
};

const USE_DUMMY = false; // <-- set to false to use API. Set true to keep dummy behavior.

const DUMMY_STORES: Store[] = [
  { id: "SMG", name: "Roti Goolung Panjer", branch_code: "PJR" },
  { id: "DLG", name: "Roti Goolung Dalung", branch_code: "DLG" },
  { id: "TKJ", name: "Roti Goolung Tabanan", branch_code: "TKJ" },
];
const DUMMY_INVENTORY: Record<string, InventoryItem[]> = {
  SMG: [
    { id: "s-001", product_name: "Sabun Cuci Piring", qty: 12, unit: "pcs", min_stock: 3, note: "Untuk kitchen & wash area", is_production: false },
    { id: "s-002", product_name: "Tisu Gulung", qty: 30, unit: "roll", min_stock: 10, note: "Toilet & packing", is_production: false },
  ],
  DLG: [
    { id: "d-001", product_name: "Plastik Sampah (Medium)", qty: 10, unit: "pack", min_stock: 3, note: "", is_production: false },
  ],
  TKJ: [{ id: "t-001", product_name: "Kantong Plastik (kecil)", qty: 50, unit: "pack", min_stock: 10, note: "Untuk packing roti", is_production: false }],
};

function clone<T>(v: T) {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Normalize server row -> InventoryItem
 * Server rows might be:
 *  - { id, product_name, qty, unit, min_stock, note, item_id, ... }
 *  - Or raw SQL result with { id, product_name, quantity, unit, min_stock, note, item_id, ... }
 *  - Or controller wrapper { success: true, data: [...] }
 */
function normalizeServerRow(r: any, uomMap?: Record<number,string>): InventoryItem {
  const id = r.id ?? r.inventory_id ?? r.inventoryId ?? r.inventory_id;
  const qty = Number(r.qty ?? r.quantity ?? 0);
  const min_stock = r.min_stock !== undefined ? Number(r.min_stock) : r.min_stock ?? 0;
  const product_name = r.product_name ?? r.item_name ?? (r.item ? r.item.name : "") ?? "";
  const item_id = r.item_id ?? r.itemId ?? (r.item ? r.item.id : null) ?? null;

  const uomNameFromItem = r.item && r.item.uom ? r.item.uom.name : undefined;
  const uomNameFromUomField = r.uom_name ?? undefined;
  const uomNameFromMap = (uomMap && Number(r.item?.uom_id)) ? uomMap[Number(r.item.uom_id)] : undefined;

  const unit = r.unit ?? r.uom?.name ?? uomNameFromItem ?? uomNameFromUomField ?? uomNameFromMap ?? "";

  // baca is_production dari berbagai tempat (item.is_production atau langsung r.is_production)
  const is_production =
    (r.item && (r.item.is_production === 1 || r.item.is_production === true)) ||
    r.is_production === 1 ||
    r.is_production === true
      ? true
      : false;

  return {
    id: id ?? `inv-${Math.floor(Math.random() * 100000)}`,
    inventory_id: id ? Number(id) : undefined,
    item_id: item_id === null ? null : item_id === undefined ? undefined : Number(item_id),
    product_name,
    qty,
    unit,
    min_stock: Number(min_stock ?? 0),
    note: r.note ?? r.description ?? "",
    is_production,
  };
}

export default function InventoryStore(): JSX.Element {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [initialSnapshot, setInitialSnapshot] = useState<InventoryItem[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProduction, setShowProduction] = useState<boolean>(false); // <-- toggle to show production items
  const navigate = useNavigate();
  const keyRef = useRef(0);
  const [uomMap, setUomMap] = useState<Record<number,string>>({});


  // helpers: normalized fetch wrapper that expects backend format { success: true, data: [] } OR direct array
  const fetchJson = useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, opts);
    const ct = res.headers.get("content-type") || "";
    let body: any = null;
    if (ct.includes("application/json")) body = await res.json();
    else body = await res.text();
    if (!res.ok) {
      // try to read message from json
      const msg = typeof body === "object" && body !== null ? (body.message || body.error || JSON.stringify(body)) : String(body || res.statusText);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  }, []);

  
  const fetchUoms = useCallback(async () => {
    try {
      const body = await fetchJson("/api/uoms"); // backend harus sediakan endpoint ini
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      const map: Record<number,string> = {};
      (rows || []).forEach((u: any) => {
        map[Number(u.id)] = u.name;
      });
      setUomMap(map);
    } catch (err) {
      console.warn("Gagal memuat uoms", err);
    }
  }, [fetchJson]);

  useEffect(() => { fetchUoms(); }, [fetchUoms]);

  const fetchStores = useCallback(async () => {
    setLoadingStores(true);
    setError(null);
    try {
      if (USE_DUMMY) {
        await new Promise((r) => setTimeout(r, 120));
        setStores(DUMMY_STORES);
        if (!selectedStoreId && DUMMY_STORES.length) setSelectedStoreId(DUMMY_STORES[0].id);
      } else {
        // expects { success: true, data: [...] } or raw array
        const body = await fetchJson(`/api/stores`);
        const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
        // normalize small differences: ensure id and name exist
        const normalized = (rows || [])
          .map((r: any) => ({
            id: r.id,
            name: r.name ?? r.title ?? String(r.id),
            branch_code: r.branch_code ?? r.branchCode ?? r.code ?? undefined,
            address: r.address,
            phone: r.phone,
          }))
          // 🔥 Filter: hilangkan store bernama "99 Creations"
          .filter((r) => !String(r.name).toLowerCase().includes("99 creations"));
        setStores(normalized);
        if (!selectedStoreId && normalized.length) setSelectedStoreId(normalized[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Gagal memuat store");
    } finally {
      setLoadingStores(false);
    }
  }, [fetchJson, selectedStoreId]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const fetchInventory = useCallback(
    async (storeId: string | number | null) => {
      if (!storeId) {
        setInventory([]);
        setInitialSnapshot(null);
        return;
      }
      setLoadingInventory(true);
      setError(null);
      try {
        if (USE_DUMMY) {
          await new Promise((r) => setTimeout(r, 120));
          const data = clone(DUMMY_INVENTORY[String(storeId)] ?? []);
          // If using dummy data, we respect showProduction toggle too
          const shown = showProduction ? data : data.filter((it) => !it.is_production);
          setInventory(shown);
          setInitialSnapshot(clone(shown));
          setDirty(false);
          keyRef.current += 1;
        } else {
          // backend endpoint: GET /api/stores/:id/inventory
          const body = await fetchJson(`/api/stores/${storeId}/inventory`);
          const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);

          // 🔍 Log mentah dari server untuk debugging
          console.log("📦 Raw inventory data from server:", rows);

          // Normalisasi data inventory (semua row)
          const allNormalized: InventoryItem[] = (rows || []).map((r: any) => normalizeServerRow(r));

          // Filter berdasarkan is_production jika toggle false
          const shown = showProduction ? allNormalized : allNormalized.filter((it) => !it.is_production);

          // 🔍 Logging ringkas
          const total = allNormalized.length;
          const shownCount = shown.length;
          const hiddenCount = total - shownCount;
          console.log(`🔎 Inventory for store ${storeId} — total: ${total}, shown: ${shownCount}, hidden (production): ${hiddenCount}`);

          setInventory(shown);
          setInitialSnapshot(clone(shown));
          setDirty(false);
          keyRef.current += 1;
        }
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Gagal memuat inventory");
      } finally {
        setLoadingInventory(false);
      }
    },
    [fetchJson, showProduction]
  );

  useEffect(() => {
    fetchInventory(selectedStoreId);
  }, [selectedStoreId, fetchInventory]);

  // helpers
  const markDirtyIfChanged = useCallback(
    (next: InventoryItem[]) => {
      try {
        const s = JSON.stringify(initialSnapshot || []);
        const n = JSON.stringify(next || []);
        setDirty(s !== n);
      } catch {
        setDirty(true);
      }
    },
    [initialSnapshot]
  );

  const generateTmpId = useCallback(() => `tmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`, []);

  // editing handlers
  const handleAddItem = useCallback(() => {
    const newItem: InventoryItem = {
      id: generateTmpId(),
      product_name: "",
      qty: 0,
      unit: "pcs",
      min_stock: 0,
      note: "",
      is_production: false,
    };
    setInventory((prev) => {
      const next = [newItem, ...(prev || [])];
      markDirtyIfChanged(next);
      return next;
    });
    setEditing(true);
  }, [generateTmpId, markDirtyIfChanged]);

  const handleChangeItem = useCallback(
    (id: string | number, field: keyof InventoryItem, value: any) => {
      setInventory((prev) => {
        const next = (prev || []).map((it) => {
          if (it.id !== id) return it;
          const copy = { ...it } as InventoryItem;
          if (field === "qty" || field === "min_stock") {
            const n = Number(value);
            copy[field] = Number.isNaN(n) ? 0 : n;
          } else {
            // @ts-ignore
            copy[field] = value;
          }
          return copy;
        });
        markDirtyIfChanged(next);
        return next;
      });
    },
    [markDirtyIfChanged]
  );

  const handleDeleteItem = useCallback(
    (itemId: string | number) => {
      if (!confirm("Hapus item ini dari inventory?")) return;
      setInventory((prev) => {
        const next = (prev || []).filter((r) => r.id !== itemId);
        markDirtyIfChanged(next);
        return next;
      });
    },
    [markDirtyIfChanged]
  );

  const validateInventory = useCallback((data: InventoryItem[]) => {
    if (!data) return { ok: true };
    for (const row of data) {
      if (!row.product_name || String(row.product_name).trim() === "") {
        return { ok: false, message: "Nama produk tidak boleh kosong." };
      }
      const n = Number(row.qty);
      if (Number.isNaN(n) || n < 0) return { ok: false, message: `Qty tidak valid untuk produk ${row.product_name || "(kosong)"}` };
      const m = Number(row.min_stock ?? 0);
      if (Number.isNaN(m) || m < 0) return { ok: false, message: `Min stock tidak valid untuk produk ${row.product_name || "(kosong)"}` };
    }
    return { ok: true };
  }, []);

  const handleSave = useCallback(
    async (opts?: { keepEditing?: boolean }) => {
      if (!selectedStoreId) {
        alert("Pilih store terlebih dahulu.");
        return;
      }

      const v = validateInventory(inventory || []);
      if (!v.ok) {
        alert(v.message || "Validasi gagal");
        return;
      }

      try {
        setSaving(true);
        if (USE_DUMMY) {
          (DUMMY_INVENTORY as any)[String(selectedStoreId)] = clone(inventory || []);
          setInitialSnapshot(clone(inventory || []));
          markDirtyIfChanged(inventory || []);
          if (!opts?.keepEditing) setEditing(false);
          alert("Inventory (dummy) tersimpan.");
        } else {
          // Prepare payload: backend expects { items: [...] } where each item can have id (existing inventory id) or tmp id
          const payloadItems = (inventory || []).map((it) => {
            return {
              id: (typeof it.inventory_id === "number" && it.inventory_id > 0) ? it.inventory_id : (typeof it.id === "number" ? it.id : it.id),
              item_id: it.item_id ?? null,
              product_name: it.product_name,
              qty: Number(it.qty || 0),
              unit: it.unit ?? null,
              min_stock: it.min_stock ?? null,
              note: it.note ?? null,
            };
          });

          const body = await fetchJson(`/api/stores/${selectedStoreId}/inventory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: payloadItems }),
          });

          // backend may return { success: true, data: [...] } or plain array of inventories
          const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
          // normalize rows to frontend InventoryItem
          const allNormalized = (rows || []).map((r: any) => normalizeServerRow(r));
          const shown = showProduction ? allNormalized : allNormalized.filter((it) => !it.is_production);

          setInventory(shown);
          setInitialSnapshot(clone(shown));
          setEditing(false);
          setDirty(false);
          alert("Inventory tersimpan.");
        }
      } catch (err: any) {
        console.error(err);
        alert("Gagal menyimpan inventory: " + (err?.message ?? "unknown"));
      } finally {
        setSaving(false);
      }
    },
    [inventory, selectedStoreId, validateInventory, fetchJson, markDirtyIfChanged, showProduction]
  );

  const handleCancel = useCallback(() => {
    setInventory(initialSnapshot ? clone(initialSnapshot) : []);
    setDirty(false);
    setEditing(false);
    keyRef.current += 1;
  }, [initialSnapshot]);

  const stockReadyMap = useMemo(() => {
    const map: Record<string | number, { qty: number; min_stock: number }> = {};
    (inventory || []).forEach((it) => {
      map[it.id] = { qty: Number(it.qty ?? 0), min_stock: Number(it.min_stock ?? 0) };
    });
    return map;
  }, [inventory]);

  return (
    <>
      <PageMeta title="Inventory per Store - Roti Goolung" description="Halaman admin inventory per store" />
      <PageBreadcrumb pageTitle="Inventory / Stores" />

      <div className="space-y-6">
        <ComponentCard title="Inventory Stores">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/4 border rounded p-3 bg-white">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">Stores</h4>
                <button
                  className="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                  onClick={() => fetchStores()}
                  title="Refresh stores"
                >
                  Refresh
                </button>
              </div>

              {loadingStores ? (
                <div className="text-sm text-gray-500">Loading stores...</div>
              ) : stores.length === 0 ? (
                <div className="text-sm text-gray-500">No stores found.</div>
              ) : (
                <ul className="space-y-2">
                  {stores.map((s) => (
                    <li key={String(s.id)}>
                      <button
                        className={`w-full text-left p-2 rounded ${s.id === selectedStoreId ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                        onClick={() => setSelectedStoreId(s.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{s.name}</div>
                            {s.branch_code && <div className="text-xs text-gray-400">{s.branch_code}</div>}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="w-full md:w-3/4">
              <div className="mb-3 flex items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-500 mt-1">{selectedStoreId ? `Store ID: ${selectedStoreId}` : "Pilih store untuk melihat inventory"}</div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showProduction}
                      onChange={(e) => setShowProduction(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Tampilkan item produksi</span>
                  </label>

                  <button
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={handleAddItem}
                    title="Tambah item"
                    disabled={!selectedStoreId || loadingInventory}
                  >
                    Add Item
                  </button>

                  {!editing ? (
                    <button
                      className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      onClick={() => setEditing(true)}
                      disabled={!selectedStoreId || loadingInventory || (inventory || []).length === 0}
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button className="px-3 py-1 bg-gray-100 rounded" onClick={handleCancel} disabled={!dirty || saving}>
                        Cancel
                      </button>
                      <button
                        className={`px-3 py-1 rounded text-white ${!dirty ? "bg-yellow-400/60 cursor-not-allowed" : "bg-yellow-500 hover:bg-yellow-600"}`}
                        onClick={() => handleSave()}
                        disabled={!dirty || saving}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="border rounded p-3 bg-white">
                {loadingInventory ? (
                  <div className="text-sm text-gray-500">Loading inventory...</div>
                ) : error ? (
                  <div className="text-sm text-red-600">Error: {error}</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="p-2">Product</th>
                            <th className="p-2 w-32">Qty</th>
                            <th className="p-2 w-28">Unit</th>
                            <th className="p-2 w-32">Min Stock</th>
                            <th className="p-2">Note</th>
                            <th className="p-2 w-28">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(inventory || []).length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-3 text-sm text-gray-500">
                                No inventory for this store.
                              </td>
                            </tr>
                          )}

                          {(inventory || []).map((it) => {
                            const low = Number(it.qty ?? 0) < Number(it.min_stock ?? 0);
                            return (
                              <tr key={String(it.id)} className={`border-t ${!editing ? "" : ""}`}>
                                <td className="p-2 align-top">
                                  {editing ? (
                                    <input
                                      type="text"
                                      value={it.product_name}
                                      onChange={(e) => handleChangeItem(it.id, "product_name", e.target.value)}
                                      placeholder="Nama produk (contoh: Sabun cuci, Tisu, dsb.)"
                                      className="w-full border rounded px-2 py-1"
                                    />
                                  ) : (
                                    it.product_name
                                  )}
                                </td>

                                <td className="p-2 align-top">
                                  {editing ? (
                                    <input
                                      type="number"
                                      value={it.qty}
                                      onChange={(e) => handleChangeItem(it.id, "qty", Number(e.target.value))}
                                      className={`w-full border rounded px-2 py-1 ${low ? "ring-2 ring-red-300" : ""}`}
                                      min={0}
                                    />
                                  ) : (
                                    it.qty
                                  )}
                                </td>

                                <td className="p-2 align-top">
                                  {editing ? (
                                    <input
                                      type="text"
                                      value={it.unit ?? ""}
                                      onChange={(e) => handleChangeItem(it.id, "unit", e.target.value)}
                                      className="w-full border rounded px-2 py-1"
                                      placeholder="pcs / pack / roll"
                                    />
                                  ) : (
                                    it.unit || "-"
                                  )}
                                </td>

                                <td className="p-2 align-top">
                                  {editing ? (
                                    <input
                                      type="number"
                                      value={it.min_stock ?? 0}
                                      onChange={(e) => handleChangeItem(it.id, "min_stock", Number(e.target.value))}
                                      className={`w-full border rounded px-2 py-1 ${low ? "bg-red-50" : ""}`}
                                      min={0}
                                    />
                                  ) : (
                                    it.min_stock ?? "-"
                                  )}
                                </td>

                                <td className="p-2 align-top">
                                  {editing ? (
                                    <input
                                      type="text"
                                      value={it.note ?? ""}
                                      onChange={(e) => handleChangeItem(it.id, "note", e.target.value)}
                                      className="w-full border rounded px-2 py-1"
                                      placeholder="Catatan"
                                    />
                                  ) : (
                                    it.note || "-"
                                  )}
                                </td>

                                <td className="p-2 align-top">
                                  <div className="flex gap-2">
                                    {editing ? (
                                      <button
                                        className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs"
                                        onClick={() => handleDeleteItem(it.id)}
                                      >
                                        Delete
                                      </button>
                                    ) : (
                                      <button
                                        className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                                        onClick={() => {
                                          setEditing(true);
                                        }}
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {Number(it.qty ?? 0) < Number(it.min_stock ?? 0) && (
                                      <div className="text-xs text-red-600 self-center">Low</div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {!editing && inventory && inventory.length > 0 && (
                      <div className="mt-4 text-sm text-gray-600">
                        <div>
                          Total items: <strong>{inventory.length}</strong>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </ComponentCard>
      </div>
    </>
  );
}
