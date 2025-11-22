// src/pages/central/components/AddCentralModal.tsx
import React, { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  centralId: number;
  fetchJson: (url: string, opts?: RequestInit) => Promise<any>;
  apiBase: string;
  onSaved?: () => void;
};

const DEBOUNCE_MS = 300;
type MeasurementRow = { measurementId: number | null; count: number | "" };

export default function AddCentralModal({ open, onClose, centralId, fetchJson, apiBase, onSaved }: Props) {
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [measurements, setMeasurements] = useState<any[] | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // multi-measurement rows + custom extra in base unit
  const [measurementRows, setMeasurementRows] = useState<MeasurementRow[]>([]);
  const [useCustomBase, setUseCustomBase] = useState(false);
  const [customBase, setCustomBase] = useState<number | "">("");
  // when item has NO measurements use this simple qty in item's uom
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

    // use provided apiBase but allow fetchJson to normalize if parent provides relative paths
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
      console.error("[Central Search] error:", err);
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
      setUseCustomBase(false);
      setCustomBase("");
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
          body = await fetchJson(`${apiBase}/api/item/${itemId}/measurements`);
        } catch (e) {
          body = await fetchJson(`${apiBase}/api/items/${itemId}/measurements`);
        }
        const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
        setMeasurements(rows || []);

        // init measurement rows if measurements present
        if (rows && rows.length > 0) {
          // default row uses first measurement as base reference
          setMeasurementRows([{ measurementId: rows[0].id, count: "" }]);
          setUseCustomBase(false);
          setSimpleQty("");
        } else {
          // no measurements: clear measurementRows and default simpleQty to empty
          setMeasurementRows([]);
          setUseCustomBase(false);
          setCustomBase("");
          setSimpleQty("");
        }
      } catch (err) {
        console.warn("fetch measurements failed", err);
        setMeasurements(null);
        setMeasurementRows([]);
        setSimpleQty("");
      }
    })();
  }, [selectedItem, fetchJson, apiBase]);

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
      setUseCustomBase(false);
      setCustomBase("");
      setSimpleQty("");
    }
  }, [open]);

  // helpers
  function addMeasurementRow() {
    setMeasurementRows(prev => [...prev, { measurementId: null, count: "" }]);
  }
  function updateMeasurementRow(index: number, patch: Partial<MeasurementRow>) {
    setMeasurementRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
  }
  function removeMeasurementRow(index: number) {
    setMeasurementRows(prev => prev.filter((_, i) => i !== index));
  }

  // compute preview in base units (using measurement[0] as reference/base)
  // measurement object expected to include either:
  //  - value_in_base (preferred) OR
  //  - value (fallback) OR
  //  - treat value as multiplier to base unit
  const previewBaseTotal = (() => {
    let total = 0;
    if (Array.isArray(measurementRows) && measurements) {
      for (const r of measurementRows) {
        if (!r.measurementId || r.count === "" || Number(r.count) <= 0) continue;
        const m = measurements.find(m => Number(m.id) === Number(r.measurementId));
        // prefer explicit base multiplier, fallback to generic value, else 1
        const perBase = Number(m?.value_in_base ?? m?.value ?? 1);
        total += perBase * Number(r.count);
      }
    }
    if (customBase !== "" && !Number.isNaN(Number(customBase))) {
      total += Number(customBase);
    }
    // when no measurements and simpleQty present: use simpleQty as base units (server authoritative)
    if ((!measurements || measurements.length === 0) && simpleQty !== "" && selectedItem) {
      total += Number(simpleQty);
    }
    return total;
  })();

  // validation
  const hasValidMeasurementRows = measurementRows.length > 0 && measurementRows.some(r => r.measurementId && r.count !== "" && Number(r.count) > 0);
  const hasSimpleQty = simpleQty !== "" && Number(simpleQty) > 0;
  const hasMeasurements = measurements && Array.isArray(measurements) && measurements.length > 0;

  const canSave = !saving && !!selectedItem && (
    (hasMeasurements ? (hasValidMeasurementRows || (customBase !== "" && Number(customBase) > 0)) : hasSimpleQty)
  );

  async function handleSave() {
    setError(null);
    if (!selectedItem) { setError("Pilih item"); return; }

    const payload: any = {
      itemId: selectedItem.id ?? selectedItem.itemId ?? selectedItem.item_id,
      type: "IN",
      reference: reference || null,
      note: note || null
    };

    if (hasMeasurements) {
      if (!hasValidMeasurementRows && !(customBase !== "" && Number(customBase) > 0)) {
        setError("Tambahkan setidaknya satu measurement dengan jumlah > 0 atau masukkan tambahan base unit.");
        return;
      }
      payload.measurementEntries = measurementRows
        .filter(r => r.measurementId && r.count !== "" && Number(r.count) > 0)
        .map(r => ({ measurementId: Number(r.measurementId), count: Number(r.count) }));

      if (customBase !== "" && Number(customBase) > 0) payload.customBase = Number(customBase);

      // backward compatibility: if measurements include grams info, also send customGrams
      // compute estimated grams if measurement objects carry value_in_grams
      const gramsEstimate = (() => {
        let g = 0;
        if (Array.isArray(measurementRows) && measurements) {
          for (const r of measurementRows) {
            if (!r.measurementId || r.count === "" || Number(r.count) <= 0) continue;
            const m = measurements.find(m => Number(m.id) === Number(r.measurementId));
            const perGram = Number(m?.value_in_grams ?? 0);
            g += perGram * Number(r.count);
          }
        }
        if (customBase !== "" && !Number.isNaN(Number(customBase))) {
          // if there is a declared 'base->grams' for measurement[0], try to estimate
          const baseToGram = Number(measurements?.[0]?.value_in_grams ?? 0);
          if (baseToGram) g += baseToGram * Number(customBase);
        }
        return g;
      })();
      if (gramsEstimate > 0) payload.customGrams = gramsEstimate;
    } else {
      // no measurements -> use item uom quantity
      if (!hasSimpleQty) {
        setError("Masukkan quantity (satuan item) minimal > 0");
        return;
      }
      const uomId = selectedItem.uom_id ?? selectedItem.uomId ?? selectedItem.Uom?.id ?? selectedItem.uom?.id ?? null;
      payload.quantity = Number(simpleQty);
      payload.uomId = uomId;
      payload.uomSource = "item_uom";
    }

    setSaving(true);
    try {
      await fetchJson(`${apiBase}/api/central/${centralId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error("failed add central inventory", err);
      setError(err.message || "Gagal menambah inventory central");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const itemUomName = selectedItem?.uom?.name ?? selectedItem?.uom_name ?? "unit";
  const baseUnitLabel = (() => {
    // try to show label for base unit using measurement[0] uom or generic "base unit"
    if (measurements && measurements.length > 0) {
      const m0 = measurements[0];
      return m0.uom?.name ?? m0.unit_name ?? `base:${m0.id}`;
    }
    return itemUomName;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl bg-white rounded shadow p-4">
        <header className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Add inventory to central #{centralId}</h3>
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

              {hasMeasurements ? (
                <>
                  <div className="flex gap-2 items-center">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={!useCustomBase} onChange={() => setUseCustomBase(false)} />
                      <span className="text-sm">Use measurement rows</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={useCustomBase} onChange={() => setUseCustomBase(true)} />
                      <span className="text-sm">Custom ({baseUnitLabel})</span>
                    </label>
                  </div>

                  {!useCustomBase ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-600">Measurements (first measurement used as base unit)</div>
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
                                      {m.uom?.name ?? `uom:${m.uom_id}`} — {m.value} (per base: {m.value_in_base ?? m.value ?? 1})
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
                        <div className="text-xs text-gray-600 mb-1">Optional extra ({baseUnitLabel})</div>
                        <input type="number" value={customBase as any} onChange={e => setCustomBase(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border rounded px-2 py-1" placeholder={`e.g. 1.5 (${baseUnitLabel})`} />
                        <div className="text-xs text-gray-400 mt-1">Tambahkan nilai tambahan dalam unit dasar ({baseUnitLabel}).</div>
                      </label>
                    </>
                  ) : (
                    <label>
                      <div className="text-xs text-gray-600 mb-1">Custom extra ({baseUnitLabel})</div>
                      <input type="number" value={customBase as any} onChange={e => setCustomBase(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border rounded px-2 py-1" />
                      <div className="text-xs text-gray-400 mt-1">Masukkan nilai tambahan dalam unit dasar bila tidak memakai measurement rows.</div>
                    </label>
                  )}
                </>
              ) : (
                <div>
                  <label>
                    <div className="text-xs text-gray-600 mb-1">Quantity ({itemUomName})</div>
                    <input type="number" value={simpleQty as any} onChange={e => setSimpleQty(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border rounded px-2 py-1" placeholder={`e.g. 2 (${itemUomName})`} />
                    <div className="text-xs text-gray-400 mt-1">Item ini tidak memiliki measurement — masukkan quantity sesuai satuan item ({itemUomName}).</div>
                  </label>
                </div>
              )}

              <div className="text-sm text-gray-600">
                Preview total (base units estimate): <strong>{previewBaseTotal.toLocaleString()}</strong>
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
