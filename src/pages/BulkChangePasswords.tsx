import React, { useEffect, useState, ChangeEvent } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
}

interface UpdateResult {
  updated: number[];
  failed: { id: number | null; error: string }[];
}

interface ResultState {
  ok: boolean;
  data?: UpdateResult;
  text?: string;
}

const BulkChangePasswords: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [passwords, setPasswords] = useState<Record<number, string>>({});
  const [globalPassword, setGlobalPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultState | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('http://localhost:3000/dev/users');
      const data: User[] = await res.json();
      setUsers(data);
    } catch (e: any) {
      console.error(e);
      alert('Gagal fetch users: ' + e.message);
    }
  }

  const toggleSelect = (id: number) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const selectAll = () => {
    const all: Record<number, boolean> = {};
    users.forEach((u) => (all[u.id] = true));
    setSelected(all);
  };

  const clearSelection = () => {
    setSelected({});
  };

  const handlePasswordChange = (id: number, value: string) => {
    setPasswords((p) => ({ ...p, [id]: value }));
  };

  const applyPasswords = async () => {
    setResult(null);

    const updates = users
      .filter((u) => selected[u.id])
      .map((u) => ({ id: u.id, password: passwords[u.id] || '' }));

    if (updates.length === 0) {
      alert('Pilih setidaknya satu user terlebih dahulu.');
      return;
    }

    if (!globalPassword && updates.some((u) => !u.password)) {
      const ok = window.confirm(
        'Beberapa baris belum berisi password. Lanjutkan? (kosong akan di-skip)'
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/dev/bulk-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates,
          globalPassword: globalPassword || undefined,
        }),
      });

      const data = (await res.json()) as UpdateResult;

      if (!res.ok) {
        setResult({ ok: false, text: (data as any).message || JSON.stringify(data) });
      } else {
        setResult({ ok: true, data });
        fetchUsers();
        // reset passwords dan selection
        const clearedPasswords = { ...passwords };
        updates.forEach((u) => delete clearedPasswords[u.id]);
        setPasswords(clearedPasswords);
        setSelected({});
        setGlobalPassword('');
      }
    } catch (e: any) {
      setResult({ ok: false, text: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '1rem auto', padding: 18, border: '1px solid #eee', borderRadius: 8 }}>
      <h3>DEV: Bulk Change Passwords</h3>
      <p style={{ color: '#a00' }}>DEV ONLY — tidak ada verifikasi. Pastikan ini hanya di environment dev.</p>

      <div style={{ marginBottom: 12 }}>
        <button onClick={selectAll} style={{ marginRight: 6 }}>Select All</button>
        <button onClick={clearSelection}>Clear</button>
      </div>

      <div style={{ margin: '12px 0' }}>
        <label>
          Global password (optional) — jika diisi, akan dipakai untuk semua user terpilih:
          <input
            value={globalPassword}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setGlobalPassword(e.target.value)}
            style={{ width: 300, display: 'block', marginTop: 6, padding: 6 }}
            placeholder="Isi password global (opsional)"
          />
        </label>
      </div>

      <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #ddd' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>#</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Select</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Email</th>
              <th style={{ textAlign: 'left', padding: 8 }}>New Password (per-user)</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 8 }}>{i + 1}</td>
                <td style={{ padding: 8 }}>
                  <input type="checkbox" checked={!!selected[u.id]} onChange={() => toggleSelect(u.id)} />
                </td>
                <td style={{ padding: 8 }}>{u.name}</td>
                <td style={{ padding: 8 }}>{u.email}</td>
                <td style={{ padding: 8 }}>
                  <input
                    type="text"
                    placeholder="new password"
                    value={passwords[u.id] || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handlePasswordChange(u.id, e.target.value)}
                    style={{ padding: 6, width: 260 }}
                    disabled={!!globalPassword}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div style={{ padding: 12 }}>Tidak ada user ditemukan.</div>}
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={applyPasswords} disabled={loading}>
          {loading ? 'Applying...' : 'Apply to selected'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 12, color: result.ok ? 'green' : 'crimson' }}>
          {result.ok ? (
            <div>
              <div>Updated: {result.data?.updated.join(', ') || 'none'}</div>
              {result.data?.failed && result.data.failed.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  Failed:
                  <ul>
                    {result.data.failed.map((f) => (
                      <li key={f.id || Math.random()}>{`id=${f.id} error=${f.error}`}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div>{result.text}</div>
          )}
        </div>
      )}

      <hr style={{ marginTop: 18 }} />
      <small style={{ color: '#666' }}>
        Tips: setelah apply, gunakan route login biasa untuk menguji atau jalankan skrip compare. Pastikan kolom password di DB VARCHAR(255) dan tidak terjadi append.
      </small>
    </div>
  );
};

export default BulkChangePasswords;
