// src/pages/BrandRecipeCreateStep1.tsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Item = { id: number; name?: string; code?: string; description?: string | null };

export default function BrandRecipeCreateStep1(): JSX.Element {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // simple debounce for search
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!brandId) return;
    fetchItems(1, q, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  useEffect(() => {
    // debounce search
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchItems(1, q, true);
    }, 350);
    // cleanup
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function fetchItems(pageToLoad = 1, qStr = "", replace = false) {
    setLoading(true);
    try {
      // prefer server-side search if supported
      const resp = await axios.get(`/api/brands/${brandId}/items`, { params: { q: qStr || undefined, page: pageToLoad, limit: 50 } });
      const rows: Item[] = resp.data?.data ?? (Array.isArray(resp.data) ? resp.data : []);
      if (replace) setItems(rows ?? []);
      else setItems(prev => [...prev, ...(rows ?? [])]);
      setHasMore((rows?.length ?? 0) >= 50); // heuristic: more if reached limit
      setPage(pageToLoad);
    } catch (err: any) {
      console.error("fetchItems error", err);
      // fallback: try a plain GET without query params
      try {
        const resp2 = await axios.get(`/api/brands/${brandId}/items`);
        const rows2: Item[] = resp2.data?.data ?? (Array.isArray(resp2.data) ? resp2.data : []);
        setItems(rows2 ?? []);
        setHasMore(false);
      } catch (err2) {
        console.error("fallback fetch failed", err2);
        toast.error("Gagal memuat items. Cek koneksi atau backend.");
        setItems([]);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(id: number) {
    setSelectedId(prev => prev === id ? null : id);
  }

  function onNext() {
    if (!selectedId) {
      toast.error("Pilih item terlebih dahulu");
      return;
    }
    // navigate to create recipe page for selected item
    navigate(`/superadmin/brands/${brandId}/items/${selectedId}/recipes/new`);
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Buat Recipe — Pilih Item</h2>
          <div className="text-sm text-gray-500">Brand: {brandId}</div>
        </div>
        <div>
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4 space-y-4">
        <div className="flex gap-2 items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari item (nama atau kode)..."
            className="flex-1 border px-3 py-2 rounded"
          />
          <button onClick={() => fetchItems(1, q, true)} className="px-3 py-2 bg-indigo-600 text-white rounded">Cari</button>
        </div>

        <div>
          {loading ? (
            <div className="py-6 text-center text-gray-500">Memuat items...</div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-gray-500">Tidak ada item untuk brand ini.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map(it => (
                <label key={it.id} className={`p-3 border rounded flex items-start gap-3 cursor-pointer ${selectedId === it.id ? "border-indigo-500 bg-indigo-50" : "hover:bg-gray-50"}`}>
                  <input
                    type="radio"
                    checked={selectedId === it.id}
                    onChange={() => handleSelect(it.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{it.name ?? `Item ${it.id}`}</div>
                    <div className="text-xs text-gray-500">{it.code ?? "-"}</div>
                    {it.description ? <div className="text-sm text-gray-600 mt-1">{it.description}</div> : null}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <div>
            {hasMore && (
              <button onClick={() => fetchItems(page + 1, q, false)} className="px-3 py-1 border rounded text-sm">Muat lebih banyak</button>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Batal</button>
            <button onClick={onNext} className={`px-4 py-2 rounded text-white ${selectedId ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}`} disabled={!selectedId}>
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
