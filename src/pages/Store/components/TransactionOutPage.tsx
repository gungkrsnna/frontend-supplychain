// src/pages/store/TransactionOutPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../../context/AuthContext";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ComponentCard from "../../../components/common/ComponentCard";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type MeasurementRow = { measurementId: number | null; count: number | "" };

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Local fetch helper (kept same semantics)
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
    if (ct.includes("application/json")) body = await res.json();
    else body = await res.text();

    if (!res.ok) {
      const msg =
        typeof body === "object" && body !== null
          ? (body.message || body.error || JSON.stringify(body))
          : String(body || res.statusText);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  }, []);
}

export default function TransactionOutPage(): JSX.Element {
  const { user } = React.useContext(AuthContext);
  const storeId = Number(user?.storeId ?? user?.store_id ?? 0);

  const { itemId: paramItemId, storeId: paramStoreId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fetchJson = useFetchJson();

  const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

  const passedItem = (location.state as any)?.item ?? null;
  const itemIdFromParams = Number(paramItemId ?? (passedItem?.id ?? null));
  const effectiveStoreId = Number(paramStoreId ?? storeId);

  // state
  const [item, setItem] = useState<any | null>(passedItem || null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [measurements, setMeasurements] = useState<any[] | null>(null);
  const [measurementRows, setMeasurementRows] = useState<MeasurementRow[]>([]);
  // optional custom additional amount in base unit (not necessarily grams)
  const [customBase, setCustomBase] = useState<number | "">("");
  const [simpleQty, setSimpleQty] = useState<number | "">("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [usageMode, setUsageMode] = useState<"self" | "transfer">("self");
  const [stores, setStores] = useState<any[] | null>(null);
  const [toStoreId, setToStoreId] = useState<number | "">("");

  // current stock for store+item (in base unit)
  const [currentStock, setCurrentStock] = useState<number | null>(null);

  // normalize item shape: prefer item.Item or item.item if present
  const itemObj = useMemo(() => {
    if (!item) return null;
    return item.Item ?? item.item ?? item;
  }, [item]);

  // utility: read base unit label if available
  const baseUnitLabel = useMemo(() => {
    return (
      itemObj?.base_uom_label ??
      itemObj?.uom_base_label ??
      itemObj?.uom?.name ??
      (itemObj?.uom_in_grams ? "g" : "base unit")
    );
  }, [itemObj]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const tryEndpoints = [
          `${API_BASE}/api/stores`,
          `/api/stores`,
          `${API_BASE}/api/stores?active=1`,
          `/api/stores?active=1`
        ];
        let body: any = null;
        for (const ep of tryEndpoints) {
          try {
            body = await fetchJson(ep);
            if (body) break;
          } catch (err) {}
        }
        const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
        if (!mounted) return;
        setStores(rows || []);
      } catch (err) {
        console.warn("failed to fetch stores list", err);
        if (mounted) setStores(null);
      }
    })();
    return () => { mounted = false; };
  }, [fetchJson, API_BASE]);

  // Load item if not present from location.state
  useEffect(() => {
    let mounted = true;
    async function loadItem() {
      if (item && (item.id || item.itemId || item.item_id || (item.Item && item.Item.id))) {
        return;
      }
      if (!itemIdFromParams || Number.isNaN(itemIdFromParams) || itemIdFromParams <= 0) {
        return;
      }
      setLoadingItem(true);
      try {
        let body: any = null;
        const tryEndpoints = [
          `${API_BASE}/api/items/${itemIdFromParams}`,
          `${API_BASE}/api/item/${itemIdFromParams}`,
          `/api/items/${itemIdFromParams}`,
          `/api/item/${itemIdFromParams}`
        ];
        for (const ep of tryEndpoints) {
          try {
            body = await fetchJson(ep);
            if (body) break;
          } catch (err) {
            // try next
          }
        }
        if (!body) throw new Error("No response body from item endpoints");
        const it = (body && body.data) ? body.data : (body && body.item) ? body.item : body;
        if (!it) throw new Error("Could not parse item from response");
        if (mounted) setItem(it);
      } catch (err: any) {
        if (mounted) setError(err.message || "Failed to load item");
      } finally {
        if (mounted) setLoadingItem(false);
      }
    }
    loadItem();
    return () => { mounted = false; };
  }, [itemIdFromParams, fetchJson, API_BASE]);

  // Fetch measurements for the item — depend on the resolved itemObj id only
  useEffect(() => {
    const id = itemObj?.id ?? item?.itemId ?? item?.item_id ?? null;
    if (!id) {
      setMeasurements(null);
      setMeasurementRows([]);
      setSimpleQty("");
      setCustomBase("");
      return;
    }

    (async () => {
      try {
        let body: any = null;
        const tryEndpoints = [
          `${API_BASE}/api/item/${id}/measurements`,
          `${API_BASE}/api/items/${id}/measurements`,
          `/api/item/${id}/measurements`,
          `/api/items/${id}/measurements`
        ];
        for (const ep of tryEndpoints) {
          try {
            body = await fetchJson(ep);
            if (body) break;
          } catch (err) {
            // ignore and try next
          }
        }
        const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
        setMeasurements(rows || []);
        if (rows && rows.length > 0) {
          setMeasurementRows([{ measurementId: rows[0].id, count: "" }]);
        } else {
          setMeasurementRows([]);
        }
        setSimpleQty("");
        setCustomBase("");
      } catch (err) {
        console.warn("fetch measurements failed", err);
        setMeasurements(null);
      }
    })();
  }, [itemObj?.id, fetchJson, API_BASE]);

  // fetch current store_item stock for this item (in base unit)
  useEffect(() => {
    const id = itemObj?.id ?? item?.itemId ?? item?.item_id ?? null;
    if (!id || !effectiveStoreId) {
      setCurrentStock(null);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const endpoints = [
          `${API_BASE}/api/stores/${effectiveStoreId}/inventory/${id}`,
          `/api/stores/${effectiveStoreId}/inventory/${id}`
        ];
        let body: any = null;
        for (const ep of endpoints) {
          try {
            body = await fetchJson(ep);
            if (body) break;
          } catch (err) {
            // try next
          }
        }
        const si = body && body.data ? body.data : (body || null);
        if (mounted) setCurrentStock(si ? Number(si.stock || 0) : 0);
      } catch (err) {
        console.warn("failed to fetch store item", err);
        if (mounted) setCurrentStock(null);
      }
    })();
    return () => { mounted = false; };
  }, [itemObj?.id, effectiveStoreId, fetchJson, API_BASE]);

  // helpers
  function addMeasurementRow() { setMeasurementRows(prev => [...prev, { measurementId: null, count: "" }]); }
  function updateMeasurement_row(index: number, patch: Partial<MeasurementRow>) { setMeasurementRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r)); }
  function removeMeasurementRow(index: number) { setMeasurementRows(prev => prev.filter((_, i) => i !== index)); }

  function updateMeasurementRow(index: number, patch: Partial<MeasurementRow>) {
    updateMeasurement_row(index, patch);
  }

  // utility: get conversion value per measurement in base unit
  function measurementBaseValue(m: any) {
    // prefer these keys in order; fallback to m.value
    return Number(m?.value_in_grams ?? m?.value_in_base ?? m?.value_in_smallest ?? m?.value ?? 0);
  }

  // compute preview in base unit (not always grams)
  const previewBase = useMemo(() => {
    let total = 0;
    if (Array.isArray(measurementRows) && measurements) {
      for (const r of measurementRows) {
        if (!r.measurementId || r.count === "" || Number(r.count) <= 0) continue;
        const m = measurements.find(m => Number(m.id) === Number(r.measurementId));
        const per = measurementBaseValue(m);
        total += per * Number(r.count);
      }
    }
    if (customBase !== "" && !Number.isNaN(Number(customBase))) total += Number(customBase);
    if ((!measurements || measurements.length === 0) && simpleQty !== "" && itemObj) {
      // try use item.uom conversion if available (uom_in_grams or uom_in_base)
      const uomInBase = itemObj.uom_in_grams ?? itemObj.uom?.value_in_grams ?? itemObj.uom?.grams_per_unit ?? itemObj.uom?.value_in_base ?? null;
      if (uomInBase) total += Number(simpleQty) * Number(uomInBase);
    }
    return total;
  }, [measurementRows, measurements, customBase, simpleQty, itemObj]);

  const hasMeasurements = !!(measurements && Array.isArray(measurements) && measurements.length > 0);
  const hasValidMeasurementRows = measurementRows.length > 0 && measurementRows.some(r => r.measurementId && r.count !== "" && Number(r.count) > 0);
  const hasCustomBase = customBase !== "" && Number(customBase) > 0;
  const hasSimpleQty = simpleQty !== "" && Number(simpleQty) > 0;
  const transferRequiresTarget = usageMode === "transfer";
  // Logic: if item has measurements -> require measurement rows OR customBase > 0 (custom is optional but can be used standalone)
  const measurementInputOk = hasMeasurements ? (hasValidMeasurementRows || hasCustomBase) : hasSimpleQty;
  const canSave =
    !saving &&
    !!itemObj &&
    measurementInputOk &&
    (!transferRequiresTarget || (toStoreId !== "" && Number(toStoreId) !== Number(effectiveStoreId)));

  // validation: preview must not exceed currentStock for OUT (source store)
  const exceedsStock = currentStock !== null && previewBase > currentStock;

  // friendly error extractor
  function friendlyErrorMessage(err: any) {
    if (!err) return "Terjadi kesalahan";
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === "object") {
      if (err.message) return String(err.message);
      if (err.error) return String(err.error);
      try { return JSON.stringify(err); } catch { return String(err); }
    }
    return String(err);
  }

  // submit handler for OUT
  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    if (!itemObj) { const m = "Pilih item"; setError(m); toast.error(m); return; }
    if (!effectiveStoreId || Number.isNaN(effectiveStoreId) || effectiveStoreId <= 0) {
      const m = "Store ID tidak valid"; setError(m); toast.error(m); return;
    }

    if (usageMode === "transfer") {
      if (!toStoreId || Number(toStoreId) <= 0) {
        const m = "Pilih store tujuan untuk transfer.";
        setError(m); toast.error(m); return;
      }
      if (Number(toStoreId) === Number(effectiveStoreId)) {
        const m = "Store tujuan tidak boleh sama dengan store asal.";
        setError(m); toast.error(m); return;
      }
    }

    if (currentStock !== null && previewBase > currentStock) {
      const m = `Pengurangan melebihi stok saat ini (${currentStock} ${baseUnitLabel}).`;
      setError(m);
      toast.error(m);
      return;
    }

    const payload: any = {
      itemId: itemObj.id ?? itemObj.itemId ?? itemObj.item_id,
      type: usageMode === "transfer" ? "TRANSFER_OUT" : "OUT",
      reference: reference || null,
      note: note || null
    };

    if (usageMode === "transfer") {
      payload.to_store_id = Number(toStoreId);
      // backend might set from_store_id based on auth, but include explicitly
      payload.from_store_id = Number(effectiveStoreId);
    }

    if (hasMeasurements) {
      if (!measurementInputOk) {
        const m = "Tambahkan setidaknya satu measurement dengan jumlah > 0 atau masukkan jumlah custom (base unit).";
        setError(m); toast.error(m); return;
      }
      // measurement entries (if any)
      const entries = measurementRows
        .filter(r => r.measurementId && r.count !== "" && Number(r.count) > 0)
        .map(r => ({ measurementId: Number(r.measurementId), count: Number(r.count) }));
      if (entries.length > 0) payload.measurementEntries = entries;
      // optional custom additional amount (base unit)
      if (customBase !== "" && Number(customBase) > 0) payload.customAmount = Number(customBase);
    } else {
      if (!hasSimpleQty) {
        const m = "Masukkan quantity (satuan item) minimal > 0";
        setError(m); toast.error(m); return;
      }
      const uomId = itemObj.uom_id ?? itemObj.uomId ?? itemObj.Uom?.id ?? itemObj.uom?.id ?? null;
      payload.quantity = Number(simpleQty);
      if (uomId) payload.uomId = uomId;
      payload.uomSource = "item_uom";
    }

    setSaving(true);
    try {
      await fetchJson(`${API_BASE}/api/stores/${effectiveStoreId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // Success: navigate to inventory and pass toast via location.state so StoreInventoryPage shows it
      navigate(`/stores/${effectiveStoreId}/inventory`, { state: { toast: { type: "success", message: "Pengurangan stok berhasil" } } });
    } catch (err: any) {
      console.error("failed to submit transaction", err);
      const message = friendlyErrorMessage(err) || "Gagal menyimpan transaksi";
      setError(message);
      // also attempt to show toast (will show if ToastContainer exists here or globally)
      try { toast.error(message); } catch { /* ignore */ }
    } finally {
      setSaving(false);
    }
  }

  // if no item
  if (!item && !loadingItem) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-2">Transaction — Pilih item</h2>
        <div className="text-sm text-gray-600 mb-3">Halaman ini butuh itemId di URL atau dipanggil dari halaman inventory (navigate dengan state.item).</div>
        <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
        {error && <div className="mt-3 text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`Transaction OUT - ${itemObj?.name ?? "Item"}`} />
      <PageBreadcrumb pageTitle="Kurangi Stock" />

      <div className="p-4 mx-auto">
        <ComponentCard title="Kurangi Stock (OUT)">
          {loadingItem ? (
            <div className="py-8 text-center text-gray-600">Memuat item...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Item header */}
              <div className="bg-gray-50 border rounded p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-gray-500">Item</div>
                    <div className="text-lg font-medium">{itemObj?.name ?? "-"}</div>
                    <div className="text-sm text-gray-500">{itemObj?.code ?? ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Store</div>
                    <div className="text-sm">{effectiveStoreId || "-"}</div>
                  </div>
                </div>
              </div>

              {/* Usage mode: self vs transfer */}
              <div className="space-y-2">
                <div className="text-xs text-gray-600 mb-1">Tujuan Pengurangan</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="usageMode"
                      value="self"
                      checked={usageMode === "self"}
                      onChange={() => setUsageMode("self")}
                    />
                    <span className="text-sm">Digunakan di store ini</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="usageMode"
                      value="transfer"
                      checked={usageMode === "transfer"}
                      onChange={() => setUsageMode("transfer")}
                    />
                    <span className="text-sm">Transfer ke store lain</span>
                  </label>
                </div>

                {usageMode === "transfer" && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-600 mb-1">Pilih tujuan store</div>
                    <select
                      value={toStoreId as any}
                      onChange={(e) => setToStoreId(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full sm:w-72 border rounded px-2 py-1"
                    >
                      <option value="">-- pilih store tujuan --</option>
                      {stores && stores.map((s: any) => (
                        <option key={s.id} value={s.id} disabled={Number(s.id) === Number(effectiveStoreId)}>
                          {s.name ?? s.store_name ?? `Store ${s.id}`} {Number(s.id) === Number(effectiveStoreId) ? "(ini store asal)" : ""}
                        </option>
                      ))}
                    </select>
                    {usageMode === "transfer" && toStoreId === "" && (
                      <div className="text-sm text-red-600 mt-1">Pilih store tujuan untuk transfer.</div>
                    )}
                    {usageMode === "transfer" && Number(toStoreId) === Number(effectiveStoreId) && (
                      <div className="text-sm text-red-600 mt-1">Store tujuan tidak boleh sama dengan store asal.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Measurements / quantity (measurements only + optional custom additional) */}
              <div className="space-y-3">
                {hasMeasurements ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-600">Measurements (patokan satuan terkecil)</div>
                      <button type="button" onClick={addMeasurementRow} className="px-2 py-1 text-xs border rounded">+ Tambah</button>
                    </div>

                    <div className="space-y-2">
                      {measurementRows.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6">
                            <select
                              value={row.measurementId ?? ""}
                              onChange={(e) => updateMeasurementRow(idx, { measurementId: e.target.value === "" ? null : Number(e.target.value) })}
                              className="w-full border rounded px-2 py-1"
                            >
                              <option value="">-- pilih measurement --</option>
                              {measurements && measurements.map((m: any) => (
                                <option key={m.id} value={m.id}>
                                  {m.uom?.name ?? `uom:${m.uom_id}`} — {m.value} {measurementBaseValue(m) ? `(${measurementBaseValue(m)} ${baseUnitLabel})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-4">
                            <input
                              type="number"
                              value={row.count as any}
                              onChange={(e) => updateMeasurementRow(idx, { count: e.target.value === "" ? "" : Number(e.target.value) })}
                              className="w-full border rounded px-2 py-1"
                              placeholder="jumlah (mis. 3 atau 0.5)"
                              step="any"
                            />
                          </div>

                          <div className="col-span-2 flex justify-end">
                            <button type="button" onClick={() => removeMeasurementRow(idx)} className="px-2 py-1 text-xs border rounded text-red-600">Hapus</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Quantity (satuan item)</div>
                    <input
                      type="number"
                      value={simpleQty as any}
                      onChange={e => setSimpleQty(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full border rounded px-2 py-1"
                      placeholder="Masukkan qty sesuai satuan item"
                    />
                    <div className="text-xs text-gray-400 mt-1">Item tidak punya measurement; server akan interpretasikan quantity sesuai item.uom.</div>
                  </div>
                )}
              </div>

              {/* preview and stock */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-600">Preview total (perkiraan {baseUnitLabel})</div>
                  <div className="mt-1 font-semibold text-lg">{Number(previewBase).toLocaleString()} {baseUnitLabel}</div>
                  {currentStock !== null && <div className="text-sm text-gray-500 mt-1">Stok sekarang: <span className="font-medium">{Number(currentStock).toLocaleString()} {baseUnitLabel}</span></div>}
                </div>

                <div className="w-full sm:w-auto">
                  <div className="text-xs text-gray-600 mb-1">Reference</div>
                  <input value={reference} onChange={e => setReference(e.target.value)} className="w-full sm:w-72 border rounded px-2 py-1" />
                </div>
              </div>

              {exceedsStock && (
                <div className="text-sm text-red-600">
                  Pengurangan melebihi stok saat ini: tersedia <strong>{currentStock?.toLocaleString() ?? "—"} {baseUnitLabel}</strong>, Anda mencoba <strong>{Number(previewBase).toLocaleString()} {baseUnitLabel}</strong>.
                </div>
              )}

              <div>
                <div className="text-xs text-gray-600 mb-1">Catatan</div>
                <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded px-2 py-1" rows={3} />
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Batal</button>
                <button
                  type="submit"
                  disabled={!canSave || saving || exceedsStock}
                  className={`px-4 py-2 rounded text-white ${(!canSave || saving || exceedsStock) ? "bg-gray-400 cursor-not-allowed" : "bg-red-600"}`}
                >
                  {saving ? "Menyimpan..." : (usageMode === "transfer" ? "Transfer Stok" : "Kurangi Stok (OUT)")}
                </button>
              </div>
            </form>
          )}
        </ComponentCard>
      </div>
    </>
  );
}
