import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import { Op } from 'sequelize';
import { ReportShare } from './report-share.entity';
import { ReportComment } from './report-comment.entity';
import { TimeEntry } from '../time-entries/entities/time-entry.entity';
import { Task } from '../tasks/entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { Milestone } from '../projects/entities/milestone.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import {
  entryScope,
  WorkspacesService,
} from '../workspaces/workspaces.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { dayRange } from '../common/day-range';

/** Округление часов вверх до шага (0 — без округления). */
function roundHours(hours: number, roundingMinutes: number): number {
  if (!roundingMinutes) return hours;
  const step = roundingMinutes / 60;
  return Math.ceil(hours / step) * step;
}

export interface InvoiceRow {
  task_title: string;
  hours: number;
  rate: number;
  sum: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(ReportShare)
    private readonly shareModel: typeof ReportShare,
    @InjectModel(TimeEntry)
    private readonly timeEntryModel: typeof TimeEntry,
    @InjectModel(Project)
    private readonly projectModel: typeof Project,
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Milestone)
    private readonly milestoneModel: typeof Milestone,
    @InjectModel(ReportComment)
    private readonly commentModel: typeof ReportComment,
    @InjectModel(AuditLog)
    private readonly auditModel: typeof AuditLog,
    private readonly workspacesService: WorkspacesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Превью счёта: billable-часы задач проекта × ставка за период. */
  async invoicePreview(
    userId: string,
    from: string,
    to: string,
    projectId?: string,
  ): Promise<{
    number: string;
    period: { from: string; to: string };
    project_name: string;
    rows: InvoiceRow[];
    total: number;
  }> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Счета доступны только админу');
    }
    const start = dayRange(from).start;
    const end = dayRange(to).end;

    const project = projectId
      ? await this.projectModel.findByPk(projectId)
      : null;
    const entries = await this.timeEntryModel.findAll({
      where: {
        user_id: { [Op.in]: ctx.memberIds },
        started_at: { [Op.between]: [start, end] },
        billable: { [Op.ne]: false },
        ...(entryScope(ctx.workspace.id) as object),
      },
      include: [{ model: Task, include: [Project], required: true }],
    });

    const byTask = new Map<string, { title: string; seconds: number; rate: number }>();
    for (const e of entries) {
      const task = e.task;
      if (!task?.project_id) continue;
      if (projectId && task.project_id !== projectId) continue;
      const rate = task.project?.hourly_rate ?? 0;
      const cur = byTask.get(task.id) ?? { title: task.title, seconds: 0, rate };
      cur.seconds += e.duration_seconds;
      byTask.set(task.id, cur);
    }

    // Точность времени: округление из настроек компании (15/30 мин).
    const rounding = ctx.workspace.rounding_minutes ?? 0;
    let total = 0;
    const rows: InvoiceRow[] = [...byTask.values()]
      .map((t) => {
        const hours = roundHours(t.seconds / 3600, rounding);
        const sum = hours * t.rate;
        total += sum;
        return {
          task_title: t.title,
          hours: Math.round(hours * 100) / 100,
          rate: t.rate,
          sum: Math.round(sum),
        };
      })
      .sort((a, b) => b.sum - a.sum);

    return {
      number: `INV-${from.slice(5).replace('-', '')}`,
      period: { from, to },
      project_name: project?.name ?? 'Все проекты',
      rows,
      total: Math.round(total),
    };
  }

  /** Публичная ссылка на отчёт: get-or-create для проекта (admin+). */
  async getOrCreateShare(
    userId: string,
    projectId?: string | null,
  ): Promise<ReportShare> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Публичные ссылки доступны только админу');
    }
    const [share] = await this.shareModel.findOrCreate({
      where: {
        workspace_id: ctx.workspace.id,
        project_id: projectId ?? null,
      },
      defaults: {
        workspace_id: ctx.workspace.id,
        user_id: userId,
        project_id: projectId ?? null,
        token: randomBytes(16).toString('hex'),
        active: true,
      },
    });
    return share;
  }

  async updateShare(
    userId: string,
    id: string,
    patch: Partial<{ active: boolean; hide_money: boolean; hide_names: boolean }>,
  ): Promise<ReportShare> {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.isAdmin) {
      throw new ForbiddenException('Публичные ссылки доступны только админу');
    }
    const share = await this.shareModel.findOne({
      where: { id, workspace_id: ctx.workspace.id },
    });
    if (!share) {
      throw new NotFoundException('Ссылка не найдена');
    }
    if (patch.active !== undefined) share.active = patch.active;
    if (patch.hide_money !== undefined) share.hide_money = patch.hide_money;
    if (patch.hide_names !== undefined) share.hide_names = patch.hide_names;
    return share.save();
  }

  /**
   * Отчёт по проекту для ролей client/pm: агрегаты недели всей команды
   * по привязанному проекту (клиент — без денег и имён по умолчанию с деньгами скрытыми).
   */
  async myProjectReport(userId: string) {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.project_id) {
      throw new NotFoundException('К вашей роли не привязан проект');
    }
    return this.buildProjectReport(ctx.workspace.id, ctx.project_id, {
      // «Менеджер/клиент — без денег» (ТЗ RBAC).
      hideMoney: true,
      hideNames: ctx.role === 'client',
    });
  }

  /** Публичный отчёт по токену: неделя проекта, с учётом hide_money/hide_names. */
  async publicReport(token: string) {
    const share = await this.shareModel.findOne({ where: { token } });
    if (!share || !share.active) {
      throw new NotFoundException('Ссылка недействительна или выключена');
    }
    return this.buildProjectReport(share.workspace_id, share.project_id, {
      hideMoney: share.hide_money,
      hideNames: share.hide_names,
    });
  }

  /**
   * Клиентский дашборд: бюджет этапа (часы из лимита + прогноз даты),
   * вехи проекта и лента недели (события из аудита по проекту).
   */
  async clientDashboard(userId: string) {
    const ctx = await this.workspacesService.getContext(userId);
    if (!ctx.project_id) {
      throw new NotFoundException('К вашей роли не привязан проект');
    }
    const projectId = ctx.project_id;
    const project = await this.projectModel.findByPk(projectId);
    if (!project) throw new NotFoundException('Проект не найден');

    const weekStart = new Date(Date.now() - 6 * 86_400_000);
    weekStart.setUTCHours(0, 0, 0, 0);

    const [entries, milestones, events, taskIds] = await Promise.all([
      this.timeEntryModel.findAll({
        where: {
          user_id: { [Op.in]: ctx.memberIds },
          ...(entryScope(ctx.workspace.id) as object),
        },
        include: [{ model: Task, required: true, where: { project_id: projectId } }],
        attributes: ['started_at', 'duration_seconds'],
      }),
      this.milestoneModel.findAll({
        where: { project_id: projectId },
        order: [
          ['due_date', 'ASC'],
          ['created_at', 'ASC'],
        ],
      }),
      this.auditModel.findAll({
        where: {
          workspace_id: ctx.workspace.id,
          created_at: { [Op.gte]: weekStart },
        },
        order: [['created_at', 'DESC']],
        limit: 100,
      }),
      Task.findAll({
        where: { project_id: projectId },
        attributes: ['id', 'title'],
      }),
    ]);

    const totalSeconds = entries.reduce((s, e) => s + e.duration_seconds, 0);
    const weekSeconds = entries
      .filter((e) => new Date(e.started_at) >= weekStart)
      .reduce((s, e) => s + e.duration_seconds, 0);
    // Бюджет этапа = недельный бюджет проекта; прогноз по недельному темпу.
    const budgetHours = project.weekly_budget_hours || 0;
    const usedHours = Math.round((totalSeconds / 3600) * 10) / 10;
    const weekHours = weekSeconds / 3600;
    const remaining = Math.max(0, budgetHours - usedHours);
    const forecastDate =
      budgetHours && weekHours > 0
        ? new Date(
            Date.now() + (remaining / weekHours) * 7 * 86_400_000,
          )
            .toISOString()
            .slice(0, 10)
        : null;

    // Лента недели: события аудита, относящиеся к задачам/вехам проекта.
    const titles = new Set(taskIds.map((t) => t.title));
    const milestoneTitles = new Set(milestones.map((m) => m.title));
    const feed = events
      .filter((e) => {
        if (e.entity_type === 'milestone') {
          return [...milestoneTitles].some((t) => e.action.includes(t));
        }
        if (e.entity_type === 'task') {
          return [...titles].some((t) => e.action.includes(t));
        }
        return false;
      })
      .slice(0, 20)
      .map((e) => ({
        id: e.id,
        action: e.action,
        created_at: e.created_at,
      }));

    return {
      project_id: projectId,
      project_name: project.name,
      project_color: project.color,
      budget: {
        // Клиенту деньги не показываем — только часы (ТЗ: «без денег»).
        budget_hours: budgetHours,
        used_hours: usedHours,
        week_hours: Math.round(weekHours * 10) / 10,
        forecast_date: forecastDate,
      },
      milestones: milestones.map((m) => ({
        id: m.id,
        title: m.title,
        due_date: m.due_date,
        status: m.status,
      })),
      feed,
    };
  }

  // --- Вопросы по отчёту: тред клиент ↔ менеджер ---

  /** Проект треда для роли: client/pm — свой, admin — по параметру. */
  private async threadProjectId(
    userId: string,
    projectId?: string | null,
  ): Promise<{ projectId: string; workspaceId: string; memberIds: string[] }> {
    const ctx = await this.workspacesService.getContext(userId);
    const target =
      ctx.role === WorkspaceRole.CLIENT || ctx.role === WorkspaceRole.PM
        ? ctx.project_id
        : (projectId ?? ctx.project_id);
    if (!target) {
      throw new NotFoundException('Проект для обсуждения не указан');
    }
    return {
      projectId: target,
      workspaceId: ctx.workspace.id,
      memberIds: ctx.memberIds,
    };
  }

  async listComments(userId: string, projectId?: string | null) {
    const { projectId: pid } = await this.threadProjectId(userId, projectId);
    const rows = await this.commentModel.findAll({
      where: { project_id: pid },
      include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
      order: [['created_at', 'ASC']],
      limit: 200,
    });
    return rows.map((c) => ({
      id: c.id,
      project_id: c.project_id,
      author_id: c.author_id,
      author_name: c.author?.name ?? '—',
      body: c.body,
      created_at: c.created_at,
    }));
  }

  async addComment(userId: string, body: string, projectId?: string | null) {
    const { projectId: pid, memberIds } = await this.threadProjectId(
      userId,
      projectId,
    );
    const comment = await this.commentModel.create({
      project_id: pid,
      author_id: userId,
      body,
    });
    // Уведомляем остальных участников проекта (менеджеру — вопрос клиента).
    const author = await this.userModel.findByPk(userId);
    for (const uid of memberIds) {
      if (uid === userId) continue;
      this.notificationsService.notify(
        uid,
        `Новый вопрос по отчёту от ${author?.name ?? 'участника'}: «${body.slice(0, 60)}»`,
        'accent',
        { kind: 'system', action: 'reports' },
      );
    }
    return {
      id: comment.id,
      project_id: pid,
      author_id: userId,
      author_name: author?.name ?? '—',
      body: comment.body,
      created_at: comment.created_at,
    };
  }

  /** Общий построитель проектного отчёта за последнюю неделю. */
  private async buildProjectReport(
    workspaceId: string,
    projectId: string | null,
    opts: { hideMoney: boolean; hideNames: boolean },
  ) {
    const memberIds = (
      await this.workspacesService.getMembers(workspaceId)
    ).map((m) => m.user_id);

    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const start = dayRange(from).start;
    const end = dayRange(to).end;

    const project = projectId
      ? await this.projectModel.findByPk(projectId)
      : null;

    const entries = await this.timeEntryModel.findAll({
      where: {
        user_id: { [Op.in]: memberIds },
        started_at: { [Op.between]: [start, end] },
        ...(entryScope(workspaceId) as object),
      },
      include: [{ model: Task, include: [Project], required: !!projectId }],
    });
    const filtered = projectId
      ? entries.filter((e) => e.task?.project_id === projectId)
      : entries;

    const users = opts.hideNames
      ? []
      : await this.userModel.findAll({
          where: { id: { [Op.in]: memberIds } },
        });

    const byDay = new Map<string, number>();
    const byTask = new Map<
      string,
      { title: string; seconds: number; billable: number; status: string }
    >();
    const byUser = new Map<string, number>();
    let totalBillable = 0;
    for (const e of filtered) {
      const day = e.started_at.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + e.duration_seconds);
      byUser.set(e.user_id, (byUser.get(e.user_id) ?? 0) + e.duration_seconds);
      if (e.billable !== false) totalBillable += e.duration_seconds;
      if (e.task) {
        const t = byTask.get(e.task.id) ?? {
          title: e.task.title,
          seconds: 0,
          billable: 0,
          status: e.task.status,
        };
        t.seconds += e.duration_seconds;
        if (e.billable !== false) t.billable += e.duration_seconds;
        byTask.set(e.task.id, t);
      }
    }

    const workspace = await this.workspacesService.getById(workspaceId);
    const rate = project?.hourly_rate ?? 0;
    const rounding = workspace?.rounding_minutes ?? 0;
    return {
      project_name: project?.name ?? 'Все проекты',
      project_color: project?.color ?? null,
      // Публичная страница показывает суммы в валюте компании.
      currency: workspace?.currency ?? 'RUB',
      workspace_name: workspace?.name ?? 'Хронос',
      brand_color: workspace?.brand_color ?? '#6366f1',
      logo_url: workspace?.logo_url ?? null,
      period: { from, to },
      days: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, seconds]) => ({ date, seconds })),
      tasks: [...byTask.values()]
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 10)
        .map((t) => ({ title: t.title, seconds: t.seconds, status: t.status })),
      // Счётчики карточек публичного отчёта (макет Public Report.dc.html).
      tasks_in_progress: [...byTask.values()].filter(
        (t) => t.status === 'in_progress',
      ).length,
      tasks_done: [...byTask.values()].filter((t) => t.status === 'done').length,
      members: opts.hideNames
        ? []
        : [...byUser.entries()].map(([id, seconds]) => ({
            name: users.find((u) => u.id === id)?.name ?? '—',
            seconds,
          })),
      total_seconds: filtered.reduce((s, e) => s + e.duration_seconds, 0),
      money: opts.hideMoney
        ? null
        : Math.round(roundHours(totalBillable / 3600, rounding) * rate),
    };
  }
}
