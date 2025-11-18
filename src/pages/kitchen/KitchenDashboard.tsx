// src/pages/Kitchen/KitchenDashboard.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

type TotalsItem = {
  item_id: number;
  item_name?: string | null;
  total_quantity: number;
};

type RunListRow = {
  id: number;
  date: string;
  status: string;
  created_at?: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  dough_done: "Dough Done",
  filling_done: "Filling Done",
  merged: "Merged",
  qc_passed: "QC Passed",
  qc_failed: "QC Failed",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-800",
  dough_done: "bg-indigo-50 text-indigo-700",
  filling_done: "bg-blue-50 text-blue-700",
  merged: "bg-green-50 text-green-700",
  qc_passed: "bg-green-50 text-green-700",
  qc_failed: "bg-red-50 text-red-700",
};

export default function KitchenDashboard(): JSX.Element {
  const navigate = useNavigate();
  const [date, setDate] = useState<string>(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1); // default tomorrow as before
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  });

  const [totals, setTotals] = useState<TotalsItem[]>([]);
  const [loadingTotals, setLoadingTotals] = useState<boolean>(false);

  const [runs, setRuns] = useState<RunListRow[]>([]);
  const [loadingRuns, setLoadingRuns] = useState<boolean>(false);

  useEffect(() => {
    fetchTotals();
    fetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function fetchTotals() {
    setLoadingTotals(true);
    try {
      const res = await fetch(`${API_BASE}/api/production-orders/totals/items?date=${date}`);
      const json = await res.json();
      if (json && json.success) setTotals(json.data || []);
      else setTotals([]);
    } catch (err) {
      console.error("fetchTotals:", err);
      setTotals([]);
    } finally {
      setLoadingTotals(false);
    }
  }

  // --- bagian fetchRuns() (ganti fungsi yang ada) ---
async function fetchRuns() {
  setLoadingRuns(true);
  try {
    const res = await fetch(`${API_BASE}/api/kitchen/runs?date=${date}`);
    const json = await res.json();
    if (json && json.success) {
      const maybe = json.data;

      // Case 1: backend returns array of runs (each may already include qc)
      if (Array.isArray(maybe)) {
        setRuns(maybe as RunListRow[]);
      } else if (maybe && maybe.run) {
        // Case 2: backend returns object { run, items, dough, filling, qc }
        // attach qc to run so dashboard can show it
        const runObj = { ...(maybe.run || {}), qc: maybe.qc || [] };
        setRuns([runObj] as RunListRow[]);
      } else if (maybe && (maybe.id || maybe.date)) {
        // Case 3: backend returned single run object (no wrapper)
        setRuns([maybe] as RunListRow[]);
      } else {
        setRuns([]);
      }
    } else {
      setRuns([]);
    }
  } catch (err) {
    console.error("fetchRuns:", err);
    setRuns([]);
  } finally {
    setLoadingRuns(false);
  }
}


  async function createRun() {
    if (!date) return alert("Pilih tanggal dulu");
    if (!confirm(`Buat kalkulasi Kitchen untuk tanggal ${date}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/kitchen/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (json && json.success) {
        alert("Run dibuat (id: " + (json.data?.kitchen_run_id ?? "n/a") + ")");
        fetchRuns();
      } else {
        alert("Gagal membuat run: " + (json?.message || "Unknown"));
      }
    } catch (err) {
      console.error("createRun:", err);
      alert("Gagal membuat run (cek console)");
    }
  }

  return (
    <>
      <PageMeta title="Kitchen Dashboard" description="Kitchen production & calculation dashboard" />
      <PageBreadcrumb pageTitle="Kitchen Dashboard" />

      <div className="space-y-6 p-4">
        <ComponentCard title="Kontrol Run & Kalkulasi">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Tanggal</label>
              <input
                className="border rounded-md px-3 py-2 text-sm"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* <button
                onClick={fetchTotals}
                disabled={loadingTotals}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm bg-white hover:shadow-sm"
              >
                {loadingTotals ? <span className="text-xs">Memuat…</span> : "Refresh Totals"}
              </button> */}

              <button
                onClick={createRun}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-emerald-600 text-white hover:opacity-95"
              >
                Buat Run (Generate Kalkulasi)
              </button>

              <button
                onClick={() => navigate(`/kitchen/calc/${date}`)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border bg-white"
              >
                Lihat Kalkulasi
              </button>
            </div>

            <div className="ml-auto text-sm text-gray-500">
              <div>Tanggal terpilih:</div>
              <div className="mt-1 font-medium">{new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</div>
            </div>
          </div>
        </ComponentCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ComponentCard title="Ringkasan Target Produksi (Per Item)">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Item</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Total Qty</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loadingTotals && (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-sm text-gray-500">Memuat totals…</td>
                    </tr>
                  )}

                  {!loadingTotals && totals.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-sm text-gray-500">Tidak ada data</td>
                    </tr>
                  )}

                  {totals.map((t) => (
                    <tr key={t.item_id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.item_name ?? `#${t.item_id}`}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{t.total_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ComponentCard>

          <ComponentCard title="Runs (Tersimpan)">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
  <tr>
    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Run ID / Tanggal</th>
    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">QC</th> {/* NEW */}
    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Created</th>
    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Aksi</th>
  </tr>
</thead>
<tbody className="bg-white divide-y divide-gray-100">
  {loadingRuns && (
    <tr>
      <td colSpan={5} className="px-4 py-4 text-sm text-gray-500">Memuat runs…</td>
    </tr>
  )}

  {!loadingRuns && runs.length === 0 && (
    <tr>
      <td colSpan={5} className="px-4 py-4 text-sm text-gray-500">Belum ada run untuk tanggal ini</td>
    </tr>
  )}

  {runs.map((r) => (
    <tr key={r.id}>
      <td className="px-4 py-3 text-sm text-gray-700">{r.id} — {r.date}</td>

      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASS[r.status] ?? "bg-gray-50 text-gray-700"}`}>
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      </td>

      {/* QC column */}
      <td className="px-4 py-3">
        {r.qc && r.qc.length > 0 ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${r.qc[0].status === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {r.qc[0].status}
          </span>
        ) : (
          <span className="text-xs text-gray-400">No QC</span>
        )}
      </td>

      <td className="px-4 py-3 text-sm text-gray-600">{r.created_at ?? "-"}</td>

      <td className="px-4 py-3 text-center">
        <div className="inline-flex items-center gap-2">
          <button onClick={() => navigate(`/kitchen/calc/${r.date}`)} className="px-2 py-1 text-sm border rounded">Lihat</button>
          <button onClick={() => navigate(`/kitchen/calc/${r.date}`)} className="px-2 py-1 text-sm border rounded">Print</button>
        </div>
      </td>
    </tr>
  ))}
</tbody>

              </table>
            </div>
          </ComponentCard>
        </div>
      </div>
    </>
  );
}
