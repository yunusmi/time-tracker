'use client';

import { useEffect, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  /** Явное название объекта: «Проект „Разработка“ и 12 записей». */
  description: string;
  confirmLabel?: string;
  /** Если задано — подтверждение требует ввода этой строки (удаление аккаунта). */
  requireText?: string;
  danger?: boolean;
}

/**
 * Модалка подтверждения опасного действия (ТЗ: удаление проекта/задачи с
 * записями/аккаунта, «Выйти везде», отзыв публичной ссылки).
 */
export function ConfirmDialog({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    setTyped('');
  }, [options]);

  useEffect(() => {
    if (!options) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onCancel]);

  if (!options) return null;

  const blocked = !!options.requireText && typed.trim() !== options.requireText;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{options.title}</h3>
        <p>{options.description}</p>
        {options.requireText && (
          <input
            className="input"
            autoFocus
            value={typed}
            placeholder={options.requireText}
            onChange={(e) => setTyped(e.target.value)}
            style={{ marginBottom: 14 }}
          />
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Отмена
          </button>
          <button
            className={options.danger === false ? 'btn btn-accent' : 'btn btn-red'}
            disabled={blocked}
            onClick={onConfirm}
          >
            {options.confirmLabel ?? 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Хук: `const confirm = useConfirm(); await confirm({...})`. */
export function useConfirm() {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = (options: ConfirmOptions): Promise<boolean> =>
    new Promise((resolve) => setState({ options, resolve }));

  const dialog = (
    <ConfirmDialog
      options={state?.options ?? null}
      onConfirm={() => {
        state?.resolve(true);
        setState(null);
      }}
      onCancel={() => {
        state?.resolve(false);
        setState(null);
      }}
    />
  );

  return { confirm, dialog };
}
