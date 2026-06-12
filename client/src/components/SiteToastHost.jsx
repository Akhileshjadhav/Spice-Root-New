import { useEffect, useState } from "react";
import { SITE_TOAST_EVENT } from "../lib/siteToast";

function SiteToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    console.log("SITE TOAST HOST MOUNTED");

    const handleToast = (event) => {
      console.log("TOAST RECEIVED", event.detail);

      const toast = event.detail;

      if (!toast?.message) {
        return;
      }

      setToasts((current) => [...current, toast].slice(-3));

      window.setTimeout(() => {
        setToasts((current) =>
          current.filter((item) => item.id !== toast.id)
        );
      }, 3200);
    };

    window.addEventListener(SITE_TOAST_EVENT, handleToast);

    return () => {
      window.removeEventListener(SITE_TOAST_EVENT, handleToast);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 999999,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: toast.type === "error" ? "#dc2626" : "#16a34a",
            color: "#fff",
            padding: "12px 16px",
            marginBottom: "10px",
            borderRadius: "8px",
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export default SiteToastHost;