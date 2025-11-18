// src/pages/BrandItemsLanding.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Brand = { id: string; kode?: string; nama?: string; logo?: string | null; color?: string | null };

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

function getLogoUrl(logo?: string | null) {
  if (!logo) return "/images/logo/placeholder.png";
  if (/^(https?:|data:|\/\/)/.test(logo)) return logo;
  if (logo.startsWith("/uploads")) return `${API_BASE}${logo}`;
  if (logo.startsWith("/images")) return logo;
  return `${API_BASE}/uploads/brands/${logo}`;
}

export default function BrandItemsLanding(): JSX.Element {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchBrands() {
    setLoading(true);
    try {
      const resp = await axios.get("/api/brands", { params: { limit: 200 } });
      const data = resp.data;
      const rows = data?.data ?? (Array.isArray(data) ? data : []);
      setBrands(rows);
    } catch (err: any) {
      console.error("fetchBrands error", err);
      toast.error(err?.response?.data?.message || "Gagal memuat brands");
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return brands;
    return brands.filter(b => {
      const name = (b.nama || "").toLowerCase();
      const kode = (b.kode || "").toLowerCase();
      return name.includes(term) || kode.includes(term);
    });
  }, [brands, q]);

  return (
    <>
      <PageMeta title="Brands" description="Daftar brand" />
      <PageBreadcrumb pageTitle="Brands" />

      <div className="space-y-6 p-6">
        <ToastContainer position="top-right" autoClose={2000} />
        <ComponentCard title="Pilih Brand untuk melihat Items / Store">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                className="w-full sm:w-72 border rounded px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Cari brand (nama atau kode)..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="text-sm text-gray-500">{loading ? "Memuat..." : `${filtered.length} dari ${brands.length} brand`}</div>
            </div>

            {/* <div className="flex gap-2">
              <button
                onClick={() => { setQ(""); }}
                className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
              >
                Reset
              </button>
              <button
                onClick={() => navigate("/brands/new")}
                className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
              >
                Tambah Brand
              </button>
            </div> */}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.length === 0 && !loading ? (
              <div className="col-span-full p-6 text-center text-gray-500">Belum ada brand.</div>
            ) : (
              filtered.map((b) => (
                <div
                  key={b.id}
                  className="border rounded-lg p-4 flex flex-col justify-between bg-white hover:shadow transition-shadow"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                      <img
                        src={getLogoUrl(b.logo)}
                        alt={b.nama || b.kode || `Brand ${b.id}`}
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/logo/placeholder.png"; }}
                      />
                    </div>

                    <div className="flex-1">
                      <div className="font-medium text-sm">{b.nama ?? b.kode ?? `Brand ${b.id}`}</div>
                      <div className="text-xs text-gray-500 mt-1">{b.kode ?? "-"}</div>

                      {/* {b.color && (
                        <div className="mt-3">
                          <span
                            className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium"
                            style={{ backgroundColor: b.color, color: '#fff' }}
                          >
                            {b.color}
                          </span>
                        </div>
                      )} */}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-start gap-2">
                    <button
                      onClick={() => navigate(`/superadmin/brands/${b.id}/items`)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                    >
                      Lihat Items
                    </button>

                    <button
                      onClick={() => navigate(`/brands/${b.id}/stores`)}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                      Lihat store
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ComponentCard>
      </div>
    </>
  );
}
