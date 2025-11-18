// src/pages/store/components/AddInventoryModal.tsx
import React, { useEffect, useState, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  storeId: number;
  fetchJson: (url: string, opts?: RequestInit) => Promise<any>;
  apiBase: string;
  onSaved?: () => void;
};

const DEBOUNCE_MS = 300;
type MeasurementRow = { measurementId: number | null; count: number | "" };

export default function AddInventoryModal({ open, onClose, storeId, fetchJson, apiBase, onSaved }: Props) {
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [measurements, setMeasurements] = useState<any[] | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // multi-measurement rows + custom grams
  const [measurementRows, setMeasurementRows] = useState<MeasurementRow[]>([]);
  const [useCustomGrams, setUseCustomGrams] = useState(false);
  const [customGrams, setCustomGrams] = useState<number | "">("");
  // new: when item has NO measurements use this simple qty in item's uom
  const [simpleQty, setSimpleQty] = useState<number | "">("");

  const searchTimer = useRef<number | null>(null);
  const lastQuery = useRef<string>("");

  // Search (debounced)
  async function performSearch(q: string) {
    if (q === lastQuery.current) return;
    lastQuery.current = q;

    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const url = `${apiBase}/api/item?search=${encodeURIComponent(q)}`;
    setSearchLoading(true);
    try {
      const raw = await fetchJson(url, { method: "GET" });
      let rows: any[] = [];
      if (Array.isArray(raw)) rows = raw;
      else if (raw && Array.isArray(raw.data)) rows = raw.data;
      else if (raw && Array.isArray(raw.items)) rows = raw.items;
      else {
        const found = Object.values(raw || {}).find(v => Array.isArray(v));
        if (Array.isArray(found)) rows = found as any[];
      }
      setSearchResults(rows || []);
    } catch (err: any) {
      console.error("[Search] error:", err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function doSearch(q: string) {
    setQuery(q);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => performSearch(q), DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => { if (searchTimer.current) window.clearTimeout(searchTimer.current); };
  }, []);

  // Fetch measurements when selectedItem changes (tries plural & singular endpoints)
  useEffect(() => {
    if (!selectedItem) {
      setMeasurements(null);
      setMeasurementRows([]);
      setUseCustomGrams(false);
      setCustomGrams("");
      setSimpleQty("");
      return;
    }

    (async () => {
      const itemId = selectedItem.id ?? selectedItem.itemId ?? selectedItem.item_id ?? selectedItem.Item?.id;
      if (!itemId) return;
      try {
        // try plural then singular route variants
        let body: any = null;
        try {
          body = await fetchJson(`${apiBase}/api/items/${itemId}/measurements`);
        } catch (e) {
          body = await fetchJson(`${apiBase}/api/item/${itemId}/measurements`);
        }
        const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
        setMeasurements(rows || []);

        // init measurement rows if measurements present
        if (rows && rows.length > 0) {
          setMeasurementRows([{ measurementId: rows[0].id, count: "" }]);
          setUseCustomGrams(false);
          setSimpleQty("");
        } else {
          // no measurements: clear measurementRows and default simpleQty to empty
          setMeasurementRows([]);
          setUseCustomGrams(false);
          setCustomGrams("");
          setSimpleQty("");
        }
      } catch (err) {
        console.warn("fetch measurements failed", err);
        setMeasurements(null);
        setMeasurementRows([]);
        setSimpleQty("");
      }
    })();
  }, [selectedItem]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchResults([]);
      setSelectedItem(null);
      setMeasurements(null);
      setReference("");
      setNote("");
      setError(null);
      setSaving(false);
      setMeasurementRows([]);
      setUseCustomGrams(false);
      setCustomGrams("");
      setSimpleQty("");
    }
  }, [open]);

  // helpers to manage measurement rows
  function addMeasurementRow() {
    setMeasurementRows(prev => [...prev, { measurementId: null, count: "" }]);
  }
  function updateMeasurementRow(index: number, patch: Partial<MeasurementRow>) {
    setMeasurementRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
  }
  function removeMeasurementRow(index: number) {
    setMeasurementRows(prev => prev.filter((_, i) => i !== index));
  }

  // compute preview grams (client-side estimate using measurement.value_in_grams or value)
  const previewGrams = (() => {
    let total = 0;
    if (Array.isArray(measurementRows) && measurements) {
      for (const r of measurementRows) {
        if (!r.measurementId || r.count === "" || Number(r.count) <= 0) continue;
        const m = measurements.find(m => Number(m.id) === Number(r.measurementId));
        const gramsPer = Number(m?.value_in_grams ?? m?.value ?? 0);
        total += gramsPer * Number(r.count);
      }
    }
    if (customGrams !== "" && !Number.isNaN(Number(customGrams))) {
      total += Number(customGrams);
    }
    // when no measurements and simpleQty present: try convert using selectedItem.uom -> server is authoritative,
    // but if selectedItem includes conversion to grams you can show estimate (we try if provided as selectedItem.uom_in_grams)
    if ((!measurements || measurements.length === 0) && simpleQty !== "" && selectedItem) {
      // optional: if selectedItem has 'uom_in_grams' or 'uom.value_in_grams'
      const uomInGrams = selectedItem.uom_in_grams ?? selectedItem.uom?.value_in_grams ?? selectedItem.uom?.grams_per_unit ?? null;
      if (uomInGrams) total += Number(simpleQty) * Number(uomInGrams);
    }
    return total;
  })();

  // validation
  const hasValidMeasurementRows = measurementRows.length > 0 && measurementRows.some(r => r.measurementId && r.count !== "" && Number(r.count) > 0);
  const hasSimpleQty = simpleQty !== "" && Number(simpleQty) > 0;
  // determine if selected item has measurements available:
  const hasMeasurements = measurements && Array.isArray(measurements) && measurements.length > 0;

  // can save logic:
  // - if item has measurements: require measurementRows valid OR customGrams >0
  // - if item has NO measurements: require simpleQty >0
  const canSave = !saving && !!selectedItem && (
    (hasMeasurements ? (hasValidMeasurementRows || (customGrams !== "" && Number(customGrams) > 0)) : hasSimpleQty)
  );

  async function handleSave() {
    setError(null);
    if (!selectedItem) { setError("Pilih item"); return; }

    const payload: any = { itemId: selectedItem.id ?? selectedItem.itemId ?? selectedItem.item_id, type: "IN", reference: reference || null, note: note || null };

    if (hasMeasurements) {
      // measurement mode (as before)
      if (!hasValidMeasurementRows && !(customGrams !== "" && Number(customGrams) > 0)) {
        setError("Tambahkan setidaknya satu measurement dengan jumlah > 0 atau masukkan gram tambahan.");
        return;
      }
      payload.measurementEntries = measurementRows
        .filter(r => r.measurementId && r.count !== "" && Number(r.count) > 0)
        .map(r => ({ measurementId: Number(r.measurementId), count: Number(r.count) }));
      if (customGrams !== "" && Number(customGrams) > 0) payload.customGrams = Number(customGrams);
    } else {
      // no measurements -> use item uom quantity
      if (!hasSimpleQty) {
        setError("Masukkan quantity (satuan item) minimal > 0");
        return;
      }
      // include uomId from selectedItem (try several possible fields)
      const uomId = selectedItem.uom_id ?? selectedItem.uomId ?? selectedItem.Uom?.id ?? selectedItem.uom?.id ?? null;
      payload.quantity = Number(simpleQty);
      payload.uomId = uomId; // backend should interpret as "quantity in item uom"
      payload.uomSource = "item_uom";
    }

    setSaving(true);
    try {
      await fetchJson(`${apiBase}/api/stores/${storeId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error("failed add inventory", err);
      setError(err.message || "Gagal menambah inventory");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const itemUomName = selectedItem?.uom?.name ?? selectedItem?.uom_name ?? "unit";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl bg-white rounded shadow p-4">
        <header className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Add inventory to store #{storeId}</h3>
          <button onClick={onClose} className="text-sm text-gray-500">Close</button>
        </header>

        <div className="space-y-3">
          <label>
            <div className="text-xs text-gray-600 mb-1">Search item (min 2 chars)</div>
            <input value={query} onChange={(e) => doSearch(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="Search item by name or code..." />
          </label>

          <div className="max-h-40 overflow-auto border rounded p-2 bg-gray-50">
            {searchLoading ? <div className="text-sm text-gray-500">Searching...</div> : (
              searchResults.length === 0 ? <div className="text-sm text-gray-400">No results</div> :
                searchResults.map(it => {
                  const id = it.id ?? it.itemId ?? it.item_id;
                  return (
                    <div key={id} className={`p-2 rounded cursor-pointer ${selectedItem && (selectedItem.id ?? selectedItem.itemId ?? selectedItem.item_id) === id ? 'bg-indigo-100' : 'hover:bg-white'}`} onClick={() => setSelectedItem(it)}>
                      <div className="font-medium text-sm">{it.name ?? it.Item?.name ?? it.code ?? it.kode ?? `Item ${id}`}</div>
                      <div className="text-xs text-gray-500">{it.code ?? it.kode ?? ''}</div>
                    </div>
                  );
                })
            )}
          </div>

          {selectedItem && (
            <>
              <div className="text-sm text-gray-700">Selected: <strong>{selectedItem.name ?? selectedItem.Item?.name}</strong></div>

              {/* If item has measurements show measurement UI, otherwise show simple qty in item's uom */}
              {hasMeasurements ? (
                <>
                  <div className="flex gap-2 items-center">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={!useCustomGrams} onChange={() => setUseCustomGrams(false)} />
                      <span className="text-sm">Use measurement rows</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={useCustomGrams} onChange={() => setUseCustomGrams(true)} />
                      <span className="text-sm">Custom (grams)</span>
                    </label>
                  </div>

                  {!useCustomGrams ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-600">Measurements</div>
                          <button type="button" onClick={addMeasurementRow} className="px-2 py-1 text-xs border rounded">+ Add measurement</button>
                        </div>

                        {measurementRows.length === 0 && <div className="text-xs text-gray-400">No measurement rows. Klik "Add measurement" untuk menambah.</div>}

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
                                      {m.uom?.name ?? `uom:${m.uom_id}`} — {m.value} ({m.value_in_grams ? `${m.value_in_grams} g` : 'no grams'})
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
                                  placeholder="count (e.g. 3 or 0.5)"
                                />
                              </div>

                              <div className="col-span-2 flex justify-end">
                                <button type="button" onClick={() => removeMeasurementRow(idx)} className="px-2 py-1 text-xs border rounded text-red-600">Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <label>
                        <div className="text-xs text-gray-600 mb-1">Optional extra grams</div>
                        <input type="number" value={customGrams as any} onChange={e => setCustomGrams(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border rounded px-2 py-1" placeholder="e.g. 120" />
                        <div className="text-xs text-gray-400 mt-1">Tambahkan gram tambahan jika ada (boleh dikombinasikan).</div>
                      </label>
                    </>
                  ) : (
                    <label>
                      <div className="text-xs text-gray-600 mb-1">Sisa (grams)</div>
                      <input type="number" value={customGrams as any} onChange={e => setCustomGrams(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border rounded px-2 py-1" />
                      <div className="text-xs text-gray-400 mt-1">Masukkan nilai dalam gram jika tidak memakai measurement.</div>
                    </label>
                  )}
                </>
              ) : (
                // NO measurements: show simple qty using item.uom
                <div>
                  <label>
                    <div className="text-xs text-gray-600 mb-1">Quantity ({itemUomName})</div>
                    <input type="number" value={simpleQty as any} onChange={e => setSimpleQty(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border rounded px-2 py-1" placeholder={`e.g. 2 (${itemUomName})`} />
                    <div className="text-xs text-gray-400 mt-1">Item ini tidak memiliki measurement — masukkan quantity sesuai satuan item ({itemUomName}).</div>
                  </label>
                </div>
              )}

              <div className="text-sm text-gray-600">
                Preview total (grams, estimate): <strong>{previewGrams.toLocaleString()}</strong>
                {(!measurements || measurements.length === 0) && <div className="text-xs text-gray-400">Catatan: konversi akhir dilakukan di server jika perlu.</div>}
              </div>

              <label>
                <div className="text-xs text-gray-600 mb-1">Reference</div>
                <input value={reference} onChange={e => setReference(e.target.value)} className="w-full border rounded px-2 py-1" />
              </label>

              <label>
                <div className="text-xs text-gray-600 mb-1">Note</div>
                <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded px-2 py-1" rows={3} />
              </label>
            </>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
            <button onClick={handleSave} disabled={!canSave || saving} className="px-3 py-1 rounded bg-green-600 text-white">{saving ? "Saving..." : "Add inventory"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
