// src/pages/kitchen/DeliveryNote.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type TargetsPayload = {
  meta?: { target_date?: string; note?: string; status?: string };
  products?: { productName: string; totals: Record<string, number>; grandTotal?: number }[];
  summaryPerLocation?: Record<string, number>;
  materials?: {
    dough?: Record<string, { qty: number; unit: string }>;
    filling?: Record<string, { qty: number; unit: string }>;
    topping?: Record<string, { qty: number; unit: string }>;
    rawMaterials?: Record<string, { qty: number; unit: string }>;
  };
};

type KitchenState = any;

const KEY_TARGETS = "lastKitchenTargets";
const KEY_KITCHEN = "lastKitchenState_v1";
const MAX_ROWS = 39;

function formatDateISO(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function DeliveryNote(): JSX.Element {
  const navigate = useNavigate();
  const [targets, setTargets] = useState<TargetsPayload | null>(null);
  const [kitchen, setKitchen] = useState<KitchenState | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    try {
      const rawT = sessionStorage.getItem(KEY_TARGETS);
      const rawK = sessionStorage.getItem(KEY_KITCHEN);
      const parsedT: TargetsPayload | null = rawT ? JSON.parse(rawT) : null;
      const parsedK: KitchenState | null = rawK ? JSON.parse(rawK) : null;
      setTargets(parsedT);
      setKitchen(parsedK);
      setNote(parsedT?.meta?.note ?? "");
      const locs = Object.keys(parsedT?.summaryPerLocation ?? {});
      setSelectedLocation(locs.length ? locs[0] : null);
    } catch (err) {
      console.warn("DeliveryNote: failed to parse session storage", err);
    }
  }, []);

  const toppingNames = useMemo(() => {
    const t: string[] = [];
    if (targets?.materials?.topping) {
      Object.keys(targets.materials.topping).forEach((k) => t.push(k.toLowerCase()));
    }
    return new Set(t);
  }, [targets]);

  // Build rows for the selected location
  const productRows = useMemo(() => {
    if (!targets || !selectedLocation) return [];
    const rows: {
      productName: string;
      category: string;
      sku?: string;
      beratPerUnit?: string | number | null;
      qty: number;
      unit?: string;
      deliveryNote?: string;
      penerima?: string;
    }[] = [];

    for (const p of targets.products ?? []) {
      const qty = Number(p.totals?.[selectedLocation] ?? 0);
      // skip zero qty items by default (but you can include if needed)
      if (!qty || qty <= 0) continue;
      const nameLower = (p.productName ?? "").toLowerCase();
      const isTopping = Array.from(toppingNames).some((tk) => nameLower.includes(tk) || p.productName?.toLowerCase().includes("topping"));
      const category = isTopping ? "Topping" : "Roti";
      rows.push({
        productName: p.productName,
        category,
        sku: "",
        beratPerUnit: "", // unknown here; can be filled if recipe provides
        qty,
        unit: "pcs",
        deliveryNote: "",
        penerima: "",
      });
    }

    // Optionally, include Topping-only materials that aren't in products (rare)
    // For clarity we keep just product list.

    return rows;
  }, [targets, selectedLocation, toppingNames]);

  // Ensure table always has MAX_ROWS rows (pad with empty)
  const tableRows = useMemo(() => {
    const out = [...productRows];
    while (out.length < MAX_ROWS) out.push({
      productName: "",
      category: "",
      sku: "",
      beratPerUnit: "",
      qty: 0,
      unit: "",
      deliveryNote: "",
      penerima: "",
    });
    return out.slice(0, MAX_ROWS);
  }, [productRows]);

  const totalQty = useMemo(() => productRows.reduce((s, r) => s + (Number(r.qty) || 0), 0), [productRows]);

  const handlePrint = () => {
    // before print, write any last-minute notes to session or state if needed
    window.print();
  };

  if (!targets) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-3">Surat Jalan</h2>
        <div>Tidak ada data target produksi (lastKitchenTargets). Pastikan batch telah dikirim ke Kitchen.</div>
        <div className="mt-3">
          <button className="px-3 py-1 bg-indigo-600 text-white rounded mr-2" onClick={() => navigate("/kitchen")}>Ke Kitchen</button>
        </div>
      </div>
    );
  }

  const locations = Object.keys(targets.summaryPerLocation ?? {});
  const printedDate = formatDateISO(targets.meta?.target_date ?? new Date().toISOString());

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">SURAT JALAN</h1>
          <div className="mt-1 text-sm">Nomor Order# <strong>{targets.meta?.status ?? `AUTO-${targets.meta?.target_date ?? ""}`}</strong></div>
        </div>

        <div className="flex gap-2">
          <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => navigate(-1)}>Back</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handlePrint}>Print / PDF</button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Store</label>
        <div className="flex items-center gap-3">
          <select
            value={selectedLocation ?? ""}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-2 py-1 border rounded"
          >
            {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          <div className="text-sm text-gray-600">Tanggal Pengiriman: <strong>{printedDate}</strong></div>
        </div>
      </div>

      {/* Printable area */}
      <div id="delivery-note" className="border p-4 bg-white" style={{ color: "#000" }}>
        {/* Header area */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ width: "60%" }}>
            <h2 style={{ margin: 0 }}>{/* Optional left title */}</h2>
            <div style={{ fontSize: 14, marginTop: 6 }}>
              <div><strong>Nama Toko / Store:</strong> {selectedLocation}</div>
              <div><strong>Keterangan:</strong> {note || "-"}</div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ border: "1px solid #000", padding: "8px 14px", marginBottom: 6, display: "inline-block" }}>SFG</div>
            <div style={{ border: "1px solid #000", padding: "8px 14px", display: "inline-block", marginLeft: 8 }}>RGSE</div>
            <div style={{ marginTop: 8, fontSize: 12 }}>Tanggal: <strong>{printedDate}</strong></div>
          </div>
        </div>

        {/* Table */}
        <div style={{ marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #000", padding: "6px", width: 30 }}>No</th>
                <th style={{ border: "1px solid #000", padding: "6px", width: 80 }}>SKU</th>
                <th style={{ border: "1px solid #000", padding: "6px", width: 80 }}>Category</th>
                <th style={{ border: "1px solid #000", padding: "6px" }}>Nama Barang</th>
                <th style={{ border: "1px solid #000", padding: "6px", width: 80 }}>Berat Per Unit</th>
                <th style={{ border: "1px solid #000", padding: "6px", width: 80 }}>Qty</th>
                <th style={{ border: "1px solid #000", padding: "6px", width: 80 }}>Unit</th>
                <th style={{ border: "1px solid #000", padding: "6px", width: 120 }}>Delivery</th>
                <th style={{ border: "1px solid #000", padding: "6px", width: 120 }}>Penerima</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, idx) => (
                <tr key={idx}>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>{r.sku || ""}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", color: r.category ? "#666" : undefined }}>{r.category}</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>{r.productName}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{r.beratPerUnit ?? ""}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{r.qty || ""}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{r.unit || ""}</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>{r.deliveryNote || ""}</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>{r.penerima || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <div style={{ marginTop: 12 }}>
          <div style={{ border: "1px solid #000", minHeight: 48, padding: 8 }}>
            <strong>Catatan / Ketidaksesuaian:</strong>
            <div style={{ marginTop: 6 }}>{/* empty area for notes */}</div>
          </div>
        </div>

        {/* Footer signatures */}
        <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "space-between" }}>
          <div style={{ textAlign: "center", width: "30%" }}>
            <div>Pengirim</div>
            <div style={{ height: 64 }} />
            <div>Kitchen / Team Leader</div>
          </div>

          <div style={{ textAlign: "center", width: "30%" }}>
            <div>Delivery</div>
            <div style={{ height: 64 }} />
            <div>Driver</div>
          </div>

          <div style={{ textAlign: "center", width: "30%" }}>
            <div>Penerima</div>
            <div style={{ height: 64 }} />
            <div>Store Staff</div>
          </div>
        </div>

        {/* small totals */}
        <div style={{ marginTop: 12, fontSize: 12 }}>
          <div><strong>Total Item (sum qty):</strong> {totalQty}</div>
        </div>
      </div>

      {/* Print notes */}
      <div className="text-xs text-gray-500 mt-4">
        - Pastikan jumlah sesuai sebelum mencetak surat jalan. <br />
        - Jika perlu ubah catatan atau penerima, edit di sistem sebelum mencetak.
      </div>

      {/* Print-only CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #delivery-note, #delivery-note * { visibility: visible; }
          #delivery-note { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
