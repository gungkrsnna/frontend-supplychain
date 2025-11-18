// src/pages/store/components/InventoryTable.tsx
import React from "react";

type Props = {
  items: any[];
  inTransact: (item: any) => void;
  outTransact: (item: any) => void;
  onViewLedger?: (item: any) => void;
  onAddFromProd?: (item: any) => void;
  onSetAbsolute?: (item: any) => void;
};

function safeNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format stock (grams) into human friendly breakdown using measurements.
 * measurements: [{ id, uom: { name }, value, value_in_grams }]
 * Returns string e.g. "3 box 120 g" or "3 box" or "500 g"
 */
function formatStock(stockInGrams: number, measurements?: any[]): string {
  const grams = safeNumber(stockInGrams);
  if (!measurements || !Array.isArray(measurements) || measurements.length === 0) {
    return `${Math.round(grams)} g`;
  }

  const norms = measurements
    .map((m: any) => {
      const gramsPer = safeNumber(m.value_in_grams ?? m.value ?? 0);
      return {
        id: m.id,
        label: (m.uom && m.uom.name) ? String(m.uom.name) : (m.name ?? `m:${m.id}`),
        gramsPer
      };
    })
    .filter((m: any) => m.gramsPer > 0);

  if (norms.length === 0) return `${Math.round(grams)} g`;

  // sort descending by gramsPer; greedy allocate integer counts
  norms.sort((a: any, b: any) => b.gramsPer - a.gramsPer);

  let remaining = grams;
  const parts: string[] = [];

  for (const m of norms) {
    if (remaining <= 0) break;
    const cnt = Math.floor(remaining / m.gramsPer);
    if (cnt > 0) {
      parts.push(`${cnt} ${m.label}`);
      remaining -= cnt * m.gramsPer;
    }
  }

  // If we haven't allocated anything (stock < smallest measurement), try fractional for the largest unit with 2 decimals
  if (parts.length === 0 && grams > 0) {
    const largest = norms[0];
    const fractional = Number((grams / largest.gramsPer).toFixed(2));
    if (fractional >= 0.01) {
      if (fractional % 1 !== 0) {
        return `${String(parseFloat(fractional.toFixed(2)))} ${largest.label}`;
      } else {
        return `${Math.round(fractional)} ${largest.label}`;
      }
    }
  }

  if (remaining > 0) {
    // round remaining grams to integer
    parts.push(`${Math.round(remaining)} g`);
  }

  return parts.join(" ");
}

/**
 * Extract UoM name safely from uom-like object.
 * IMPORTANT: do NOT inspect item.name here (avoid returning item name).
 */
function extractUomName(maybe: any): string | null {
  if (!maybe) return null;
  // direct string
  if (typeof maybe === "string" && maybe.trim()) return maybe.trim();

  // common shapes
  if (maybe.name && typeof maybe.name === "string" && maybe.name.trim()) return maybe.name.trim();
  if (maybe.nama && typeof maybe.nama === "string" && maybe.nama.trim()) return maybe.nama.trim();

  // nested: { uom: { name } } or { Uom: { name } }
  if (maybe.uom && maybe.uom.name) return String(maybe.uom.name);
  if (maybe.Uom && maybe.Uom.name) return String(maybe.Uom.name);

  // alternative fields
  if (maybe.uom_name) return String(maybe.uom_name);
  if (maybe.label) return String(maybe.label);

  return null;
}

/**
 * Try to find grams-per-unit from item.uom or item fields.
 * Returns positive number or null.
 */
function getGramsPerUnitFrom(itemUomLike: any, itemObjLike: any): number | null {
  const tryNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const candidates = [
    itemUomLike?.value_in_grams,
    itemUomLike?.grams_per_unit,
    itemUomLike?.gramsPer,
    itemUomLike?.value,
    itemObjLike?.value_in_grams,
    itemObjLike?.grams_per_unit
  ];

  for (const c of candidates) {
    const n = tryNum(c);
    if (n) return n;
  }
  return null;
}

/**
 * For items WITHOUT measurements: try to display qty in item.uom if possible.
 * - stockInGrams: the canonical stored stock (assumed grams base)
 * - itemObj: item object returned by API (may include uom/Uom)
 * Returns: { label: string, totalGramsLabel: string | null }
 */
