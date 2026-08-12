'use client';

import { useEffect, useRef, useState } from 'react';
import type { TaskWithStats } from '@/lib/types';
import { projectColor } from '@/lib/project';

/** Кастомный dropdown выбора задачи (как в дизайне, вместо <select>). */
export function TaskDropdown({
  tasks,
  value,
  placeholder,
  onPick,
  small,
}: {
  tasks: TaskWithStats[];
  value: string;
  placeholder: string;
  onPick: (id: string) => void;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = tasks.find((t) => t.id === value);

  return (
    <div className="menu-wrap" ref={ref} style={{ flex: 1, minWidth: small ? 130 : 150 }}>
      <button
        className="dd-btn"
        style={small ? { borderRadius: 7, padding: '7px 10px' } : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            color: selected ? 'var(--text)' : 'var(--muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selected ? selected.title : placeholder}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div className="menu">
          <div
            className="menu-item"
            style={{ color: 'var(--muted)' }}
            onClick={() => {
              onPick('');
              setOpen(false);
            }}
          >
            Без задачи
          </div>
          {tasks.map((t) => (
            <div
              key={t.id}
              className="menu-item"
              onClick={() => {
                onPick(t.id);
                setOpen(false);
              }}
            >
              <span className="pdot" style={{ background: projectColor(t) }} />
              {t.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
