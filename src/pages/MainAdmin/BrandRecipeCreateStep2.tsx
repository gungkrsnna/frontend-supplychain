// src/pages/BrandRecipeCreateStep2.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Item = { id: number; name?: string; code?: string; description?: string | null; uom_id?: number | null };
type Uom = { id: number; name?: string; kode?: string };
type RecipeComponentRow = {
  component_item_id?: number | null;
  quantity?: number | string;
  uom_id?: number | null;
  waste_percent?: number | string;
  sequence?: number;
  is_optional?: boolean;
  notes?: string | null;
};

export default function BrandRecipeCreateStep2(): JSX.Element {
  const { brandId, itemId } = useParams<{ brandId: string; itemId: string }>();
  const navigate = useNavigate();

  // loading / metadata
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // lookups
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [brandItems, setBrandItems] = useState<Item[]>([]); // items in brand to choose as components

  // primary item (the FG / item we're creating recipe for)
  const [item, setItem] = useState<Item | null>(null);

  // form
  const [name, setName] = useState<string>("");
  const [version, setVersion] = useState<string>("");
  const [yieldQty, setYieldQty] = useState<number | string>(1);
  const [uomId, setUomId] = useState<number | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");

  // components table rows
  const [components, setComponents] = useState<RecipeComponentRow[]>([
    { component_item_id: null, quantity: 1, uom_id: null, waste_percent: 0, sequence: 1, is_optional: false, notes: null }
  ]);

  useEffect(() => {
    fetchLookups();
    fetchItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, itemId]);

  // Set default recipe name to the item name when item is loaded,
  // but only if the user hasn't typed a custom name yet.
  useEffect(() => {
    if (item && (!name || String(name).trim() === "")) {
      setName(item.name ?? "");
    }
    // if item provides a uom and no uom selected yet, set it
    if (item && item.uom_id && (uomId === null || uomId === undefined)) {
      setUomId(item.uom_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  async function fetchLookups() {
    try {
      const [uomResp, itemsResp] = await Promise.all([
        axios.get("/api/uoms"),
        axios.get(`/api/brands/${brandId}/items`, { params: { limit: 200 } })
      ]);
      const uomRows: Uom[] = uomResp.data?.data ?? (Array.isArray(uomResp.data) ? uomResp.data : []);
      const itemRows: Item[] = itemsResp.data?.data ?? (Array.isArray(itemsResp.data) ? itemsResp.data : []);
      setUoms(uomRows || []);
      setBrandItems(itemRows || []);
    } catch (err) {
      console.error("fetchLookups error", err);
      setUoms([]);
      setBrandItems([]);
      toast.error("Gagal memuat UOM atau items brand. Pastikan backend tersedia.");
    }
  }

  async function fetchItem() {
    if (!itemId) return;
    setLoading(true);
    try {
      // try brand-scoped items endpoint first
      let resp;
      try {
        resp = await axios.get(`/api/brands/${brandId}/items`);
        const rows = resp.data?.data ?? (Array.isArray(resp.data) ? resp.data : []);
        const found = (rows ?? []).find((r: any) => String(r.id) === String(itemId));
        if (found) {
          setItem(found);
          // if item has uom_id, set default uom for recipe (but do not overwrite if user already selected)
          if (found.uom_id) setUomId(prev => (prev ?? found.uom_id));
        } else {
          // fallback to GET item by id
          const r2 = await axios.get(`/api/item/${itemId}`);
          const i = r2.data?.data ?? r2.data;
          setItem(i || null);
          if (i?.uom_id) setUomId(prev => (prev ?? i.uom_id));
        }
      } catch (err) {
        // fallback: /api/item/:id
        const r2 = await axios.get(`/api/item/${itemId}`);
        const i = r2.data?.data ?? r2.data;
        setItem(i || null);
        if (i?.uom_id) setUomId(prev => (prev ?? i.uom_id));
      }
    } catch (err) {
      console.error("fetchItem error", err);
      toast.error("Gagal memuat item.");
      setItem(null);
    } finally {
      setLoading(false);
    }
  }

  function addComponentRow() {
    setComponents(prev => {
      const nextSeq = prev.length ? (Math.max(...prev.map(p => p.sequence || 0)) + 1) : 1;
      return [...prev, { component_item_id: null, quantity: 1, uom_id: null, waste_percent: 0, sequence: nextSeq, is_optional: false, notes: null }];
    });
  }

  function removeComponentRow(index: number) {
    setComponents(prev => prev.filter((_, idx) => idx !== index).map((r, i) => ({ ...r, sequence: i + 1 })));
  }

  function updateComponentRow(index: number, patch: Partial<RecipeComponentRow>) {
    setComponents(prev => prev.map((r, idx) => idx === index ? { ...r, ...patch } : r));
  }

  function validateForm() {
    if (!itemId) {
      toast.error("Item target tidak ditemukan.");
      return false;
    }
    if (!name || String(name).trim() === "") {
      toast.error("Nama recipe wajib diisi.");
      return false;
    }
    // check components: at least one with component_item_id and numeric qty
    if (!components || components.length === 0) {
      toast.error("Tambahkan minimal 1 komponen.");
      return false;
    }
    for (const c of components) {
      if (!c.component_item_id) {
        toast.error("Semua komponen harus dipilih item-nya.");
        return false;
      }
      const qty = Number(c.quantity);
      if (!isFinite(qty) || qty <= 0) {
        toast.error("Quantity komponen harus angka positif.");
        return false;
      }
    }
    return true;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validateForm()) return;

    const payload = {
      item_id: Number(itemId),
      name: String(name).trim(),
      version: version ? String(version).trim() : undefined,
      yield_qty: Number(yieldQty) || 1,
      uom_id: uomId ?? null,
      is_active: !!isActive,
      notes: notes || null,
      components: components.map(c => ({
        component_item_id: Number(c.component_item_id),
        quantity: Number(c.quantity),
        uom_id: c.uom_id ?? null,
        waste_percent: Number(c.waste_percent) || 0,
        sequence: c.sequence ?? 0,
        is_optional: !!c.is_optional,
        notes: c.notes ?? null
      }))
    };

    setSaving(true);
    try {
      const resp = await axios.post("/api/recipes", payload);
      const created = resp.data?.data ?? resp.data;
      toast.success("Recipe berhasil dibuat");
      // navigate to recipe detail or list
      // handle if backend returns id in different shape
      const newId = created?.id ?? (typeof created === "string" ? created : null);
      if (newId) {
        navigate(`/superadmin/brands/${brandId}/items/${itemId}/recipes/${newId}`);
      } else {
        // fallback: go to list
        navigate(`/superadmin/brands/${brandId}/items/${itemId}/recipes`);
      }
    } catch (err: any) {
      console.error("create recipe error", err);
      const msg = err?.response?.data?.message || err?.message || "Gagal membuat recipe";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2500} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl">Buat Recipe Baru</h2>
          <div className="text-sm text-gray-500">{item ? `${item.name} ${item.code ? `(${item.code})` : ""}` : `Item: ${itemId}`}</div>
        </div>
        <div>
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm block mb-1">Nama Recipe <span className="text-red-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>

          <div>
            <label className="text-sm block mb-1">Version</label>
            <input value={version} onChange={(e) => setVersion(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>

          <div>
            <label className="text-sm block mb-1">Yield Qty</label>
            <input type="number" step="any" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm block mb-1">UOM (Recipe)</label>
            <select value={uomId ?? ""} onChange={(e) => setUomId(e.target.value === "" ? null : Number(e.target.value))} className="w-full border px-3 py-2 rounded">
              <option value="">-- Pilih UOM --</option>
              {uoms.map(u => <option key={u.id} value={u.id}>{u.name ?? u.kode ?? u.id}</option>)}
            </select>
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span className="text-sm">Set sebagai active (aktifkan dan nonaktifkan recipe lain)</span>
            </label>
          </div>

          <div>
            <label className="text-sm block mb-1">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>
        </div>

        <hr />

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Komponen</h3>
            <div>
              <button type="button" onClick={addComponentRow} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Tambah Komponen</button>
            </div>
          </div>

          <div className="space-y-2">
            {components.map((row, idx) => (
              <div key={idx} className="border rounded p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                <div className="md:col-span-5">
                  <label className="text-xs text-gray-600">Item Komponen</label>
                  <select
                    value={row.component_item_id ?? ""}
                    onChange={(e) => updateComponentRow(idx, { component_item_id: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-full border px-2 py-2 rounded"
                  >
                    <option value="">-- Pilih item komponen --</option>
                    {brandItems.map(bi => <option key={bi.id} value={bi.id}>{bi.name} {bi.code ? `(${bi.code})` : ""}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-600">Qty</label>
                  <input type="number" step="any" value={row.quantity ?? ""} onChange={(e) => updateComponentRow(idx, { quantity: e.target.value })} className="w-full border px-2 py-2 rounded" />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-600">UOM</label>
                  <select value={row.uom_id ?? ""} onChange={(e) => updateComponentRow(idx, { uom_id: e.target.value === "" ? null : Number(e.target.value) })} className="w-full border px-2 py-2 rounded">
                    <option value="">-- Pilih UOM --</option>
                    {uoms.map(u => <option key={u.id} value={u.id}>{u.name ?? u.kode ?? u.id}</option>)}
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="text-xs text-gray-600">Waste %</label>
                  <input type="number" step="any" value={row.waste_percent ?? 0} onChange={(e) => updateComponentRow(idx, { waste_percent: e.target.value })} className="w-full border px-2 py-2 rounded" />
                </div>

                <div className="md:col-span-1 flex items-center">
                  <label className="text-xs inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!row.is_optional} onChange={(e) => updateComponentRow(idx, { is_optional: e.target.checked })} />
                    <span className="text-xs">Optional</span>
                  </label>
                </div>

                <div className="md:col-span-12">
                  <label className="text-xs text-gray-600">Notes</label>
                  <input value={row.notes ?? ""} onChange={(e) => updateComponentRow(idx, { notes: e.target.value })} className="w-full border px-2 py-2 rounded" />
                </div>

                <div className="md:col-span-12 flex justify-end gap-2">
                  <button type="button" onClick={() => removeComponentRow(idx)} className="px-3 py-1 border rounded text-sm bg-red-50">Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Batal</button>
          <button type="submit" disabled={saving} className={`px-4 py-2 rounded text-white ${saving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
            {saving ? 'Menyimpan...' : 'Simpan Recipe'}
          </button>
        </div>
      </form>
    </div>
  );
}
