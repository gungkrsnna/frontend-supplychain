// src/pages/store/StoreInventoryPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import InventoryTable from "./components/InventoryTable";
import AddInventoryModal from "./components/AddInventoryModal";
import ProductionLeftoverModal from "./components/ProductionLeftoverModal";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function useFetchJson() {
  const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  return useCallback(async (url: string, opts?: RequestInit) => {
    const mergedOpts = { ...(opts || {}), headers: { "Content-Type": "application/json", ...(opts && (opts as any).headers), ...getAuthHeader() } } as RequestInit;
    const res = await fetch(url, mergedOpts);
    const ct = res.headers.get("content-type") || "";
    let body: any = null;
    if (ct.includes("application/json")) body = await res.json();
    else body = await res.text();
    if (!res.ok) {
      const msg = typeof body === "object" && body !== null ? (body.message || body.error || JSON.stringify(body)) : String(body || res.statusText);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  }, []);
}

function resolveStoreInfo(user: any) {
  const storeId = Number(user?.storeId ?? user?.store_id ?? user?.storeIdNumber ?? 0);
  const storeName =
    user?.storeName ??
    user?.store_name ??
    user?.store?.name ??
    user?.store?.title ??
    user?.store?.store_name ??
    user?.store?.nama ??
    (typeof user?.store === "string" ? user.store : null) ??
    null;
  const displayName = storeName || (storeId ? `Store ${storeId}` : null);
  return { storeId, displayName };
}

export default function StoreInventoryPage(): JSX.Element {
  const { user } = useContext(AuthContext);
  const { storeId: paramStoreId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fetchJson = useFetchJson();

  const { storeId: userStoreId, displayName } = resolveStoreInfo(user);
  const numericParamStoreId = paramStoreId ? Number(paramStoreId) : 0;
  const storeId = numericParamStoreId && !Number.isNaN(numericParamStoreId) ? numericParamStoreId : userStoreId;

  if (!storeId || storeId <= 0) {
    return (
      <div className="p-4 text-red-600">
        Store ID tidak ditemukan pada user login atau URL.
        Pastikan user memiliki storeId atau buka halaman store yang benar.
      </div>
    );
  }

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProdModal, setShowProdModal] = useState(false);
  const [showSetModal, setShowSetModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ledger panel state (right-side)
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<any[]>([]);
  const [ledgerFilter, setLedgerFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [ledgerItem, setLedgerItem] = useState<any | null>(null);

  // search state
  const [search, setSearch] = useState<string>("");
  const [debouncing, setDebouncing] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // fetch inventory (include items)
  const fetchInventory = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);
    try {
      const body: any = await fetchJson(`${API_BASE}/api/stores/${storeId}/inventory?includeItems=1`);
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      setItems(rows || []);
    } catch (err: any) {
      console.error("Failed to fetch inventory", err);
      setItems([]);
      setError(err.message || "Failed to fetch inventory");
      toast.error(err?.message || "Gagal memuat inventory");
    } finally {
      setLoading(false);
    }
  }, [fetchJson, storeId]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory, refreshKey, storeId]);

  // show toast if navigation provided a toast message in location.state
  useEffect(() => {
    const st: any = (location && (location.state as any)) || null;
    if (st && st.toast && st.toast.message) {
      const t = st.toast;
      const msg = String(t.message || "");
      const type = String(t.type || "info").toLowerCase();
      if (type === "success") toast.success(msg);
      else if (type === "error") toast.error(msg);
      else if (type === "warn" || type === "warning") toast.warn(msg);
      else toast.info(msg);

      try {
        navigate(location.pathname, { replace: true, state: {} });
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // debounce search input (client-side filtering)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!search || !search.trim()) {
      setDebouncing(false);
      return;
    }

    setDebouncing(true);
    debounceRef.current = window.setTimeout(() => {
      setDebouncing(false);
      debounceRef.current = null;
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [search]);

  // client-side filtered items
  const filteredItems = useMemo(() => {
    const q = (search || "").toLowerCase().trim();
    if (!q) return items;
    return items.filter((row) => {
      const item = row.Item ?? row.item ?? { id: row.itemId ?? row.item_id ?? null, code: row.code ?? null, name: row.name ?? null };
      const code = (item?.code ?? "").toString().toLowerCase();
      const name = (item?.name ?? "").toString().toLowerCase();
      const fallbackCode = (row?.code ?? "").toString().toLowerCase();
      const fallbackName = (row?.name ?? "").toString().toLowerCase();
      return code.includes(q) || name.includes(q) || fallbackCode.includes(q) || fallbackName.includes(q);
    });
  }, [items, search]);

  // optimistic update helper
  const optimisticUpdateStock = (itemId: number, newStock: number) => {
    setItems(prev => prev.map(it => {
      const id = it.itemId ?? it.item_id ?? (it.Item && it.Item.id);
      if (id === itemId) return { ...it, stock: newStock };
      return it;
    }));
  };

  const openInTransaction = (item: any) => {
    const itemId = item.itemId ?? item.item_id ?? item.Item?.id ?? item.Item?.itemId ?? null;
    if (!itemId) return;
    navigate(`/stores/in/${storeId}/transaction/${itemId}`, { state: { item } });
  };

  const openOutTransaction = (item: any) => {
    const itemId = item.itemId ?? item.item_id ?? item.Item?.id ?? item.Item?.itemId ?? null;
    if (!itemId) return;
    navigate(`/stores/out/${storeId}/transaction/${itemId}`, { state: { item } });
  };

  // new: fetch ledger and open right-side panel (replaces previous alert)
    // navigate to dedicated ledger page for the item
  const viewLedger = (item: any) => {
    const itemId = item.itemId ?? item.item_id ?? item.Item?.id;
    if (!itemId) {
      toast.error("Item tidak valid untuk melihat ledger");
      return;
    }
    // navigate to new ledger page. include the item in state for faster render
    navigate(`/stores/${storeId}/inventory/${itemId}/ledger`, { state: { item } });
  };


  const handleRefreshLedger = async () => {
    if (!ledgerItem) return;
    setLedgerLoading(true);
    try {
      const itemId = ledgerItem.itemId ?? ledgerItem.item_id ?? ledgerItem.Item?.id;
      const body: any = await fetchJson(`${API_BASE}/api/stores/${storeId}/inventory/${itemId}/ledger`);
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      setLedgerRows(rows || []);
      toast.success("Ledger diperbarui");
    } catch (err: any) {
      console.error("refresh ledger failed", err);
      toast.error(err?.message || "Gagal memperbarui ledger");
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleSubmitTransaction = async (payload: { type: string; quantity: number; measurementId?: number | null; convertedQty?: number; reference?: string; note?: string; allowNegative?: boolean }) => {
    if (!storeId || Number.isNaN(storeId) || storeId <= 0) {
      toast.error('Store ID tidak valid.');
      return;
    }
    if (!selectedItem) {
      toast.error("Item belum dipilih.");
      return;
    }
    const itemId = selectedItem.itemId ?? selectedItem.item_id ?? selectedItem.Item?.id;
    const body = {
      itemId,
      measurementId: payload.measurementId ?? null,
      quantity: payload.quantity,
      type: payload.type,
      reference: payload.reference ?? null,
      note: payload.note ?? null,
      allowNegative: payload.allowNegative ?? false
    };

    const converted = typeof payload.convertedQty === "number" ? Number(payload.convertedQty) : Number(payload.quantity);
    const positiveTypes = ["IN", "TRANSFER_IN", "LEFTOVER_RETURN", "PRODUCTION_IN"];
    const delta = positiveTypes.includes(payload.type) ? converted : -converted;
    const oldStock = Number(selectedItem.stock ?? 0);
    const newStock = oldStock + delta;

    optimisticUpdateStock(itemId, newStock);

    try {
      await fetchJson(`${API_BASE}/api/stores/${storeId}/transactions`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      setSelectedItem(null);
      setRefreshKey(k => k + 1);
      toast.success("Transaksi berhasil");
    } catch (err: any) {
      console.error("Failed to save", err);
      const msg = err?.message ?? String(err) ?? "Gagal menyimpan transaksi";
      toast.error(`Gagal menyimpan: ${msg}`);
      setRefreshKey(k => k + 1);
      throw err;
    }
  };

  const openAddFromProd = (item: any) => {
    setSelectedItem(item);
    setShowProdModal(true);
  };

  const openSetAbsolute = (item: any) => {
    setSelectedItem(item);
    setShowSetModal(true);
  };

  const storeDisplay = displayName || `Store ${storeId}`;

  return (
    <>
      <PageMeta title={`Inventory ${storeDisplay}`} description={`Inventory per store — ${storeDisplay}`} />
      <PageBreadcrumb pageTitle={`Inventory Store`} />

      <div className="space-y-6 p-4">
        <ComponentCard title={`List Inventory`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2 items-center">
              <div>
                <input
                  type="search"
                  placeholder="Cari item (kode atau nama)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (debounceRef.current) {
                        clearTimeout(debounceRef.current);
                        debounceRef.current = null;
                        setDebouncing(false);
                      }
                    }
                  }}
                  className="border rounded px-3 py-1 w-64"
                />
              </div>
            </div>

            <div className="text-sm text-gray-500">
              <button
                className="px-3 py-1 bg-green-600 text-white rounded"
                onClick={() => setShowAddModal(true)}
                disabled={!Number.isInteger(storeId) || storeId <= 0}
              >+ Add inventory</button>
            </div>
          </div>

          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

          <div className="md:flex md:gap-4">
            <div className="md:flex-1">
              <InventoryTable
                items={filteredItems}
                inTransact={openInTransaction}
                outTransact={openOutTransaction}
                onViewLedger={viewLedger}
                onAddFromProd={openAddFromProd}
                onSetAbsolute={openSetAbsolute}
              />
            </div>

          </div>
        </ComponentCard>
      </div>

      <AddInventoryModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        storeId={storeId}
        fetchJson={fetchJson}
        apiBase={API_BASE}
        onSaved={() => { setShowAddModal(false); setRefreshKey(k => k + 1); toast.success("Inventory added"); }}
      />

      <ProductionLeftoverModal
        open={showProdModal}
        item={selectedItem}
        onClose={() => { setShowProdModal(false); setSelectedItem(null); }}
        storeId={storeId}
        fetchJson={fetchJson}
        apiBase={API_BASE}
        onSaved={() => { setShowProdModal(false); setSelectedItem(null); setRefreshKey(k => k + 1); toast.success("Added from production"); }}
      />

      {/* Toast container (put here so toasts from transaction pages that navigate here appear) */}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </>
  );
}
