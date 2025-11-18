// src/pages/BrandRecipesListPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Item = { id: number; name: string; code?: string; };
type Recipe = { id: string; item_id: number; name?: string; version?: string; yield_qty?: number; is_active?: boolean; components?: any[]; createdAt?: string; };
type Brand = { id: string; nama?: string; kode?: string };

export default function BrandRecipesListPage(): JSX.Element {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [loading, setLoading] = useState(false); // general

  // UI states
  const [search, setSearch] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Recipe | null>(null);

  // flatten preview modal
  const [flattening, setFlattening] = useState(false);
  const [flattenData, setFlattenData] = useState<Record<string, number> | null>(null);
  const [flattenModalOpen, setFlattenModalOpen] = useState(false);
  const [flattenForRecipe, setFlattenForRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!brandId) return;
    fetchBrand();
    fetchItemsAndRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function fetchBrand() {
    try {
      const resp = await axios.get(`/api/brands/${brandId}`);
      const data: Brand | null = resp.data?.data ?? resp.data ?? null;
      setBrand(data);
    } catch (err: any) {
      console.error("fetchBrand error", err);
      setBrand(null);
      // not fatal — we still fetch items/recipes
    }
  }

  // fetch items (for counts / mapping) and recipes
  async function fetchItemsAndRecipes() {
    setLoading(true);
    setRecipes([]);
    setItems([]);
    setFlattenData(null);

    try {
      setLoadingItems(true);
      const resp = await axios.get(`/api/brands/${brandId}/items`);
      const rows: Item[] = resp.data?.data ?? (Array.isArray(resp.data) ? resp.data : []);
      setItems(rows || []);
      setLoadingItems(false);
    } catch (err: any) {
      setLoadingItems(false);
      console.error("fetch items error", err);
      toast.error("Gagal memuat items brand");
      return setItems([]);
    }

    // try direct brand recipes endpoint first (more efficient), fallback to per-item fetch
    try {
      setLoadingRecipes(true);
      const tryBrandResp = await axios.get(`/api/recipes/brand/${brandId}`);
      const maybeArr = tryBrandResp.data?.data ?? tryBrandResp.data;
      if (Array.isArray(maybeArr)) {
        const itemsMap = new Map(items.map(it => [it.id, it]));
        (maybeArr as Recipe[]).forEach(r => { (r as any)._item = itemsMap.get(r.item_id); });
        setRecipes(maybeArr as Recipe[]);
        setLoadingRecipes(false);
        setLoading(false);
        return;
      }
    } catch (err) {
      // endpoint mungkin tidak tersedia — fallback silently
    }

    // fallback: per-item chunked fetch
    try {
      setLoadingRecipes(true);
      const rows = items;
      if (!rows || rows.length === 0) {
        setRecipes([]);
        setLoadingRecipes(false);
        setLoading(false);
        return;
      }
      const chunkSize = 20;
      const allRecipes: Recipe[] = [];
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const promises = chunk.map(it => axios.get(`/api/recipes/item/${it.id}`).then(r => r.data?.data ?? r.data ?? []));
        const results = await Promise.all(promises);
        for (const arr of results) if (Array.isArray(arr)) allRecipes.push(...arr);
      }
      // dedupe
      const dedup: Record<string, Recipe> = {};
      for (const r of allRecipes) dedup[r.id] = r;
      const merged = Object.values(dedup);
      // attach item name for display convenience
      const itemsMap = new Map(items.map(it => [it.id, it]));
      merged.forEach(r => { (r as any)._item = itemsMap.get(r.item_id); });
      setRecipes(merged);
    } catch (err: any) {
      console.error("fetch items/recipes error", err);
      toast.error(err?.response?.data?.message || "Gagal memuat recipes untuk brand");
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
      setLoading(false);
    }
  }

  // search/filter recipes by recipe name or item name
  const filteredRecipes = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return recipes;
    return recipes.filter(r => {
      const name = (r.name || "").toLowerCase();
      const itemName = ((r as any)._item?.name || "").toLowerCase();
      return name.includes(t) || itemName.includes(t);
    });
  }, [recipes, search]);

  // navigate to Step 1 (select item) for creating recipe
  function onCreateRecipe() {
    // navigate to the Step 1 page where user picks item
    navigate(`/superadmin/brands/${brandId}/recipes/new`);
  }

  function confirmDelete(r: Recipe) {
    setToDelete(r);
    setDeleteModalOpen(true);
  }

  async function doDelete() {
    if (!toDelete) return;
    try {
      await axios.delete(`/api/recipes/${toDelete.id}`);
      setRecipes(prev => prev.filter(x => x.id !== toDelete.id));
      toast.success("Recipe dihapus");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Gagal menghapus recipe");
    } finally {
      setDeleteModalOpen(false);
      setToDelete(null);
    }
  }

  async function handleActivate(id: string) {
    try {
      await axios.post(`/api/recipes/${id}/activate`);
      toast.success("Recipe diaktifkan");
      // refresh
      fetchItemsAndRecipes();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Gagal mengaktifkan recipe");
    }
  }

  async function handleFlattenPreview(r: Recipe) {
    setFlattenForRecipe(r);
    setFlattenModalOpen(true);
    setFlattenData(null);
    setFlattening(true);
    try {
      const resp = await axios.get(`/api/recipes/${r.id}/flatten`);
      const data = resp.data?.data ?? resp.data;
      setFlattenData(data || {});
    } catch (err: any) {
      console.error("flatten error", err);
      toast.error(err?.response?.data?.message || "Gagal preview flatten");
      setFlattenData(null);
    } finally {
      setFlattening(false);
    }
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2000} />

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl">Recipes — Brand {brand ? (brand.nama ?? brand.kode ?? brand.id) : brandId}</h2>
          <div className="text-sm text-gray-500">Items: {items.length} • Recipes: {recipes.length}</div>
        </div>

        <div className="flex gap-2 items-center">
          <input
            placeholder="Cari recipe atau item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border px-3 py-1 rounded text-sm"
          />
          <button onClick={onCreateRecipe} className="px-3 py-1 bg-green-600 text-white rounded">Buat Recipe</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4 space-y-3">
        {loadingItems || loadingRecipes ? (
          <div>Memuat...</div>
        ) : recipes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Belum ada recipe untuk brand ini</div>
        ) : (
          filteredRecipes.map(r => (
            <div key={r.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.name ?? `Recipe ${r.id}`}</div>
                <div className="text-xs text-gray-500">
                  Item: {(r as any)._item?.name ?? `#${r.item_id}`} • Yield: {r.yield_qty ?? 1} • Version: {r.version ?? '-'}
                </div>
              </div>

              <div className="flex gap-2">
                {!r.is_active && <button onClick={() => handleActivate(r.id)} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm">Activate</button>}
                <Link to={`/superadmin/brands/${brandId}/items/${r.item_id}/recipes/${r.id}`} className="px-2 py-1 border rounded text-sm">Detail</Link>
                <Link to={`/superadmin/brands/${brandId}/items/${r.item_id}/recipes/${r.id}/edit`} className="px-2 py-1 border rounded text-sm">Edit</Link>
                <button onClick={() => confirmDelete(r)} className="px-2 py-1 bg-red-600 text-white rounded text-sm">Hapus</button>
                <button onClick={() => handleFlattenPreview(r)} className="px-2 py-1 border rounded text-sm">Preview</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* delete confirmation modal */}
      {deleteModalOpen && toDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded w-full max-w-sm p-4 text-center">
            <h3 className="text-lg font-semibold mb-2">Konfirmasi Hapus</h3>
            <p className="text-sm text-gray-600 mb-4">Apakah Anda yakin ingin menghapus recipe <strong>{toDelete.name ?? toDelete.id}</strong>?</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => { setDeleteModalOpen(false); setToDelete(null); }} className="px-4 py-2 border rounded">Batal</button>
              <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {/* flatten preview modal */}
      {flattenModalOpen && flattenForRecipe && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded w-full max-w-lg p-4 overflow-auto max-h-[80vh]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Flatten Preview — {flattenForRecipe.name ?? flattenForRecipe.id}</h3>
              <button onClick={() => { setFlattenModalOpen(false); setFlattenData(null); setFlattenForRecipe(null); }} className="px-2 py-1 border rounded">Tutup</button>
            </div>

            {flattening ? (
              <div>Memuat preview...</div>
            ) : flattenData && Object.keys(flattenData).length > 0 ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(flattenData).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b py-2">
                    <div>{k}</div>
                    <div className="font-medium">{v}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">Tidak ada data preview atau terjadi kesalahan.</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
