// src/pages/store/BrandSelectionPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";

type Brand = {
  id?: string | number;
  uuid?: string;
  kode?: string;
  code?: string;
  nama?: string;
  name?: string;
  logo?: string | null;
  color?: string | null;
  // optional server-provided
  pending_count?: number;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

function getLogoUrl(logo?: string | null) {
  if (!logo) return "/images/logo/placeholder.png";
  if (/^(https?:|data:|\/\/)/.test(logo)) return logo;
  if (logo.startsWith("/uploads")) return `${API_BASE}${logo}`;
  if (logo.startsWith("/images")) return logo;
  return `${API_BASE}/uploads/brands/${logo}`;
}

export default function BrandSelectionPage(): JSX.Element {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [totalPending, setTotalPending] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchBrands() {
    setLoading(true);
    try {
      const url = `${API_BASE}/api/admin/brands`;
      console.debug("[BrandSelection] GET", url);
      const resp = await axios.get(url, { params: { limit: 200 } });
      const data = resp.data;
      const rows = data?.data ?? (Array.isArray(data) ? data : []);
      const arr = Array.isArray(rows) ? rows : [];
      setBrands(arr);

      // compute pending counts: prefer server-provided field `pending_count`, otherwise fetch per-brand
      const counts: Record<string, number> = {};
      const needFetchIds: (string | number)[] = [];

      arr.forEach((b: any) => {
        const key = String(b.id ?? b.uuid ?? "");
        if (typeof b.pending_count === "number") {
          counts[key] = b.pending_count;
        } else {
          needFetchIds.push(b.id ?? b.uuid);
        }
      });

      if (needFetchIds.length > 0) {
        // fetch pending requests for each brand in parallel
        const promises = needFetchIds.map((bid) => {
          // tries a sensible endpoint that most backends would have:
          // GET /api/admin/brands/:brandId/requests?status=pending
          const idStr = String(bid);
          const urlReq = `${API_BASE}/api/admin/brands/${encodeURIComponent(idStr)}/requests`;
          return axios
            .get(urlReq, { params: { status: "pending", limit: 1_000_000 } }) // limit large to get full array
            .then((r) => {
              const body = r.data;
              const arrResp = Array.isArray(body) ? body : (body && body.data ? body.data : []);
              counts[idStr] = Array.isArray(arrResp) ? arrResp.length : 0;
            })
            .catch((err) => {
              // fallback: try /api/store-requests?brand_id=...
              const fallbackUrl = `${API_BASE}/api/store-requests`;
              return axios
                .get(fallbackUrl, { params: { brand_id: bid, status: "pending", limit: 100000 } })
                .then((r2) => {
                  const b2 = r2.data;
                  const arr2 = Array.isArray(b2) ? b2 : (b2 && b2.data ? b2.data : []);
                  counts[String(bid)] = Array.isArray(arr2) ? arr2.length : 0;
                })
                .catch(() => {
                  counts[String(bid)] = 0;
                });
            });
        });

        await Promise.all(promises);
      }

      // also include any server-provided pending_count keys we had
      // set state
      setPendingCounts(counts);

      // total pending
      const total = Object.values(counts).reduce((s, v) => s + (Number(v) || 0), 0);
      setTotalPending(total);
    } catch (err) {
      console.error("fetchBrands error", err);
      setBrands([]);
      setPendingCounts({});
      setTotalPending(0);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return brands;
    return brands.filter((b) => {
      const name = (b.nama ?? b.name ?? "").toString().toLowerCase();
      const code = (b.kode ?? b.code ?? "").toString().toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [brands, q]);

  function openBrand(b: Brand) {
    const id = b.id ?? b.uuid;
    if (!id) return;
    navigate(`/admin/brands/${id}/requests`);
  }

  return (
    <>
      <PageMeta title="Pilih Brand" description="Pilih brand untuk melihat permintaan (requests)" />
      <PageBreadcrumb pageTitle="Brands / Pilih Brand" />

      <div className="space-y-6 p-6">
        <ComponentCard title={
          <div className="flex items-center justify-between">
            <div>Pilih Brand untuk cek Request</div>
            <div className="text-sm text-gray-600">
              {loading ? "Memuat..." : `Total pending: `}
              <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-red-600 text-white rounded-full text-xs font-semibold">
                {totalPending}
              </span>
            </div>
          </div>
        }>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                className="w-full sm:w-64 border rounded px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Cari brand (nama atau kode)..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              
            </div>

            <div className="flex gap-2">
              <div className="text-sm text-gray-500">{loading ? "Memuat..." : `${filtered.length} dari ${brands.length} brand`}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {!loading && filtered.length === 0 ? (
              <div className="col-span-full p-6 text-center text-gray-500">Belum ada brand.</div>
            ) : (
              filtered.map((b) => {
                const idKey = b.id ?? b.uuid ?? JSON.stringify(b);
                const title = b.nama ?? b.name ?? b.kode ?? `Brand ${idKey}`;
                const keyStr = String(b.id ?? b.uuid ?? idKey);
                const pend = pendingCounts[keyStr] ?? (typeof b.pending_count === "number" ? b.pending_count : 0);
                return (
                  <div key={idKey} className="border rounded-lg p-4 flex flex-col justify-between bg-white hover:shadow transition-shadow">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center relative">
                        <img
                          src={getLogoUrl(b.logo)}
                          alt={title}
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/logo/placeholder.png"; }}
                        />
                        {pend > 0 && (
                          <div className="absolute -top-1 -right-1">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 bg-red-600 text-white rounded-full text-xs font-semibold">
                              {pend}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="font-medium text-sm">{title}</div>
                        <div className="text-xs text-gray-500 mt-1">{b.kode ?? b.code ?? "-"}</div>
                        {pend > 0 && (
                          <div className="mt-2 text-xs text-red-600">Ada {pend} request pending</div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-start gap-2">
                      <button
                        onClick={() => openBrand(b)}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                      >
                        Lihat Requests
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ComponentCard>
      </div>
    </>
  );
}
