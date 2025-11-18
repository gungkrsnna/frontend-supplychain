// src/pages/store/StoreRequestsPage.tsx
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthContext } from "../../context/AuthContext"; // sesuaikan path bila perlu

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

export default function StoreRequestsPage(): JSX.Element {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const storeId = Number(user?.storeId ?? user?.store_id ?? 0);

  const [requests, setRequests] = useState<StoreRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId || Number.isNaN(storeId)) return;
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  async function fetchRequests() {
    if (!storeId) return;
    setLoading(true);
    try {
      // backend endpoint expected: GET /api/store-requests/store/:storeId
      const resp = await axios.get(`/api/store-requests/store/${storeId}`);
      const rows = resp.data?.data ?? resp.data ?? [];
      setRequests(rows);
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal memuat request");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    navigate(`/stores/requests/create`);
  }

  function openDetail(r: StoreRequest) {
    navigate(`/stores/requests/${r.id}`);
  }

  if (!storeId || Number.isNaN(storeId) || storeId <= 0) {
    return (
      <div className="p-6">
        <div className="text-red-600">Store ID tidak ditemukan pada profile Anda. Halaman ini hanya untuk user store.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2500} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Permintaan Store — Store {storeId}</h2>
          <div className="text-sm text-gray-500">Buat permintaan item ke admin atau lihat status permintaan Anda.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Kembali</button>
          <button onClick={openCreate} className="px-3 py-1 bg-green-600 text-white rounded">Buat Request</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        {loading ? (
          <div>Memuat...</div>
        ) : requests.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Belum ada request</div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Items</th>
                <th className="px-4 py-2">Tanggal</th>
                <th className="px-4 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, idx) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{r.request_code}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3">{(r.items || []).length}</td>
                  <td className="px-4 py-3">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openDetail(r)} className="px-2 py-1 bg-blue-500 text-white rounded">Lihat</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
