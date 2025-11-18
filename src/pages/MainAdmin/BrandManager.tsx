import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';


const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3000';

/**
 * Resolve logo path returned from backend:
 * - if absolute URL or data: return as-is
 * - if path starts with /uploads -> prefix with API_BASE
 * - if path starts with /images -> assume frontend public and return as-is
 * - otherwise, fallback to API_BASE/uploads/brands/<filename> (defensive)
 */
function getLogoUrl(logo?: string | null) {
  if (!logo) return null;
  if (/^(data:|https?:\/\/|\/\/)/i.test(logo)) return logo; // absolute
  if (logo.startsWith('/uploads/')) return `${API_BASE}${logo}`;
  if (logo.startsWith('/images/')) return logo; // frontend public
  // if backend stored as uploads/brands/xxx (no leading slash)
  if (logo.startsWith('uploads/')) return `${API_BASE}/${logo}`;
  // filename only -> assume uploads/brands
  return `${API_BASE}/uploads/brands/${logo}`;
}

type Brand = {
  id: number;
  kode: string;
  nama: string;
  logo?: string | null;
  color?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export default function BrandManager() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');

  // form state
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<Brand>>({ kode: '', nama: '', color: '' });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{ kode?: string; nama?: string }>({});
  const [checkingKode, setCheckingKode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchBrands();
  }, [page, q]);

  async function fetchBrands() {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.get('/api/brands', { params: { page, limit, q } });
      // assume response: { success: true, data: [...], meta: { total, page, limit } }
      const data = resp.data;
      if (data && data.data) {
        setBrands(data.data);
        setTotal(data.meta?.total ?? 0);
      } else if (Array.isArray(data)) {
        setBrands(data);
      } else {
        setBrands([]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setIsEditing(false);
    setForm({ kode: '', nama: '', color: '' });
    setFile(null);
    setFieldErrors({});
    setIsOpen(true);
  }

  function openEdit(b: Brand) {
    setIsEditing(true);
    setForm(b);
    setFile(null);
    setFieldErrors({});
    setIsOpen(true);
  }


  function closeModal() {
    setIsOpen(false);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));
  }


  async function submitForm(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.kode || !form.nama) {
      setError('Kode dan Nama wajib diisi');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('kode', form.kode as string);
      fd.append('nama', form.nama as string);
      if (form.color) fd.append('color', form.color as string);
      if (file) fd.append('logo', file);

      let resp;
      if (isEditing && form.id) {
        // jangan set Content-Type manual — biarkan axios menambahkan boundary
        try {
          resp = await axios.put(`/api/brands/${form.id}`, fd);
        } catch (errPut) {
          // fallback: jika backend tidak memproses multipart PUT -> gunakan POST + _method=PUT
          fd.append('_method', 'PUT');
          resp = await axios.post(`/api/brands/${form.id}`, fd);
        }
        const updated = resp?.data?.data ?? resp?.data;
        setBrands(prev => prev.map(b => (b.id === updated.id ? updated : b)));
        toast.success('Brand berhasil diperbarui');
      } else {
        resp = await axios.post('/api/brands', fd);
        const created = resp?.data?.data ?? resp?.data;
        setBrands(prev => [created, ...prev]);
        setTotal(prev => prev + 1);
        toast.success('Brand berhasil ditambahkan');
      }
      
      closeModal();
      } catch (err: any) {
        const status = err?.response?.status;
        if (status >= 500 || !status) console.error('submitForm error:', err);
        const msg = err?.response?.data?.message || (status === 422 ? 'Validasi gagal, periksa data Anda.' : 'Gagal menyimpan');
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
    }
  }

  function promptDelete(b: Brand) {
    setBrandToDelete(b);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!brandToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/brands/${brandToDelete.id}`);
      setBrands(prev => prev.filter(x => x.id !== brandToDelete.id));
      setTotal(prev => Math.max(0, prev - 1));
      setConfirmOpen(false);
      setBrandToDelete(null);
      toast.success('Brand berhasil dihapus');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Gagal menghapus';
      toast.error(msg);
      alert(msg); // optional
    } finally {
      setDeleting(false);
    }
  }

  function cancelDelete() {
    setConfirmOpen(false);
    setBrandToDelete(null);
  }


  async function checkKodeUnique(kode?: string, excludeId?: number | undefined) {
    if (!kode) return false;
    setCheckingKode(true);
    try {
      // gunakan endpoint search yang ada: /api/brands?q=...
      const resp = await axios.get('/api/brands', { params: { q: kode, limit: 5 } });
      const rows = (resp.data && resp.data.data) ? resp.data.data : (Array.isArray(resp.data) ? resp.data : []);

      // cari exact match (normalisasi uppercase/trim)
      const norm = kode.trim().toUpperCase();
      const found = rows.find((r: any) => (r.kode ?? '').toString().trim().toUpperCase() === norm);

      // jika ditemukan dan bukan record yang sedang diedit -> not unique
      if (found && (!excludeId || found.id !== excludeId)) {
        setFieldErrors(prev => ({ ...prev, kode: 'Kode brand sudah digunakan' }));
        return false;
      } else {
        setFieldErrors(prev => ({ ...prev, kode: undefined }));
        return true;
      }
    } catch (err) {
      // jangan blokir user kalau cek gagal — biarkan server final tangani
      console.warn('cek kode error', err);
      setFieldErrors(prev => ({ ...prev, kode: undefined }));
      return true;
    } finally {
      setCheckingKode(false);
    }
  }


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Manajemen Brand</h1>
        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cari kode atau nama..."
            className="border rounded px-3 py-2"
          />
          <button onClick={() => { setPage(1); fetchBrands(); }} className="px-3 py-2 bg-gray-200 rounded">Cari</button>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded">Tambah Brand</button>
        </div>
      </div>

      {error && <div className="mb-4 text-red-600">{error}</div>}

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Logo</th>
              <th className="px-4 py-2">Kode</th>
              <th className="px-4 py-2">Nama</th>
              <th className="px-4 py-2">Color</th>
              <th className="px-4 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center">Memuat...</td></tr>
            ) : brands.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center">Belum ada data</td></tr>
            ) : brands.map((b, idx) => {
              const src = getLogoUrl(b.logo) ?? '/images/logo/placeholder.png';
              return (
                <tr key={b.id} className="border-t">
                  <td className="px-4 py-3">{(page - 1) * limit + idx + 1}</td>
                  <td className="px-4 py-3">
                    {b.logo ? (
                      <img
                        src={src}
                        alt={b.nama}
                        className="h-10 w-10 object-contain"
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          if (!el.dataset.fallbackSet) {
                            el.dataset.fallbackSet = '1';
                            el.src = '/images/logo/placeholder.png';
                          }
                        }}
                      />
                    ) : (
                      <div className="h-10 w-10 bg-gray-100 flex items-center justify-center text-xs">No</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{b.kode}</td>
                  <td className="px-4 py-3">{b.nama}</td>
                  <td className="px-4 py-3">{b.color ? (
                    <span className="inline-block px-2 py-1 rounded" style={{ backgroundColor: b.color, color: '#fff' }}>{b.color}</span>
                  ) : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(b)} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>
                      <button onClick={() => promptDelete(b)} className="px-3 py-1 bg-red-500 text-white rounded">Hapus</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between mt-4">
        <div>Menampilkan {brands.length} dari {total} brand</div>
        <div className="flex items-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 border rounded">Prev</button>
          <span className="px-3">{page}</span>
          <button disabled={(page * limit) >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded">Next</button>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{isEditing ? 'Edit Brand' : 'Tambah Brand'}</h2>
              <button onClick={closeModal} className="text-gray-500">Tutup</button>
            </div>

            <form onSubmit={submitForm} className="space-y-4">
              <div>
                <label className="block text-sm">Kode</label>
                <input
                  name="kode"
                  value={form.kode || ''}
                  onChange={handleChange}
                  onBlur={() => checkKodeUnique(form.kode, form.id as any)}
                  className="w-full border px-3 py-2 rounded"
                />
                {fieldErrors.kode && <div className="text-sm text-red-600 mt-1">{fieldErrors.kode}</div>}
                {checkingKode && <div className="text-xs text-gray-500 mt-1">Memeriksa kode...</div>}

              </div>

              <div>
                <label className="block text-sm">Nama</label>
                <input name="nama" value={form.nama || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded" />
                {fieldErrors.nama && <div className="text-sm text-red-600 mt-1">{fieldErrors.nama}</div>}
              </div>

              <div>
                <label className="block text-sm">Color (hex atau nama)</label>
                <input name="color" value={form.color || ''} onChange={handleChange} className="w-full border px-3 py-2 rounded" />
              </div>

              <div>
                <label className="block text-sm">Logo</label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="mt-1" />
                {form.logo && !file && (
                  <div className="mt-2">
                    <small>Preview saat ini:</small>
                    <div className="mt-1">
                      <img
                        src={getLogoUrl(form.logo) ?? '/images/logo/placeholder.png'}
                        alt="preview"
                        className="h-20 object-contain"
                        onError={(e) => { e.currentTarget.src = '/images/logo/placeholder.png'; }}
                      />
                    </div>
                  </div>
                )}
                {file && (
                  <div className="mt-2">
                    <small>Preview baru:</small>
                    <div className="mt-1">
                      <img src={URL.createObjectURL(file)} alt="preview" className="h-20 object-contain" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded">Batal</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmOpen && brandToDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-md p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Konfirmasi Hapus</h3>
            </div>
            <p>Apakah Anda yakin akan menghapus brand <strong>{brandToDelete.nama}</strong> (kode: <strong>{brandToDelete.kode}</strong>)?</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={cancelDelete} className="px-4 py-2 border rounded">Batal</button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className={`px-4 py-2 text-white rounded ${deleting ? 'bg-gray-400' : 'bg-red-600'}`}
              >
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </div>
  );
}
