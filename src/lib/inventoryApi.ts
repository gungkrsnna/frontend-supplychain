// src/lib/inventoryApi.ts
import { supabase } from "./supabaseClient";

export async function updateInventoryReady(invId: string, newReady: number) {
  const { data, error } = await supabase
    .from("inventory")
    .update({ ready: newReady, updated_at: new Date().toISOString() })
    .eq("id", invId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
