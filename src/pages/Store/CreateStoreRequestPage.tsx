// src/pages/store/CreateStoreRequestPage.tsx
import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthContext } from "../../context/AuthContext"; // pastikan path benar

type Row = {
  id: string;
  item_id?: number | null;
  requested_qty?: number | "" ;
  uom_id?: number | null;
  note?: string;
  item?: any;
};

export default function CreateStoreRequestPage(): JSX.Element {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const storeId = Number(user?.storeId ?? user?.store_id ?? 0);

  const [rows, setRows] = useState<Row[]>([{ id: String(Date.now()), item_id: null, requested_qty: "", uom_id: null, note: "" }]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // search for items (non-production)
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!search || !search.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    debounceRef.current = window.setTimeout(() => {
      performSearch(search);
      debounceRef.current = null;
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [search]);

  async function performSearch(q: string) {
    try {
      // filter non-production (is_production=0)
      const resp = await axios.get("/api/item/search", { params: { q, is_production: 0, limit: 50 } });
      const rows = resp.data?.data ?? resp.data ?? [];
      setSearchResults(rows);
    } catch (err) {
      console.warn(err);
      toast.error("Gagal mencari item");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function addRow() {
    setRows(prev => [...prev, { id: String(Date.now() + Math.random()), item_id: null, requested_qty: "", uom_id: null, note: "" }]);
  }
  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }
  function updateRow(id: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function selectItemForRow(rowId: string, item: any) {
    // When item has measurements, we default uom_id to either:
    // - the item's uom_id (if provided), or
    // - the first measurement's uom id (if available).
    let defaultUom = item.uom_id ?? null;
    if ((!defaultUom || defaultUom === null) && Array.isArray(item.measurements) && item.measurements.length > 0) {
      const firstMeasurement = item.measurements[0];
      defaultUom = firstMeasurement?.uom?.id ?? firstMeasurement?.uom_id ?? null;
    }

    updateRow(rowId, { item_id: item.id, item, uom_id: defaultUom });
    setSearch("");
    setSearchResults([]);
  }

  function validate(): boolean {
    if (!storeId || Number.isNaN(storeId)) { toast.error("Store ID tidak valid pada profile Anda"); return false; }
    const filledRows = rows.filter(r => r.item_id && r.requested_qty !== "" && Number(r.requested_qty) > 0);
    if (filledRows.length === 0) { toast.error("Tambahkan setidaknya 1 item dengan quantity > 0"); return false; }
    for (const r of filledRows) {
      if (!r.item_id) { toast.error("Pilih item untuk setiap baris yang diisi"); return false; }
      const q = Number(r.requested_qty);
      if (!Number.isFinite(q) || q <= 0) { toast.error("Quantity harus > 0"); return false; }
    }
    return true;
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!validate()) return;

    const payloadItems = rows
      .filter(r => r.item_id && r.requested_qty !== "" && Number(r.requested_qty) > 0)
      .map(r => ({
        item_id: Number(r.item_id),
        requested_qty: Number(r.requested_qty),
        uom_id: r.uom_id ?? null,
        note: r.note ?? null
      }));

    const body = {
      storeId,
      items: payloadItems,
      note
    };

    try {
      setSaving(true);
      const resp = await axios.post("/api/store-requests", body);
      const created = resp.data?.data ?? resp.data;
      toast.success("Request berhasil dibuat");
      navigate(`/stores/requests`); // route daftar request store (tanpa param)
    } catch (err: any) {
      console.error("create request error", err);
      toast.error(err?.response?.data?.message || err?.message || "Gagal membuat request");
    } finally {
      setSaving(false);
    }
  }

  if (!storeId || Number.isNaN(storeId) || storeId <= 0) {
    return (
      <div className="p-6">
        <div className="text-red-600">Store ID tidak ditemukan pada profile Anda. Tidak bisa membuat request.</div>
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto">
      <ToastContainer position="top-right" autoClose={2500} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Buat Permintaan — Store {storeId}</h2>
          <div className="text-sm text-gray-500">Pilih item non-production, masukkan qty, lalu kirim ke admin.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Batal</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded shadow">
        <div>
          <label className="text-xs block mb-1">Cari item (non-production)</label>
          <input
            placeholder="Cari nama atau kode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border px-3 py-2 rounded"
          />
          {searchLoading && <div className="text-xs text-gray-500 mt-1">Mencari...</div>}
          {searchResults.length > 0 && (
            <div className="border rounded mt-2 max-h-48 overflow-auto bg-white">
              {searchResults.map((it: any) => (
                <div key={it.id} className="p-2 hover:bg-gray-50 cursor-pointer" onClick={() => {
                  const empty = rows.find(r => !r.item_id);
                  if (empty) selectItemForRow(empty.id, it);
                  else {
                    const newRowId = String(Date.now() + Math.random());
                    // default uom as same logic as selectItemForRow
                    let defaultUom = it.uom_id ?? null;
                    if ((!defaultUom || defaultUom === null) && Array.isArray(it.measurements) && it.measurements.length > 0) {
                      const firstMeasurement = it.measurements[0];
                      defaultUom = firstMeasurement?.uom?.id ?? firstMeasurement?.uom_id ?? null;
                    }
                    setRows(prev => [...prev, { id: newRowId, item_id: it.id, requested_qty: "", uom_id: defaultUom, item: it }]);
                  }
                  setSearch("");
                  setSearchResults([]);
                }}>
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-gray-500">{it.code ?? ""} — uom: {it.uom?.name ?? it.uom_id ?? "-"}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {rows.map((r, idx) => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center border rounded p-2">
              <div className="col-span-6">
                <div className="text-xs text-gray-500">Item</div>
                {r.item ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.item.name}</div>
                      <div className="text-xs text-gray-500">{r.item.code ?? ""}</div>
                    </div>
                    <button type="button" onClick={() => updateRow(r.id, { item_id: null, item: undefined, uom_id: null })} className="px-2 py-1 border rounded text-sm">Clear</button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">Belum pilih item — gunakan search di atas lalu klik item untuk mengisi baris ini</div>
                )}
              </div>

              <div className="col-span-3">
                <div className="text-xs text-gray-500">Qty</div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={r.requested_qty as any}
                  onChange={(e) => updateRow(r.id, { requested_qty: e.target.value === "" ? "" : Number(e.target.value) })}
                  className="w-full border px-2 py-1 rounded"
                />
              </div>

              <div className="col-span-2">
                <div className="text-xs text-gray-500">UOM (opsional)</div>

                {/* If item has measurements -> show dropdown of measurements.uom */}
                {r.item && Array.isArray(r.item.measurements) && r.item.measurements.length > 0 ? (
                  <select
                    value={r.uom_id ?? ""}
                    onChange={(e) => updateRow(r.id, { uom_id: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-full border px-2 py-1 rounded"
                  >
                    <option value="">Pilih UOM</option>
                    {r.item.measurements.map((m: any) => {
                      const u = m.uom ?? { id: m.uom_id, name: m.uom_name ?? String(m.uom_id) };
                      const uid = u.id ?? m.uom_id;
                      return <option key={String(uid)} value={uid}>{u.name ?? `UOM ${uid}`}</option>;
                    })}
                  </select>
                ) : r.item && (r.item.uom || r.item.uom_id) ? (
                  // No measurements, but item has a primary uom -> show single-option select for clarity
                  <select
                    value={r.uom_id ?? ""}
                    onChange={(e) => updateRow(r.id, { uom_id: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-full border px-2 py-1 rounded"
                  >
                    <option value="">{r.item.uom?.name ?? `UOM ${r.item.uom_id ?? ""}`}</option>
                    {/* keep input option to manually set by id if user wants (hidden) */}
                  </select>
                ) : (
                  // Fallback: allow manual uom id input (keeps original behavior)
                  <>
                    <input
                      value={r.uom_id ?? ""}
                      onChange={(e) => updateRow(r.id, { uom_id: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="uom id"
                      className="w-full border px-2 py-1 rounded"
                    />
                    <div className="text-xs text-gray-400 mt-1">Masukkan id UOM bila perlu</div>
                  </>
                )}

                {/* Small helper */}
                {/* {r.item && !(Array.isArray(r.item.measurements) && r.item.measurements.length > 0) && (
                  <div className="text-xs text-gray-400 mt-1">UOM default: {r.item.uom?.name ?? (r.item.uom_id ?? "-")}</div>
                )} */}
              </div>

              <div className="col-span-1 flex justify-end">
                <button type="button" onClick={() => removeRow(r.id)} className="px-2 py-1 bg-red-600 text-white rounded">H</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={addRow} className="px-3 py-1 border rounded">+ Tambah Baris</button>
        </div>

        <div>
          <label className="text-xs block mb-1">Catatan (opsional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full border px-3 py-2 rounded" rows={3} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Batal</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded">
            {saving ? "Menyimpan..." : "Kirim Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
