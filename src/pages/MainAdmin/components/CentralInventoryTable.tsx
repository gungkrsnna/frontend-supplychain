// src/pages/central/components/CentralInventoryTable.tsx
import React from "react";

export default function CentralInventoryTable({ items = [], onAdjust, onTransfer }: { items?: any[]; onAdjust?: (i:any)=>void; onTransfer?: (i:any)=>void }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-sm">#</th>
            <th className="px-3 py-2 text-left text-sm">Kode</th>
            <th className="px-3 py-2 text-left text-sm">Nama</th>
            <th className="px-3 py-2 text-right text-sm">Stock (base)</th>
            <th className="px-3 py-2 text-left text-sm">Aksi</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {items.map((row: any, idx: number) => {
            const item = row.Item ?? row.item ?? { id: row.item_id, code: row.code, name: row.name };
            const stock = Number(row.stock ?? 0).toLocaleString(undefined, { maximumFractionDigits: 6 });
            return (
              <tr key={row.id ?? `${item.id}-${idx}`}>
                <td className="px-3 py-2 text-sm">{idx + 1}</td>
                <td className="px-3 py-2 text-sm">{item?.code ?? "-"}</td>
                <td className="px-3 py-2 text-sm">{item?.name ?? "-"}</td>
                <td className="px-3 py-2 text-sm text-right">{stock}</td>
                <td className="px-3 py-2 text-sm">
                  <div className="flex gap-2">
                    <button className="px-2 py-1 bg-blue-600 text-white rounded text-xs" onClick={() => onAdjust && onAdjust(row)}>Adjust</button>
                    <button className="px-2 py-1 bg-yellow-600 text-white rounded text-xs" onClick={() => onTransfer && onTransfer(row)}>Transfer → Store</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr><td colSpan={5} className="p-4 text-center text-sm text-gray-500">Tidak ada item.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
