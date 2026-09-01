import React, { useEffect, useState } from "react";

/**
 * Bottom-centre toast column for the `mois-toast` window event the MOIS
 * scope's lifecycle actions (and our errorDispatch) emit. Detail is a plain
 * string. Ported from the app's preview host.
 */

const TOAST_EVENT = "mois-toast";
const TOAST_DURATION_MS = 3000;

interface Toast {
  id: number;
  message: string;
}

let nextToastId = 1;

export const MoisToastHost: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const message = typeof detail === "string" ? detail : "";
      if (!message) return;
      const id = nextToastId++;
      setToasts((current) => [...current, { id, message }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, TOAST_DURATION_MS);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div
      style={{
        alignItems: "center",
        bottom: 24,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        left: 0,
        pointerEvents: "none",
        position: "fixed",
        right: 0,
        zIndex: 1000100,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          style={{
            background: "#323130",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            color: "#fff",
            fontSize: 13,
            maxWidth: 480,
            padding: "8px 16px",
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};
