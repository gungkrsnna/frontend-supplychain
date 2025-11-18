// src/pages/BrandSelectForProduction.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Brand = { id: string; nama?: string; kode?: string; logo?: string | null; [k: string]: any };

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

export default function BrandSelectForProduction(): JSX.Element {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { loadBrands(); }, []);

  async function loadBrands() {
    setLoading(true);
    setErr(null);
    try {
      const resp = await axios.get(`${API_BASE}/api/brands`);
      const rows = Array.isArray(resp.data?.data) ? resp.data.data : resp.data;
      setBrands(rows || []);
    } catch (e: any) {
      console.error("loadBrands error", e);
      setErr(e?.message || "Gagal memuat daftar brand");
      toast.error("Gagal memuat brands");
    } finally {
      setLoading(false);
    }
  }

  function goToPlanWithBrand(b?: Brand) {
    // If no brand -> All Stores behavior
    if (!b) {
      navigate(`/superadmin/target-production-next-day?brandKey=__ALL__`);
      return;
    }

    // Use display name as brandKey (TargetProductionNextDay expects keys like "Panina" etc).
    // Also include brandId for future-proofing.
    const brandKey = encodeURIComponent(String(b.nama ?? b.kode ?? b.id));
    const brandId = encodeURIComponent(String(b.id));
    navigate(`/superadmin/target-production-next-day?brandKey=${brandKey}&brandId=${brandId}`);
  }

  return (
    <div className="p-6 mx-auto">
      <ToastContainer position="top-right" autoClose={2500} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pilih Brand untuk Target Produksi</h1>
          <p className="text-sm text-gray-500">Pilih brand yang ingin dibuat target produksinya untuk hari esok.</p>
        </div>
        <div>
          <button onClick={() => goToPlanWithBrand()} className="px-3 py-2 bg-gray-100 rounded">All Stores</button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading brands...</div>
      ) : err ? (
        <div className="py-6 text-red-600">{err}</div>
      ) : brands.length === 0 ? (
        <div className="py-6 text-gray-600">Belum ada brand.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {brands.map(b => (
            <div key={b.id} className="border rounded p-4 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                {b.logo ? (
                  <img src={b.logo} alt={b.nama ?? b.kode} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">No Logo</div>
                )}
                <div>
                  <div className="font-medium">{b.nama ?? `Brand ${b.id}`}</div>
                  <div className="text-xs text-gray-500">{b.kode ?? "-"}</div>
                </div>
              </div>

              <div className="flex-1 text-sm text-gray-600 mb-3">
                {/* optionally show short description if exists */}
                {b.description ? b.description : <span className="text-xs text-gray-400">No description</span>}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => goToPlanWithBrand(b)}
                  className="px-3 py-2 bg-blue-600 text-white rounded"
                >
                  Pilih
                </button>

                <button
                  onClick={() => {
                    // quick-preview: open brand items page (optional)
                    window.open(`/superadmin/brands/${encodeURIComponent(String(b.id))}/items`, "_blank");
                  }}
                  className="px-3 py-2 border rounded"
                >
                  Items
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
