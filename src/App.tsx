// src/App.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";

import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";

import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import DeliveryPrintTemplate from './pages/kitchen/DeliveryPrintTemplate';

import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";

import BasicTables from "./pages/Tables/BasicTables";
import BasicTablesTwo from "./pages/Tables/BasicTablesTwo";
import BasicTablesThree from "./pages/Tables/BasicTablesThree";

import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";

import DeliveryNote from "./pages/kitchen/DeliveryNote";

import AppLayoutCentral from "./layout/AppLayoutCentral";
import { ScrollToTop } from "./components/common/ScrollToTop";

import Home from "./pages/Dashboard/Home";

import KitchenTargetsPage from "./pages/KitchenTargets";
import KitchenProductionPage from "./pages/KitchenProduction";

import { KitchenProvider } from "./context/KitchenContext";
import KitchenDashboard from "./pages/kitchen/KitchenDashboard";
import DoughMakerPage from "./pages/kitchen/DoughMaker";
import RollingPage from "./pages/kitchen/Rolling";
import OvenRunnerPage from "./pages/kitchen/OvenRunner";
import ToppingPage from "./pages/kitchen/Topping";
import QCTLReport from "./pages/kitchen/QCTLReport";
import HomeAdmin from "./pages/Admin/AdminDashboard";
import RequestAdmin from "./pages/Admin/RequestAdmin";
import InventoryStore from "./pages/Admin/InventoryStore";
import Inventory from "./pages/store/inventory";
import AppLayoutStore from "./layout/AppLayoutStore";
import Request from "./pages/Store/Request";
import ProtectedRoute from "./components/ProtectedRoute";
import BulkChangePasswords from "./pages/BulkChangePasswords";
// import DashboardMarketing from "./pages/Marketing/DashboardMarketing";
import KitchenCalculation from "./pages/kitchen/KitchenCalculation";
import KitchenDough from "./pages/kitchen/KitchenDough";
import KitchenFilling from "./pages/kitchen/KitchenFilling";
import KitchenMerge from "./pages/kitchen/KitchenMerge";


// Marketing
import DashboardMarketing from "./pages/Marketing/DashboardMarketing";
import TargetProductionPlan from "./pages/Marketing/TargetProductionPlan";
import DashboardStore from "./pages/Store/DashboardStore";
import AdminBrands from "./pages/Admin/AdminBrands";
import QcList from "./pages/Marketing/QcList";
import DeliveryPrint from "./pages/Marketing/DeliveryPrint";
import AppLayoutAdmin from "./layout/AppLayoutAdmin";
import ItemBOMPage from "./pages/MainAdmin/ItemBOMPage";
import BrandManager from "./pages/MainAdmin/BrandManager";
import BrandLandingPage from "./pages/MainAdmin/BrandLandingPage";
import SfgLandingPage from "./pages/MainAdmin/SfgLandingPage";
import BrandToSfgPage from "./pages/MainAdmin/BrandToSfgPage";
import SfgManagePage from "./pages/MainAdmin/SfgManagePage";


