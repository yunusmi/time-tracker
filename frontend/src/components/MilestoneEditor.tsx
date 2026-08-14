'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { SkeletonRows } from '@/components/Skeleton';
import type { Milestone, MilestoneStatus } from '@/lib/types';

const NEXT_STATUS: Record<MilestoneStatus, MilestoneStatus> = {
  plan: 'in_progress',
  in_progress: 'done',
  done: 'plan',
};

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  plan: 'план',
  in_progress: 'в работе',
  done: 'готово',
};

function dateLabel(iso: string | null): string {
  if (!iso) return 'без срока';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Редактор вех проекта (Проекты, admin/pm): клик по кружку циклит
 * план → в работе → готово; те же вехи видит клиент в своём дашборде.
 */
export function MilestoneEditor({
  projectId,
  editable,
}: {
  projectId: string;
  editable: boolean;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<Milestone[] | null>(null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await api.listMilestones(projectId));
    } catch {
      setItems([]);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!title.trim()) return;
    try {
      const created = await api.createMilestone(projectId, {
        title: title.trim(),
        due_date: due || null,
      });
      setItems((prev) => [...(prev ?? []), created]);
      setTitle('');
      setDue('');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось добавить веху');
    }
  }

  async function cycle(m: Milestone) {
    const status = NEXT_STATUS[m.status];
    setItems((prev) =>
      (prev ?? []).map((x) => (x.id === m.id ? { ...x, status } : x)),
    );
    try {
      await api.updateMilestone(m.id, { status });
    } catch {
      void load();
      toast('Не удалось изменить статус вехи');
    }
  }

  async function remove(m: Milestone) {
    setItems((prev) => (prev ?? []).filter((x) => x.id !== m.id));
    await api.deleteMilestone(m.id).catch(() => void load());
  }

  return (
    <div style={{ padding: '4px 0 10px' }}>
      {items === null ? (
        <SkeletonRows rows={2} height={30} />
      ) : (
        <>
          {items.map((m) => (
            <div key={m.id} className="ms-row">
              <button
                className={`ms-dot ${m.status}`}
                title={
                  editable
                    ? `Статус: ${STATUS_LABEL[m.status]} — нажмите, чтобы изменить`
                    : STATUS_LABEL[m.status]
                }
                disabled={!editable}
                onClick={() => void cycle(m)}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: '13px',
                  textDecoration: m.status === 'done' ? 'line-through' : 'none',
                  color: m.status === 'done' ? 'var(--muted)' : 'var(--text)',
                }}
              >
                {m.title}
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                {dateLabel(m.due_date)}
              </span>
              {editable && (
                <button className="icon-x" title="Удалить веху" onClick={() => void remove(m)}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <div className="muted" style={{ fontSize: '12.5px', padding: '4px 0' }}>
              Вех пока нет — их увидит клиент в своём дашборде.
            </div>
          )}
        </>
      )}

      {editable && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input
            className="input input-sm"
            style={{ flex: 1, minWidth: 160 }}
            placeholder="Название вехи, например «Бета-версия»"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add();
            }}
          />
          <input
            type="date"
            className="input input-sm"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <button className="btn btn-outline" onClick={() => void add()}>
            + Веха
          </button>
        </div>
      )}
    </div>
  );
}
