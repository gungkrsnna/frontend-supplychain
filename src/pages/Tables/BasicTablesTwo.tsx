// BasicTables.tsx (parent)
import React, { useCallback, useMemo, useRef, useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import BasicTableTwo from "../../components/tables/BasicTables/BasicTableTwo";

function getJakartaTomorrowISO() {
  const now = new Date();
  const jakartaString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  const jakartaNow = new Date(jakartaString);
  const t = new Date(jakartaNow);
  t.setDate(t.getDate() + 1);
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  planned: "Planned",
  adjusted: "Adjusted",
  completed: "Completed",
  cancelled: "Cancelled",
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-800",
  in_progress: "bg-indigo-50 text-indigo-700",
  planned: "bg-blue-50 text-blue-700",
  adjusted: "bg-orange-50 text-orange-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
};

const NEXT_STATUS: Record<string, string | null> = {
  pending: "in_progress",
  in_progress: "planned",
  planned: "adjusted",
  adjusted: "completed",
  completed: null,
  cancelled: null,
};

export default function BasicTablesTwo(): JSX.Element {
  const defaultIso = useMemo(() => getJakartaTomorrowISO(), []);
  const [targetIso] = useState<string>(defaultIso);
  const [note] = useState<string>("Target Produksi akan selanjutnya diserahkan ke Kitchen.");

  const [status, setStatus] = useState<string>("pending");
  const [isEditingTable, setIsEditingTable] = useState<boolean>(false);
  const [tableData, setTableData] = useState<any[] | null>(null);
  const initialSnapshotRef = useRef<any[] | null>(null);
  const [childKey, setChildKey] = useState<number>(0);
  const [dirty, setDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // NEW: readyStock map (rowId -> { projectName, team, budget, ... })
  const [readyStock, setReadyStock] = useState<Record<number, Record<string, number>>>({});

  // callback from child
  const handleTableChange = useCallback((newData: any[]) => {
    if (!initialSnapshotRef.current) {
      initialSnapshotRef.current = JSON.parse(JSON.stringify(newData || []));

      // Create example readyStock based on initial data (placeholder).
      // In real app: fetch /api/stock-ready and setReadyStock from response.
      const map: Record<number, Record<string, number>> = {};
      (newData || []).forEach((r: any) => {
        // For demo: assume ready stock = current value * 2 (or at least 50)
        map[r.id] = {
          projectName: Math.max(Number(r.projectName ?? 0) * 2, 50),
          team: Math.max(Number(r.team ?? 0) * 2, 50),
          budget: Math.max(Number(r.budget ?? 0) * 2, 50),
          status: Math.max(Number(r.status ?? 0) * 2, 50),
          plusone: Math.max(Number(r.plusone ?? 0) * 2, 50),
          plustwo: Math.max(Number(r.plustwo ?? 0) * 2, 50),
          plusthree: Math.max(Number(r.plusthree ?? 0) * 2, 50),
          plusfour: Math.max(Number(r.plusfour ?? 0) * 2, 50),
        };
      });
      setReadyStock(map);
    }

    setTableData(newData);

    if (isEditingTable) {
      try {
        const snap = initialSnapshotRef.current ?? [];
        const changed = JSON.stringify(snap) !== JSON.stringify(newData ?? []);
        setDirty(changed || false);
      } catch {
        setDirty(true);
      }
    }
  }, [isEditingTable]);

  // validate and also compare with readyStock
  const validateTable = useCallback((data: any[]): { ok: boolean; message?: string } => {
    if (!data) return { ok: false, message: "Tidak ada data" };
    for (const row of data) {
      const numericKeys = ["projectName","team","budget","status","plusone","plustwo","plusthree","plusfour"];
      for (const k of numericKeys) {
        const raw = row[k];
        const n = Number(raw);
        if (Number.isNaN(n) || n < 0) {
          return { ok: false, message: `Nilai tidak valid di produk "${row.user?.name ?? row.id}" pada kolom ${k}` };
        }
        // check against readyStock
        const stockForRow = readyStock[row.id] ?? {};
        const readyVal = Number(stockForRow[k] ?? -1);
        if (readyVal >= 0 && n > readyVal) {
          return { ok: false, message: `Jumlah ${k} (${n}) untuk produk "${row.user?.name ?? row.id}" melebihi stock ready (${readyVal}).` };
        }
      }
    }
    return { ok: true };
  }, [readyStock]);

  const preparePayload = useCallback((data: any[]) => {
    return data.map((r) => ({
      id: r.id,
      product: r.user?.name ?? "",
      dalung: Number(r.projectName),
      tabanan: Number(r.team),
      pakerisan: Number(r.budget),
      mm: Number(r.status),
      jimbaran: Number(r.plusone),
      sesetan: Number(r.plustwo),
      ayani: Number(r.plusthree),
      batubulan: Number(r.plusfour),
      target_date: targetIso,
      note,
      status,
    }));
  }, [note, targetIso, status]);

  const handleSaveAll = useCallback(async () => {
    if (!tableData || tableData.length === 0) {
      alert("Belum ada data untuk disimpan.");
      return;
    }

    const v = validateTable(tableData);
    if (!v.ok) {
      alert(v.message || "Validasi gagal");
      return;
    }

    const payload = preparePayload(tableData);

    try {
      setSaving(true);
      const res = await fetch("/api/production-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload, meta: { target_date: targetIso, note, status } }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      initialSnapshotRef.current = JSON.parse(JSON.stringify(tableData));
      setDirty(false);
      setIsEditingTable(false);
      alert("Data target produksi berhasil disimpan.");
    } catch (err: any) {
      console.error(err);
      alert("Gagal menyimpan: " + (err?.message ?? "unknown"));
    } finally {
      setSaving(false);
    }
  }, [tableData, preparePayload, validateTable, targetIso, note, status]);

  const handleEnterEdit = useCallback(() => {
    setIsEditingTable(true);
    setDirty(false);
  }, []);

  const handleCancel = useCallback(() => {
    setChildKey((k) => k + 1);
    setTableData(initialSnapshotRef.current ? JSON.parse(JSON.stringify(initialSnapshotRef.current)) : []);
    setDirty(false);
    setIsEditingTable(false);
  }, []);

  const handleStatusChange = useCallback((next: string) => {
    setStatus(next);
    if (isEditingTable) setDirty(true);
  }, [isEditingTable]);

  const handleAdvanceStatus = useCallback(() => {
    const next = NEXT_STATUS[status] ?? null;
    if (!next) return;
    setStatus(next);
    setDirty(true);
    setIsEditingTable(true);
  }, [status]);

  return (
    <>
      <PageMeta
        title="React.js Basic Tables Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js Basic Tables Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Production Plan" />

      <div className="space-y-6">
        <ComponentCard title="Breakdown Production">
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm text-gray-600">{note}</div>
              <div className="mt-2 flex items-center gap-3">
                <span className="inline-block rounded-md bg-yellow-50 text-yellow-800 px-3 py-1 text-sm font-medium">
                  {new Date(`${targetIso}T00:00:00`).toLocaleDateString("id-ID", {
                    weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta"
                  })}
                </span>
                <span className="text-xs text-gray-500">({targetIso})</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASS[status] ?? "bg-gray-50 text-gray-700"}`}>
                  {STATUS_LABEL[status] ?? status}
                </span>
              </div>
            </div>

            
          </div>

          <BasicTableTwo
            key={childKey}
            editable={isEditingTable}
            onChange={handleTableChange}
            initialData={initialSnapshotRef.current ?? undefined}
            stockReady={readyStock} // pass ready stock map
          />
        </ComponentCard>
      </div>

      <br />

      <div className="space-y-6">
        <ComponentCard title="Leftover Roti">
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm text-gray-600">{note}</div>
              <div className="mt-2 flex items-center gap-3">
                <span className="inline-block rounded-md bg-yellow-50 text-yellow-800 px-3 py-1 text-sm font-medium">
                  {new Date(`${targetIso}T00:00:00`).toLocaleDateString("id-ID", {
                    weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta"
                  })}
                </span>
                <span className="text-xs text-gray-500">({targetIso})</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASS[status] ?? "bg-gray-50 text-gray-700"}`}>
                  {STATUS_LABEL[status] ?? status}
                </span>
              </div>
            </div>

            
          </div>

          <BasicTableTwo
            key={childKey}
            editable={isEditingTable}
            onChange={handleTableChange}
            initialData={initialSnapshotRef.current ?? undefined}
            stockReady={readyStock} // pass ready stock map
          />
        </ComponentCard>
      </div>
    </>
  );
}
