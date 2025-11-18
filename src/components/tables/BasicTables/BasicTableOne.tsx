// BasicTableOne.tsx (child) — enhanced product sample data (TSX / TypeScript)
import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";

interface Order {
  id: number;
  sku?: string; // new: stock keeping unit
  category?: string; // new: "Roti" | "Topping" | "Raw Material"
  beratPerUnit?: number; // new: gram per unit (optional)
  user: {
    image: string;
    name: string;
    role: string;
  };
  projectName: number; // RG Dalung
  team: number; // RG Tabanan
  budget: number; // RG Pakerisan
  status: number; // RG MM
  plusone: number; // RG Jimbaran
  plustwo: number; // RG Sesetan
  plusthree: number; // RG Ayani
  plusfour: number; // RG Batubulan
}

const defaultInitialData: Order[] = [
  {
    id: 1,
    sku: "RB-MB-001",
    category: "Roti",
    beratPerUnit: 80,
    user: { image: "/images/user/user-17.jpg", name: "Milk Bun", role: "" },
    projectName: 120, team: 40, budget: 30, status: 60, plusone: 50, plustwo: 45, plusthree: 38, plusfour: 27,
  },
  {
    id: 2,
    sku: "RB-BF-002",
    category: "Roti",
    beratPerUnit: 85,
    user: { image: "/images/user/user-18.jpg", name: "Beef Floss", role: "" },
    projectName: 90, team: 35, budget: 20, status: 55, plusone: 40, plustwo: 36, plusthree: 28, plusfour: 18,
  },
  {
    id: 3,
    sku: "RB-MT-003",
    category: "Roti",
    beratPerUnit: 95,
    user: { image: "/images/user/user-17.jpg", name: "Mentai", role: "" },
    projectName: 60, team: 30, budget: 12, status: 28, plusone: 22, plustwo: 20, plusthree: 18, plusfour: 10,
  },
  {
    id: 4,
    sku: "RB-AB-004",
    category: "Roti",
    beratPerUnit: 88,
    user: { image: "/images/user/user-20.jpg", name: "Almond Butter", role: "" },
    projectName: 48, team: 18, budget: 8, status: 20, plusone: 15, plustwo: 12, plusthree: 10, plusfour: 5,
  },
  {
    id: 5,
    sku: "RB-LB-005",
    category: "Roti",
    beratPerUnit: 82,
    user: { image: "/images/user/user-21.jpg", name: "Lotus Biscoff", role: "" },
    projectName: 72, team: 24, budget: 14, status: 30, plusone: 25, plustwo: 22, plusthree: 19, plusfour: 11,
  },
  {
    id: 6,
    sku: "RB-DC-006",
    category: "Roti",
    beratPerUnit: 78,
    user: { image: "/images/user/user-22.jpg", name: "Double Cheese", role: "" },
    projectName: 50, team: 20, budget: 10, status: 22, plusone: 18, plustwo: 16, plusthree: 14, plusfour: 8,
  },
  {
    id: 7,
    sku: "TP-CM-101",
    category: "Topping",
    beratPerUnit: 15,
    user: { image: "/images/user/user-23.jpg", name: "Cream Cheese (SFG)", role: "" },
    projectName: 200, team: 80, budget: 40, status: 120, plusone: 90, plustwo: 72, plusthree: 60, plusfour: 40,
  },
  {
    id: 8,
    sku: "TP-CH-102",
    category: "Topping",
    beratPerUnit: 10,
    user: { image: "/images/user/user-24.jpg", name: "Chocolate Butter (SFG)", role: "" },
    projectName: 160, team: 60, budget: 30, status: 100, plusone: 70, plustwo: 55, plusthree: 45, plusfour: 30,
  },
  {
    id: 9,
    sku: "RM-YS-201",
    category: "Raw Material",
    beratPerUnit: 1000, // packaged qty (g) for reference
    user: { image: "/images/user/user-25.jpg", name: "Yeast (pack)", role: "" },
    projectName: 5, team: 2, budget: 1, status: 3, plusone: 2, plustwo: 2, plusthree: 1, plusfour: 1,
  },
  {
    id: 10,
    sku: "RM-ML-202",
    category: "Raw Material",
    beratPerUnit: 1000,
    user: { image: "/images/user/user-26.jpg", name: "Milk Powder (kg)", role: "" },
    projectName: 8, team: 3, budget: 2, status: 4, plusone: 3, plustwo: 3, plusthree: 2, plusfour: 2,
  },
  {
    id: 11,
    sku: "RB-CR-011",
    category: "Roti",
    beratPerUnit: 76,
    user: { image: "/images/user/user-27.jpg", name: "Cream Cheese Raisin", role: "" },
    projectName: 34, team: 12, budget: 6, status: 18, plusone: 12, plustwo: 10, plusthree: 8, plusfour: 6,
  },
  {
    id: 12,
    sku: "RB-CN-012",
    category: "Roti",
    beratPerUnit: 90,
    user: { image: "/images/user/user-28.jpg", name: "Cookies and Cream", role: "" },
    projectName: 28, team: 10, budget: 5, status: 16, plusone: 12, plustwo: 10, plusthree: 9, plusfour: 5,
  },
  {
    id: 13,
    sku: "RB-RV-013",
    category: "Roti",
    beratPerUnit: 82,
    user: { image: "/images/user/user-29.jpg", name: "Red Velvet Cream Cheese", role: "" },
    projectName: 40, team: 15, budget: 9, status: 22, plusone: 18, plustwo: 15, plusthree: 12, plusfour: 7,
  },
  {
    id: 14,
    sku: "TP-ST-115",
    category: "Topping",
    beratPerUnit: 5,
    user: { image: "/images/user/user-30.jpg", name: "Strawberry Sprinkles (Topping)", role: "" },
    projectName: 120, team: 48, budget: 24, status: 80, plusone: 60, plustwo: 50, plusthree: 44, plusfour: 28,
  },
  {
    id: 15,
    sku: "RB-CL-015",
    category: "Roti",
    beratPerUnit: 85,
    user: { image: "/images/user/user-31.jpg", name: "Classic Choco Roll", role: "" },
    projectName: 56, team: 20, budget: 10, status: 30, plusone: 24, plustwo: 20, plusthree: 18, plusfour: 12,
  },
];

