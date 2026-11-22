import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx.js";
import styles from "./Toast.module.css";

type ToastTone = "info" | "success" | "danger";
interface ToastItem { id: number; message: string; tone: ToastTone }

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void }>({ push: () => undefined });

/** Short-lived confirmations in a polite live region; at most four stay on screen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {items.map((item) => <div key={item.id} className={cx(styles.toast, styles[item.tone])} data-testid="toast">{item.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
