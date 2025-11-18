import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";

export default function RequestsByBrandPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!brandId) return;
    fetchRequests();
  }, [brandId]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const resp = await axios.get(`/api/admin/brands/${brandId}/requests?limit=200`);
      const rows = resp.data?.data ?? resp.data ?? [];
      setRequests(rows);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat requests");
    } finally { setLoading(false); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function bulkApprove() {
    if (selected.length === 0) return toast.warn("Pilih request dulu");
    try {
      const resp = await axios.post("/api/store-requests/bulk-approve", { requestIds: selected, processedBy: null });
      toast.success(resp.data.message || "Berhasil approve");
      fetchRequests();
      setSelected([]);
    } catch (err) {
      console.error(err);
      toast.error("Gagal approve");
    }
  }

  async function printSelected() {
    if (selected.length === 0) return toast.warn("Pilih request dulu");
    try {
      const resp = await axios.post("/api/store-requests/print-delivery", { requestIds: selected }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `surat_jalan_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error("Gagal print");
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Requests — Brand {brandId}</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">Back</button>
          <button onClick={bulkApprove} className="px-3 py-1 bg-green-600 text-white rounded">Approve Selected</button>
          <button onClick={printSelected} className="px-3 py-1 border rounded">Print Selected</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        {loading ? <div>Memuat...</div> : (
          requests.length === 0 ? <div className="p-6 text-center text-gray-500">Belum ada request</div> :
            <div className="space-y-2">
              {requests.map(r => (
                <div key={r.id} className="border rounded p-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{r.request_code}</div>
                    <div className="text-xs text-gray-500">{r.store?.name ?? r.store_id} — {r.status}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} />
                    <button onClick={() => navigate(`/stores/requests/${r.id}`)} className="px-2 py-1 border rounded">Lihat</button>
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>
    </div>
  );
}
