// src/lib/transferApi.ts
import { supabase } from "./supabaseClient";

export async function transferStockRPC(productId: string, fromBranch: string, toBranch: string, qty: number, performedBy?:string) {
  const { data, error } = await supabase.rpc('transfer_stock', {
    product_id: productId,
    from_branch: fromBranch,
    to_branch: toBranch,
    qty,
    performed_by: performedBy ?? null
  });

  if (error) throw error;
  return data;
}
