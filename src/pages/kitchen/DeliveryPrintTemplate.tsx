import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

type DOItem = {
  id?: number;
  item_id?: number;
  item_name?: string;
  qty?: number;
};

type Delivery = {
  id: number;
  no_surat_jalan?: string | null;
  kitchen_run_id?: number;
  destination_store_id?: number | null;
  status?: string;
  created_at?: string;
  printed_at?: string | null;
  items?: DOItem[];
  // optional nested run / store / created_by info if backend provides
  run?: { id?: number; date?: string };
};

export default function DeliveryPrintTemplate(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [printing, setPrinting] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/delivery/${id}`);
      const j = await res.json();
      if (j && j.success && j.data) {
        setData(j.data);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error("fetch delivery:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function doPrintAndMark() {
    if (!data) return;
    setPrinting(true);
    try {
      // call backend print endpoint which will set printed_at & status
      const res = await fetch(`${API_BASE}/api/marketing/delivery/${data.id}/print`, { method: "POST" });
      const j = await res.json();
      if (j && j.success && j.data) {
        setData(j.data);
        // small delay to render printed_at, then call window.print
        setTimeout(() => {
          window.print();
        }, 300);
      } else {
        alert("Gagal menandai print: " + (j?.message || ""));
      }
    } catch (err) {
      console.error("print:", err);
      alert("Gagal print (cek console).");
    } finally {
      setPrinting(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 20 }}>Memuat surat jalan…</div>;
  }
  if (!data) {
    return <div style={{ padding: 20 }}>Surat jalan tidak ditemukan.</div>;
  }

  // calculate total qty
  const totalQty = (data.items || []).reduce((s, it) => s + (Number(it.qty || 0)), 0);

  return (
    <div style={{ padding: 18, fontFamily: "Inter, Helvetica, Arial, sans-serif", color: "#111" }}>
      {/* Print-specific styles */}
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #print-root, #print-root * { visibility: visible; }
            #print-root { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 12mm; }
          }
          /* general table styling */
          .sj-table { width: 100%; border-collapse: collapse; }
          .sj-table th, .sj-table td { border: 1px solid #e6e6e6; padding: 8px; font-size: 13px; }
          .sj-table th { background: #f7f7f7; text-align: left; font-weight: 600; }
          .kop { display:flex; gap:12px; align-items:center; }
          .company { font-size: 18px; font-weight:700; }
          .muted { color: #555; font-size: 13px; }
        `}
      </style>

      {/* Action bar (not printed) */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate(-1)} className="btn" style={{ padding: "8px 10px" }}>← Kembali</button>
          <button onClick={() => window.print()} className="btn" style={{ padding: "8px 10px" }}>Preview Print</button>
          <button onClick={doPrintAndMark} disabled={printing} className="btn" style={{ padding: "8px 10px", background: "#0ea5a4", color:"#fff", border: "none" }}>
            {printing ? "Memproses..." : "Print & Mark Printed"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ textAlign: "right" }} className="muted">
            <div>No. DO: <strong>{data.no_surat_jalan ?? `DO-${String(data.id)}`}</strong></div>
            <div>Tanggal: <strong>{data.created_at ? new Date(data.created_at).toLocaleString() : new Date().toLocaleString()}</strong></div>
            <div>Status: <strong>{data.status ?? "-"}</strong></div>
          </div>
        </div>
      </div>

      {/* Printable root */}
      <div id="print-root" style={{ background: "#fff", padding: 18 }}>
        {/* Header / Kop surat jalan */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div className="kop">
            {/* Logo area: replace src with your logo path if available */}
            <div style={{ width: 88, height: 88, borderRadius: 6, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#9ca3af" }}>
              LOGO
            </div>
            <div style={{ marginLeft: 6 }}>
              <div className="company">Nama Perusahaan Anda</div>
              <div className="muted">Jl. Alamat Perusahaan No. 123 — Kota — Provinsi</div>
              <div className="muted">Telp: 0812-xxxx-xxxx • Email: ops@perusahaan.co</div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>SURAT JALAN</div>
            <div style={{ marginTop: 6 }} className="muted">DO Number</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{data.no_surat_jalan ?? `DO-${data.id}`}</div>
            <div style={{ marginTop: 6 }} className="muted">Tanggal</div>
            <div>{data.created_at ? new Date(data.created_at).toLocaleString() : new Date().toLocaleString()}</div>
          </div>
        </header>

        {/* Destination / run info */}
        <section style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Kepada (Tujuan)</div>
            <div className="muted">Store ID: {data.destination_store_id ?? "-"}</div>
            {/* if you have store details, show them here */}
          </div>

          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Run & Info</div>
            <div className="muted">Run ID: {data.kitchen_run_id ?? "-"}</div>
            <div className="muted">Status: {data.status ?? "-"}</div>
            <div className="muted">Printed At: {data.printed_at ? new Date(data.printed_at).toLocaleString() : "-"}</div>
          </div>
        </section>

        {/* Items table */}
        <section>
          <table className="sj-table" style={{ marginBottom: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 48 }}>No.</th>
                <th>Item</th>
                <th style={{ width: 120, textAlign: "right" }}>Qty</th>
                <th style={{ width: 160 }}>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {(data.items && data.items.length > 0) ? data.items.map((it, idx) => (
                <tr key={it.id ?? `${it.item_id}-${idx}`}>
                  <td style={{ textAlign: "center" }}>{idx + 1}</td>
                  <td>{it.item_name ?? `#${it.item_id}`}</td>
                  <td style={{ textAlign: "right" }}>{it.qty ?? 0}</td>
                  <td>{/* optional notes per item */}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} style={{ padding: 12 }}>Tidak ada item.</td>
                </tr>
              )}
              {/* total row */}
              <tr>
                <td colSpan={2} style={{ textAlign: "right", fontWeight: 700 }}>Total</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{totalQty}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Footer: signatures */}
        <section style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 40 }}>Dibuat oleh</div>
            <div style={{ height: 60, borderBottom: "1px solid #e6e6e6" }}></div>
            <div style={{ marginTop: 6 }} className="muted">Nama & Ttd</div>
          </div>

          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 40 }}>Diperiksa</div>
            <div style={{ height: 60, borderBottom: "1px solid #e6e6e6" }}></div>
            <div style={{ marginTop: 6 }} className="muted">QC / Penerima</div>
          </div>

          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 40 }}>Supir / Pengantar</div>
            <div style={{ height: 60, borderBottom: "1px solid #e6e6e6" }}></div>
            <div style={{ marginTop: 6 }} className="muted">Nama & Ttd</div>
          </div>
        </section>

        <footer style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
          <div>Catatan: Simpan salinan surat jalan ini sebagai bukti pengiriman.</div>
        </footer>
      </div>
    </div>
  );
}
