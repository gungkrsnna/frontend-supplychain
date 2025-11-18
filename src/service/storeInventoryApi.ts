// src/services/storeInventoryApi.ts
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:3000"; // ubah sesuai backend

export type Store = { id: number | string; name: string; branch_code?: string };
export type InventoryRow = {
  id: number | string;
  product_name?: string | null;
  qty?: number;
  unit?: string | null;
  min_stock?: number | null;
  note?: string | null;
  item_id?: number | null;
  raw?: any;
};

async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // hapus atau ubah jika tidak pakai cookies
    ...options,
  });
  const text = await res.text().catch(() => "");
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    // try to get message
    const msg = json?.message ?? text ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function listStores(): Promise<Store[]> {
  const r = await apiFetch("/stores");
  return (r?.data ?? []) as Store[];
}

export async function getInventoryForStore(storeId: number | string): Promise<InventoryRow[]> {
  const r = await apiFetch(`/stores/${storeId}/inventory`);
  return (r?.data ?? []) as InventoryRow[];
}

export async function createInventoryItem(storeId: number | string, payload: Partial<InventoryRow>) {
  const r = await apiFetch(`/stores/${storeId}/inventory/item`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return r?.data;
}

export async function updateInventoryItem(storeId: number | string, itemId: number | string, payload: Partial<InventoryRow>) {
  const r = await apiFetch(`/stores/${storeId}/inventory/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return r?.data;
}

export async function deleteInventoryItem(storeId: number | string, itemId: number | string) {
  const r = await apiFetch(`/stores/${storeId}/inventory/${itemId}`, { method: "DELETE" });
  return r;
}

export async function bulkReplaceInventory(storeId: number | string, items: Partial<InventoryRow>[]) {
  const r = await apiFetch(`/stores/${storeId}/inventory`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  return r?.data ?? [];
}
