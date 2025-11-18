// src/pages/Items/BrandToSfgPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";

type Brand = { id: number; kode?: string; nama?: string; logo?: string | null; color?: string | null };
type Item = { id: number; code?: string; name?: string; is_production?: boolean | number; brand_id?: number | null; };

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function useFetchJson() {
  return useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, opts);
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = (body && (body.message || body.error)) || String(body || res.statusText);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  }, []);
}

export default function BrandToSfgPage(): JSX.Element {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);

  const [sfgItems, setSfgItems] = useState<Item[]>([]);
  const [loadingSfg, setLoadingSfg] = useState(false);
  const [qSfg, setQSfg] = useState("");

  const [error, setError] = useState<string | null>(null);

  const fetchJson = useFetchJson();
  const navigate = useNavigate();

  // fetch brands
  const fetchBrands = useCallback(async () => {
    setLoadingBrands(true);
    setError(null);
    try {
      let body: any;
      try { body = await fetchJson(`${API_BASE}/api/brands`); }
      catch (err) { body = await fetchJson(`${API_BASE}/api/brand`); }
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      const norm = (rows || []).map((r: any) => ({ id: Number(r.id), kode: r.kode ?? r.code, nama: r.name ?? r.nama ?? r.title ?? r.kode ?? `Brand ${r.id}`, logo: r.logo ?? null, color: r.color ?? null }));
      setBrands(norm);
    } catch (err: any) {
      console.error("fetchBrands error", err);
      setBrands([]);
      setError(err?.message || "Gagal memuat brands");
    } finally {
      setLoadingBrands(false);
    }
  }, [fetchJson]);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  // helper filter for sfg (code startsWith brand.kode and contains SFG token)
  const makeSfgFilter = (brandKode?: string | null) => {
    const kode = String(brandKode || "").trim();
    const escaped = kode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const startsWithRe = escaped.length ? new RegExp(`^${escaped}`, "i") : null;
    const sfgTokenRe = /(^|[.\-_])SFG([.\-_]|$)/i;
    return (item: any) => {
      const code = String(item.code || item.kode || item.name || "").trim();
      if (!code) return false;
      if (startsWithRe && !startsWithRe.test(code)) return false;
      if (!sfgTokenRe.test(code)) return false;
      return true;
    };
  };

  // fetch sfg for a brand
  const fetchSfgsForBrand = useCallback(async (brand: Brand | null) => {
    setLoadingSfg(true);
    setError(null);
    setSfgItems([]);
    if (!brand) { setLoadingSfg(false); return; }

    try {
      let body: any = null;
      try { body = await fetchJson(`${API_BASE}/api/brands/${brand.id}/items`); }
      catch (err1) {
        try { body = await fetchJson(`${API_BASE}/api/item?brand_id=${brand.id}`); }
        catch (err2) { body = await fetchJson(`${API_BASE}/api/item`); }
      }

      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      const sfgFilter = makeSfgFilter(brand.kode ?? null);
      const filtered = (rows || []).filter((r: any) => sfgFilter(r));

      const norm: Item[] = (filtered || []).map((r: any) => ({
        id: Number(r.id),
        code: r.code ?? r.kode,
        name: r.name ?? r.title ?? `Item ${r.id}`,
        is_production: r.is_production === 1 || r.is_production === true,
        brand_id: r.brand_id ?? r.brandId ?? null
      }));

      setSfgItems(norm);
    } catch (err: any) {
      console.error("fetchSfgsForBrand error", err);
      setError(err?.message || "Gagal memuat SFG untuk brand ini");
      setSfgItems([]);
    } finally {
      setLoadingSfg(false);
    }
  }, [fetchJson]);

  // brand click -> load SFGs
  async function onClickBrand(b: Brand) {
    setSelectedBrand(b);
    setQSfg("");
    await fetchSfgsForBrand(b);
    setTimeout(() => window.scrollTo({ top: 300, behavior: "smooth" }), 80);
  }

  function onBackToBrands() {
    setSelectedBrand(null);
    setSfgItems([]);
    setQSfg("");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }

  const filteredSfg = useMemo(() => {
    const term = qSfg.trim().toLowerCase();
    if (!term) return sfgItems;
    return sfgItems.filter(s => (s.name || s.code || "").toLowerCase().includes(term));
  }, [sfgItems, qSfg]);

  // navigate to separate SFG manage page
  function goToSfgManage(s: Item) {
    navigate(`/items/sfg/${s.id}`);
  }

  return (
    <>
      <PageMeta title="Pilih Brand → SFG" description="Pilih brand, lalu tampilkan SFG untuk brand tersebut (berdasarkan kode RG.SFG...)" />
      <PageBreadcrumb pageTitle="Items / Brand → SFG" />

      <div className="space-y-6">
        {!selectedBrand && (
          <ComponentCard title="Pilih Brand">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">Klik brand untuk menampilkan SFG milik brand tersebut</div>
              <div className="text-sm text-gray-500">{loadingBrands ? "Memuat..." : `${brands.length} brand`}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {brands.map(b => (
                <button key={b.id} onClick={() => onClickBrand(b)} className="p-4 rounded border text-left flex gap-3 items-center hover:shadow">
                  <div className="w-16 h-16 bg-gray-100 flex items-center justify-center rounded overflow-hidden">
                    {b.logo ? <img src={b.logo.startsWith("/") ? b.logo : b.logo} alt={b.nama} className="max-h-full max-w-full object-contain" /> : <div className="text-xs text-gray-400">No Logo</div>}
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
        )}

        {selectedBrand && (
          <ComponentCard title={`SFG of ${selectedBrand.nama ?? selectedBrand.kode ?? selectedBrand.id}`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 bg-gray-100 rounded text-sm" onClick={onBackToBrands}>Kembali ke Brands</button>
                <div className="text-sm text-gray-600">Brand kode: <b className="ml-1">{selectedBrand.kode}</b></div>
              </div>

              <div className="flex items-center gap-3">
                <input className="border rounded px-3 py-2" placeholder="Cari SFG..." value={qSfg} onChange={(e) => setQSfg(e.target.value)} />
                <div className="text-sm text-gray-500">{loadingSfg ? "Memuat..." : `${sfgItems.length} SFG`}</div>
              </div>
            </div>

            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredSfg.length === 0 ? (
                <div className="col-span-full text-sm text-gray-500 p-3">Tidak ditemukan SFG untuk brand ini.</div>
              ) : (
                filteredSfg.map(s => (
                  <div key={s.id} className="p-3 border rounded hover:shadow">
                    <div className="font-medium">{s.name ?? s.code ?? `SFG ${s.id}`}</div>
                    <div className="text-xs text-gray-500">{s.code ?? ""}</div>

                    <div className="mt-3 flex gap-2">
                      <button className="px-2 py-1 bg-blue-600 text-white rounded text-sm" onClick={() => goToSfgManage(s)}>Manage RM</button>
                      <button className="px-2 py-1 bg-gray-100 rounded text-sm" onClick={() => navigate(`/items/sfg/${s.id}/view`)}>View (UI)</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ComponentCard>
        )}
      </div>
    </>
  );
}
