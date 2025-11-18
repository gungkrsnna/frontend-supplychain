// src/components/admin/AdminCardCalc.tsx
import React, { useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIconLine,
  GroupIcon,
} from "../../icons";
import Badge from "../ui/badge/Badge";
import axios from "axios";

export default function AdminCardCalc() {
  const [totalBrands, setTotalBrands] = useState<number | null>(null);
  const [totalStores, setTotalStores] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchTotals() {
      setLoading(true);
      try {
        // 1) Brands - try paged endpoint (with meta) or fallback to data length
        const brandResp = await axios.get("/api/brands", { params: { limit: 1, page: 1 } });
        let bCount: number | null = null;

        // common paged shape: { success: true, data: [...], meta: { total } }
        if (brandResp.data && brandResp.data.meta && typeof brandResp.data.meta.total === "number") {
          bCount = brandResp.data.meta.total;
        } else if (brandResp.data && typeof brandResp.data.total === "number") {
          bCount = brandResp.data.total;
        } else if (typeof brandResp.data?.count === "number") {
          bCount = brandResp.data.count;
        } else if (Array.isArray(brandResp.data?.data)) {
          bCount = brandResp.data.data.length;
        } else if (Array.isArray(brandResp.data)) {
          bCount = brandResp.data.length;
        }

        // 2) Stores - adjust endpoint if your app uses different path (e.g. /api/stores)
        const storeResp = await axios.get("/api/stores", { params: { limit: 1, page: 1 } });
        let sCount: number | null = null;

        if (storeResp.data && storeResp.data.meta && typeof storeResp.data.meta.total === "number") {
          sCount = storeResp.data.meta.total;
        } else if (storeResp.data && typeof storeResp.data.total === "number") {
          sCount = storeResp.data.total;
        } else if (typeof storeResp.data?.count === "number") {
          sCount = storeResp.data.count;
        } else if (Array.isArray(storeResp.data?.data)) {
          sCount = storeResp.data.data.length;
        } else if (Array.isArray(storeResp.data)) {
          sCount = storeResp.data.length;
        }

        if (!mounted) return;
        setTotalBrands(bCount ?? 0);
        setTotalStores(sCount ?? 0);
      } catch (err) {
        console.error("fetch totals error", err);
        if (mounted) {
          // fallback zeros
          setTotalBrands(0);
          setTotalStores(0);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchTotals();
    return () => { mounted = false; };
  }, []);

  // small helper to display loading/number
  const showNumber = (val: number | null) => {
    if (loading) return "…";
    return val != null ? val.toLocaleString() : "0";
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {/* Total Brands */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
        </div>

        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Brand
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {showNumber(totalBrands)}
            </h4>
          </div>
        </div>
      </div>

      {/* Total Stores */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BoxIconLine className="text-gray-800 size-6 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Store
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {showNumber(totalStores)}
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}
