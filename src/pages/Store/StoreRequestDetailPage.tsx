// src/pages/store/StoreRequestDetailPage.tsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthContext } from "../../context/AuthContext";

type ReqItem = {
  id?: number;
  item_id: number;
  requested_qty: number;
  uom_id?: number | null;
  note?: string | null;
  item?: any;
};

type StoreRequest = {
  id: number;
  request_code: string;
  status: string;
  note?: string | null;
  createdAt?: string;
  items?: ReqItem[];
  store?: any;
};

export default function StoreRequestDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [request, setRequest] = useState<StoreRequest | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchDetail() {
    setLoading(true);
    try {
      const resp = await axios.get(`/api/store-requests/${id}`);
      const data = resp.data?.data ?? resp.data ?? null;
      setRequest(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memuat detail request");
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }

  if (!id) {
    return <div className="p-6">ID request tidak ditemukan di URL.</div>;
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2500} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Detail Request</h2>
          <div className="text-sm text-gray-500">Lihat detail permintaan dari store.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
          {/* Anda bisa tambahkan tombol edit/cancel jika backend support */}
        </div>
      </div>

      <div className="bg-white rounded shadow p-6">
        {loading ? (
          <div>Memuat...</div>
        ) : !request ? (
          <div className="text-center text-gray-500 p-6">Detail tidak ditemukan</div>
        ) : (
          <>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold">Request {request.request_code}</h3>
                <div className="text-sm text-gray-500">{request.status} — {request.createdAt ? new Date(request.createdAt).toLocaleString() : ""}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-2">Catatan:</div>
              <div className="border rounded p-3 text-sm">{request.note || "Tidak ada catatan"}</div>
            </div>

            <div className="mt-4">
              <h4 className="font-medium mb-2">Items</h4>
              <div className="space-y-2">
                {(request.items || []).map((it, i) => (
                  <div key={i} className="flex justify-between items-center border rounded p-3">
                    <div>
                      <div className="font-medium">{it.item?.name ?? `Item ${it.item_id}`}</div>
                      <div className="text-xs text-gray-500">{it.item?.code ?? ""}</div>
                      {it.note && <div className="text-xs text-gray-600 mt-1">Note: {it.note}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{Number(it.requested_qty).toLocaleString()} {it.item?.uom?.name ?? (it.uom_id ?? "-")}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
