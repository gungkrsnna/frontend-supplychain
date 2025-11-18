// src/pages/store/TransactionPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../../context/AuthContext";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ComponentCard from "../../../components/common/ComponentCard";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type MeasurementRow = { measurementId: number | null; count: number | "" };

// small util to safely coerce to number
function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Local fetch helper (kept same semantics as original)
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

export default function TransactionPage(): JSX.Element {
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
  const [useCustomGrams, setUseCustomGrams] = useState(false);
  const [customGrams, setCustomGrams] = useState<number | "">("");
  const [simpleQty, setSimpleQty] = useState<number | "">("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // normalise item shape
  const itemObj = useMemo(() => {
    if (!item) return null;
    return item.Item ?? item.item ?? item;
  }, [item]);

  // Load item if not passed
  useEffect(() => {
    let mounted = true;
    async function loadItem() {
      if (item && (item.id || item.itemId || item.item_id || (item.Item && item.Item.id))) {
        // already have full item
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
            // ignore and try next
          }
        }
        if (!body) throw new Error("No response body for item");
        const it = (body && body.data) ? body.data : (body && body.item) ? body.item : body;
        if (!it) throw new Error("Could not parse item from response");
        if (mounted) setItem(it);
      } catch (err: any) {
        if (mounted) setError(err.message || "Gagal memuat item");
      } finally {
        if (mounted) setLoadingItem(false);
      }
    }
    loadItem();
    return () => { mounted = false; };
    // intentionally not depending on `item` to avoid fetch loop
  }, [itemIdFromParams, fetchJson, API_BASE]);

  // fetch measurements for item
  useEffect(() => {
    const id = itemObj?.id ?? item?.itemId ?? item?.item_id ?? null;
    if (!id) {
      setMeasurements(null);
      setMeasurementRows([]);
      setSimpleQty("");
      setCustomGrams("");
      setUseCustomGrams(false);
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
            // continue
          }
        }
        const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
        setMeasurements(rows || []);
        if (rows && rows.length > 0) {
          setMeasurementRows([{ measurementId: rows[0].id, count: "" }]);
        } else {
          setMeasurementRows([]);
        }
        setUseCustomGrams(false);
        setSimpleQty("");
        setCustomGrams("");
      } catch (err) {
        setMeasurements(null);
      }
    })();
  }, [itemObj?.id, fetchJson, API_BASE]);

  // helpers for measurement rows
  function addMeasurementRow() { setMeasurementRows(prev => [...prev, { measurementId: null, count: "" }]); }
  function updateMeasurementRow(index: number, patch: Partial<MeasurementRow>) { setMeasurementRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r)); }
  function removeMeasurementRow(index: number) { setMeasurementRows(prev => prev.filter((_, i) => i !== index)); }

  // preview grams calculation (same logic, but format for display)
  const previewGrams = useMemo(() => {
    let total = 0;
    if (Array.isArray(measurementRows) && measurements) {
      for (const r of measurementRows) {
        if (!r.measurementId || r.count === "" || Number(r.count) <= 0) continue;
        const m = measurements.find(m => Number(m.id) === Number(r.measurementId));
        const gramsPer = Number(m?.value_in_grams ?? m?.value ?? 0);
        total += gramsPer * Number(r.count);
      }
    }
    if (customGrams !== "" && !Number.isNaN(Number(customGrams))) total += Number(customGrams);

    if ((!measurements || measurements.length === 0) && simpleQty !== "" && itemObj) {
      const uomInGrams = itemObj.uom_in_grams ?? itemObj.uom?.value_in_grams ?? itemObj.uom?.grams_per_unit ?? null;
      if (uomInGrams) total += Number(simpleQty) * Number(uomInGrams);
    }
    return total;
  }, [measurementRows, measurements, customGrams, simpleQty, itemObj]);

  const hasMeasurements = !!(measurements && Array.isArray(measurements) && measurements.length > 0);
  const hasValidMeasurementRows = measurementRows.length > 0 && measurementRows.some(r => r.measurementId && r.count !== "" && Number(r.count) > 0);
  const hasSimpleQty = simpleQty !== "" && Number(simpleQty) > 0;
  const canSave = !saving && !!itemObj && ((hasMeasurements ? (hasValidMeasurementRows || (customGrams !== "" && Number(customGrams) > 0)) : hasSimpleQty));

  // helper to extract friendly message from error thrown by useFetchJson or other
  function friendlyErrorMessage(err: any) {
    if (!err) return "Terjadi kesalahan";
    // If Error instance with message
    if (err instanceof Error && err.message) {
      return err.message;
    }
    // If server returned object
    if (typeof err === "object") {
      if (err.message) return String(err.message);
      if (err.error) return String(err.error);
      try {
        return JSON.stringify(err);
      } catch {
        return String(err);
      }
    }
    return String(err);
  }

  // submit
  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    if (!itemObj) { setError("Pilih item"); toast.error("Pilih item terlebih dahulu"); return; }
    if (!effectiveStoreId || Number.isNaN(effectiveStoreId) || effectiveStoreId <= 0) {
      setError("Store ID tidak valid");
      toast.error("Store ID tidak valid");
      return;
    }

    const payload: any = { itemId: itemObj.id ?? itemObj.itemId ?? itemObj.item_id, type: "IN", reference: reference || null, note: note || null };

    if (hasMeasurements) {
      if (!hasValidMeasurementRows && !(customGrams !== "" && Number(customGrams) > 0)) {
        const msg = "Tambahkan setidaknya satu measurement dengan jumlah > 0 atau masukkan gram tambahan.";
        setError(msg);
        toast.error(msg);
        return;
      }
      payload.measurementEntries = measurementRows
        .filter(r => r.measurementId && r.count !== "" && Number(r.count) > 0)
        .map(r => ({ measurementId: Number(r.measurementId), count: Number(r.count) }));
      if (customGrams !== "" && Number(customGrams) > 0) payload.customGrams = Number(customGrams);
    } else {
      if (!hasSimpleQty) {
        const msg = "Masukkan quantity (satuan item) minimal > 0";
        setError(msg);
        toast.error(msg);
        return;
      }
      const uomId = itemObj.uom_id ?? itemObj.uomId ?? itemObj.Uom?.id ?? itemObj.uom?.id ?? null;
      payload.quantity = Number(simpleQty);
      payload.uomId = uomId;
      payload.uomSource = "item_uom";
    }

    setSaving(true);
    try {
      await fetchJson(`${API_BASE}/api/stores/${effectiveStoreId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      // success: toast + navigate
      toast.success("Transaksi berhasil");
      // navigate after showing toast — immediate navigation may hide page toast if ToastContainer not global
      // still navigate to inventory page to keep previous behaviour
      // di TransactionPage.tsx setelah sukses:
      navigate(`/stores/${storeId}/inventory`, { state: { toast: { type: 'success', message: 'Transaksi berhasil' } } });

    } catch (err: any) {
      const friendly = friendlyErrorMessage(err);
      setError(friendly);
      toast.error(friendly);
    } finally {
      setSaving(false);
    }
  }

  // when no item available
  if (!item && !loadingItem) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-2">Transaction — Pilih item</h2>
        <div className="text-sm text-gray-600 mb-3">Halaman ini memerlukan itemId pada URL atau dipanggil dengan state.item dari halaman inventory.</div>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
        </div>
        {error && <div className="mt-3 text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`Transaction - ${itemObj?.name ?? "Item"}`} />
      <PageBreadcrumb pageTitle="Update Stock" />

      <div className="p-4 mx-auto">
        <ComponentCard title="Perbarui Stock & Preview">
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
                    
                  </div>
                </div>
              </div>

              {/* Measurements / quantity section */}
              <div className="space-y-3">
                {hasMeasurements ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="measurementMode"
                          checked={!useCustomGrams}
                          onChange={() => setUseCustomGrams(false)}
                        />
                        <span className="text-sm">Gunakan measurement</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="measurementMode"
                          checked={useCustomGrams}
                          onChange={() => setUseCustomGrams(true)}
                        />
                        <span className="text-sm">Custom (grams)</span>
                      </label>
                    </div>

                    {!useCustomGrams ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-600">Measurements</div>
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
                                      {m.uom?.name ?? `uom:${m.uom_id}`} — {m.value} {m.value_in_grams ? `(${m.value_in_grams} g)` : ""}
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

                        <div>
                          <div className="text-xs text-gray-600 mb-1">Gram tambahan (opsional)</div>
                          <input
                            type="number"
                            value={customGrams as any}
                            onChange={e => setCustomGrams(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full border rounded px-2 py-1"
                            placeholder="mis. 120"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Masukkan gram</div>
                        <input
                          type="number"
                          value={customGrams as any}
                          onChange={e => setCustomGrams(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full border rounded px-2 py-1"
                          placeholder="mis. 500"
                        />
                      </div>
                    )}
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

              {/* preview and metadata */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-600">Preview total (perkiraan grams)</div>
                  <div className="mt-1 font-semibold text-lg">{Number(previewGrams).toLocaleString()} g</div>
                </div>

                <div className="w-full sm:w-auto">
                  <div className="text-xs text-gray-600 mb-1">Reference</div>
                  <input value={reference} onChange={e => setReference(e.target.value)} className="w-full sm:w-72 border rounded px-2 py-1" />
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-600 mb-1">Catatan</div>
                <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded px-2 py-1" rows={3} />
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Batal</button>
                <button
                  type="submit"
                  disabled={!canSave || saving}
                  className={`px-4 py-2 rounded text-white ${(!canSave || saving) ? "bg-gray-400 cursor-not-allowed" : "bg-green-600"}`}
                >
                  {saving ? "Menyimpan..." : "Simpan (Perbarui stock)"}
                </button>
              </div>
            </form>
          )}
        </ComponentCard>
      </div>

      {/* Toast container — hapus jika Anda punya ToastContainer global */}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </>
  );
}
