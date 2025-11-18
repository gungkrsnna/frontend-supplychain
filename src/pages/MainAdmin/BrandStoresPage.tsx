// src/pages/BrandStoresPage.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type Store = { id: string; name: string; address?: string; phone?: string; createdAt?: string; updatedAt?: string };
type Brand = { id: string; nama?: string; kode?: string; logo?: string | null };

export default function BrandStoresPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);

  // modal form state
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState<Partial<Store>>({ name: '', address: '', phone: '' });
  const [deleting, setDeleting] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);

  useEffect(() => {
    if (!brandId) { navigate('/brands'); return; }
    fetchBrand();
    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function fetchBrand() {
    try {
      const resp = await axios.get(`/api/brands/${brandId}`);
      setBrand(resp.data?.data ?? null);
    } catch (err) {
      console.warn(err);
    }
  }

  async function fetchStores() {
    setLoading(true);
    try {
      // use query filter: GET /api/stores?brandId=...
      const resp = await axios.get('/api/stores', { params: { brandId } });
      const data = resp.data;
      const rows = data?.data ?? (Array.isArray(data) ? data : []);
      setStores(rows);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memuat stores');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: '', address: '', phone: '' });
    setIsOpen(true);
  }

  function openEdit(s: Store) {
    setEditing(s);
    setForm({ name: s.name, address: s.address, phone: s.phone });
    setIsOpen(true);
  }

  function closeModal() { setIsOpen(false); setEditing(null); }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.name) {
      toast.error('Nama store wajib diisi');
      return;
    }
    try {
      if (editing) {
        const resp = await axios.put(`/api/stores/${editing.id}`, { ...form, brandId: brandId });
        const updated = resp.data?.data;
        setStores(prev => prev.map(s => s.id === updated.id ? updated : s));
        toast.success('Store berhasil diperbarui');
      } else {
        const resp = await axios.post('/api/stores', { ...form, brandId: brandId });
        const created = resp.data?.data;
        setStores(prev => [created, ...prev]);
        toast.success('Store berhasil ditambahkan');
      }
      closeModal();
    } catch (err:any) {
      const msg = err?.response?.data?.message || 'Gagal menyimpan store';
      toast.error(msg);
    }
  }

  function promptDelete(s: Store) {
    setStoreToDelete(s);
  }

  async function confirmDelete() {
    if (!storeToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/stores/${storeToDelete.id}`);
      setStores(prev => prev.filter(x => x.id !== storeToDelete.id));
      toast.success('Store dihapus');
      setStoreToDelete(null);
    } catch (err:any) {
      toast.error(err?.response?.data?.message || 'Gagal menghapus');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={2500} />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl">{brand?.nama ?? 'Stores'}</h2>
          <div className="text-sm text-gray-500">{brand?.kode}</div>
        </div>
        <div>
          <button onClick={() => navigate('/superadmin/stores')} className="mr-3 px-3 py-1 border rounded">Kembali</button>
          <button onClick={openCreate} className="px-3 py-1 bg-green-600 text-white rounded">Tambah Store</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4">
        {loading ? <div>Memuat...</div> : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr><th className="px-4 py-2">#</th><th className="px-4 py-2">Nama</th><th className="px-4 py-2">Alamat</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Aksi</th></tr>
            </thead>
            <tbody>
              {stores.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center">Belum ada store</td></tr>
              ) : stores.map((s, idx) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3">{idx+1}</td>
                  <td className="px-4 py-3">{s.name}</td>
                  <td className="px-4 py-3">{s.address ?? '-'}</td>
                  <td className="px-4 py-3">{s.phone ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>
                      <button onClick={() => promptDelete(s)} className="px-3 py-1 bg-red-500 text-white rounded">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal add/edit */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-lg">
            <h3 className="text-lg mb-3">{editing ? 'Edit Store' : 'Tambah Store'}</h3>
            <form onSubmit={submitForm} className="space-y-3">
              <div>
                <label className="text-sm block">Nama</label>
                <input name="name" value={form.name || ''} onChange={(e)=>handleChange(e as any)} className="w-full border px-3 py-2 rounded" />
              </div>
              <div>
                <label className="text-sm block">Alamat</label>
                <textarea name="address" value={form.address || ''} onChange={(e)=>handleChange(e as any)} className="w-full border px-3 py-2 rounded" />
              </div>
              <div>
                <label className="text-sm block">Phone</label>
                <input name="phone" value={form.phone || ''} onChange={(e)=>handleChange(e as any)} className="w-full border px-3 py-2 rounded" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded">Batal</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {storeToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-md">
            <p>Apakah yakin ingin menghapus <strong>{storeToDelete.name}</strong> ?</p>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={()=>setStoreToDelete(null)} className="px-3 py-1 border rounded">Batal</button>
              <button onClick={confirmDelete} disabled={deleting} className="px-3 py-1 bg-red-600 text-white rounded">{deleting ? 'Menghapus...' : 'Hapus'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
