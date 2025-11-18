// src/pages/RecipeCreatePage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';

export default function RecipeCreatePage() {
  const { brandId, itemId } = useParams<{ brandId: string; itemId: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [yieldQty, setYieldQty] = useState<number>(1);
  const [uomId, setUomId] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(false);
  const [notes, setNotes] = useState('');
  const [components, setComponents] = useState<any[]>([{ component_item_id: null, quantity: 1, uom_id: '', sequence: 1 }]);

  const [uoms, setUoms] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);

  useEffect(() => {
    fetchMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchMeta() {
    try {
      const [uomResp, itemsResp] = await Promise.all([
        axios.get('/api/uoms'),
        axios.get('/api/item', { params: { limit: 200 }})
      ]);
      setUoms(uomResp.data?.data ?? uomResp.data ?? []);
      setAllItems(itemsResp.data?.data ?? itemsResp.data ?? []);
    } catch (err) {
      console.warn(err);
    }
  }

  function updateComp(i:number, patch: any) {
    setComponents(prev => prev.map((c,j) => j===i ? { ...c, ...patch } : c));
  }
  function addComp() {
    setComponents(prev => [...prev, { component_item_id: null, quantity: 1, uom_id: '', sequence: prev.length+1 }]);
  }
  function removeComp(i:number) {
    setComponents(prev => prev.filter((_,j)=>j!==i).map((c,k)=>({...c, sequence:k+1})));
  }

  function validate() {
    if (!name.trim()) { toast.error('Nama wajib diisi'); return false; }
    if (!components.length) { toast.error('Tambahkan minimal 1 komponen'); return false; }
    for (const c of components) {
      if (!c.component_item_id) { toast.error('Pilih komponen'); return false; }
      if (!c.quantity || Number(c.quantity) <= 0) { toast.error('Quantity > 0'); return false; }
    }
    return true;
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validate()) return;
    const payload = {
      item_id: Number(itemId),
      name, version, yield_qty: Number(yieldQty), uom_id: uomId === '' ? null : Number(uomId), is_active: !!isActive, notes,
      components: components.map(c => ({ component_item_id: Number(c.component_item_id), quantity: Number(c.quantity), uom_id: c.uom_id === '' ? null : Number(c.uom_id), sequence: c.sequence || 0 }))
    };
    try {
      await axios.post('/api/recipes', payload);
      toast.success('Recipe dibuat');
      navigate(`/brands/${brandId}/items/${itemId}/recipes`);
    } catch (err:any) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan recipe');
    }
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl">Buat Recipe</h2>
        <div>
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
        </div>
      </div>

      <form onSubmit={save} className="bg-white rounded shadow p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm block">Nama</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>
          <div>
            <label className="text-sm block">Version</label>
            <input value={version} onChange={e=>setVersion(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>
          <div>
            <label className="text-sm block">Yield Qty</label>
            <input type="number" value={yieldQty} onChange={e=>setYieldQty(Number(e.target.value))} className="w-full border px-3 py-2 rounded" />
          </div>
          <div>
            <label className="text-sm block">Yield UOM</label>
            <select value={uomId} onChange={e=>setUomId(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border px-3 py-2 rounded">
              <option value="">-- pilih UOM --</option>
              {uoms.map(u => <option key={u.id} value={u.id}>{u.name ?? u.kode ?? u.id}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Components</div>
            <button type="button" onClick={addComp} className="px-2 py-1 border rounded text-sm">Tambah Komponen</button>
          </div>

          <div className="space-y-2">
            {components.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <select value={c.component_item_id ?? ''} onChange={e=>updateComp(i, { component_item_id: e.target.value === '' ? null : Number(e.target.value) })} className="w-full border px-2 py-2 rounded">
                    <option value="">-- pilih item --</option>
                    {allItems.map(it => <option key={it.id} value={it.id}>{it.name} {it.code ? `(${it.code})` : ''}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" step="any" value={c.quantity} onChange={e=>updateComp(i, { quantity: e.target.value })} className="w-full border px-2 py-2 rounded" />
                </div>
                <div className="col-span-2">
                  <select value={c.uom_id ?? ''} onChange={e=>updateComp(i, { uom_id: e.target.value === '' ? '' : Number(e.target.value) })} className="w-full border px-2 py-2 rounded">
                    <option value="">-- UOM --</option>
                    {uoms.map(u=> <option key={u.id} value={u.id}>{u.name ?? u.kode ?? u.id}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <input type="number" value={c.sequence} onChange={e=>updateComp(i, { sequence: Number(e.target.value) })} className="w-full border px-2 py-2 rounded" />
                </div>
                <div className="col-span-1">
                  <button type="button" onClick={()=>removeComp(i)} className="px-2 py-1 bg-red-600 text-white rounded">Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} />
            <span className="text-sm">Aktifkan setelah simpan</span>
          </label>
          <div>
            <button type="button" onClick={() => navigate(-1)} className="px-3 py-1 border rounded mr-2">Batal</button>
            <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded">Simpan</button>
          </div>
        </div>
      </form>
    </div>
  );
}
