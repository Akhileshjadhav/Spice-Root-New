import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { getAuthErrorMessage } from "../../lib/authErrors";
import "../../styles/auth-pages.css";
import "../../styles/luxury-spice.css";

function ForgotPassword() {
  const location = useLocation();
  const { loading: authLoading, isAdmin, isAuthenticated, resetPassword } = useAuth();
  const hasCustomerSession = isAuthenticated && !isAdmin;
  const [email, setEmail] = useState(location.state?.email || "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (authLoading) {
    return <div className="auth-route-loading">Checking your session...</div>;
  }

  if (hasCustomerSession) {
    return <Navigate to="/account" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    try {
      setSending(true);
      await resetPassword(email.trim());
      setMessage("Password reset link sent. Please check your registered email inbox.");
    } catch (authError) {
      setError(getAuthErrorMessage(authError, "Unable to send reset email right now."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="auth-route-shell">
      <div className="auth-route-card">
        <div className="auth-route-head">
          <span>Password Reset</span>
          <h1>Forgot your password?</h1>
          <p>Enter your registered email address and we will send a password reset link to that inbox.</p>
        </div>

        <form className="auth-route-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="forgot-password-email">Registered Email</label>
            <input
              id="forgot-password-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </div>

          {error ? <div className="auth-route-error">{error}</div> : null}
          {message ? <div className="auth-route-message">{message}</div> : null}

          <button type="submit" className="auth-primary-button" disabled={sending}>
            {sending ? "Sending reset link..." : "Send reset link"}
          </button>
        </form>

        <p className="auth-route-footer">
          Remembered your password? <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;
