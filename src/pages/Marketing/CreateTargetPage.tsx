// src/pages/TargetMatrixRotiGoolung.tsx
import React, { useMemo, useState } from "react";

/**
 * TargetMatrixRotiGoolung.tsx (revisi: pagination minggu)
 * - Menampilkan 14 hari (2 minggu) mulai dari besok + weekOffset*7 hari
 * - Prev / Next menggeser jendela tanggal tiap 7 hari
 * - Prev disabled jika weekOffset === 0 (tidak boleh mundur melewati besok)
 */

// ----- Type definitions -----
type Store = { id: number; name: string; note?: string };
type MenuItem = { id: number; name: string; note?: string };

// ----- Example stores & menu (hardcoded) -----
const STORES: Store[] = [
  { id: 1, name: "Ayani" },
  { id: 2, name: "Pakerisan" },
  { id: 3, name: "Monang-Maning" },
  { id: 4, name: "Sesetan" },
  { id: 5, name: "Jimbaran" },
  { id: 6, name: "Dalung" },
  { id: 7, name: "Batubulan" },
  { id: 8, name: "Tabanan" },
];

const MENU: MenuItem[] = [
  { id: 101, name: "Hotdog Roll" },
  { id: 102, name: "Pizza Roll" },
  { id: 103, name: "Abon Mayo Roll" },
  { id: 104, name: "Smoked Chicken & Cheese" },
  { id: 105, name: "Brulee Bomb" },
  { id: 106, name: "BBQ Hotdog" },
  { id: 107, name: "Garlic Mayo Smoked Chicken" },
  { id: 108, name: "Snow Bun Matcha" },
  { id: 109, name: "Roti Goolung Keju" },
  { id: 110, name: "Roti Goolung Coklat" },
];

// helper key
const mk = (menuId: number, storeId: number) => `${menuId}_${storeId}`;

// helper: format date label (hari, DD MMM)
function formatDateLabel(d: Date) {
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" });
}
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function formatRangeLabel(start: Date, end: Date) {
  const s = start.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const e = end.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  return `${s} — ${e}`;
}

