// src/pages/Items/ItemBOMPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";

type Item = {
  id: number;
  code?: string;
  name: string;
  is_production?: boolean | number;
  uom_id?: number | null;
  uom?: { id: number; name: string } | null;
  brand_id?: number | null;
};

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

type Props = {
  initialBrandId?: number | null;
  initialItems?: Item[] | null;
  initialBrandKode?: string | null;
};

export default function ItemBOMPage({ initialBrandId = null, initialItems = null, initialBrandKode = null }: Props): JSX.Element {
  const [items, setItems] = useState<Item[]>(initialItems ?? []);
  const [fgList, setFgList] = useState<Item[]>([]);
  const [selectedFgId, setSelectedFgId] = useState<number | null>(null);
  const [selectedFg, setSelectedFg] = useState<Item | null>(null);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uomMap, setUomMap] = useState<Record<number, string>>({});
  const fetchJson = useFetchJson();

  const [searchParams] = useSearchParams();
  const qBrandId = Number(searchParams.get("brandId") || "");
  const qBrandKode = searchParams.get("brandKode") || null;

  const itemsCache = useRef<Record<number, Item[]>>({});
  useEffect(() => {
    if (initialBrandId && initialItems) {
      itemsCache.current[initialBrandId] = initialItems;
    }
  }, [initialBrandId, initialItems]);

  // --- new: category list for modal
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const body = await fetchJson(`${API_BASE}/api/category-item`);
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      setCategories((rows || []).map((r: any) => ({ id: Number(r.id), name: r.name || r.title || String(r.id) })));
    } catch (err) {
      console.warn("Failed to load categories", err);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, [fetchJson]);

  // UOM fetch (existing)
  const fetchUoms = useCallback(async () => {
    try {
      const body = await fetchJson(`${API_BASE}/api/uoms`);
      const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
      const map: Record<number, string> = {};
      (rows || []).forEach((u: any) => {
        map[Number(u.id)] = u.name;
      });
      setUomMap(map);
    } catch (err) {
      console.warn("Failed to load uoms", err);
    }
  }, [fetchJson]);

  useEffect(() => {
    fetchUoms();
    fetchCategories();
  }, [fetchUoms, fetchCategories]);

  // FG detection regex
  const fgRegex = /(^|[.\-_])FG([.\-_]|$)/i;

  // fetchItems with brandKode-aware client-side filter fallback
  const fetchItems = useCallback(
    async (brandId?: number | null, brandKode?: string | null) => {
      setLoadingItems(true);
      setError(null);
      try {
        // use cache if available
        if (typeof brandId === "number" && itemsCache.current[brandId]) {
          const cached = itemsCache.current[brandId];
          setItems(cached);

          const fgCandidates = (cached || []).filter(i => {
            const isProd = i.is_production === 1 || i.is_production === true;
            const c = (i.code || "").toString();
            const hasFgInCode = fgRegex.test(c);
            return isProd && (hasFgInCode || !c);
          });
          setFgList(fgCandidates);
          if (!selectedFgId && fgCandidates.length) setSelectedFgId(fgCandidates[0].id);
          setLoadingItems(false);
          return;
        }

        let body: any;
        if (typeof brandId === "number") {
          try {
            body = await fetchJson(`${API_BASE}/api/brands/${brandId}/items`);
          } catch (err) {
            try {
              body = await fetchJson(`${API_BASE}/api/item?brand_id=${brandId}`);
            } catch (err2) {
              body = await fetchJson(`${API_BASE}/api/item`);
            }
          }
        } else {
          body = await fetchJson(`${API_BASE}/api/item`);
        }

        const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);

        // client-side filter by brandKode if backend didn't scope results or items lack brand relation
        let filteredRows = rows;
        if (brandKode && Array.isArray(rows) && rows.length) {
          const hasBrandRelation = rows.every((r: any) => r.brand_id || r.brand || r.brandId);
          if (!hasBrandRelation) {
            const kode = String(brandKode).trim();
            if (kode.length > 0) {
              const escaped = kode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const re = new RegExp(`^${escaped}(?:[\\.\\-_]|$)`, "i");
              filteredRows = (rows || []).filter((r: any) => {
                const code = (r.code || r.kode || "").toString();
                return re.test(code);
              });
            }
          }
        }

        const norm: Item[] = (filteredRows || []).map((r: any) => ({
          id: Number(r.id),
          code: r.code,
          name: r.name,
          is_production: r.is_production === 1 || r.is_production === true,
          uom_id: r.uom_id ?? null,
          uom: r.uom ?? null,
          brand_id: r.brand_id ?? r.brandId ?? null
        }));

        if (typeof brandId === "number") itemsCache.current[brandId] = norm;

        setItems(norm);

        // determine FG candidates from norm
        const fgCandidates = (norm || []).filter(i => {
          const isProd = i.is_production === 1 || i.is_production === true;
          const c = (i.code || "").toString();
          const hasFgInCode = fgRegex.test(c);
          return isProd && (hasFgInCode || !c);
        });

        setFgList(fgCandidates);

        if (brandId) setSelectedFgId(fgCandidates[0]?.id ?? null);
        else if (!selectedFgId && norm.length) {
          const firstFg = norm.find(i => i.is_production) || norm[0];
          setSelectedFgId(firstFg?.id ?? null);
        }
      } catch (err: any) {
        console.error("fetchItems error", err);
        setError(err?.message || "Gagal memuat items");
      } finally {
        setLoadingItems(false);
      }
    },
    [fetchJson, selectedFgId]
  );

  useEffect(() => {
    const brandIdToUse = qBrandId || initialBrandId || undefined;
    const brandKodeToUse = qBrandKode || initialBrandKode || null;
    fetchItems(brandIdToUse as number | undefined, brandKodeToUse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qBrandId, qBrandKode, initialBrandId, initialBrandKode]);

  const fetchComponentsForFg = useCallback(
    async (fgId: number | null) => {
      setLoadingComponents(true);
      setError(null);
      setComponents([]);
      setSelectedFg(null);
      if (!fgId) {
        setLoadingComponents(false);
        return;
      }
      try {
        const fg = items.find(it => it.id === fgId) ?? null;
        setSelectedFg(fg);

        const body = await fetchJson(`${API_BASE}/api/item-components/fg/${fgId}/components`);
        const rows = Array.isArray(body) ? body : (body && body.data ? body.data : []);
        const mapped: ComponentRow[] = (rows || []).map((r: any) => {
          const compItem =
            r.componentItem || r.component_item || r.component || r.item || (r.component_item_id ? (r.component_item || null) : null);
          return {
            id: r.id,
            component_item_id: Number(r.component_item_id),
            component_item: compItem
              ? { id: Number(compItem.id), name: compItem.name, code: compItem.code, is_production: compItem.is_production }
              : items.find(it => Number(it.id) === Number(r.component_item_id)) ?? null,
            quantity: Number(r.quantity ?? r.qty ?? 0),
            uom_id: r.uom_id ?? null,
            is_optional: !!r.is_optional,
            _isNew: false,
            _dirty: false,
            _deleted: false
          };
        });

        setComponents(mapped);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Gagal memuat komponen");
      } finally {
        setLoadingComponents(false);
      }
    },
    [fetchJson, items]
  );

  useEffect(() => {
    fetchComponentsForFg(selectedFgId);
  }, [selectedFgId, fetchComponentsForFg]);

  // helpers & handlers (same behavior as previous implementation)
  const generateTmpId = () => `tmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const markDirtyRow = (id: number | string) => {
    setComponents(prev => prev.map(r => (r.id === id ? { ...r, _dirty: true } : r)));
  };

  const handleAddComponent = () => {
    if (!selectedFgId) {
      alert("Pilih FG terlebih dahulu");
      return;
    }
    const newRow: ComponentRow = {
      id: generateTmpId(),
      component_item_id: null,
      component_item: null,
      quantity: 1,
      uom_id: null,
      is_optional: false,
      _isNew: true,
      _dirty: true,
      _deleted: false
    };
    setComponents(prev => [newRow, ...(prev || [])]);
  };

  const handleChangeRow = (id: number | string, field: keyof ComponentRow, value: any) => {
    setComponents(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const copy: ComponentRow = { ...r } as any;
        // @ts-ignore
        copy[field] = value;
        copy._dirty = true;
        if (field === "component_item_id") {
          const itemObj = items.find(it => it.id === Number(value)) || null;
          copy.component_item = itemObj;
        }
        return copy;
      })
    );
  };

  const handleRemoveRow = (id: number | string) => {
    if (!confirm("Hapus komponen ini dari FG?")) return;
    setComponents(prev => prev.map(r => (r.id === id ? { ...r, _deleted: true } : r)));
  };

  const validateBeforeSave = async (): Promise<{ ok: boolean; message?: string }> => {
    if (!selectedFgId) return { ok: false, message: "Pilih FG dulu." };
    const active = components.filter(c => !c._deleted);
    for (const r of active) {
      if (!r.component_item_id) return { ok: false, message: "Semua komponen harus dipilih." };
      if (Number(r.component_item_id) === Number(selectedFgId)) return { ok: false, message: "FG tidak boleh dimasukkan sebagai komponennya sendiri." };
    }
    const seen = new Set<number>();
    for (const r of active) {
      const id = Number(r.component_item_id);
      if (seen.has(id)) return { ok: false, message: "Terdapat komponen duplikat." };
      seen.add(id);
    }

    for (const r of components) {
      if (r._deleted) continue;
      if (!r._dirty) continue;
      if (!r.component_item_id) continue;
      try {
        const url = `${API_BASE}/api/item-components/fg/${r.component_item_id}/contains/${selectedFgId}`;
        const body: any = await fetchJson(url);
        const exists = body && (body.has_component === 1 || body.has_component === true || body.has_component === "1");
        if (exists) {
          return {
            ok: false,
            message: `Menambahkan komponen ${r.component_item?.name || r.component_item_id} akan menyebabkan circular BOM.`
          };
        }
      } catch (err: any) {
        console.warn("Circular check failed", err);
        return { ok: false, message: `Gagal memvalidasi komponen ${r.component_item?.name || r.component_item_id}: ${err?.message || "validation failed"}` };
      }
    }

    return { ok: true };
  };

  const handleSave = async () => {
    setError(null);
    if (!selectedFgId) {
      alert("Pilih FG terlebih dahulu");
      return;
    }

    const val = await validateBeforeSave();
    if (!val.ok) {
      alert(val.message);
      return;
    }

    setSaving(true);
    try {
      for (const r of components.filter(c => c._deleted && !String(c.id).startsWith("tmp-"))) {
        await fetchJson(`${API_BASE}/api/item-components/${r.id}`, { method: "DELETE" });
      }

      for (const r of components.filter(c => !c._isNew && !c._deleted && c._dirty)) {
        const payload: any = {
          quantity: Number(r.quantity || 0),
          uom_id: r.uom_id ?? null,
          is_optional: !!r.is_optional
        };
        await fetchJson(`${API_BASE}/api/item-components/${r.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      for (const r of components.filter(c => c._isNew && !c._deleted)) {
        const payload = {
          fg_item_id: selectedFgId,
          component_item_id: Number(r.component_item_id),
          quantity: Number(r.quantity || 0),
          uom_id: r.uom_id ?? null,
          is_optional: !!r.is_optional
        };
        await fetchJson(`${API_BASE}/api/item-components`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      await fetchComponentsForFg(selectedFgId);
      alert("Perubahan komponen tersimpan.");
    } catch (err: any) {
      console.error("Save BOM error", err);
      alert("Gagal menyimpan: " + (err?.message || "unknown"));
    } finally {
      setSaving(false);
    }
  };

  const activeComponents = useMemo(() => components.filter(c => !c._deleted), [components]);

  // --------------------
  // NEW: modal state and create FG handler
  // --------------------
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  // UOM selalu pcs => id = 1
  const [newUomId, setNewUomId] = useState<number | null>(1);
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ensure default selects update when lists loaded
  useEffect(() => {
    if (!newCategoryId && categories.length) setNewCategoryId(categories[0].id);
  }, [categories, newCategoryId]);

  useEffect(() => {
    if (!newUomId && Object.keys(uomMap).length) {
      const first = Number(Object.keys(uomMap)[0]);
      setNewUomId(first || null);
    }
  }, [uomMap, newUomId]);

  const effectiveBrandId = qBrandId || initialBrandId || undefined;
  const effectiveBrandKode = qBrandKode || initialBrandKode || null;

  const openCreateModal = () => {
    if (!effectiveBrandId && !effectiveBrandKode) {
      alert("Brand tidak diketahui. Buka halaman brand terlebih dahulu.");
      return;
    }
    setCreateError(null);
    setNewName("");
    setNewDesc("");
    setShowCreateModal(true);
  };

  const handleCreateFg = async () => {
    setCreateError(null);

    if (!newName) {
      setCreateError("Nama produk wajib diisi");
      return;
    }

    setCreating(true);
    try {
      let url = "";
      let bodyPayload: any = {
        name: newName,
        description: newDesc || null,
        // jangan kirim 0 — backend saat ini menolak 0
        request_category_id: 1,  // workaround supaya tidak gagal (boleh disesuaikan nanti)
        category_item_id: 2,
        uom_id: 1,
        is_production: true
      };


      // Endpoint tergantung brand id
      if (typeof effectiveBrandId === "number") {
        url = `${API_BASE}/api/brands/${effectiveBrandId}/items/fg`;
      } else {
        // fallback jika tidak ada brandId
        url = `${API_BASE}/api/item`;
        bodyPayload.brandKode = effectiveBrandKode;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : null;
      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const created = (data && (data.data || data)) || null;

      // refresh daftar FG
      await fetchItems(
        typeof effectiveBrandId === "number" ? effectiveBrandId : undefined,
        effectiveBrandKode
      );

      const createdId = created?.id ?? created?.data?.id ?? null;
      if (createdId) {
        setSelectedFgId(Number(createdId));
        setTimeout(() => fetchComponentsForFg(Number(createdId)), 300);
      }

      setShowCreateModal(false);
      alert("FG berhasil dibuat");
    } catch (err: any) {
      console.error("create FG error", err);
      setCreateError(err?.message || "Gagal membuat FG");
    } finally {
      setCreating(false);
    }
  };



  // --------------------
  // Render
  // --------------------
  return (
    <>
      <PageMeta title="Item BOM - FG & SFG" description="Manage FG and its SFG components" />
      <PageBreadcrumb pageTitle="Items / BOM" />

      <div className="space-y-6">
        <ComponentCard title="Item BOM (FG ↔ SFG)">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/3 border rounded p-3 bg-white">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold">FG Items</h4>
                <div className="flex items-center gap-2">
                  <button
                    className="text-sm px-2 py-1 bg-gray-100 rounded"
                    onClick={() => {
                      const brandIdToUse = qBrandId || initialBrandId || undefined;
                      const brandKodeToUse = qBrandKode || initialBrandKode || null;
                      fetchItems(brandIdToUse as number | undefined, brandKodeToUse);
                    }}
                  >
                    Refresh
                  </button>
                  <button className="text-sm px-2 py-1 bg-blue-600 text-white rounded" onClick={openCreateModal}>
                    Tambah FG
                  </button>
                </div>
              </div>

              <div>
                {loadingItems ? (
                  <div className="text-sm text-gray-500">Loading items...</div>
                ) : fgList.length === 0 ? (
                  <div className="text-sm text-gray-500">No FG items found.</div>
                ) : (
                  <ul className="space-y-2 max-h-[60vh] overflow-auto">
                    {fgList.map(fg => (
                      <li key={fg.id}>
                        <button
                          className={`w-full text-left p-2 rounded ${fg.id === selectedFgId ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                          onClick={() => setSelectedFgId(fg.id)}
                        >
                          <div className="font-medium">{fg.name}</div>
                          {fg.code && <div className="text-xs text-gray-400">{fg.code}</div>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="w-full md:w-2/3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{selectedFg ? selectedFg.name : "Pilih FG"}</h4>
                  <div className="text-xs text-gray-500">{selectedFg ? `ID: ${selectedFg.id}` : "Belum ada FG dipilih"}</div>
                </div>

                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={handleAddComponent} disabled={!selectedFgId || loadingComponents}>
                    Add Component
                  </button>
                  <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => fetchComponentsForFg(selectedFgId)} disabled={!selectedFgId || loadingComponents}>
                    Refresh Components
                  </button>
                  <button className="px-3 py-1 bg-yellow-500 text-white rounded" onClick={handleSave} disabled={saving || !selectedFgId}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              <div className="border rounded p-3 bg-white">
                {loadingComponents ? (
                  <div className="text-sm text-gray-500">Loading components...</div>
                ) : error ? (
                  <div className="text-sm text-red-600">Error: {error}</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="p-2">Component (SFG / Item)</th>
                            <th className="p-2 w-32">Qty</th>
                            <th className="p-2 w-36">Unit</th>
                            <th className="p-2 w-28">Optional</th>
                            <th className="p-2">Status</th>
                            <th className="p-2 w-28">Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {activeComponents.length === 0 && (
                            <tr><td colSpan={6} className="p-3 text-sm text-gray-500">No components for this FG.</td></tr>
                          )}

                          {activeComponents.map(r => {
                            const isNew = !!r._isNew;
                            return (
                              <tr key={String(r.id)} className={`${r._dirty ? "bg-yellow-50" : ""}`}>
                                <td className="p-2 align-top">
                                  {isNew ? (
                                    <select
                                      value={r.component_item_id ?? ""}
                                      onChange={(e) => handleChangeRow(r.id, "component_item_id", e.target.value ? Number(e.target.value) : null)}
                                      className="w-full border rounded px-2 py-1"
                                    >
                                      <option value="">-- pilih item --</option>
                                      {items.map(it => (
                                        <option key={it.id} value={it.id} disabled={it.id === selectedFgId}>
                                          {it.name}{it.code ? ` (${it.code})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div>
                                      <div className="font-medium">{r.component_item?.name ?? ("Item #" + r.component_item_id)}</div>
                                      <div className="text-xs text-gray-400">{r.component_item?.code ?? ""}</div>
                                    </div>
                                  )}
                                </td>

                                <td className="p-2 align-top">
                                  <input
                                    type="number"
                                    value={r.quantity}
                                    onChange={(e) => handleChangeRow(r.id, "quantity", Number(e.target.value))}
                                    className="w-full border rounded px-2 py-1"
                                    min={0}
                                    step={0.0001}
                                  />
                                </td>

                                <td className="p-2 align-top">
                                  <input
                                    type="text"
                                    value={uomMap[Number(r.uom_id ?? r.component_item?.uom_id ?? "")] ?? (r.uom_id ? String(r.uom_id) : "")}
                                    onChange={(e) => handleChangeRow(r.id, "uom_id", e.target.value ? e.target.value : null)}
                                    className="w-full border rounded px-2 py-1"
                                    placeholder={r.component_item?.uom?.name ?? "unit"}
                                  />
                                </td>

                                <td className="p-2 align-top">
                                  <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={!!r.is_optional} onChange={(e) => handleChangeRow(r.id, "is_optional", e.target.checked)} />
                                    <span className="text-sm">Optional</span>
                                  </label>
                                </td>

                                <td className="p-2 align-top">
                                  {r._isNew ? <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">New</span> : r._dirty ? <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">Edited</span> : <span className="text-xs text-gray-600">Saved</span>}
                                </td>

                                <td className="p-2 align-top">
                                  <div className="flex gap-2">
                                    <button className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs" onClick={() => handleRemoveRow(r.id)}>Delete</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </ComponentCard>
      </div>

      {/* Create FG Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded shadow-lg w-full max-w-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Tambah FG</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700">Nama Produk FG</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="contoh: Roti Keju"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700">Deskripsi (opsional)</label>
                <textarea
                  className="w-full border rounded px-2 py-1"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Keterangan tambahan produk..."
                />
              </div>

              {/* <div className="text-xs text-gray-500 border-t pt-2 mt-2">
                <p><b>Otomatis:</b> category_item_id = 2 (FG)</p>
                <p><b>UOM:</b> pcs (uom_id = 1)</p>
              </div> */}

              {createError && <div className="text-sm text-red-600">{createError}</div>}
            </div>


            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 bg-gray-100 rounded" onClick={() => setShowCreateModal(false)} disabled={creating}>Batal</button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleCreateFg} disabled={creating}>
                {creating ? "Membuat..." : "Buat FG"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
