import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Uom = { id: number; name?: string; kode?: string };
type Category = { id: number; name?: string; kode?: string };
type Brand = { id: string; nama?: string; kode?: string };

type MeasurementRow = {
  id: string; // local id for UI (not DB id)
  db_id?: number; // optional DB id of measurement (if you want to keep)
  uom_id?: number | "";
  value?: string;
  value_in_grams?: number;
};

export default function ItemEditPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // meta
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // form
  const [brandId, setBrandId] = useState<string>("");
  const [brandName, setBrandName] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [isProduction, setIsProduction] = useState<boolean>(true);
  const [description, setDescription] = useState<string>("");

  const [measurementUnits, setMeasurementUnits] = useState<MeasurementRow[]>([
    { id: String(Date.now()), uom_id: "", value: "" },
  ]);

  // helper: avoid NaN
  function toNumberOrEmpty(v: any): number | "" {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    return Number.isFinite(n) ? n : "";
  }

  useEffect(() => {
    loadMeta();
    if (id) loadItem(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadMeta() {
    try {
      const [uomResp, catResp, brandResp] = await Promise.all([
        axios.get("/api/uoms"),
        axios.get("/api/category-items"),
        axios.get("/api/brands"),
      ]);
      setUoms(uomResp.data?.data ?? uomResp.data ?? []);
      setCategories(catResp.data?.data ?? catResp.data ?? []);
      setBrands(brandResp.data?.data ?? brandResp.data ?? []);
    } catch (err) {
      console.warn("load meta failed", err);
      toast.error("Gagal memuat data pendukung. Coba refresh halaman.");
    }
  }

  async function loadItem(itemId: string) {
    setLoading(true);
    try {
      const resp = await axios.get(`/api/item/${itemId}`);
      const data = resp.data?.data ?? resp.data;
      if (!data) {
        toast.error("Item tidak ditemukan");
        navigate(-1);
        return;
      }

      // populate form fields
      setName(data.name ?? "");
      setCode(data.code ?? "");
      setDescription(data.description ?? "");
      setIsProduction(Boolean(data.is_production));

      // brand may be id or brand_id
      if (data.brand_id) setBrandId(String(data.brand_id));
      else if (data.brand && data.brand.id) setBrandId(String(data.brand.id));

      // display brand name (for UX)
      if (data.brand?.nama) setBrandName(data.brand.nama);
      else if (data.brand?.kode) setBrandName(data.brand.kode);

      setCategoryId(data.category_item?.id ?? data.category_item_id ?? "");
      // measurements: map existing
      if (Array.isArray(data.measurements) && data.measurements.length > 0) {
        const rows = data.measurements.map((m: any) => ({
          id: String(Date.now()) + Math.random(),
          db_id: m.id,
          uom_id: m.uom_id,
          value: String(m.value ?? ""),
          value_in_grams: m.value_in_grams ?? m.value,
        } as MeasurementRow));
        setMeasurementUnits(rows);
      } else {
        setMeasurementUnits([{ id: String(Date.now()), uom_id: "", value: "" }]);
      }
    } catch (err) {
      console.error("load item failed", err);
      toast.error("Gagal memuat item. Coba lagi.");
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }

  // measurement helpers
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
      toast.error("Pilih kategori");
      return false;
    }
    // validate measurement rows
    for (const r of measurementUnits) {
      const emptyRow =
        (r.uom_id === "" || r.uom_id === null || r.uom_id === undefined) &&
        (r.value === "" || r.value === null || r.value === undefined);
      if (emptyRow) continue;
      const u = Number(r.uom_id);
      if (!Number.isFinite(u) || u <= 0) {
        toast.error("Pilih UOM untuk setiap measurement unit yang diisi");
        return false;
      }
      const v = Number(r.value);
      if (!Number.isFinite(v) || v <= 0) {
        toast.error("Value harus angka lebih besar dari 0 pada measurement");
        return false;
      }
    }
    return true;
  }

  // helper to convert frontend uom -> grams (same logic as create page)
  const UOM_TO_GRAMS: Record<string, number> = {
    g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000,
    mg: 0.001, milligram: 0.001, lb: 453.59237, pound: 453.59237,
    oz: 28.349523125, ounce: 28.349523125, pcs: 1, piece: 1, pc: 1, unit: 1, box: 1,
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

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!validate()) return;
    setSaving(true);

    // prepare measurement payload
    const measurement_units_payload = measurementUnits
      .map((r) => {
        const uomIdNum = Number(r.uom_id);
        const valNum = Number(r.value);
        if (!Number.isFinite(uomIdNum) || !Number.isFinite(valNum)) return null;
        const uomObj = uoms.find((u) => Number(u.id) === Number(uomIdNum));
        const factor = uomToGramFactor(uomObj);
        const value_in_grams = valNum * factor;
        return { uom_id: uomIdNum, value: valNum, value_in_grams };
      })
      .filter((x) => x !== null);

    // prefer sending brand_id as string
    const safeBrandId = brandId === "" ? undefined : String(brandId);
    const safeCategoryId = categoryId === "" ? undefined : Number(categoryId);

    const payload: any = {
      request_category_id: 0,
      name: name.trim(),
      code: code?.trim() || undefined,
      brand_id: safeBrandId,
      category_item_id: safeCategoryId,
      uom_id: measurement_units.length > 0 ? (measurement_units[0].uom_id ? Number(measurement_units[0].uom_id) : undefined) : undefined,
      is_production: isProduction ? 1 : 0,
      description: description || undefined,
    };
    if ((measurement_units_payload as any[]).length > 0) payload.measurement_units = measurement_units_payload;

    try {
      const resp = await axios.put(`/api/item/${id}`, payload);
      const updated = resp.data?.data ?? resp.data;
      toast.success("Item berhasil diperbarui");
      navigate(-1);
      return updated;
    } catch (err: any) {
      console.error("update item error", err);
      const message = err?.response?.data?.message ?? "Gagal memperbarui item";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Memuat item...</div>;

  return (
    <div className="p-6 mx-auto">
      <ToastContainer position="top-right" autoClose={4000} theme="colored" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Edit Item</h2>
        <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
      </div>

      <form onSubmit={submit} className="bg-white p-4 rounded shadow space-y-4">
        {/* brand (disabled if preselected) */}
        <div>
          <label className="text-sm block mb-1">Brand</label>
          <select
            value={brandId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setBrandId(v);
              const found = brands.find((b) => String(b.id) === v);
              setBrandName(found ? found.nama ?? found.kode ?? String(found.id) : "");
            }}
            className="w-full border px-3 py-2 rounded"
            disabled={Boolean(brandId)}
          >
            <option value="">-- Pilih Brand --</option>
            {brands.map((b) => <option key={b.id} value={String(b.id)}>{b.nama ?? b.kode ?? b.id}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm block mb-1">Nama Item</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border px-3 py-2 rounded" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm block mb-1">Category</label>
            <select value={categoryId === "" ? "" : String(categoryId)} onChange={(e) => setCategoryId(toNumberOrEmpty(e.target.value))} className="w-full border px-3 py-2 rounded">
              <option value="">-- Pilih Category --</option>
              {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name ?? c.kode ?? c.id}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm block mb-1">Is Production</label>
            <select value={isProduction ? "1" : "0"} onChange={(e) => setIsProduction(e.target.value === "1")} className="w-full border px-3 py-2 rounded">
              <option value="1">Production</option>
              <option value="0">Non-production</option>
            </select>
          </div>
        </div>

        {/* measurements */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Measurement Units</label>
            <div className="flex gap-2">
              <button type="button" onClick={addMeasurementRow} className="px-2 py-1 bg-gray-100 rounded text-sm">+ Tambah Row</button>
              <button type="button" onClick={() => setMeasurementUnits([{ id: String(Date.now()), uom_id: "", value: "" }])} className="px-2 py-1 bg-gray-50 rounded text-sm">Reset</button>
            </div>
          </div>

          <div className="space-y-3">
            {measurementUnits.map((r, idx) => (
              <div key={r.id} className="grid grid-cols-12 gap-2 items-center border rounded p-2">
                <div className="col-span-1 flex items-center">
                  <div className="text-sm font-medium">#{idx + 1}</div>
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

                <div className="col-span-2">
                  <label className="text-xs block mb-1">Unit (display)</label>
                  <div className="px-2 py-2 border rounded h-full flex items-center">
                    <div className="text-xs text-gray-400">gram</div>
                  </div>
                </div>

                <div className="col-span-1 flex justify-end">
                  <button type="button" onClick={() => removeMeasurementRow(r.id)} className="px-2 py-1 bg-red-600 text-white rounded">H</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm block mb-1">Deskripsi</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border px-3 py-2 rounded" rows={3} />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Batal</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded">{saving ? "Menyimpan..." : "Simpan Perubahan"}</button>
        </div>
      </form>
    </div>
  );
}