export default function TargetMatrixRotiGoolung(): JSX.Element {
  // base data
  const [stores] = useState<Store[]>(STORES);
  const [menus] = useState<MenuItem[]>(MENU);

  // week offset (0 = start at besok, 1 = start at besok + 7 hari, etc.)
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // create list of 14 days starting from (tomorrow + weekOffset*7)
  const dateList = useMemo(() => {
    const arr: { date: Date; iso: string }[] = [];
    const start = new Date();
    start.setDate(start.getDate() + 1 + weekOffset * 7); // mulai besok + offset minggu
    // normalize start's hours to 00:00 to avoid DST/timezone noise
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      arr.push({ date: d, iso: isoDate(d) });
    }
    return arr;
  }, [weekOffset]);

  // per-date matrices stored in memory: Record<ISO_DATE, Record<`${menu}_${store}`, number>>
  const [perDateMatrices, setPerDateMatrices] = useState<Record<string, Record<string, number>>>({});

  // currently selected date (ISO string) to show matrix for
  const [selectedIsoDate, setSelectedIsoDate] = useState<string | null>(null);

  // quick-fill UI states (applies to currently selected date)
  const [quickStore, setQuickStore] = useState<number | "">("");
  const [quickStoreVal, setQuickStoreVal] = useState<number>(0);
  const [quickMenu, setQuickMenu] = useState<number | "">("");
  const [quickMenuVal, setQuickMenuVal] = useState<number>(0);

  // helper: create initial matrix for a date (can be replaced by server defaults)
  const makeInitialMatrix = (menus: MenuItem[], stores: Store[], base = 30) => {
    const m: Record<string, number> = {};
    menus.forEach((p, pi) => {
      stores.forEach((s, si) => {
        const val = Math.max(0, base + (pi * 3) + (si * 2));
        m[mk(p.id, s.id)] = val;
      });
    });
    return m;
  };

  // open matrix for date (load existing or initialize)
  function openDateMatrix(iso: string) {
    if (!perDateMatrices[iso]) {
      setPerDateMatrices((prev) => ({ ...prev, [iso]: makeInitialMatrix(menus, stores, 30) }));
    }
    setSelectedIsoDate(iso);
    // reset quick-fill controls
    setQuickStore("");
    setQuickMenu("");
    setQuickStoreVal(0);
    setQuickMenuVal(0);
  }

  // change a cell for currently selected date
  function handleCellChangeForSelected(menuId: number, storeId: number, raw: string) {
    if (!selectedIsoDate) return;
    const n = Number(raw || 0);
    setPerDateMatrices((prev) => {
      const copy = { ...prev };
      const mat = { ...(copy[selectedIsoDate] ?? {}) };
      mat[mk(menuId, storeId)] = Number.isNaN(n) ? 0 : n;
      copy[selectedIsoDate] = mat;
      return copy;
    });
  }

  function applyQuickFillStoreToSelected() {
    if (!selectedIsoDate) return;
    if (quickStore === "") return;
    const sid = Number(quickStore);
    setPerDateMatrices((prev) => {
      const copy = { ...prev };
      const mat = { ...(copy[selectedIsoDate] ?? makeInitialMatrix(menus, stores, 0)) };
      menus.forEach((m) => (mat[mk(m.id, sid)] = Number(quickStoreVal) || 0));
      copy[selectedIsoDate] = mat;
      return copy;
    });
  }

  function applyQuickFillMenuToSelected() {
    if (!selectedIsoDate) return;
    if (quickMenu === "") return;
    const mid = Number(quickMenu);
    setPerDateMatrices((prev) => {
      const copy = { ...prev };
      const mat = { ...(copy[selectedIsoDate] ?? makeInitialMatrix(menus, stores, 0)) };
      stores.forEach((s) => (mat[mk(mid, s.id)] = Number(quickMenuVal) || 0));
      copy[selectedIsoDate] = mat;
      return copy;
    });
  }

  function resetMatrixForSelected() {
    if (!selectedIsoDate) return;
    setPerDateMatrices((prev) => ({ ...prev, [selectedIsoDate]: makeInitialMatrix(menus, stores, 0) }));
  }

  // Save (stub) — replace with API call
  async function saveForSelected() {
    if (!selectedIsoDate) return;
    const payload = {
      date: selectedIsoDate,
      matrix: perDateMatrices[selectedIsoDate],
    };
    // TODO: panggil API untuk menyimpan. Saat ini hanya simpan di local state (already done).
    // contoh: await axios.post(`/api/brand/${brandId}/targets`, payload)
    // beri umpan balik ke user
    alert(`Saved target untuk ${selectedIsoDate}`);
  }

  // export CSV for selected date
  function exportCSVForSelected() {
    if (!selectedIsoDate) return;
    const mat = perDateMatrices[selectedIsoDate] ?? makeInitialMatrix(menus, stores, 0);
    const header = ["Menu \\ Cabang", ...stores.map((s) => s.name)];
    const rows = menus.map((m) => [m.name, ...stores.map((s) => String(mat[mk(m.id, s.id)] ?? 0))]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rotigoolung-targets-${selectedIsoDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // computed totals per store for the selected date
  const totalsPerStoreForSelected = useMemo(() => {
    if (!selectedIsoDate) return {};
    const mat = perDateMatrices[selectedIsoDate] ?? {};
    const t: Record<number, number> = {};
    stores.forEach((s) => {
      let sum = 0;
      menus.forEach((m) => (sum += Number(mat[mk(m.id, s.id)] ?? 0)));
      t[s.id] = sum;
    });
    return t;
  }, [perDateMatrices, selectedIsoDate, stores, menus]);

  // helper: whether prev allowed (do not allow going before weekOffset 0)
  const canPrev = weekOffset > 0;

  // helper to compute visible date range (for header)
  const visibleRangeLabel = useMemo(() => {
    if (!dateList || dateList.length === 0) return "";
    const start = dateList[0].date;
    const end = dateList[dateList.length - 1].date;
    return formatRangeLabel(start, end);
  }, [dateList]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-3">Roti Goolung — Planning Target Produksi</h1>
      <p className="text-sm text-gray-600 mb-6">
        Buat Target Produksi 
      </p>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={!canPrev}
            className={`px-3 py-1 rounded ${canPrev ? "bg-white border" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
          >
            ← Prev Week
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="px-3 py-1 rounded bg-white border"
          >
            Next Week →
          </button>
          
        </div>

        <div className="ml-4 text-sm text-gray-600"><span className="font-medium">{visibleRangeLabel}</span></div>
      </div>

      {/* Date list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {dateList.map((d) => {
          const iso = d.iso;
          const exists = Boolean(perDateMatrices[iso]);
          const isSelected = selectedIsoDate === iso;
          return (
            <div key={iso} className={`p-3 rounded border flex items-center justify-between ${isSelected ? "ring-2 ring-indigo-300 bg-indigo-50" : "bg-white"}`}>
              <div>
                <div className="text-sm font-medium">{formatDateLabel(d.date)}</div>
                <div className="text-xs text-gray-500">{iso}</div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`text-sm px-2 py-1 rounded ${exists ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                  {exists ? "Saved" : "Pending"}
                </div>
                <button
                  onClick={() => openDateMatrix(iso)}
                  className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                >
                  {exists ? "Edit Target" : "Buat Target"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Matrix area (only show when a date is selected) */}
      {selectedIsoDate ? (
        <div className="mt-4 bg-white rounded shadow p-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-500">Editing target untuk</div>
              <div className="text-lg font-semibold">{selectedIsoDate} — {formatDateLabel(new Date(selectedIsoDate))}</div>
            </div>

            <div className="flex flex-col md:flex-row gap-2 items-end">
              <button onClick={exportCSVForSelected} className="px-3 py-1 bg-blue-600 text-white rounded">Export CSV</button>
              <button onClick={resetMatrixForSelected} className="px-3 py-1 bg-gray-200 rounded">Reset</button>
              <button onClick={saveForSelected} className="px-3 py-1 bg-green-600 text-white rounded">Simpan Target</button>
              <button onClick={() => setSelectedIsoDate(null)} className="px-3 py-1 bg-red-100 text-red-700 rounded">Tutup</button>
            </div>
          </div>

          {/* Quick-fill controls */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-3">
              <div className="text-sm">Quick fill per cabang:</div>
              <select className="border px-2 py-1 rounded" value={quickStore} onChange={(e) => setQuickStore(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">-- pilih cabang --</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="number" className="w-24 border px-2 py-1 rounded" value={quickStoreVal} onChange={(e) => setQuickStoreVal(Number(e.target.value || 0))} />
              <button onClick={applyQuickFillStoreToSelected} className="px-3 py-1 bg-yellow-500 text-white rounded">Apply</button>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm">Quick fill per menu:</div>
              <select className="border px-2 py-1 rounded" value={quickMenu} onChange={(e) => setQuickMenu(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">-- pilih menu --</option>
                {menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input type="number" className="w-24 border px-2 py-1 rounded" value={quickMenuVal} onChange={(e) => setQuickMenuVal(Number(e.target.value || 0))} />
              <button onClick={applyQuickFillMenuToSelected} className="px-3 py-1 bg-yellow-500 text-white rounded">Apply</button>
            </div>
          </div>

          {/* Matrix table */}
          <div className="overflow-auto border rounded">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 sticky left-0 bg-gray-50 z-10">Menu \\ Cabang</th>
                  {stores.map((s) => (
                    <th key={s.id} className="px-3 py-2 text-right">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-indigo-600 mt-1">Σ {totalsPerStoreForSelected[s.id] ?? 0}</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {(menus).map((m) => (
                  <tr key={m.id} className="even:bg-gray-50">
                    <td className="px-3 py-2 font-medium w-64 sticky left-0 bg-white">{m.name}</td>

                    {stores.map((s) => {
                      const key = mk(m.id, s.id);
                      const val = (perDateMatrices[selectedIsoDate!] ?? {})[key] ?? 0;
                      return (
                        <td key={key} className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={val}
                            onChange={(e) => handleCellChangeForSelected(m.id, s.id, e.target.value)}
                            className="w-20 px-2 py-1 border rounded text-right"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">Pilih tanggal untuk mulai membuat target produksi.</div>
      )}
    </div>
  );
}