function formatNonMeasurementStock(stockInGrams: number, itemObj: any): { label: string; totalGramsLabel: string | null } {
  const grams = safeNumber(stockInGrams);

  // only look for UoM object/fields (don't inspect itemObj.name)
  const maybeUomObj = itemObj?.uom ?? itemObj?.Uom ?? itemObj?.uomObj ?? null;
  const uomName = extractUomName(maybeUomObj) ?? "pcs";

  // try detect grams-per-unit
  const gramsPerUnit = getGramsPerUnitFrom(maybeUomObj, itemObj);

  if (gramsPerUnit) {
    const units = grams / gramsPerUnit;
    const unitsLabel = Math.abs(units - Math.round(units)) < 1e-9 ? `${Math.round(units)}` : `${Number(units.toFixed(2))}`;
    return { label: `${unitsLabel} ${uomName}`, totalGramsLabel: `${Math.round(grams)} g` };
  }

  // fallback: show grams number as unit count if we don't know conversion
  const rawUnits = `${Math.round(grams)}`;
  return { label: `${rawUnits} ${uomName}`, totalGramsLabel: null };
}

export default function InventoryTable({ items, inTransact, outTransact, onViewLedger, onAddFromProd, onSetAbsolute }: Props) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr className="text-left text-sm text-gray-600">
            <th className="px-3 py-2 border-b">No</th>
            <th className="px-3 py-2 border-b">Item</th>
            <th className="px-3 py-2 border-b">Kode</th>
            <th className="px-3 py-2 border-b">Stock</th>
            <th className="px-3 py-2 border-b">Total (g)</th>
            <th className="px-3 py-2 border-b">Aksi</th>
          </tr>
        </thead>

        <tbody>
          {items.map((it: any, idx: number) => {
            const itemObj = it.Item ?? it.item ?? null;
            const itemName = itemObj?.name ?? it.name ?? "—";
            const itemCode = itemObj?.code ?? it.code ?? "";
            const stock = safeNumber(it.stock ?? it.current_stock ?? 0);

            // measurements may exist on Item or top-level
            const measurements = (itemObj && (itemObj.measurements || itemObj.measurements)) || it.measurements || null;

            // Determine display depending on whether measurements exist
            const hasMeasurements = measurements && Array.isArray(measurements) && measurements.length > 0;

            // stockLabel: if hasMeasurements -> formatted breakdown; else -> show in item.uom (if available)
            let stockLabel = "";
            let totalGramsLabel = "—";

            if (hasMeasurements) {
              stockLabel = formatStock(stock, measurements);
              totalGramsLabel = `${Math.round(stock)} g`;
            } else {
              const { label, totalGramsLabel: est } = formatNonMeasurementStock(stock, itemObj);
              stockLabel = label;
              totalGramsLabel = est ?? "—";
            }

            return (
              <tr key={itemObj?.id ?? it.itemId ?? it.item_id ?? idx} className="odd:bg-white even:bg-gray-50">
                <td className="px-3 py-2 align-top text-sm border-b">{idx + 1}</td>
                <td className="px-3 py-2 align-top text-sm border-b">{itemName}</td>
                <td className="px-3 py-2 align-top text-xs text-gray-500 border-b">{itemCode}</td>

                <td className="px-3 py-2 align-top text-sm border-b">
                  <div className="font-medium">{stockLabel}</div>
                  <div className="text-xs text-gray-400">({hasMeasurements ? "derived from measurements" : "base uom"})</div>
                </td>

                <td className="px-3 py-2 align-top text-sm text-gray-700 border-b">{totalGramsLabel}</td>

                <td className="px-3 py-2 align-top text-sm border-b">
                  <div className="flex gap-2">
                    <button
                      className="px-2 py-1 rounded bg-indigo-600 text-white text-sm"
                      onClick={() => outTransact(it)}
                    >
                      Stok Keluar
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-indigo-600 text-white text-sm"
                      onClick={() => inTransact(it)}
                    >
                      Stok Masuk
                    </button>

                    {onViewLedger && (
                      <button className="px-2 py-1 rounded border text-sm" onClick={() => onViewLedger(it)}>History</button>
                    )}

                    {/* {onAddFromProd && (
                      <button className="px-2 py-1 rounded border text-sm" onClick={() => onAddFromProd(it)}>Prod</button>
                    )}
                    {onSetAbsolute && (
                      <button className="px-2 py-1 rounded border text-sm" onClick={() => onSetAbsolute(it)}>Set</button>
                    )} */}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
