// BasicTableOne.tsx (child)
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
  user: {
    image: string;
    name: string;
    role: string;
  };
  projectName: number;
  team: number;
  budget: number;
  status: number;
  plusone: number;
  plustwo: number;
  plusthree: number;
  plusfour: number;
}

const defaultInitialData: Order[] = [
  // ... same defaults as before ...
  {
    id: 1,
    user: { image: "/images/user/user-17.jpg", name: "Milk Bun", role: "" },
    projectName: 32, team: 12, budget: 9, status: 40, plusone: 20, plustwo: 31, plusthree: 29, plusfour: 21,
  },
  {
    id: 2,
    user: { image: "/images/user/user-18.jpg", name: "Beef Floss", role: "" },
    projectName: 32, team: 12, budget: 9, status: 40, plusone: 20, plustwo: 31, plusthree: 29, plusfour: 21,
  },
  {
    id: 3,
    user: { image: "/images/user/user-17.jpg", name: "Mentai", role: "" },
    projectName: 32, team: 12, budget: 9, status: 40, plusone: 20, plustwo: 31, plusthree: 29, plusfour: 21,
  },
  {
    id: 4,
    user: { image: "/images/user/user-20.jpg", name: "Almond Butter", role: "" },
    projectName: 32, team: 12, budget: 9, status: 40, plusone: 20, plustwo: 31, plusthree: 29, plusfour: 21,
  },
  {
    id: 5,
    user: { image: "/images/user/user-21.jpg", name: "Lotus Biscoff", role: "" },
    projectName: 32, team: 12, budget: 9, status: 40, plusone: 20, plustwo: 31, plusthree: 29, plusfour: 21,
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

export default function BasicTableOneCopy({
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
