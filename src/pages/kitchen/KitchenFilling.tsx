// src/pages/Kitchen/KitchenFilling.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

export default function KitchenFilling(): JSX.Element {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [runData, setRunData] = useState<any | null>(null);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    if (!date) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/kitchen/runs?date=${date}`);
      const j = await r.json();
      setRunData(j && j.success ? j.data : null);
    } catch (e) {
      console.error("load filling:", e);
      setRunData(null);
    } finally {
      setLoading(false);
    }
  }

  async function completeFilling() {
    if (!runData || !runData.run) return alert("Tidak ada run aktif.");
    if (!confirm("Tandai stage 'filling' sebagai selesai?")) return;
    setActioning(true);
    try {
      const res = await fetch(`${API_BASE}/api/kitchen/runs/${runData.run.id}/stage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "filling" }),
      });
      const j = await res.json();
      if (j && j.success) {
        alert("Stage 'filling' diselesaikan.");
        await load();
      } else {
        alert("Gagal: " + (j?.message || "Unknown"));
      }
    } catch (e) {
      console.error(e);
      alert("Gagal menyelesaikan stage (cek console).");
    } finally {
      setActioning(false);
    }
  }

  return (
    <>
      <PageMeta title="Kitchen — Filling" />
      <PageBreadcrumb pageTitle="Kitchen / Filling" />
      <div className="p-4">
        <ComponentCard title={`Filling — ${date ?? "-"}`}>
          {loading ? (
            <div className="text-sm text-gray-500">Memuat data…</div>
          ) : !runData ? (
            <div className="text-sm text-gray-500">Tidak ada run untuk tanggal ini.</div>
          ) : (
            <>
              <div className="mb-4">
                <div className="text-sm text-gray-600">Run ID: <span className="font-medium text-gray-800">{runData.run?.id ?? "-"}</span></div>
                <div className="text-sm text-gray-600">Status: <span className="font-medium">{runData.run?.status ?? "-"}</span></div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Filling Tasks</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm text-gray-600">Filling</th>
                        <th className="px-4 py-2 text-right text-sm text-gray-600">Total Gram</th>
                        <th className="px-4 py-2 text-right text-sm text-gray-600">Per Loyang</th>
                        <th className="px-4 py-2 text-right text-sm text-gray-600">Loyang Needed</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {(runData.filling ?? []).length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-3 text-sm text-gray-500">Tidak ada tugas filling</td></tr>
                      ) : (runData.filling ?? []).map((f: any) => (
                        <tr key={f.filling_type ?? Math.random()}>
                          <td className="px-4 py-3 text-sm">{f.filling_type}</td>
                          <td className="px-4 py-3 text-sm text-right">{f.total_gram}</td>
                          <td className="px-4 py-3 text-sm text-right">{f.takaran_per_loyang ?? "-"}</td>
                          <td className="px-4 py-3 text-sm text-right">{f.loyang_needed ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded bg-white">Kembali</button>
                <button onClick={completeFilling} disabled={actioning} className="px-3 py-2 rounded bg-emerald-600 text-white">
                  {actioning ? "Memproses..." : "Selesai (Complete Filling)"}
                </button>
              </div>
            </>
          )}
        </ComponentCard>
      </div>
    </>
  );
}
