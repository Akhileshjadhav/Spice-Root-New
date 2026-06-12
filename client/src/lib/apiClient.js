const DEV_API_BASE_URL = "http://localhost:3001/api";

export function getApiBaseUrl() {
  const configuredUrl = String(import.meta.env.VITE_API_URL || "").trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (import.meta.env.DEV) {
    return DEV_API_BASE_URL;
  }

  throw new Error("VITE_API_URL is not configured for this deployment.");
}

export async function apiRequest(path, { user, method = "GET", body, headers = {} } = {}) {
  const requestHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (user) {
    const token = await user.getIdToken();
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: requestHeaders,
      ...(body !== undefined ? { body } : {}),
    });
  } catch (error) {
    if (error.name === "TypeError") {
      throw new Error("Could not connect to the Spice Root server. Please try again later.");
    }

    throw error;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Server error (${response.status})`);
  }

  return payload;
}
