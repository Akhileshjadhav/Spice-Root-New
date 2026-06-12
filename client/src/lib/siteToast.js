const SITE_TOAST_EVENT = "spice-root:toast";

export function showSiteToast(message, options = {}) {
  if (typeof window === "undefined" || !message) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(SITE_TOAST_EVENT, {
      detail: {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        type: options.type || "success",
      },
    })
  );
}

export { SITE_TOAST_EVENT };
