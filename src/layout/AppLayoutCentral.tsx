import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeaderCentral from "./Partials/Central/AppHeaderCentral";
import Backdrop from "./Backdrop";
import AppSidebarCentral from "./Partials/Central/AppSidebarCentral";


const LayoutContentCentral: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen xl:flex">
      <div>
        <AppSidebarCentral />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeaderCentral />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const AppLayoutCentral: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContentCentral />
    </SidebarProvider>
  );
};

export default AppLayoutCentral;
