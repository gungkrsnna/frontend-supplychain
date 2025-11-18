// src/pages/store/components/ProductionLeftoverModal.tsx
import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  item: any | null;
  onClose: () => void;
  storeId: number;
  fetchJson: (url: string, opts?: RequestInit) => Promise<any>;
  apiBase: string;
  onSaved?: () => void;
};

export default function ProductionLeftoverModal({ open, item, onClose, storeId, fetchJson, apiBase, onSaved }: Props) {
  const [quantity, setQuantity] = useState<number | "">("");
  const [measurementId, setMeasurementId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<any[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuantity("");
    setMeasurementId(null);
    setReference("");
    setNote("");
    setSaving(false);
    setError(null);

    (async () => {
      if (!item) return;
      const itemId = item.itemId ?? item.item_id ?? item.Item?.id;
      if (!itemId) return;
      try {
        const body = await fetchJson(`${apiBase}/api/items/${itemId}/measurements`);
        const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
        setMeasurements(rows || []);
      } catch (err) {
        setMeasurements(null);
      }
    })();
  }, [open, item]);

  if (!open || !item) return null;

  async function handleSave() {
    setError(null);
    if (quantity === "" || Number(quantity) <= 0) { setError("Quantity harus > 0"); return; }
    setSaving(true);
    try {
      const payload = {
        itemId: item.itemId ?? item.item_id ?? item.Item?.id,
        measurementId: measurementId ?? null,
        quantity: Number(quantity),
        type: "LEFTOVER_RETURN",
        reference: reference || null,
        note: note || null
      };
      await fetchJson(`${apiBase}/api/stores/${storeId}/transactions`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      onSaved?.();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white rounded shadow p-4">
        <header className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Add leftover from production — {item.Item?.name ?? item.name}</h3>
          <button onClick={onClose} className="text-sm text-gray-500">Close</button>
        </header>

        <div className="space-y-3">
          <label>
            <div className="text-xs text-gray-600 mb-1">Quantity</div>
            <input type="number" value={quantity as any} onChange={e => setQuantity(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border rounded px-2 py-1" />
          </label>

          <label>
            <div className="text-xs text-gray-600 mb-1">Measurement (optional)</div>
            {measurements ? (
              <select value={measurementId ?? ""} onChange={e => setMeasurementId(e.target.value === "" ? null : Number(e.target.value))} className="w-full border rounded px-2 py-1">
                <option value="">-- base unit --</option>
                {measurements.map(m => <option key={m.id} value={m.id}>{m.uom?.name ?? m.name} — {m.value}</option>)}
              </select>
            ) : <input type="number" placeholder="measurementId" value={measurementId ?? ""} onChange={e => setMeasurementId(e.target.value === "" ? null : Number(e.target.value))} className="w-full border rounded px-2 py-1" />}
          </label>

          <label>
            <div className="text-xs text-gray-600 mb-1">Reference (production id)</div>
            <input value={reference} onChange={e => setReference(e.target.value)} className="w-full border rounded px-2 py-1" />
          </label>

          <label>
            <div className="text-xs text-gray-600 mb-1">Note</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full border rounded px-2 py-1" rows={3} />
          </label>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-3 py-1 rounded bg-indigo-600 text-white">{saving ? "Saving..." : "Add leftover"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
