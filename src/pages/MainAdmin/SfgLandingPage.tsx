// src/pages/Items/SfgLandingPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import SfgBOMPage from "./SfgBOMPage";

type Item = { id: number; code?: string; name?: string; is_production?: boolean | number; brand_id?: number | null; category_item_id?: number | null };

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

/** small fetch helper that throws on non-2xx */
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

export default function SfgLandingPage(): JSX.Element {
  const [sfgs, setSfgs] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedSfg, setSelectedSfg] = useState<Item | null>(null);
  const [componentsForSfg, setComponentsForSfg] = useState<any[] | null>(null);

  const fetchJson = useFetchJson();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Accept brandId (numeric) and optional brandKode from querystring.
  const qBrandId = Number(searchParams.get("brandId") || "");
  const qBrandKode = searchParams.get("brandKode") || null;

  const fetchSfgsByBrand = useCallback(async (brandId?: number | null, brandKode?: string | null) => {
    setLoading(true);
    try {
      let body: any = null;
      if (typeof brandId === "number" && !Number.isNaN(brandId)) {
        // prefer brand-scoped endpoint you already provided
        try {
          body = await fetchJson(`${API_BASE}/api/brands/${brandId}/items`);
        } catch (err) {
          // fallback to generic item endpoint with brand_id query param
          try {
            body = await fetchJson(`${API_BASE}/api/item?brand_id=${brandId}`);
          } catch (err2) {
            // last resort: fetch all items
            body = await fetchJson(`${API_BASE}/api/item`);
          }
        }
      } else {
        // no brand specified: fall back to generic SFG query
        try {
          body = await fetchJson(`${API_BASE}/api/items?category=sfg`);
        } catch (err) {
          body = await fetchJson(`${API_BASE}/api/item`);
        }
      }

      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      // Heuristic: identify SFG by category_item_id OR code contains ".SFG." OR category query used
      const sfgCandidates = (rows || []).filter((r: any) => {
        if (!r) return false;
        // if backend returned category_item_id for items, prefer explicit check:
        if (r.category_item_id && Number(r.category_item_id) === Number(import.meta.env.VITE_CATEGORY_SFG_ID || 3)) return true;
        // check code containing .SFG. or -SFG- etc (case-insensitive)
        const code = String(r.code || r.kode || r.name || "").toLowerCase();
        if (code.includes(".sfg.") || code.includes("-sfg-") || code.includes("_sfg_") || code.endsWith(".sfg")) return true;
        // as last fallback, if brandKode provided and item code starts with brandKode, treat as candidate
        if (brandKode && String(r.code || r.kode || "").toLowerCase().startsWith(String(brandKode).toLowerCase())) {
          // prefer items that appear production
          return (r.is_production === 1 || r.is_production === true) || !r.code;
        }
        return false;
      });

      // normalize minimal fields
      const norm: Item[] = (sfgCandidates || []).map((r:any) => ({
        id: Number(r.id),
        code: r.code ?? r.kode,
        name: r.name ?? r.title ?? `Item ${r.id}`,
        is_production: r.is_production,
        brand_id: r.brand_id ?? r.brandId ?? null,
        category_item_id: r.category_item_id ?? null
      }));

      setSfgs(norm);
    } catch (err) {
      console.error("Failed load SFGs", err);
      setSfgs([]);
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    // prefer brandId from query string (so BrandLandingPage can link to /items/sfg?brandId=...)
    const brandIdToUse = qBrandId || undefined;
    const brandKodeToUse = qBrandKode || null;
    fetchSfgsByBrand(brandIdToUse as number | undefined, brandKodeToUse);
  }, [qBrandId, qBrandKode, fetchSfgsByBrand]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sfgs;
    return sfgs.filter(s => (s.name || s.code || "").toLowerCase().includes(term));
  }, [sfgs, q]);

  async function onClickSfg(s: Item) {
    setSelectedSfg(s);
    setComponentsForSfg(null);
    // try load components for SFG (RM) with same fallback strategy as earlier
    try {
      let body: any = null;
      try {
        body = await fetchJson(`${API_BASE}/api/item-components/sfg/${s.id}/components`);
      } catch (e1) {
        try { body = await fetchJson(`${API_BASE}/api/item-components/fg/${s.id}/components`); }
        catch (e2) { body = await fetchJson(`${API_BASE}/api/item-components?item_id=${s.id}`); }
      }
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      setComponentsForSfg(rows || []);
      setTimeout(() => window.scrollTo({ top: 400, behavior: "smooth" }), 100);
    } catch (err) {
      console.warn("Failed to load components for SFG (preview)", err);
      setComponentsForSfg(null);
    }
  }

  // optional: expose navigation helper so BrandLandingPage can navigate to this page
  // navigate(`/items/sfg?brandId=${brandId}&brandKode=${encodeURIComponent(brandKode)}`);

  return (
    <>
      <PageMeta title="Pilih SFG (per Brand)" description="Pilih SFG untuk menampilkan RM / recipe (di-scope per Brand)" />
      <PageBreadcrumb pageTitle="Items / Pilih SFG" />

      <div className="space-y-6">
        <ComponentCard title={qBrandId ? `Pilih SFG (Brand ID: ${qBrandId})` : "Pilih SFG"}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <input className="border rounded px-3 py-2" placeholder="Cari SFG..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="text-sm text-gray-500">{loading ? "Memuat..." : `${sfgs.length} SFG`}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map(s => (
              <button key={s.id} onClick={() => onClickSfg(s)} className={`p-4 rounded border text-left hover:shadow ${selectedSfg?.id === s.id ? "ring-2 ring-indigo-300" : ""}`}>
                <div className="font-medium">{s.name ?? s.code ?? `SFG ${s.id}`}</div>
                <div className="text-xs text-gray-500">{s.code ?? ""}</div>
              </button>
            ))}
          </div>
        </ComponentCard>

        {selectedSfg && (
          <ComponentCard title={`SFG: ${selectedSfg.name ?? selectedSfg.code}`}>
            <div className="mb-2">
              <button className="px-3 py-1 bg-gray-100 rounded text-sm" onClick={() => { setSelectedSfg(null); setComponentsForSfg(null); }}>Tutup SFG</button>
            </div>

            {/* @ts-ignore */}
            <SfgBOMPage initialSfgId={selectedSfg.id} initialComponents={componentsForSfg} />
          </ComponentCard>
        )}
      </div>
    </>
  );
}
