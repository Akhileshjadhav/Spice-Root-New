const AUTH_ERROR_MESSAGES = {
  "auth/email-already-in-use": "This email is already registered. Try logging in instead.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/invalid-credential": "Your email or password is incorrect.",
  "auth/user-not-found": "No account was found for this email address.",
  "auth/wrong-password": "Your email or password is incorrect.",
  "auth/weak-password": "Use at least 8 characters to create a stronger password.",
  "auth/popup-closed-by-user": "The Google sign-in popup was closed before completing sign-in.",
  "auth/cancelled-popup-request": "Google sign-in was interrupted. Please try again.",
  "auth/too-many-requests": "Too many attempts were made. Please wait a moment and try again.",
  "auth/network-request-failed": "A network error occurred. Check your connection and try again.",
  "auth/missing-password": "Please enter your password.",
  "auth/user-disabled": "This account has been disabled. Contact support for help.",
  "auth/admin-only-route":
    "This email is registered for admin access. Sign in from the admin login page instead.",
  "auth/not-admin": "This account does not have admin access.",
  "auth/admin-disabled": "This admin account is currently disabled.",
};

export function getAuthErrorMessage(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  return AUTH_ERROR_MESSAGES[error.code] || error.message || fallbackMessage;
}
