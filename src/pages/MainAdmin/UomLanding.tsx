// src/pages/UomLanding.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";

type Uom = {
  id: number;
  name: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

/**
 * useFetchJson - lightweight fetch wrapper used across your project
 * returns parsed body and throws on non-ok response (matching BrandLanding pattern)
 */
function useFetchJson() {
  return useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, opts);
    const ct = res.headers.get("content-type") || "";
    let body: any = null;
    if (ct.includes("application/json")) body = await res.json();
    else body = await res.text();

    if (!res.ok) {
      const msg =
        typeof body === "object" && body !== null
          ? (body.message || body.error || JSON.stringify(body))
          : String(body || res.statusText);
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return body;
  }, []);
}

export default function UomLanding(): JSX.Element {
  const fetchJson = useFetchJson();

  const [uoms, setUoms] = useState<Uom[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Uom> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // load list
  const fetchUoms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: any = await fetchJson(`${API_BASE}/api/uoms`);
      // supports either array or { data: [...] } or { success,message,data }
      let rows: any[] = [];
      if (Array.isArray(body)) rows = body;
      else if (body && Array.isArray(body.data)) rows = body.data;
      else if (body && Array.isArray(body.data?.data)) rows = body.data.data; // very defensive
      else rows = [];

      // normalize: ensure createdAt if absent
      const normalized = (rows || []).map((r: any) => ({
        id: Number(r.id),
        name: r.name,
        createdAt: r.createdAt || r.created_at || null,
        updatedAt: r.updatedAt || r.updated_at || null,
      }));
      setUoms(normalized);
    } catch (err: any) {
      console.error("Failed load UOMs", err);
      setUoms([]);
      setError(err?.message ?? "Gagal memuat UOMs");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    fetchUoms();
  }, [fetchUoms]);

  // filter by q
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return uoms;
    return uoms.filter((u) => (u.name || "").toLowerCase().includes(term));
  }, [uoms, q]);

  // create / update
  const handleSave = useCallback(
    async (payload: { id?: number; name: string }) => {
      setSaving(true);
      setError(null);
      try {
        if (payload.id) {
          // update
          const raw = await fetchJson(`${API_BASE}/api/uoms/${payload.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: payload.name }),
          });
          // parse response body similar to fetchUoms
          const updated =
            Array.isArray(raw) && raw.length > 0
              ? raw[0]
              : raw && raw.data
              ? raw.data
              : raw;
          const normalized = {
            id: Number(updated.id),
            name: updated.name,
            createdAt: updated.createdAt || updated.created_at || null,
            updatedAt: updated.updatedAt || updated.updated_at || null,
          } as Uom;
          setUoms((prev) => prev.map((p) => (p.id === normalized.id ? normalized : p)));
        } else {
          // create
          const raw = await fetchJson(`${API_BASE}/api/uoms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: payload.name }),
          });
          const created = Array.isArray(raw) ? raw[0] : raw && raw.data ? raw.data : raw;
          const normalized = {
            id: Number(created.id),
            name: created.name,
            createdAt: created.createdAt || created.created_at || null,
            updatedAt: created.updatedAt || created.updated_at || null,
          } as Uom;
          // append to list
          setUoms((prev) => [...prev, normalized]);
        }
        // close modal handled by caller
      } catch (err: any) {
        console.error("Save UOM failed", err);
        // if backend returns structured error message, prefer it
        const msg = err?.message ?? "Gagal menyimpan UOM";
        setError(msg);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [fetchJson]
  );

  // delete
  const handleDelete = useCallback(
    async (id: number) => {
      if (!window.confirm("Yakin ingin menghapus UOM ini?")) return;
      setError(null);
      try {
        await fetchJson(`${API_BASE}/api/uoms/${id}`, { method: "DELETE" });
        setUoms((prev) => prev.filter((p) => p.id !== id));
      } catch (err: any) {
        console.error("Delete UOM failed", err);
        setError(err?.message ?? "Gagal menghapus UOM");
      }
    },
    [fetchJson]
  );

  // open modal for create or edit
  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(u: Uom) {
    setEditing(u);
    setModalOpen(true);
  }

  return (
    <>
      <PageMeta title="Manajemen UOM" description="Tambah, ubah, hapus Unit of Measure" />
      <PageBreadcrumb pageTitle="Master / UOM" />

      <div className="space-y-6">
        <ComponentCard title="Daftar UOM">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <input
                className="border rounded px-3 py-2"
                placeholder="Cari UOM..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="px-3 py-1 bg-gray-100 rounded text-sm"
                onClick={() => {
                  setQ("");
                }}
              >
                Reset
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">{loading ? "Memuat..." : `${uoms.length} UOM`}</div>
              <button
                className="px-3 py-1 bg-gray-100 rounded text-sm"
                onClick={() => {
                  fetchUoms();
                }}
              >
                Refresh
              </button>
              <button
                className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                onClick={() => openCreate()}
              >
                + Tambah UOM
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 border-b">#</th>
                  <th className="text-left px-3 py-2 border-b">Nama</th>
                  <th className="text-left px-3 py-2 border-b">Dibuat</th>
                  <th className="text-right px-3 py-2 border-b">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center px-4 py-6 text-sm text-gray-500">
                      {loading ? "Memuat..." : "Tidak ada data"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u, i) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 align-top">{i + 1}</td>
                      <td className="px-3 py-2 align-top">{u.name}</td>
                      <td className="px-3 py-2 align-top text-sm text-gray-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          className="px-2 py-1 mr-2 border rounded text-sm"
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </button>
                        <button
                          className="px-2 py-1 border rounded text-sm text-red-600"
                          onClick={() => handleDelete(u.id)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </ComponentCard>
      </div>

      {/* Inline modal component */}
      <UomModal
        open={modalOpen}
        initial={editing ?? undefined}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setError(null);
        }}
        onSubmit={async (payload) => {
          await handleSave(payload);
          // close modal is handled by caller (we close here)
          setModalOpen(false);
          setEditing(null);
        }}
        saving={saving}
      />
    </>
  );
}

/* ------------------ UomModal component (inline) ------------------ */
/* Small self-contained modal so this file is one page as requested */
type ModalProps = {
  open: boolean;
  initial?: Partial<Uom> | undefined;
  onClose: () => void;
  onSubmit: (payload: { id?: number; name: string }) => Promise<void> | void;
  saving?: boolean;
};

function UomModal({ open, initial, onClose, onSubmit, saving }: ModalProps) {
  const [name, setName] = useState<string>(initial?.name ?? "");
  const [localSaving, setLocalSaving] = useState(false);

  useEffect(() => {
    setName(initial?.name ?? "");
  }, [initial, open]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      window.alert("Nama UOM wajib diisi");
      return;
    }
    try {
      setLocalSaving(true);
      await onSubmit({ id: initial?.id, name: trimmed });
    } catch (err: any) {
      // parent sets error; show quick alert for immediate feedback
      window.alert(err?.message ?? "Gagal menyimpan UOM");
    } finally {
      setLocalSaving(false);
    }
  }

  const isSaving = saving || localSaving;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
    }}>
      <div className="bg-white rounded shadow-lg" style={{ width: 420, padding: 18 }}>
        <h3 className="text-lg font-medium mb-3">{initial?.id ? "Edit UOM" : "Tambah UOM"}</h3>

        <form onSubmit={submit}>
          <div className="mb-3">
            <label className="block text-sm mb-1">Nama</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Kilogram"
              disabled={isSaving}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-1 rounded border" onClick={onClose} disabled={isSaving}>Batal</button>
            <button type="submit" className="px-3 py-1 rounded bg-indigo-600 text-white" disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
