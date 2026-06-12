import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import "../../styles/auth-pages.css";

function ProtectedRoute({ children, allowAdmins = true }) {
  const { isAdmin, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const redirectPath = `${location.pathname}${location.search}${location.hash}`;

  if (loading) {
    return <div className="auth-route-loading">Checking your session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: redirectPath }} />;
  }

  if (!allowAdmins && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
