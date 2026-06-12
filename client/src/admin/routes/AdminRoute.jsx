import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import "../../styles/auth-pages.css";

const ADMIN_SESSION_FLAG = "spice-root-auth-session-role";

function hadPreviousAdminSession() {
  try {
    return window.localStorage.getItem(ADMIN_SESSION_FLAG) === "admin";
  } catch {
    return false;
  }
}

function AdminRoute({ children }) {
  const { loading, isAdmin, isAuthenticated } = useAuth();
  const location = useLocation();
  const redirectPath = `${location.pathname}${location.search}${location.hash}`;

  // While Firebase is resolving auth state, if we previously had an admin
  // session, show loading instead of instantly redirecting to '/'.
  if (loading) {
    if (hadPreviousAdminSession()) {
      return <div className="auth-route-loading">Checking your admin session...</div>;
    }
    return <div className="auth-route-loading">Checking your session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: redirectPath }} />;
  }

  if (!isAdmin) {
    // Only redirect non-admins away if we know for certain loading is done
    // and the session role didn't resolve to admin.
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;