// notif
import 'react-toastify/dist/ReactToastify.css';
import StoreManager from "./pages/MainAdmin/StoreManager";
import BrandStoresPage from "./pages/MainAdmin/BrandStoresPage";
import BrandItemsLanding from "./pages/MainAdmin/BrandItemsLanding";
import BrandGrid from "./pages/MainAdmin/StoreManager";
import BrandItemsPage from "./pages/MainAdmin/BrandItemsPage";
import BrandItemRecipes from "./pages/MainAdmin/BrandRecipesLanding";
import RecipesListPage from "./pages/MainAdmin/RecipesListPage";
import RecipeCreatePage from "./pages/MainAdmin/RecipeCreatePage";
import RecipeEditPage from "./pages/MainAdmin/RecipeEditPage";
import RecipeDetailPage from "./pages/MainAdmin/RecipeDetailPage";
import BrandRecipesLanding from "./pages/MainAdmin/BrandRecipesLanding";
import BrandRecipesListPage from "./pages/MainAdmin/BrandRecipesListPage";
import BrandRecipeCreateStep1 from "./pages/MainAdmin/BrandRecipeCreateStep1";
import BrandRecipeCreateStep2 from "./pages/MainAdmin/BrandRecipeCreateStep2";
import DashboardAdmin from "./pages/MainAdmin/DashboardAdmin";
import UomLanding from "./pages/MainAdmin/UomLanding";
import ItemCreatePage from "./pages/MainAdmin/ItemCreatePage";
import ItemViewPage from "./pages/MainAdmin/ItemViewPage";
import ItemEditPage from "./pages/MainAdmin/ItemEditPage";
import BrandSelectForProduction from "./pages/Marketing/BrandSelectForProduction";
import StoreInventoryPage from "./pages/Store/StoreInventoryPage";
import TransactionPage from "./pages/Store/components/TransactionPage";
import TransactionOutPage from "./pages/Store/components/TransactionOutPage";
import InventoryLedgerPage from "./pages/Store/InventoryLedgerPage";
import StoreRequestsPage from "./pages/Store/Request";
import CreateStoreRequestPage from "./pages/Store/CreateStoreRequestPage";
import StoreRequestDetailPage from "./pages/Store/StoreRequestDetailPage";
import RequestsByBrandPage from "./pages/Admin/RequestsByBrandPage";
import BrandSelectionPage from "./pages/Admin/BrandSelectionPage";
import BrandsListMarketing from "./pages/Marketing/BrandsListMarketing";
import CreateTargetPage from "./pages/Marketing/CreateTargetPage";


