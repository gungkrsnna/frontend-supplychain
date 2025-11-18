import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

type DOItem = { item_id:number; item_name?:string; qty:number; };

export default function DeliveryPrint(): JSX.Element {
  const { id } = useParams<{ id:string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) fetchData(); }, [id]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/delivery/${id}`);
      const j = await res.json();
      if (j.success) setData(j.data);
      else setData(null);
    } catch (e) { console.error(e); setData(null); }
    finally { setLoading(false); }
  }

  async function doPrint() {
    if (!data) return;
    // mark printed on backend and reload full info
    const res = await fetch(`${API_BASE}/api/marketing/delivery/${id}/print`, { method: 'POST' });
    const j = await res.json();
    if (j.success) {
      setData(j.data);
      window.print();
    } else {
      alert("Gagal print: " + (j.message || ""));
    }
  }

  if (loading) return <div style={{padding:20}}>Memuat...</div>;
  if (!data) return <div style={{padding:20}}>Tidak ada data</div>;

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h2>Surat Jalan — {data.no_surat_jalan ?? `DO-${data.id}`}</h2>
        <div>
          <button onClick={doPrint} style={{marginRight:8}}>🖨 Print & Mark Printed</button>
          <button onClick={()=>navigate(-1)}>Kembali</button>
        </div>
      </div>

      <section style={{marginTop:12}}>
        <strong>Run ID:</strong> {data.kitchen_run_id} <br/>
        <strong>Tujuan (store id):</strong> {data.destination_store_id ?? '-'} <br/>
        <strong>Status:</strong> {data.status} <br/>
        <strong>Created:</strong> {data.created_at ?? '-'}
      </section>

      <section style={{marginTop:12}}>
        <h4>Items</h4>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{background:"#fafafa"}}><tr><th>Item</th><th style={{textAlign:'right'}}>Qty</th></tr></thead>
          <tbody>
            {(data.items || []).map((it:DOItem, idx:number)=>(
              <tr key={idx} style={{borderBottom:"1px solid #eee"}}>
                <td style={{padding:8}}>{it.item_name ?? `#${it.item_id}`}</td>
                <td style={{padding:8,textAlign:'right'}}>{it.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{marginTop:12}}>
        <h4>Catatan Print</h4>
        <p>{data.printed_at ? `Printed at ${data.printed_at}` : 'Belum dicetak'}</p>
      </section>
    </div>
  );
}
