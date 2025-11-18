import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000";

type Run = { id:number; date:string; status:string; };

export default function QcList(): JSX.Element {
  const [date, setDate] = useState<string>(() => {
    const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  });
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchRuns(); }, [date]);

  async function fetchRuns() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/marketing/runs/ready?date=${date}`);
      const j = await res.json();
      if (j.success) setRuns(j.data || []);
      else setRuns([]);
    } catch (e) { console.error(e); setRuns([]); }
    finally { setLoading(false); }
  }

  async function createDelivery(runId:number) {
    if (!confirm("Buat surat jalan untuk run id " + runId + " ?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/marketing/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitchen_run_id: runId }),
      });
      const j = await res.json();
      if (j.success) {
        alert("Surat jalan dibuat: " + j.data.no_surat_jalan);
        navigate(`/marketing/delivery/${j.data.id}`);
      } else {
        alert("Gagal: " + (j.message || ""));
      }
    } catch (err) {
      console.error(err);
      alert("Gagal membuat surat jalan");
    }
  }

  return (
    <div style={{padding:20}}>
      <h2>Marketing — Surat Jalan (Ready from QC)</h2>
      <div style={{marginBottom:12}}>
        <label>Tanggal: <input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
        <button onClick={fetchRuns} style={{marginLeft:8}}>{loading?"Memuat...":"Refresh"}</button>
      </div>

      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead style={{background:"#fafafa"}}><tr><th>Run ID</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>
          {runs.length===0 && <tr><td colSpan={4} style={{padding:8}}>Tidak ada run</td></tr>}
          {runs.map(r=>(
            <tr key={r.id}><td style={{padding:8}}>{r.id}</td><td style={{padding:8}}>{r.date}</td><td style={{padding:8}}>{r.status}</td>
              <td style={{padding:8}}>
                <button onClick={()=>navigate(`/marketing/delivery/create/${r.id}`)}>Buat Surat Jalan</button>
                <button onClick={()=>navigate(`/kitchen/calc/${r.date}`)} style={{marginLeft:8}}>Lihat Kalkulasi</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
