// src/pages/ItemViewPage.tsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type Uom = { id: number; name?: string; kode?: string };
type Measurement = {
  id: number;
  uom_id: number;
  value: number;
  value_in_grams: number;
  uom?: Uom;
};
type Item = {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_production?: boolean;
  category_item?: { id: number; name: string; kode?: string };
  uom?: Uom;
  measurements?: Measurement[];
  brand_id?: string;
  image?: string | null;
  image_url?: string | null;
};

export default function ItemViewPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const API_BASE = import.meta.env.VITE_API_BASE || "";

  useEffect(() => {
    if (id) fetchItem(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchItem(itemId: string) {
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE}/api/item/${itemId}`);
      const data = resp.data?.data ?? resp.data;
      setItem(data);
    } catch (err) {
      console.error("fetch item failed", err);
      toast.error("❌ Gagal memuat data item.");
    } finally {
      setLoading(false);
    }
  }

  // handle file selection (preview only)
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setPreview(null);
      return;
    }
    // preview (local blob URL)
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  // upload selected file
  async function handleUpload() {
    if (!fileRef.current || !fileRef.current.files || !fileRef.current.files[0]) {
      toast.warn("Pilih file gambar terlebih dahulu.");
      return;
    }
    if (!id) return;
    const file = fileRef.current.files[0];

    const fd = new FormData();
    fd.append("image", file);

    try {
      setUploading(true);
      setProgress(0);

      const resp = await axios.post(`${API_BASE}/api/item/${id}/image`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (ev: ProgressEvent) => {
          if (ev.total) setProgress(Math.round((ev.loaded * 100) / ev.total));
        },
      });

      const data = resp.data?.data ?? resp.data;
      toast.success("✅ Gambar berhasil diunggah");
      // cleanup preview and input
      try {
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
      } catch {}
      // update item
      setItem(data);
    } catch (err: any) {
      console.error("upload failed", err);
      const msg = err?.response?.data?.message || "Gagal mengunggah gambar";
      toast.error(`❌ ${msg}`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  // delete image
  async function handleDeleteImage() {
    if (!id) return;
    if (!confirm("Yakin ingin menghapus gambar item ini?")) return;
    try {
      await axios.delete(`${API_BASE}/api/item/${id}/image`);
      toast.success("✅ Gambar dihapus");
      // refresh item
      fetchItem(id);
    } catch (err: any) {
      console.error("delete image failed", err);
      const msg = err?.response?.data?.message || "Gagal menghapus gambar";
      toast.error(`❌ ${msg}`);
    }
  }

  // render image block
  function renderImageBlock() {
    // priority: preview (new chosen file) -> item.image_url -> placeholder
    const src = preview || item?.image_url || null;
    return (
      <div className="space-y-2">
        <div className="w-full max-w-sm h-56 bg-gray-50 rounded border flex items-center justify-center overflow-hidden">
          {src ? (
            <img
              src={src}
              alt={item?.name || "item image"}
              className="object-contain w-full h-full"
              onError={(e) => {
                // hide broken image
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="text-center text-gray-400">
              <div className="text-lg font-medium">No Image</div>
              <div className="text-xs">Belum ada gambar</div>
            </div>
          )}
        </div>

        {/* upload controls */}
        

        {uploading && (
          <div className="w-full max-w-sm bg-gray-100 rounded h-2 overflow-hidden">
            <div style={{ width: `${progress}%` }} className="h-full bg-green-500 transition-all" />
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] text-gray-600">
        <p>Memuat data item...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] text-gray-500">
        <p>Item tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto">
      <ToastContainer position="top-right" autoClose={4000} theme="colored" />
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Detail Item</h2>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
        >
          ← Kembali
        </button>
      </div>

      <div className="bg-white shadow rounded p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-6">
          <div>{renderImageBlock()}</div>

          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1">{item.name}</h3>
            <p className="text-gray-500 mb-3">{item.code}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <p className="text-sm text-gray-500">Kategori</p>
                <p className="font-medium">
                  {item.category_item?.name ?? "-"}{" "}
                  {item.category_item?.kode ? `(${item.category_item.kode})` : ""}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">UOM Utama</p>
                <p className="font-medium">{item.uom?.name ?? item.uom?.kode ?? "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tipe Produksi</p>
                <p className="font-medium">{item.is_production ? "Production" : "Non-production"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Deskripsi</p>
                <p className="font-medium">{item.description || "Tidak ada deskripsi"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Measurement Section */}
        <div className="pt-4 border-t">
          <h4 className="font-semibold mb-2">Measurement Units</h4>
          {item.measurements && item.measurements.length > 0 ? (
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 border">#</th>
                  <th className="p-2 border">UOM</th>
                  <th className="p-2 border">Value</th>
                </tr>
              </thead>
              <tbody>
                {item.measurements.map((m, idx) => (
                  <tr key={m.id || idx} className="hover:bg-gray-50">
                    <td className="p-2 border">{idx + 1}</td>
                    <td className="p-2 border">{m.uom?.name ?? m.uom?.kode ?? "-"}</td>
                    <td className="p-2 border">{m.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 italic">Tidak ada measurement unit untuk item ini.</p>
          )}
        </div>
      </div>
    </div>
  );
}
