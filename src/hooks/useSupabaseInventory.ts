// src/hooks/useSupabaseInventory.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type Branch = { id: string; code?: string; name: string };
export type Product = { id: string; sku?: string; name: string };
export type InventoryRow = {
  id: string;
  branch_id: string;
  product_id: string;
  ready: number;
  reserved?: number;
  pending_inbound?: number;
  updated_at?: string | null;
  // optionally include product/branch via foreign select
  product?: Product;
  branch?: Branch;
};

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("branches").select("*").order("id");
      if (!mounted) return;
      if (error) {
        console.error("branches fetch error", error);
        setBranches([]);
      } else {
        setBranches(data as Branch[]);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  return { branches, loading };
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("products").select("*").order("id");
      if (!mounted) return;
      if (error) {
        console.error("products fetch error", error);
        setProducts([]);
      } else setProducts(data as Product[]);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  return { products, loading };
}

/**
 * per-branch inventory
 * optionally expand product info via foreign table
 */
export function useInventoryForBranch(branchId?: string) {
  const [inventory, setInventory] = useState<InventoryRow[]|null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchId) {
      setInventory(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      // select with product details via foreign key (Supabase supports fk selects)
      const { data, error } = await supabase
        .from("inventory")
        .select("id,branch_id,product_id,ready,reserved,pending_inbound,updated_at, products(id,name,sku)")
        .eq("branch_id", branchId)
        .order("product_id");
      if (!mounted) return;
      if (error) {
        console.error("inventory fetch error", error);
        setInventory([]);
      } else {
        // map product details into .product
        const mapped = (data as any[]).map((r) => ({
          id: r.id,
          branch_id: r.branch_id,
          product_id: r.product_id,
          ready: r.ready ?? 0,
          reserved: r.reserved ?? 0,
          pending_inbound: r.pending_inbound ?? 0,
          updated_at: r.updated_at ?? null,
          product: r.products ?? null,
        })) as InventoryRow[];
        setInventory(mapped);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [branchId]);

  return { inventory, loading, refresh: () => {
    // simple re-run by toggling branchId or call effect: we'll re-run by calling supabase again
    // implement below if needed: for now call hook consumer to re-render by changing branchId
  }};
}
