'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError, clearToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useConfirm } from '@/components/ConfirmDialog';
import { WorkspaceBadge } from '@/components/Logo';
import { cropToSquareDataUrl } from '@/lib/image';
import { parseTimeEntriesCsv } from '@/lib/import-csv';
import { CURRENCIES, CURRENCY_SYMBOL } from '@/lib/money';
import type { Currency, Department } from '@/lib/types';

const BRAND_COLORS = [
  '#6366f1',
  '#60a5fa',
  '#f472b6',
  '#fbbf24',
  '#34d399',
  '#a78bfa',
];

const INTEGRATIONS = [
  { k: 'gcal', ini: 'G', name: 'Google Calendar', desc: 'Записи времени — событиями в календаре' },
  { k: 'slack', ini: 'S', name: 'Slack', desc: 'Дайджест дня и авто-пост стендапа' },
  { k: 'tg', ini: 'T', name: 'Telegram', desc: 'Напоминания и быстрый старт таймера' },
] as const;

/** Настройки → Данные и интеграции: компания, отделы, интеграции, API, GDPR. */
export function DataSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { me, isAdmin, departments, refreshMe, refreshMembers } = useWorkspace();
  const { confirm, dialog } = useConfirm();

  const logoRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [depInput, setDepInput] = useState('');
  const [deps, setDeps] = useState<Department[]>([]);
  const [integr, setIntegr] = useState<Record<string, boolean>>({});
  const [apiKey, setApiKey] = useState('');
  const [webhook, setWebhook] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<string | null>(null);

  useEffect(() => setName(me?.workspace_name ?? ''), [me?.workspace_name]);
  useEffect(() => setDeps(departments), [departments]);

  useEffect(() => {
    try {
      setIntegr(JSON.parse(window.localStorage.getItem('tt_integrations') ?? '{}'));
      setApiKey(window.localStorage.getItem('tt_api_key') ?? '');
      setWebhook(window.localStorage.getItem('tt_webhook') ?? '');
    } catch {
      /* ignore */
    }
  }, []);

  async function saveWorkspace(patch: {
    name?: string;
    currency?: Currency;
    brand_color?: string;
    logo_url?: string | null;
  }) {
    try {
      await api.updateWorkspace(patch);
      await refreshMe();
      toast('Настройки компании сохранены');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    }
  }

  async function onLogoPick(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await cropToSquareDataUrl(file, 256);
      await saveWorkspace({ logo_url: dataUrl });
    } catch {
      toast('Не удалось загрузить логотип');
    }
  }

  async function addDepartment() {
    const value = depInput.trim();
    if (!value) return;
    try {
      const dep = await api.createDepartment(value);
      setDeps((prev) => [...prev, dep]);
      setDepInput('');
      void refreshMembers();
    } catch {
      toast('Не удалось создать отдел');
    }
  }

  async function removeDepartment(dep: Department) {
    const ok = await confirm({
      title: 'Удалить отдел?',
      description: `Отдел «${dep.name}» будет удалён, сотрудники останутся без отдела.`,
    });
    if (!ok) return;
    await api.deleteDepartment(dep.id).catch(() => undefined);
    setDeps((prev) => prev.filter((d) => d.id !== dep.id));
    void refreshMembers();
  }

  function toggleIntegration(k: string) {
    const next = { ...integr, [k]: !integr[k] };
    setIntegr(next);
    window.localStorage.setItem('tt_integrations', JSON.stringify(next));
    toast(next[k] ? 'Интеграция подключена (демо)' : 'Интеграция отключена');
  }

  async function regenerateApiKey() {
    const ok = await confirm({
      title: 'Перевыпустить API-ключ?',
      description:
        'Старый ключ мгновенно перестанет работать — интеграции, использующие его, потребуют обновления.',
      confirmLabel: 'Перевыпустить',
    });
    if (!ok) return;
    const key = `chr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    setApiKey(key);
    window.localStorage.setItem('tt_api_key', key);
    toast('API-ключ перевыпущен');
  }

  /**
   * Импорт CSV-экспорта Toggl / Clockify / Harvest: недостающие проекты и
   * задачи создаются, записи времени добавляются как ручные.
   */
  async function onImportFile(file?: File) {
    if (!file) return;
    setImporting(true);
    setImportReport(null);
    try {
      const { rows, skipped } = parseTimeEntriesCsv(await file.text());
      if (!rows.length) {
        setImportReport('Не нашли ни одной строки с датой и длительностью.');
        return;
      }

      const projects = await api.listProjects(true);
      const projectByName = new Map(
        projects.map((p) => [p.name.toLowerCase(), p.id]),
      );
      const tasks = await api.listTasks();
      const taskByTitle = new Map(tasks.map((t) => [t.title.toLowerCase(), t.id]));

      let imported = 0;
      let failed = 0;
      for (const row of rows) {
        try {
          let projectId: string | undefined;
          if (row.project) {
            const key = row.project.toLowerCase();
            if (!projectByName.has(key)) {
              const created = await api.createProject({ name: row.project });
              projectByName.set(key, created.id);
            }
            projectId = projectByName.get(key);
          }
          const taskKey = row.task.toLowerCase();
          if (!taskByTitle.has(taskKey)) {
            const created = await api.createTask({
              title: row.task,
              project_id: projectId ?? null,
            });
            taskByTitle.set(taskKey, created.id);
          }
          await api.createManualEntry({
            task_id: taskByTitle.get(taskKey),
            started_at: row.started_at,
            ended_at: row.ended_at,
          });
          imported++;
        } catch {
          failed++;
        }
      }
      setImportReport(
        `Импортировано записей: ${imported}` +
          (skipped ? ` · пропущено строк: ${skipped}` : '') +
          (failed ? ` · с ошибкой: ${failed}` : ''),
      );
      toast(`Импорт завершён: ${imported} записей`);
    } catch (err) {
      setImportReport(
        err instanceof ApiError ? err.message : 'Не удалось прочитать файл',
      );
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  }

  async function exportData() {
    try {
      const data = await api.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chronos-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Архив данных сохранён');
    } catch {
      toast('Не удалось выгрузить данные');
    }
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: 'Удалить аккаунт?',
      description:
        'Все ваши проекты, задачи и записи времени будут удалены безвозвратно. Для подтверждения введите свой email.',
      confirmLabel: 'Удалить аккаунт',
      requireText: user?.email,
    });
    if (!ok) return;
    try {
      await api.deleteAccount(user?.email ?? '');
      clearToken();
      window.location.href = '/login';
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось удалить аккаунт');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {dialog}

      {isAdmin && (
        <div className="card card-pad">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Компания</div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 14 }}>
            Логотип и цвет видны в переключателе компаний, письмах и публичных
            отчётах.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <WorkspaceBadge
              name={me?.workspace_name ?? ''}
              logoUrl={me?.logo_url}
              color={me?.brand_color ?? '#6366f1'}
              size={52}
            />
            <input
              ref={logoRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              hidden
              onChange={(e) => void onLogoPick(e.target.files?.[0])}
            />
            <button className="btn btn-outline" onClick={() => logoRef.current?.click()}>
              Загрузить логотип
            </button>
            {me?.logo_url && (
              <button
                className="btn btn-ghost"
                onClick={() => void saveWorkspace({ logo_url: null })}
              >
                Убрать
              </button>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
              Название
            </div>
            <input
              className="input input-sm"
              style={{ width: '100%', maxWidth: 320 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() && name.trim() !== me?.workspace_name) {
                  void saveWorkspace({ name: name.trim() });
                }
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 6 }}>
              Цвет компании
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {BRAND_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => void saveWorkspace({ brand_color: c })}
                  title={c}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    background: c,
                    border:
                      me?.brand_color === c
                        ? '2px solid var(--text)'
                        : '1px solid var(--border2)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 6 }}>
              Валюта и формат сумм
            </div>
            <div className="seg seg-flat" style={{ display: 'inline-flex' }}>
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  className={me?.currency === c ? 'on' : ''}
                  style={{ padding: '6px 14px' }}
                  onClick={() => void saveWorkspace({ currency: c })}
                >
                  {c} {CURRENCY_SYMBOL[c]}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 8 }}>
              Ставки хранятся в валюте компании — при смене меняется только
              формат, числа не пересчитываются.
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card card-pad">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Отделы</div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
            Группируют сотрудников — по ним фильтруется «Команда».
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              className="input input-sm"
              style={{ flex: 1, maxWidth: 260 }}
              placeholder="Например, Разработка"
              value={depInput}
              onChange={(e) => setDepInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addDepartment();
              }}
            />
            <button className="btn btn-outline" onClick={() => void addDepartment()}>
              + Создать
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {deps.map((d) => (
              <button
                key={d.id}
                className="chip"
                onClick={() => void removeDepartment(d)}
                title="Удалить отдел"
              >
                {d.name} ✕
              </button>
            ))}
            {deps.length === 0 && (
              <span className="muted" style={{ fontSize: 12 }}>
                Отделов пока нет
              </span>
            )}
          </div>
        </div>
      )}

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Интеграции</div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 8 }}>
          Синхронизация и уведомления (демо — OAuth-подключение появится позже).
        </div>
        {INTEGRATIONS.map((ig) => {
          const on = !!integr[ig.k];
          return (
            <div
              key={ig.k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'var(--surface2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 13,
                  color: 'var(--accent)',
                }}
              >
                {ig.ini}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{ig.name}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{ig.desc}</div>
              </div>
              <button
                className={on ? 'btn btn-ghost' : 'btn btn-accent'}
                onClick={() => toggleIntegration(ig.k)}
              >
                {on ? 'Отключить' : 'Подключить'}
              </button>
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <div className="card card-pad">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            API и вебхуки
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
            Программный доступ к данным компании. «Перевыпустить» мгновенно
            отзывает старый ключ.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input
              className="input input-sm mono"
              style={{ flex: 1 }}
              readOnly
              value={apiKey || 'ключ ещё не выпущен'}
            />
            <button className="btn btn-outline" onClick={() => void regenerateApiKey()}>
              {apiKey ? 'Перевыпустить' : 'Выпустить'}
            </button>
          </div>
          <div>
            <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginBottom: 4 }}>
              Webhook URL — события «таймшит отправлен», «бюджет превышен»
            </div>
            <input
              className="input input-sm"
              style={{ width: '100%' }}
              placeholder="https://example.com/hooks/chronos"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              onBlur={() => {
                window.localStorage.setItem('tt_webhook', webhook);
                toast('Webhook сохранён');
              }}
            />
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card card-pad">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Импорт данных
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
            Переезжаете из другого трекера? Выгрузите отчёт в CSV из Toggl
            Track, Clockify или Harvest — проекты, задачи и записи времени
            перенесутся автоматически.
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => void onImportFile(e.target.files?.[0])}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline"
              disabled={importing}
              onClick={() => importRef.current?.click()}
            >
              {importing ? 'Импортируем…' : 'Выбрать файл CSV…'}
            </button>
          </div>
          {importReport && (
            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: 10 }}>
              {importReport}
            </div>
          )}
        </div>
      )}

      <div className="card card-pad">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
          Данные аккаунта
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginBottom: 12 }}>
          Полный архив ваших данных (GDPR) и удаление аккаунта.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={() => void exportData()}>
            Экспорт всех данных
          </button>
          <button className="btn btn-red" onClick={() => void deleteAccount()}>
            Удалить аккаунт
          </button>
        </div>
      </div>
    </div>
  );
}
