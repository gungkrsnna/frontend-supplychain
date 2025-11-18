// src/pages/ItemCreatePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Uom = { id: number; name?: string; kode?: string };
type Category = { id: number; name?: string };
type Brand = { id: number; kode?: string; nama?: string };

type MeasurementRow = {
  id: string;
  uom_id?: number | "";
  value?: string;
};

export default function ItemCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const { id: brandIdParam } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const brandIdFromQuery = searchParams.get("brandId");
  const brandNameFromQuery = searchParams.get("brandName");

  const [uoms, setUoms] = useState<Uom[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialBrandId = brandIdParam ?? brandIdFromQuery ?? "";
  const initialBrandName = brandNameFromQuery ?? "";

  const [brandId, setBrandId] = useState<string>(initialBrandId);
  const [brandName, setBrandName] = useState<string>(initialBrandName);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [isProduction, setIsProduction] = useState<boolean>(true);
  const [description, setDescription] = useState<string>("");

  const [measurementUnits, setMeasurementUnits] = useState<MeasurementRow[]>([
    { id: String(Date.now()), uom_id: "", value: "" },
  ]);

  // base (smallest) unit id. All rows will display this unit label.
  const [baseUomId, setBaseUomId] = useState<number | "">("");

  function toNumberOrEmpty(v: any): number | "" {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    return Number.isFinite(n) ? n : "";
  }

  // conversion to grams (lookup)
  const UOM_TO_GRAMS: Record<string, number> = {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    kilogram: 1000,
    kilograms: 1000,
    mg: 0.001,
    milligram: 0.001,
    lb: 453.59237,
    pound: 453.59237,
    oz: 28.349523125,
    ounce: 28.349523125,
    pcs: 1,
    piece: 1,
    pc: 1,
    unit: 1,
    box: 1,
  };

  function uomToGramFactor(uom?: Uom | null | undefined): number {
    if (!uom) return 1;
    const keysToTry: string[] = [];
    if (uom.name) keysToTry.push(uom.name.toString().toLowerCase());
    if (uom.kode) keysToTry.push(uom.kode.toString().toLowerCase());
    for (const k of keysToTry) {
      const cleaned = k.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (cleaned && UOM_TO_GRAMS[cleaned] !== undefined) return UOM_TO_GRAMS[cleaned];
      if (k.includes("kg") && UOM_TO_GRAMS["kg"] !== undefined) return UOM_TO_GRAMS["kg"];
      if (k.includes("g") && UOM_TO_GRAMS["g"] !== undefined && !k.includes("kg")) return UOM_TO_GRAMS["g"];
      if (k.includes("mg") && UOM_TO_GRAMS["mg"] !== undefined) return UOM_TO_GRAMS["mg"];
      if (k.includes("lb") && UOM_TO_GRAMS["lb"] !== undefined) return UOM_TO_GRAMS["lb"];
      if (k.includes("oz") && UOM_TO_GRAMS["oz"] !== undefined) return UOM_TO_GRAMS["oz"];
    }
    return 1;
  }

  useEffect(() => {
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMeta() {
    setLoadingMeta(true);
    try {
      const [uomResp, catResp, brandResp] = await Promise.all([
        axios.get("/api/uoms"),
        axios.get("/api/category-items"),
        axios.get("/api/brands"),
      ]);

      const uomRows = uomResp.data?.data ?? uomResp.data ?? [];
      const catRows = catResp.data?.data ?? catResp.data ?? [];
      const brandRows = brandResp.data?.data ?? brandResp.data ?? [];

      setUoms(uomRows);
      setCategories(catRows);
      setBrands(brandRows);

      // default base unit: try to pick grams-like UOM
      const findGramLike = (uomRows as any[]).find((u: any) => {
        const f = u?.name ?? u?.kode ?? "";
        if (!f) return false;
        const lower = String(f).toLowerCase();
        return lower.includes("g") || lower.includes("gram") || lower.includes("grams");
      });
      if (findGramLike) {
        setBaseUomId(Number(findGramLike.id));
      } else if (Array.isArray(uomRows) && uomRows.length > 0) {
        setBaseUomId(Number(uomRows[0].id));
      }

      if (initialBrandId && !initialBrandName) {
        const found = brandRows.find((b: any) => String(b.id) === String(initialBrandId));
        if (found) setBrandName(found.nama ?? found.kode ?? String(found.id));
      }
    } catch (err) {
      console.warn("load meta failed", err);
      toast.error("Gagal memuat data pendukung (UOM / Category / Brand)");
    } finally {
      setLoadingMeta(false);
    }
  }

  useEffect(() => {
    if (!brandName && brandId !== "" && Array.isArray(brands) && brands.length > 0) {
      const found = brands.find((b) => String(b.id) === String(brandId));
      if (found) setBrandName(found.nama ?? found.kode ?? String(found.id));
    }
  }, [brands, brandId, brandName]);

  function addMeasurementRow() {
    setMeasurementUnits((prev) => [...prev, { id: String(Date.now() + Math.random()), uom_id: "", value: "" }]);
  }
  function removeMeasurementRow(id: string) {
    setMeasurementUnits((prev) => prev.filter((r) => r.id !== id));
  }
  function updateMeasurementRow(id: string, patch: Partial<MeasurementRow>) {
    setMeasurementUnits((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function validate(): boolean {
    if (!name.trim()) {
      toast.error("Nama item wajib diisi");
      return false;
    }
    if (categoryId === "" || categoryId === null || categoryId === undefined) {
      toast.error("Pilih Category");
      return false;
    }

    for (const r of measurementUnits) {
      const emptyRow =
        (r.uom_id === "" || r.uom_id === null || r.uom_id === undefined) &&
        (r.value === "" || r.value === null || r.value === undefined);
      if (emptyRow) continue;

      const u = Number(r.uom_id);
      if (!Number.isFinite(u) || u <= 0) {
        toast.error("Pilih Name (UOM) untuk setiap measurement unit yang diisi");
        return false;
      }
      const v = Number(r.value);
      if (!Number.isFinite(v) || v <= 0) {
        toast.error("Value harus angka lebih besar dari 0 untuk setiap measurement unit yang diisi");
        return false;
      }
    }

    return true;
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validate()) return;

    const safeBrandId = brandId === "" ? undefined : String(brandId);
    const safeCategoryId = categoryId === "" ? undefined : Number(categoryId);

    const baseUomObj = baseUomId === "" ? undefined : uoms.find((u) => Number(u.id) === Number(baseUomId));
    const baseFactorGrams = uomToGramFactor(baseUomObj);

    const measurement_units_payload = measurementUnits
      .map((r) => {
        const uomIdNum = Number(r.uom_id);
        const valNum = Number(r.value);
        if (!Number.isFinite(uomIdNum) || !Number.isFinite(valNum)) return null;
        const uomObj = uoms.find((u) => Number(u.id) === Number(uomIdNum));
        const factorGrams = uomToGramFactor(uomObj);
        const value_in_grams = valNum * factorGrams;
        const value_in_base_unit = baseFactorGrams ? value_in_grams / baseFactorGrams : value_in_grams;
        return {
          uom_id: uomIdNum,
          value: valNum,
          value_in_grams,
          value_in_base_unit,
        };
      })
      .filter((x) => x !== null) as { uom_id: number; value: number; value_in_grams: number; value_in_base_unit: number }[];

    let primaryUomId: number | undefined = undefined;
    if (measurement_units_payload.length > 0) {
      primaryUomId = measurement_units_payload[0].uom_id;
    }
    if (!primaryUomId && Array.isArray(uoms) && uoms.length > 0) {
      primaryUomId = Number(uoms[0].id);
    }

    let brandKodeToSend: string | undefined = undefined;
    if (!code) {
      if (safeBrandId) {
        const found = brands.find((b) => String(b.id) === String(safeBrandId));
        if (found && (found as any).kode) {
          brandKodeToSend = (found as any).kode;
        } else {
          brandKodeToSend = undefined;
        }
      }
    }

    if (!code && !brandKodeToSend) {
      toast.error("brandKode diperlukan ketika field code kosong. Pilih Brand yang punya kode atau isi field Code.");
      return;
    }

    const payload: any = {
      request_category_id: 0,
      name: name.trim(),
      code: code?.trim() || undefined,
      brandKode: code ? undefined : brandKodeToSend,
      brand_id: safeBrandId,
      category_item_id: safeCategoryId,
      uom_id: primaryUomId,
      base_uom_id: baseUomId === "" ? undefined : Number(baseUomId),
      is_production: isProduction ? 1 : 0,
      description: description || undefined,
    };

    if (measurement_units_payload.length > 0) payload.measurement_units = measurement_units_payload;

    try {
      setSaving(true);
      const resp = await axios.post("/api/item", payload);
      const created = resp.data?.data ?? resp.data;
      const createdId = created?.id ?? null;

      const targetPath = `/superadmin/brands/${brandId ?? safeBrandId ?? ""}/items`;
      navigate(targetPath, {
        state: {
          toast: {
            type: "success",
            message: "Item berhasil dibuat",
            createdId,
          },
        },
      });
      return created;
    } catch (err: any) {
      console.error("create item error", err);
      const status = err?.response?.status;
      if (status === 409) toast.error(err?.response?.data?.message || "Code sudah digunakan");
      else toast.error(err?.response?.data?.message || "Gagal membuat item");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if ((brandId === "" || brandId === null) && initialBrandId) {
      setBrandId(initialBrandId);
    }
    if (!brandName && initialBrandName) {
      setBrandName(initialBrandName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrandId, initialBrandName]);

  // render preview relative to base unit
  function renderBasePreview(r: MeasurementRow) {
    if (!r.uom_id || r.uom_id === "" || !r.value) return null;
    const uomObj = uoms.find((u) => Number(u.id) === Number(r.uom_id));
    const baseObj = baseUomId === "" ? undefined : uoms.find((u) => Number(u.id) === Number(baseUomId));
    const factorGrams = uomToGramFactor(uomObj);
    const baseFactorGrams = uomToGramFactor(baseObj);
    const valNum = Number(r.value);
    if (!Number.isFinite(valNum)) return null;
    const grams = valNum * factorGrams;
    const valInBase = baseFactorGrams ? grams / baseFactorGrams : grams;
    const valInBaseStr = Number.isInteger(valInBase) ? String(valInBase) : valInBase.toFixed(4).replace(/\.?0+$/, "");
    const baseLabel = baseObj ? (baseObj.name ?? baseObj.kode ?? String(baseObj.id)) : "base";
    return (
      <div className="text-xs text-gray-500 mt-1">
        = {valInBaseStr} {baseLabel} ({Number.isInteger(grams) ? String(grams) : grams.toFixed(4).replace(/\.?0+$/, "")} g)
      </div>
    );
  }

  // helper to get base label (used in unit display column)
  function baseLabelText() {
    const baseObj = baseUomId === "" ? undefined : uoms.find((u) => Number(u.id) === Number(baseUomId));
    return baseObj ? (baseObj.name ?? baseObj.kode ?? String(baseObj.id)) : "-";
  }

  return (
    <div className="p-6 mx-auto">
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Tambah Item Baru {brandName ? `untuk ${brandName}` : ""}</h2>
          <div className="text-sm text-gray-500">Buat item baru dan atur measurement units</div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 bg-white p-4 rounded shadow">
        <div>
          <label className="text-sm block mb-1">{initialBrandId ? "Brand (terkait)" : "Brand (opsional)"}</label>
          <select
            value={brandId === "" ? "" : String(brandId)}
            onChange={(e) => {
              const v = e.target.value;
              setBrandId(v);
              const found = brands.find((b) => String(b.id) === v);
              setBrandName(found ? found.nama ?? found.kode ?? String(found.id) : "");
            }}
            className={`w-full border px-3 py-2 rounded ${initialBrandId !== "" ? "bg-gray-100" : ""}`}
            disabled={initialBrandId !== ""}
          >
            <option value="">-- Pilih Brand --</option>
            {initialBrandId !== "" && <option value={String(initialBrandId)}>{initialBrandName || `Brand ${brandName}`}</option>}
            {brands
              .filter((b) => initialBrandId === "" || Number(b.id) !== Number(initialBrandId))
              .map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.nama ?? b.kode ?? b.id}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-sm block mb-1">Nama Item <span className="text-red-500">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="Nama item" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* === TOGGLE: isProduction === */}
          <div>
            <label className="text-sm block mb-1">Production</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsProduction((s) => !s)}
                aria-pressed={isProduction}
                className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors focus:outline-none ${isProduction ? "bg-green-500" : "bg-gray-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isProduction ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
              <div className="text-sm">
                <div className="font-medium">{isProduction ? "Production" : "Non-production"}</div>
                {/* <div className="text-xs text-gray-500">Klik untuk toggle</div> */}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm block mb-1">Category <span className="text-red-500">*</span></label>
            <select value={categoryId === "" ? "" : String(categoryId)} onChange={(e) => setCategoryId(toNumberOrEmpty(e.target.value))} className="w-full border px-3 py-2 rounded">
              <option value="">-- Pilih Category --</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name ?? c.id}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Base UOM selector */}
        <div>
          <label className="text-sm block mb-1">Satuan dasar (satuan terkecil)</label>
          <select value={baseUomId === "" ? "" : String(baseUomId)} onChange={(e) => setBaseUomId(toNumberOrEmpty(e.target.value))} className="w-full border px-3 py-2 rounded">
            <option value="">-- Pilih Satuan Dasar --</option>
            {uoms.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name ?? u.kode ?? u.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Measurement Units</label>
            <div className="flex gap-2">
              <button type="button" onClick={addMeasurementRow} className="px-2 py-1 bg-gray-100 rounded text-sm">+ Tambah Row</button>
              <button type="button" onClick={() => setMeasurementUnits([{ id: String(Date.now()), uom_id: "", value: "" }])} className="px-2 py-1 bg-gray-50 rounded text-sm">Reset</button>
            </div>
          </div>

          <div className="space-y-3">
            {measurementUnits.map((r, idx) => {
              return (
                <div key={r.id} className="grid grid-cols-12 gap-2 items-center border rounded p-2">
                  <div className="col-span-1 flex items-center">
                    <div>
                      <div className="text-sm font-medium">#{idx + 1}</div>
                      <div className="text-xs text-gray-500">Measurement Unit {idx + 1}</div>
                    </div>
                  </div>

                  <div className="col-span-4">
                    <label className="text-xs block mb-1">Name (UOM)</label>
                    <select value={r.uom_id === "" ? "" : String(r.uom_id)} onChange={(e) => updateMeasurementRow(r.id, { uom_id: toNumberOrEmpty(e.target.value) })} className="w-full border px-2 py-2 rounded">
                      <option value="">-- Pilih UOM --</option>
                      {uoms.map((u) => <option key={u.id} value={String(u.id)}>{u.name ?? u.kode ?? u.id}</option>)}
                    </select>
                  </div>

                  <div className="col-span-4">
                    <label className="text-xs block mb-1">Value</label>
                    <input type="number" step="any" min="0" value={r.value ?? ""} onChange={(e) => updateMeasurementRow(r.id, { value: e.target.value })} placeholder="Contoh: 1000" className="w-full border px-2 py-2 rounded" />
                  </div>

                  {/* UNIT DISPLAY: always show baseLabelText() (NOT uom per row) */}
                  <div className="col-span-2">
                    <label className="text-xs block mb-1">Unit (display)</label>
                    <div className="px-2 py-2 border rounded h-full flex items-center">
                      <div>
                        <div className="text-sm text-gray-700">{baseLabelText()}</div>
                        <div className="text-xs text-gray-400">Satuan dasar</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeMeasurementRow(r.id)} className="px-2 py-1 bg-red-600 text-white rounded">H</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-sm block mb-1">Deskripsi (opsional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border px-3 py-2 rounded" rows={3} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Batal</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded">
            {saving ? "Menyimpan..." : "Simpan Item"}
          </button>
        </div>
      </form>
    </div>
  );
}
