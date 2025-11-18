// src/pages/BrandItemsPage.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

type StoreItem = {
  id: number;
  code?: string;
  name: string;
  description?: string | null;
  is_production?: boolean | number;
  category_item_id?: number | null;
  uom_id?: number | null;
};

type Brand = { id: string; nama?: string; kode?: string; logo?: string | null };
type Uom = { id: number; name?: string; kode?: string };
type Category = { id: number; name?: string };

export default function BrandItemsPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(false);

  // UOMs & categories
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // filter states
  const [q, setQ] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [isProductionFilter, setIsProductionFilter] = useState<boolean | "">("");

  // modal state
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<StoreItem | null>(null);
  const [form, setForm] = useState<Partial<StoreItem & { codePrefix?: string; request_category_id?: number }>>({
    name: "",
    code: ""
  });

  // modal konfirmasi hapus
  const [deleteModal, setDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StoreItem | null>(null);

  const DEFAULT_CATEGORY_ITEM_ID = import.meta.env.VITE_CATEGORY_SFG_ID ? Number(import.meta.env.VITE_CATEGORY_SFG_ID) : undefined;

  useEffect(() => {
    if (!brandId) {
      navigate("/brands");
      return;
    }
    fetchBrand();
    fetchUomsAndCategories();
    // initial fetch with current filters
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  // show toast if navigation provided a toast message in location.state
useEffect(() => {
  const st: any = (location && (location.state as any)) || null;
  if (!st || !st.toast || !st.toast.message) return;

  const t = st.toast;
  const msg = String(t.message || "");
  const type = String(t.type || "info").toLowerCase();
  if (type === "success") toast.success(msg);
  else if (type === "error") toast.error(msg);
  else if (type === "warn" || type === "warning") toast.warn(msg);
  else toast.info(msg);

  // optionally scroll & highlight the createdId (if supplied)
  const createdId = t.createdId ?? t.created_id ?? null;
  if (createdId) {
    // try a few times in case items are still rendering
    const tryHighlight = (attempt = 0) => {
      const selector = `[data-item-id="${createdId}"]`;
      const el: HTMLElement | null = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight-new-item");
        window.setTimeout(() => el.classList.remove("highlight-new-item"), 3000);
      } else if (attempt < 8) {
        window.setTimeout(() => tryHighlight(attempt + 1), 250);
      }
    };
    tryHighlight();
  }

  // clear toast from history state so it won't re-show on refresh/navigation
  try {
    navigate(location.pathname, { replace: true, state: {} });
  } catch (e) {
    // ignore
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [location.key]);


  // show toast once if sessionStorage has the success message from previous page
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("item_created_toast");
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && obj.message) {
        const type = (obj.type || "info").toString().toLowerCase();
        if (type === "success") toast.success(String(obj.message));
        else if (type === "error") toast.error(String(obj.message));
        else if (type === "warn" || type === "warning") toast.warn(String(obj.message));
        else toast.info(String(obj.message));
      }
    } catch (e) {
      // ignore parse/storage errors
      // eslint-disable-next-line no-console
      console.warn("sessionStorage read error for item_created_toast", e);
    } finally {
      try { sessionStorage.removeItem("item_created_toast"); } catch {}
    }
  }, []);

  // when filters change, re-fetch
  useEffect(() => {
    // simple reaction: re-fetch whenever filters change
    // you can add debounce if needed
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoryFilter, isProductionFilter]);

  async function fetchBrand() {
    try {
      const resp = await axios.get(`/api/brands/${brandId}`);
      setBrand(resp.data?.data ?? null);
    } catch (err) {
      console.warn("fetchBrand failed", err);
    }
  }

  async function fetchItems() {
    setLoading(true);
    try {
      // call paged/search endpoint with filters
      const params: any = {
        q: q || undefined,
        category: categoryFilter === "" ? undefined : categoryFilter,
        // send is_production param only if explicitly set (true/false)
        is_production: isProductionFilter === "" ? undefined : (isProductionFilter ? 1 : 0),
        limit: 200, // adjust as needed
        page: 1
      };
      const resp = await axios.get(`/api/brands/${brandId}/items`, { params });
      // expecting { success: true, data: [...], meta? }
      const rows = resp.data?.data ?? (Array.isArray(resp.data) ? resp.data : []);
      setItems(rows);
      return;
    } catch (err) {
      console.warn("fetchItems primary endpoint failed, trying fallback", err);
      // fallback: try older endpoints /api/brands/:id/items (non-paged) or /api/item?brand_id=
      try {
        const resp2 = await axios.get(`/api/brands/${brandId}/items`);
        const rows2 = resp2.data?.data ?? (Array.isArray(resp2.data) ? resp2.data : []);
        // apply client-side filters as fallback
        const filtered = applyClientFilters(rows2);
        setItems(filtered);
        return;
      } catch (e) {
        try {
          const resp3 = await axios.get("/api/item", { params: { brand_id: brandId } });
          const rows3 = resp3.data?.data ?? (Array.isArray(resp3.data) ? resp3.data : []);
          const filtered = applyClientFilters(rows3);
          setItems(filtered);
          return;
        } catch (e2) {
          console.error("fetchItems fallback failed", e2);
          toast.error("Gagal memuat items");
          setItems([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function applyClientFilters(rows: StoreItem[]) {
    return rows.filter(r => {
      if (categoryFilter !== "" && Number.isFinite(Number(categoryFilter))) {
        if (String(r.category_item_id) !== String(categoryFilter)) return false;
      }
      if (isProductionFilter !== "") {
        const desired = isProductionFilter ? true : false;
        const actual = (r.is_production === 1 || r.is_production === true);
        if (actual !== desired) return false;
      }
      if (q && q.trim()) {
        const t = q.trim().toLowerCase();
        if (!String(r.name || "").toLowerCase().includes(t) && !String(r.code || "").toLowerCase().includes(t)) return false;
      }
      return true;
    });
  }

  async function fetchUomsAndCategories() {
    try {
      const catEndpoints = ["/api/category-items", "/api/category-items"];
      const [uomResp, catResp] = await Promise.all([
        axios.get("/api/uoms"),
        (async () => {
          try {
            return await axios.get(catEndpoints[0]);
          } catch {
            return await axios.get(catEndpoints[1]);
          }
        })(),
      ]);
      setUoms(uomResp.data?.data ?? uomResp.data ?? []);
      setCategories(catResp.data?.data ?? catResp.data ?? []);
    } catch (err) {
      console.warn("gagal load uoms/categories", err);
      setUoms([]);
      setCategories([]);
    }
  }

  function getUomName(id?: number | null) {
    if (!id) return "-";
    const u = uoms.find(x => x.id === id);
    return u ? (u.name ?? u.kode ?? String(u.id)) : String(id);
  }

  function getCategoryName(id?: number | null) {
    if (!id) return "-";
    const c = categories.find(x => x.id === id);
    return c ? (c.name ?? String(c.id)) : String(id);
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      code: "",
      uom_id: undefined,
      category_item_id: DEFAULT_CATEGORY_ITEM_ID ?? undefined,
    });
    setIsOpen(true);
  }

  function openEdit(it: StoreItem) {
    setEditing(it);
    setForm({
      name: it.name,
      code: it.code,
      uom_id: it.uom_id ?? undefined,
      category_item_id: it.category_item_id ?? DEFAULT_CATEGORY_ITEM_ID ?? undefined,
    });
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setEditing(null);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    if (name === "uom_id" || name === "category_item_id") {
      setForm(prev => ({ ...prev, [name]: value === "" ? undefined : Number(value) }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  }

  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name) return toast.error("Nama wajib diisi");
    if (!form.uom_id) return toast.error("Pilih UOM");
    if (!form.category_item_id) return toast.error("Pilih Category");

    const payload: any = {
      name: form.name,
      code: form.code?.trim() || undefined,
      uom_id: Number(form.uom_id),
      category_item_id: Number(form.category_item_id),
      brandKode: brand?.kode,
      request_category_id: form.request_category_id ?? 1
    };

    try {
      if (editing) {
        const resp = await axios.put(`/api/item/${editing.id}`, payload);
        const updated = resp.data?.data ?? resp.data;
        setItems(prev => prev.map(x => (x.id === updated.id ? updated : x)));
        toast.success("Item diperbarui");
      } else {
        const resp = await axios.post("/api/item", payload);
        const created = resp.data?.data ?? resp.data;
        setItems(prev => [created, ...prev]);
        toast.success("Item dibuat");
      }
      closeModal();
    } catch (err: any) {
      console.error("submitForm item error", err);
      const status = err?.response?.status;
      if (status === 409) toast.error(err.response.data.message || "Code sudah ada");
      else toast.error(err?.response?.data?.message || "Gagal menyimpan item");
    }
  }

  useEffect(() => {
  try {
    const raw = sessionStorage.getItem("item_created_toast");
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && obj.message) {
      const type = (obj.type || "info").toString().toLowerCase();
      if (type === "success") toast.success(String(obj.message));
      else if (type === "error") toast.error(String(obj.message));
      else if (type === "warn" || type === "warning") toast.warn(String(obj.message));
      else toast.info(String(obj.message));
    }

    // optional: scroll & highlight created row if createdId tersedia
    const createdId = obj?.createdId ?? obj?.created_id ?? null;
    if (createdId) {
      // allow items to render first (if fetchItems is async), try a few times
      const tryHighlight = (attempt = 0) => {
        const selector = `[data-item-id="${createdId}"]`;
        const el: HTMLElement | null = document.querySelector(selector);
        if (el) {
          // scroll into view (center)
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // add temporary highlight
          el.classList.add("highlight-new-item");
          // remove highlight after 3s
          window.setTimeout(() => el.classList.remove("highlight-new-item"), 3000);
        } else if (attempt < 8) {
          // retry after small delay (to wait for items rendering)
          window.setTimeout(() => tryHighlight(attempt + 1), 250);
        }
      };
      tryHighlight();
    }
  } catch (e) {
    console.warn("sessionStorage read error for item_created_toast", e);
  } finally {
    try { sessionStorage.removeItem("item_created_toast"); } catch {}
  }
}, []);


  // buka modal hapus
  function confirmDelete(it: StoreItem) {
    setItemToDelete(it);
    setDeleteModal(true);
  }

  // eksekusi hapus setelah konfirmasi
  async function handleConfirmDelete() {
    if (!itemToDelete) return;
    try {
      await axios.delete(`/api/item/${itemToDelete.id}`);
      setItems(prev => prev.filter(x => x.id !== itemToDelete.id));
      toast.success("Item dihapus");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Gagal menghapus");
    } finally {
      setDeleteModal(false);
      setItemToDelete(null);
    }
  }

  function handleResetFilters() {
    setQ("");
    setCategoryFilter("");
    setIsProductionFilter("");
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2000} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl">{brand?.nama ?? "Items"}</h2>
          <div className="text-sm text-gray-500">{brand?.kode}</div>
        </div>
        <div>
          <button onClick={() => navigate("/superadmin/items")} className="mr-3 px-3 py-1 border rounded">Kembali</button>
          <button
              onClick={() =>
                navigate(
                  `/superadmin/brands/${brandId}/items/create?brandId=${brandId}`
                )
              }
              className="px-3 py-1 bg-green-600 text-white rounded"
            >
              Tambah Item
            </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded shadow p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <label className="text-xs block mb-1">Cari (nama atau kode)</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari..." className="w-full border px-3 py-2 rounded" />
          </div>

          <div>
            <label className="text-xs block mb-1">Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value === "" ? "" : Number(e.target.value))} className="border px-3 py-2 rounded">
              <option value="">Semua category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div>
              <label className="text-xs block mb-1">Is Production</label>
              <div className="flex items-center gap-2">
                <select value={isProductionFilter} onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") setIsProductionFilter("");
                  else setIsProductionFilter(v === "1");
                }} className="border px-3 py-2 rounded">
                  <option value="">Semua</option>
                  <option value="1">Production</option>
                  <option value="0">Non-production</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={fetchItems} className="px-3 py-2 bg-indigo-600 text-white rounded">Apply</button>
            <button onClick={handleResetFilters} className="px-3 py-2 border rounded">Reset</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        {loading ? (
          <div>Memuat...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Belum ada item</div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Nama</th>
                <th className="px-4 py-2">UOM</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Production</th>
                <th className="px-4 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id} className="border-t">
                  <td className="px-4 py-3">{idx + 1}</td>
                  <td className="px-4 py-3">{it.name}</td>
                  <td className="px-4 py-3">{getUomName(it.uom_id)}</td>
                  <td className="px-4 py-3">{getCategoryName(it.category_item_id)}</td>
                  <td className="px-4 py-3">{it.is_production ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/superadmin/items/${it.id}/view`)}
                        className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Lihat
                      </button>
                      <button
                        onClick={() => navigate(`/superadmin/items/${it.id}/edit`)}
                        className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Edit
                      </button>
                      <button onClick={() => confirmDelete(it)} className="px-2 py-1 bg-red-600 text-white rounded">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* modal tambah/edit */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-lg">
            <h3 className="text-lg mb-3">{editing ? "Edit Item" : "Tambah Item"}</h3>
            <form onSubmit={submitForm} className="space-y-3">
              <div>
                <label className="text-sm block">Nama</label>
                <input name="name" value={form.name || ""} onChange={handleChange as any} className="w-full border px-3 py-2 rounded" />
              </div>

              <div>
                <label className="text-sm block">UOM</label>
                <select name="uom_id" value={form.uom_id ?? ""} onChange={handleChange as any} className="w-full border px-3 py-2 rounded">
                  <option value="">-- Pilih UOM --</option>
                  {uoms.map(u => <option key={u.id} value={u.id}>{u.name ?? u.kode ?? u.id}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm block">Category</label>
                <select name="category_item_id" value={form.category_item_id ?? ""} onChange={handleChange as any} className="w-full border px-3 py-2 rounded">
                  <option value="">{DEFAULT_CATEGORY_ITEM_ID ? `Default: ${DEFAULT_CATEGORY_ITEM_ID}` : '-- Pilih Category --'}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name ?? c.id}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded">Batal</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* modal konfirmasi hapus */}
      {deleteModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-sm text-center">
            <h3 className="text-lg font-semibold mb-3">Konfirmasi Hapus</h3>
            <p className="text-gray-600 mb-4">
              Apakah Anda yakin ingin menghapus item <strong>{itemToDelete.name}</strong>?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => { setDeleteModal(false); setItemToDelete(null); }}
                className="px-4 py-2 border rounded"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
