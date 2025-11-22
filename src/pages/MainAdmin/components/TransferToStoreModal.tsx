// src/pages/central/components/TransferToStoreModal.tsx
import React, { useEffect, useState } from "react";

type Props = {
  open: boolean;
  item: any | null;
  onClose: ()=>void;
  onSubmit: (payload: { storeId: number; quantity: number; measurementId?: number | null; reference?: string; note?: string }) => Promise<void>;
};

export default function TransferToStoreModal({ open, item, onClose, onSubmit }: Props) {
  const [storeId, setStoreId] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number>(0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!open) { setStoreId(""); setQuantity(0); setNote(""); } }, [open]);

  if (!open) return null;
  const itemName = item?.Item?.name ?? item?.name ?? "—";

  const submit = async () => {
    if (!storeId) return alert("Pilih atau masukkan storeId");
    if (!quantity || Number.isNaN(quantity) || quantity <= 0) return alert("Masukkan quantity > 0");
    setLoading(true);
    try {
      await onSubmit({ storeId: Number(storeId), quantity, note });
      onClose();
    } catch (err) {
      // parent handles toast
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded p-4 w-96">
        <h3 className="text-lg font-semibold mb-2">Transfer ke Store — {itemName}</h3>

        <div className="space-y-2">
          <div>
            <label className="text-sm block">Store ID</label>
            <input type="number" value={storeId as any} onChange={e=>setStoreId(e.target.value ? Number(e.target.value) : "")} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="text-sm block">Quantity (base)</label>
            <input type="number" value={quantity} onChange={e=>setQuantity(Number(e.target.value))} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="text-sm block">Note</label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-1 rounded border" onClick={onClose} disabled={loading}>Batal</button>
          <button className="px-3 py-1 rounded bg-yellow-600 text-white" onClick={submit} disabled={loading}>Transfer</button>
        </div>
      </div>
    </div>
  );
}
