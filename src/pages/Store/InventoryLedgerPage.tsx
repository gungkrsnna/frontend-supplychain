// src/pages/Store/InventoryLedgerPage.tsx
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
    const mergedOpts = {
      ...(opts || {}),
      headers: { "Content-Type": "application/json", ...(opts && (opts as any).headers), ...getAuthHeader() }
    } as RequestInit;

    const res = await fetch(url, mergedOpts);
    const ct = res.headers.get("content-type") || "";
    let body: any = null;
    if (ct.indexOf("application/json") !== -1) body = await res.json();
    else body = await res.text();

    if (!res.ok) {
      const msg = typeof body === "object" && body !== null ? (body.message || body.error || JSON.stringify(body)) : String(body || res.statusText);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  }, []);
}

function isRowIncoming(r: any): boolean {
  if (!r) return false;
  const candidates = [r.type, r.transaction_type, r.direction, r.in_out, r.inOut, r.is_in, r.isIn, r.tx_type];
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    const s = String(c).toLowerCase();
    if (/\bincoming\b/.test(s) || /\bin\b/.test(s) || s === "in" || s === "incoming" || s === "receipt" || s === "received" || s === "add" || s === "plus") return true;
    if (/\boutgoing\b/.test(s) || /\bout\b/.test(s) || s === "out" || s === "outgoing" || s === "issue" || s === "issued" || s === "remove" || s === "minus") return false;
  }
  if (typeof r.is_in === "boolean") return !!r.is_in;
  if (typeof r.isIn === "boolean") return !!r.isIn;
  const t = String(r.type || r.transaction_type || "").toLowerCase();
  if (t.indexOf("in") !== -1) return true;
  if (t.indexOf("out") !== -1) return false;
  return true;
}

function parseMeasurementBreakdown(raw: any) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

/**
 * Use first measurement from item measurements as base unit reference
 */
function getBaseUnitFromItemMeasurements(itemMeasurements: any[] | null) {
  if (!Array.isArray(itemMeasurements) || itemMeasurements.length === 0) {
    return { baseUnitLabel: "unit", basePerValue: null };
  }
  const first = itemMeasurements[0];
  const uomName = (first && first.uom && first.uom.name) ? first.uom.name : (first && first.uom_name ? first.uom_name : null);
  const per = Number(first && (first.value_in_base ?? first.value_in_smallest ?? first.value_in_grams ?? first.value) ) || null;
  return { baseUnitLabel: uomName || "unit", basePerValue: per };
}

/**
 * Format a measurement entry into human strings and subtotal in base unit
 */
function formatMeasurementEntry(e: any, itemMeasurements: any[] | null, baseUnitLabel: string) {
  const mid = Number(e.measurementId || e.measurement_id || 0);
  const count = Number(e.count || e.qty || e.quantity || 0);

  let measDef = null;
  if (Array.isArray(itemMeasurements)) {
    for (const m of itemMeasurements) {
      if (Number(m.id) === mid) { measDef = m; break; }
    }
  }

  const measUomName = measDef ? (measDef.uom?.name || measDef.uom_name || null) : null;
  const measurementLabel = measUomName ? `${count} ${measUomName}` : (mid ? `${count} × measurement#${mid}` : `${count}`);

  const perValue = measDef ? Number(measDef.value_in_base ?? measDef.value_in_smallest ?? measDef.value_in_grams ?? measDef.value ?? 0) : 0;
  const conversionNote = (perValue && !Number.isNaN(perValue)) ? `1 ${measUomName || ("m#" + mid)} = ${perValue.toLocaleString()} ${baseUnitLabel}` : "";

  const subtotalBase = (perValue && !Number.isNaN(perValue)) ? perValue * count : (e.subtotal ?? e.sub_total ?? null);
  const subtotalBaseStr = (subtotalBase !== null && subtotalBase !== undefined) ? `${Number(subtotalBase).toLocaleString()} ${baseUnitLabel}` : null;

  return { measurementLabel, conversionNote, subtotalBase, subtotalBaseStr };
}

