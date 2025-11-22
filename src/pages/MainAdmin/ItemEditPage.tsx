// src/pages/ItemEditPage.tsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Uom = { id: number; name?: string; kode?: string };
type Category = { id: number; name?: string; kode?: string };
type Brand = { id: string; nama?: string; kode?: string };

type MeasurementRow = {
  id: string; // local id for UI (not DB id)
  db_id?: number; // optional DB id of measurement (if present)
  uom_id?: number | "";
  value?: string; // keep as string for controlled input
  value_in_grams?: number;
  readOnly?: boolean; // whether this row is forced default (first row)
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
  const [uomId, setUomId] = useState<number | "">("");


  const [measurementUnits, setMeasurementUnits] = useState<MeasurementRow[]>([
    { id: String(Date.now()), uom_id: "", value: "1", readOnly: true },
  ]);

  // image states
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

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

      // populate form
      setName(data.name ?? "");
      setCode(data.code ?? "");
      setDescription(data.description ?? "");
      setIsProduction(Boolean(data.is_production));

      if (data.brand_id) setBrandId(String(data.brand_id));
      else if (data.brand && data.brand.id) setBrandId(String(data.brand.id));

      if (data.brand?.nama) setBrandName(data.brand.nama);
      else if (data.brand?.kode) setBrandName(data.brand.kode);

      setCategoryId(data.category_item?.id ?? data.category_item_id ?? "");
      setUomId(data.uom_id ?? "");


      // image
      setImageUrl(data.image_url ?? data.image ?? null);

      // measurements: ensure first row exists and is readOnly with value=1
      if (Array.isArray(data.measurements) && data.measurements.length > 0) {
        const rows: MeasurementRow[] = data.measurements.map((m: any, idx: number) => {
          const isFirst = idx === 0;
          return {
            id: String(Date.now()) + Math.random(),
            db_id: m.id,
            uom_id: m.uom_id ?? "",
            value: isFirst ? "1" : String(m.value ?? ""),
            value_in_grams: m.value_in_grams ?? m.value,
            readOnly: isFirst ? true : false,
          } as MeasurementRow;
        });
        // If first row has no uom, leave it blank (we will fallback on submit)
        setMeasurementUnits(rows);
      } else {
        // default: ensure first row exists and is readOnly value=1
        setMeasurementUnits([{ id: String(Date.now()), uom_id: "", value: "1", readOnly: true }]);
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
    setMeasurementUnits((prev) => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === 0) {
        toast.warn("Baris pertama adalah default dan tidak dapat dihapus.");
        return prev;
      }
      return prev.filter((r) => r.id !== id);
    });
  }

  function updateMeasurementRow(id: string, patch: Partial<MeasurementRow>) {
    setMeasurementUnits((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        // jangan izinkan edit pada row yang readOnly (baris pertama)
        if (r.readOnly) {
          // jika ada kasus khusus kamu ingin mengizinkan perubahan uom pada readOnly,
          // ubah logika ini; sekarang kita block seluruh patch
          return r;
        }
        return { ...r, ...patch };
      })
    );
  }


  // image handlers (preview + upload + delete) - similar to view page
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function handleUpload() {
    if (!fileRef.current || !fileRef.current.files || !fileRef.current.files[0]) {
      toast.warn("Pilih file gambar terlebih dahulu.");
      return;
    }
    if (!id) return;
    const file = fileRef.current.files[0];
    const allowed = ["image/png","image/jpeg","image/webp"];
    if (!allowed.includes(file.type)) return toast.error("Tipe file tidak didukung");
    if (file.size > 2 * 1024 * 1024) return toast.error("Maks 2MB");

    const fd = new FormData();
    fd.append("image", file);

    try {
      setUploading(true);
      setProgress(0);

      const resp = await axios.post(`/api/item/${id}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (ev: ProgressEvent) => {
          if (ev.total) setProgress(Math.round((ev.loaded * 100) / ev.total));
        },
      });

      const data = resp.data?.data ?? resp.data;
      toast.success("✅ Gambar berhasil diunggah");
      setPreview(null);
      try { if (fileRef.current) fileRef.current.value = ""; } catch {}
      // update image url in state
      setImageUrl(data.image_url ?? data.image ?? null);
    } catch (err: any) {
      console.error("upload failed", err);
      const msg = err?.response?.data?.message || "Gagal mengunggah gambar";
      toast.error(`❌ ${msg}`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleDeleteImage() {
    if (!id) return;
    if (!confirm("Yakin ingin menghapus gambar item ini?")) return;
    try {
      await axios.delete(`/api/item/${id}/image`);
      toast.success("✅ Gambar dihapus");
      setImageUrl(null);
    } catch (err: any) {
      console.error("delete image failed", err);
      const msg = err?.response?.data?.message || "Gagal menghapus gambar";
      toast.error(`❌ ${msg}`);
    }
  }

  // validation
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
    for (let i = 0; i < measurementUnits.length; i++) {
      const r = measurementUnits[i];
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
      // ensure first row is exactly 1
      if (i === 0 && Number(r.value) !== 1) {
        toast.error("Baris pertama measurement harus bernilai 1 (default)");
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
      .map((r, idx) => {
        // skip completely empty row
        const emptyRow =
          (r.uom_id === "" || r.uom_id === null || r.uom_id === undefined) &&
          (r.value === "" || r.value === null || r.value === undefined);
        if (emptyRow) return null;

        // ensure first row uom fallback to first available uom
        let uomIdNum = Number(r.uom_id);
        if (idx === 0 && (!Number.isFinite(uomIdNum) || uomIdNum <= 0)) {
          // fallback to first uom in list
          uomIdNum = (uoms && uoms.length > 0) ? Number(uoms[0].id) : undefined;
        }
        const valNum = Number(r.value);

        if (!Number.isFinite(uomIdNum) || !Number.isFinite(valNum)) return null;

        const uomObj = uoms.find((u) => Number(u.id) === Number(uomIdNum));
        const factor = uomToGramFactor(uomObj);
        const value_in_grams = valNum * factor;

        return { uom_id: uomIdNum, value: valNum, value_in_grams };
      })
      .filter((x) => x !== null) as { uom_id: number; value: number; value_in_grams: number }[];

    // prefer sending brand_id as string
    const safeBrandId = brandId === "" ? undefined : String(brandId);
    const safeCategoryId = categoryId === "" ? undefined : Number(categoryId);

    const payload: any = {
      request_category_id: 0,
      name: name.trim(),
      code: code?.trim() || undefined,
      brand_id: safeBrandId,
      category_item_id: safeCategoryId,
      uom_id: measurement_units.length > 0 ? (measurementUnits[0].uom_id ? Number(measurementUnits[0].uom_id) : undefined) : undefined,
      is_production: isProduction ? 1 : 0,
      description: description || undefined,
    };
    if (measurement_units_payload.length > 0) payload.measurement_units = measurement_units_payload;

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

  // render image block used in the form
  function renderImageBlock() {
    const src = preview || imageUrl || null;
    return (
      <div className="space-y-2">
        <div className="w-full max-w-sm h-44 bg-gray-50 rounded border flex items-center justify-center overflow-hidden">
          {src ? (
            <img src={src} alt={name || "item image"} className="object-contain w-full h-full" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="text-center text-gray-400">
              <div className="text-lg font-medium">No Image</div>
              <div className="text-xs">Belum ada gambar</div>
            </div>
          )}
        </div>

        

        {uploading && (
          <div className="w-full max-w-sm bg-gray-100 rounded h-2 overflow-hidden">
            <div style={{ width: `${progress}%` }} className="h-full bg-green-500 transition-all" />
          </div>
        )}

        <div className="text-xs text-gray-500">Format: png / jpg / jpeg / webp. Maks 2MB (server).</div>

        <div className=" items-center gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="block" />
          <button type="button" onClick={handleUpload} disabled={uploading} className={`px-3 py-2 rounded ${uploading ? "bg-gray-300" : "bg-green-600 text-white"}`}>
            {uploading ? `Uploading... ${progress}%` : "Upload Gambar"}
          </button>

          {imageUrl && (
            <button type="button" onClick={handleDeleteImage} className="px-3 py-2 bg-red-600 text-white rounded">
              Hapus Gambar
            </button>
          )}
        </div>
      </div>
    );
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>{renderImageBlock()}</div>

          <div className="md:col-span-2 space-y-3">
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
                <label className="text-sm block mb-1">Production</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsProduction((s) => !s)}
                    aria-pressed={isProduction}
                    className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors focus:outline-none ${
                      isProduction ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        isProduction ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>

                  <div className="text-sm font-medium">
                    {isProduction ? "Production" : "Non-production"}
                  </div>
                </div>
              </div>


              <div>
                <label className="text-sm block mb-1">Category</label>
                <select value={categoryId === "" ? "" : String(categoryId)} onChange={(e) => setCategoryId(toNumberOrEmpty(e.target.value))} className="w-full border px-3 py-2 rounded">
                  <option value="">-- Pilih Category --</option>
                  {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name ?? c.kode ?? c.id}</option>)}
                </select>
              </div>

              
            </div>

            <div>
              <label className="text-sm block mb-1">Satuan Dasar</label>
              <select
                value={uomId === "" ? "" : String(uomId)}
                onChange={(e) => setUomId(Number(e.target.value))}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">-- Pilih UOM --</option>
                {uoms.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name ?? u.kode ?? u.id}
                  </option>
                ))}
              </select>
            </div>


          </div>
        </div>

        {/* measurements */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Measurement Units</label>
            <div className="flex gap-2">
              <button type="button" onClick={addMeasurementRow} className="px-2 py-1 bg-gray-100 rounded text-sm">+ Tambah Row</button>
              <button type="button" onClick={() => setMeasurementUnits([{ id: String(Date.now()), uom_id: "", value: "1", readOnly: true }])} className="px-2 py-1 bg-gray-50 rounded text-sm">Reset</button>
            </div>
          </div>

          <div className="space-y-3">
            {measurementUnits.map((r, idx) => (
              <div key={r.id} className="grid grid-cols-12 gap-2 items-center border rounded p-2">
                <div className="col-span-1 flex items-center">
                  <div className="text-sm font-medium">Measurement {idx + 1}</div>
                </div>

                <div className="col-span-4">
                  <label className="text-xs block mb-1">Name (UOM)</label>
                  <select
                    value={r.uom_id === "" ? "" : String(r.uom_id)}
                    onChange={(e) => {
                      // prevent edit if readOnly (extra safety)
                      if (r.readOnly) return;
                      updateMeasurementRow(r.id, { uom_id: toNumberOrEmpty(e.target.value) });
                    }}
                    className="w-full border px-2 py-2 rounded"
                    disabled={!!r.readOnly}>
                    <option value="">-- Pilih UOM --</option>
                    {uoms.map((u) => <option key={u.id} value={String(u.id)}>{u.name ?? u.kode ?? u.id}</option>)}
                  </select>
                </div>

                <div className="col-span-4">
                  <label className="text-xs block mb-1">Value</label>
                  <input type="number" step="any" min="0" value={r.value ?? ""} onChange={(e) => {
                    // prevent editing first row's value (default)
                    if (r.readOnly) return;
                    updateMeasurementRow(r.id, { value: e.target.value });
                  }} placeholder="Contoh: 1000" className={`w-full border px-2 py-2 rounded ${r.readOnly ? "bg-gray-100" : ""}`} disabled={r.readOnly} />
                </div>

                <div className="col-span-2">
                  <label className="text-xs block mb-1">Unit (display)</label>
                  <div className="px-2 py-2 border rounded h-full flex items-center">
                    <div className="text-xs text-gray-400">gram</div>
                  </div>
                </div>

                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeMeasurementRow(r.id)}
                    className={`px-2 py-1 text-white rounded ${r.readOnly ? "bg-gray-300 cursor-not-allowed" : "bg-red-600"}`}
                    disabled={!!r.readOnly}
                  >
                    H
                  </button>
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
