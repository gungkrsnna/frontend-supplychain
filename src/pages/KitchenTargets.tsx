// src/pages/KitchenTargets.tsx
import React, { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from '../context/AuthContext'; // adjust path

export default function KitchenTargetsPage() {
  const [payload, setPayload] = useState<any | null>(null);
  const navigate = useNavigate();
  const { authFetch } = useContext(AuthContext);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem("lastKitchenTargets") : null;
    if (raw) {
      try {
        setPayload(JSON.parse(raw));
      } catch {
        setPayload(null);
      }
    }
  }, []);

    const sendToKitchen = async () => {
    const raw = sessionStorage.getItem("lastKitchenTargets");
    if (!raw) {
      alert("Tidak ada target produksi untuk dikirim ke kitchen.");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      alert("Data target rusak.");
      return;
    }

    // add timestamp
    payload.sentToKitchenAt = new Date().toISOString();

    // prefer saving to server
    try {
      // prepare body: batch_id (gunakan target_date atau generate uuid), payload and meta
      const batchId = payload.meta?.target_date || `batch_${Date.now()}`;
      const body = {
        batch_id: batchId,
        payload,
        meta: payload.meta || {}
      };

      // use authFetch so token is included. fallback to normal fetch
      const res = typeof authFetch === 'function'
        ? await authFetch('/api/kitchen/targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        : await fetch('http://localhost:3000/api/kitchen/targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('save target error', err);
        alert('Gagal menyimpan target ke server. Data akan disimpan lokal.');
        // still save locally
        sessionStorage.setItem('lastKitchenTargets', JSON.stringify(payload));
        navigate('/kitchen');
        return;
      }

      const json = await res.json();
      // success: update local storage to reflect saved id / created_at if needed
      sessionStorage.setItem('lastKitchenTargets', JSON.stringify(payload));
      alert('Target berhasil dikirim ke kitchen.');
      navigate('/kitchen');
    } catch (err) {
      console.error('Network error saving target', err);
      alert('Gagal koneksi ke server. Data tersimpan lokal.');
      sessionStorage.setItem('lastKitchenTargets', JSON.stringify(payload));
      navigate('/kitchen');
    }
  };

  const locations = useMemo(() => Object.keys(payload?.summaryPerLocation ?? {}), [payload]);

  if (!payload) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">Kitchen Targets</h2>
        <div>Tidak ada data target produksi. Tekan "Process" di halaman Target Production.</div>
      </div>
    );
  }

  const { products, summaryPerLocation, materials } = payload as any;

  const renderMaterialsTable = (title: string, bucket: Record<string, { qty: number; unit: string }>) => {
    const rows = Object.entries(bucket || {}).sort((a, b) => b[1].qty - a[1].qty);
    return (
      <div className="mb-6">
        <h3 className="font-semibold mb-2">{title}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 border text-left">Bahan</th>
                <th className="p-2 border text-right">Total</th>
                <th className="p-2 border text-left">Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, info]) => (
                <tr key={name} className="hover:bg-gray-50">
                  <td className="p-2 border">{name}</td>
                  <td className="p-2 border text-right">{Number(info.qty.toFixed ? info.qty.toFixed(2) : info.qty)}</td>
                  <td className="p-2 border">{info.unit}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="p-2 border" colSpan={3}>-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Kitchen Targets — {payload.meta?.target_date}</h2>
        <div className="text-sm text-gray-600">{payload.meta?.note}</div>
       <button
        className="px-3 py-1 bg-indigo-600 text-white rounded"
        onClick={sendToKitchen}
        >
        Send to Kitchen / Start Production
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border mb-6">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 border text-left">Product</th>
              {locations.map((loc) => (
                <th key={loc} className="p-2 border text-center">{loc}</th>
              ))}
              <th className="p-2 border text-right">Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => (
              <tr key={p.productName} className="hover:bg-gray-50">
                <td className="p-2 border">{p.productName}</td>
                {locations.map((loc) => (
                  <td key={loc} className="p-2 border text-right">{p.totals[loc] ?? 0}</td>
                ))}
                <td className="p-2 border text-right">{p.grandTotal}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100">
              <td className="p-2 border font-semibold">TOTAL</td>
              {locations.map((loc) => (
                <td key={loc} className="p-2 border text-right font-semibold">{summaryPerLocation[loc] ?? 0}</td>
              ))}
              <td className="p-2 border text-right font-semibold">{products.reduce((s: number, p: any) => s + (p.grandTotal ?? 0), 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Materials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>{renderMaterialsTable("Dough (gram)", materials.dough)}</div>
        <div>{renderMaterialsTable("Filling (gram)", materials.filling)}</div>
        <div>{renderMaterialsTable("Topping (gram/pcs)", materials.topping)}</div>
        <div>{renderMaterialsTable("Raw Materials (gram/pcs)", materials.rawMaterials)}</div>
      </div>
    </div>
  );
}
