import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import ItemBOMPage from "./ItemBOMPage";

type Brand = {
  id: number;
  kode?: string;
  nama?: string;
  logo?: string | null;
  color?: string | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function useFetchJson() {
  return useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, opts);
    const ct = res.headers.get("content-type") || "";
    let body: any = null;
    if (ct.includes("application/json")) body = await res.json();
    else body = await res.text();
    if (!res.ok) {
      const msg = typeof body === "object" && body !== null ? (body.message || body.error || JSON.stringify(body)) : String(body || res.statusText);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  }, []);
}

const getLogoUrl = (logo?: string | null) => {
  if (!logo) return null;

  // absolute URL (http/https or data:)
  if (/^(https?:)?\/\//i.test(logo) || logo.startsWith('data:')) return logo;

  // already starts with /images/
  if (logo.startsWith('/images/')) return logo;

  // missing leading slash, e.g. images/logo/file.png
  if (logo.startsWith('images/')) return `/${logo}`;

  // filename only -> map to public/images/logo/
  return `/images/logo/${logo}`;
};

export default function BrandLandingPage(): JSX.Element {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [itemsForBrand, setItemsForBrand] = useState<any[] | null>(null);
  const [inlineMode] = useState(true);
  const fetchJson = useFetchJson();
  const navigate = useNavigate();

  useEffect(() => {
    console.group("=== LOGO DEBUG ===");
    brands.forEach((b, i) => {
      console.log(`Brand #${i + 1}`);
      console.log("id:", b.id);
      console.log("nama:", b.nama);
      console.log("kode:", b.kode);
      console.log("logo (as received):", b.logo);
      console.log("resolved src:", getLogoUrl(b.logo));
      console.log("----------");
    });
    console.groupEnd();
  }, [brands]);


  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const body: any = await fetchJson(`${API_BASE}/api/brands`);
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      setBrands(rows || []);
    } catch (err) {
      console.error("Failed load brands", err);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return brands;
    return brands.filter(b => (b.nama || b.kode || "").toLowerCase().includes(term));
  }, [brands, q]);

  // helper: FG filter used on responses
  const filterFG = (rows: any[] | null) => {
    if (!rows) return [];
    const fgRegex = /(^|[.\-_])FG([.\-_]|$)/i;
    return (rows || []).filter((r: any) => {
      const isProd = r.is_production === 1 || r.is_production === true;
      const code = (r.code || r.kode || "").toString();
      const hasFg = fgRegex.test(code);
      return isProd && (hasFg || !code);
    });
  };

  async function onClickBrandInline(b: Brand) {
    setSelectedBrand(b);
    setItemsForBrand(null);
    try {
      const body: any = await fetchJson(`${API_BASE}/api/brands/${b.id}/items`);
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      // apply FG filter before storing
      setItemsForBrand(filterFG(rows));
      // optional: scroll to items
      setTimeout(() => window.scrollTo({ top: 400, behavior: "smooth" }), 100);
    } catch (err) {
      console.warn("Failed to load items for brand (falling back)", err);
      // fallback: try GET /api/item?brand_id=... then filter
      try {
        const body2: any = await fetchJson(`${API_BASE}/api/item?brand_id=${b.id}`);
        const rows2 = Array.isArray(body2) ? body2 : (body2 && body2.data ? body2.data : []);
        setItemsForBrand(filterFG(rows2));
      } catch (err2) {
        // leave itemsForBrand null so ItemBOMPage will fetch and filter by code if possible
        setItemsForBrand(null);
      }
    }
  }

  function onClickBrand(b: Brand) {
    if (inlineMode) onClickBrandInline(b);
    else navigate(`/items/bom?brandId=${b.id}&brandKode=${encodeURIComponent(b.kode || "")}`);
  }
  



  return (
    <>
      <PageMeta title="Pilih Brand" description="Pilih brand untuk menampilkan produk" />
      <PageBreadcrumb pageTitle="Items / Pilih Brand" />

      <div className="space-y-6">
        <ComponentCard title="Pilih Brand">
          <div className="flex items-center justify-between mb-4">
            <div>
              <input
                className="border rounded px-3 py-2"
                placeholder="Cari brand..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="text-sm text-gray-500">{loading ? "Memuat..." : `${brands.length} brand`}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(b => (
              <button
                key={b.id}
                onClick={() => onClickBrand(b)}
                className={`p-4 rounded border text-left flex gap-3 items-center hover:shadow ${selectedBrand?.id === b.id ? "ring-2 ring-indigo-300" : ""}`}
              >
                <div className="w-16 h-16 bg-gray-100 flex items-center justify-center rounded overflow-hidden">
                  {b.logo ? (
                    <img
                      src={getLogoUrl(b.logo)}
                      alt={b.nama ?? `Brand ${b.id}`}
                      className="max-h-full max-w-full object-contain border border-gray-200"
                      onError={(e) => {
                        console.warn("⚠️ Failed to load logo:", {
                          id: b.id,
                          nama: b.nama,
                          triedSrc: e.currentTarget.src,
                        });
                        e.currentTarget.src = "/images/logo/placeholder.png";
                      }}
                    />

                  ) : (
                    <div className="text-xs text-gray-400">No Logo</div>
                  )}
                </div>


                <div className="flex-1">
                  <div className="font-medium">{b.nama ?? b.kode ?? `Brand ${b.id}`}</div>
                  <div className="text-xs text-gray-500">{b.kode ?? ""}</div>
                  {b.color && <div className="mt-2 inline-block px-2 py-1 rounded text-xs" style={{ backgroundColor: b.color, color: '#fff' }}>{b.color}</div>}
                </div>
              </button>
            ))}
          </div>
        </ComponentCard>

        {inlineMode && selectedBrand && (
          <ComponentCard title={`Products of ${selectedBrand.nama ?? selectedBrand.kode ?? selectedBrand.id}`}>
            <div className="mb-2">
              <button className="px-3 py-1 bg-gray-100 rounded text-sm" onClick={() => { setSelectedBrand(null); setItemsForBrand(null); }}>Tutup Brand</button>
            </div>

            {/* pass initialBrandKode and initialItems to ItemBOMPage */}
            {/* @ts-ignore */}
            <ItemBOMPage
              initialBrandId={selectedBrand.id}
              initialItems={itemsForBrand}
              initialBrandKode={selectedBrand.kode ?? null}
            />
          </ComponentCard>
        )}
      </div>
    </>
  );
}
