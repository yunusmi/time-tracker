'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatHM } from '@/lib/format';
import { PROJECT_COLORS } from '@/lib/project';
import type { ProjectWithStats } from '@/lib/types';
import { useToast } from '@/context/ToastContext';

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [error, setError] = useState('');

  // Форма создания
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PROJECT_COLORS[4]);

  // Инлайн-переименование
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    try {
      setProjects(await api.listProjects());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить проекты');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addProject() {
    const n = name.trim();
    if (!n) return;
    try {
      await api.createProject({ name: n, color });
      setName('');
      toast('Проект создан');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось создать проект');
    }
  }

  async function saveName(id: string) {
    const n = editName.trim();
    setEditingId(null);
    if (!n) return;
    try {
      await api.updateProject(id, { name: n });
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось переименовать');
    }
  }

  async function archive(id: string) {
    try {
      await api.updateProject(id, { archived: true });
      toast('Проект в архиве, записи времени сохранены');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось архивировать');
    }
  }

  const maxWeek = Math.max(...projects.map((p) => p.week_tracked_seconds), 1);

  return (
    <div>
      {error && <p className="error">{error}</p>}

      {/* Форма создания */}
      <div
        className="card"
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 14,
        }}
      >
        <input
          className="input input-sm"
          placeholder="Название нового проекта"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addProject();
          }}
          style={{ flex: 1 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 18,
                height: 18,
                borderRadius: 6,
                background: c,
                border: 'none',
                outline: c === color ? '2px solid var(--accent)' : '2px solid transparent',
                outlineOffset: 2,
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
        <button
          className="btn btn-accent"
          style={{ borderRadius: 7, padding: '8px 16px', fontSize: 13 }}
          onClick={() => void addProject()}
        >
          + Создать
        </button>
      </div>

      {/* Список */}
      <div className="card">
        {projects.map((p) => (
          <div className="list-row" key={p.id} style={{ padding: '12px 16px' }}>
            <span
              className="pdot"
              style={{ width: 10, height: 10, borderRadius: 3, background: p.color }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === p.id ? (
                <input
                  className="input"
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveName(p.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => void saveName(p.id)}
                  style={{
                    width: '60%',
                    borderColor: 'var(--accent)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: '13.5px',
                  }}
                />
              ) : (
                <div
                  title="Нажмите, чтобы переименовать"
                  onClick={() => {
                    setEditingId(p.id);
                    setEditName(p.name);
                  }}
                  style={{ fontWeight: 600, cursor: 'text' }}
                >
                  {p.name}
                </div>
              )}
              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 2 }}>
                {p.task_count} задач(и)
              </div>
            </div>
            <div style={{ width: 180, flexShrink: 0 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'var(--muted)',
                  marginBottom: 3,
                }}
              >
                <span>за неделю</span>
                <span className="mono">{formatHM(p.week_tracked_seconds)}</span>
              </div>
              <div className="progress" style={{ height: 4 }}>
                <div
                  style={{
                    background: p.color,
                    width: `${Math.round((p.week_tracked_seconds / maxWeek) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <button
              className="btn-outline"
              title="Архивировать проект"
              style={{ color: 'var(--muted)', flexShrink: 0 }}
              onClick={() => void archive(p.id)}
            >
              В архив
            </button>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="empty">
            <div className="empty-title">Проектов нет</div>
            <div className="empty-sub">
              Создайте первый проект — цвет пригодится в таймлайне и отчётах.
            </div>
          </div>
        )}

        <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--muted)' }}>
          Архив скрывает проект из списков, записи времени остаются в отчётах.
        </div>
      </div>
    </div>
  );
}
