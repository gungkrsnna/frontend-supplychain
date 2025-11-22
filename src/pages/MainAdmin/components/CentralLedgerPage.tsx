// src/pages/central/CentralLedgerPage.tsx
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

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

export default function CentralLedgerPage() {
  const { centralId, itemId } = useParams();
  const fetchJson = useFetchJson();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const passedItem = (location.state as any)?.item ?? null;

  const fetchLedger = useCallback(async () => {
    if (!centralId || !itemId) return;
    setLoading(true);
    try {
      const body: any = await fetchJson(`${API_BASE}/api/central/${centralId}/items/${itemId}/ledger`);
      const data = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      setRows(data || []);
    } catch (err: any) {
      console.error("failed ledger", err);
      toast.error(err?.message || "Gagal memuat ledger");
    } finally { setLoading(false); }
  }, [centralId, itemId, fetchJson]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Ledger Central — Item {passedItem?.Item?.name ?? itemId}</h2>
      <div className="bg-white rounded shadow p-3">
        {loading ? <div>Loading...</div> : (
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="p-2">Tanggal</th>
                <th className="p-2">Tipe</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Converted</th>
                <th className="p-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r:any, i:number) => (
                <tr key={i} className="border-t">
                  <td className="p-2 text-sm">{new Date(r.createdAt || r.created_at).toLocaleString()}</td>
                  <td className="p-2 text-sm">{r.type}</td>
                  <td className="p-2 text-sm">{r.quantity ?? "-"}</td>
                  <td className="p-2 text-sm">{r.converted_qty ?? r.convertedQty ?? "-"}</td>
                  <td className="p-2 text-sm">{r.note ?? "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">Belum ada transaksi.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
