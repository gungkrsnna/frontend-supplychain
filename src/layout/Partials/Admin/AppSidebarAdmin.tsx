import { useCallback, useEffect, useRef, useState, useMemo, useContext } from "react";
import { Link, useLocation } from "react-router";
import {
  BoxCubeIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PlugInIcon,
  TableIcon,
} from "../../../icons";
import { useSidebar } from "../../../context/SidebarContext";
import { AuthContext } from "../../../context/AuthContext";

// replace MASTER_NAV + ROLE_MAP + getNavItemsForRole with this ROLE_NAV approach

/* NavItem type (sama seperti sebelumnya) */
export type NavItem = {
  icon?: React.ReactNode;
  name: string;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean }[];
};

/**
 * ROLE_NAV: each role has its own explicit nav array.
 * Keys are role names (lowercase) or stringified role ids.
 * Customize paths/icons per role here.
 */
const ROLE_NAV: Record<string, NavItem[]> = {
  // Owner sees admin dashboard, requests and inventory admin pages
  superadmin: [
    { icon: <BoxCubeIcon />, name: "Dashboard", path: "/superadmin" },
    // { icon: <GridIcon />, name: "Brand", path: "/superadmin/brands" },
    { icon: <ListIcon />, name: "Store Inventories", path: "/superadmin/store-inventories" },
    { icon: <TableIcon />, name: "Target Production", path: "/superadmin/target-production" },
    { icon: <PageIcon />, name: "Surat Jalan", path: "/superadmin/surat-jalan" },
    // { icon: <PageIcon />, name: "Reciepe", path: "/superadmin/reciepe" },
    { icon: <PlugInIcon />, name: "Request", path: "/superadmin/request" },

    {
      icon: <GridIcon />,
      name: "Settings",
      subItems: [
        { name: "Manajemen Brand", path: "/superadmin/brands", pro: false },
        { name: "Manajemen Store", path: "/superadmin/stores", pro: false },
        { name: "Item Inventories", path: "/superadmin/items", pro: false },
        { name: "Manajemen UOM", path: "/superadmin/uoms", pro: false },
        { name: "Reciepes", path: "/superadmin/reciepe", pro: false },
        { name: "Users", path: "/superadmin/users", pro: false },
      ],
    },
  ],

  // fallback guest / default
  guest: [
    { icon: <BoxCubeIcon />, name: "Dashboard", path: "/" },
  ],
};

/* helper normalize role (same as before) */
function normalizeRole(role: string | number | { id?: number; name?: string } | undefined | null) {
  if (role === null || role === undefined) return "guest";
  if (typeof role === "string") return role.toLowerCase();
  if (typeof role === "number") return String(role);
  if (typeof role === "object") {
    if (role.name) return String(role.name).toLowerCase();
    if (typeof role.id === "number") return String(role.id);
  }
  return "guest";
}

/* use this in sidebar: */
function getNavItemsForRole(role: string | number | { id?: number; name?: string } | undefined | null): NavItem[] {
  const key = normalizeRole(role);
  // prefer explicit role; fallback to guest
  return ROLE_NAV[key] ?? ROLE_NAV["guest"];
}

/* ---------------------------------------------
 * 5️⃣ Komponen utama sidebar
 * --------------------------------------------- */
const AppSidebarAdmin: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const { user } = useContext(AuthContext) ?? {};

  // Ambil role dari user context atau localStorage
  const roleCandidate =
    user?.role ?? user?.role_id ?? JSON.parse(localStorage.getItem("user") || "{}")?.role ?? "guest";

  const navItems = useMemo(() => getNavItemsForRole(roleCandidate), [roleCandidate]);

  const [openSubmenu, setOpenSubmenu] = useState<{ type: "main" | "others"; index: number } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

  useEffect(() => {
    let submenuMatched = false;
    navItems.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path!)) {
            setOpenSubmenu({ type: "main", index });
            submenuMatched = true;
          }
        });
      }
    });
    if (!submenuMatched) setOpenSubmenu(null);
  }, [location, isActive, navItems]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    setOpenSubmenu((prev) =>
      prev && prev.index === index ? null : { type: "main", index }
    );
  };

  const renderMenuItems = (items: NavItem[]) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index)}
              className={`menu-item group ${
                openSubmenu?.index === index ? "menu-item-active" : "menu-item-inactive"
              } ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
            >
              <span
                className={`menu-item-icon-size ${
                  openSubmenu?.index === index ? "menu-item-icon-active-kitchen" : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.index === index ? "rotate-180 text-brand-500" : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active-kitchen" : "menu-item-inactive-kitchen"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text">{nav.name}</span>
                )}
              </Link>
            )
          )}

          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => (subMenuRefs.current[`main-${index}`] = el)}
              className="overflow-hidden transition-all duration-300"
              style={{
                height: openSubmenu?.index === index ? `${subMenuHeight[`main-${index}`]}px` : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      to={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link to="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <img
                className="dark:hidden"
                src="/images/logo/logo-kitchen.svg"
                alt="Logo"
                width={80}
                height={40}
                style={{ borderRadius: "10px" }}
              />
              <img
                className="hidden dark:block"
                src="/images/logo/logo-kitchen.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <img
              src="/images/logo/logo-kitchen.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>

      {/* Menu */}
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? "Menu" : <HorizontaLDots className="size-6" />}
              </h2>
              {renderMenuItems(navItems)}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebarAdmin;
