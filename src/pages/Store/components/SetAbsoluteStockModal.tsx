// src/pages/store/components/SetAbsoluteStockModal.tsx
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

export default function SetAbsoluteStockModal({ open, item, onClose, storeId, fetchJson, apiBase, onSaved }: Props) {
  const [absolute, setAbsolute] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAbsolute(item ? Number(item.stock ?? 0) : "");
    setReason("");
    setError(null);
  }, [open, item]);

  if (!open || !item) return null;
  const itemId = item.itemId ?? item.item_id ?? item.Item?.id;

  async function submit() {
    setError(null);
    if (absolute === "") { setError("Absolute stock required"); return; }
    if (!reason) { setError("Reason required"); return; }
    setLoading(true);
    try {
      await fetchJson(`${apiBase}/api/stores/${storeId}/inventory/${itemId}/set`, {
        method: "PATCH",
        body: JSON.stringify({ absoluteStock: Number(absolute), reason })
      });
      onSaved?.();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg bg-white rounded shadow p-4">
        <header className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Set Absolute Stock — {item.Item?.name ?? item.name}</h3>
          <button onClick={onClose} className="text-sm text-gray-500">Close</button>
        </header>

        <div className="space-y-3">
          <div className="text-sm text-gray-600">Current stock: <strong>{Number(item.stock ?? 0).toLocaleString()}</strong></div>
          <label>
            <div className="text-xs text-gray-600 mb-1">New absolute stock</div>
            <input type="number" value={absolute as any} onChange={e => setAbsolute(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border rounded px-2 py-1" />
          </label>

          <label>
            <div className="text-xs text-gray-600 mb-1">Reason (required)</div>
            <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full border rounded px-2 py-1" rows={3} />
          </label>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
            <button onClick={submit} disabled={loading || !reason} className="px-3 py-1 rounded bg-red-600 text-white">{loading ? "Saving..." : "Set stock"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
