import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getAuthErrorMessage } from "../../lib/authErrors";
import { getPostAuthRedirectPath } from "../../lib/authRedirects";
import "../../styles/auth-pages.css";

function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    loading: authLoading,
    isAdmin,
    isAuthenticated,
    loginAdmin,
    resetPassword,
  } = useAuth();
  const [form, setForm] = useState({
    email: location.state?.email || "",
    password: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState(location.state?.message || "");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const requestedPath = location.state?.from;
  const redirectTarget = getPostAuthRedirectPath(requestedPath, "/admin/dashboard");

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (authLoading) {
    return <div className="auth-route-loading">Checking your admin session...</div>;
  }

  if (isAuthenticated && isAdmin) {
    return <Navigate to={redirectTarget} replace />;
  }

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setToast(null);

    if (!form.email || !form.password) {
      setError("Please enter your admin email and password.");
      setToast({ type: "error", text: "Admin login failed. Email and password are required." });
      return;
    }

    try {
      setLoading(true);
      await loginAdmin(form);
      setToast({ type: "success", text: "Admin Login Successful" });
      window.setTimeout(() => navigate(redirectTarget, { replace: true }), 650);
    } catch (authError) {
      setError(getAuthErrorMessage(authError, "Unable to sign in to the admin portal right now."));
      setToast({ type: "error", text: "Admin login failed." });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    setMessage("");
    setToast(null);

    if (!form.email) {
      setError("Enter your admin email first to receive a password reset link.");
      return;
    }

    try {
      setResetLoading(true);
      await resetPassword(form.email);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (authError) {
      setError(getAuthErrorMessage(authError, "Unable to send reset email."));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-route-shell">
      {toast ? <div className={`auth-toast ${toast.type}`}>{toast.text}</div> : null}

      <div className="auth-route-card">
        <div className="auth-route-topbar">
          <span className="auth-route-kicker">Admin Access</span>
          <Link to="/" className="auth-route-utility-link">
            Preview Website
          </Link>
        </div>

        <div className="auth-route-head">
          <span>Admin Portal</span>
          <h1>Admin Login</h1>
          <p>Sign in with an approved admin email and password to manage live website data.</p>
        </div>

        {isAuthenticated && !isAdmin ? (
          <div className="auth-route-message">
            You are currently signed in as {currentUser?.email || "a customer"}. Enter an approved admin account below to switch to the admin portal.
          </div>
        ) : null}

        <form className="auth-route-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="admin-email">Admin Email</label>
            <input
              id="admin-email"
              type="email"
              value={form.email}
              onChange={(event) => handleChange("email", event.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={form.password}
              onChange={(event) => handleChange("password", event.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className="auth-route-error">{error}</div> : null}
          {message ? <div className="auth-route-message">{message}</div> : null}

          <div className="auth-route-actions">
            <button type="submit" className="auth-primary-button" disabled={loading}>
              {loading ? "Signing in..." : "Open Dashboard"}
            </button>

            <div className="auth-route-inline">
              <span className="auth-inline-status">Forgot your password?</span>
              <button
                type="button"
                className="auth-text-button"
                onClick={handleResetPassword}
                disabled={resetLoading}
              >
                {resetLoading ? "Sending..." : "Reset password"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
