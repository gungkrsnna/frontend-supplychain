// src/pages/RecipeDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';

export default function RecipeDetailPage() {
  const { brandId, itemId, recipeId } = useParams<{ brandId: string; itemId: string; recipeId: string }>();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [flatten, setFlatten] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  async function fetchDetail() {
    setLoading(true);
    try {
      const resp = await axios.get(`/api/recipes/${recipeId}`);
      const data = resp.data?.data ?? resp.data;
      setRecipe(data);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat recipe');
    } finally {
      setLoading(false);
    }
  }

  async function doFlatten() {
    try {
      const resp = await axios.get(`/api/recipes/${recipeId}/flatten`);
      setFlatten(resp.data?.data ?? resp.data);
    } catch (err:any) {
      toast.error(err?.response?.data?.message || 'Gagal flatten');
    }
  }

  async function remove() {
    if (!window.confirm('Hapus recipe ini?')) return;
    try {
      await axios.delete(`/api/recipes/${recipeId}`);
      toast.success('Recipe dihapus');
      navigate(`/brands/${brandId}/items/${itemId}/recipes`);
    } catch (err:any) {
      toast.error(err?.response?.data?.message || 'Gagal menghapus');
    }
  }

  if (loading) return <div className="p-6">Memuat...</div>;
  if (!recipe) return <div className="p-6 text-gray-500">Recipe tidak ditemukan</div>;

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl">{recipe.name}</h2>
          <div className="text-sm text-gray-500">Version: {recipe.version} • Yield: {recipe.yield_qty}</div>
        </div>
        <div className="flex gap-2">
          <Link to={`/brands/${brandId}/items/${itemId}/recipes/${recipeId}/edit`} className="px-3 py-1 border rounded">Edit</Link>
          <button onClick={remove} className="px-3 py-1 bg-red-600 text-white rounded">Hapus</button>
          <button onClick={doFlatten} className="px-3 py-1 border rounded">Flatten Preview</button>
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        <div className="mb-3 font-medium">Komponen</div>
        <div className="space-y-2">
          {(recipe.components || []).map((c:any) => (
            <div key={`${c.component_item_id}-${c.sequence}`} className="flex justify-between">
              <div>{c.componentItem ? c.componentItem.name : `#${c.component_item_id}`}</div>
              <div>{c.quantity} {c.uom ? c.uom.name : ''}</div>
            </div>
          ))}
          {(recipe.components || []).length === 0 && <div className="text-gray-500">-</div>}
        </div>

        {flatten && (
          <div className="mt-4 border rounded p-3 bg-gray-50">
            <div className="font-medium mb-2">Flatten (raw materials)</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.keys(flatten).map(k => (
                <div key={k} className="flex justify-between">
                  <div>{k}</div>
                  <div>{flatten[k]}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
