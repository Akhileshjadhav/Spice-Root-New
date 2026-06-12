const AUTH_ROUTES = new Set(["/login", "/register", "/forgot-password", "/admin/login"]);

export function getPostAuthRedirectPath(requestedPath, fallbackPath = "/") {
  const targetPath = typeof requestedPath === "string" ? requestedPath.trim() : "";

  if (!targetPath || AUTH_ROUTES.has(targetPath)) {
    return fallbackPath;
  }

  return targetPath;
}
