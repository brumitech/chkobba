// apps/frontend/src/ui/toast.tsx
"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ToastVariant = "default" | "success" | "warning" | "destructive" | "info";

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function getVariantStyles(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return "bg-green-600 border-green-500";
    case "warning":
      return "bg-amber-600 border-amber-500";
    case "destructive":
      return "bg-red-600 border-red-500";
    case "info":
      return "bg-blue-600 border-blue-500";
    default:
      return "bg-gray-800 border-gray-700";
  }
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const variantStyles = getVariantStyles(toast.variant || "default");

  return (
    <motion.div
      key={toast.id}
      layout
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`rounded-lg border px-4 py-3 shadow-lg ${variantStyles} text-white`}
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <h3 className="font-semibold">{toast.title}</h3>
          {toast.description && <p className="text-sm opacity-90">{toast.description}</p>}
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white p-1"
          aria-label="Close"
        >
          &times;
        </button>
      </div>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now();
    const duration = toast.duration || 5000;

    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto remove after duration
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}