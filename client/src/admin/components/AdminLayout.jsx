import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import "../styles/admin-dashboard.css";

import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";

const AdminLayout = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const targetId = decodeURIComponent(location.hash.replace("#", ""));
      const target = document.getElementById(targetId);

      if (!target) {
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("admin-search-highlight");

      window.setTimeout(() => {
        target.classList.remove("admin-search-highlight");
      }, 1800);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname]);

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-main">
        <AdminTopbar />
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
