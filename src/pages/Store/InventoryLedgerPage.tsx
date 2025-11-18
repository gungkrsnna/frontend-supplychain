// src/pages/store/InventoryLedgerPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
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

export default function InventoryLedgerPage(): JSX.Element {
  const { storeId: paramStoreId, itemId: paramItemId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fetchJson = useFetchJson();

  // prefer storeId from params, but allow numeric fallback
  const storeId = paramStoreId ? Number(paramStoreId) : 0;
  const itemId = paramItemId ? Number(paramItemId) : 0;

  // if caller passed the item in location.state, use it to render header quicker
  const passedItem = (location.state as any)?.item ?? null;

  const [item, setItem] = useState<any | null>(passedItem || null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "IN" | "OUT">("ALL");

  // If item not provided in state, fetch minimal item info (optional)
  useEffect(() => {
    let mounted = true;
    if (item || !itemId) return;
    (async () => {
      try {
        const tryEndpoints = [
          `${API_BASE}/api/items/${itemId}`,
          `${API_BASE}/api/item/${itemId}`,
          `/api/items/${itemId}`,
          `/api/item/${itemId}`
        ];
        let body = null;
        for (const ep of tryEndpoints) {
          try {
            body = await fetchJson(ep);
            if (body) break;
          } catch {
            // try next
          }
        }
        const it = body && body.data ? body.data : (body && body.item ? body.item : body);
        if (mounted && it) setItem(it);
      } catch (err: any) {
        // silent: item name is optional
      }
    })();
    return () => { mounted = false; };
  }, [itemId, item, fetchJson]);

  const fetchLedger = useCallback(async () => {
    if (!storeId || !itemId) {
      setError("Store ID atau Item ID tidak valid");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: any = await fetchJson(`${API_BASE}/api/stores/${storeId}/inventory/${itemId}/ledger`);
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      setRows(rows || []);
    } catch (err: any) {
      console.error("Failed to fetch ledger", err);
      const msg = err?.message ?? "Gagal memuat ledger";
      setError(msg);
      toast.error(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fetchJson, storeId, itemId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter === "ALL") return true;
      const t = (r.type || r.transaction_type || "").toString().toUpperCase();
      return t.includes(filter);
    });
  }, [rows, filter]);

  return (
    <>
      <PageMeta title={`Ledger - ${item ? (item.name ?? item.Item?.name ?? item.code ?? `Item ${itemId}`) : `Item ${itemId}`}`} />
      <PageBreadcrumb pageTitle={`Ledger`} />

      <div className="p-4 mx-auto">
        <ComponentCard title={`Ledger — ${item ? (item.Item?.name ?? item.name ?? item.code ?? `Item ${itemId}`) : `Item ${itemId}`}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-600">Item</div>
              <div className="text-lg font-medium">{item ? (item.Item?.name ?? item.name ?? "-") : "Loading..."}</div>
              <div className="text-sm text-gray-500">{item ? (item.Item?.code ?? item.code ?? "") : ""}</div>
            </div>

            <div className="flex gap-2 items-center">
              <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
              <button onClick={fetchLedger} className="px-3 py-1 border rounded" disabled={loading}>{loading ? "..." : "Refresh"}</button>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <button className={`px-2 py-1 rounded ${filter === "ALL" ? "bg-gray-200" : ""}`} onClick={() => setFilter("ALL")}>All</button>
            <button className={`px-2 py-1 rounded ${filter === "IN" ? "bg-green-100" : ""}`} onClick={() => setFilter("IN")}>IN</button>
            <button className={`px-2 py-1 rounded ${filter === "OUT" ? "bg-red-100" : ""}`} onClick={() => setFilter("OUT")}>OUT</button>
          </div>

          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

          <div className="overflow-auto" style={{ maxHeight: 560 }}>
            {loading ? (
              <div className="py-6 text-center text-gray-600">Memuat ledger...</div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-gray-400">Ledger kosong</div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((r: any, i: number) => {
                  const ts = r.createdAt || r.created_at || r.created;
                  const t = ts ? new Date(ts).toLocaleString() : "";
                  const type = (r.type || r.transaction_type || "").toUpperCase();
                  const qty = Number(r.quantity || r.converted_qty || r.convertedQty || 0);
                  const conv = Number(r.converted_qty || r.convertedQty || 0);
                  return (
                    <li key={i} className="p-3 border rounded bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-medium">{type} • {r.reference || r.note || "-"}</div>
                          <div className="text-xs text-gray-500">{r.user?.name || r.user_name || ""} — {t}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${type === "OUT" ? "text-red-600" : "text-green-600"}`}>{qty.toLocaleString()} {conv ? `(${conv.toLocaleString()})` : ""}</div>
                          <div className="text-xs text-gray-500">{r.note ?? ""}</div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ComponentCard>
      </div>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover draggable />
    </>
  );
}