export default function App(): JSX.Element {
  return (
    <>
      <ScrollToTop />
      {/* KitchenProvider can be global or scoped to kitchen routes — keep global if many components need it */}
      <KitchenProvider>
        <Routes>
          {/* Public / Auth routes */}
          <Route path="/login" element={<SignIn />} />
          <Route path="/register" element={<SignUp />} />
          <Route path="/bulk" element={<BulkChangePasswords/>} />

          {/* Protected routes: AppLayout (main app) */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayoutCentral />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />

            {/* Marketing Pages */}
            <Route path="marketing" element={<DashboardMarketing />} />
            <Route path="marketing/target-production-plan" element={<TargetProductionPlan />} />
            <Route path="/marketing/ql-list" element={<QcList />} />
            <Route path="/marketing/delivery/:id" element={<DeliveryPrint />} />
            {/* <Route path="/marketing/delivery/create/:runId" element={<DeliveryCreate />} />  */}
            <Route path="/marketing/target-production-select-brand" element={<BrandSelectForProduction />} />
            <Route path="/marketing/brands" element={<BrandsListMarketing />} />
            <Route path="/brands/:brandId/targets/create" element={<CreateTargetPage />} />



            {/* Production / Kitchen-related pages */}
            <Route path="kitchen-targets" element={<KitchenTargetsPage />} />
            <Route path="kitchen-production" element={<KitchenProductionPage />} />

            {/* Other pages inside AppLayout */}
            <Route path="profile" element={<UserProfiles />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="blank" element={<Blank />} />

            {/* Forms */}
            <Route path="form-elements" element={<FormElements />} />

            {/* Tables */}
            <Route path="basic-tables" element={<BasicTables />} />
            <Route path="basic-tables-two" element={<BasicTablesTwo />} />
            <Route path="target-production-kitchen" element={<BasicTablesThree />} />

            {/* Ui Elements */}
            <Route path="alerts" element={<Alerts />} />
            <Route path="avatars" element={<Avatars />} />
            <Route path="badge" element={<Badges />} />
            <Route path="buttons" element={<Buttons />} />
            <Route path="images" element={<Images />} />
            <Route path="videos" element={<Videos />} />

            {/* Charts */}
            <Route path="line-chart" element={<LineChart />} />
            <Route path="bar-chart" element={<BarChart />} />
          </Route>

          {/* Protected routes with different layouts — kitchen */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayoutCentral />
              </ProtectedRoute>
            }
          >
            <Route path="kitchen" element={<KitchenDashboard />} />
            <Route path="/kitchen/calc/:date" element={<KitchenCalculation />} />
            <Route path="/kitchen/dough/:date" element={<KitchenDough />} />
            <Route path="/kitchen/filling/:date" element={<KitchenFilling />} />
            <Route path="/kitchen/merge/:date" element={<KitchenMerge />} />

            <Route path="/marketing/delivery/print/:id" element={<DeliveryPrintTemplate />} />



            <Route path="kitchen/dough" element={<DoughMakerPage />} />
            <Route path="kitchen/rolling" element={<RollingPage />} />
            <Route path="kitchen/oven" element={<OvenRunnerPage />} />
            <Route path="kitchen/topping" element={<ToppingPage />} />
            <Route path="kitchen/qc" element={<QCTLReport />} />
            <Route path="kitchen/delivery-note" element={<DeliveryNote />} />
          </Route>

          {/* Admin layout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayoutCentral />
              </ProtectedRoute>
            }
          >
            <Route path="admin" element={<HomeAdmin />} />
            <Route path="request-admin" element={<BrandSelectionPage />} />
            <Route path="inventory-store" element={<InventoryStore />} />
            <Route path="brands" element={<AdminBrands />} />
          </Route>

          {/* Store layout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayoutStore />
              </ProtectedRoute>
            }
          >
            <Route path="store" element={<DashboardStore />} />
            <Route path="store/inventory" element={<StoreInventoryPage />} />
            <Route path="/stores/:storeId/inventory" element={<StoreInventoryPage />} />
            <Route path="/stores/in/:storeId/transaction/:itemId" element={<TransactionPage />} />
            <Route path="/stores/out/:storeId/transaction/:itemId" element={<TransactionOutPage />} />
            <Route path="/stores/:storeId/transaction" element={<TransactionPage />} />
            <Route path="/stores/:storeId/inventory/:itemId/ledger" element={<InventoryLedgerPage />} />
            <Route path="store/request" element={<Request />} />
            <Route path="stores/requests/create" element={<CreateStoreRequestPage />} />
            <Route path="stores/requests/:id" element={<StoreRequestDetailPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <AppLayoutAdmin />
              </ProtectedRoute>
            }
          >
            <Route path="superadmin" element={<DashboardAdmin />} />
            <Route path="superadmin/brandsbom" element={<BrandLandingPage />} />
            <Route path="superadmin/itembom" element={<ItemBOMPage />} />
            <Route path="superadmin/brands" element={<BrandManager />} />
            <Route path="superadmin/stores" element={<StoreManager />} />
            <Route path="superadmin/brands/:id/stores" element={<BrandStoresPage />} />
            {/* <Route path="superadmin/reciepe" element={<BrandToSfgPage />} /> */}
            <Route path="superadmin/items" element={<BrandItemsLanding />} />
            <Route path="superadmin/brands/:id/items" element={<BrandItemsPage />} />

            <Route path="superadmin/reciepe" element={<BrandRecipesLanding />} />
            <Route path="superadmin/brands/:brandId/recipes" element={<BrandRecipesListPage />} />
            <Route path="superadmin/brands/:brandId/recipes/new" element={<BrandRecipeCreateStep1 />} />
            <Route path="superadmin/items/create" element={<ItemCreatePage />} />
            <Route path="superadmin/brands/:id/items/create" element={<ItemCreatePage />} />
            <Route path="superadmin/items/:id/view" element={<ItemViewPage />} />
            <Route path="/superadmin/items/:id/edit" element={<ItemEditPage />} />

            <Route path="superadmin/uoms" element={<UomLanding />} />

            {/* <Route path="superadmin/brands/:brandId/items/:itemId/recipes" element={<BrandRecipeCreateStep2 />} /> */}
            <Route path="superadmin/brands/:brandId/items/:itemId/recipes/new" element={<BrandRecipeCreateStep2 />} />
            <Route path="superadmin/brands/:brandId/items/:itemId/recipes/:recipeId/edit" element={<RecipeEditPage />} />
            <Route path="superadmin/brands/:brandId/items/:itemId/recipes/:recipeId" element={<RecipeDetailPage />} />

            <Route path="/items/brand-to-sfg" element={<BrandToSfgPage />} />
            <Route path="/items/sfg/:id" element={<SfgManagePage />} />
            <Route path="/items/sfg/:id/view" element={<SfgManagePage />} />
          </Route>

          {/* Catch-all NotFound */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </KitchenProvider>
    </>
  );
}
