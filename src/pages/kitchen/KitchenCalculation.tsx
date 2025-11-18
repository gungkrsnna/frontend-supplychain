// src/pages/Kitchen/KitchenCalculation.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

type Run = {
  id: number;
  date: string;
  status: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
};

type RunItem = {
  id?: number;
  kitchen_run_id?: number;
  item_id: number;
  item_name?: string | null;
  target_production: number;
  leftover_previous: number;
  adjustment: number;
  total_jumlah_produksi: number;
  dough_type?: string | null;
  dough_weight_per_unit?: number;
  filling_type?: string | null;
  filling_per_unit_gram?: number;
};

type DoughRow = {
  id?: number;
  dough_type?: string;
  total_weight: number;
  total_loyang?: number;
  remainder?: number;
};

type FillingRow = {
  id?: number;
  filling_type?: string;
  total_gram: number;
  takaran_per_loyang?: number;
  loyang_needed?: number;
  remainder_gram?: number;
};

type RunPayload = {
  run?: Run;
  items?: RunItem[];
  dough?: DoughRow[];
  filling?: FillingRow[];
  qc?: any[];
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

type Division = "all" | "dough" | "filling" | "merge";

/**
 * STAGE_ORDER defines lifecycle progression. Use these numeric ranks to decide
 * whether a stage is still available to be completed.
 */
const STAGE_ORDER: Record<string, number> = {
  pending: 0,
  dough_done: 1,
  filling_done: 2,
  merged: 3,
  qc_passed: 4,
  qc_failed: 4,
};

export default function KitchenCalculation(): JSX.Element {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<RunPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningCreate, setRunningCreate] = useState<boolean>(false);
  const [qcProcessing, setQcProcessing] = useState<boolean>(false);
  const [selectedDivision, setSelectedDivision] = useState<Division>("all");
  const [actioning, setActioning] = useState<boolean>(false);

  // fetch on mount / date change
  useEffect(() => {
    if (!date) return;
    fetchRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function fetchRun() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/kitchen/runs?date=${date}`);
      const j = await res.json();
      if (j && j.success) {
        setData(j.data || j);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error("fetchRun:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function createRunAndFetch() {
    if (!date) return;
    if (!confirm(`Buat kalkulasi baru untuk ${date}?`)) return;
    setRunningCreate(true);
    try {
      const res = await fetch(`${API_BASE}/api/kitchen/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const j = await res.json();
      if (j && j.success) {
        alert("Run dibuat");
        await fetchRun();
      } else {
        alert("Gagal buat run: " + (j?.message || "Unknown"));
      }
    } catch (err) {
      console.error("createRun:", err);
      alert("Gagal buat run (lihat console)");
    } finally {
      setRunningCreate(false);
    }
  }

  // helpers to compare stages
  function stageIndex(status?: string | null) {
    if (!status) return -1;
    return STAGE_ORDER[status] ?? -1;
  }

  function isStageAvailable(stage: "dough" | "filling" | "merged") {
    const runStatus = data?.run?.status ?? "pending";
    const currentIndex = stageIndex(runStatus);
    const wantedIndex = stage === "dough" ? STAGE_ORDER["dough_done"] : stage === "filling" ? STAGE_ORDER["filling_done"] : STAGE_ORDER["merged"];
    return currentIndex < wantedIndex;
  }

  async function completeStage(stage: "dough" | "filling" | "merged") {
    if (!data || !data.run) return alert("Tidak ada run tersedia");
    if (!confirm(`Tandai stage '${stage}' sebagai selesai?`)) return;
    setActioning(true);
    try {
      const res = await fetch(`${API_BASE}/api/kitchen/runs/${data.run.id}/stage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const j = await res.json();
      if (j && j.success) {
        // refresh run to reflect new status
        await fetchRun();
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

  async function doQCPass() {
    if (!data || !data.run) return alert("Tidak ada run tersedia");
    if (!confirm("Simpan QC status PASS untuk stage 'merged'?")) return;
    setQcProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/api/kitchen/runs/${data.run.id}/qc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "merged", status: "pass", note: "" }),
      });
      const j = await res.json();
      if (j && j.success) {
        // backend should set status -> qc_passed (or qc_failed)
        await fetchRun();
      } else {
        alert("Gagal QC: " + (j?.message || "Unknown"));
      }
    } catch (e) {
      console.error(e);
      alert("Gagal QC");
    } finally {
      setQcProcessing(false);
    }
  }

  const items = data?.items ?? [];
  const dough = data?.dough ?? [];
  const filling = data?.filling ?? [];

  // convenience: small summary for dough/filling used in division views
  const doughSummary = useMemo(() => dough, [dough]);
  const fillingSummary = useMemo(() => filling, [filling]);

  // Render helpers for each division
  function renderItemsSection() {
    return (
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Breakdown Production</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Item</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Target</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Leftover</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Adjustment</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-sm text-gray-500">Tidak ada item</td></tr>}
              {items.map((it) => (
                <tr key={it.item_id ?? `${it.item_name}-${Math.random()}`}>
                  <td className="px-4 py-3 text-sm text-gray-700">{it.item_name ?? `#${it.item_id}`}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{it.target_production}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{it.leftover_previous}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{it.adjustment}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{it.total_jumlah_produksi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderDoughSection(compact = false) {
    return (
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Dough Calculation</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Dough Type</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Total Weight (g)</th>
                {!compact && <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Total Loyang</th>}
                {!compact && <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Sisa (g)</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {doughSummary.length === 0 && <tr><td colSpan={compact ? 2 : 4} className="px-4 py-4 text-sm text-gray-500">Tidak ada data dough</td></tr>}
              {doughSummary.map((d) => (
                <tr key={d.dough_type ?? Math.random()}>
                  <td className="px-4 py-3 text-sm text-gray-700">{d.dough_type}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{d.total_weight}</td>
                  {!compact && <td className="px-4 py-3 text-sm text-right text-gray-700">{d.total_loyang ?? "-"}</td>}
                  {!compact && <td className="px-4 py-3 text-sm text-right text-gray-700">{d.remainder ?? "-"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderFillingSection(compact = false) {
    return (
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Filling Calculation</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Filling</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Total Gram</th>
                {!compact && <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Per Loyang</th>}
                {!compact && <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Loyang Needed</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {fillingSummary.length === 0 && <tr><td colSpan={compact ? 2 : 4} className="px-4 py-4 text-sm text-gray-500">Tidak ada data filling</td></tr>}
              {fillingSummary.map((f) => (
                <tr key={f.filling_type ?? Math.random()}>
                  <td className="px-4 py-3 text-sm text-gray-700">{f.filling_type}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{f.total_gram}</td>
                  {!compact && <td className="px-4 py-3 text-sm text-right text-gray-700">{f.takaran_per_loyang ?? "-"}</td>}
                  {!compact && <td className="px-4 py-3 text-sm text-right text-gray-700">{f.loyang_needed ?? "-"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // main content renderer based on division
  function renderDivisionContent() {
    if (selectedDivision === "all") {
      return (
        <>
          {renderItemsSection()}
          <div className="mt-4">{renderDoughSection()}</div>
          <div className="mt-4">{renderFillingSection()}</div>
        </>
      );
    }
    if (selectedDivision === "dough") {
      return (
        <>
          {/* include small items header for context */}
          <div className="mb-4 text-sm text-gray-600">Tampilkan hanya tugas Dough untuk tim Anda</div>
          {renderDoughSection(true)}
          <div className="mt-4 flex gap-2">
            {isStageAvailable("dough") ? (
              <button onClick={() => completeStage("dough")} disabled={actioning} className="px-3 py-2 rounded bg-emerald-600 text-white">
                {actioning ? "Memproses..." : "Selesai (Complete Dough)"}
              </button>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">Stage dough sudah selesai.</div>
            )}
            <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded bg-white">Kembali</button>
          </div>
        </>
      );
    }
    if (selectedDivision === "filling") {
      return (
        <>
          <div className="mb-4 text-sm text-gray-600">Tampilkan hanya tugas Filling untuk tim Anda</div>
          {renderFillingSection(true)}
          <div className="mt-4 flex gap-2">
            {isStageAvailable("filling") ? (
              <button onClick={() => completeStage("filling")} disabled={actioning} className="px-3 py-2 rounded bg-emerald-600 text-white">
                {actioning ? "Memproses..." : "Selesai (Complete Filling)"}
              </button>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">Stage filling sudah selesai.</div>
            )}
            <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded bg-white">Kembali</button>
          </div>
        </>
      );
    }
    // merge view
    return (
      <>
        <div className="mb-4 text-sm text-gray-600">Halaman Merge — gabungkan Dough & Filling</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>{renderDoughSection(true)}</div>
          <div>{renderFillingSection(true)}</div>
        </div>

        <div className="mt-4 flex gap-2">
          {isStageAvailable("merged") ? (
            <button onClick={() => completeStage("merged")} disabled={actioning} className="px-3 py-2 rounded bg-emerald-600 text-white">
              {actioning ? "Memproses..." : "Selesai (Complete Merge)"}
            </button>
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">Stage merge sudah selesai.</div>
          )}

          {/* show QC button only if run is at merged stage (or above) but not QC final */}
          {data?.run && stageIndex(data.run.status) >= STAGE_ORDER["merged"] && stageIndex(data.run.status) < STAGE_ORDER["qc_passed"] ? (
            <button onClick={doQCPass} disabled={qcProcessing} className="px-3 py-2 rounded border bg-white">
              {qcProcessing ? "Proses QC..." : "QC: Pass (Merged)"}
            </button>
          ) : null}

          <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded bg-white">Kembali</button>
        </div>

        {/* QC history */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">QC History</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Checked At</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Stage</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Status</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Checked By</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-500">Note</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {(!data?.qc || data.qc.length === 0) ? (
                  <tr><td colSpan={5} className="px-3 py-4 text-sm text-gray-500">Belum ada history QC</td></tr>
                ) : (
                  data.qc.map((q: any) => (
                    <tr key={q.id ?? `${q.stage}-${q.checked_at}`}>
                      <td className="px-3 py-2 text-sm text-gray-700">{new Date(q.checked_at || q.created_at || q.updated_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{q.stage}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${q.status === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">{q.checked_by_name ?? q.checked_by ?? "-"}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{q.note ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </>
    );
  }

  if (loading) {
    return (
      <>
        <PageMeta title="Kalkulasi Kitchen" />
        <PageBreadcrumb pageTitle="Kalkulasi Produksi" />
        <div className="p-6">
          <div className="text-sm text-gray-600">Mengambil data…</div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title="Kalkulasi Kitchen" description={`Kalkulasi produksi untuk ${date}`} />
      <PageBreadcrumb pageTitle="Kalkulasi Produksi" />

      <div className="space-y-6 p-4">
        <ComponentCard title={`Kalkulasi Produksi — ${date}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600">Kalkulasi & breakdown untuk tanggal</div>
              <div className="mt-1 text-base font-medium text-gray-800">
                {new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => window.print()} className="px-3 py-2 border rounded text-sm bg-white">🖨 Print</button>
              <button onClick={() => navigate(-1)} className="px-3 py-2 border rounded text-sm bg-white">← Kembali</button>
              <button
                onClick={createRunAndFetch}
                disabled={runningCreate}
                className="px-3 py-2 rounded text-sm bg-emerald-600 text-white"
              >
                {runningCreate ? "Membuat..." : "Buat Ulang / Re-generate Run"}
              </button>
            </div>
          </div>

          {/* top small run header */}
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Status run:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASS[data?.run?.status ?? ""] ?? "bg-gray-50 text-gray-700"}`}>
                {STATUS_LABEL[data?.run?.status ?? ""] ?? (data?.run?.status ?? "Unknown")}
              </span>
              <span className="text-sm text-gray-500">ID: <span className="font-medium text-gray-700">{data?.run?.id ?? "-"}</span></span>
            </div>

            {/* QC summary: last QC */}
            <div className="mt-2 text-sm text-gray-600">
              {data?.qc && data.qc.length > 0 ? (
                <>
                  <span className="font-medium text-gray-800">Last QC:</span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{ background: data.qc[0].status === 'pass' ? '#ecfdf5' : '#fff1f2', color: data.qc[0].status === 'pass' ? '#065f46' : '#9f1239' }}>
                    {data.qc[0].stage} — {data.qc[0].status.toUpperCase()}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">{new Date(data.qc[0].checked_at || data.qc[0].created_at || Date.now()).toLocaleString()}</span>
                  {data.qc[0].note ? <div className="mt-1 text-sm text-gray-500">Note: {data.qc[0].note}</div> : null}
                </>
              ) : (
                <span className="text-sm text-gray-500">Belum ada QC</span>
              )}
            </div>
          </div>
          

          {/* MAIN: sidebar + content */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar */}
            <aside className="w-full lg:w-56">
              <div className="sticky top-6">
                <div className="mb-3 text-xs font-semibold text-gray-500 uppercase">Divisi</div>
                <div className="space-y-2">
                  <button
                    onClick={() => setSelectedDivision("all")}
                    className={`w-full text-left px-3 py-2 rounded ${selectedDivision === "all" ? "bg-gray-800 text-white" : "bg-white border"}`}
                  >
                    All
                  </button>

                  <button
                    onClick={() => setSelectedDivision("dough")}
                    className={`w-full text-left px-3 py-2 rounded ${selectedDivision === "dough" ? "bg-indigo-600 text-white" : "bg-white border"}`}
                  >
                    Dough
                  </button>

                  <button
                    onClick={() => setSelectedDivision("filling")}
                    className={`w-full text-left px-3 py-2 rounded ${selectedDivision === "filling" ? "bg-blue-600 text-white" : "bg-white border"}`}
                  >
                    Filling
                  </button>

                  <button
                    onClick={() => setSelectedDivision("merge")}
                    className={`w-full text-left px-3 py-2 rounded ${selectedDivision === "merge" ? "bg-emerald-600 text-white" : "bg-white border"}`}
                  >
                    Merge (Do × Filling)
                  </button>
                </div>

                {/* quick links */}
                <div className="mt-6 text-xs text-gray-500">Quick links</div>
                <div className="mt-2 flex flex-col gap-2">
                  <button onClick={() => navigate(`/kitchen/dough/${date}`)} className="w-full px-3 py-2 text-sm border rounded bg-white text-left">Open Dough page</button>
                  <button onClick={() => navigate(`/kitchen/filling/${date}`)} className="w-full px-3 py-2 text-sm border rounded bg-white text-left">Open Filling page</button>
                  <button onClick={() => navigate(`/kitchen/merge/${date}`)} className="w-full px-3 py-2 text-sm border rounded bg-white text-left">Open Merge page</button>
                </div>
              </div>
            </aside>

            {/* Content area */}
            <main className="flex-1">
              {renderDivisionContent()}
            </main>
          </div>
        </ComponentCard>
      </div>
    </>
  );
}
