// src/pages/RecipeEditPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';

// reuse same UI/logic as create but prefill and call PUT
export default function RecipeEditPage() {
  const { brandId, itemId, recipeId } = useParams<{ brandId: string; itemId: string; recipeId: string }>();
  const navigate = useNavigate();

  // reuse state from create page
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [yieldQty, setYieldQty] = useState<number>(1);
  const [uomId, setUomId] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(false);
  const [notes, setNotes] = useState('');
  const [components, setComponents] = useState<any[]>([]);

  const [uoms, setUoms] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<any[]>([]);

  useEffect(() => {
    fetchMetaAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchMetaAndData() {
    try {
      const [uomResp, itemsResp, recipeResp] = await Promise.all([
        axios.get('/api/uoms'),
        axios.get('/api/item', { params: { limit: 200 }}),
        axios.get(`/api/recipes/${recipeId}`)
      ]);
      setUoms(uomResp.data?.data ?? uomResp.data ?? []);
      setAllItems(itemsResp.data?.data ?? itemsResp.data ?? []);
      const recipe = recipeResp.data?.data ?? recipeResp.data;
      setName(recipe.name ?? '');
      setVersion(recipe.version ?? '');
      setYieldQty(recipe.yield_qty ?? 1);
      setUomId(recipe.uom_id ?? '');
      setIsActive(!!recipe.is_active);
      setNotes(recipe.notes ?? '');
      setComponents((recipe.components || []).map((c:any, idx:number) => ({
        component_item_id: c.component_item_id,
        quantity: c.quantity,
        uom_id: c.uom_id ?? '',
        sequence: c.sequence ?? idx + 1,
        is_optional: !!c.is_optional,
        notes: c.notes ?? ''
      })));
      setLoaded(true);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat data');
    }
  }

  function updateComp(i:number, patch:any){ setComponents(prev => prev.map((c,j)=> j===i?{...c,...patch}:c)); }
  function addComp(){ setComponents(prev => [...prev, { component_item_id: null, quantity: 1, uom_id: '', sequence: prev.length+1 }]); }
  function removeComp(i:number){ setComponents(prev => prev.filter((_,j)=>j!==i).map((c,k)=>({...c, sequence:k+1}))); }

  function validate(){ if(!name.trim()){toast.error('Nama wajib');return false;} if(components.length===0){toast.error('Tambahkan komponen');return false;} for(const c of components){ if(!c.component_item_id){toast.error('Pilih komponen');return false;} if(!c.quantity || Number(c.quantity)<=0){toast.error('Quantity >0');return false;} } return true; }

  async function save(e?:React.FormEvent){
    e?.preventDefault();
    if(!validate()) return;
    const payload = { item_id: Number(itemId), name, version, yield_qty: Number(yieldQty), uom_id: uomId === '' ? null : Number(uomId), is_active: !!isActive, notes, components: components.map(c=>({ component_item_id: Number(c.component_item_id), quantity: Number(c.quantity), uom_id: c.uom_id === '' ? null : Number(c.uom_id), sequence: c.sequence || 0 })) };
    try {
      await axios.put(`/api/recipes/${recipeId}`, payload);
      toast.success('Recipe diperbarui');
      navigate(`/brands/${brandId}/items/${itemId}/recipes`);
    } catch (err:any) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan');
    }
  }

  if (!loaded) return <div className="p-6">Memuat...</div>;

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl">Edit Recipe</h2>
        <div>
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
        </div>
      </div>

      <form onSubmit={save} className="bg-white rounded shadow p-4 space-y-4">
        {/* same UI as create page */}
        {/* ... reuse the create page fields here; omitted for brevity but you can copy the form from RecipeCreatePage */}
        {/* For brevity in this snippet: render minimal: */}
        <div>
          <label>Nama</label>
          <input value={name} onChange={e=>setName(e.target.value)} />
        </div>
        {/* implement rest of form same as create page */}
        <div>
          <button type="button" onClick={()=>navigate(-1)} className="px-3 py-1 border rounded mr-2">Batal</button>
          <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded">Simpan</button>
        </div>
      </form>
    </div>
  );
}