export default function InventoryLedgerPage(): JSX.Element {
  const { storeId: paramStoreId, itemId: paramItemId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fetchJson = useFetchJson();

  const storeId = paramStoreId ? Number(paramStoreId) : 0;
  const itemId = paramItemId ? Number(paramItemId) : 0;
  const passedItem = (location.state as any)?.item ?? null;

  const [item, setItem] = useState<any | null>(passedItem || null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "IN" | "OUT">("ALL");

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
        // ignore
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

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter === "ALL") return true;
      const incoming = isRowIncoming(r);
      return filter === "IN" ? incoming : !incoming;
    });
  }, [rows, filter]);

  return (
    <>
      <PageMeta title={`Log History - ${item ? (item.name || (item.Item && item.Item.name) || item.code || `Item ${itemId}`) : `Item ${itemId}`}`} />
      <PageBreadcrumb pageTitle={`Log History`} />

      <div className="p-4 mx-auto">
        <ComponentCard title={`Log History — ${item ? ((item.Item && item.Item.name) || item.name || item.code || `Item ${itemId}`) : `Item ${itemId}`}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-600">Item</div>
              <div className="text-lg font-medium">{item ? ((item.Item && item.Item.name) || item.name || "-") : "Loading..."}</div>
              <div className="text-sm text-gray-500">{item ? ((item.Item && item.Item.code) || item.code || "") : ""}</div>
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
                  const incoming = isRowIncoming(r);
                  const rawType = String(r.type || r.transaction_type || r.direction || "");
                  const rawTypeU = rawType.toUpperCase();
                  const typeLabel = incoming ? (rawTypeU.indexOf("IN") !== -1 ? rawTypeU : "IN") : (rawTypeU.indexOf("OUT") !== -1 ? rawTypeU : "OUT");

                  // item measurements (if included)
                  const itemMeasurements = (r.Item && r.Item.measurements) ? r.Item.measurements : (item && item.Item && item.Item.measurements ? item.Item.measurements : null);

                  // base unit from first measurement
                  const { baseUnitLabel, basePerValue } = getBaseUnitFromItemMeasurements(itemMeasurements);

                  // converted qty (base unit) and legacy qty
                  const convertedRaw = (r.converted_qty !== undefined && r.converted_qty !== null) ? r.converted_qty
                    : (r.convertedQty !== undefined && r.convertedQty !== null) ? r.convertedQty
                    : (r.converted !== undefined && r.converted !== null) ? r.converted
                    : 0;
                  const convertedQty = Number(convertedRaw || 0);

                  const legacyRaw = (r.quantity !== undefined && r.quantity !== null) ? r.quantity
                    : (r.qty !== undefined && r.qty !== null) ? r.qty
                    : (r.quantity_raw !== undefined && r.quantity_raw !== null) ? r.quantity_raw
                    : 0;
                  const legacyQty = Number(legacyRaw || 0);

                  const incomingSign = incoming ? "+" : "-";

                  // parse measurement_breakdown once
                  const breakdownRaw = parseMeasurementBreakdown(r.measurement_breakdown || r.measurementBreakdown || r.measurement_breakdown_json);
                  const mbEntries = breakdownRaw && Array.isArray(breakdownRaw.measurementEntries) ? breakdownRaw.measurementEntries : null;

                  // legacy qty display (fallback)
                  const qtyDisplayStr = legacyQty ? (incomingSign + Math.abs(legacyQty).toLocaleString()) : null;

                  // corner label: prefer measurement entry's measurementLabel (compact) then fallback to legacy qty
                  let cornerQtyLabel: string | null = null;
                  try {
                    if (mbEntries && mbEntries.length > 0) {
                      const firstEntry = mbEntries[0];
                      const formattedFirst = formatMeasurementEntry(firstEntry, itemMeasurements, baseUnitLabel);
                      const compact = (formattedFirst.measurementLabel || "").replace(/\s+/g, ""); // "2pcs"
                      cornerQtyLabel = incomingSign + compact;
                    } else if (qtyDisplayStr) {
                      cornerQtyLabel = qtyDisplayStr;
                    } else {
                      cornerQtyLabel = null;
                    }
                  } catch (err) {
                    cornerQtyLabel = qtyDisplayStr;
                  }

                  const convertedDisplayStr = incomingSign + Math.abs(convertedQty).toLocaleString() + " " + baseUnitLabel;

                  const actor = (r.user && r.user.name) || r.user_name || r.created_by || r.actor || "";

                  return (
                    <li key={i} className="p-3 border rounded bg-white">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-sm font-medium">{typeLabel}</div>
                              <div className="text-xs text-gray-500">{actor} — {t}</div>
                            </div>

                            <div className="text-right">
                              <div className={`text-sm font-semibold ${incoming ? "text-green-600" : "text-red-600"}`}>
                                {cornerQtyLabel || convertedDisplayStr}
                              </div>

                              {qtyDisplayStr && (
                                <div className="text-xs text-gray-500 mt-1">{convertedDisplayStr}</div>
                              )}
                              <div className="text-xs text-gray-500 mt-1">{r.reference || r.ref || ""}</div>
                            </div>
                          </div>

                          <div className="mt-3 text-sm text-gray-700 space-y-1">

                            {!mbEntries && breakdownRaw && (
                              <div className="text-xs text-gray-500">
                                Breakdown: <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(breakdownRaw)}</pre>
                              </div>
                            )}

                            {(r.from_store_id || r.to_store_id || r.fromStoreId || r.toStoreId) && (
                              <div className="text-xs text-gray-500">
                                Transfer: {r.from_store_id || r.fromStoreId || "-"} → {r.to_store_id || r.toStoreId || "-"}
                              </div>
                            )}

                            {r.note && <div className="text-xs text-gray-500">Note: {r.note}</div>}
                          </div>
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
