'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

interface ToastContextValue {
  /** Тост на ~2.6с; с undo — 5с и кнопкой «Отменить». */
  toast: (message: string, undo?: () => void | Promise<void>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [undoFn, setUndoFn] = useState<(() => void | Promise<void>) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback(
    (msg: string, undo?: () => void | Promise<void>) => {
      clearTimeout(timer.current);
      setMessage(msg);
      setUndoFn(() => undo ?? null);
      timer.current = setTimeout(
        () => {
          setMessage(null);
          setUndoFn(null);
        },
        undo ? 5000 : 2600,
      );
    },
    [],
  );

  function onUndo() {
    const fn = undoFn;
    clearTimeout(timer.current);
    setMessage(null);
    setUndoFn(null);
    if (fn) void fn();
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {message && (
        <div className="toast" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{message}</span>
          {undoFn && (
            <button
              onClick={onUndo}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
            >
              Отменить
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