type BasicTableOneProps = {
  editable?: boolean;
  onChange?: (newData: Order[]) => void;
  highlightDate?: string;
  initialData?: Order[];
  onReady?: (data: Order[]) => void;
  // NEW: receive stock ready map from parent (rowId -> { columnKey: number })
  stockReady?: Record<number, Partial<Record<keyof Order, number>>>;
};

export default function BasicTableOne({
  editable = false,
  onChange,
  highlightDate,
  initialData,
  onReady,
  stockReady = {},
}: BasicTableOneProps) {
  const normalizedInitial = (initialData && initialData.length > 0)
    ? initialData.map((r) => ({
        ...r,
        projectName: Number(r.projectName ?? 0),
        team: Number(r.team ?? 0),
        budget: Number(r.budget ?? 0),
        status: Number(r.status ?? 0),
        plusone: Number(r.plusone ?? 0),
        plustwo: Number(r.plustwo ?? 0),
        plusthree: Number(r.plusthree ?? 0),
        plusfour: Number(r.plusfour ?? 0),
        beratPerUnit: r.beratPerUnit ? Number(r.beratPerUnit) : undefined,
      }))
    : defaultInitialData;

  const [data, setData] = useState<Order[]>(normalizedInitial);
  const [editingCell, setEditingCell] = useState<{
    rowId: number;
    key: keyof Order | null;
  } | null>(null);

  useEffect(() => {
    onChange?.(data);
    onReady?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount

  useEffect(() => {
    onChange?.(data);
  }, [data, onChange]);

  const updateCell = (rowId: number, key: keyof Order, rawValue: string) => {
    const n = rawValue === "" ? 0 : Number(rawValue);
    setData((prev) => {
      const next = prev.map((r) => {
        if (r.id === rowId) {
          return { ...r, [key]: isNaN(n) ? 0 : n } as Order;
        }
        return r;
      });
      return next;
    });
  };

  // EditableCell now shows comparison with stockReady
  const EditableCell: React.FC<{
    row: Order;
    keyName: keyof Order;
  }> = ({ row, keyName }) => {
    const valNum = Number(row[keyName] ?? 0);
    const val = String(row[keyName] ?? "");
    const isActive = editingCell && editingCell.rowId === row.id && editingCell.key === keyName;
    const readyForRow = stockReady[row.id] ?? {};
    const readyVal = Number(readyForRow[keyName] ?? -1);
    const exceeds = readyVal >= 0 ? valNum > readyVal : false;

    return (
      <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
        {editable ? (
          <div className={`relative ${isActive ? "ring-2 ring-yellow-300 rounded" : ""}`}>
            {isActive ? (
              <input
                autoFocus
                type="number"
                className="w-full border rounded px-2 py-1 text-sm"
                value={val}
                onChange={(e) => updateCell(row.id, keyName, e.target.value)}
                onBlur={() => setEditingCell(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    setEditingCell(null);
                  }
                }}
              />
            ) : (
              <div
                className="cursor-pointer"
                onClick={() => setEditingCell({ rowId: row.id, key: keyName })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setEditingCell({ rowId: row.id, key: keyName });
                  }
                }}
              >
                <span>{val}</span>
              </div>
            )}

            {/* Comparison UI */}
            {readyVal >= 0 && (
              <div className="mt-1 text-xs">
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${exceeds ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                  {valNum} / {readyVal} ready
                </span>
                {exceeds && <span className="ml-2 text-xs text-red-600">Melebihi stock!</span>}
              </div>
            )}
          </div>
        ) : (
          <div>
            <span>{val}</span>
            {readyVal >= 0 && (
              <div className="mt-1 text-xs">
                {/* <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${exceeds ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                  {valNum} / {readyVal} ready
                </span> */}
              </div>
            )}
          </div>
        )}
      </TableCell>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                Produk
              </TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">RG Dalung</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">RG Tabanan</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">RG Pakerisan</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">RG MM</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">RG Jimbaran</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">RG Sesetan</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">RG Ayani</TableCell>
              <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">RG Batubulan</TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {data.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="px-5 py-4 sm:px-6 text-start">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">{order.user.name}</span>
                      {/* small product meta line (SKU / berat) */}
                      <div className="text-xs text-gray-500">
                        {order.sku ? <span className="mr-3">SKU: {order.sku}</span> : null}
                        {order.category ? <span className="mr-3">({order.category})</span> : null}
                        {typeof order.beratPerUnit === "number" ? <span>{order.beratPerUnit} g</span> : null}
                      </div>
                    </div>
                  </div>
                </TableCell>

                <EditableCell row={order} keyName={"projectName"} />
                <EditableCell row={order} keyName={"team"} />
                <EditableCell row={order} keyName={"budget"} />
                <EditableCell row={order} keyName={"status"} />
                <EditableCell row={order} keyName={"plusone"} />
                <EditableCell row={order} keyName={"plustwo"} />
                <EditableCell row={order} keyName={"plusthree"} />
                <EditableCell row={order} keyName={"plusfour"} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
