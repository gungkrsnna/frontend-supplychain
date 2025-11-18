// src/pages/StorePageSupabase.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useBranches, useProducts, useInventoryForBranch, InventoryRow } from "../../hooks/useSupabaseInventory";
import { updateInventoryReady } from "../../lib/inventoryApi";

/* util export CSV (same as before) */
function csvDownload(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const v = String(c ?? "");
          if (v.includes(",") || v.includes('"') || v.includes("\n")) {
            return `"${v.replace(/"/g, '""')}"`;
          }
          return v;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const TARGET_DEFAULT = 100;

export default function StorePageSupabase(): JSX.Element {
  const { branches, loading: loadingBranches } = useBranches();
  const { products, loading: loadingProducts } = useProducts();
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [target, setTarget] = useState<number>(TARGET_DEFAULT);
  const [search, setSearch] = useState<string>("");

  // snapshot states
  const [snapshots, setSnapshots] = useState<{ id: string; label: string | null; created_at: string }[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [snapshotItems, setSnapshotItems] = useState<any[] | null>(null);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [takingSnapshot, setTakingSnapshot] = useState(false);

  // when branches loaded, default to first
  useEffect(() => {
    if (!branchId && branches && branches.length) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const { inventory, loading: loadingInventory, refresh } = useInventoryForBranch(branchId);

  // editing local state (single-row edits)
  const [editing, setEditing] = useState<{ invId: string; value: number } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Closing mode state
  const [isClosingMode, setIsClosingMode] = useState<boolean>(false);
  const [closingEdits, setClosingEdits] = useState<Record<string, number>>({}); // key = inv.id
  const [closingNote, setClosingNote] = useState<string>("");
  const [closingPerformedBy, setClosingPerformedBy] = useState<string>(""); // operator name/id
  const [savingClosing, setSavingClosing] = useState<boolean>(false);

  // helper: start closing — optionally take snapshot first
  async function startClosing(autoSnapshot = true) {
    if (!branchId) return alert("Pilih branch dulu.");
    if (selectedSnapshot) return alert("Tidak bisa mulai closing saat melihat snapshot. Kembalikan ke Live view.");

    if (autoSnapshot) {
      const yn = confirm("Sebelum melakukan closing, ambil snapshot inventory sekarang? (direkomendasikan)");
      if (yn) {
        try {
          setTakingSnapshot(true);
          await supabase.rpc("take_inventory_snapshot", { b_id: branchId, label: `pre-closing ${new Date().toISOString()}`, performed_by: null });
          // refresh snapshot list
          const { data: sdata } = await supabase
            .from("inventory_snapshots")
            .select("id, label, created_at")
            .eq("branch_id", branchId)
            .order("created_at", { ascending: false })
            .limit(50);
          setSnapshots((sdata || []).map((d: any) => ({ id: d.id, label: d.label, created_at: d.created_at })));
        } catch (e) {
          console.warn("snapshot failed", e);
        } finally {
          setTakingSnapshot(false);
        }
      }
    }

    // prepare edits map from current inventory (live)
    const src = inventory ?? [];
    const map: Record<string, number> = {};
    for (const inv of src) {
      // use inv.id as key (live)
      map[inv.id] = Number(inv.ready ?? 0);
    }
    setClosingEdits(map);
    setIsClosingMode(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelClosing() {
    if (!confirm("Batal closing? Semua perubahan akan hilang.")) return;
    setIsClosingMode(false);
    setClosingEdits({});
    setClosingNote("");
    setClosingPerformedBy("");
  }

  // helper to update a single edit
  function setClosingValue(invId: string, v: number) {
    setClosingEdits((prev) => ({ ...prev, [invId]: Math.max(0, Number(v || 0)) }));
  }

  // Save closing: iterate changed rows and apply updates (prefer RPC adjust_inventory if available)
  async function saveClosingAll() {
    if (!branchId) return alert("Pilih branch dulu.");
    if (!closingPerformedBy) {
      if (!confirm("Performed by kosong. Lanjutkan tanpa performed_by?")) {
        return;
      }
    }
    // collect diffs
    const toUpdate: Array<{ invId: string; oldReady: number; newReady: number }> = [];
    for (const [invId, newReady] of Object.entries(closingEdits)) {
      const inv = (inventory || []).find((i) => i.id === invId);
      const oldReady = inv ? Number(inv.ready ?? 0) : 0;
      if (Number(newReady) !== Number(oldReady)) {
        toUpdate.push({ invId, oldReady, newReady });
      }
    }
    if (toUpdate.length === 0) {
      alert("Tidak ada perubahan untuk disimpan.");
      setIsClosingMode(false);
      return;
    }

    if (!confirm(`Simpan ${toUpdate.length} perubahan stok? Ini akan menulis transaksi audit.`)) return;

    setSavingClosing(true);
    const errors: string[] = [];
    try {
      for (const u of toUpdate) {
        const delta = Number(u.newReady) - Number(u.oldReady);
        try {
          // Prefer RPC adjust_inventory if available
          const { data, error } = await supabase.rpc("adjust_inventory", {
            inv_id: u.invId,
            delta: delta,
            performed_by: closingPerformedBy || null,
            note: closingNote || "Closing update",
          });
          if (error) {
            // fallback to simple update
            console.warn("RPC adjust_inventory error, fallback to updateInventoryReady:", error);
            await updateInventoryReady(u.invId, u.newReady);
          }
        } catch (rpcErr) {
          // fallback
          try {
            await updateInventoryReady(u.invId, u.newReady);
          } catch (upErr: any) {
            console.error("updateInventoryReady failed:", upErr);
            errors.push(`${u.invId}: ${upErr?.message ?? String(upErr)}`);
          }
        }
      }
    } finally {
      setSavingClosing(false);
    }

    if (errors.length) {
      alert("Beberapa update gagal:\n" + errors.join("\n"));
    } else {
      alert("Closing saved.");
      setIsClosingMode(false);
      setClosingEdits({});
      setClosingNote("");
      setClosingPerformedBy("");
      // optional: take snapshot after closing to capture final state
      const takeAfter = confirm("Ambil snapshot akhir shift sekarang?");
      if (takeAfter) {
        await doTakeSnapshot(`post-closing ${new Date().toISOString()}`);
      } else {
        refresh();
      }
    }
  }

  // fetch snapshots for branch
  useEffect(() => {
    async function loadSnapshots() {
      if (!branchId) {
        setSnapshots([]);
        return;
      }
      setLoadingSnapshots(true);
      const { data, error } = await supabase
        .from("inventory_snapshots")
        .select("id, label, created_at")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("fetch snapshots error", error);
        setSnapshots([]);
      } else {
        setSnapshots((data || []).map((d: any) => ({ id: d.id, label: d.label, created_at: d.created_at })));
      }
      setLoadingSnapshots(false);
    }
    loadSnapshots();
  }, [branchId]);

  // fetch items for selected snapshot
  useEffect(() => {
    async function loadSnapshotItems() {
      if (!selectedSnapshot) {
        setSnapshotItems(null);
        return;
      }
      const { data, error } = await supabase
        .from("inventory_snapshot_items")
        .select("product_id, ready, reserved, pending_inbound, min_threshold, captured_at")
        .eq("snapshot_id", selectedSnapshot)
        .order("product_id");
      if (error) {
        console.error("fetch snapshot items error", error);
        setSnapshotItems(null);
      } else {
        setSnapshotItems(data as any[]);
      }
    }
    loadSnapshotItems();
  }, [selectedSnapshot]);

  // rows source: use snapshotItems if selected, otherwise live inventory
  const rows = useMemo(() => {
    const source = selectedSnapshot && snapshotItems ? snapshotItems : inventory;
    if (!source || !products) return [];
    return source
      .map((inv: any) => {
        const prod = products.find((p) => p.id === inv.product_id);
        const ready = inv.ready ?? 0;
        const reserved = inv.reserved ?? 0;
        const pending_inbound = inv.pending_inbound ?? 0;
        const available = ready + pending_inbound - reserved;
        const fulfilled = Math.min(available, target);
        const shortfall = Math.max(target - available, 0);
        const surplus = Math.max(available - target, 0);
        return {
          invId: selectedSnapshot ? `${selectedSnapshot}_${inv.product_id}` : inv.id,
          rawId: inv.id ?? `${branchId}_${inv.product_id}`,
          productId: inv.product_id,
          sku: prod?.sku ?? "",
          name: prod?.name ?? inv.product_id,
          ready,
          reserved,
          pending_inbound,
          available,
          fulfilled,
          shortfall,
          surplus,
          captured_at: inv.captured_at ?? inv.updated_at ?? null,
        };
      })
      .filter((r: any) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return r.name.toLowerCase().includes(s) || r.sku.toLowerCase().includes(s) || r.productId.toLowerCase().includes(s);
      });
  }, [inventory, snapshotItems, selectedSnapshot, products, target, search, branchId]);

  async function handleSave(invId: string, newVal: number) {
    try {
      if (selectedSnapshot) {
        alert("Snapshot is read-only. To change live inventory, switch to Live view.");
        return;
      }
      setSavingId(invId);
      await updateInventoryReady(invId, newVal);
      setEditing(null);
      // refresh data
      refresh();
    } catch (err: any) {
      console.error(err);
      alert("Gagal update: " + (err?.message ?? String(err)));
    } finally {
      setSavingId(null);
    }
  }

  function handleQuickChange(inv: InventoryRow | null, delta: number) {
    if (selectedSnapshot) {
      alert("Snapshot is read-only. To change live inventory, switch to Live view.");
      return;
    }
    if (!inv) return;
    const newReady = Math.max(0, (inv.ready ?? 0) + delta);
    // optimistic UI: call update and refresh
    handleSave(inv.id, newReady);
  }

  async function doTakeSnapshot(label?: string) {
    if (!branchId) return alert("Pilih branch dulu.");
    if (!confirm(`Ambil snapshot inventory untuk "${branches?.find(b => b.id === branchId)?.name}" sekarang?`)) return;
    try {
      setTakingSnapshot(true);
      const { data, error } = await supabase.rpc("take_inventory_snapshot", {
        b_id: branchId,
        label: label ?? `end-shift ${new Date().toISOString()}`,
        performed_by: null,
      });
      if (error) throw error;
      const { data: sdata } = await supabase
        .from("inventory_snapshots")
        .select("id, label, created_at")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(50);
      setSnapshots((sdata || []).map((d: any) => ({ id: d.id, label: d.label, created_at: d.created_at })));
      if (sdata && sdata.length) setSelectedSnapshot(sdata[0].id);
      refresh();
      alert("Snapshot created.");
    } catch (err: any) {
      console.error("take snapshot error", err);
      alert("Gagal ambil snapshot: " + (err?.message ?? String(err)));
    } finally {
      setTakingSnapshot(false);
    }
  }

  function handleExportCSV() {
    const header = [
      "productId",
      "sku",
      "name",
      "ready",
      "reserved",
      "pending_inbound",
      "available",
      "target",
      "fulfilled",
      "shortfall",
      "surplus",
      "branchId",
      "snapshot_id",
      "captured_at",
    ];
    const body = rows.map((r) => [
      r.productId,
      r.sku,
      r.name,
      String(r.ready),
      String(r.reserved ?? 0),
      String(r.pending_inbound ?? 0),
      String(r.available),
      String(target),
      String(r.fulfilled),
      String(r.shortfall),
      String(r.surplus),
      branchId ?? "",
      selectedSnapshot ?? "live",
      r.captured_at ? new Date(r.captured_at).toISOString() : "",
    ]);
    csvDownload(`inventory_${branchId ?? "branch"}_${selectedSnapshot ? selectedSnapshot : "live"}.csv`, [header, ...body]);
  }

  function handleResetSeed() {
    if (!confirm("Reset seed di server? (Jika menggunakan seeded DB, kamu perlu reset di Supabase SQL editor)")) return;
    refresh();
    alert("Refetch done. Untuk reset full seed jalankan SQL seed di Supabase SQL Editor.");
  }

  // helpers inside component to use updated closures
  function quickUpdate(invId: string, delta: number) {
    if (selectedSnapshot) {
      alert("Snapshot is read-only. To change live inventory, switch to Live view.");
      return;
    }
    if (!inventory) return;
    const inv = inventory.find((i) => i.id === invId);
    if (!inv) return;
    const newVal = Math.max(0, (inv.ready ?? 0) + delta);
    handleSave(inv.id, newVal);
  }

  // small wrapper to await save function and show saving state
  async function handleSaveAndWait(invId: string, newVal: number, saveFn: (id: string, v: number) => Promise<void>) {
    setSavingId(invId);
    try {
      await saveFn(invId, newVal);
    } finally {
      setSavingId(null);
    }
  }

  /* ===================== RENDER ===================== */
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Store Inventory — End-of-shift snapshots</h1>

      {/* ========== GROUP 1: Filters / search (TOP) ========== */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        {/* store + view */}
        <div className="md:col-span-4 flex flex-col gap-3">
          <div>
            <label className="text-sm block">Store</label>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setSelectedSnapshot(null);
              }}
              className="mt-1 border rounded px-3 py-1 w-full"
            >
              {loadingBranches ? <option>Loading...</option> : branches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm block">View</label>
            <div className="mt-1 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input id="view-live" type="radio" checked={!selectedSnapshot} onChange={() => setSelectedSnapshot(null)} />
                <label htmlFor="view-live" className="text-sm">Live</label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="view-snap"
                  type="radio"
                  checked={!!selectedSnapshot}
                  onChange={() => {
                    if (!selectedSnapshot && snapshots && snapshots.length) setSelectedSnapshot(snapshots[0].id);
                  }}
                />
                <label htmlFor="view-snap" className="text-sm">Snapshot</label>

                <select
                  value={selectedSnapshot ?? ""}
                  onChange={(e) => setSelectedSnapshot(e.target.value || null)}
                  disabled={!snapshots || snapshots.length === 0}
                  className="ml-2 border rounded px-2 py-1 text-sm"
                >
                  <option value="">{snapshots && snapshots.length ? "Select snapshot" : "No snapshots"}</option>
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label ? `${s.label} — ${new Date(s.created_at).toLocaleString()}` : new Date(s.created_at).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* search + target */}
        <div className="md:col-span-5 flex flex-col gap-3">
          <div>
            <label className="text-sm block">Search product</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="name / sku / id"
              className="mt-1 border rounded px-3 py-1 w-full"
            />
          </div>

          <div>
            <label className="text-sm block">Target / store</label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(Math.max(0, Number(e.target.value || 0)))}
              className="mt-1 border rounded px-2 py-1 w-36"
            />
          </div>
        </div>

        {/* snapshots info area (right) */}
        <div className="md:col-span-3 flex flex-col gap-3 items-end">
          <div className="text-sm text-gray-600">Showing: <strong>{branches?.find((b) => b.id === branchId)?.name ?? branchId}</strong></div>
          <div className="text-sm text-gray-600">
            {selectedSnapshot ? <span>Snapshot: <strong>{snapshots.find((s) => s.id === selectedSnapshot)?.label ?? selectedSnapshot}</strong></span> : <span className="text-gray-500">Live data</span>}
          </div>
        </div>
      </div>

      {/* ========== GROUP 2: Action Buttons (BOTTOM of filters) ========== */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <button onClick={() => refresh()} className="px-3 py-1 border rounded bg-white">Refresh</button>

        {!isClosingMode ? (
          <>
            <button
              onClick={() => startClosing(true)}
              disabled={!branchId || takingSnapshot || !!selectedSnapshot}
              className="px-3 py-1 rounded bg-yellow-500 text-white disabled:opacity-50"
              title={selectedSnapshot ? "Kembalikan ke Live view terlebih dahulu" : "Start closing (store updates)"}
            >
              Start Closing
            </button>

            <button
              onClick={() => doTakeSnapshot(undefined)}
              disabled={!branchId || takingSnapshot}
              className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50"
              title="Take snapshot for selected store"
            >
              {takingSnapshot ? "Taking..." : "Take snapshot now"}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input value={closingPerformedBy} onChange={(e)=>setClosingPerformedBy(e.target.value)} placeholder="Performed by" className="border px-2 py-1 rounded w-44" />
              <input value={closingNote} onChange={(e)=>setClosingNote(e.target.value)} placeholder="Note (optional)" className="border px-2 py-1 rounded w-64" />
            </div>

            <button onClick={() => saveClosingAll()} disabled={savingClosing} className="px-3 py-1 rounded bg-green-600 text-white">
              {savingClosing ? "Saving..." : "Save Closing"}
            </button>
            <button onClick={() => cancelClosing()} className="px-3 py-1 rounded bg-gray-200">Cancel</button>
          </>
        )}

        <button onClick={handleExportCSV} className="px-3 py-1 rounded bg-blue-600 text-white">Export CSV</button>

        <button onClick={handleResetSeed} className="px-3 py-1 rounded bg-red-500 text-white">Reset Seed</button>
      </div>

      {/* ========== TABLE ========== */}
      <div className="overflow-x-auto rounded border">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-3 py-2 border text-left">Product</th>
              <th className="px-3 py-2 border text-right">Ready</th>
              <th className="px-3 py-2 border text-right">Reserved</th>
              <th className="px-3 py-2 border text-right">Pending In</th>
              <th className="px-3 py-2 border text-right">Available</th>
              <th className="px-3 py-2 border text-right">Target</th>
              <th className="px-3 py-2 border text-right">Fulfilled</th>
              <th className="px-3 py-2 border text-right">Shortfall</th>
              <th className="px-3 py-2 border text-right">Surplus</th>
              <th className="px-3 py-2 border text-center">Captured At</th>
              <th className="px-3 py-2 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(selectedSnapshot && snapshotItems === null) ? (
              <tr><td colSpan={11} className="px-3 py-4 text-center">Loading snapshot...</td></tr>
            ) : loadingInventory ? (
              <tr><td colSpan={11} className="px-3 py-4 text-center">Loading inventory...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={11} className="px-3 py-4 text-center">No products</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.invId} className="odd:bg-white even:bg-gray-50">
                <td className="px-3 py-2 border">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.sku} • {r.productId}</div>
                </td>

                {/* Ready cell: normal display, inline edit, OR closing input */}
                <td className="px-3 py-2 border text-right">
                  {selectedSnapshot ? (
                    <span>{r.ready}</span>
                  ) : isClosingMode ? (
                    <input
                      type="number"
                      value={closingEdits[r.rawId] ?? closingEdits[r.invId] ?? r.ready}
                      onChange={(e) => {
                        const key = r.rawId ?? r.invId;
                        setClosingValue(key, Number(e.target.value || 0));
                      }}
                      className="w-20 border px-2 py-1"
                    />
                  ) : editing?.invId === r.invId ? (
                    <input
                      autoFocus
                      type="number"
                      value={editing.value}
                      onChange={(e) => setEditing({ invId: r.invId, value: Number(e.target.value || 0) })}
                      className="w-20 border px-2 py-1"
                    />
                  ) : (
                    <span>{r.ready}</span>
                  )}
                </td>

                <td className="px-3 py-2 border text-right">{r.reserved ?? 0}</td>
                <td className="px-3 py-2 border text-right">{r.pending_inbound ?? 0}</td>

                <td className="px-3 py-2 border text-right">
                  <strong>{r.available}</strong>
                </td>

                <td className="px-3 py-2 border text-right">{target}</td>
                <td className="px-3 py-2 border text-right">{r.fulfilled}</td>
                <td className="px-3 py-2 border text-right">{r.shortfall > 0 ? <span className="text-red-600">{r.shortfall}</span> : 0}</td>
                <td className="px-3 py-2 border text-right">{r.surplus > 0 ? <span className="text-green-600">{r.surplus}</span> : 0}</td>

                <td className="px-3 py-2 border text-center text-xs text-gray-600">{r.captured_at ? new Date(r.captured_at).toLocaleString() : (selectedSnapshot ? "-" : (r.updated_at ? new Date(r.updated_at).toLocaleString() : "-"))}</td>

                <td className="px-3 py-2 border text-center">
                  {selectedSnapshot ? (
                    <span className="text-xs text-gray-500">Snapshot</span>
                  ) : isClosingMode ? (
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          const key = r.rawId ?? r.invId;
                          // reset this row to original ready
                          const original = r.ready ?? 0;
                          setClosingValue(key, original);
                        }}
                        className="px-2 py-1 bg-gray-200 rounded text-xs"
                      >
                        Reset
                      </button>
                    </div>
                  ) : editing?.invId === r.invId ? (
                    <>
                      <button
                        onClick={() => handleSaveAndWait(r.invId, editing.value, handleSave)}
                        disabled={savingId === r.invId}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs mr-2"
                      >
                        {savingId === r.invId ? "Saving..." : "Save"}
                      </button>
                      <button onClick={() => setEditing(null)} className="px-2 py-1 bg-gray-200 rounded text-xs">Cancel</button>
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditing({ invId: r.invId, value: r.ready })} className="px-2 py-1 bg-indigo-600 text-white rounded text-xs">Edit</button>
                      <button onClick={() => quickUpdate(r.invId, +10)} className="px-2 py-1 bg-green-200 rounded text-xs">+10</button>
                      <button onClick={() => quickUpdate(r.invId, -10)} className="px-2 py-1 bg-red-200 rounded text-xs">-10</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        Snapshot = read-only copy. Available = Ready + Pending Inbound − Reserved.
      </div>
    </div>
  );
}
