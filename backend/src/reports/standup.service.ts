import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Cron } from '@nestjs/schedule';
import Anthropic from '@anthropic-ai/sdk';
import { Op } from 'sequelize';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { Task, TaskStatus } from '../tasks/entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { UserSettings } from '../users/entities/user-settings.entity';
import {
  entryScope,
  WorkspacesService,
} from '../workspaces/workspaces.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

export type GeneratorMode = 'standup' | 'client' | 'team' | 'notes';
export type StandupDirection = 'ys' | 'st';

export interface GenerateOptions {
  mode: GeneratorMode;
  direction?: StandupDirection;
  include_misc?: boolean;
  ai_summary?: boolean;
  hours_limit?: number;
  project_id?: string | null;
}

const DAY_MS = 86_400_000;
const WEEKDAY_ACC = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среду',
  'четверг',
  'пятницу',
  'субботу',
];
const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** «2ч 05м» / «45м» — как в прототипе. */
function fmtHM(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}ч ${m < 10 ? '0' : ''}${m}м` : `${m}м`;
}

/** DD.MM */
function fmtDM(d: Date): string {
  return (
    String(d.getUTCDate()).padStart(2, '0') +
    '.' +
    String(d.getUTCMonth() + 1).padStart(2, '0')
  );
}

/** Начало UTC-дня со сдвигом off дней назад от сегодня. */
function dayStart(off: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - off),
  );
}

/**
 * Генератор текстов: стендап, отчёт для клиента, сводка команды, release
 * notes (структура текста повторяет прототип «Хронос» v2).
 */
@Injectable()
export class StandupService {
  private readonly logger = new Logger(StandupService.name);
  private readonly anthropic: Anthropic | null;
  private readonly slackWebhookUrl: string;
  private readonly telegramBotToken: string;
  private readonly telegramChatId: string;

  constructor(
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    @InjectModel(Task)
    private readonly taskModel: typeof Task,
    @InjectModel(Project)
    private readonly projectModel: typeof Project,
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(UserSettings)
    private readonly settingsModel: typeof UserSettings,
    private readonly workspacesService: WorkspacesService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    configService: ConfigService,
  ) {
    const apiKey = configService.get<string>('ANTHROPIC_API_KEY');
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
    this.slackWebhookUrl =
      configService.get<string>('integrations.slackWebhookUrl') ?? '';
    this.telegramBotToken =
      configService.get<string>('integrations.telegramBotToken') ?? '';
    this.telegramChatId =
      configService.get<string>('integrations.telegramChatId') ?? '';
  }

  /**
   * Интеграционные вебхуки Slack/TG: отправка текста, если вебхук настроен.
   * Возвращает sent=false (демо-режим), когда конфигурации нет.
   */
  async send(
    channel: 'slack' | 'tg',
    text: string,
  ): Promise<{ sent: boolean }> {
    try {
      if (channel === 'slack' && this.slackWebhookUrl) {
        const res = await fetch(this.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        return { sent: res.ok };
      }
      if (channel === 'tg' && this.telegramBotToken && this.telegramChatId) {
        const res = await fetch(
          `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: this.telegramChatId, text }),
          },
        );
        return { sent: res.ok };
      }
    } catch (err) {
      this.logger.warn(`${channel} webhook delivery failed: ${err}`);
    }
    return { sent: false };
  }

  /** Единая точка генерации по режиму. */
  async generate(userId: string, opts: GenerateOptions): Promise<{ text: string }> {
    switch (opts.mode) {
      case 'client':
        return { text: await this.buildClientReport(userId, opts.project_id) };
      case 'team':
        return { text: await this.buildTeamSummary(userId) };
      case 'notes':
        return { text: await this.buildReleaseNotes(userId) };
      default:
        return { text: await this.buildStandup(userId, opts) };
    }
  }

  /** Записи пользователя за UTC-день (off дней назад) с задачами. */
  private async entriesOfDay(userId: string, off: number): Promise<TimeEntry[]> {
    const start = dayStart(off);
    const end = new Date(start.getTime() + DAY_MS - 1);
    const ctx = await this.workspacesService.getContext(userId);
    return this.timeEntryModel.findAll({
      where: {
        user_id: userId,
        started_at: { [Op.between]: [start, end] },
        ended_at: { [Op.ne]: null },
        ...(entryScope(ctx.workspace.id) as object),
      },
      include: [{ model: Task, include: [Project] }],
      order: [['started_at', 'ASC']],
    });
  }

  /** Отработано секунд с начала месяца (для «Отработано/Осталось часов»). */
  private async monthWorkedSeconds(userId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const ctx = await this.workspacesService.getContext(userId);
    const sum = await this.timeEntryModel.sum('duration_seconds', {
      where: {
        user_id: userId,
        started_at: { [Op.gte]: monthStart },
        ...(entryScope(ctx.workspace.id) as object),
      },
    });
    return Number(sum) || 0;
  }

  /** Стендап-отчёт «вчера → сегодня» / «сегодня → завтра». */
  async buildStandup(userId: string, opts: Partial<GenerateOptions> = {}): Promise<string> {
    const settings = await this.settingsModel.findOne({ where: { user_id: userId } });
    const direction: StandupDirection = opts.direction === 'st' ? 'st' : 'ys';
    const includeMisc = opts.include_misc !== false;
    const miscLine = settings?.standup_misc_line || 'код-ревью и созвоны';
    const hoursLimit = opts.hours_limit ?? settings?.monthly_hours_limit ?? 80;

    const lines: string[] = [settings?.standup_greeting || 'Всем привет!', ''];

    const dayBlock = async (off: number, header: string) => {
      const ents = await this.entriesOfDay(userId, off);
      if (!ents.length) return;
      lines.push(header, '');
      const byTask = new Map<string, { task: Task; sec: number; notes: string[] }>();
      const order: string[] = [];
      const misc: string[] = [];
      const seenDesc = new Set<string>();
      for (const e of ents) {
        if (e.task) {
          let v = byTask.get(e.task.id);
          if (!v) {
            v = { task: e.task, sec: 0, notes: [] };
            byTask.set(e.task.id, v);
            order.push(e.task.id);
          }
          v.sec += e.duration_seconds;
          if (e.note) v.notes.push(e.note);
        } else if (e.description && !seenDesc.has(e.description)) {
          seenDesc.add(e.description);
          misc.push(e.description);
        }
      }
      const aiLines = opts.ai_summary
        ? await this.aiSummaries(
            order.map((id) => {
              const v = byTask.get(id)!;
              return { title: v.task.title, seconds: v.sec, notes: v.notes };
            }),
          )
        : null;
      for (const id of order) {
        const v = byTask.get(id)!;
        lines.push(v.task.external_url || `— ${v.task.title}`);
        if (opts.ai_summary) {
          lines.push(
            '   · ' +
              (aiLines?.get(v.task.title) ?? `${v.task.title} — ${fmtHM(v.sec)}`),
          );
        }
      }
      for (const m of misc) lines.push(`— ${m}`);
      if (includeMisc) lines.push(miscLine);
      lines.push('');
    };

    const today = new Date();
    if (direction === 'ys') {
      for (let off = 3; off >= 1; off--) {
        const d = dayStart(off);
        await dayBlock(
          off,
          `Отчёт за ${off === 1 ? 'вчера' : WEEKDAY_ACC[d.getUTCDay()]} (${fmtDM(d)}):`,
        );
      }
      lines.push(`План на сегодня (${fmtDM(today)})`, '');
    } else {
      await dayBlock(0, `Отчёт за сегодня (${fmtDM(today)}):`);
      lines.push(`План на завтра (${fmtDM(new Date(Date.now() + DAY_MS))})`, '');
    }

    // План: до 3 моих незакрытых задач.
    const myTasks = await this.taskModel.findAll({
      where: {
        [Op.or]: [{ assignee_id: userId }, { assignee_id: null, user_id: userId }],
        status: { [Op.ne]: TaskStatus.DONE },
      },
      order: [['created_at', 'ASC']],
      limit: 3,
    });
    for (const t of myTasks) lines.push(t.external_url || `— ${t.title}`);
    if (includeMisc) lines.push(miscLine);
    lines.push('');

    const workedSec = await this.monthWorkedSeconds(userId);
    const wh = Math.round((workedSec / 3600) * 2) / 2;
    const num = (n: number) => String(n).replace('.', ',');
    lines.push(
      `Отработано часов: ${num(wh)}`,
      `Осталось часов: ${num(Math.max(0, hoursLimit - wh))}`,
    );
    if (settings?.standup_signature) lines.push('', settings.standup_signature);
    return lines.join('\n');
  }

  /**
   * AI-сводка по задачам: одна строка на задачу через Claude API.
   * Без ключа (или при ошибке) — фолбэк «задача — часы».
   */
  private async aiSummaries(
    items: Array<{ title: string; seconds: number; notes: string[] }>,
  ): Promise<Map<string, string> | null> {
    if (!this.anthropic || !items.length) return null;
    try {
      const payload = items.map((i) => ({
        title: i.title,
        hours: fmtHM(i.seconds),
        notes: i.notes.slice(0, 5),
      }));
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-5',
        max_tokens: 1024,
        system:
          'Ты помощник тайм-трекера. Для каждой задачи составь одну короткую строку-сводку на русском для стендап-отчёта: что сделано (по заметкам, если есть) и затраченное время. Формат каждой строки строго: «<title> — <сводка, включая время>». Верни ровно по одной строке на задачу, без нумерации и пустых строк.',
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      const map = new Map<string, string>();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const item = items.find((i) => trimmed.startsWith(i.title));
        if (item) map.set(item.title, trimmed);
      }
      return map.size ? map : null;
    } catch (err) {
      this.logger.warn(`AI summary failed, falling back: ${err}`);
      return null;
    }
  }

  /** Отчёт для клиента (текст): неделя по проекту, часы по дням + сумма. */
  async buildClientReport(userId: string, projectId?: string | null): Promise<string> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Отчёт для клиента доступен админу');
    }
    const project = projectId ? await this.projectModel.findByPk(projectId) : null;
    const d1 = dayStart(6);
    const d2 = dayStart(0);
    const lines = [
      `Отчёт по проекту «${project?.name ?? 'все проекты'}» за неделю (${fmtDM(d1)}–${fmtDM(d2)})`,
      '',
    ];
    let total = 0;
    let money = 0;
    for (let off = 6; off >= 0; off--) {
      const start = dayStart(off);
      const end = new Date(start.getTime() + DAY_MS - 1);
      const ents = (
        await this.timeEntryModel.findAll({
          where: {
            user_id: { [Op.in]: ctx.memberIds },
            started_at: { [Op.between]: [start, end] },
            ended_at: { [Op.ne]: null },
            ...(entryScope(ctx.workspace.id) as object),
          },
          include: [{ model: Task, include: [Project] }],
        })
      ).filter((e) => !projectId || e.task?.project_id === projectId);
      if (!ents.length) continue;
      const sec = ents.reduce((a, e) => a + e.duration_seconds, 0);
      total += sec;
      for (const e of ents) {
        if (e.billable !== false) {
          const rate = e.task?.project?.hourly_rate ?? 0;
          money += (e.duration_seconds / 3600) * rate;
        }
      }
      const names: string[] = [];
      const seen = new Set<string>();
      for (const e of ents) {
        const n = e.task?.title || e.description;
        if (n && !seen.has(n)) {
          seen.add(n);
          names.push(n);
        }
      }
      lines.push(`${fmtDM(start)} — ${fmtHM(sec)}:`);
      for (const n of names) lines.push(`— ${n}`);
      lines.push('');
    }
    const moneyStr = money
      ? ` · ${Math.round(money).toLocaleString('ru-RU')} ₽`
      : '';
    lines.push(`Итого за неделю: ${fmtHM(total)}${moneyStr}`);
    return lines.join('\n');
  }

  /** Сводка команды за вчера (admin+): одна строка на участника. */
  async buildTeamSummary(userId: string): Promise<string> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Сводка команды доступна админу');
    }
    const start = dayStart(1);
    const end = new Date(start.getTime() + DAY_MS - 1);
    const users = await this.userModel.findAll({
      where: { id: { [Op.in]: ctx.memberIds } },
    });
    const entries = await this.timeEntryModel.findAll({
      where: {
        user_id: { [Op.in]: ctx.memberIds },
        started_at: { [Op.between]: [start, end] },
        ended_at: { [Op.ne]: null },
        ...(entryScope(ctx.workspace.id) as object),
      },
      include: [{ model: Task }],
    });
    const lines = [`Сводка команды за вчера (${fmtDM(start)}):`, ''];
    for (const u of users) {
      const ents = entries.filter((e) => e.user_id === u.id);
      if (!ents.length) {
        lines.push(`${u.name} — без записей`);
        continue;
      }
      const sec = ents.reduce((a, e) => a + e.duration_seconds, 0);
      const names: string[] = [];
      const seen = new Set<string>();
      for (const e of ents) {
        const n = e.task?.title || e.description;
        if (n && !seen.has(n)) {
          seen.add(n);
          names.push(n);
        }
      }
      lines.push(`${u.name} — ${names.join(', ') || 'работа без задачи'} (${fmtHM(sec)})`);
    }
    return lines.join('\n');
  }

  /** Release notes: задачи «Готово» команды за неделю. */
  async buildReleaseNotes(userId: string): Promise<string> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Release notes доступны админу');
    }
    const d1 = dayStart(6);
    const d2 = dayStart(0);
    const tasks = await this.taskModel.findAll({
      where: {
        user_id: { [Op.in]: ctx.memberIds },
        status: TaskStatus.DONE,
        [Op.or]: [
          { completed_at: { [Op.gte]: d1 } },
          { completed_at: null, updated_at: { [Op.gte]: d1 } },
        ],
      },
      include: [Project],
      order: [['updated_at', 'DESC']],
    });
    const lines = [
      `Release notes · ${fmtDM(d1)}–${fmtDM(d2)}`,
      '',
      'Готово на этой неделе:',
    ];
    if (!tasks.length) lines.push('— пока пусто');
    for (const t of tasks) {
      lines.push(`— ${t.title} (${t.project?.name ?? 'Без проекта'})`);
    }
    return lines.join('\n');
  }

  /** Сводка недели для таймшита: «вт 11.08 — 4ч 30м: задачи». */
  async buildWeekSummary(userId: string, weekStart: string): Promise<string> {
    const start = new Date(`${weekStart}T00:00:00.000Z`);
    const ctx = await this.workspacesService.getContext(userId);
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const ds = new Date(start.getTime() + i * DAY_MS);
      const de = new Date(ds.getTime() + DAY_MS - 1);
      const ents = await this.timeEntryModel.findAll({
        where: {
          user_id: userId,
          started_at: { [Op.between]: [ds, de] },
          ended_at: { [Op.ne]: null },
          ...(entryScope(ctx.workspace.id) as object),
        },
        include: [{ model: Task }],
        order: [['started_at', 'ASC']],
      });
      if (!ents.length) continue;
      const sec = ents.reduce((a, e) => a + e.duration_seconds, 0);
      const names: string[] = [];
      const seen = new Set<string>();
      for (const e of ents) {
        const n = e.task?.title || e.description;
        if (n && !seen.has(n)) {
          seen.add(n);
          names.push(n);
        }
      }
      out.push(
        `${WEEKDAY_SHORT[ds.getUTCDay()]} ${fmtDM(ds)} — ${fmtHM(sec)}: ${names.join(', ')}`,
      );
    }
    return out.join('\n');
  }

  /** 09:30 будни: напоминание про стендап тем, кто трекал за последнюю неделю. */
  @Cron('30 9 * * 1-5')
  async standupReminder(): Promise<void> {
    try {
      const since = new Date(Date.now() - 7 * DAY_MS);
      const rows = (await this.timeEntryModel.findAll({
        attributes: ['user_id'],
        where: { started_at: { [Op.gte]: since } },
        group: ['user_id'],
        raw: true,
      })) as unknown as Array<{ user_id: string }>;
      for (const r of rows) {
        this.notificationsService.notify(
          r.user_id,
          'Не забудьте стендап-отчёт — кнопка ⚡ в Трекере соберёт его за вас',
          'amber',
          { kind: 'standup', action: '', event: 'standup_reminder' },
        );
      }
    } catch (err) {
      this.logger.warn(`standup reminder failed: ${err}`);
    }
  }

  /** Понедельник 09:00: «Дайджест недели» — письмо по прошлой неделе. */
  @Cron('0 9 * * 1')
  async weeklyDigest(): Promise<void> {
    try {
      const now = new Date();
      const day = now.getUTCDay();
      const diff = (day === 0 ? 6 : day - 1) + 7; // понедельник прошлой недели
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff),
      );
      const end = new Date(start.getTime() + 7 * DAY_MS - 1);
      const entries = (await this.timeEntryModel.findAll({
        where: {
          started_at: { [Op.between]: [start, end] },
          ended_at: { [Op.ne]: null },
        },
        include: [{ model: Task, include: [Project] }],
      })) as TimeEntry[];
      if (!entries.length) return;

      const byUser = new Map<string, TimeEntry[]>();
      for (const e of entries) {
        const list = byUser.get(e.user_id) ?? [];
        list.push(e);
        byUser.set(e.user_id, list);
      }
      const weekLabel = `${fmtDM(start)}–${fmtDM(new Date(start.getTime() + 6 * DAY_MS))}`;

      for (const [userId, list] of byUser) {
        try {
          const user = await this.userModel.findByPk(userId);
          if (!user) continue;
          if (
            !(await this.notificationsService.channelEnabled(
              userId,
              'weekly_digest',
              'email',
            ))
          ) {
            continue;
          }
          const settings = await this.settingsModel.findOne({
            where: { user_id: userId },
          });
          const goalSec = (settings?.daily_goal_hours ?? 6) * 3600;
          const total = list.reduce((a, e) => a + e.duration_seconds, 0);

          // Стрик: подряд дней (с конца недели) с выполненной целью.
          const perDay = new Array(7).fill(0);
          for (const e of list) {
            const idx = Math.floor(
              (new Date(e.started_at).getTime() - start.getTime()) / DAY_MS,
            );
            if (idx >= 0 && idx < 7) perDay[idx] += e.duration_seconds;
          }
          let streak = 0;
          for (let i = 6; i >= 0; i--) {
            if (perDay[i] >= goalSec) streak++;
            else if (perDay[i] > 0 || i < 5) break;
          }

          const tasksDone = await this.taskModel.count({
            where: {
              [Op.or]: [{ assignee_id: userId }, { user_id: userId }],
              status: TaskStatus.DONE,
              completed_at: { [Op.between]: [start, end] },
            },
          });

          const byProject = new Map<string, number>();
          for (const e of list) {
            const name = e.task?.project?.name ?? 'Без проекта';
            byProject.set(name, (byProject.get(name) ?? 0) + e.duration_seconds);
          }
          const top = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0];

          await this.mailService.sendWeeklyDigest(user.email, user.name, {
            week_label: weekLabel,
            hours_label: fmtHM(total),
            tasks_done: tasksDone,
            streak_days: streak,
            top_project: top ? top[0] : null,
          });
        } catch (err) {
          this.logger.warn(`weekly digest for ${userId} failed: ${err}`);
        }
      }
    } catch (err) {
      this.logger.warn(`weekly digest failed: ${err}`);
    }
  }

  /** 10:00 будни: авто-генерация и «отправка» стендапа (standup_auto_send). */
  @Cron('0 10 * * 1-5')
  async standupAutoSend(): Promise<void> {
    try {
      const settings = await this.settingsModel.findAll({
        where: { standup_auto_send: true },
      });
      for (const s of settings) {
        try {
          const text = await this.buildStandup(s.user_id, { direction: 'ys' });
          this.logger.log(
            `[AUTO STANDUP] user=${s.user_id}\n${text.slice(0, 200)}…`,
          );
          const [slack, tg] = await Promise.all([
            this.send('slack', text),
            this.send('tg', text),
          ]);
          const delivered = [
            slack.sent ? 'Slack' : null,
            tg.sent ? 'Telegram' : null,
          ].filter(Boolean);
          this.notificationsService.notify(
            s.user_id,
            delivered.length
              ? `Стендап-отчёт отправлен в ${delivered.join(' и ')} (авто, 10:00)`
              : 'Стендап-отчёт сгенерирован (авто, 10:00) — вебхуки Slack/TG не настроены',
            'green',
            { kind: 'standup', action: '', event: 'standup_reminder' },
          );
        } catch (err) {
          this.logger.warn(`auto standup for ${s.user_id} failed: ${err}`);
        }
      }
    } catch (err) {
      this.logger.warn(`standup auto-send failed: ${err}`);
    }
  }
}
