// src/pages/RecipesListPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type Recipe = {
  id: string;
  name?: string;
  version?: string;
  yield_qty?: number;
  is_active?: boolean;
  components?: any[];
  createdAt?: string;
};

export default function RecipesListPage() {
  const { brandId, itemId } = useParams<{ brandId: string; itemId: string }>();
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!itemId) return;
    fetchRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function fetchRecipes() {
    setLoading(true);
    try {
      const resp = await axios.get(`/api/recipes/item/${itemId}`);
      const rows = resp.data?.data ?? (Array.isArray(resp.data) ? resp.data : []);
      setRecipes(rows);
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat recipes');
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }

  function confirmDelete(r: Recipe) {
    setToDelete(r);
    setDeleteModalOpen(true);
  }

  async function doDelete() {
    if (!toDelete) return;
    try {
      await axios.delete(`/api/recipes/${toDelete.id}`);
      toast.success('Recipe dihapus');
      setRecipes(prev => prev.filter(x => x.id !== toDelete.id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menghapus');
    } finally {
      setDeleteModalOpen(false);
      setToDelete(null);
    }
  }

  async function activate(r: Recipe) {
    try {
      await axios.post(`/api/recipes/${r.id}/activate`);
      toast.success('Recipe diaktifkan');
      fetchRecipes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mengaktifkan');
    }
  }

  async function previewFlatten(r: Recipe) {
    try {
      const resp = await axios.get(`/api/recipes/${r.id}/flatten`);
      const data = resp.data?.data ?? resp.data;
      // tampilkan sederhana: navigasi ke detail dengan query preview? untuk sederhana buka modal alert
      alert(JSON.stringify(data, null, 2));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal preview flatten');
    }
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl">Recipes</h2>
          <div className="text-sm text-gray-500">Item ID: {itemId}</div>
        </div>
        <div className="flex gap-2">
          <Link to={`/brands/${brandId}/items/${itemId}/recipes/new`} className="px-3 py-1 bg-green-600 text-white rounded">Buat Recipe</Link>
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
        </div>
      </div>

      <div className="bg-white shadow rounded p-4">
        {loading ? <div>Loading...</div> : recipes.length === 0 ? <div className="p-6 text-center text-gray-500">Belum ada recipe</div> : (
          <div className="space-y-3">
            {recipes.map(r => (
              <div key={r.id} className="border rounded p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.name ?? `Recipe ${r.id}`}</div>
                  <div className="text-xs text-gray-500">Version: {r.version ?? '-'} • Yield: {r.yield_qty ?? 1}</div>
                </div>

                <div className="flex gap-2">
                  {!r.is_active && <button onClick={() => activate(r)} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm">Activate</button>}
                  <Link to={`/brands/${brandId}/items/${itemId}/recipes/${r.id}`} className="px-2 py-1 border rounded text-sm">Detail</Link>
                  <Link to={`/brands/${brandId}/items/${itemId}/recipes/${r.id}/edit`} className="px-2 py-1 border rounded text-sm">Edit</Link>
                  <button onClick={() => confirmDelete(r)} className="px-2 py-1 bg-red-600 text-white rounded text-sm">Hapus</button>
                  <button onClick={() => previewFlatten(r)} className="px-2 py-1 border rounded text-sm">Preview</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* delete modal */}
      {deleteModalOpen && toDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-semibold mb-3">Konfirmasi Hapus</h3>
            <p className="text-gray-600 mb-4">Hapus recipe <strong>{toDelete.name ?? toDelete.id}</strong>?</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => { setDeleteModalOpen(false); setToDelete(null); }} className="px-4 py-2 border rounded">Batal</button>
              <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
