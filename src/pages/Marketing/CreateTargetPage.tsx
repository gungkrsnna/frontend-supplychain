// src/pages/TargetMatrixRotiGoolung.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Calendar page (navigate to separate page to create target)
 * - Menampilkan kalender bulan
 * - Tanggal sebelum besok dinonaktifkan
 * - Klik tanggal akan navigate ke /targets/create?date=YYYY-MM-DD
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

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function formatDateLabel(d: Date) {
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "2-digit", month: "short" });
}
function formatRangeLabel(start: Date, end: Date) {
  const s = start.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const e = end.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  return `${s} — ${e}`;
}
function endOfMonth(d: Date) {
  const c = new Date(d);
  c.setMonth(c.getMonth() + 1);
  c.setDate(0);
  c.setHours(23, 59, 59, 999);
  return c;
}
function generateCalendarDays(year: number, monthIndex0: number) {
  const first = new Date(year, monthIndex0, 1);
  const last = endOfMonth(first);
  const days: Date[] = [];

  const lead = first.getDay(); // 0..6 (Sun..Sat)
  for (let i = lead - 1; i >= 0; i--) {
    const d = new Date(first);
    d.setDate(first.getDate() - (i + 1));
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const dd = new Date(year, monthIndex0, d);
    dd.setHours(0, 0, 0, 0);
    days.push(dd);
  }

  while (days.length % 7 !== 0) {
    const nxt = new Date(days[days.length - 1]);
    nxt.setDate(nxt.getDate() + 1);
    nxt.setHours(0, 0, 0, 0);
    days.push(nxt);
  }
  return days;
}

export default function TargetMatrixRotiGoolung(): JSX.Element {
  const [stores] = useState<Store[]>(STORES);
  const [menus] = useState<MenuItem[]>(MENU);

  const navigate = useNavigate();

  // calendar month offset (0 = current month)
  const [monthOffset, setMonthOffset] = useState<number>(0);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // calendar base month
  const calendarBase = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [monthOffset]);

  const days = useMemo(() => {
    return generateCalendarDays(calendarBase.getFullYear(), calendarBase.getMonth());
  }, [calendarBase]);

  const monthLabel = useMemo(() => calendarBase.toLocaleDateString("id-ID", { month: "long", year: "numeric" }), [calendarBase]);

  // tomorrow threshold — dates < tomorrow are disabled
  const minSelectable = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // compute visible range label
  const visibleRangeLabel = useMemo(() => {
    if (!days || days.length === 0) return "";
    return formatRangeLabel(days[0], days[days.length - 1]);
  }, [days]);

  // whether prev allowed — prevent showing months that have no selectable dates (optional)
  const canPrev = useMemo(() => {
    // allow prev only if the previous month still contains at least one date >= tomorrow
    const prevMonth = new Date(calendarBase);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevDays = generateCalendarDays(prevMonth.getFullYear(), prevMonth.getMonth());
    return prevDays.some(d => d >= minSelectable);
  }, [calendarBase, minSelectable]);

  // when user clicks a date we navigate to a separate page for creating target
  function goToCreateForDate(d: Date) {
    const iso = isoDate(d);
    // navigate to your target creation route; change path if your app uses different route
    navigate(`/targets/create?date=${encodeURIComponent(iso)}`);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-3">Roti Goolung — Target Produksi</h1>
      <p className="text-sm text-gray-600 mb-6">Pilih tanggal untuk membuat target produksi.</p>

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthOffset(m => m - 1)}
            disabled={!canPrev}
            className={`px-3 py-1 rounded ${canPrev ? "bg-white border" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
          >
            ← Prev
          </button>

          <div className="px-3 py-1 bg-white border rounded font-medium">{monthLabel}</div>

          <button
            onClick={() => setMonthOffset(m => m + 1)}
            className="px-3 py-1 rounded bg-white border"
          >
            Next →
          </button>
        </div>

        <div className="text-sm text-gray-600">
          <span className="font-medium">{visibleRangeLabel}</span>
        </div>
      </div>

      {/* Calendar header weekdays */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map(w => (
          <div key={w} className="text-xs text-center text-gray-500 py-1">{w}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {days.map(d => {
          const iso = isoDate(d);
          const disabled = d < minSelectable;
          const inCurrentMonth = d.getMonth() === calendarBase.getMonth();

          return (
            <div
              key={iso}
              className={`p-2 border rounded-sm min-h-[64px] flex flex-col justify-between ${inCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`text-sm font-medium ${disabled ? "text-gray-300" : ""}`}>{d.getDate()}</div>
                <div className="text-xs text-gray-400">{/* reserved for badges if needed later */}</div>
              </div>

              <div className="mt-2 flex items-end justify-between">
                <div className="text-xs text-gray-500"></div>
                <div>
                  <button
                    onClick={() => !disabled && goToCreateForDate(d)}
                    disabled={disabled}
                    className={`text-xs px-2 py-1 rounded ${disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-indigo-600 text-white"}`}
                  >
                    Buat Target
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-gray-500 italic">Tanggal sebelum besok dinonaktifkan. Setelah klik "Buat Target" Anda akan diarahkan ke halaman pembuatan target.</div>
    </div>
  );
}
