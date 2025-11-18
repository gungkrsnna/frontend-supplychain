import React, { useEffect, useState } from "react";
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
};

export default function ItemViewPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const API_BASE = import.meta.env.VITE_API_BASE;


  useEffect(() => {
    if (id) fetchItem(id);
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
        <div>
          <h3 className="text-xl font-bold mb-1">{item.name}</h3>
          <p className="text-gray-500">{item.code}</p>
        </div>

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
            <p className="font-medium">
              {item.uom?.name ?? item.uom?.kode ?? "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tipe Produksi</p>
            <p className="font-medium">
              {item.is_production ? "Production" : "Non-production"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Deskripsi</p>
            <p className="font-medium">
              {item.description || "Tidak ada deskripsi"}
            </p>
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
                  <th className="p-2 border">Value (gram)</th>
                </tr>
              </thead>
              <tbody>
                {item.measurements.map((m, idx) => (
                  <tr key={m.id || idx} className="hover:bg-gray-50">
                    <td className="p-2 border">{idx + 1}</td>
                    <td className="p-2 border">
                      {m.uom?.name ?? m.uom?.kode ?? "-"}
                    </td>
                    <td className="p-2 border">{m.value}</td>
                    <td className="p-2 border">{m.value_in_grams}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 italic">
              Tidak ada measurement unit untuk item ini.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
