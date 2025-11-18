import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import MonthlyTarget from "../../components/ecommerce/MonthlyTarget";
import PageMeta from "../../components/common/PageMeta";
import AdminCardCalc from "../../components/ecommerce/AdminCardCalc";

export default function DashboardAdmin() {
  return (
    <>
      <PageMeta
        title="Supply Chain Management - 99 Creations"
        description="Supply Chain Management - 99 Creations"
      />

      <h1>Super Admin Page</h1>

      <br />

      <div className="grid grid-cols-12 gap-4 md:gap-6">

        <div className="col-span-12 space-y-6 xl:col-span-7">
          <AdminCardCalc />

          <MonthlySalesChart />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <MonthlyTarget />
        </div>

        <div className="col-span-12">
          {/* <StatisticsChart /> */}
        </div>
      </div>
    </>
  );
}
