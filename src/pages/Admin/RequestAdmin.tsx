// RequestAdmin.tsx (with Surat Jalan / delivery note printable)
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import { useNavigate } from "react-router-dom";

type RequestItem = {
  id: number;
  name: string; // nama barang
  qty: number;
  unit?: string;
  note?: string;
};

type Store = { id: number; name: string; branch_code?: string };

type StoreRequest = {
  id: number;
  store: Store;
  items: RequestItem[];
  status: "pending" | "approved" | "rejected";
  requested_by?: { id?: number; name?: string };
  note?: string;
  created_at: string; // ISO
  updated_at?: string;
  reject_reason?: string | null;
  approved_by?: { id?: number; name?: string } | null; // optional approver info
  approved_at?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const USE_DUMMY = true;

/** Dummy inventory (for previous logic) */
type DummyInvItem = { id: string; product_name: string; qty: number; unit?: string; min_stock?: number; note?: string };
const DUMMY_INVENTORY: Record<number, DummyInvItem[]> = {
  1: [
    { id: "inv-1-001", product_name: "Sabun Cuci", qty: 10, unit: "pcs", min_stock: 2 },
    { id: "inv-1-002", product_name: "Lap Kain", qty: 20, unit: "pcs", min_stock: 5 },
  ],
  2: [{ id: "inv-2-001", product_name: "Plastik Sampah", qty: 5, unit: "pack", min_stock: 1 }],
  3: [{ id: "inv-3-001", product_name: "Tisu", qty: 30, unit: "pcs", min_stock: 5 }],
};

const DUMMY_STORES: Store[] = [
  { id: 1, name: "Roti Goolung Semarang", branch_code: "SMG" },
  { id: 2, name: "Roti Goolung Dalung", branch_code: "DLG" },
  { id: 3, name: "Roti Goolung Tabanan", branch_code: "TKJ" },
];

const DUMMY_REQUESTS: StoreRequest[] = [
  {
    id: 101,
    store: DUMMY_STORES[0],
    items: [
      { id: 1, name: "Sabun Cuci", qty: 5, unit: "pcs", note: "Untuk dapur kecil" },
      { id: 2, name: "Lap Kain", qty: 10, unit: "pcs" },
    ],
    status: "pending",
    requested_by: { id: 10, name: "Agus" },
    note: "Keperluan kebersihan",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 102,
    store: DUMMY_STORES[1],
    items: [{ id: 3, name: "Plastik Sampah", qty: 2, unit: "pack" }],
    status: "approved",
    requested_by: { id: 11, name: "Sari" },
    note: "",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    approved_by: { id: 99, name: "Admin" },
    approved_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

function clone<T>(v: T) {
  return JSON.parse(JSON.stringify(v)) as T;
}

export default function RequestAdmin(): JSX.Element {
  const [requests, setRequests] = useState<StoreRequest[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // UI/filter state
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<number | "all">("all");
  const [selectedRequest, setSelectedRequest] = useState<StoreRequest | null>(null);
  const [showModal, setShowModal] = useState(false);

  // bulk selection & reject modal
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>("");

  // loading states
  const [actionLoading, setActionLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // SURAT JALAN: track last generated (optional)
  const [lastGeneratedSJFor, setLastGeneratedSJFor] = useState<number | null>(null);

  const navigate = useNavigate();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (USE_DUMMY) {
        await new Promise((r) => setTimeout(r, 100));
        setRequests(clone(DUMMY_REQUESTS));
        setStores(clone(DUMMY_STORES));
      } else {
        const res = await fetch("/api/requests");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: StoreRequest[] = await res.json();
        setRequests(data || []);
        const uniqStores = Array.from(new Map((data || []).map((r) => [r.store.id, r.store])).values());
        setStores(uniqStores);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Gagal memuat data request");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const grouped = useMemo(() => {
    const map = new Map<number, { store: Store; requests: StoreRequest[] }>();
    (requests || []).forEach((r) => {
      if (!map.has(r.store.id)) map.set(r.store.id, { store: r.store, requests: [] });
      map.get(r.store.id)!.requests.push(r);
    });
    return Array.from(map.values());
  }, [requests]);

  const matchesSearch = useCallback(
    (r: StoreRequest) => {
      if (!search || search.trim() === "") return true;
      const q = search.toLowerCase();
      if (String(r.id).toLowerCase().includes(q)) return true;
      if (r.requested_by?.name?.toLowerCase().includes(q)) return true;
      if (r.items.some((it) => it.name.toLowerCase().includes(q))) return true;
      return false;
    },
    [search]
  );

  const filteredRequestsForStore = useCallback(
    (storeId: number) => {
      const group = grouped.find((g) => g.store.id === storeId);
      if (!group) return [];
      let list = group.requests.slice();
      if (selectedStoreId !== "all" && selectedStoreId !== storeId) return [];
      if (filterStatus !== "all") {
        list = list.filter((r) => r.status === filterStatus);
      }
      list = list.filter((r) => matchesSearch(r));
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    [grouped, filterStatus, matchesSearch, selectedStoreId]
  );

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) : "-";

  const openRequestModal = (req: StoreRequest) => {
    setSelectedRequest(req);
    setShowModal(true);
  };
  const closeModal = () => {
    setSelectedRequest(null);
    setShowModal(false);
  };

  // ----- SURAT JALAN helpers -----
  // Generate HTML for surat jalan (string)
  const renderSuratJalanHtml = (req: StoreRequest) => {
    const title = "SURAT JALAN";
    const date = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
    const itemsRows = req.items
      .map((it, idx) => `<tr>
        <td style="padding:6px;border:1px solid #333;text-align:left">${idx + 1}</td>
        <td style="padding:6px;border:1px solid #333;text-align:left">${escapeHtml(it.name)}</td>
        <td style="padding:6px;border:1px solid #333;text-align:center">${it.qty}</td>
        <td style="padding:6px;border:1px solid #333;text-align:left">${escapeHtml(it.unit ?? "-")}</td>
        <td style="padding:6px;border:1px solid #333;text-align:left">${escapeHtml(it.note ?? "-")}</td>
      </tr>`).join("");

    const approvedBy = req.approved_by ? `${escapeHtml(req.approved_by.name)} (${req.approved_by.id ?? "-"})` : "-";
    const approvedAt = req.approved_at ? fmtDate(req.approved_at) : "-";

    return `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>${title} - Request #${req.id}</title>
        <style>
          body { font-family: Arial, sans-serif; color:#111; padding:20px; }
          .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
          h1 { margin:0; font-size:20px; }
          .meta { font-size:13px; color:#333; }
          table { border-collapse: collapse; width:100%; margin-top:10px; }
          th { padding:8px; border:1px solid #333; background:#f5f5f5; text-align:left; }
          td { padding:6px; border:1px solid #333; vertical-align:top; }
          .sign { margin-top:28px; display:flex; justify-content:space-between; gap:20px; }
          .sign .box { width:45%; text-align:center; padding-top:40px; }
          .small { font-size:12px; color:#555; }
          .print-btn { display:inline-block; margin-top:12px; padding:8px 12px; background:#0b74de; color:#fff; border-radius:4px; text-decoration:none }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${title}</h1>
            <div class="meta">Request #: ${req.id} — Store: ${escapeHtml(req.store.name)} (${req.store.branch_code ?? "-"})</div>
            <div class="meta">Requested by: ${escapeHtml(req.requested_by?.name ?? "-")} — ${fmtDate(req.created_at)}</div>
          </div>
          <div style="text-align:right">
            <div class="meta">Approved by: ${approvedBy}</div>
            <div class="meta">Approved at: ${approvedAt}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:6%">No</th>
              <th style="width:48%">Nama Barang</th>
              <th style="width:12%">Qty</th>
              <th style="width:12%">Satuan</th>
              <th style="width:22%">Catatan</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="sign">
          <div class="box">
            <div class="small">Diserahkan oleh (Admin / Boatman)</div>
            <div style="height:48px"></div>
            <div>________________________</div>
          </div>
          <div class="box">
            <div class="small">Diterima oleh (Penerima di Store)</div>
            <div style="height:48px"></div>
            <div>________________________</div>
          </div>
        </div>

        <div style="margin-top:16px" class="small">Catatan: ${escapeHtml(req.note ?? "-")}</div>

        <div style="margin-top:10px">
          <a href="#" onclick="window.print(); return false;" class="print-btn">Print Surat Jalan</a>
        </div>
      </body>
      </html>
    `;
  };

  // escape helper to avoid HTML injection
  const escapeHtml = (unsafe: string) => {
    return (unsafe || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  // open new window with surat jalan content
  const openSuratJalanWindow = (req: StoreRequest) => {
    const html = renderSuratJalanHtml(req);
    const win = window.open("", `_suratjalan_${req.id}`, "width=900,height=700,scrollbars=yes");
    if (!win) {
      alert("Blocked by popup blocker — izinkan popup untuk domain ini agar dapat mencetak surat jalan.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setLastGeneratedSJFor(req.id);
  };

  // ----- existing logic: approval, reject, bulk etc. (kept from previous implementation) -----
  // For brevity code here replicates earlier working functions (optimistic update, dummy inventory check, bulk actions).
  // We'll include same functions but ensure when status becomes 'approved' we set approved_by/approved_at
  const checkAndAdjustDummyInventoryForApproval = useCallback((req: StoreRequest) => {
    const storeInv = DUMMY_INVENTORY[req.store.id] ?? [];
    const insufficient: { name: string; need: number; have: number }[] = [];

    for (const it of req.items) {
      const inv = storeInv.find((x) => x.product_name.toLowerCase() === it.name.toLowerCase());
      const have = inv ? inv.qty : 0;
      if (have < it.qty) insufficient.push({ name: it.name, need: it.qty, have });
    }

    if (insufficient.length > 0) {
      return { ok: false, insufficient };
    }

    for (const it of req.items) {
      const inv = storeInv.find((x) => x.product_name.toLowerCase() === it.name.toLowerCase());
      if (inv) {
        inv.qty = Math.max(0, inv.qty - it.qty);
      } else {
        storeInv.push({ id: `inv-${req.store.id}-${Date.now()}-${Math.random()}`, product_name: it.name, qty: Math.max(0, 0 - it.qty), unit: it.unit, min_stock: 0 });
      }
    }
    DUMMY_INVENTORY[req.store.id] = storeInv;
    return { ok: true, insufficient: [] };
  }, []);

  const updateRequestStatus = useCallback(
    async (requestId: number, action: "approve" | "reject", opts?: { reason?: string }) => {
      if (actionLoading) return;
      setActionLoading(true);
      const prevSnapshot = clone(requests);

      // optimistic update: set approved_by / approved_at when approve
      setRequests((prevList) =>
        prevList.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: action === "approve" ? "approved" : "rejected",
                updated_at: new Date().toISOString(),
                reject_reason: opts?.reason ?? (action === "reject" ? opts?.reason ?? null : r.reject_reason ?? null),
                approved_by: action === "approve" ? { id: 1, name: "Admin" } : r.approved_by ?? null,
                approved_at: action === "approve" ? new Date().toISOString() : r.approved_at ?? null,
              }
            : r
        )
      );

      setSelectedRequest((prev) =>
        prev && prev.id === requestId
          ? {
              ...prev,
              status: action === "approve" ? "approved" : "rejected",
              updated_at: new Date().toISOString(),
              reject_reason: opts?.reason ?? (action === "reject" ? opts?.reason ?? null : prev.reject_reason ?? null),
              approved_by: action === "approve" ? { id: 1, name: "Admin" } : prev.approved_by ?? null,
              approved_at: action === "approve" ? new Date().toISOString() : prev.approved_at ?? null,
            }
          : prev
      );

      try {
        const target = requests.find((x) => x.id === requestId) ?? selectedRequest;
        if (!target && !USE_DUMMY) throw new Error("Request not found");

        if (USE_DUMMY) {
          await new Promise((r) => setTimeout(r, 200));
          if (action === "approve" && target) {
            const check = checkAndAdjustDummyInventoryForApproval(target);
            if (!check.ok) {
              const msg = `Stok tidak cukup untuk beberapa item:\n${check.insufficient.map((s) => `${s.name}: need ${s.need}, have ${s.have}`).join("\n")}\n\nPilih OK untuk approve tanpa perubahan stok, Cancel untuk membatalkan.`;
              const cont = confirm(msg);
              if (!cont) {
                setRequests(prevSnapshot);
                setSelectedRequest(prevSnapshot.find((x) => x.id === requestId) ?? null);
                setActionLoading(false);
                return;
              }
            }
          }
        } else {
          const url = `/api/requests/${requestId}/${action}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: opts?.reason ?? null, adjustInventory: action === "approve" }),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `HTTP ${res.status}`);
          }
          await fetchRequests();
        }

        // After approve succeeded, we keep updated state. Provide user hint to print surat jalan
        if (action === "approve") {
          alert("Request approved. Setelah ini Anda bisa mencetak Surat Jalan melalui tombol 'Print Surat Jalan'.");
        } else {
          alert("Request rejected.");
        }
      } catch (err: any) {
        console.error(err);
        alert("Gagal mengubah status: " + (err?.message ?? "unknown"));
        setRequests(prevSnapshot);
        setSelectedRequest(prevSnapshot.find((x) => x.id === requestId) ?? null);
      } finally {
        setActionLoading(false);
      }
    },
    [actionLoading, requests, selectedRequest, checkAndAdjustDummyInventoryForApproval, fetchRequests]
  );

  const handleApprove = (id: number) => {
    if (!confirm("Setujui request ini? Aksi ini dapat mengurangi stok inventory jika diaktifkan pada backend.")) return;
    updateRequestStatus(id, "approve");
  };

  const openRejectModalFor = (id: number) => {
    setSelectedIds([id]);
    setRejectReason("");
    setShowRejectModal(true);
  };

  // bulk helpers (kept simple)
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllVisible = (visibleIds: number[]) => {
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    else setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) {
      alert("Pilih minimal 1 request untuk approve.");
      return;
    }
    if (!confirm(`Approve ${selectedIds.length} request?`)) return;
    setBulkLoading(true);
    const prev = clone(requests);
    setRequests((prevList) => prevList.map((r) => (selectedIds.includes(r.id) ? { ...r, status: "approved", updated_at: new Date().toISOString(), approved_by: { id: 1, name: "Admin" }, approved_at: new Date().toISOString() } : r)));
    try {
      if (USE_DUMMY) {
        for (const id of selectedIds) {
          const req = requests.find((r) => r.id === id);
          if (!req) continue;
          const check = checkAndAdjustDummyInventoryForApproval(req);
          if (!check.ok) {
            const msg = `For Request #${id}, stok tidak cukup:\n${check.insufficient.map((s) => `${s.name}: need ${s.need}, have ${s.have}`).join("\n")}\n\nOK approve tanpa stok, Cancel skip approval for this request.`;
            const cont = confirm(msg);
            if (!cont) {
              setRequests((prevList) => prevList.map((r) => (r.id === id ? prev.find((p) => p.id === id) ?? r : r)));
              continue;
            }
          }
        }
      } else {
        const res = await fetch(`/api/requests/bulk/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedIds, adjustInventory: true }),
        });
        if (!res.ok) throw new Error("Bulk approve failed");
        await fetchRequests();
      }
      alert("Bulk approve selesai.");
      setSelectedIds([]);
    } catch (err: any) {
      console.error(err);
      alert("Gagal bulk approve: " + (err?.message ?? "unknown"));
      setRequests(prev);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async (reason?: string) => {
    if (selectedIds.length === 0) {
      alert("Pilih minimal 1 request untuk reject.");
      return;
    }
    if (!reason) {
      setShowRejectModal(true);
      return;
    }
    setBulkLoading(true);
    const prev = clone(requests);
    setRequests((prevList) => prevList.map((r) => (selectedIds.includes(r.id) ? { ...r, status: "rejected", updated_at: new Date().toISOString(), reject_reason: reason } : r)));
    try {
      if (USE_DUMMY) {
        await new Promise((r) => setTimeout(r, 100));
      } else {
        const res = await fetch(`/api/requests/bulk/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedIds, reason }),
        });
        if (!res.ok) throw new Error("Bulk reject failed");
        await fetchRequests();
      }
      alert("Bulk reject selesai.");
      setSelectedIds([]);
    } catch (err: any) {
      console.error(err);
      alert("Gagal bulk reject: " + (err?.message ?? "unknown"));
      setRequests(prev);
    } finally {
      setBulkLoading(false);
      setShowRejectModal(false);
    }
  };

  const submitRejectModal = async () => {
    if (!rejectReason || rejectReason.trim() === "") {
      if (!confirm("Anda tidak memberikan alasan penolakan. Lanjutkan?")) return;
    }
    if (selectedIds.length === 1) {
      await updateRequestStatus(selectedIds[0], "reject", { reason: rejectReason });
      setShowRejectModal(false);
      setSelectedIds([]);
      setRejectReason("");
      return;
    }
    await handleBulkReject(rejectReason);
    setShowRejectModal(false);
    setRejectReason("");
  };

  const visibleIds = useMemo(() => {
    const ids: number[] = [];
    grouped.forEach((g) => {
      if (selectedStoreId !== "all" && selectedStoreId !== g.store.id) return;
      const list = filteredRequestsForStore(g.store.id);
      list.forEach((r) => ids.push(r.id));
    });
    return ids;
  }, [grouped, selectedStoreId, filteredRequestsForStore]);

  const totalPending = requests.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageMeta title="Requests Admin - Roti Goolung" description="Halaman admin untuk melihat dan menyetujui request kebutuhan cabang Roti Goolung" />
      <PageBreadcrumb pageTitle="Requests / Approval" />

      <div className="space-y-6">
        <ComponentCard title="Requests dari Cabang - Roti Goolung">
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm text-gray-600">Daftar permintaan kebutuhan setiap cabang (keperluan non-produksi). Klik nama cabang / view untuk detail.</div>
              <div className="text-xs text-gray-500 mt-1">Total pending: <strong>{totalPending}</strong></div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedStoreId === "all" ? "all" : String(selectedStoreId)}
                onChange={(e) => setSelectedStoreId(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="px-2 py-1 border rounded"
              >
                <option value="all">All stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-2 py-1 border rounded">
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <input placeholder="Search id / requester / item" value={search} onChange={(e) => setSearch(e.target.value)} className="px-2 py-1 border rounded" />

              <button className="ml-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded" onClick={() => fetchRequests()} title="Refresh">
                Refresh
              </button>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <button className="px-2 py-1 text-sm border rounded" onClick={() => selectAllVisible(visibleIds)} disabled={visibleIds.length === 0} title="Select all visible">
              Toggle Select Visible ({visibleIds.length})
            </button>

            <button className="px-2 py-1 text-sm bg-green-600 text-white rounded" onClick={handleBulkApprove} disabled={selectedIds.length === 0 || bulkLoading}>
              {bulkLoading ? "Processing..." : `Bulk Approve (${selectedIds.length})`}
            </button>

            <button className="px-2 py-1 text-sm bg-red-50 text-red-700 rounded" onClick={() => { if (selectedIds.length === 0) return alert("Pilih minimal 1 request untuk reject."); setShowRejectModal(true); }} disabled={selectedIds.length === 0 || bulkLoading}>
              {bulkLoading ? "Processing..." : `Bulk Reject (${selectedIds.length})`}
            </button>

            <div className="ml-auto text-sm text-gray-600">{selectedIds.length} selected</div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : error ? (
            <div className="text-sm text-red-600">Error: {error}</div>
          ) : grouped.length === 0 ? (
            <div className="text-sm text-gray-500">Belum ada request.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grouped.map((g) => {
                const requestsForStore = filteredRequestsForStore(g.store.id);
                const pendingCount = g.requests.filter((r) => r.status === "pending").length;
                const totalCount = g.requests.length;
                if (selectedStoreId !== "all" && selectedStoreId !== g.store.id) return null;

                return (
                  <div key={g.store.id} className="p-4 border rounded shadow-sm bg-white">
                    <div className="flex items-start gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{g.store.name}</h3>
                        {g.store.branch_code && <div className="text-xs text-gray-400">Code: {g.store.branch_code}</div>}
                      </div>

                      <div className="ml-auto text-right">
                        <div className="text-sm text-gray-600">{totalCount} requests</div>
                        <div className="text-sm mt-1">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-800">{pendingCount} pending</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      {requestsForStore.length === 0 ? (
                        <div className="text-sm text-gray-500">Tidak ada request sesuai filter.</div>
                      ) : (
                        <ul className="space-y-2">
                          {requestsForStore.map((r) => (
                            <li key={r.id} className="p-2 border rounded hover:shadow-sm flex items-start gap-3">
                              <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} className="mt-1" />
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <div>
                                    <div className="text-sm font-medium">Request #{r.id}</div>
                                    <div className="text-xs text-gray-500">{fmtDate(r.created_at)} — oleh {r.requested_by?.name ?? "Unknown"}</div>
                                  </div>
                                  <div className="ml-auto flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status === "pending" ? "bg-yellow-50 text-yellow-800" : r.status === "approved" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                      {STATUS_LABEL[r.status]}
                                    </span>
                                    <button className="text-sm px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200" onClick={() => openRequestModal(r)}>
                                      View
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-2 text-xs text-gray-600">
                                  {r.items.map((it) => (
                                    <div key={it.id}>
                                      • {it.name} — {it.qty} {it.unit ?? ""}
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-2 flex gap-2">
                                  <button className="px-2 py-0.5 text-xs bg-green-600 text-white rounded" onClick={() => handleApprove(r.id)} disabled={r.status !== "pending" || actionLoading}>
                                    {actionLoading ? "..." : "Approve"}
                                  </button>
                                  <button className="px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded" onClick={() => openRejectModalFor(r.id)} disabled={r.status !== "pending" || actionLoading}>
                                    Reject
                                  </button>

                                  {/* SURAT JALAN: show print button when approved */}
                                  {r.status === "approved" && (
                                    <button className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded" onClick={() => openSuratJalanWindow(r)}>
                                      Print Surat Jalan
                                    </button>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ComponentCard>
      </div>

      {/* modal detail */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl bg-white rounded shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="text-lg font-semibold">Request #{selectedRequest.id} — {selectedRequest.store.name}</h3>
                <div className="text-xs text-gray-500">{fmtDate(selectedRequest.created_at)} — oleh {selectedRequest.requested_by?.name ?? "-"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={closeModal}>Close</button>
                <button className="px-3 py-1 text-sm rounded bg-red-50 text-red-700 hover:bg-red-100" onClick={() => openRejectModalFor(selectedRequest.id)} disabled={selectedRequest.status !== "pending" || actionLoading}>
                  {actionLoading ? "..." : "Reject"}
                </button>
                <button className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700" onClick={() => handleApprove(selectedRequest.id)} disabled={selectedRequest.status !== "pending" || actionLoading}>
                  {actionLoading ? "..." : "Approve"}
                </button>

                {/* SURAT JALAN: print available when approved */}
                {selectedRequest.status === "approved" && (
                  <button className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => openSuratJalanWindow(selectedRequest)}>
                    Print Surat Jalan
                  </button>
                )}
              </div>
            </div>

            <div className="p-4">
              <div className="mb-3 text-sm text-gray-600">Catatan: {selectedRequest.note ?? "-"}</div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">Barang</th>
                      <th className="p-2">Jumlah</th>
                      <th className="p-2">Satuan</th>
                      <th className="p-2">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRequest.items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="p-2 align-top">{it.name}</td>
                        <td className="p-2 align-top">{it.qty}</td>
                        <td className="p-2 align-top">{it.unit ?? "-"}</td>
                        <td className="p-2 align-top">{it.note ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedRequest.status === "rejected" && selectedRequest.reject_reason && (
                <div className="mt-3 text-sm text-red-600">
                  <strong>Reason:</strong> {selectedRequest.reject_reason}
                </div>
              )}
            </div>

            <div className="p-4 border-t flex items-center justify-between">
              <div className="text-xs text-gray-500">Status sekarang: <strong>{STATUS_LABEL[selectedRequest.status]}</strong></div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={closeModal}>Close</button>
                <button className="px-3 py-1 text-sm rounded bg-red-50 text-red-700 hover:bg-red-100" onClick={() => openRejectModalFor(selectedRequest.id)} disabled={selectedRequest.status !== "pending" || actionLoading}>
                  {actionLoading ? "..." : "Reject"}
                </button>
                <button className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700" onClick={() => handleApprove(selectedRequest.id)} disabled={selectedRequest.status !== "pending" || actionLoading}>
                  {actionLoading ? "..." : "Approve"}
                </button>
                {selectedRequest.status === "approved" && (
                  <button className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => openSuratJalanWindow(selectedRequest)}>
                    Print Surat Jalan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b">
              <h3 className="text-lg font-semibold">Reject Request{selectedIds.length > 1 ? `s (${selectedIds.length})` : selectedIds.length === 1 ? ` #${selectedIds[0]}` : ""}</h3>
            </div>
            <div className="p-4">
              <label className="text-sm font-medium">Alasan penolakan (opsional)</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Masukkan alasan..." className="w-full border rounded p-2 mt-2" rows={4} />
              <div className="mt-3 flex justify-end gap-2">
                <button className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => { setShowRejectModal(false); setRejectReason(""); }}>
                  Cancel
                </button>
                <button className="px-3 py-1 text-sm rounded bg-red-600 text-white" onClick={async () => {
                    if (selectedIds.length === 1) {
                      await updateRequestStatus(selectedIds[0], "reject", { reason: rejectReason });
                      setShowRejectModal(false);
                      setSelectedIds([]);
                      setRejectReason("");
                    } else {
                      await handleBulkReject(rejectReason);
                    }
                  }}>
                  {bulkLoading || actionLoading ? "Processing..." : `Confirm Reject (${selectedIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
