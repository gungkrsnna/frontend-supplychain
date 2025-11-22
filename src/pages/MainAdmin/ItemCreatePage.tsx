// src/pages/ItemCreatePage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  TrashBinIcon,
} from "../../icons";

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
  // ref for hidden file input
  let fileInputRef: HTMLInputElement | null = null;

  // preview URL for selected image (object URL)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);


  // NEW: state for selected image file
  const [imageFile, setImageFile] = useState<File | null>(null);

  // base (smallest) unit id. All rows will display this unit label.
  const [baseUomId, setBaseUomId] = useState<number | "">("");
  const [measurementUnits, setMeasurementUnits] = useState<MeasurementRow[]>([
    { id: String(Date.now()), uom_id: baseUomId === "" ? "" : Number(baseUomId), value: "1" },
  ]);

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

  function handleChooseImageClick() {
    if (fileInputRef) {
      fileInputRef.click();
      return;
    }
    // fallback: query DOM
    const el = document.getElementById("item-image-input") as HTMLInputElement | null;
    if (el) el.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    if (!f) {
      setImageFile(null);
      setImagePreviewUrl(null);
      return;
    }
    // basic client-side validation (same as validate())
    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    const maxSize = 2 * 1024 * 1024;
    if (!allowedTypes.includes(f.type)) {
      toast.error("Tipe gambar tidak didukung (png, jpg, webp)");
      e.currentTarget.value = ""; // reset input
      return;
    }
    if (f.size > maxSize) {
      toast.error("Ukuran gambar maksimal 2MB");
      e.currentTarget.value = "";
      return;
    }

    setImageFile(f);
    // create object URL for preview
    try {
      const url = URL.createObjectURL(f);
      setImagePreviewUrl(url);
    } catch (err) {
      setImagePreviewUrl(null);
    }
  }

  function handleRemoveImage() {
    // clear both state and input value
    setImageFile(null);
    setImagePreviewUrl(null);
    // reset hidden input
    const el = document.getElementById("item-image-input") as HTMLInputElement | null;
    if (el) el.value = "";
  }

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        try { URL.revokeObjectURL(imagePreviewUrl); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
    setMeasurementUnits((prev) => {
      const defaultUom = baseUomId !== "" ? Number(baseUomId) : (uoms && uoms.length ? Number(uoms[0].id) : "");
      return [...prev, { id: String(Date.now() + Math.random()), uom_id: defaultUom, value: "1" }];
    });
  }

  function removeMeasurementRow(id: string) {
    setMeasurementUnits((prev) => {
      if (prev.length === 0) return prev;
      const firstId = prev[0].id;
      if (id === firstId) {
        // jangan hapus baris pertama
        toast?.error?.("Baris pertama tidak bisa dihapus (satuan dasar).");
        return prev;
      }
      return prev.filter((r) => r.id !== id);
    });
  }

  function updateMeasurementRow(id: string, patch: Partial<MeasurementRow>) {
    setMeasurementUnits((prev) =>
      prev.map((r, idx) => {
        if (r.id !== id) return r;
        if (idx === 0) {
          // baris pertama tidak boleh diubah; namun kita izinkan mungkin perubahan internal non-uom (jika ada)
          // untuk keamanan, ignore perubahan uom_id/value pada first row
          const allowedPatch = { ...patch };
          delete (allowedPatch as any).uom_id;
          delete (allowedPatch as any).value;
          return { ...r, ...allowedPatch };
        }
        const merged = { ...r, ...patch };
        // jika uom_id diubah dan value kosong, isi default "1"
        if ((patch.uom_id !== undefined) && (merged.value === "" || merged.value === null || merged.value === undefined)) {
          merged.value = "1";
        }
        return merged;
      })
    );
  }

  useEffect(() => {
    setMeasurementUnits((prev) => {
      // jika belum ada row pertama => buat satu
      const defaultUom = baseUomId !== "" ? Number(baseUomId) : (uoms && uoms.length ? Number(uoms[0].id) : "");
      if (!prev || prev.length === 0) {
        return [{ id: String(Date.now()), uom_id: defaultUom, value: "1" }];
      }

      const first = prev[0];
      // jika first.uom_id berbeda dari defaultUom, ganti; juga pastikan value = "1"
      const needUpdate = Number(first.uom_id || "") !== Number(defaultUom) || first.value !== "1";
      if (!needUpdate) return prev;

      const updatedFirst = { ...first, uom_id: defaultUom, value: "1" };
      return [updatedFirst, ...prev.slice(1)];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUomId, uoms]);


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

    // validate image file if selected
    if (imageFile) {
      const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!allowedTypes.includes(imageFile.type)) {
        toast.error("Tipe gambar tidak didukung (png, jpg, webp)");
        return false;
      }
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (imageFile.size > maxSize) {
        toast.error("Ukuran gambar maksimal 2MB");
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

      // if user selected an image, upload it now to /api/item/:id/image
      if (imageFile && createdId) {
        try {
          const fd = new FormData();
          fd.append("image", imageFile);
          const r2 = await axios.post(`/api/item/${createdId}/image`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          // prefer server-updated item data if returned
          const updated = r2.data?.data ?? r2.data;
          // navigate with updated id (createdId still valid)
          navigate(`/superadmin/brands/${brandId ?? safeBrandId ?? ""}/items`, {
            state: {
              toast: { type: "success", message: "Item berhasil dibuat", createdId: updated?.id ?? createdId },
            },
          });
          return updated;
        } catch (imgErr: any) {
          console.error("upload image after create failed", imgErr);
          // still navigate but inform user image upload failed
          navigate(`/superadmin/brands/${brandId ?? safeBrandId ?? ""}/items`, {
            state: {
              toast: { type: "warn", message: "Item dibuat tetapi gagal mengunggah gambar", createdId },
            },
          });
          return created;
        }
      }

      // no image => navigate back
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
        {/* <div>
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
        </div> */}

        {/* ===== Improved Image Upload (drag & drop + preview + actions) ===== */}
        <div>
          <label className="text-sm block mb-1">Image</label>

          {/* Hidden input (still used for click-to-select) */}
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp"
            ref={(el) => (fileInputRef = el)}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
              if (f) processFile(f);
              else {
                setImageFile(null);
                setImagePreviewUrl(null);
              }
            }}
            className="hidden"
            id="item-image-input"
          />

          {/* Drag & Drop area */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef && fileInputRef.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef && fileInputRef.click(); }}
            onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("ring-2", "ring-dashed", "ring-blue-300"); }}
            onDragLeave={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove("ring-2", "ring-dashed", "ring-blue-300"); }}
            onDrop={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).classList.remove("ring-2", "ring-dashed", "ring-blue-300");
              const f = e.dataTransfer?.files?.[0] ?? null;
              if (f) processFile(f);
            }}
            className="relative border border-dashed border-gray-300 rounded-lg p-4 flex items-center gap-4 cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            style={{ minHeight: 96 }}
            aria-label="Upload gambar item (klik atau tarik file ke sini)"
          >
            {/* If no image selected -> show placeholder */}
            {!imageFile ? (
              <>
                <div className="flex-shrink-0">
                  <div className="w-16 h-12 flex items-center justify-center rounded bg-gray-100">
                    {/* simple icon (SVG) */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h10a4 4 0 004-4V7a4 4 0 00-4-4h-3" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11l3-3 4 4 5-5" />
                    </svg>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700">Click Button or Drag the picture here</div>
                  <div className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP — max 2MB.</div>
                  {/* <div className="text-xs text-gray-500 mt-2">Rekomendasi: ukuran landscape, resolusi minimal 800×600 untuk preview tajam.</div> */}
                </div>

                <div className="flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef && fileInputRef.click()}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Select Image
                  </button>
                </div>
              </>
            ) : (
              /* If image selected -> show preview card */
              <>
                <div className="w-28 h-20 flex-shrink-0 rounded overflow-hidden border">
                  <img src={imagePreviewUrl ?? undefined} alt="preview" className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium text-gray-800 truncate">{imageFile.name}</div>
                    <div className="text-xs text-gray-500">{(imageFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Preview image. If want to change, Click "Change Image".
                  </div>

                  {/* optional: show image dimension if you want (requires reading) */}
                </div>

                <div className="flex-shrink-0 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef && fileInputRef.click()}
                    className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // remove file
                      setImageFile(null);
                      setImagePreviewUrl(null);
                      const el = document.getElementById("item-image-input") as HTMLInputElement | null;
                      if (el) el.value = "";
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>

          {/* optional area for upload progress or error */}
          {/** If you later implement upload with progress, show a progress bar here **/}
          <div id="image-upload-feedback" className="mt-2 text-xs text-red-600" />
        </div>

        {/* ===== end improved upload block ===== */}


        <div>
          <label className="text-sm block mb-1">Item Name <span className="text-red-500">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="Nama item" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ padding: '20px 0' }}>
          {/* CATEGORY */}
          <div>
            <label className="text-sm block mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId === "" ? "" : String(categoryId)}
              onChange={(e) => setCategoryId(toNumberOrEmpty(e.target.value))}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name ?? c.id}
                </option>
              ))}
            </select>
          </div>

          {/* TOGGLE WITHOUT TITLE */}
          <div className="pt-[6px]" style={{ padding: 'auto 0', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center gap-3" style={{ padding: '0 20px'}}>
              <button
                type="button"
                onClick={() => setIsProduction((s) => !s)}
                aria-pressed={isProduction}
                className={`relative inline-flex items-center h-6 w-12 rounded-full transition-colors focus:outline-none 
                  ${isProduction ? "bg-green-500" : "bg-gray-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform 
                    ${isProduction ? "translate-x-1" : "translate-x-6"}`}
                />
              </button>

              <div className="text-sm">
                <div className="font-medium">
                  {isProduction ? "Production Item" : "Non-production Item"}
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-1 px-[20px]">
              Toggle to classify whether this item is used in production or not.
            </p>
          </div>

        </div>


        {/* Base UOM selector */}
        <div>
          <label className="text-sm block mb-1">Base Unit (smallest unit) <span className="text-red-500">*</span></label>
          <select
            value={baseUomId === "" ? "" : String(baseUomId)}
            onChange={(e) => setBaseUomId(toNumberOrEmpty(e.target.value))}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="">Select Base Unit</option>
            {uoms.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name ?? u.kode ?? u.id}
              </option>
            ))}
          </select>
        </div>


        <div style={{ padding: '20px 0' }}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Measurement Units</label>
            <div className="flex gap-2">
              <button type="button" onClick={addMeasurementRow} className="px-2 py-1 bg-gray-100 rounded text-sm">+ Add Row</button>
              <button type="button" onClick={() => setMeasurementUnits([{ id: String(Date.now()), uom_id: "", value: "" }])} className="px-2 py-1 bg-gray-50 rounded text-sm">Reset</button>
            </div>
          </div>

          <div className="space-y-3">
            {measurementUnits.map((r, idx) => {
              const isFirst = idx === 0;
              return (
                <div key={r.id} className="border rounded bg-white">
                  <div className="grid grid-cols-12 gap-2 items-center p-2">
                    <div className="col-span-1">
                      <div className="text-sm font-medium">Measurement {idx + 1}</div>
                    </div>

                    <div className="col-span-4">
                      <label className="text-xs block mb-1">Name (UOM)</label>
                      {isFirst ? (
                        <div className="px-2 py-2 rounded h-full flex items-center">
                          <div className="text-sm text-gray-700">
                            {(() => {
                              const u = baseUomId === "" ? undefined : uoms.find(uu => Number(uu.id) === Number(baseUomId));
                              return u ? (u.name ?? u.kode ?? String(u.id)) : "(belum pilih satuan dasar)";
                            })()}
                          </div>
                        </div>
                      ) : (
                        <select
                          value={r.uom_id === "" ? "" : String(r.uom_id)}
                          onChange={(e) => updateMeasurementRow(r.id, { uom_id: toNumberOrEmpty(e.target.value) })}
                          className="w-full border px-2 py-2 rounded"
                        >
                          <option value="">-- Pilih UOM --</option>
                          {uoms.map(u => <option key={u.id} value={String(u.id)}>{u.name ?? u.kode ?? u.id}</option>)}
                        </select>
                      )}
                    </div>

                    <div className="col-span-4">
                      <label className="text-xs block mb-1">Value</label>
                      {isFirst ? (
                        <div className="px-2 py-2 rounded h-full flex items-center">
                          <div className="text-sm text-gray-700">1</div>
                        </div>
                      ) : (
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={r.value ?? ""}
                          onChange={(e) => updateMeasurementRow(r.id, { value: e.target.value })}
                          placeholder="Contoh: 1000"
                          className="w-full border px-2 py-2 rounded"
                        />
                      )}
                    </div>

                    <div className="col-span-2">
                      <label className="text-xs block mb-1">Unit (display)</label>
                      <div className="px-2 py-2 rounded h-full flex items-center">
                        <div className="text-sm text-gray-700">{baseLabelText()}</div>
                      </div>
                    </div>

                    <div className="col-span-1 flex justify-end">
                      {!isFirst ? (
                        <button type="button" onClick={() => removeMeasurementRow(r.id)} className="px-2 py-2 bg-red-600 text-white rounded"><TrashBinIcon/></button>
                      ) : (
                      <>
                          <div style={{ width: 36 }} />
                      </>
                      )}
                    </div>

                  </div>
                  <div className="p-2">
                    {isFirst && (
                      <div className="col-span-12 text-xs text-gray-500 mt-1">
                        Measurement 1 is the base unit of this item.
                        Its value is always 1 and serves as the reference for all other unit conversions.
                      </div>
                    )}
                    </div>
                </div>
              );

              

            })}


          </div>
        </div>

        {/* NEW: image upload using button + hidden input */}
        {/* <div>
          <label className="text-sm block mb-1">Gambar (opsional, max 2MB)</label>

          <input
            type="file"
            accept="image/*"
            ref={(el) => (fileInputRef = el)}
            onChange={(e) => handleFileChange(e)}
            className="hidden"
            id="item-image-input"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleChooseImageClick()}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Pilih Gambar
            </button>

            {imageFile && (
              <>
                <button
                  type="button"
                  onClick={() => handleRemoveImage()}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Hapus Gambar
                </button>

                <div className="flex items-center gap-2 ml-2">
                  <img
                    src={imagePreviewUrl}
                    alt="preview"
                    className="w-20 h-16 object-cover rounded border"
                  />
                  <div className="text-xs text-gray-600">
                    <div className="font-medium">{imageFile.name}</div>
                    <div>{(imageFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div> */}


        <div>
          <label className="text-sm block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a short description..."
            className="w-full border px-3 py-2 rounded"
            rows={3}
          />
        </div>


        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded">
            {saving ? "Menyimpan..." : "Save Item"}
          </button>
        </div>
      </form>
    </div>
  );
}
