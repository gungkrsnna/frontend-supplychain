// src/pages/Items/SfgBOMPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";

type Item = { id: number; code?: string; name?: string; is_production?: boolean | number; uom_id?: number | null; uom?: any | null };
type ComponentRow = {
  id: number | string;
  component_item_id: number | null;
  component_item?: Item | null;
  quantity: number;
  uom_id?: number | null;
  is_optional?: boolean;
  _isNew?: boolean;
  _deleted?: boolean;
  _dirty?: boolean;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function useFetchJson() {
  return useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, opts);
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = typeof body === "object" && body !== null ? (body.message || body.error || JSON.stringify(body)) : String(body || res.statusText);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  }, []);
}

type Props = { initialSfgId?: number | null; initialComponents?: any[] | null };

export default function SfgBOMPage({ initialSfgId = null, initialComponents = null }: Props): JSX.Element {
  const [sfgId, setSfgId] = useState<number | null>(initialSfgId ?? null);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [items, setItems] = useState<Item[]>([]); // potential RM item pool
  const [uomMap, setUomMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fetchJson = useFetchJson();

  const itemsCache = useRef<Record<string, Item[]>>({});

  useEffect(() => {
    if (initialComponents && Array.isArray(initialComponents)) {
      // normalize incoming components into ComponentRow shape
      const mapped: ComponentRow[] = initialComponents.map((r: any) => {
        const comp = r.componentItem || r.component_item || r.component || r.item || null;
        return {
          id: r.id ?? `srv-${Math.random().toString(36).slice(2,9)}`,
          component_item_id: Number(r.component_item_id ?? r.componentItemId ?? (comp && comp.id) ?? null),
          component_item: comp ? { id: Number(comp.id), name: comp.name, code: comp.code, uom: comp.uom } : null,
          quantity: Number(r.quantity ?? r.qty ?? 0),
          uom_id: r.uom_id ?? (comp && comp.uom_id) ?? null,
          is_optional: !!r.is_optional,
          _isNew: false,
          _deleted: false,
          _dirty: false
        };
      });
      setComponents(mapped);
    }
  }, [initialComponents]);

  // fetch UOMs
  const fetchUoms = useCallback(async () => {
    try {
      const body = await fetchJson(`${API_BASE}/api/uoms`);
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      const map: Record<number, string> = {};
      (rows || []).forEach((u: any) => { map[Number(u.id)] = u.name; });
      setUomMap(map);
    } catch (err) {
      console.warn("Failed load uoms", err);
    }
  }, [fetchJson]);

  useEffect(() => { fetchUoms(); }, [fetchUoms]);

  // fetch available items (RM pool) for selection (fallbacks)
    // --- derive brandKode dari SFG code (ambil segmen pertama sebelum titik)
  const deriveBrandKodeFromSfg = useCallback(async (sfgId: number | null) => {
    if (!sfgId) return null;
    try {
      const body = await fetchJson(`${API_BASE}/api/item/${sfgId}`);
      const data = body && body.data ? body.data : body;
      const code = (data && (data.code || data.kode)) ? String(data.code || data.kode) : (data && data.name ? String(data.name) : "");
      if (!code) return null;
      // brandKode dianggap segmen sebelum titik (.)
      const seg = code.split('.')[0];
      return (seg || "").toString();
    } catch (err) {
      console.warn("Failed to fetch SFG detail to derive brandKode", err);
      return null;
    }
  }, [fetchJson]);

  // fetch available items (RM pool) for selection (with RM-only filter based on brandKode)
  const fetchItemsPool = useCallback(async () => {
    try {
      // derive brandKode from sfgId if available
      const brandKode = await deriveBrandKodeFromSfg(sfgId);

      // caching key includes brandKode so pool differs per brand
      const cacheKey = `all:${brandKode ?? "global"}`;
      if (itemsCache.current[cacheKey]) { setItems(itemsCache.current[cacheKey]); return; }

      let body: any;
      try {
        // try category=rm endpoint first (if backend supports)
        body = await fetchJson(`${API_BASE}/api/items?category=rm`);
      } catch (e1) {
        try {
          body = await fetchJson(`${API_BASE}/api/item?category=rm`);
        } catch (e2) {
          body = await fetchJson(`${API_BASE}/api/item`);
        }
      }

      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      // build RM detection:
      const rmTokenRe = /(^|[.\-_])RM([.\-_]|$)/i;
      // brand startsWith regex if brandKode known
      const startsWithRe = brandKode ? new RegExp(`^${brandKode.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}`, "i") : null;
      // optional env var for category id for RM if you have it
      const envCategoryRm = Number(import.meta.env.VITE_CATEGORY_RM_ID || 0);

      const normalized: Item[] = (rows || []).filter((r: any) => {
        if (!r) return false;
        // prefer explicit category match if provided
        if (envCategoryRm && Number(r.category_item_id) === envCategoryRm) {
          // brand check: if brandKode available require it; else accept
          if (startsWithRe && r.code) return startsWithRe.test(String(r.code));
          return true;
        }

        const code = String(r.code || r.kode || r.name || "").trim();
        if (!code) return false;
        // must contain RM token
        if (!rmTokenRe.test(code)) return false;
        // if brandKode known, must start with it
        if (startsWithRe && !startsWithRe.test(code)) return false;
        return true;
      }).map((r: any) => ({ id: Number(r.id), code: r.code ?? r.kode, name: r.name ?? r.title ?? `Item ${r.id}`, is_production: r.is_production, uom_id: r.uom_id ?? null, uom: r.uom ?? null }));

      itemsCache.current[cacheKey] = normalized;
      setItems(normalized);
    } catch (err) {
      console.warn("Failed load items pool (RM filtered)", err);
      setItems([]);
    }
  }, [fetchJson, sfgId, deriveBrandKodeFromSfg]);
 

  useEffect(() => { fetchItemsPool(); }, [fetchItemsPool]);

  // fetch components for given SFG from server
  const fetchComponentsForSfg = useCallback(async (id: number | null) => {
    setLoading(true);
    try {
      if (!id) { setComponents([]); setLoading(false); return; }
      let body: any = null;
      try { body = await fetchJson(`${API_BASE}/api/item-components/sfg/${id}/components`); }
      catch (e1) {
        try { body = await fetchJson(`${API_BASE}/api/item-components/fg/${id}/components`); } // fallback
        catch (e2) { body = await fetchJson(`${API_BASE}/api/item-components?item_id=${id}`); }
      }
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      const mapped: ComponentRow[] = (rows || []).map((r:any) => {
        const comp = r.componentItem || r.component_item || r.component || r.item || null;
        return {
          id: r.id ?? `srv-${Math.random().toString(36).slice(2,9)}`,
          component_item_id: Number(r.component_item_id ?? (comp && comp.id) ?? null),
          component_item: comp ? { id: Number(comp.id), name: comp.name, code: comp.code, uom: comp.uom } : null,
          quantity: Number(r.quantity ?? r.qty ?? 0),
          uom_id: r.uom_id ?? (comp && comp.uom_id) ?? null,
          is_optional: !!r.is_optional,
          _isNew: false,
          _deleted: false,
          _dirty: false
        };
      });
      setComponents(mapped);
    } catch (err) {
      console.error("fetchComponentsForSfg", err);
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    if (sfgId) fetchComponentsForSfg(sfgId);
  }, [sfgId, fetchComponentsForSfg]);

  // Allow parent to set sfgId
  useEffect(() => { if (initialSfgId) setSfgId(initialSfgId); }, [initialSfgId]);

  const generateTmpId = () => `tmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const markDirtyRow = (id: number | string) => setComponents(prev => prev.map(r => r.id === id ? { ...r, _dirty: true } : r));

  const handleAddComponent = () => {
    if (!sfgId) { alert("Pilih SFG terlebih dahulu"); return; }
    const newRow: ComponentRow = { id: generateTmpId(), component_item_id: null, component_item: null, quantity: 1, uom_id: null, is_optional: false, _isNew: true, _dirty: true, _deleted: false };
    setComponents(prev => [newRow, ...(prev || [])]);
  };

  const handleChangeRow = (id: number | string, field: keyof ComponentRow, value: any) => {
    setComponents(prev => prev.map(r => {
      if (r.id !== id) return r;
      const copy = { ...r } as any;
      copy[field] = value;
      copy._dirty = true;
      if (field === "component_item_id") {
        const it = items.find(it => it.id === Number(value)) || null;
        copy.component_item = it;
      }
      return copy;
    }));
  };

  const handleRemoveRow = (id: number | string) => {
    if (!confirm("Hapus komponen ini dari SFG?")) return;
    setComponents(prev => prev.map(r => (r.id === id ? { ...r, _deleted: true } : r)));
  };

  const validateBeforeSave = async (): Promise<{ ok: boolean; message?: string }> => {
    if (!sfgId) return { ok: false, message: "Pilih SFG dulu." };
    const active = components.filter(c => !c._deleted);
    for (const r of active) {
      if (!r.component_item_id) return { ok: false, message: "Semua komponen harus dipilih." };
      if (Number(r.component_item_id) === Number(sfgId)) return { ok: false, message: "SFG tidak boleh masuk sebagai komponennya sendiri." };
    }
    const seen = new Set<number>();
    for (const r of active) {
      const id = Number(r.component_item_id);
      if (seen.has(id)) return { ok: false, message: "Terdapat komponen duplikat." };
      seen.add(id);
    }
    // optional: circular check re-use existing endpoint if present
    for (const r of components) {
      if (r._deleted) continue;
      if (!r._dirty) continue;
      if (!r.component_item_id) continue;
      try {
        const url = `${API_BASE}/api/item-components/fg/${r.component_item_id}/contains/${sfgId}`;
        const body: any = await fetchJson(url);
        const exists = body && (body.has_component === 1 || body.has_component === true || body.has_component === "1");
        if (exists) return { ok: false, message: `Menambahkan komponen ${r.component_item?.name || r.component_item_id} akan menyebabkan circular BOM.` };
      } catch (err) {
        // warn only; continue — backend may not implement this endpoint
        console.warn("Circular check skipped/failed", err);
      }
    }
    return { ok: true };
  };

  const handleSave = async () => {
    if (!sfgId) { alert("Pilih SFG terlebih dahulu"); return; }
    const val = await validateBeforeSave();
    if (!val.ok) return alert(val.message);
    setSaving(true);
    try {
      // delete rows
      for (const r of components.filter(c => c._deleted && !String(c.id).startsWith("tmp-"))) {
        await fetchJson(`${API_BASE}/api/item-components/${r.id}`, { method: "DELETE" });
      }
      // update existing
      for (const r of components.filter(c => !c._isNew && !c._deleted && c._dirty)) {
        const payload: any = { quantity: Number(r.quantity || 0), uom_id: r.uom_id ?? null, is_optional: !!r.is_optional };
        await fetchJson(`${API_BASE}/api/item-components/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      // create new
      for (const r of components.filter(c => c._isNew && !c._deleted)) {
        const payload = { fg_item_id: sfgId, component_item_id: Number(r.component_item_id), quantity: Number(r.quantity || 0), uom_id: r.uom_id ?? null, is_optional: !!r.is_optional };
        await fetchJson(`${API_BASE}/api/item-components`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      await fetchComponentsForSfg(sfgId);
      alert("Perubahan komponen tersimpan.");
    } catch (err:any) {
      console.error("Save SFG components error", err);
      alert("Gagal menyimpan: " + (err?.message || "unknown"));
    } finally {
      setSaving(false);
    }
  };

  const activeComponents = useMemo(() => components.filter(c => !c._deleted), [components]);

  // --- recipe generator (simple relative share)
  const generateRecipe = (rows: ComponentRow[]) => {
    const act = (rows || []).filter(r => !r._deleted && r.component_item_id);
    const total = act.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const itemsList = act.map(r => {
      const qty = Number(r.quantity) || 0;
      const percent = total > 0 ? (qty / total) * 100 : 0;
      return { rm_id: r.component_item_id, name: r.component_item?.name ?? ("Item#" + r.component_item_id), code: (r.component_item as any)?.code ?? undefined, qty, uom: uomMap[Number(r.uom_id ?? r.component_item?.uom_id ?? "")] ?? (r.uom_id ? String(r.uom_id) : null), percent: Math.round(percent * 100) / 100 };
    });
    return { totalQty: total, items: itemsList };
  };

  const downloadRecipeJson = (recipeObj: any, filename = `recipe-sfg-${sfgId ?? 'unknown'}.json`) => {
    const blob = new Blob([JSON.stringify(recipeObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageMeta title="SFG BOM - RM" description="Manage SFG components (RM) and generate recipe" />
      <div className="space-y-6">
        <ComponentCard title="SFG BOM (SFG → RM)">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{sfgId ? `SFG ID: ${sfgId}` : "Pilih SFG"}</h4>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={handleAddComponent} disabled={!sfgId}>Add Component</button>
              <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => fetchComponentsForSfg(sfgId)} disabled={!sfgId || loading}>Refresh</button>
              <button className="px-3 py-1 bg-yellow-500 text-white rounded" onClick={handleSave} disabled={saving || !sfgId}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>

          <div className="border rounded p-3 bg-white">
            {loading ? <div className="text-sm text-gray-500">Loading components...</div> : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="p-2">RM Item</th>
                        <th className="p-2 w-32">Qty</th>
                        <th className="p-2 w-36">Unit</th>
                        <th className="p-2 w-28">Optional</th>
                        <th className="p-2">Status</th>
                        <th className="p-2 w-28">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeComponents.length === 0 && <tr><td colSpan={6} className="p-3 text-sm text-gray-500">No components for this SFG.</td></tr>}
                      {activeComponents.map(r => {
                        const isNew = !!r._isNew;
                        return (
                          <tr key={String(r.id)} className={`${r._dirty ? "bg-yellow-50" : ""}`}>
                            <td className="p-2 align-top">
                              {isNew ? (
                                <select value={r.component_item_id ?? ""} onChange={(e) => handleChangeRow(r.id, "component_item_id", e.target.value ? Number(e.target.value) : null)} className="w-full border rounded px-2 py-1">
                                  <option value="">-- pilih RM --</option>
                                  {items.map(it => <option key={it.id} value={it.id}>{it.name}{it.code ? ` (${it.code})` : ""}</option>)}
                                </select>
                              ) : (
                                <div><div className="font-medium">{r.component_item?.name ?? ("Item #" + r.component_item_id)}</div><div className="text-xs text-gray-400">{r.component_item?.code ?? ""}</div></div>
                              )}
                            </td>
                            <td className="p-2 align-top"><input type="number" value={r.quantity} onChange={(e) => handleChangeRow(r.id, "quantity", Number(e.target.value))} className="w-full border rounded px-2 py-1" min={0} step={0.0001} /></td>
                            <td className="p-2 align-top"><input type="text" value={uomMap[Number(r.uom_id ?? r.component_item?.uom_id ?? "")] ?? (r.uom_id ? String(r.uom_id) : "")} onChange={(e) => handleChangeRow(r.id, "uom_id", e.target.value ? e.target.value : null)} className="w-full border rounded px-2 py-1" placeholder={r.component_item?.uom?.name ?? "unit"} /></td>
                            <td className="p-2 align-top"><label className="flex items-center gap-2"><input type="checkbox" checked={!!r.is_optional} onChange={(e) => handleChangeRow(r.id, "is_optional", e.target.checked)} /><span className="text-sm">Optional</span></label></td>
                            <td className="p-2 align-top">{r._isNew ? <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">New</span> : r._dirty ? <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">Edited</span> : <span className="text-xs text-gray-600">Saved</span>}</td>
                            <td className="p-2 align-top"><div className="flex gap-2"><button className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs" onClick={() => handleRemoveRow(r.id)}>Delete</button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Recipe Pane */}
                <div className="mt-4 border rounded p-3 bg-gray-50">
                  <h5 className="font-semibold mb-2">Generated Recipe</h5>
                  {activeComponents.length === 0 ? <div className="text-sm text-gray-500">No components to generate recipe.</div> : (() => {
                    const recipe = generateRecipe(activeComponents);
                    return (
                      <div>
                        <div className="text-sm text-gray-600 mb-2">Total (sum qty): <b>{recipe.totalQty}</b></div>
                        <table className="w-full text-sm mb-2">
                          <thead><tr className="text-left"><th className="p-1">RM</th><th className="p-1">Qty</th><th className="p-1">UOM</th><th className="p-1">Share (%)</th></tr></thead>
                          <tbody>{recipe.items.map(it => (<tr key={String(it.rm_id)}><td className="p-1">{it.name}{it.code ? ` (${it.code})` : ""}</td><td className="p-1">{it.qty}</td><td className="p-1">{it.uom ?? "-"}</td><td className="p-1">{it.percent}%</td></tr>))}</tbody>
                        </table>

                        <div className="flex gap-2">
                          <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm" onClick={() => downloadRecipeJson({ sfg_id: sfgId, recipe }, `recipe-sfg-${sfgId}.json`)}>Export JSON</button>
                          <button className="px-3 py-1 bg-gray-100 rounded text-sm" onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ sfg_id: sfgId, recipe }, null, 2)); alert("Recipe disalin ke clipboard"); }}>Copy JSON</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </ComponentCard>
      </div>
    </>
  );
}
