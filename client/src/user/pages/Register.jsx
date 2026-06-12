import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getAuthErrorMessage } from "../../lib/authErrors";
import { getPostAuthRedirectPath } from "../../lib/authRedirects";
import { showSiteToast } from "../../lib/siteToast";
import "../../styles/auth-pages.css";
import "../../styles/luxury-spice.css";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: authLoading, isAdmin, isAuthenticated, registerUser } = useAuth();
  const hasCustomerSession = isAuthenticated && !isAdmin;
  const [form, setForm] = useState({
    firstName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestedPath = location.state?.from;
  const redirectTarget = getPostAuthRedirectPath(requestedPath);

  if (authLoading) {
    return <div className="auth-route-loading">Checking your session...</div>;
  }

  if (hasCustomerSession) {
    return <Navigate to={redirectTarget} replace />;
  }

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }

    if (!isValidEmail(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await registerUser({
        firstName: form.firstName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      showSiteToast("Registration successful. Please Login to continue!");
      navigate("/login", { replace: true });
    } catch (authError) {
      setError(getAuthErrorMessage(authError, "Unable to create your account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-route-shell">
      <div className="auth-route-card">
        <div className="auth-route-tabs" role="tablist" aria-label="Authentication tabs">
          <Link to="/register" className="auth-route-tab active" aria-current="page">Register</Link>
          <Link to="/login" className="auth-route-tab">Login</Link>
        </div>

        <div className="auth-route-head">
          <span>Register</span>
          <h1>Create your account</h1>
          <p>Set up your account to save your details and keep your session active across visits.</p>
        </div>

        <form className="auth-route-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="register-first-name">First Name</label>
            <input
              id="register-first-name"
              type="text"
              value={form.firstName}
              onChange={(event) => handleChange("firstName", event.target.value)}
              placeholder="Your first name"
              autoComplete="given-name"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              value={form.email}
              onChange={(event) => handleChange("email", event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              value={form.password}
              onChange={(event) => handleChange("password", event.target.value)}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
            />
            <p className="auth-field-hint">Use at least 8 characters for a stronger password.</p>
          </div>

          <div className="auth-field">
            <label htmlFor="register-confirm-password">Confirm Password</label>
            <input
              id="register-confirm-password"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => handleChange("confirmPassword", event.target.value)}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
          </div>
          {error ? <div className="auth-route-error">{error}</div> : null}

          <button type="submit" className="auth-primary-button" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-route-footer">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
